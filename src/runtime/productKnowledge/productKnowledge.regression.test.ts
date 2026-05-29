import assert from "node:assert/strict";
import {
  loadProductKnowledge,
  findProductByModelCode,
  extractProductMentions,
  searchProducts,
  buildProductPromptContext
} from "./productKnowledge";

function runTests(): void {
  console.log("=== STARTING PRODUCT KNOWLEDGE REGRESSION TESTS ===");

  // 1. JSON Load Test
  console.log("Running Test 1: JSON Load Test...");
  const products = loadProductKnowledge();
  assert.ok(Array.isArray(products), "Products must be an array.");
  assert.equal(products.length, 4869, "Product database must contain exactly 4869 items.");
  console.log("Test 1: PASS. Successfully loaded 4869 normalized items.");

  // 2. Exact Model/Partnumber O(1) Lookup
  console.log("Running Test 2: Exact Model Lookup...");
  const item1 = findProductByModelCode("846514-B21");
  assert.ok(item1, "Should find product with code '846514-B21'.");
  assert.equal(item1.display_name, "HDD HPE 6TB SAS 12G 7.2K (846514-B21)", "Incorrect display name.");
  assert.equal(item1.brand, "HPE", "Incorrect brand.");
  assert.equal(item1.price_si, 7070000, "Incorrect wholesale price.");

  const item1Case = findProductByModelCode("846514-b21");
  assert.ok(item1Case, "Should be case-insensitive.");
  assert.equal(item1Case.id, item1.id, "IDs must match.");

  const itemNull = findProductByModelCode("NON_EXISTENT_CODE_123");
  assert.equal(itemNull, null, "Should return null for non-existent code.");
  console.log("Test 2: PASS. Exact model O(1) lookup is correct and case-insensitive.");

  // 3. Fuzzy Search (Name & Category)
  console.log("Running Test 3: Fuzzy Search...");
  const searchResults1 = searchProducts("Canon Pixma");
  assert.ok(searchResults1.length > 0, "Should return search results.");
  assert.ok(
    searchResults1.some(p => p.display_name.toLowerCase().includes("canon")),
    "Search results should contain Canon."
  );
  assert.ok(
    searchResults1.some(p => p.display_name.toLowerCase().includes("pixma")),
    "Search results should contain Pixma."
  );

  const searchResults2 = searchProducts("Linh Kien PC");
  assert.ok(searchResults2.length > 0, "Should return category search results.");
  assert.ok(
    searchResults2.some(p => p.category1 === "Linh kiện PC" || p.category2 === "Linh kiện PC"),
    "Should match category1 or category2."
  );
  console.log("Test 3: PASS. Fuzzy search finds matches by name, category, and model code.");

  // 4. Stock Status Ranking Priority
  console.log("Running Test 4: Stock Ranking Priority...");
  // Let's search for Canon Pixma G. G1010 and G2010 are in_stock (stock=1). G3010 is out_of_stock (stock=0).
  const stockSearch = searchProducts("Canon Pixma G");
  assert.ok(stockSearch.length >= 3, "Should return G1010, G2010, and G3010.");

  const g1010Idx = stockSearch.findIndex(p => p.model_code === "MICN_G1010");
  const g2010Idx = stockSearch.findIndex(p => p.model_code === "MICN_G2010");
  const g3010Idx = stockSearch.findIndex(p => p.model_code === "MICN_G3010");

  assert.ok(g1010Idx !== -1, "G1010 must be found.");
  assert.ok(g2010Idx !== -1, "G2010 must be found.");
  assert.ok(g3010Idx !== -1, "G3010 must be found.");

  // In-stock items (G1010 and G2010) must rank ABOVE out-of-stock item (G3010)
  assert.ok(g1010Idx < g3010Idx, `G1010 (index ${g1010Idx}) must rank higher than out-of-stock G3010 (index ${g3010Idx})`);
  assert.ok(g2010Idx < g3010Idx, `G2010 (index ${g2010Idx}) must rank higher than out-of-stock G3010 (index ${g3010Idx})`);
  console.log("Test 4: PASS. In-stock products successfully rank above out-of-stock ones.");

  // 5. Price Si Available vs No Price (Si is 0/null) Ranking Priority
  console.log("Running Test 5: Price Score Boost...");
  // Let's find two similar items or search for a term that matches items with and without price_si.
  // "Epson" returns some items with priceSi > 0 (LQ-2190, LQ-310) and some with priceSi = 0/null (L1800, L1300, LQ-680 Pro, L805).
  // All are out of stock. If we search "Epson LQ", LQ-2190 and LQ-310 have price_si, LQ-680 has no price.
  const priceSearch = searchProducts("Epson LQ", { limit: 50 });
  const lq2190Idx = priceSearch.findIndex(p => p.model_code === "EP_LQ-2190");
  const lq310Idx = priceSearch.findIndex(p => p.model_code === "LQ310_EPSON");
  const lq680Idx = priceSearch.findIndex(p => p.model_code === "EP_LQ680");

  assert.ok(lq2190Idx !== -1, "LQ-2190 must be found.");
  assert.ok(lq310Idx !== -1, "LQ-310 must be found.");
  assert.ok(lq680Idx !== -1, "LQ-680 must be found.");

  // LQ-2190 and LQ-310 (with price_si) should rank higher than LQ-680 (no price_si)
  assert.ok(lq2190Idx < lq680Idx, `LQ-2190 (index ${lq2190Idx}) with price sỉ should rank higher than LQ-680 (index ${lq680Idx}) with no price`);
  assert.ok(lq310Idx < lq680Idx, `LQ-310 (index ${lq310Idx}) with price sỉ should rank higher than LQ-680 (index ${lq680Idx}) with no price`);
  console.log("Test 5: PASS. Products with primary price_si get a search score boost.");

  // 6. Prompt Context Builder Format & Limit
  console.log("Running Test 6: Prompt Context Builder...");
  const topPrinters = searchProducts("Canon Pixma G");
  const context = buildProductPromptContext(topPrinters);

  assert.ok(typeof context === "string", "Context must be a string.");
  assert.ok(context.includes("=== THÔNG TIN SẢN PHẨM KHẢ DỤNG ==="), "Must contain correct header.");
  assert.ok(context.includes("Giá sỉ/đại lý"), "Must contain wholesale label.");
  assert.ok(context.includes("Giá thị trường"), "Must contain market reference label.");
  assert.ok(!context.includes("[{") && !context.includes('"items":'), "Must not dump raw JSON.");

  // Count number of numbered product items in the text
  const itemMatches = context.match(/\d+\.\s+\[Sản phẩm\]/g) || [];
  assert.ok(itemMatches.length <= 5, "Context must have at most 5 products.");
  assert.ok(itemMatches.length > 0, "Context must have at least one product.");
  console.log("Test 6: PASS. Prompt builder context is extremely compact, formatted, and capped at 5.");

  // 7. Stopwords Ignored in Search
  console.log("Running Test 7: Stopwords Ignored...");
  const normalSearch = searchProducts("Canon Pixma G1010");
  const stopwordSearch = searchProducts("em oi con may in Canon Pixma G1010 khong");

  assert.ok(normalSearch.length > 0, "Normal search should find items.");
  assert.ok(stopwordSearch.length > 0, "Stopword search should find items.");
  assert.equal(normalSearch[0].id, stopwordSearch[0].id, "First result should be identical despite stopwords.");
  console.log("Test 7: PASS. Stopwords are filtered correctly and do not dilute search relevance.");

  // 8. O(1) Mention Extraction from Message
  console.log("Running Test 8: O(1) Mention Extraction...");
  const textWithMention1 = "Chào shop, bên mình còn HDD HPE 6TB SAS 12G 7.2K (846514-B21) không?";
  const mentions1 = extractProductMentions(textWithMention1);
  assert.equal(mentions1.length, 1, "Should extract exactly 1 mention.");
  assert.equal(mentions1[0].model_code, "846514-B21", "Extracted code must be 846514-B21.");

  const textWithMention2 = "báo giá giúp em con L805 với LQ310_EPSON nhé.";
  const mentions2 = extractProductMentions(textWithMention2);
  assert.equal(mentions2.length, 2, "Should extract 2 mentions.");
  const codes = mentions2.map(m => m.model_code);
  assert.ok(codes.includes("L805"), "Should include L805.");
  assert.ok(codes.includes("LQ310_EPSON"), "Should include LQ310_EPSON.");

  const textNoMention = "Chào anh, chúc anh ngày mới tốt lành.";
  const mentionsNone = extractProductMentions(textNoMention);
  assert.equal(mentionsNone.length, 0, "Should extract 0 mentions.");
  console.log("Test 8: PASS. O(1) mentions extraction correctly identifies products in chat messages.");

  console.log("=== ALL PRODUCT KNOWLEDGE REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
