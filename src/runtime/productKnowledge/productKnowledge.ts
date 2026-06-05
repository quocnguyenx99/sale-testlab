import * as fs from "node:fs";
import * as path from "node:path";
import { ProductKnowledgeItem } from "./normalize_products";

let cachedProducts: ProductKnowledgeItem[] | null = null;
let modelCodeMap: Map<string, ProductKnowledgeItem> | null = null;

// Stopwords in lowercase accentless form
const STOPWORDS = new Set([
  "anh", "chi", "em", "con", "hang", "khong", "bao", "gia", "giup", "voi", "nhe",
  "co", "gi", "oi", "may", "in", "cho", "ban", "ben", "tim", "muon", "hoi", "la",
  "va", "de", "cua", "dum", "nha", "xem", "mau", "dong", "khao", "tham", "da", "do",
  "nay", "kia", "ay", "nao", "nhi", "ma", "mua", "loai", "nhieu", "khac"
]);

// Helper to normalize searchable text
function normalizeSearchable(input: string): string {
  return (input || "")
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokenize text into raw alphanumeric/dash/underscore tokens
function tokenizeText(text: string): string[] {
  const cleaned = text
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\-_]+/g, " ");
  return cleaned.split(/\s+/).filter(Boolean);
}

// Load and cache products database
export function loadProductKnowledge(): ProductKnowledgeItem[] {
  if (cachedProducts) return cachedProducts;

  const dbPath = path.join(__dirname, "product_knowledge.compact.json");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Product database not found at ${dbPath}. Please run the normalization script first!`);
  }

  const raw = fs.readFileSync(dbPath, "utf8");
  cachedProducts = JSON.parse(raw) as ProductKnowledgeItem[];

  // Index items by model_code in lowercase for O(1) lookups
  modelCodeMap = new Map();
  for (const item of cachedProducts) {
    if (item.model_code) {
      modelCodeMap.set(item.model_code.toLowerCase(), item);
    }
  }

  return cachedProducts;
}

// O(1) lookup by exact model code or partnumber
export function findProductByModelCode(code: string): ProductKnowledgeItem | null {
  loadProductKnowledge();
  if (!code || !modelCodeMap) return null;
  const normalized = code.trim().toLowerCase();
  return modelCodeMap.get(normalized) || null;
}

const GENERIC_WORDS = new Set([
  "canon", "epson", "brother", "hp", "hpe", "dell", "intel", "asus", "acer", "lenovo",
  "sama", "cooler", "master", "transcend", "gigabyte", "wd", "western", "digital",
  "silicon", "power", "kingston", "sandisk", "seagate", "apacer", "adata", "crucial",
  "si", "le", "gia", "may", "in", "laptop", "pc", "ram", "ssd", "vga", "o", "cung",
  "linh", "kien", "man", "hinh", "monitor", "nhan", "vien"
]);

// Extract product mentions from conversation text
export function extractProductMentions(text: string): ProductKnowledgeItem[] {
  loadProductKnowledge();
  if (!cachedProducts) return [];

  const normalizedText = normalizeSearchable(text);
  const mentions: ProductKnowledgeItem[] = [];
  const seenIds = new Set<string>();
  const resolvedTokens = new Set<string>();

  // 1. Tokenize text and look for exact model code match on each token
  const tokens = tokenizeText(text);
  for (const token of tokens) {
    const match = findProductByModelCode(token);
    if (match && !seenIds.has(match.id)) {
      mentions.push(match);
      seenIds.add(match.id);
      resolvedTokens.add(token);
    }
  }

  // 2. Also check if other model codes are mentioned as substrings of tokens
  // to catch cases where the model code is e.g. "MICN_G1010" and the text contains "G1010".
  // To avoid false positives on extremely short words, we only check tokens with length >= 4.
  for (const token of tokens) {
    if (token.length < 4) continue;
    if (resolvedTokens.has(token)) {
      continue;
    }

    const cleanToken = token.replace(/[\-_]+/g, "");
    if (GENERIC_WORDS.has(cleanToken) || STOPWORDS.has(cleanToken)) {
      continue;
    }

    for (const item of cachedProducts) {
      if (seenIds.has(item.id)) continue;

      const codeLowerClean = item.model_code.toLowerCase().replace(/[\-_]+/g, "");

      // If the clean token is contained within the clean product model code (e.g. "g1010" inside "micng1010")
      if (
        codeLowerClean === cleanToken ||
        codeLowerClean.includes(cleanToken)
      ) {
        mentions.push(item);
        seenIds.add(item.id);
      }
    }
  }

  return mentions;
}

// Scored fuzzy search for products
export function searchProducts(query: string, options?: { limit?: number }): ProductKnowledgeItem[] {
  const products = loadProductKnowledge();
  const limit = options?.limit || 10;

  const normalizedQuery = normalizeSearchable(query);
  if (!normalizedQuery) {
    // General catalog browse: return top in-stock products with wholesale price
    return [...products]
      .map(item => {
        let score = 0;
        if (item.stock_status === "in_stock") score += 500;
        score += Math.min(item.stock_qty, 100) * 0.5;
        if (item.price_si !== null && item.price_si > 0) score += 300;
        if (item.price_le !== null && item.price_le > 0) score += 100;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(x => x.item)
      .slice(0, limit);
  }

  const rawQueryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  const queryTerms = rawQueryTerms.filter(t => !STOPWORDS.has(t));

  // Fallback to raw terms if query is purely stopwords
  const activeTerms = queryTerms.length > 0 ? queryTerms : rawQueryTerms;

  const scored = products.map(item => {
    let score = 0;

    const codeLower = item.model_code.toLowerCase();
    const nameLower = normalizeSearchable(item.display_name);

    // Exact matches
    if (codeLower === normalizedQuery) {
      score += 10000;
    } else if (codeLower.replace(/[\-_]+/g, "") === normalizedQuery.replace(/[\-_]+/g, "")) {
      score += 9000;
    }

    if (nameLower === normalizedQuery) {
      score += 8000;
    }

    // Term-by-term matching
    let matchedCount = 0;
    for (const term of activeTerms) {
      let matchedInItem = false;
      
      // Match in model code
      const isExactCodePart = codeLower === term || codeLower.split(/[\-_]+/).includes(term);
      if (isExactCodePart) {
        score += 1000;
        matchedInItem = true;
      } else if (term.length >= 3 && codeLower.includes(term)) {
        score += 400;
        matchedInItem = true;
      }

      // Match in display name
      if (nameLower.includes(term)) {
        score += 400;
        matchedInItem = true;
      }

      // Match in brand
      if (item.brand && normalizeSearchable(item.brand).includes(term)) {
        score += 200;
        matchedInItem = true;
      }

      // Match in categories
      if (item.category1 && normalizeSearchable(item.category1).includes(term)) {
        score += 150;
        matchedInItem = true;
      }
      if (item.category2 && normalizeSearchable(item.category2).includes(term)) {
        score += 150;
        matchedInItem = true;
      }

      // Match in specs
      for (const val of Object.values(item.specs)) {
        if (normalizeSearchable(val).includes(term)) {
          score += 100;
          matchedInItem = true;
        }
      }

      if (matchedInItem) {
        matchedCount++;
      }
    }

    // All terms match bonus
    if (matchedCount === activeTerms.length && activeTerms.length > 1) {
      score += 1500;
    }

    // Structural bonuses (only if there was some query match)
    if (score > 0) {
      if (item.stock_status === "in_stock") {
        score += 500;
      }
      score += Math.min(item.stock_qty, 100) * 0.5;
      if (item.price_si !== null && item.price_si > 0) {
        score += 300;
      }
      if (item.price_le !== null && item.price_le > 0) {
        score += 100;
      }
    }

    return { item, score };
  });

  // Filter out items with 0 score (didn't match query at all)
  const matched = scored.filter(x => x.score > 0);

  // Sort by score descending
  return matched
    .sort((a, b) => b.score - a.score)
    .map(x => x.item)
    .slice(0, limit);
}

// Formatting top products into a compact Vietnamese prompt context
export function buildProductPromptContext(products: ProductKnowledgeItem[]): string {
  const list = products.slice(0, 5);
  if (list.length === 0) {
    return "Không tìm thấy thông tin sản phẩm cụ thể.";
  }

  let context = "=== THÔNG TIN SẢN PHẨM KHẢ DỤNG ===\n";
  list.forEach((p, idx) => {
    const priceSiFormatted = p.price_si !== null ? `${p.price_si.toLocaleString("vi-VN")} VNĐ` : "Liên hệ";
    const priceLeFormatted = p.price_le !== null ? `${p.price_le.toLocaleString("vi-VN")} VNĐ` : "Liên hệ";
    const stockText = p.stock_status === "in_stock"
      ? `Còn hàng [INTERNAL_STOCK_REFERENCE_DO_NOT_MENTION: ${p.stock_qty}]`
      : `Hết hàng [INTERNAL_STOCK_REFERENCE_DO_NOT_MENTION: ${p.stock_qty}]`;

    context += `${idx + 1}. [Sản phẩm] ${p.display_name}\n`;
    context += `   - Mã sản phẩm: ${p.model_code}\n`;
    if (p.brand) {
      context += `   - Thương hiệu: ${p.brand}\n`;
    }
    context += `   - Giá sỉ/đại lý: ${priceSiFormatted}\n`;
    context += `   - Giá thị trường: ${priceLeFormatted}\n`;
    context += `   - Trạng thái kho: ${stockText}\n`;

    const specPairs = Object.entries(p.specs);
    if (specPairs.length > 0) {
      const specSummary = specPairs.map(([k, v]) => `${k}: ${v}`).join(", ");
      context += `   - Thông số: ${specSummary}\n`;
    }
  });
  context += "====================================";
  return context;
}
