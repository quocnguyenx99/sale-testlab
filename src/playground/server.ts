import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { randomUUID } from "crypto";
import { RuntimeSessionManager } from "../runtime/runtimeSessionManager";
import { RuntimeState, detectAssistantStyle } from "../runtime/runtimeConstraints";
import { normalizeForMatch, routeRuntimeState } from "../runtime/runtimeStateRouter";
import {
  RuntimeConversationContext,
  RuntimePersonaForPrompt,
  buildEnrichedRuntimePrompt
} from "../runtime/runtimePromptBuilder";
import { generateLocalAIReply } from "../runtime/localAIRuntimeAdapter";
import { ProductScenario } from "../runtime/productScenarioCatalog";
import { buildCustomerOpeningEnriched } from "../runtime/customerOpeningBuilder";
import { ConversationMemorySlots, createEmptyMemory, updateMemorySlots } from "../runtime/conversationMemory";
import {
  ConversationProgress,
  createEmptyConversationProgress,
  ensureConversationProgress,
  getFirstUnresolvedTopic,
  ConversationTopic,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "../runtime/conversationProgressTracker";
import {
  detectRepeatedTopicAsking,
  isGenericConfirmationIntent,
  isRepeatedGenericFallback,
  detectRepeatedFreeFormLoop
} from "../runtime/repetitionGuard";
import {
  ConversationIdentityProfile,
  buildIdentityProfileFromPersona,
  detectBuyerRoleViolation,
  detectIdentityDrift,
  repairBuyerRoleViolation,
  runCustomerVoiceGuard,
  rewriteVoiceDrift,
  repairPronounDrift
} from "../runtime/conversationIdentity";
import {
  buildResponseBankReply
} from "../runtime/responseBank";
import {
  buildCompletionReply,
  evaluateConversationCompletion,
  shouldForceCompletionReply,
  detectReopenedAnsweredTopics
} from "../runtime/conversationCompletion";
import {
  processDealState,
  DealState,
  getTerminalReply
} from "../runtime/dealState";
import {
  isDirectQuestion,
  isPriceActuallyQuoted,
  isActualStockLeak,
  hasGatedTerms,
  hasSupportPhrases,
  applySafetyGuards,
  RuntimeReplySource
} from "../runtime/safetyGuards";
import { createV3Api } from "./v3/publicApi";
import { CompatibilitySimulationOrchestrator } from "./v3/simulationOrchestrator";
import { SimulationService } from "./v3/simulationService";
import { DatabaseSessionRepository } from "./v3/databaseSessionRepository";
import { DatabaseAuthRepository } from "./v3/databaseAuthRepository";
import { AuthService } from "./v3/authService";
import { prisma } from "./v3/prismaClient";
import { DatabaseEvaluationRepository } from "./v3/evaluation/databaseEvaluationRepository";
import { EvaluationService } from "./v3/evaluation/evaluationService";
import { LocalAIEvaluationProvider } from "./v3/evaluation/evaluationProvider";
import { DatabaseCoachingRepository } from "./v3/coaching/databaseCoachingRepository";
import { CoachingService } from "./v3/coaching/coachingService";
import { LocalAICoachingProvider } from "./v3/coaching/coachingProvider";
import { DatabaseProgressRepository } from "./v3/progress/databaseProgressRepository";
import { ProgressService } from "./v3/progress/progressService";
import { DatabaseTrainingProgramRepository } from "./v3/trainingPrograms/databaseTrainingProgramRepository";
import { TrainingProgramService } from "./v3/trainingPrograms/trainingProgramService";
import { DatabaseTrainingAssignmentRepository } from "./v3/trainingAssignments/databaseTrainingAssignmentRepository";
import { TrainingAssignmentService } from "./v3/trainingAssignments/trainingAssignmentService";
import { DatabaseTrainingContentRepository } from "./v3/trainingContent/databaseTrainingContentRepository";
import { RuntimeContentResolver, scenarioForRuntimeExecution } from "./v3/trainingContent/runtimeContentResolver";
import { TrainingContentService } from "./v3/trainingContent/trainingContentService";
import {
  rebuildRuntimeState,
  RuntimeRecoverySnapshot,
  toSafeRuntimeMemory
} from "./v3/runtimeRecovery";

type RuntimePersonaRecord = RuntimePersonaForPrompt & {
  source_entity_id: string;
  runtime_usefulness_score: number;
  primary_contexts: string[];
};

// Enriched training persona (Phase 10D)
type EnrichedPersona = {
  persona_id: string;
  source_archetype_id: string;
  name: string;
  display_name: string;
  buyer_role: string;
  organization_type: string;
  product_interest_categories: string[];
  purchase_context: string;
  salutation_style: string;
  name_is_synthetic: boolean;
  difficulty: string;
  role_prompt: string;
  behavior_rules: string[];
  opening_messages: string[];
  likely_questions: string[];
  objection_patterns: string[];
  closing_conditions: string[];
  sale_training_focus: string[];
  runtime_contexts: string[];
  allowed_states: string[];
  do_not_do: string[];
  evidence_summary: { source_count: number; dominant_contexts: string[]; core_behavior_patterns: string[]; confidence: number };
  risk_flags: string[];
};

type ChatTurn = {
  role: "sale" | "customer_ai";
  text: string;
  state: RuntimeState;
  reply_source?: RuntimeReplySource;
  latency_ms?: number;
  safety_flags?: {
    emotional_inference_blocked: boolean;
    unsupported_claim_blocked: boolean;
    operational_realism_preserved: boolean;
  };
  constraint_triggers?: string[];
};

type ChatSession = {
  sessionId: string;
  persona?: RuntimePersonaRecord;
  enrichedPersona?: EnrichedPersona;
  currentState: RuntimeState;
  turns: ChatTurn[];
  scenarioContext?: ProductScenario;
  memorySlots?: ConversationMemorySlots;
  conversationProgress?: ConversationProgress;
  identityProfile?: ConversationIdentityProfile;
  identitySource?: string;
  personaSalutationStyle?: string;
  recentFallbackVariantIds?: string[];
};

const PORT = Number(process.env.PLAYGROUND_PORT || 3009);
const MONTH = process.env.npm_config_month || "2026-03";
const ENRICHED_FILE = path.join(process.cwd(), "sale-testlab-data", "10d_training_personas_enriched", MONTH, "training_personas_enriched.jsonl");
const ENRICHED_SUMMARY_FILE = path.join(process.cwd(), "sale-testlab-data", "10d_training_personas_enriched", MONTH, "training_persona_identity_summary.json");
const RUNTIME_FILE = path.join(process.cwd(), "sale-testlab-data", "07_runtime_personas", MONTH, "runtime_personas.jsonl");

const sessions = new Map<string, ChatSession>();

function runtimeSnapshot(session: ChatSession): RuntimeRecoverySnapshot | null {
  if (!session.memorySlots || !session.conversationProgress || !session.identityProfile) return null;
  return {
    version: 1,
    currentState: session.currentState,
    memory: toSafeRuntimeMemory(session.memorySlots),
    conversationProgress: session.conversationProgress,
    identityProfile: session.identityProfile,
    identitySource: session.identitySource || "persona",
    personaSalutationStyle: session.personaSalutationStyle || "",
    recentFallbackVariantIds: session.recentFallbackVariantIds || [],
    scenarioContext: session.scenarioContext ? {
      scenario_id: session.scenarioContext.scenario_id,
      scenario_product: session.scenarioContext.scenario_product,
      scenario_need: session.scenarioContext.scenario_need,
      scenario_priority: session.scenarioContext.scenario_priority
    } : null
  };
}

function restoreRuntimeSession(
  input: { runtimeSessionId: string; personaId: string; messages: import("./v3/simulationSession").SimulationMessage[]; snapshot: RuntimeRecoverySnapshot | null },
  enriched: EnrichedPersona[]
): void {
  if (!input.snapshot) throw new Error("Runtime recovery snapshot missing");
  const persona = enriched.find((item) => item.persona_id === input.personaId);
  if (!persona) throw new Error("Runtime recovery persona missing");
  const recovered = rebuildRuntimeState(input.messages, input.snapshot);
  const source = input.snapshot.scenarioContext;
  const scenarioContext: ProductScenario | undefined = source ? {
    ...source,
    category: "",
    suitable_persona_patterns: [],
    opening_templates: []
  } : undefined;
  sessions.set(input.runtimeSessionId, {
    sessionId: input.runtimeSessionId,
    enrichedPersona: persona,
    currentState: input.snapshot.currentState,
    turns: recovered.turns,
    scenarioContext,
    memorySlots: recovered.memorySlots,
    conversationProgress: recovered.conversationProgress,
    identityProfile: input.snapshot.identityProfile,
    identitySource: input.snapshot.identitySource,
    personaSalutationStyle: input.snapshot.personaSalutationStyle,
    recentFallbackVariantIds: input.snapshot.recentFallbackVariantIds
  });
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) throw new Error(`Runtime personas not found: ${filePath}`);
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function shouldForceRegenerate(turns: ChatTurn[], candidate: string): boolean {
  const aiTurns = turns.filter((t) => t.role === "customer_ai");
  if (aiTurns.length === 0) return false;
  const last = aiTurns[aiTurns.length - 1]?.text ?? "";
  const prev = aiTurns[aiTurns.length - 2]?.text ?? "";
  const c = normalizeForMatch(candidate);
  const l = normalizeForMatch(last);
  const p = normalizeForMatch(prev);
  if (!c) return false;
  if (c === l) return true;
  if (c === l && c === p) return true;
  return false;
}


function isGreeting(text: string): boolean {
  const n = normalizeForMatch(text);
  return /^(xin(\s+ch[a-z]*)?|chao|hello|hi)\b/.test(n);
}

function countVietnameseDiacritics(text: string): number {
  const m = text.normalize("NFD").match(/\p{M}/gu);
  return m ? m.length : 0;
}

function hasVietnameseAccentWarning(text: string): boolean {
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < 12) return false;
  return countVietnameseDiacritics(text) < 1;
}

function pickDefaultState(persona: RuntimePersonaRecord): RuntimeState {
  const b = persona.runtime_behavior_profile;
  if (b.pricing_behavior.length > 0) return "pricing_phase";
  if (b.logistics_behavior.length > 0) return "logistics_phase";
  if (b.payment_behavior.length > 0) return "payment_phase";
  if (b.research_behavior.length > 0) return "research_phase";
  return "uncertain_interest";
}

function maskId(id: string): string {
  if (!id) return "unk***";
  if (id.length < 8) return `${id.slice(0, 2)}***`;
  return `${id.slice(0, 3)}***${id.slice(-3)}`;
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function chooseResponseBankReply(input: {
  topic: ConversationTopic | null;
  nextTopic: ConversationTopic | null;
  identity: ConversationIdentityProfile;
  recentFallbackVariantIds: string[];
  recentReplies: string[];
  persona?: {
    buyer_role?: string;
    purchase_context?: string;
    behavior_rules?: string[];
    difficulty?: string;
  };
  product_context_status?: string; // Phase 12H.1-C
  is_price_quoted?: boolean; // Nhánh C
}): { reply: string; variant_id: string; topic_used: ConversationTopic | null } {
  const bank = buildResponseBankReply({
    topic: input.topic,
    nextTopic: input.nextTopic,
    identity: input.identity,
    recentFallbackVariantIds: input.recentFallbackVariantIds,
    recentReplies: input.recentReplies,
    persona: input.persona,
    product_context_status: input.product_context_status,
    is_price_quoted: input.is_price_quoted
  });
  return bank;
}

function normalizeSalutationStyle(input?: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/[đĐ]/g, "d");
}

function deriveIdentitySource(persona: { salutation_style?: string; display_name?: string }, hasSession: boolean): string {
  if (hasSession) return "session.identity_profile";
  const style = normalizeSalutationStyle(persona.salutation_style);
  if (style.includes("anh-em") || style.includes("chi-em") || style.includes("em-anh") || style.includes("em-chi")) {
    return "persona.salutation_style";
  }
  if (normalizeForMatch(persona.display_name || "").length > 0) return "persona.display_name";
  return "opening_text";
}

function snapshotProgress(progress: ConversationProgress): ConversationProgress {
  return ensureConversationProgress(structuredClone(progress) as ConversationProgress);
}

function buildCustomerOpening(persona: RuntimePersonaRecord): {
  text: string;
  runtime_state: RuntimeState;
} {
  const state = pickDefaultState(persona);
  const seed = stableHash(`${persona.runtime_persona_id}:${state}`);
  const pricing = [
    "Bên em còn báo giá tốt hơn cho dòng văn phòng không?",
    "Anh đang tham khảo giá, em gửi giúp anh 2-3 lựa chọn trong tầm giá nhé.",
    "Bên em có mẫu nào giá tốt để anh so sánh thêm không?"
  ];
  const research = [
    "Em ơi, bên mình còn mẫu ThinkPad T14 không?",
    "Anh đang tham khảo vài mẫu laptop, bên em tư vấn giúp anh được không?",
    "Anh đang phân vân giữa MSI và ASUS, em gợi ý giúp anh nhé."
  ];
  const logistics = [
    "Bên em có sẵn hàng không, nếu chốt thì giao trong ngày được không?",
    "Cho anh hỏi lịch giao dự kiến với chứng từ đi kèm nhé.",
    "Nếu đặt hôm nay thì mai giao được không em?"
  ];
  const payment = [
    "Anh vừa chuyển khoản, em check giúp anh đã nhận tiền chưa nhé.",
    "Anh gửi bill rồi, bên em xác nhận giao dịch giúp anh nhé.",
    "Em kiểm tra giúp anh trạng thái thanh toán hiện tại nha."
  ];
  const uncertain = [
    "Anh đang xem thử thôi, bên em tư vấn ngắn gọn giúp anh nhé.",
    "Anh chưa chốt ngay, em gợi ý giúp anh 1-2 lựa chọn phù hợp nha.",
    "Mình tham khảo trước, có gì bên em hỗ trợ thông tin thêm nhé."
  ];
  const map: Record<RuntimeState, string[]> = {
    pricing_phase: pricing,
    research_phase: research,
    logistics_phase: logistics,
    payment_phase: payment,
    operational_followup: uncertain,
    passive_followup: uncertain,
    uncertain_interest: uncertain
  };
  const pool = map[state];
  return { text: pool[seed % pool.length], runtime_state: state };
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = `${JSON.stringify(payload)}\n`;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function text(res: http.ServerResponse, status: number, payload: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function buildPage(): string {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Runtime Chat Playground</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; background: #eef2f7; color: #111; }
    .wrap { max-width: 1280px; margin: 0 auto; padding: 16px; display: grid; grid-template-columns: minmax(360px, 420px) 1fr; gap: 14px; }
    .sidebar { display: flex; flex-direction: column; gap: 10px; }
    .main { display: flex; flex-direction: column; gap: 10px; }
    .panel { background: #fff; border: 1px solid #d9dde3; border-radius: 12px; padding: 14px; box-shadow: 0 2px 8px rgba(32, 50, 78, 0.06); }
    h3 { margin: 0 0 8px; font-size: 15px; }
    select, input, button { padding: 8px 10px; font-size: 14px; border-radius: 6px; border: 1px solid #ccc; }
    select { width: 100%; }
    input { width: 100%; }
    button { cursor: pointer; background: #1a73e8; color: #fff; border: none; font-weight: bold; }
    button:hover { background: #1558b0; }
    button.secondary { background: #e0e0e0; color: #333; }
    button.secondary:hover { background: #bbb; }
    #chat { max-height: 440px; overflow-y: auto; border: 1px solid #e0e4ea; border-radius: 8px; padding: 12px; background: #fafafa; }
    .msg { margin-bottom: 12px; }
    .sale { color: #0b5394; }
    .ai { color: #2d6b2d; }
    .meta { font-size: 11px; color: #666; }
    .badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:bold; }
    .hard { background:#fde8e8; color:#c0392b; }
    .medium { background:#fef3cd; color:#8a6b00; }
    .easy { background:#d9f2d9; color:#1d6b1d; }
    .recommended-badge { background:#d0e8ff; color:#1a5fa8; margin-left:4px; }
    .detail-grid { display:grid; grid-template-columns: 120px 1fr; gap: 8px 10px; margin-bottom: 8px; }
    .detail-label { color:#555; font-weight:bold; font-size:13px; }
    .detail-value { min-width: 0; overflow-wrap: anywhere; line-height: 1.35; font-size: 13px; }
    .detail-card { max-height: 58vh; overflow: auto; padding-right: 4px; }
    .tag-wrap { display:flex; flex-wrap:wrap; gap:6px; }
    .tag { display:inline-block; background:#eef; border-radius:6px; padding:4px 8px; font-size:12px; line-height:1.3; }
    .risk-tag { background:#fff0f0; color:#c00; }
    details { margin-top: 6px; }
    details summary { cursor:pointer; color:#666; font-size:12px; padding:4px 0; }
    details ul { margin: 4px 0 8px; padding-left: 18px; line-height: 1.45; }
    .row { display:flex; gap:8px; }
    #persona { height: 280px !important; }
    @media (max-width: 960px) {
      .wrap { grid-template-columns: 1fr; }
      .detail-card { max-height: none; }
      #chat { max-height: 360px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="sidebar">
      <div class="panel">
        <h3>🎭 Chọn Persona</h3>
        <select id="persona" size="10" style="height:280px"></select>
      </div>
      <div class="panel" id="personaDetail">
        <h3>📋 Thông tin Persona</h3>
        <div id="detailContent" class="detail-card"><em>Chọn persona để xem chi tiết</em></div>
      </div>
    </div>

    <div class="main">
      <div class="panel">
        <div class="row" style="flex-wrap:wrap;gap:6px">
          <select id="state" style="flex:1">
            <option value="">auto_state</option>
            <option value="research_phase">research_phase</option>
            <option value="pricing_phase">pricing_phase</option>
            <option value="logistics_phase">logistics_phase</option>
            <option value="payment_phase">payment_phase</option>
            <option value="operational_followup">operational_followup</option>
            <option value="passive_followup">passive_followup</option>
            <option value="uncertain_interest">uncertain_interest</option>
          </select>
          <button id="customerStart">▶ Khách AI bắt đầu</button>
          <button class="secondary" id="resetChat">↺ Reset</button>
        </div>
        <div class="meta" id="autoStateMeta" style="margin-top:6px">Auto state: -</div>
      </div>

      <div id="chat"></div>

      <div class="panel">
        <div class="row">
          <input id="input" placeholder="Nhập tin nhắn Sale..." />
          <button id="send">Gửi</button>
        </div>
      </div>
    </div>
  </div>

<script>
let currentSessionId = null;
let personas = [];
let recommendedIds = [];

function esc(v) {
  return (v || '').replace(/[&<>\\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function tags(arr, cls) {
  return '<div class="tag-wrap">' + (arr||[]).map(function(t) { return '<span class="tag ' + (cls||'') + '">' + esc(t) + '</span>'; }).join('') + '</div>';
}

function addMessage(role, text, meta) {
  const div = document.createElement('div');
  div.className = 'msg';
  const head = role === 'sale' ? 'Sale:' : 'Khách AI:';
  const cls = role === 'sale' ? 'sale' : 'ai';
  let html = '<div class="' + cls + '"><b>' + head + '</b> ' + esc(text) + '</div>';
  if (meta && role === 'customer_ai') {
    var pretty = esc(JSON.stringify(meta, null, 2));
    html += '<details><summary class="meta">Chi ti\u1ebft k\u1ef9 thu\u1eadt</summary><pre class="meta">' + pretty + '</pre></details>';
  }
  div.innerHTML = html;
  document.getElementById('chat').appendChild(div);
  document.getElementById('chat').scrollTop = 99999;
}

function renderPersonaDetail(p) {
  if (!p) return;
  var diffCls = p.difficulty || 'medium';
  var html = '<div class="detail-grid">' +
    '<div class="detail-label">T\u00ean hi\u1ec3n th\u1ecb</div><div class="detail-value"><b>' + esc(p.display_name) + '</b></div>' +
    '<div class="detail-label">Vai tr\u00f2</div><div class="detail-value">' + esc(p.buyer_role) + '</div>' +
    '<div class="detail-label">T\u1ed5 ch\u1ee9c</div><div class="detail-value">' + esc(p.organization_type) + '</div>' +
    '<div class="detail-label">\u0110\u1ed9 kh\u00f3</div><div class="detail-value"><span class="badge ' + diffCls + '">' + (p.difficulty||'').toUpperCase() + '</span></div>' +
    '<div class="detail-label">B\u1ed1i c\u1ea3nh mua</div><div class="detail-value">' + esc(p.purchase_context) + '</div>' +
    '<div class="detail-label">S\u1ea3n ph\u1ea9m</div><div class="detail-value">' + tags(p.product_interest_categories) + '</div>' +
    '</div>' +
    '<details><summary>Quy t\u1eafc h\u00e0nh vi (' + (p.behavior_rules||[]).length + ')</summary><ul style="font-size:12px">' +
      (p.behavior_rules||[]).map(function(r){return '<li>' + esc(r) + '</li>';}).join('') + '</ul></details>' +
    '<details><summary>C\u00e2u m\u1edf \u0111\u1ea7u (' + (p.opening_messages||[]).length + ')</summary><ul style="font-size:12px">' +
      (p.opening_messages||[]).map(function(r){return '<li>' + esc(r) + '</li>';}).join('') + '</ul></details>' +
    '<details><summary>C\u00e2u h\u1ecfi hay g\u1eb7p</summary><ul style="font-size:12px">' +
      (p.likely_questions||[]).map(function(r){return '<li>' + esc(r) + '</li>';}).join('') + '</ul></details>' +
    '<details><summary>Ph\u1ea3n \u0111\u1ed1i hay g\u1eb7p</summary><ul style="font-size:12px">' +
      (p.objection_patterns||[]).map(function(r){return '<li>' + esc(r) + '</li>';}).join('') + '</ul></details>' +
    '<details><summary>\u0110i\u1ec1u ki\u1ec7n ch\u1ed1t</summary><ul style="font-size:12px">' +
      (p.closing_conditions||[]).map(function(r){return '<li>' + esc(r) + '</li>';}).join('') + '</ul></details>' +
    '<details><summary>Training focus</summary>' + tags(p.sale_training_focus) + '</details>';
  if ((p.risk_flags||[]).length > 0) {
    html += '<details><summary>&#9888;&#65039; Risk flags</summary>' + tags(p.risk_flags, 'risk-tag') + '</details>';
  }
  document.getElementById('detailContent').innerHTML = html;
}

async function loadPersonas() {
  const r = await fetch('/api/personas');
  const d = await r.json();
  personas = d.personas || [];
  recommendedIds = d.recommended_ids || [];
  const sel = document.getElementById('persona');
  sel.innerHTML = '';
  personas.forEach(function(p) {
    var opt = document.createElement('option');
    opt.value = p.persona_id;
    var rec = recommendedIds.includes(p.persona_id) ? '\u2b50 ' : '';
    opt.textContent = rec + '[' + (p.difficulty||'?').toUpperCase() + '] ' + p.display_name + ' \u2014 ' + p.buyer_role;
    sel.appendChild(opt);
  });
  if (personas.length) { currentSessionId = null; renderPersonaDetail(personas[0]); }
}

async function sendMessage() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  const personaId = document.getElementById('persona').value;
  const state = document.getElementById('state').value;
  addMessage('sale', text);
  input.value = '';
  const r = await fetch('/api/chat', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ sessionId: currentSessionId, personaId, message: text, runtimeState: state || undefined })
  });
  const d = await r.json();
  currentSessionId = d.sessionId;
  addMessage('ai', d.reply, { state: d.runtime_state, state_confidence: d.state_confidence, source: d.reply_source,
    assistant_style_detected: d.assistant_style_detected, vietnamese_accent_warning: d.vietnamese_accent_warning,
    latency_ms: d.latency_ms, safety_flags: d.safety_flags, constraints: d.constraint_triggers || [] });
  document.getElementById('autoStateMeta').textContent = 'Auto state: ' + d.runtime_state + ' · conf ' + (d.state_confidence??0).toFixed(2);
}

async function customerStart() {
  const personaId = document.getElementById('persona').value;
  if (!personaId) return;
  const r = await fetch('/api/customer-start', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ personaId })
  });
  const d = await r.json();
  currentSessionId = d.sessionId;
  addMessage('ai', d.reply, { state: d.runtime_state, source: d.reply_source });
  document.getElementById('autoStateMeta').textContent = 'Auto state: ' + d.runtime_state;
}

function resetChat() {
  currentSessionId = null;
  document.getElementById('chat').innerHTML = '';
  document.getElementById('autoStateMeta').textContent = 'Auto state: -';
}

document.getElementById('send').addEventListener('click', sendMessage);
document.getElementById('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
document.getElementById('persona').addEventListener('change', () => {
  resetChat();
  const p = personas.find(x => x.persona_id === document.getElementById('persona').value);
  renderPersonaDetail(p);
});
document.getElementById('customerStart').addEventListener('click', customerStart);
document.getElementById('resetChat').addEventListener('click', resetChat);

loadPersonas();
</script>
</body>
</html>`;
}

async function handleChat(bodyRaw: string, personas: RuntimePersonaRecord[]): Promise<Record<string, unknown>> {
  const body = JSON.parse(bodyRaw) as {
    sessionId?: string;
    personaId?: string;
    message?: string;
    runtimeState?: RuntimeState;
  };

  const message = (body.message || "").trim();
  if (!message) throw new Error("Missing message");
  const personaId = (body.personaId || "").trim();
  const persona = personas.find((p) => p.runtime_persona_id === personaId);
  if (!persona) throw new Error("Persona not found");

  const sessionId = (body.sessionId || "").trim() || randomUUID();
  const existing = sessions.get(sessionId);

  const recentSaleMessages = (existing?.turns ?? [])
    .filter((t) => t.role === "sale")
    .slice(-3)
    .map((t) => t.text);
  const route = routeRuntimeState({
    latestSaleMessage: message,
    recentMessages: recentSaleMessages,
    selectedPersona: persona,
    debugOverrideState: body.runtimeState || "auto_state"
  });
  const nextState = route.runtime_state;
  const greetingOnly = isGreeting(message);

  const turns = existing?.turns ?? [];
  const recent = turns.slice(-10).map((t) => `${t.role === "sale" ? "Sale" : "Khach AI"}: ${t.text}`);

  const context: RuntimeConversationContext = {
    topic: nextState,
    recent_messages: [...recent, `Sale: ${message}`].slice(-10),
    current_phase: nextState,
    risk_flags: persona.risk_flags || []
  };

  const runtimeSession = new RuntimeSessionManager(persona, {
    runtime_persona_id: persona.runtime_persona_id,
    runtime_state: nextState,
    active_constraints: [
      "avoid assistant/support-agent tone",
      "avoid emotional/personality inference",
      "maintain operational realism",
      "if user message is greeting only, respond as brief customer greeting and avoid payment/logistics specifics"
    ],
    conversation_context: context
  });

  const prompt = runtimeSession.getRuntimePrompt();
  const usedPatterns = persona.interaction_patterns.slice(0, 4).map((p) => p.pattern_name);
  const usedConstraints = persona.conversation_constraints.slice(0, 6);

  const t0 = Date.now();
  let result = await generateLocalAIReply(prompt.fullPrompt, usedPatterns, usedConstraints);
  if (shouldForceRegenerate(turns, result.generated_reply)) {
    const retryPrompt = `${prompt.fullPrompt}

[ANTI_REPEAT_RULE]
Reply must differ from previous customer wording while keeping same state and constraints.
Avoid repeating: "${result.generated_reply}"`;
    const retry = await generateLocalAIReply(retryPrompt, usedPatterns, usedConstraints);
    if (normalizeForMatch(retry.generated_reply) !== normalizeForMatch(result.generated_reply)) {
      result = retry;
    }
  }
  const latency = Date.now() - t0;

  let reply = result.generated_reply;
  let assistantHits = detectAssistantStyle(reply);
  let safetyFlags = { ...result.runtime_safety };
  let constraintTriggers = [...usedConstraints];

  if (assistantHits.length > 0) {
    const regenPrompt = `${prompt.fullPrompt}

[FORBIDDEN_STYLE_REWRITE]
Bạn là khách hàng mua hàng. Không dùng văn phong trợ lý/hỗ trợ như "Vui lòng..." hay "Tôi hỗ trợ bạn...".
Viết lại 1 câu ngắn, tự nhiên, vai người mua.`;
    const regen = await generateLocalAIReply(regenPrompt, usedPatterns, usedConstraints);
    const regenHits = detectAssistantStyle(regen.generated_reply);
    if (regenHits.length <= assistantHits.length) {
      result = regen;
      reply = regen.generated_reply;
      assistantHits = regenHits;
    }
    if (assistantHits.length > 0) {
      reply = "Mình đang tham khảo thêm, bạn gửi giúp thông tin ngắn gọn để mình đối chiếu nhé.";
      safetyFlags = {
        emotional_inference_blocked: safetyFlags.emotional_inference_blocked,
        unsupported_claim_blocked: true,
        operational_realism_preserved: true
      };
      constraintTriggers = [...constraintTriggers, "assistant_style_blocked"];
    }
  }

  if (greetingOnly && /hoa don|bill|thanh toan|chuyen khoan|vao tien/i.test(reply)) {
    const greetPrompt = `${prompt.fullPrompt}

[GREETING_RULE]
User only greeted. Reply with short neutral customer greeting, no payment/logistics details.`;
    const greetRetry = await generateLocalAIReply(greetPrompt, usedPatterns, usedConstraints);
    if (!/hoa don|bill|thanh toan|chuyen khoan|vao tien/i.test(greetRetry.generated_reply)) {
      reply = greetRetry.generated_reply;
      constraintTriggers = [...constraintTriggers, "greeting_payment_blocked"];
    } else {
      reply = "Chào bạn, mình đang tham khảo thêm thông tin trước khi trao đổi tiếp nhé.";
      constraintTriggers = [...constraintTriggers, "greeting_safe_fallback"];
    }
  }
  if (greetingOnly) {
    reply = "Chào bạn, mình đang tham khảo thêm. Bạn tư vấn ngắn gọn giúp mình nhé.";
    constraintTriggers = [...constraintTriggers, "greeting_state_override"];
  }

  const accentWarning = hasVietnameseAccentWarning(reply);

  const newTurns: ChatTurn[] = [
    ...turns,
    { role: "sale" as const, text: message, state: nextState },
    {
      role: "customer_ai" as const,
      text: reply,
      state: nextState,
      reply_source: result.reply_source,
      latency_ms: latency,
      safety_flags: safetyFlags,
      constraint_triggers: constraintTriggers
    }
  ].slice(-30);

  sessions.set(sessionId, {
    sessionId,
    persona,
    currentState: nextState,
    turns: newTurns
  });

  return {
    sessionId,
    persona_id: persona.runtime_persona_id,
    runtime_state: nextState,
    state_confidence: route.confidence,
    matched_rules: route.matched_rules,
    fallback_reason: route.fallback_reason,
    reply,
    reply_source: result.reply_source,
    assistant_style_detected: assistantHits.length > 0,
    forbidden_phrase_matches: assistantHits,
    vietnamese_accent_warning: accentWarning,
    latency_ms: latency,
    safety_flags: safetyFlags,
    constraint_triggers: constraintTriggers,
    blocked_behaviors: result.reply_reasoning.blocked_behaviors
  };
}

async function handleCustomerStart(bodyRaw: string, personas: RuntimePersonaRecord[]): Promise<Record<string, unknown>> {
  const body = JSON.parse(bodyRaw) as { personaId?: string };
  const personaId = (body.personaId || "").trim();
  const persona = personas.find((p) => p.runtime_persona_id === personaId);
  if (!persona) throw new Error("Persona not found");
  const sessionId = randomUUID();
  const opening = buildCustomerOpening(persona);
  const turn: ChatTurn = {
    role: "customer_ai",
    text: opening.text,
    state: opening.runtime_state,
    reply_source: "deterministic_fallback",
    latency_ms: 0,
    safety_flags: {
      emotional_inference_blocked: false,
      unsupported_claim_blocked: false,
      operational_realism_preserved: true
    },
    constraint_triggers: ["customer_first_mode_opening"]
  };
  sessions.set(sessionId, {
    sessionId,
    persona,
    currentState: opening.runtime_state,
    turns: [turn]
  });
  return {
    sessionId,
    persona_id: persona.runtime_persona_id,
    runtime_state: opening.runtime_state,
    state_confidence: 0.7,
    matched_rules: ["customer_first_mode_opening"],
    fallback_reason: null,
    reply: opening.text,
    reply_source: "deterministic_fallback",
    assistant_style_detected: false,
    forbidden_phrase_matches: [],
    vietnamese_accent_warning: hasVietnameseAccentWarning(opening.text),
    latency_ms: 0,
    safety_flags: turn.safety_flags,
    constraint_triggers: turn.constraint_triggers
  };
}

async function handleChatEnriched(bodyRaw: string, enriched: EnrichedPersona[]): Promise<Record<string, unknown>> {
  const body = JSON.parse(bodyRaw) as { sessionId?: string; personaId?: string; message?: string; runtimeState?: RuntimeState; scenario?: ProductScenario };
  const message = (body.message || "").trim();
  if (!message) throw new Error("Missing message");
  const ep = enriched.find(p => p.persona_id === body.personaId);
  if (!ep) throw new Error("Enriched persona not found");

  const sessionId = (body.sessionId || "").trim() || randomUUID();
  const existing = sessions.get(sessionId);
  const turns = existing?.turns ?? [];
  const recentSale = turns.filter(t => t.role === "sale").slice(-3).map(t => t.text);

  let memorySlots = existing?.memorySlots || createEmptyMemory();
  memorySlots = updateMemorySlots(memorySlots, message);
  let conversationProgress = ensureConversationProgress(existing?.conversationProgress || createEmptyConversationProgress());
  conversationProgress = updateProgressFromSaleMessage(conversationProgress, message);
  const progressBeforeReply = snapshotProgress(conversationProgress);
  
  const isSaleOpening = !existing && turns.length === 0;
  const openingText = isSaleOpening ? message : (normalizeSalutationStyle(ep.salutation_style).length > 0 ? undefined : (existing?.turns?.[0]?.text || ep.role_prompt || ""));
  const identityProfile =
    existing?.identityProfile ||
    buildIdentityProfileFromPersona(
      ep,
      openingText,
      isSaleOpening
    );
  const identitySource = deriveIdentitySource(ep, Boolean(existing?.identityProfile));
  const personaSalutationStyle = ep.salutation_style || "";
  const scenarioContext = existing?.scenarioContext ?? body.scenario;

  const routeBefore = routeRuntimeState({
    latestSaleMessage: message,
    recentMessages: recentSale,
    selectedPersonaRuntimeContexts: ep.runtime_contexts,
    debugOverrideState: body.runtimeState || "auto_state"
  });
  const routeAfter = routeRuntimeState({
    latestSaleMessage: message,
    recentMessages: recentSale,
    selectedPersonaRuntimeContexts: ep.runtime_contexts,
    debugOverrideState: body.runtimeState || "auto_state",
    product_context_status: memorySlots.product_context_status
  });
  const nextState = routeAfter.runtime_state;
  const greetingOnly = isGreeting(message);
  const recent = turns.slice(-10).map(t => `${t.role === "sale" ? "Sale" : "Khach AI"}: ${t.text}`);

  const fullPrompt = buildEnrichedRuntimePrompt({
    persona: {
      role_prompt: ep.role_prompt,
      behavior_rules: ep.behavior_rules,
      product_interest_categories: ep.product_interest_categories,
      purchase_context: ep.purchase_context,
      closing_conditions: ep.closing_conditions,
      do_not_do: ep.do_not_do
    },
    runtimeState: nextState,
    recentMessages: [...recent, `Sale: ${message}`].slice(-10),
    scenarioContext,
    memorySlots,
    progress: conversationProgress,
    identity: identityProfile
  });

  const usedPatterns = ep.evidence_summary.core_behavior_patterns.slice(0, 4);
  const usedConstraints = ["avoid assistant/support-agent tone", "buyer only", "no emotional labels", "no personal data"];

  const t0 = Date.now();
  let result = await generateLocalAIReply(fullPrompt, usedPatterns, usedConstraints);
  const rawModelReply = result.generated_reply;
  if (shouldForceRegenerate(turns, result.generated_reply)) {
    const retry = await generateLocalAIReply(fullPrompt + "\n[ANTI_REPEAT: reply differently]", usedPatterns, usedConstraints);
    if (normalizeForMatch(retry.generated_reply) !== normalizeForMatch(result.generated_reply)) result = retry;
  }
  const latency = Date.now() - t0;
  let reply = result.generated_reply;
  const candidateReplyBeforeGuards = reply;
  let finalReplySource: RuntimeReplySource = result.reply_source;
  let assistantHits = detectAssistantStyle(reply);
  const recentFallbackVariantIds = existing?.recentFallbackVariantIds ?? [];
  const recentReplies = turns.filter((t) => t.role === "customer_ai").map((t) => t.text);
  const nextUnresolvedTopic = getFirstUnresolvedTopic(conversationProgress);
  const fallbackTopic = nextUnresolvedTopic ?? "next_step";
  const freeFormLoopDetected = detectRepeatedFreeFormLoop(reply, recentReplies);
  let fallbackVariantId: string | null = null;
  let fallbackTopicUsed: ConversationTopic | null = null;
  let updatedFallbackVariantIds = recentFallbackVariantIds.slice(-3);
  let guardTriggered = false;
  const guardTriggerReasons: string[] = [];
  let reopenedAnsweredTopics: ConversationTopic[] = [];

  const isPriceQuoted = isPriceActuallyQuoted(turns, message);

  const applyBankFallback = (reasonTopic: ConversationTopic | null): void => {
    const bank = chooseResponseBankReply({
      topic: reasonTopic,
      nextTopic: fallbackTopic,
      identity: identityProfile,
      recentFallbackVariantIds,
      recentReplies,
      persona: {
        buyer_role: ep.buyer_role,
        purchase_context: ep.purchase_context,
        behavior_rules: ep.behavior_rules,
        difficulty: ep.difficulty
      },
      product_context_status: memorySlots.product_context_status,
      is_price_quoted: isPriceQuoted
    });
    reply = bank.reply;
    finalReplySource = "deterministic_fallback";
    fallbackVariantId = bank.variant_id;
    fallbackTopicUsed = bank.topic_used;
    updatedFallbackVariantIds = [...recentFallbackVariantIds, bank.variant_id].slice(-3);
  };

  if (assistantHits.length > 0) {
    applyBankFallback(fallbackTopic);
    guardTriggered = true;
    guardTriggerReasons.push("assistant_style");
  }

  const voiceGuardResult = runCustomerVoiceGuard(reply, identityProfile);
  let customerVoiceDriftDetected = voiceGuardResult.customer_voice_drift_detected;
  let customerVoiceGuardReason = voiceGuardResult.customer_voice_guard_reason;

  if (customerVoiceDriftDetected) {
    guardTriggered = true;
    guardTriggerReasons.push(`voice_drift:${customerVoiceGuardReason}`);
    const rewritten = rewriteVoiceDrift(reply, identityProfile);
    if (rewritten !== reply) {
      reply = rewritten;
      finalReplySource = "local_ai_rewritten";
      const recheck = runCustomerVoiceGuard(reply, identityProfile);
      customerVoiceDriftDetected = recheck.customer_voice_drift_detected;
      customerVoiceGuardReason = recheck.customer_voice_guard_reason;
      if (customerVoiceDriftDetected) {
        applyBankFallback(fallbackTopic);
      }
    } else {
      applyBankFallback(fallbackTopic);
    }
  }

  let greetingOverrideUsed = false;
  let greetingOverrideReason: string | null = null;

  if (greetingOnly) {
    const modelReplyEmpty = !candidateReplyBeforeGuards || candidateReplyBeforeGuards.trim().length === 0;
    const modelCallFailed = finalReplySource === "deterministic_fallback";
    
    const greetIdentityDrift = detectIdentityDrift(candidateReplyBeforeGuards || "", identityProfile);
    const hasSevereDrift = greetIdentityDrift.identity_drift_detected || greetIdentityDrift.role_inversion_detected;

    if (modelReplyEmpty || modelCallFailed || hasSevereDrift) {
      greetingOverrideUsed = true;
      greetingOverrideReason = modelReplyEmpty 
        ? "model_reply_empty" 
        : (modelCallFailed ? "model_call_failed" : "severe_role_drift");

      const self = identityProfile.customer_self_pronoun;
      const target = identityProfile.customer_target_pronoun;
      const selfCap = self.charAt(0).toUpperCase() + self.slice(1);
      const targetCap = target.charAt(0).toUpperCase() + target.slice(1);
      
      if ((self === "anh" || self === "chị") && target === "em") {
        reply = `${selfCap} chào ${target}, ${self} đang tham khảo sản phẩm bên ${target}. ${targetCap} tư vấn ngắn gọn giúp ${self} nhé.`;
      } else if (self === "em" && (target === "anh" || target === "chị")) {
        reply = `Em chào ${target}, em đang tham khảo sản phẩm bên mình. ${targetCap} tư vấn ngắn gọn giúp em nhé.`;
      } else {
        reply = `Chào bạn, mình đang tham khảo sản phẩm bên mình. Bạn tư vấn ngắn gọn giúp mình nhé.`;
      }
      finalReplySource = "deterministic_fallback";
    } else {
      reply = candidateReplyBeforeGuards;
      finalReplySource = "local_ai_generated";
    }
  }
  const directQuestion = isDirectQuestion(message);
  let repeatedTopics: ConversationTopic[] = [];
  let genericLoopDetected = false;

  if (!directQuestion) {
    repeatedTopics = detectRepeatedTopicAsking(reply, conversationProgress);
    genericLoopDetected = isRepeatedGenericFallback(reply, recentReplies);
  }

  // A single clarification or generic acknowledgement is normal buyer behavior.
  // Reserve the bank for confirmed repetition, not merely an imperfect turn.
  const severeTopicLoop = repeatedTopics.length > 1;
  if (severeTopicLoop || genericLoopDetected || freeFormLoopDetected) {
    applyBankFallback(fallbackTopic);
    guardTriggered = true;
    if (repeatedTopics.length > 0) guardTriggerReasons.push(`repeated_topic:${repeatedTopics.join(",")}`);
    if (genericLoopDetected) guardTriggerReasons.push("generic_loop");
    if (freeFormLoopDetected) guardTriggerReasons.push("free_form_loop");
  } else if (repeatedTopics.length > 0 || isGenericConfirmationIntent(reply)) {
    guardTriggered = true;
    if (repeatedTopics.length > 0) guardTriggerReasons.push(`soft_repeated_topic:${repeatedTopics.join(",")}`);
    if (isGenericConfirmationIntent(reply)) guardTriggerReasons.push("generic_confirmation_preserved");
  }

  const recentSaleMessages = [message, ...turns.filter(t => t.role === "sale").slice(-1).map(t => t.text)];

  if (!directQuestion) {
    reopenedAnsweredTopics = detectReopenedAnsweredTopics(reply, conversationProgress, recentSaleMessages);
  }
  if (reopenedAnsweredTopics.length > 1) {
    applyBankFallback(fallbackTopic);
    guardTriggered = true;
    guardTriggerReasons.push(`reopened_topic:${reopenedAnsweredTopics.join(",")}`);
  } else if (reopenedAnsweredTopics.length === 1) {
    guardTriggered = true;
    guardTriggerReasons.push(`reopened_topic_preserved:${reopenedAnsweredTopics.join(",")}`);
  }

  let stockStatus: "in_stock" | "out_of_stock" | "unknown" = "unknown";
  if (memorySlots.selected_product_model_code && memorySlots.product_candidates_summary) {
    const candidate = memorySlots.product_candidates_summary.find(
      c => c.model_code === memorySlots.selected_product_model_code
    );
    if (candidate) {
      stockStatus = candidate.stock_status;
    }
  }

  const completion = evaluateConversationCompletion(
    {
      conversation_progress: conversationProgress,
      identity_profile: identityProfile,
      next_unresolved_topic: nextUnresolvedTopic,
      recent_turns: turns
    },
    memorySlots.product_context_status,
    memorySlots.selected_product_model_code !== null,
    stockStatus
  );
  const safeNextUnresolvedTopic =
    nextUnresolvedTopic ?? (completion.completion_ready ? "next_step" : completion.missing_topics[0] ?? null);
  let completionForcedReply = false;
  let completionVariantId: string | null = null;
  let completionTopicUsed: ConversationTopic | null = null;
  let completionOverrideReason: string | null = null;
  // Completion is a recommendation. Keep a safe, specific buyer reply instead
  // of replacing it with a scripted close.
  const completionNeedsRecovery =
    !reply.trim() ||
    isRepeatedGenericFallback(reply, recentReplies) ||
    detectRepeatedFreeFormLoop(reply, recentReplies);
  if (completion.completion_ready && completionNeedsRecovery) {
    const closing = buildCompletionReply({
      completion,
      identity: identityProfile,
      recentReplies,
      nextUnresolvedTopic: safeNextUnresolvedTopic
    });
    reply = closing.reply;
    finalReplySource = "deterministic_fallback";
    completionForcedReply = true;
    completionVariantId = closing.variant_id;
    completionTopicUsed = closing.topic_used;
    completionOverrideReason = "completion_ready";
    fallbackVariantId = null;
    fallbackTopicUsed = null;
    guardTriggered = true;
    guardTriggerReasons.push("completion_ready_recovery");
  } else if (completion.completion_ready) {
    guardTriggerReasons.push("completion_ready_preserved");
  }

  let identityDrift = detectIdentityDrift(reply, identityProfile);
  if (identityDrift.identity_drift_detected) {
    if (identityDrift.is_recoverable) {
      const repaired = repairPronounDrift(reply, identityProfile);
      const redetect = detectIdentityDrift(repaired, identityProfile);
      if (!redetect.identity_drift_detected) {
        reply = repaired;
        identityDrift.identity_drift_detected = false;
        finalReplySource = "local_ai_rewritten";
      } else {
        applyBankFallback(fallbackTopic);
        guardTriggered = true;
        guardTriggerReasons.push("identity_drift");
      }
    } else {
      applyBankFallback(fallbackTopic);
      guardTriggered = true;
      guardTriggerReasons.push("identity_drift");
    }
  }

  if (!completion.completion_ready && shouldForceCompletionReply({
    candidateReply: reply,
    completion,
    progress: conversationProgress,
    identity: identityProfile,
    recentReplies,
    nextUnresolvedTopic: safeNextUnresolvedTopic,
    recentSaleMessages
  })) {
    guardTriggered = true;
    guardTriggerReasons.push("final_guard");
    
    const closing = buildCompletionReply({
      completion,
      identity: identityProfile,
      recentReplies,
      nextUnresolvedTopic: safeNextUnresolvedTopic
    });
    reply = closing.reply;
    finalReplySource = "deterministic_fallback";
    completionForcedReply = true;
    completionVariantId = closing.variant_id;
    completionTopicUsed = closing.topic_used;
    completionOverrideReason = "final_guard_forced";
    fallbackVariantId = null;
    fallbackTopicUsed = null;
  }

  // ==========================================
  // PHASE 12H.1-C RUNTIME GUARDS & GATING
  // ==========================================
  const guardsResult = applySafetyGuards(reply, memorySlots, identityProfile, message, turns, safeNextUnresolvedTopic);
  
  let ambiguous_model_guard_triggered = guardsResult.ambiguous_model_guard_triggered;
  let ambiguous_model_guard_reason: string | null = ambiguous_model_guard_triggered ? "product_context_not_specific_with_gated_terms" : null;
  let stock_quantity_hidden_from_customer = guardsResult.stock_quantity_hidden_from_customer;
  let consultant_tone_blocked = guardsResult.consultant_tone_blocked;

  if (guardsResult.guardTriggered) {
    reply = guardsResult.reply;
    finalReplySource = guardsResult.finalReplySource;
    guardTriggered = true;
    guardTriggerReasons.push(...guardsResult.reasons);
  }

  const buyerRoleViolation = detectBuyerRoleViolation(reply, identityProfile);
  if (buyerRoleViolation.violated) {
    const repairedRoleReply = repairBuyerRoleViolation(reply, identityProfile);
    if (normalizeForMatch(repairedRoleReply) !== normalizeForMatch(reply)) {
      reply = repairedRoleReply;
      if (finalReplySource !== "deterministic_fallback") {
        finalReplySource = "local_ai_rewritten";
      }
      guardTriggered = true;
      guardTriggerReasons.push(...buyerRoleViolation.reasons.map((reason) => `buyer_role_lock:${reason}`));
    }

    const roleRecheck = detectBuyerRoleViolation(reply, identityProfile);
    const identityRecheck = detectIdentityDrift(reply, identityProfile);
    if (roleRecheck.violated || identityRecheck.identity_drift_detected) {
      applyBankFallback(fallbackTopic);
      guardTriggered = true;
      guardTriggerReasons.push("buyer_role_lock_fallback");
    }
  }

  const progressAfterRaw = updateProgressFromCustomerMessage(snapshotProgress(progressBeforeReply), reply);
  const newTurnsRaw: ChatTurn[] = [...turns,
    { role: "sale" as const, text: message, state: nextState },
    { role: "customer_ai" as const, text: reply, state: nextState, reply_source: finalReplySource, latency_ms: latency, safety_flags: result.runtime_safety, constraint_triggers: usedConstraints }
  ];

  const dealStateResult = processDealState({
    progress: progressAfterRaw,
    recent_turns: newTurnsRaw,
    completion_ready: completion.completion_ready,
    missing_topics: completion.missing_topics.map(t => String(t)),
    product_context_status: memorySlots.product_context_status
  });

  if (dealStateResult.should_end_session) {
    const terminalReply = getTerminalReply(dealStateResult.deal_outcome, identityProfile);
    if (terminalReply) {
      reply = terminalReply;
      finalReplySource = "deterministic_fallback";
      newTurnsRaw[newTurnsRaw.length - 1].text = reply;
      newTurnsRaw[newTurnsRaw.length - 1].reply_source = "deterministic_fallback";
    }
  }

  const progressAfter = updateProgressFromCustomerMessage(snapshotProgress(progressBeforeReply), reply);
  const newTurns = newTurnsRaw.slice(-30);

  sessions.set(sessionId, {
    sessionId,
    enrichedPersona: ep,
    currentState: nextState,
    turns: newTurns,
    scenarioContext,
    memorySlots,
    conversationProgress: progressAfter,
    identityProfile,
    identitySource,
    personaSalutationStyle,
    recentFallbackVariantIds: updatedFallbackVariantIds
  });

  const persistedRuntimeSnapshot = runtimeSnapshot(sessions.get(sessionId)!);

  return {
    sessionId, persona_id: ep.persona_id, runtime_state: nextState,
    state_confidence: routeAfter.confidence, matched_rules: routeAfter.matched_rules,
    reply, reply_source: finalReplySource,
    raw_model_reply: rawModelReply,
    candidate_reply_before_guards: candidateReplyBeforeGuards,
    final_reply: reply,
    assistant_style_detected: assistantHits.length > 0,
    customer_voice_drift_detected: customerVoiceDriftDetected,
    customer_voice_guard_reason: customerVoiceGuardReason,
    sale_opening_identity_detected: isSaleOpening,
    vietnamese_accent_warning: hasVietnameseAccentWarning(reply),
    greeting_override_used: greetingOverrideUsed,
    greeting_override_reason: greetingOverrideReason,
    latency_ms: latency, safety_flags: result.runtime_safety, constraint_triggers: usedConstraints,
    blocked_behaviors: result.reply_reasoning.blocked_behaviors,
    scenario_context: scenarioContext,
    memory_slots: memorySlots,
    selected_product_model: memorySlots.selected_product_model,
    selected_product_model_code: memorySlots.selected_product_model_code,
    product_context_status: memorySlots.product_context_status,
    product_candidates_summary: memorySlots.product_candidates_summary,
    product_knowledge_used: memorySlots.product_knowledge_used,
    auto_state_before_product_gate: routeBefore.runtime_state,
    auto_state_after_product_gate: routeAfter.runtime_state,
    completion_blocked_by_product_context: completion.completion_blocked_by_product_context || false,
    completion_block_reason: completion.completion_block_reason || null,
    ambiguous_model_guard_triggered,
    ambiguous_model_guard_reason,
    stock_quantity_hidden_from_customer,
    consultant_tone_blocked,
    progress_before: progressBeforeReply,
    progress_after: progressAfter,
    conversation_progress: progressAfter,
    last_requested_topic: progressAfter.last_requested_topic ?? null,
    last_answered_topic: progressAfter.last_answered_topic ?? null,
    next_unresolved_topic: getFirstUnresolvedTopic(progressAfter) ?? (completion.completion_ready ? "next_step" : completion.missing_topics[0] ?? null),
    identity_profile: identityProfile,
    identity_source: identitySource,
    persona_salutation_style: personaSalutationStyle,
    identity_drift_detected: identityDrift.identity_drift_detected,
    role_inversion_detected: identityDrift.role_inversion_detected,
    generic_loop_detected: genericLoopDetected,
    repeated_freeform_loop: freeFormLoopDetected,
    repeated_blocked_topics: repeatedTopics,
    reopened_topic_detected: reopenedAnsweredTopics.length > 0,
    reopened_answered_topics: reopenedAnsweredTopics,
    final_reopen_guard_triggered: reopenedAnsweredTopics.length > 0,
    guard_triggered: guardTriggered,
    guard_trigger_reasons: Array.from(new Set(guardTriggerReasons)),
    fallback_variant_id: fallbackVariantId,
    fallback_topic_used: fallbackTopicUsed,
    recent_fallback_variant_ids: updatedFallbackVariantIds,
    completion_ready: completion.completion_ready,
    completion_reason: completion.completion_reason,
    missing_topics: completion.missing_topics,
    resolved_topics: completion.resolved_topics,
    recommended_action: completion.recommended_action,
    completion_forced_reply: completionForcedReply,
    completion_override_reason: completionOverrideReason,
    completion_variant_id: completionVariantId,
    deal_state: dealStateResult,
    deal_outcome: dealStateResult.deal_outcome,
    training_success: dealStateResult.training_success,
    should_end_session: dealStateResult.should_end_session,
    end_reason: dealStateResult.end_reason,
    next_best_action: dealStateResult.next_best_action,
    buying_signals: dealStateResult.buying_signals,
    closing_signals: dealStateResult.closing_signals,
    objection_signals: dealStateResult.objection_signals,
    completion_topic_used: completionTopicUsed,
    forbidden_phrase_matches: Array.from(new Set([...assistantHits, ...identityDrift.forbidden_phrase_matches])),
    runtime_snapshot: persistedRuntimeSnapshot
  };
}
async function handleCustomerStartEnriched(bodyRaw: string, enriched: EnrichedPersona[]): Promise<Record<string, unknown>> {
  const body = JSON.parse(bodyRaw) as { personaId?: string; scenario?: ProductScenario };
  const ep = enriched.find(p => p.persona_id === body.personaId);
  if (!ep) throw new Error("Enriched persona not found");
  const sessionId = randomUUID();

  const opening = buildCustomerOpeningEnriched(ep, body.scenario);
  const openingText = opening.text;
  const state = opening.state;
  const scenarioContext = opening.scenario_context;
  const openingSourceType = opening.opening_source_type;
  const memorySlots = createEmptyMemory();
  let conversationProgress = createEmptyConversationProgress();
  const identityProfile = buildIdentityProfileFromPersona(
    ep,
    normalizeSalutationStyle(ep.salutation_style).length > 0 ? undefined : openingText
  );
  const identitySource = deriveIdentitySource(ep, false);
  const personaSalutationStyle = ep.salutation_style || "";
  conversationProgress = updateProgressFromCustomerMessage(conversationProgress, openingText);

  const turn: ChatTurn = {
    role: "customer_ai", text: openingText, state,
    reply_source: "deterministic_fallback", latency_ms: 0,
    safety_flags: { emotional_inference_blocked: false, unsupported_claim_blocked: false, operational_realism_preserved: true },
    constraint_triggers: ["enriched_persona_opening"]
  };
  
  const dealStateResult = processDealState({
    progress: conversationProgress,
    recent_turns: [turn],
    completion_ready: false,
    missing_topics: ["product_model", "configuration", "price", "stock"]
  });

  sessions.set(sessionId, {
    sessionId,
    persona: {} as RuntimePersonaRecord,
    enrichedPersona: ep,
    currentState: state,
    turns: [turn],
    scenarioContext,
    memorySlots,
    conversationProgress,
    identityProfile,
    identitySource,
    personaSalutationStyle,
    recentFallbackVariantIds: []
  });
  const persistedRuntimeSnapshot = runtimeSnapshot(sessions.get(sessionId)!);
  return {
    sessionId, persona_id: ep.persona_id, runtime_state: state, state_confidence: 0.8,
    matched_rules: ["enriched_persona_opening"], fallback_reason: null,
    reply: openingText, reply_source: "deterministic_fallback",
    assistant_style_detected: false, forbidden_phrase_matches: [],
    vietnamese_accent_warning: hasVietnameseAccentWarning(openingText), latency_ms: 0,
    safety_flags: turn.safety_flags, constraint_triggers: turn.constraint_triggers,
    opening_source_type: openingSourceType,
    product_grounding_used: opening.product_grounding_used,
    candidate_count: opening.candidate_count,
    selected_catalog_category: opening.selected_catalog_category,
    selected_catalog_model_present: opening.selected_catalog_model_present,
    selected_catalog_price_available: opening.selected_catalog_price_available,
    selected_catalog_stock_status_present: opening.selected_catalog_stock_status_present,
    scenario_context: scenarioContext,
    memory_slots: memorySlots,
    selected_product_model: memorySlots.selected_product_model,
    selected_product_model_code: memorySlots.selected_product_model_code,
    product_context_status: memorySlots.product_context_status,
    product_candidates_summary: memorySlots.product_candidates_summary,
    product_knowledge_used: memorySlots.product_knowledge_used,
    conversation_progress: conversationProgress,
    last_requested_topic: conversationProgress.last_requested_topic ?? null,
    last_answered_topic: conversationProgress.last_answered_topic ?? null,
    next_unresolved_topic: getFirstUnresolvedTopic(conversationProgress),
    identity_profile: identityProfile,
    identity_source: identitySource,
    persona_salutation_style: personaSalutationStyle,
    identity_drift_detected: false,
    deal_state: dealStateResult,
    deal_outcome: dealStateResult.deal_outcome,
    training_success: dealStateResult.training_success,
    should_end_session: dealStateResult.should_end_session,
    end_reason: dealStateResult.end_reason,
    next_best_action: dealStateResult.next_best_action,
    buying_signals: dealStateResult.buying_signals,
    closing_signals: dealStateResult.closing_signals,
    objection_signals: dealStateResult.objection_signals,
    runtime_snapshot: persistedRuntimeSnapshot
  };
}

async function main(): Promise<void> {
  await prisma.$connect();
  const enrichedPersonas = fs.existsSync(ENRICHED_FILE)
    ? readJsonl<EnrichedPersona>(ENRICHED_FILE)
    : [];
  const runtimePersonas = fs.existsSync(RUNTIME_FILE)
    ? readJsonl<RuntimePersonaRecord>(RUNTIME_FILE).filter(p => p.runtime_readiness !== "archive_only")
    : [];

  let recommendedIds: string[] = [];
  if (fs.existsSync(ENRICHED_SUMMARY_FILE)) {
    try { recommendedIds = JSON.parse(fs.readFileSync(ENRICHED_SUMMARY_FILE, "utf8")).recommended_playground_personas ?? []; } catch {}
  }

  // Sort: recommended first
  const sortedEnriched = [
    ...enrichedPersonas.filter(p => recommendedIds.includes(p.persona_id)),
    ...enrichedPersonas.filter(p => !recommendedIds.includes(p.persona_id))
  ];

  const v3SessionRepository = new DatabaseSessionRepository(prisma);
  const v3TrainingContentRepository = new DatabaseTrainingContentRepository(prisma);
  const v3RuntimeContentResolver = new RuntimeContentResolver(v3TrainingContentRepository);
  const v3TrainingContentService = new TrainingContentService(v3TrainingContentRepository);
  const v3Orchestrator = new CompatibilitySimulationOrchestrator({
    startCustomer: (personaId, content) => handleCustomerStartEnriched(
      JSON.stringify({ personaId, scenario: content ? scenarioForRuntimeExecution(content) : undefined }),
      content ? [content.personaRuntime as EnrichedPersona] : sortedEnriched
    ),
    chat: ({ sessionId, personaId, message, content }) => handleChatEnriched(
      JSON.stringify({ sessionId, personaId, message, scenario: content ? scenarioForRuntimeExecution(content) : undefined }),
      content ? [content.personaRuntime as EnrichedPersona] : sortedEnriched
    ),
    hasSession: (sessionId) => sessions.has(sessionId),
    restoreSession: (input) => restoreRuntimeSession(input, input.content ? [input.content.personaRuntime as EnrichedPersona] : sortedEnriched),
    discardSession: (sessionId) => { sessions.delete(sessionId); }
  });
  const v3SimulationService = new SimulationService({
    sessions: v3SessionRepository,
    orchestrator: v3Orchestrator,
    contentResolver: v3RuntimeContentResolver
  });
  const v3AuthService = new AuthService(
    new DatabaseAuthRepository(prisma),
    { ttlHours: Number(process.env.AUTH_SESSION_TTL_HOURS || 168) }
  );
  const v3EvaluationService = new EvaluationService({
    sessions: v3SessionRepository,
    evaluations: new DatabaseEvaluationRepository(prisma),
    provider: new LocalAIEvaluationProvider()
  });
  const v3CoachingService = new CoachingService({
    sessions: v3SessionRepository,
    evaluations: new DatabaseEvaluationRepository(prisma),
    coaching: new DatabaseCoachingRepository(prisma),
    provider: new LocalAICoachingProvider()
  });
  const v3ProgressService = new ProgressService({
    repository: new DatabaseProgressRepository(prisma)
  });
  const trainingProgramCatalog = {
      resolve: async (personaId: string, scenarioId: string, personaVersionId?: string | null, scenarioVersionId?: string | null) => {
        const selection = personaVersionId && scenarioVersionId
          ? await v3RuntimeContentResolver.resolvePinned(personaVersionId, scenarioVersionId)
          : await v3RuntimeContentResolver.resolveCurrent(personaId, scenarioId);
        if (!selection || selection.personaId !== personaId || selection.scenarioId !== scenarioId) return null;
        const personaVersion = await prisma.personaVersion.findUnique({ where: { id: selection.personaVersionId }, select: { version: true } });
        const scenarioVersion = await prisma.scenarioVersion.findUnique({ where: { id: selection.scenarioVersionId }, select: { version: true } });
        if (!personaVersion || !scenarioVersion) return null;
        return {
          personaId, personaLabel: selection.personaSnapshot.displayName,
          scenarioId, scenarioLabel: selection.scenarioSnapshot.title,
          personaVersionId: selection.personaVersionId, personaVersion: personaVersion.version,
          scenarioVersionId: selection.scenarioVersionId, scenarioVersion: scenarioVersion.version
        };
      }
  };
  const v3TrainingProgramService = new TrainingProgramService({
    repository: new DatabaseTrainingProgramRepository(prisma),
    catalog: trainingProgramCatalog
  });
  const v3TrainingAssignmentService = new TrainingAssignmentService({
    repository: new DatabaseTrainingAssignmentRepository(prisma),
    simulation: v3SimulationService,
    catalog: trainingProgramCatalog
  });
  const handleV3Request = createV3Api({
    service: v3SimulationService,
    auth: v3AuthService,
    evaluationService: v3EvaluationService,
    coachingService: v3CoachingService,
    progressService: v3ProgressService,
    trainingProgramService: v3TrainingProgramService,
    trainingAssignmentService: v3TrainingAssignmentService,
    trainingContentService: v3TrainingContentService
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = req.url || "/";
      if (await handleV3Request(req, res)) return;
      if (req.method === "GET" && url === "/") { text(res, 200, buildPage()); return; }

      if (req.method === "GET" && url === "/api/personas") {
        json(res, 200, {
          month: MONTH, count: sortedEnriched.length,
          recommended_ids: recommendedIds,
          personas: sortedEnriched.map(p => ({
            persona_id: p.persona_id,
            display_name: p.display_name,
            buyer_role: p.buyer_role,
            organization_type: p.organization_type,
            name: p.name,
            difficulty: p.difficulty,
            product_interest_categories: p.product_interest_categories,
            purchase_context: p.purchase_context,
            behavior_rules: p.behavior_rules,
            opening_messages: p.opening_messages,
            likely_questions: p.likely_questions,
            objection_patterns: p.objection_patterns,
            closing_conditions: p.closing_conditions,
            sale_training_focus: p.sale_training_focus,
            risk_flags: p.risk_flags,
            evidence_summary: p.evidence_summary,
            is_recommended: recommendedIds.includes(p.persona_id)
          }))
        });
        return;
      }

      if (req.method === "GET" && url === "/api/version") {
        json(res, 200, { playground_version: "phase11-training-personas", enriched_personas: sortedEnriched.length }); return;
      }

      if (req.method === "POST" && url === "/api/chat") {
        const body = await readBody(req);
        const payload = await handleChatEnriched(body, sortedEnriched);
        json(res, 200, payload); return;
      }
      if (req.method === "POST" && url === "/api/customer-start") {
        const body = await readBody(req);
        const payload = await handleCustomerStartEnriched(body, sortedEnriched);
        json(res, 200, payload); return;
      }

      json(res, 404, { error: "Not found" });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Playground started: http://localhost:${PORT}`);
    console.log(`Enriched personas: ${sortedEnriched.length} | Recommended: ${recommendedIds.length}`);
    console.log(`Runtime personas (compat): ${runtimePersonas.length}`);
  });
}

main().catch(() => {
  console.error("Playground startup failed: database or runtime initialization unavailable.");
  process.exitCode = 1;
});




