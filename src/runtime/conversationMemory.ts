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
    next_step_discussed: false
  };
}

export function updateMemorySlots(memory: ConversationMemorySlots, saleMessage: string): ConversationMemorySlots {
  const text = normalize(saleMessage);
  const newMemory = { ...memory };

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

  return newMemory;
}
