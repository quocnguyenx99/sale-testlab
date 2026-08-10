import {
  extractProductMentions,
  searchProducts
} from "./productKnowledge/productKnowledge";

export interface ConversationMemorySlots {
  product_model_mentioned: boolean;
  configuration_discussed: boolean;
  price_discussed: boolean;
  stock_discussed: boolean;
  delivery_discussed: boolean;
  warranty_discussed: boolean;
  payment_discussed: boolean;
  invoice_or_document_discussed: boolean;
  next_step_discussed: boolean;

  // Product Context Grounding Fields (Phase 12H.1-B)
  selected_product_model: string | null;
  selected_product_model_code: string | null;
  product_context_status: "unknown" | "vague" | "specific";
  product_candidates_summary: Array<{
    model_code: string;
    display_name: string;
    brand: string | null;
    price_si: number | null;
    price_le: number | null;
    stock_status: "in_stock" | "out_of_stock" | "unknown";
    stock_qty: number;
  }>;
  product_knowledge_used: boolean;
}

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

export function createEmptyMemory(): ConversationMemorySlots {
  return {
    product_model_mentioned: false,
    configuration_discussed: false,
    price_discussed: false,
    stock_discussed: false,
    delivery_discussed: false,
    warranty_discussed: false,
    payment_discussed: false,
    invoice_or_document_discussed: false,
    next_step_discussed: false,

    // Phase 12H.1-B fields
    selected_product_model: null,
    selected_product_model_code: null,
    product_context_status: "unknown",
    product_candidates_summary: [],
    product_knowledge_used: false
  };
}

export function updateMemorySlots(memory: ConversationMemorySlots, saleMessage: string): ConversationMemorySlots {
  const text = normalize(saleMessage);
  const newMemory = { ...memory };
  const mentions = extractProductMentions(saleMessage);
  const preserveSpecificContext =
    newMemory.product_context_status === "specific" &&
    newMemory.selected_product_model_code !== null &&
    mentions.length === 0;

  if (/\b(thinkpad|latitude|probook|aspire|vivobook|macbook|elitebook|ideapad|nuc|optiplex|prodesk|model|ma\s?\w+)\b/.test(text)) {
    newMemory.product_model_mentioned = true;
  }

  if (/\b(gia|bao gia|trieu|vnd|vnđ)\b/.test(text)) {
    newMemory.price_discussed = true;
  }

  if (/\b(i3|i5|i7|i9|ram|ssd|cau hinh|gen)\b/.test(text)) {
    newMemory.configuration_discussed = true;
    newMemory.product_model_mentioned = true;
  }

  if (/\b(con hang|san hang|co san|kho)\b/.test(text)) {
    newMemory.stock_discussed = true;
  }

  if (/\b(giao|ship|hom nay|may gio|van chuyen)\b/.test(text)) {
    newMemory.delivery_discussed = true;
  }

  if (/\b(bao hanh)\b/.test(text)) {
    newMemory.warranty_discussed = true;
  }

  if (/\b(chuyen khoan|unc|bill|thanh toan|coc|dat coc)\b/.test(text)) {
    newMemory.payment_discussed = true;
  }

  if (/\b(hoa don|vat|chung tu)\b/.test(text)) {
    newMemory.invoice_or_document_discussed = true;
  }

  if (/\b(chot|giu hang|em gui lai|buoc tiep theo|dat coc)\b/.test(text)) {
    newMemory.next_step_discussed = true;
  }

  // Product Grounding Logic (Phase 12H.1-B)
  // 1. Try to extract exact mentions from the sale message
  if (mentions.length > 0) {
    newMemory.product_knowledge_used = true;
    newMemory.product_model_mentioned = true;

    const candidates = mentions.map(p => ({
      model_code: p.model_code,
      display_name: p.display_name,
      brand: p.brand,
      price_si: p.price_si,
      price_le: p.price_le,
      stock_status: p.stock_status,
      stock_qty: p.stock_qty
    }));
    newMemory.product_candidates_summary = candidates;

    if (mentions.length === 1) {
      newMemory.selected_product_model = mentions[0].display_name;
      newMemory.selected_product_model_code = mentions[0].model_code;
      newMemory.product_context_status = "specific";
    } else {
      newMemory.selected_product_model = null;
      newMemory.selected_product_model_code = null;
      newMemory.product_context_status = "vague";
    }
  } else {
    if (preserveSpecificContext) {
      return newMemory;
    }
    // 2. If no exact mentions, check if the Sale message refers to generic keywords or categories
    const hasProductKeywords = /\b(may|in|man hinh|laptop|pc|ssd|ram|server|nuc|router|switch|chuot|phim|vga|o cung|linh kien|epson|canon|brother|hp|hpe|dell)\b/.test(text);

    if (hasProductKeywords) {
      const searchResults = searchProducts(saleMessage, { limit: 5 });
      if (searchResults.length > 0) {
        newMemory.product_knowledge_used = true;
        newMemory.product_model_mentioned = true;

        const candidates = searchResults.map(p => ({
          model_code: p.model_code,
          display_name: p.display_name,
          brand: p.brand,
          price_si: p.price_si,
          price_le: p.price_le,
          stock_status: p.stock_status,
          stock_qty: p.stock_qty
        }));
        newMemory.product_candidates_summary = candidates;

        if (searchResults.length === 1) {
          newMemory.selected_product_model = searchResults[0].display_name;
          newMemory.selected_product_model_code = searchResults[0].model_code;
          newMemory.product_context_status = "specific";
        } else {
          newMemory.selected_product_model = null;
          newMemory.selected_product_model_code = null;
          newMemory.product_context_status = "vague";
        }
      }
    }
    // 3. Persistence: if no product mentions or matches are found in this turn,
    // we keep the previous memory values untouched.
  }

  return newMemory;
}
