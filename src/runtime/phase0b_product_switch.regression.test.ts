import assert from "node:assert/strict";
import { createEmptyMemory, updateMemorySlots } from "./conversationMemory";

function memoryFor(message: string) {
  return updateMemorySlots(createEmptyMemory(), message);
}

function runTests(): void {
  const hyphenated = memoryFor("bên em có mã 846514-B21 không");
  const toUnderscore = updateMemorySlots(hyphenated, "còn mã LQ310_EPSON thì sao");
  assert.equal(toUnderscore.selected_product_model_code, "LQ310_EPSON");

  const underscored = memoryFor("bên em có mã LQ310_EPSON không");
  const toHyphenated = updateMemorySlots(underscored, "chuyển sang mã 846514-B21 nhé");
  assert.equal(toHyphenated.selected_product_model_code, "846514-B21");

  const canonG1010 = memoryFor("bên em có Máy in phun màu đơn năng Canon Pixma G1010 không");
  const canonG3010 = updateMemorySlots(canonG1010, "còn Canon Pixma G3010 thì sao");
  assert.equal(canonG3010.selected_product_model_code, "MICN_G3010");

  const genericFollowUp = updateMemorySlots(hyphenated, "mẫu đó giao hôm nay được không");
  assert.equal(genericFollowUp.selected_product_model_code, "846514-B21");

  const unknownMention = updateMemorySlots(hyphenated, "còn mã UNKNOWN_XYZ thì sao");
  assert.equal(unknownMention.selected_product_model_code, "846514-B21");

  const ambiguous = updateMemorySlots(
    hyphenated,
    "so sánh mã 846514-B21 với LQ310_EPSON",
  );
  assert.equal(ambiguous.product_context_status, "vague");
  assert.equal(ambiguous.selected_product_model_code, null);
  assert.equal(ambiguous.product_candidates_summary.length, 2);

  console.log("Phase 0B product-switch regression tests: PASS");
}

runTests();
