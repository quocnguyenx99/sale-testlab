import { strict as assert } from "assert";
import { buildIdentityProfileFromPersona } from "../../runtime/conversationIdentity";
import { createEmptyMemory, updateMemorySlots } from "../../runtime/conversationMemory";
import {
  createEmptyConversationProgress,
  updateProgressFromCustomerMessage,
  updateProgressFromSaleMessage
} from "../../runtime/conversationProgressTracker";
import { processDealState } from "../../runtime/dealState";
import { rebuildRuntimeState, RuntimeRecoverySnapshot, toSafeRuntimeMemory } from "./runtimeRecovery";
import { SimulationMessage } from "./simulationSession";

function message(id: string, sender: "CUSTOMER" | "SALE", content: string): SimulationMessage {
  return { id, sender, content, createdAt: `2026-08-12T00:00:0${id}.000Z` };
}

function advance(
  memory: ReturnType<typeof createEmptyMemory>,
  progress: ReturnType<typeof createEmptyConversationProgress>,
  sender: "CUSTOMER" | "SALE",
  content: string
) {
  return sender === "SALE"
    ? { memory: updateMemorySlots(memory, content), progress: updateProgressFromSaleMessage(progress, content) }
    : { memory, progress: updateProgressFromCustomerMessage(progress, content) };
}

async function main(): Promise<void> {
  const messages = [
    message("1", "CUSTOMER", "Anh cần tư vấn một sản phẩm phù hợp."),
    message("2", "SALE", "Em tư vấn máy chủ HPE DL380 Gen11, có sẵn hàng."),
    message("3", "CUSTOMER", "Anh muốn xem thêm giá và cấu hình."),
    message("4", "SALE", "Chuyển sang máy in Epson LQ310, giá 4 triệu, còn hàng."),
    message("5", "CUSTOMER", "Mẫu Epson này bảo hành thế nào em?")
  ];

  let liveMemory = createEmptyMemory();
  let liveProgress = createEmptyConversationProgress();
  for (const turn of messages) {
    const next = advance(liveMemory, liveProgress, turn.sender, turn.content);
    liveMemory = next.memory;
    liveProgress = next.progress;
  }

  const identity = buildIdentityProfileFromPersona({ display_name: "Anh Minh", salutation_style: "anh-em" });
  const snapshot: RuntimeRecoverySnapshot = {
    version: 1,
    currentState: "pricing_phase",
    memory: toSafeRuntimeMemory(liveMemory),
    conversationProgress: liveProgress,
    identityProfile: identity,
    identitySource: "persona.salutation_style",
    personaSalutationStyle: "anh-em",
    recentFallbackVariantIds: ["price_2"],
    scenarioContext: {
      scenario_id: "printer_01",
      scenario_product: "máy in văn phòng",
      scenario_need: "mua thiết bị in ấn",
      scenario_priority: ["giá", "bảo hành"]
    }
  };

  const serialized = JSON.stringify(snapshot);
  assert(!/stock_qty|raw_model|prompt|guard_trigger|constraint/i.test(serialized));

  const recovered = rebuildRuntimeState(messages, JSON.parse(serialized) as RuntimeRecoverySnapshot);
  assert.equal(recovered.memorySlots.selected_product_model_code, "LQ310_EPSON");
  assert.deepEqual(recovered.conversationProgress, liveProgress);
  assert.equal(snapshot.identityProfile.customer_self_pronoun, identity.customer_self_pronoun);
  assert.equal(snapshot.currentState, "pricing_phase");
  assert.equal(recovered.turns.length, messages.length);

  const continuedSale = "Bảo hành 12 tháng và giao hôm nay được anh nhé.";
  const continuedCustomer = "Vậy em gửi báo giá giúp anh.";
  const liveAfterSale = advance(liveMemory, liveProgress, "SALE", continuedSale);
  const liveAfterCustomer = advance(liveAfterSale.memory, liveAfterSale.progress, "CUSTOMER", continuedCustomer);
  const recoveredAfterSale = advance(recovered.memorySlots, recovered.conversationProgress, "SALE", continuedSale);
  const recoveredAfterCustomer = advance(recoveredAfterSale.memory, recoveredAfterSale.progress, "CUSTOMER", continuedCustomer);

  assert.deepEqual(toSafeRuntimeMemory(recoveredAfterCustomer.memory), toSafeRuntimeMemory(liveAfterCustomer.memory));
  assert.deepEqual(recoveredAfterCustomer.progress, liveAfterCustomer.progress);

  const liveDeal = processDealState({
    progress: liveAfterCustomer.progress,
    recent_turns: [...recovered.turns, { role: "sale", text: continuedSale }, { role: "customer_ai", text: continuedCustomer }],
    completion_ready: false,
    missing_topics: []
  });
  const recoveredDeal = processDealState({
    progress: recoveredAfterCustomer.progress,
    recent_turns: [...recovered.turns, { role: "sale", text: continuedSale }, { role: "customer_ai", text: continuedCustomer }],
    completion_ready: false,
    missing_topics: []
  });
  assert.deepEqual(recoveredDeal, liveDeal);

  console.log("V3 hybrid runtime recovery characterization: PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
