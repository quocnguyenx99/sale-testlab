import type { ClassifiedMessage, ContentType, MessageCategory } from "../types/pipeline";

export interface SessionRecord {
  session_id: string;
  conversation_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  message_count: number;
  sender_ids: string[];
  sender_names: string[];
  dominant_category: MessageCategory;
  categories: Record<string, number>;
  content_types: Record<string, number>;
  avg_confidence: number;
  has_sales_signal: boolean;
  has_accounting_signal: boolean;
  has_internal_operation: boolean;
  has_persona_signal: boolean;
  messages: ClassifiedMessage[];
}

export interface SessionSummary {
  total_sessions: number;
  total_messages: number;
  avg_messages_per_session: number;
  avg_duration_minutes: number;
  dominant_category_counts: Record<string, number>;
  session_size_buckets: Record<string, number>;
  longest_sessions: Array<{ session_id: string; duration_minutes: number; message_count: number }>;
  highest_confidence_sessions: Array<{
    session_id: string;
    avg_confidence: number;
    message_count: number;
  }>;
}

export interface SessionRefineMetrics {
  absorbed_ack_count: number;
  soft_merge_count: number;
  confidence_bridge_count: number;
  sticky_window_merge_count: number;
}

export interface SessionAudit {
  sessions_with_1_message: number;
  sessions_longer_than_2_hours: number;
  sessions_with_mixed_categories: number;
  sessions_with_low_avg_confidence: number;
  possible_over_split_count: number;
  possible_under_split_count: number;
  absorbed_ack_count: number;
  soft_merge_count: number;
  confidence_bridge_count: number;
  sticky_window_merge_count: number;
}

export interface BuildSessionsResult {
  sessions: SessionRecord[];
  refine_metrics: SessionRefineMetrics;
}

const OPERATIONAL_CATEGORIES = new Set<MessageCategory>([
  "internal_operation",
  "accounting",
  "warehouse",
  "logistics"
]);

const CUSTOMER_FLOW_CATEGORIES = new Set<MessageCategory>([
  "sales",
  "customer_support",
  "casual_chat"
]);

const SOFT_CATEGORIES = new Set<MessageCategory>(["casual_chat", "customer_support", "media_only"]);

const ACK_PATTERNS: RegExp[] = [
  /^\s*dạ+\s*$/i,
  /^\s*ok+\s*$/i,
  /^\s*rồi+\s*$/i,
  /^\s*vâng+\s*$/i,
  /^\s*yes\s*$/i,
  /^\s*check\s*$/i,
  /^\s*gửi rồi\s*$/i,
  /^\s*done\s*$/i,
  /^\s*ib\s*$/i,
  /^\s*👍+\s*$/i
];

function toMs(ts: string): number {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const v = Date.parse(iso);
  return Number.isNaN(v) ? 0 : v;
}

function minuteDiff(a: string, b: string): number {
  return Math.max(0, (toMs(b) - toMs(a)) / 60000);
}

function isOperational(c: MessageCategory): boolean {
  return OPERATIONAL_CATEGORIES.has(c);
}

function isCustomerFlow(c: MessageCategory): boolean {
  return CUSTOMER_FLOW_CATEGORIES.has(c);
}

function isStrongUnrelatedChange(prev: MessageCategory, next: MessageCategory): boolean {
  if (prev === next) return false;
  if (isOperational(prev) && isOperational(next)) return false;
  if (isCustomerFlow(prev) && isCustomerFlow(next)) return false;
  if (prev === "noise" || next === "noise") return false;
  if (prev === "media_only" || next === "media_only") return false;
  return true;
}

function isAckMessage(message: ClassifiedMessage): boolean {
  const text = (message.text ?? "").trim();
  if (!text) return false;
  if (text.length <= 4) return true;
  return ACK_PATTERNS.some((p) => p.test(text));
}

function mapCounts<T extends string>(items: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[item] = (out[item] ?? 0) + 1;
  return out;
}

function dominantCategory(categories: Record<string, number>): MessageCategory {
  let winner = "unknown" as MessageCategory;
  let max = -1;
  for (const [k, v] of Object.entries(categories)) {
    if (v > max) {
      winner = k as MessageCategory;
      max = v;
    }
  }
  return winner;
}

function buildSession(sessionId: string, messages: ClassifiedMessage[]): SessionRecord {
  const first = messages[0];
  const last = messages[messages.length - 1];
  const senderIds = Array.from(new Set(messages.map((m) => m.sender_id)));
  const senderNames = Array.from(new Set(messages.map((m) => m.sender_name)));
  const categories = mapCounts(messages.map((m) => m.message_category));
  const contentTypes = mapCounts(messages.map((m) => m.content_type as ContentType));
  const avgConfidence =
    messages.reduce((acc, m) => acc + m.confidence, 0) / Math.max(1, messages.length);

  return {
    session_id: sessionId,
    conversation_id: first.conversation_id,
    start_time: first.created_at,
    end_time: last.created_at,
    duration_minutes: Number(minuteDiff(first.created_at, last.created_at).toFixed(2)),
    message_count: messages.length,
    sender_ids: senderIds,
    sender_names: senderNames,
    dominant_category: dominantCategory(categories),
    categories,
    content_types: contentTypes,
    avg_confidence: Number(avgConfidence.toFixed(4)),
    has_sales_signal: messages.some((m) => m.candidate_sales || m.message_category === "sales"),
    has_accounting_signal: messages.some((m) => m.message_category === "accounting"),
    has_internal_operation: messages.some((m) => m.message_category === "internal_operation"),
    has_persona_signal: messages.some((m) => m.persona_signal),
    messages
  };
}

export function buildSessions(rows: ClassifiedMessage[], month: string): BuildSessionsResult {
  const byConversation = new Map<string, ClassifiedMessage[]>();
  for (const row of rows) {
    const list = byConversation.get(row.conversation_id) ?? [];
    list.push(row);
    byConversation.set(row.conversation_id, list);
  }

  const sessions: SessionRecord[] = [];
  const refineMetrics: SessionRefineMetrics = {
    absorbed_ack_count: 0,
    soft_merge_count: 0,
    confidence_bridge_count: 0,
    sticky_window_merge_count: 0
  };

  for (const [conversationId, convRows] of byConversation.entries()) {
    convRows.sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
    let current: ClassifiedMessage[] = [];
    let sessionIdx = 1;

    for (let i = 0; i < convRows.length; i += 1) {
      const row = convRows[i];
      if (current.length === 0) {
        current.push(row);
        continue;
      }

      const prev = current[current.length - 1];
      const gapMinutes = minuteDiff(prev.created_at, row.created_at);
      const prevCat = prev.message_category;
      const nextCat = row.message_category;

      const hardSplitByTime = gapMinutes > 30;
      const hardSplitByParse = prev.parse_status !== "ok" || row.parse_status !== "ok";
      const strongChange = isStrongUnrelatedChange(prevCat, nextCat);
      const unrelatedFamilies =
        strongChange && !SOFT_CATEGORIES.has(prevCat) && !SOFT_CATEGORIES.has(nextCat);

      let forceMerge = false;
      if (!hardSplitByTime && !hardSplitByParse) {
        if (isAckMessage(row) && gapMinutes <= 5) {
          forceMerge = true;
          refineMetrics.absorbed_ack_count += 1;
        } else if (
          gapMinutes <= 5 &&
          (SOFT_CATEGORIES.has(prevCat) || SOFT_CATEGORIES.has(nextCat)) &&
          (isOperational(prevCat) || isOperational(nextCat))
        ) {
          forceMerge = true;
          refineMetrics.soft_merge_count += 1;
        } else if (gapMinutes <= 3 && row.confidence < 0.35 && prev.confidence > row.confidence) {
          forceMerge = true;
          refineMetrics.confidence_bridge_count += 1;
        } else if (gapMinutes <= 15 && isOperational(prevCat) && isOperational(nextCat)) {
          forceMerge = true;
          refineMetrics.sticky_window_merge_count += 1;
        }
      }

      const shouldSplit = (hardSplitByTime || hardSplitByParse || unrelatedFamilies) && !forceMerge;
      if (shouldSplit) {
        const sessionId = `${month}-${conversationId}-${String(sessionIdx).padStart(4, "0")}`;
        sessions.push(buildSession(sessionId, current));
        sessionIdx += 1;
        current = [row];
      } else {
        current.push(row);
      }
    }

    if (current.length > 0) {
      const sessionId = `${month}-${conversationId}-${String(sessionIdx).padStart(4, "0")}`;
      sessions.push(buildSession(sessionId, current));
    }
  }

  sessions.sort((a, b) => toMs(a.start_time) - toMs(b.start_time));
  return { sessions, refine_metrics: refineMetrics };
}

export function buildSessionSummary(sessions: SessionRecord[]): SessionSummary {
  const totalMessages = sessions.reduce((acc, s) => acc + s.message_count, 0);
  const avgMessages = sessions.length ? totalMessages / sessions.length : 0;
  const avgDuration =
    sessions.length
      ? sessions.reduce((acc, s) => acc + s.duration_minutes, 0) / sessions.length
      : 0;

  const dominantCounts: Record<string, number> = {};
  for (const s of sessions) {
    dominantCounts[s.dominant_category] = (dominantCounts[s.dominant_category] ?? 0) + 1;
  }

  const sizeBuckets = {
    "1": 0,
    "2-5": 0,
    "6-10": 0,
    "11-20": 0,
    "21+": 0
  };
  for (const s of sessions) {
    if (s.message_count === 1) sizeBuckets["1"] += 1;
    else if (s.message_count <= 5) sizeBuckets["2-5"] += 1;
    else if (s.message_count <= 10) sizeBuckets["6-10"] += 1;
    else if (s.message_count <= 20) sizeBuckets["11-20"] += 1;
    else sizeBuckets["21+"] += 1;
  }

  const longest = [...sessions]
    .sort((a, b) => b.duration_minutes - a.duration_minutes)
    .slice(0, 10)
    .map((s) => ({
      session_id: s.session_id,
      duration_minutes: s.duration_minutes,
      message_count: s.message_count
    }));

  const highestConfidence = [...sessions]
    .sort((a, b) => b.avg_confidence - a.avg_confidence)
    .slice(0, 10)
    .map((s) => ({
      session_id: s.session_id,
      avg_confidence: s.avg_confidence,
      message_count: s.message_count
    }));

  return {
    total_sessions: sessions.length,
    total_messages: totalMessages,
    avg_messages_per_session: Number(avgMessages.toFixed(4)),
    avg_duration_minutes: Number(avgDuration.toFixed(4)),
    dominant_category_counts: dominantCounts,
    session_size_buckets: sizeBuckets,
    longest_sessions: longest,
    highest_confidence_sessions: highestConfidence
  };
}

export function buildSessionAudit(
  sessions: SessionRecord[],
  refineMetrics?: SessionRefineMetrics
): SessionAudit {
  const oneMessage = sessions.filter((s) => s.message_count === 1).length;
  const overTwoHours = sessions.filter((s) => s.duration_minutes > 120).length;
  const mixedCategories = sessions.filter((s) => Object.keys(s.categories).length >= 3).length;
  const lowConfidence = sessions.filter((s) => s.avg_confidence < 0.4).length;

  let possibleOverSplit = 0;
  for (let i = 0; i < sessions.length - 1; i += 1) {
    const a = sessions[i];
    const b = sessions[i + 1];
    if (a.conversation_id !== b.conversation_id) continue;
    const gap = minuteDiff(a.end_time, b.start_time);
    if (gap <= 5 && a.dominant_category === b.dominant_category) {
      possibleOverSplit += 1;
    }
  }

  const possibleUnderSplit = sessions.filter(
    (s) => s.duration_minutes > 120 && Object.keys(s.categories).length >= 4
  ).length;

  return {
    sessions_with_1_message: oneMessage,
    sessions_longer_than_2_hours: overTwoHours,
    sessions_with_mixed_categories: mixedCategories,
    sessions_with_low_avg_confidence: lowConfidence,
    possible_over_split_count: possibleOverSplit,
    possible_under_split_count: possibleUnderSplit,
    absorbed_ack_count: refineMetrics?.absorbed_ack_count ?? 0,
    soft_merge_count: refineMetrics?.soft_merge_count ?? 0,
    confidence_bridge_count: refineMetrics?.confidence_bridge_count ?? 0,
    sticky_window_merge_count: refineMetrics?.sticky_window_merge_count ?? 0
  };
}
