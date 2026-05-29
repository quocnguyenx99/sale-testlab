import * as fs from "node:fs";
import * as path from "node:path";

export type ProductKnowledgeItem = {
  id: string;
  model_code: string;
  display_name: string;
  brand: string | null;
  category1: string | null;
  category2: string | null;
  price_si: number | null;
  price_le: number | null;
  stock_status: "in_stock" | "out_of_stock" | "unknown";
  stock_qty: number;
  specs: Record<string, string>;
  searchable_text: string;
};

// Helper to check for a valid partnumber
function getValidPartnumber(pn: any): string | null {
  if (!pn || typeof pn !== "string") return null;
  const trimmed = pn.trim();
  const upper = trimmed.toUpperCase();
  if (
    upper === "" ||
    upper === "NO PART" ||
    upper === "NO_PART" ||
    upper === "N/A" ||
    upper === "NO PART NUMBER"
  ) {
    return null;
  }
  return trimmed;
}

// Helper to convert text to clean slug
function slugify(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Helper to get clean category title
function getCategoryTitle(cat: any): string | null {
  if (!cat) return null;
  if (typeof cat === "string") return cat.trim();
  if (typeof cat === "object" && cat.title) return String(cat.title).trim();
  return null;
}

// Helper to parse specs from technology list
function getSpecs(tech: any): Record<string, string> {
  const specs: Record<string, string> = {};
  if (Array.isArray(tech)) {
    tech.forEach((item: any, index: number) => {
      if (!item) return;
      if (typeof item === "string") {
        const clean = item.replace(/<[^>]*>/g, "").trim();
        if (clean) {
          specs[`spec_${index + 1}`] = clean;
        }
      } else if (typeof item === "object") {
        const label = item.label || item.name || `spec_${index + 1}`;
        const value = item.value || JSON.stringify(item);
        const cleanVal = String(value).replace(/<[^>]*>/g, "").trim();
        specs[label] = cleanVal;
      }
    });
  }
  return specs;
}

// Helper to convert text to clean search terms (lowercase, accentless)
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

function runNormalization(): void {
  const rawPath = process.env.PRODUCT_LIST_JSON_PATH || "productSpecs/products_list.json";
  const outputPath = path.join(__dirname, "product_knowledge.compact.json");

  console.log(`Starting normalization of products from: ${rawPath}`);

  if (!fs.existsSync(rawPath)) {
    console.error(`Error: Source file does not exist at ${rawPath}`);
    process.exit(1);
  }

  const rawDataRaw = fs.readFileSync(rawPath, "utf8");
  let rawData;
  try {
    rawData = JSON.parse(rawDataRaw);
  } catch (err) {
    console.error(`Error parsing source JSON:`, err);
    process.exit(1);
  }

  const rawItems = Array.isArray(rawData) ? rawData : rawData.items || [];
  console.log(`Found ${rawItems.length} raw products. Processing...`);

  const normalizedItems: ProductKnowledgeItem[] = [];
  const seenIds = new Set<string>();

  rawItems.forEach((rawItem: any, index: number) => {
    const display_name = (rawItem.name1 || rawItem.name2 || "").trim();
    const validPartnumber = getValidPartnumber(rawItem.partnumber);

    let model_code = "";
    if (validPartnumber) {
      model_code = validPartnumber;
    } else if (display_name) {
      model_code = slugify(display_name);
    }

    // Exclude if neither display_name nor model_code is valid
    if (!display_name && !model_code) {
      return;
    }

    const brand = rawItem.brand ? String(rawItem.brand).trim() : null;
    const category1 = getCategoryTitle(rawItem.category1);
    const category2 = getCategoryTitle(rawItem.category2);

    const price_si = typeof rawItem.priceSi === "number" && rawItem.priceSi > 0 ? rawItem.priceSi : null;
    const price_le = typeof rawItem.priceLe === "number" && rawItem.priceLe > 0 ? rawItem.priceLe : null;

    const stock_status = rawItem.stock === 1 ? "in_stock" : "out_of_stock";
    const stock_qty = Math.max(rawItem.slctx || 0, rawItem.stock || 0, 0);

    const specs = getSpecs(rawItem.technology);

    // Build searchable text: name1, name2, partnumber, brand, categories, specs values
    const searchableParts = [
      rawItem.name1,
      rawItem.name2,
      rawItem.partnumber,
      brand,
      category1,
      category2,
      ...Object.values(specs)
    ]
      .filter(Boolean)
      .map(s => normalizeSearchable(String(s)));

    // Collapse to unique terms for compactness
    const searchable_text = Array.from(new Set(searchableParts.join(" ").split(" "))).join(" ");

    // Generate unique ID
    let uniqueId = model_code.toLowerCase();
    let counter = 1;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${model_code.toLowerCase()}-${counter}`;
      counter++;
    }
    seenIds.add(uniqueId);

    normalizedItems.push({
      id: uniqueId,
      model_code,
      display_name,
      brand,
      category1,
      category2,
      price_si,
      price_le,
      stock_status,
      stock_qty,
      specs,
      searchable_text
    });
  });

  console.log(`Successfully normalized ${normalizedItems.length} products (excluded ${rawItems.length - normalizedItems.length} invalid items).`);

  // Write to compact file
  fs.writeFileSync(outputPath, JSON.stringify(normalizedItems, null, 2), "utf8");
  console.log(`Saved compact product database to: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

// Only run if executed directly
if (require.main === module) {
  runNormalization();
}
