import assert from "node:assert/strict";
import {
  createEmptyMemory,
  updateMemorySlots,
  ConversationMemorySlots
} from "./conversationMemory";
import {
  buildEnrichedRuntimePrompt,
  EnrichedPromptInput
} from "./runtimePromptBuilder";
import { createEmptyConversationProgress } from "./conversationProgressTracker";
import { buildIdentityProfileFromOpening } from "./conversationIdentity";

function runTests(): void {
  console.log("=== STARTING PHASE 12H.1-B PRODUCT CONTEXT MEMORY REGRESSION TESTS ===");

  // 1. Greeting only
  console.log("Running Test 1: Greeting only...");
  const mem1 = createEmptyMemory();
  const res1 = updateMemorySlots(mem1, "em chào anh");
  assert.equal(res1.product_context_status, "unknown", "Greeting only must set status to 'unknown'.");
  assert.equal(res1.selected_product_model, null, "Model must be null.");
  assert.equal(res1.selected_product_model_code, null, "Model code must be null.");
  assert.deepEqual(res1.product_candidates_summary, [], "Candidates must be empty.");
  assert.equal(res1.product_knowledge_used, false, "Product knowledge must be false.");
  console.log("Test 1: PASS.");

  // 2. Vague product need
  console.log("Running Test 2: Vague product need...");
  const mem2 = createEmptyMemory();
  const res2 = updateMemorySlots(mem2, "bên em có laptop i5 ram 16 ssd 512 không");
  assert.equal(res2.product_context_status, "vague", "Category need must set status to 'vague'.");
  assert.equal(res2.selected_product_model, null, "Model must be null.");
  assert.equal(res2.selected_product_model_code, null, "Model code must be null.");
  assert.ok(res2.product_candidates_summary.length > 0, "Candidates must not be empty.");
  assert.equal(res2.product_knowledge_used, true, "Product knowledge must be used.");
  console.log("Test 2: PASS.");

  // 3. Exact model_code
  console.log("Running Test 3: Exact model_code...");
  const mem3 = createEmptyMemory();
  const res3 = updateMemorySlots(mem3, "bên em có mã 846514-B21 không");
  assert.equal(res3.product_context_status, "specific", "Exact code must set status to 'specific'.");
  assert.equal(res3.selected_product_model_code, "846514-B21", "Model code must match exactly.");
  assert.ok(res3.selected_product_model !== null, "Model name must be populated.");
  console.log("Test 3: PASS.");

  // 4. Exact product name
  console.log("Running Test 4: Exact product name...");
  const mem4 = createEmptyMemory();
  // Using a real display_name from products_list.json:
  const exactName = "Máy in phun màu đơn năng Canon Pixma G1010";
  const res4 = updateMemorySlots(mem4, `bên em có ${exactName} không anh`);
  assert.equal(res4.product_context_status, "specific", "Exact display name must set status to 'specific'.");
  assert.equal(res4.selected_product_model, exactName, "Display name must match.");
  assert.equal(res4.selected_product_model_code, "MICN_G1010", "Should find G1010 code.");
  console.log("Test 4: PASS.");

  // 5. Context persistence
  console.log("Running Test 5: Context persistence...");
  // Turn 1
  const t1 = updateMemorySlots(createEmptyMemory(), "bên em có mã 846514-B21 còn hàng anh");
  assert.equal(t1.product_context_status, "specific");
  assert.equal(t1.selected_product_model_code, "846514-B21");

  // Turn 2: follow up
  const t2 = updateMemorySlots(t1, "mẫu đó giao hôm nay được không");
  assert.equal(t2.product_context_status, "specific", "Status must remain specific.");
  assert.equal(t2.selected_product_model_code, "846514-B21", "Model code must persist.");
  assert.ok(t2.selected_product_model !== null, "Model display name must persist.");
  console.log("Test 5: PASS.");

  // 6. Model switch
  console.log("Running Test 6: Model switch...");
  const s1 = updateMemorySlots(createEmptyMemory(), "mã 846514-B21");
  assert.equal(s1.selected_product_model_code, "846514-B21");

  const s2 = updateMemorySlots(s1, "còn mã LQ310_EPSON thì sao");
  assert.equal(s2.selected_product_model_code, "LQ310_EPSON", "Should switch to Epson model code.");
  assert.equal(s2.product_context_status, "specific", "Status should be specific.");
  console.log("Test 6: PASS.");

  // 7. Out-of-stock product
  console.log("Running Test 7: Out-of-stock product...");
  const mem7 = createEmptyMemory();
  // Canon Pixma G3010 is out of stock (stock: 0) in the raw json
  const res7 = updateMemorySlots(mem7, "bên em có Canon Pixma G3010 không");
  assert.equal(res7.product_context_status, "specific", "G3010 should set status to specific.");
  assert.ok(res7.product_candidates_summary.length > 0, "Candidates summary should be populated.");
  assert.equal(res7.product_candidates_summary[0].stock_status, "out_of_stock", "Stock status must be 'out_of_stock'.");
  console.log("Test 7: PASS.");

  // 8. Follow-up after specific
  console.log("Running Test 8: Follow-up after specific...");
  const f1 = updateMemorySlots(createEmptyMemory(), "bên em có mã 846514-B21 giá sỉ 7070000 còn hàng anh");
  assert.equal(f1.product_context_status, "specific");

  const f2 = updateMemorySlots(f1, "giá này đã là giá sỉ chưa em");
  assert.equal(f2.product_context_status, "specific", "Follow up price question should retain specific status.");
  assert.equal(f2.selected_product_model_code, "846514-B21", "Model code must persist.");
  console.log("Test 8: PASS.");

  // 9. Prompt Builder Integration verification
  console.log("Running Test 9: Prompt Builder Injection...");
  const promptInput: EnrichedPromptInput = {
    persona: {
      role_prompt: "Bạn là Khách hàng Sim.",
      behavior_rules: ["Nói năng nhẹ nhàng."],
      product_interest_categories: ["Linh kiện server"],
      purchase_context: "Mua server",
      closing_conditions: ["Khi có thông tin thanh toán"],
      do_not_do: []
    },
    runtimeState: "pricing_phase",
    recentMessages: ["Sale: Chào anh", "Khach AI: Chào em"],
    memorySlots: f1,
    progress: createEmptyConversationProgress(),
    identity: buildIdentityProfileFromOpening("Anh đang xem...")
  };

  const enrichedPrompt = buildEnrichedRuntimePrompt(promptInput);
  assert.ok(enrichedPrompt.includes("=== THÔNG TIN SẢN PHẨM KHẢ DỤNG ==="), "Prompt must include product knowledge context block.");
  assert.ok(enrichedPrompt.includes("Mã sản phẩm: 846514-B21"), "Prompt must contain grounded model code.");
  console.log("Test 9: PASS.");

  console.log("=== ALL PHASE 12H.1-B PRODUCT CONTEXT MEMORY REGRESSION TESTS: PASS ===");
}

if (require.main === module) {
  runTests();
}
