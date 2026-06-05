export type ConversationTopic =
  | "product_model"
  | "configuration"
  | "price"
  | "stock"
  | "delivery"
  | "warranty"
  | "payment"
  | "invoice_or_document"
  | "next_step";

export interface TopicProgress {
  requested: boolean;
  answered: boolean;
  confirmed: boolean;
}

export type ConversationProgress = Record<ConversationTopic, TopicProgress> & {
  last_requested_topic?: ConversationTopic | null;
  last_answered_topic?: ConversationTopic | null;
  last_customer_topic?: ConversationTopic | null;
};

export const TOPIC_ORDER: ConversationTopic[] = [
  "product_model",
  "configuration",
  "price",
  "stock",
  "delivery",
  "warranty",
  "payment",
  "invoice_or_document",
  "next_step"
];

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

function emptyTopic(): TopicProgress {
  return { requested: false, answered: false, confirmed: false };
}

export function getEmptyTopicProgress(): TopicProgress {
  return emptyTopic();
}

export function createEmptyConversationProgress(): ConversationProgress {
  return {
    product_model: emptyTopic(),
    configuration: emptyTopic(),
    price: emptyTopic(),
    stock: emptyTopic(),
    delivery: emptyTopic(),
    warranty: emptyTopic(),
    payment: emptyTopic(),
    invoice_or_document: emptyTopic(),
    next_step: emptyTopic(),
    last_requested_topic: null,
    last_answered_topic: null,
    last_customer_topic: null
  };
}

function setRequested(progress: ConversationProgress, topic: ConversationTopic): void {
  const state = progress[topic] ?? getEmptyTopicProgress();
  state.requested = true;
  progress[topic] = state;
}

function setAnswered(progress: ConversationProgress, topic: ConversationTopic): void {
  const state = progress[topic] ?? getEmptyTopicProgress();
  state.answered = true;
  progress[topic] = state;
}

function setConfirmed(progress: ConversationProgress, topic: ConversationTopic): void {
  const state = progress[topic] ?? getEmptyTopicProgress();
  state.confirmed = true;
  progress[topic] = state;
}

function hasConfirmation(text: string): boolean {
  return /\b(nhan duoc roi|ok roi|em thay roi|da duoc roi|oke chi|ok anh|da ro roi|xac nhan roi)\b/.test(text);
}

function detectCustomerRequestedTopics(text: string): ConversationTopic[] {
  const hits: ConversationTopic[] = [];
  if (/\b(stk|so tai khoan|chuyen khoan|thanh toan|dat coc|coc)\b/.test(text)) hits.push("payment");
  if (/\b(giao khi nao|bao lau giao|ship khi nao|giao trong ngay|giao hom nay)\b/.test(text)) hits.push("delivery");
  if (/\b(gia|bao gia|bao nhieu|trieu|vnd|vnđ)\b/.test(text)) hits.push("price");
  if (/\b(cau hinh|i3|i5|i7|i9|ram|ssd|gen)\b/.test(text)) hits.push("configuration");
  if (/\b(con hang|san hang|co san|kho)\b/.test(text)) hits.push("stock");
  if (/\b(bao hanh)\b/.test(text)) hits.push("warranty");
  if (/\b(hoa don|vat|chung tu)\b/.test(text)) hits.push("invoice_or_document");
  if (/\b(chot|giu hang|buoc tiep theo|dat coc)\b/.test(text)) hits.push("next_step");
  if (/\b(model|ma may|thinkpad|latitude|probook|nuc|optiplex|ideapad|aspire|vivobook|macbook)\b/.test(text)) hits.push("product_model");
  return hits;
}

function hasTopicContext(progress: ConversationProgress, topic: ConversationTopic): boolean {
  return progress.last_requested_topic === topic || getFirstUnresolvedTopic(progress) === topic;
}

export function isStrongSaleAnswerForTopic(text: string, topic: ConversationTopic): boolean {
  switch (topic) {
    case "price":
      return /\b\d+(?:\.\d{3})*(?:\s*(?:tr|trieu|vnd|vnđ|trđ|k|m))\b/.test(text) ||
             /\b\d+(?:\.\d{3}){2,}\b/.test(text) ||
             /\b\d+tr\d*\b/.test(text);
    case "stock":
      return /\b(con hang|co hang|san hang|co san|con san|hang san|con kho|ton kho|hien con|ben em con|het hang|khong con hang|chua co hang|tam het|dang het)\b/.test(text);
    case "delivery":
      return /\b(giao hom nay|giao thu|giao chieu nay|mai giao|van chuyen|giao duoc|ship)\b/.test(text);
    case "warranty":
      return /\b(bao hanh|\d+\s*thang)\b/.test(text);
    case "payment":
      return /\b(chuyen khoan|unc|bill|thanh toan|coc|dat coc|tien mat|cod)\b/.test(text);
    case "invoice_or_document":
      return /\b(hoa don|vat|chung tu|xuat duoc|xuat hd|hoa don cong ty)\b/.test(text);
    case "configuration":
      return /\b(i3|i5|i7|i9|ram|ssd|cau hinh|gen)\b/.test(text);
    case "product_model":
      return /\b(model|ma may|thinkpad|latitude|probook|nuc|optiplex|ideapad|aspire|vivobook|macbook)\b/.test(text);
    case "next_step":
      return /\b(chot|giu hang|buoc tiep theo|dat coc)\b/.test(text);
    default:
      return false;
  }
}

function shouldMarkSaleAnswered(
  progress: ConversationProgress,
  topic: ConversationTopic,
  text: string
): boolean {
  if (isStrongSaleAnswerForTopic(text, topic)) return true;
  const shortText = text.split(" ").filter(Boolean).length <= 4;
  if (!shortText) return false;
  if (!hasTopicContext(progress, topic)) return false;

  switch (topic) {
    case "price":
      return /^\d+(\s*(tr|trieu|vnđ|vnd|k|000))?(\s+\w+)?$/.test(text) ||
             /\b\d+(?:\.\d{3})*(?:\s*(?:tr|trieu|vnd|vnđ|trđ|k|m))\b/.test(text) ||
             /\b\d+tr\d*\b/.test(text);
    case "stock":
      return /\b(con hang|co hang|san hang|co san|con san|hang san|con kho|ton kho|hien con|ben em con|het hang|khong con hang|chua co hang|tam het|dang het)\b/.test(text);
    case "delivery":
      return /\b(duoc|giao duoc|hom nay|mai|thu \w+)\b/.test(text);
    case "warranty":
      return /\b(\d+\s*thang|12 thang|bao hanh)\b/.test(text);
    case "payment":
      return /\b(chuyen khoan|thanh toan|coc|dat coc|cod|tien mat)\b/.test(text);
    case "invoice_or_document":
      return /\b(hoa don|vat|chung tu|xuat duoc|xuat hd)\b/.test(text);
    case "configuration":
      return /\b(i3|i5|i7|i9|ram|ssd|gen)\b/.test(text);
    case "product_model":
      return /\b(model|ma may|thinkpad|latitude|probook|nuc|optiplex|ideapad|aspire|vivobook|macbook)\b/.test(text);
    case "next_step":
      return /\b(chot|giu hang|buoc tiep theo|dat coc)\b/.test(text);
    default:
      return false;
  }
}

export function updateProgressFromCustomerMessage(
  current: ConversationProgress,
  customerMessage: string
): ConversationProgress {
  const text = normalize(customerMessage);
  const next = ensureConversationProgress(current);
  const requestedTopics = detectCustomerRequestedTopics(text);

  for (const topic of requestedTopics) {
    setRequested(next, topic);
  }
  if (requestedTopics.length > 0) {
    next.last_requested_topic = requestedTopics[0];
    next.last_customer_topic = requestedTopics[0];
  }

  if (hasConfirmation(text)) {
    for (const topic of TOPIC_ORDER) {
      const state = getTopicProgress(next, topic);
      if (state.answered) setConfirmed(next, topic);
    }
  }

  if (/\b(ok giao giup em|da duoc chi|vay giao giup em)\b/.test(text)) setConfirmed(next, "delivery");
  if (/\b(nhan duoc stk|ok stk|da nhan stk|da ro stk)\b/.test(text)) setConfirmed(next, "payment");

  return next;
}

export function updateProgressFromSaleMessage(
  current: ConversationProgress,
  saleMessage: string
): ConversationProgress {
  const text = normalize(saleMessage);
  const next = ensureConversationProgress(current);
  const topicsInOrder: ConversationTopic[] = [
    "price",
    "stock",
    "delivery",
    "payment",
    "invoice_or_document",
    "configuration",
    "warranty",
    "next_step",
    "product_model"
  ];

  for (const topic of topicsInOrder) {
    if (shouldMarkSaleAnswered(next, topic, text)) {
      setAnswered(next, topic);
      next.last_answered_topic = topic;
    }
  }

  return next;
}

export function topicCompleted(topic: TopicProgress): boolean {
  return topic.requested && topic.answered && topic.confirmed;
}

export function getTopicProgress(
  progress: ConversationProgress | null | undefined,
  topic: ConversationTopic
): TopicProgress {
  if (!progress) return getEmptyTopicProgress();
  const state = progress[topic];
  if (!state || typeof state !== "object") return getEmptyTopicProgress();
  return {
    requested: Boolean(state.requested),
    answered: Boolean(state.answered),
    confirmed: Boolean(state.confirmed)
  };
}

export function ensureConversationProgress(
  progress?: ConversationProgress | null
): ConversationProgress {
  const base = createEmptyConversationProgress();
  if (!progress) return base;

  for (const topic of TOPIC_ORDER) {
    base[topic] = getTopicProgress(progress, topic);
  }
  base.last_requested_topic = progress.last_requested_topic ?? null;
  base.last_answered_topic = progress.last_answered_topic ?? null;
  base.last_customer_topic = progress.last_customer_topic ?? null;
  return base;
}

export function getFirstUnresolvedTopic(progress: ConversationProgress): ConversationTopic | null {
  const safeProgress = ensureConversationProgress(progress);
  for (const topic of TOPIC_ORDER) {
    const t = getTopicProgress(safeProgress, topic);
    const blocked = t.answered || t.confirmed;
    if (!blocked) return topic;
  }
  return null;
}
