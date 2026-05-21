import { ConversationIdentityProfile } from "./conversationIdentity";
import { ConversationProgress, ConversationTopic, TOPIC_ORDER } from "./conversationProgressTracker";

export interface ResponseBankInput {
  topic: ConversationTopic | null;
  nextTopic: ConversationTopic | null;
  identity: ConversationIdentityProfile;
  recentFallbackVariantIds: string[];
  recentReplies: string[];
}

export interface ResponseBankResult {
  reply: string;
  variant_id: string;
  topic_used: ConversationTopic | null;
  exhausted_variants: boolean;
}

type ResponseVariant = {
  variant_id: string;
  text: string;
};

type TopicVariants = Record<ConversationTopic, ResponseVariant[]>;

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

function render(text: string, identity: ConversationIdentityProfile): string {
  return text
    .replaceAll("{self}", identity.customer_self_pronoun)
    .replaceAll("{sale}", identity.customer_target_pronoun)
    .replaceAll("{self_cap}", identity.customer_self_pronoun)
    .replaceAll("{sale_cap}", identity.customer_target_pronoun);
}

const BANK: TopicVariants = {
  product_model: [
    { variant_id: "product_model_1", text: "{self} muốn chốt rõ model trước khi đi tiếp, {sale} gửi lại mã máy giúp {self} nhé." },
    { variant_id: "product_model_2", text: "{self} cần xác nhận đúng mẫu máy rồi mới đi tiếp được." },
    { variant_id: "product_model_3", text: "{self} muốn kiểm tra lại mã máy cho chắc trước khi quyết định." },
    { variant_id: "product_model_4", text: "Mẫu này phải đúng model {self} đang xem thì mới chốt được, {sale} kiểm tra lại giúp {self} nhé." }
  ],
  configuration: [
    { variant_id: "configuration_1", text: "{self} muốn chốt lại cấu hình chính trước khi quyết định." },
    { variant_id: "configuration_2", text: "{self} cần xác nhận CPU, RAM, SSD cho đúng nhu cầu." },
    { variant_id: "configuration_3", text: "{self} muốn đối chiếu lại cấu hình để tránh nhầm." },
    { variant_id: "configuration_4", text: "Cấu hình này nếu đúng nhu cầu của {self} thì mình đi tiếp được." }
  ],
  price: [
    { variant_id: "price_1", text: "{self} muốn chốt mức giá rõ hơn cho mẫu này, {sale} báo giúp {self} thêm một mức để so sánh nhé." },
    { variant_id: "price_2", text: "{self} cần thêm mức giá cụ thể để so sánh, {sale} cho {self} xin thêm một option nữa nhé." },
    { variant_id: "price_3", text: "Giá này nếu còn linh hoạt thì {self} sẽ dễ chốt hơn, {sale} hỗ trợ {self} thêm chút nhé." },
    { variant_id: "price_4", text: "{self} đang ưu tiên một mức giá dễ cân đối hơn, {sale} gửi giúp {self} khung giá phù hợp nhé." }
  ],
  stock: [
    { variant_id: "stock_1", text: "{self} muốn kiểm tra lại mẫu này còn sẵn hàng không {sale}?" },
    { variant_id: "stock_2", text: "Mẫu này hiện còn hàng chứ {sale}? {self} cần xác nhận trước khi đi tiếp." },
    { variant_id: "stock_3", text: "{self} đang ưu tiên mẫu còn sẵn hàng để khỏi mất thời gian." },
    { variant_id: "stock_4", text: "Bên mình còn hàng cho mẫu này không {sale}, {self} cần chốt nhanh." }
  ],
  delivery: [
    { variant_id: "delivery_1", text: "{self} muốn biết mốc giao cụ thể để chủ động kế hoạch." },
    { variant_id: "delivery_2", text: "{self} cần xác nhận thời gian giao rồi mới quyết." },
    { variant_id: "delivery_3", text: "Nếu giao sớm được thì {self} sẽ dễ chốt hơn." },
    { variant_id: "delivery_4", text: "{sale} cho {self} xin mốc giao rõ hơn nhé." }
  ],
  warranty: [
    { variant_id: "warranty_1", text: "{self} cần rõ chính sách bảo hành để yên tâm chốt." },
    { variant_id: "warranty_2", text: "{self} muốn xem phần bảo hành trước khi đi tiếp." },
    { variant_id: "warranty_3", text: "Bảo hành càng rõ thì {self} càng dễ quyết." },
    { variant_id: "warranty_4", text: "{sale} cho {self} xin thông tin bảo hành cụ thể nhé." }
  ],
  payment: [
    { variant_id: "payment_1", text: "{self} cần thông tin thanh toán để xử lý bước tiếp theo." },
    { variant_id: "payment_2", text: "{self} muốn xác nhận phần thanh toán trước khi chốt." },
    { variant_id: "payment_3", text: "Nếu thanh toán ổn thì {self} sẽ đi tiếp." },
    { variant_id: "payment_4", text: "{sale} gửi giúp {self} thông tin thanh toán rõ hơn nhé." }
  ],
  invoice_or_document: [
    { variant_id: "invoice_or_document_1", text: "{self} cần xác nhận phần hóa đơn/chứng từ giúp {self} nhé." },
    { variant_id: "invoice_or_document_2", text: "{self} cần giấy tờ rõ ràng trước khi chốt." },
    { variant_id: "invoice_or_document_3", text: "Nếu có hóa đơn đầy đủ thì {self} sẽ dễ xử lý hơn." },
    { variant_id: "invoice_or_document_4", text: "{sale} cho {self} xin thông tin chứng từ đi kèm nhé." }
  ],
  next_step: [
    { variant_id: "next_step_1", text: "Nếu ổn rồi thì {self} chốt bước tiếp theo luôn {sale} nhé." },
    { variant_id: "next_step_2", text: "{self} muốn đi sang bước tiếp theo cho gọn." },
    { variant_id: "next_step_3", text: "{self} đã nắm đủ phần chính, giờ mình chốt tiếp nhé." },
    { variant_id: "next_step_4", text: "{sale} hỗ trợ {self} bước cuối để chốt nhanh hơn nhé." }
  ]
};

function tokenSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter(Boolean)
  );
}

function overlapScore(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  let overlap = 0;
  for (const token of ta) {
    if (tb.has(token)) overlap += 1;
  }
  return overlap / Math.max(1, Math.min(ta.size, tb.size));
}

function chooseBestVariant(
  variants: ResponseVariant[],
  recentFallbackVariantIds: string[],
  recentReplies: string[]
): ResponseVariant {
  const recentIdSet = new Set(recentFallbackVariantIds.slice(-3));
  const candidates = variants.filter((v) => !recentIdSet.has(v.variant_id));
  const pool = candidates.length > 0 ? candidates : variants;

  let best = pool[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of pool) {
    const similarity = recentReplies.length === 0
      ? 0
      : Math.max(...recentReplies.slice(-3).map((prev) => overlapScore(candidate.text, prev)));
    const tieBreak = normalize(candidate.variant_id).length;
    const score = similarity * 1000 + tieBreak / 1000;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function buildResponseBankReply(input: ResponseBankInput): ResponseBankResult {
  const topic = input.nextTopic || input.topic;
  const fallbackTopic = topic ?? "next_step";
  const variants = BANK[fallbackTopic];
  const chosen = chooseBestVariant(variants, input.recentFallbackVariantIds, input.recentReplies);
  const reply = render(chosen.text, input.identity).replace(/^Dạ\s+/i, "");

  return {
    reply,
    variant_id: chosen.variant_id,
    topic_used: fallbackTopic,
    exhausted_variants: new Set(input.recentFallbackVariantIds.slice(-3)).size >= variants.length
  };
}

export function listResponseBankTopics(): ConversationTopic[] {
  return TOPIC_ORDER.slice();
}
