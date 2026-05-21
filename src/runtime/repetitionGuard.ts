import { ConversationIdentityProfile } from "./conversationIdentity";
import {
  ConversationProgress,
  ConversationTopic,
  TOPIC_ORDER,
  getFirstUnresolvedTopic
} from "./conversationProgressTracker";

function normalize(input: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "anh",
  "chi",
  "em",
  "toi",
  "minh",
  "ban",
  "nhe",
  "nha",
  "a",
  "da",
  "roi",
  "giup",
  "cho",
  "xin",
  "duoc",
  "khong",
  "thoi",
  "vay",
  "co",
  "la",
  "thi"
]);

function tokenizeMeaningful(text: string): string[] {
  return normalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return intersection / Math.max(1, union);
}

function compactIntentSignature(text: string): string {
  const t = normalize(text)
    .replace(/\b(anh|chi|em|toi|minh|ban|nhe|a|da|roi|giup|cho|xin|duoc|khong)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/xac nhan|thong tin tiep theo|ngan gon/.test(t)) return "generic_confirm";
  if (/gia|bao gia|bao nhieu|trieu|vnd/.test(t)) return "ask_price";
  if (/con hang|san hang|co san|kho/.test(t)) return "ask_stock";
  if (/giao|ship|bao lau giao|giao khi nao/.test(t)) return "ask_delivery";
  if (/bao hanh/.test(t)) return "ask_warranty";
  if (/stk|so tai khoan|chuyen khoan|thanh toan/.test(t)) return "ask_payment";
  return t.slice(0, 48);
}

const TOPIC_ASK_PATTERNS: Record<ConversationTopic, RegExp> = {
  product_model: /\b(model|ma may|dong nao|may nao)\b/,
  configuration: /\b(cau hinh|i3|i5|i7|i9|ram|ssd|gen)\b/,
  price: /\b(gia|bao gia|bao nhieu|trieu|vnd|vnđ)\b/,
  stock: /\b(con hang|san hang|co san|kho)\b/,
  delivery: /\b(giao|ship|bao lau giao|giao khi nao|mai giao)\b/,
  warranty: /\b(bao hanh)\b/,
  payment: /\b(stk|so tai khoan|chuyen khoan|thanh toan|dat coc|coc)\b/,
  invoice_or_document: /\b(hoa don|vat|chung tu)\b/,
  next_step: /\b(chot|giu hang|buoc tiep theo)\b/
};

export function getBlockedTopics(progress: ConversationProgress): ConversationTopic[] {
  return TOPIC_ORDER.filter((topic) => {
    const t = progress[topic];
    return (t.requested && t.answered) || t.confirmed;
  });
}

export function detectRepeatedTopicAsking(
  customerReply: string,
  progress: ConversationProgress
): ConversationTopic[] {
  const text = normalize(customerReply);
  const blocked = new Set(getBlockedTopics(progress));
  const hits: ConversationTopic[] = [];

  for (const topic of TOPIC_ORDER) {
    if (!blocked.has(topic)) continue;
    if (TOPIC_ASK_PATTERNS[topic].test(text)) hits.push(topic);
  }
  return hits;
}

export function isGenericConfirmationIntent(text: string): boolean {
  const t = normalize(text);
  return /\b(xac nhan( ngan gon)?|thong tin tiep theo|cho em xac nhan|em can xac nhan)\b/.test(t);
}

export function isRepeatedGenericFallback(
  currentReply: string,
  previousAiReplies: string[]
): boolean {
  if (!isGenericConfirmationIntent(currentReply)) return false;
  const currentSig = compactIntentSignature(currentReply);
  const recent = previousAiReplies.slice(-3).map(compactIntentSignature);
  const sameCount = recent.filter((s) => s === currentSig).length;
  return sameCount >= 1;
}

export function detectRepeatedFreeFormLoop(
  currentReply: string,
  previousAiReplies: string[]
): boolean {
  const currentTokens = tokenizeMeaningful(currentReply);
  if (currentTokens.length < 3) return false;

  const recent = previousAiReplies.slice(-3);
  let best = 0;
  for (const prev of recent) {
    const score = jaccardSimilarity(currentTokens, tokenizeMeaningful(prev));
    if (score > best) best = score;
  }
  return best >= 0.72;
}

export function buildProgressionInstruction(progress: ConversationProgress): string {
  const next = getFirstUnresolvedTopic(progress);
  const blocked = getBlockedTopics(progress);
  const blockedText = blocked.length > 0 ? blocked.join(", ") : "none";
  const nextText = next ?? "none";

  return [
    "Repetition guard:",
    `- blocked_topics: ${blockedText}`,
    `- next_unresolved_topic: ${nextText}`,
    "- Nếu một topic đã requested+answered hoặc đã confirmed thì không hỏi lại.",
    "- Nếu topic đã hoàn tất, chuyển tự nhiên sang topic chưa hoàn tất tiếp theo."
  ].join("\n");
}

export function buildDeterministicProgressionFallback(
  nextTopic: ConversationTopic | null,
  identity: ConversationIdentityProfile
): string {
  const s = identity.customer_self_pronoun;
  const t = identity.customer_target_pronoun;
  const map: Record<ConversationTopic, string> = {
    product_model: `${s} muốn chốt rõ model trước khi đi tiếp, ${t} gửi lại mã máy giúp ${s} nhé.`,
    configuration: `${s} muốn xác nhận lại cấu hình chính trước khi quyết định tiếp.`,
    price: `${s} cần mức giá rõ hơn để chốt phương án phù hợp.`,
    stock: `Dạ mẫu này hiện còn sẵn hàng không ${t}?`,
    delivery: `${s} muốn chốt luôn mốc giao hàng cụ thể để chủ động kế hoạch.`,
    warranty: `${s} cần rõ chính sách bảo hành để yên tâm chốt.`,
    payment: `${s} cần thông tin thanh toán để xử lý bước tiếp theo.`,
    invoice_or_document: `${s} cần xác nhận phần hóa đơn/chứng từ giúp ${s} nhé.`,
    next_step: `Nếu ổn rồi thì ${s} chốt bước tiếp theo luôn ${t} nhé.`
  };
  if (!nextTopic) return `${s} đã nắm đủ thông tin chính, ${t} hỗ trợ giúp ${s} bước chốt cuối nhé.`;
  return map[nextTopic];
}
