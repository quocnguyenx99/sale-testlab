import * as fs from "fs";
import * as path from "path";

const PORT = 3012;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path: string, method: "GET" | "POST", body?: any): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function runScenarioA() {
  console.log("\n=== RUNNING SCENARIO A: Khách nam 'Anh Nam' ===");
  // tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}" | State: ${start.runtime_state}`);

  const turns = [
    "Dạ em chào anh Nam, mẫu laptop văn phòng ThinkPad T14 bên em cấu hình i5 RAM 16GB rất mượt cho Excel kế toán ạ.",
    "Giá mẫu này là 25 triệu anh nhé.",
    "Hàng sẵn trong kho giao ngay hôm nay được anh ạ.",
    "Bên em bảo hành chính hãng 12 tháng, có xuất hóa đơn VAT đầy đủ cho công ty mình luôn.",
    "Dạ chuyển khoản được anh nha.",
    "Dạ vậy anh Nam cho em xin thông tin xuất hóa đơn và địa chỉ để em giao hàng luôn nhé."
  ];

  for (let i = 0; i < turns.length; i++) {
    console.log(`\n--- Turn ${i + 1} ---`);
    console.log(`Sale: "${turns[i]}"`);
    const chat = await request("/api/chat", "POST", {
      sessionId,
      personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
      message: turns[i]
    });
    console.log(`Customer: "${chat.reply}" [Source: ${chat.reply_source}]`);
    console.log(`  State: ${chat.runtime_state} (Confidence: ${chat.state_confidence?.toFixed(2)})`);
    console.log(`  Progress: config=${chat.conversation_progress?.configuration?.answered}, price=${chat.conversation_progress?.price?.answered}, stock=${chat.conversation_progress?.stock?.answered}, delivery=${chat.conversation_progress?.delivery?.answered}, warranty=${chat.conversation_progress?.warranty?.answered}, invoice=${chat.conversation_progress?.invoice_or_document?.answered}, payment=${chat.conversation_progress?.payment?.answered}`);
    console.log(`  Next unresolved topic: ${chat.next_unresolved_topic}`);
    console.log(`  Identity: self=${chat.identity_profile?.customer_self_pronoun}, target=${chat.identity_profile?.customer_target_pronoun}, drift_detected=${chat.identity_drift_detected}, role_inversion=${chat.role_inversion_detected}`);
    console.log(`  Completion: ready=${chat.completion_ready}, reason=${chat.completion_reason}, missing=${JSON.stringify(chat.missing_topics)}, resolved=${JSON.stringify(chat.resolved_topics)}, action=${chat.recommended_action}`);
    console.log(`  Forced Reply: forced=${chat.completion_forced_reply}, variant_id=${chat.completion_variant_id}`);
    
    // Validate Scenario A requirements
    if (i === 1) {
      if (!chat.conversation_progress?.price?.answered) {
        console.log("⚠️ WARNING: price not detected as answered!");
      }
    }
  }
}

async function runScenarioB() {
  console.log("\n=== RUNNING SCENARIO B: Khách nữ 'Chị Lan' ===");
  // tp_013_013_repeated_product_comparison_behavior_price_sensitive_research_behavior_mixed_context_merged
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_013_013_repeated_product_comparison_behavior_price_sensitive_research_behavior_mixed_context_merged"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}" | State: ${start.runtime_state}`);

  const turns = [
    "Dạ em chào chị Lan ạ, bên em có mẫu ThinkPad T14 i5 RAM 16GB cực kỳ ổn định cho phòng kế toán, có hỗ trợ xuất hóa đơn công ty đầy đủ chị nhé.",
    "Mẫu này giá 25 triệu và đang sẵn hàng trong kho chị ạ."
  ];

  for (let i = 0; i < turns.length; i++) {
    console.log(`\n--- Turn ${i + 1} ---`);
    console.log(`Sale: "${turns[i]}"`);
    const chat = await request("/api/chat", "POST", {
      sessionId,
      personaId: "tp_013_013_repeated_product_comparison_behavior_price_sensitive_research_behavior_mixed_context_merged",
      message: turns[i]
    });
    console.log(`Customer: "${chat.reply}" [Source: ${chat.reply_source}]`);
    console.log(`  Identity: self=${chat.identity_profile?.customer_self_pronoun}, target=${chat.identity_profile?.customer_target_pronoun}, drift_detected=${chat.identity_drift_detected}, role_inversion=${chat.role_inversion_detected}`);
    
    // Check pronouns
    const replyNorm = (chat.reply || "").toLowerCase();
    if (replyNorm.includes("anh") && !replyNorm.includes("chị")) {
      console.log("❌ FAIL: Identity drift detected (Self referred as anh/Nam or targeted sale as other style)!");
    } else {
      console.log("✅ PASS: Correct gender lock.");
    }
  }
}

async function runScenarioC() {
  console.log("\n=== RUNNING SCENARIO C: Sale trả lời ngắn ===");
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}" | State: ${start.runtime_state}`);

  const shortReplies = [
    { key: "price", text: "25 anh" },
    { key: "stock", text: "còn anh" },
    { key: "delivery", text: "được anh" },
    { key: "warranty", text: "12 tháng anh" },
    { key: "invoice_or_document", text: "có hóa đơn anh" },
    { key: "payment", text: "chuyển khoản được anh" }
  ];

  for (const item of shortReplies) {
    console.log(`\nSale short reply: "${item.text}"`);
    const chat = await request("/api/chat", "POST", {
      sessionId,
      personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
      message: item.text
    });
    const answered = chat.conversation_progress?.[item.key]?.answered;
    console.log(`Customer: "${chat.reply}"`);
    console.log(`  Topic ${item.key} answered: ${answered}`);
    if (answered) {
      console.log(`✅ PASS: Correctly detected short answer for ${item.key}`);
    } else {
      console.log(`❌ FAIL: Failed to detect short answer for ${item.key}`);
    }
  }
}

async function runScenarioD() {
  console.log("\n=== RUNNING SCENARIO D: Proactive Sale info ===");
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}" | State: ${start.runtime_state}`);

  const proactiveMsg = "Dạ mẫu này i5 RAM 16GB, giá 25 triệu, còn 12 máy, giao hôm nay được, bảo hành 12 tháng, có xuất hóa đơn công ty và thanh toán chuyển khoản được anh.";
  console.log(`Sale proactive message: "${proactiveMsg}"`);

  const chat = await request("/api/chat", "POST", {
    sessionId,
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
    message: proactiveMsg
  });
  console.log(`Customer: "${chat.reply}"`);
  const progress = chat.conversation_progress;
  const allAnswered = progress?.configuration?.answered && progress?.price?.answered && progress?.stock?.answered && progress?.delivery?.answered && progress?.warranty?.answered && progress?.invoice_or_document?.answered && progress?.payment?.answered;
  console.log(`  All Answered: ${allAnswered}`);
  console.log(`  Progress detail:`, JSON.stringify(progress));
  console.log(`  Completion Ready: ${chat.completion_ready}`);
  if (allAnswered) {
    console.log("✅ PASS: Correctly resolved all proactive topics.");
  } else {
    console.log("❌ FAIL: Some proactive topics were missed.");
  }
}

async function runScenarioE() {
  console.log("\n=== RUNNING SCENARIO E: Repetition / free-form loop stress ===");
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}" | State: ${start.runtime_state}`);

  // Gửi Sale tin nhắn bình thường trước
  let chat = await request("/api/chat", "POST", {
    sessionId,
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
    message: "Dạ mẫu này i5 RAM 16GB giá 25 triệu ạ."
  });

  // Gửi Sale tin nhắn ngắn và lặp đi lặp lại câu hỏi để ép Customer AI rơi vào loop, 
  // hoặc mô phỏng logic bằng cách mô phỏng tin nhắn lặp từ AI.
  // Trong server.ts, genericLoopDetected được kích hoạt khi AI đưa ra câu hỏi generic trùng với các câu trước đó.
  // Ở đây, ta kiểm tra loop guard bằng cách gửi các câu lặp cho Sale để xem AI phản hồi có bị loop hoặc có kích hoạt guard không.
  // Hoặc ta gửi các câu hỏi lặp từ Sale:
  const loops = [
    "Dạ anh xem thêm mẫu nào khác được không em?",
    "Dạ anh xem thêm mẫu nào khác được không em?",
    "Dạ anh xem thêm mẫu nào khác được không em?"
  ];

  for (const msg of loops) {
    console.log(`Sale repeat: "${msg}"`);
    chat = await request("/api/chat", "POST", {
      sessionId,
      personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
      message: msg
    });
    console.log(`Customer: "${chat.reply}"`);
    console.log(`  repeated_freeform_loop: ${chat.repeated_freeform_loop}`);
    console.log(`  fallback_variant_id: ${chat.fallback_variant_id}`);
  }
}

async function runScenarioF() {
  console.log("\n=== RUNNING SCENARIO F: Completion / closing ===");
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}"`);

  // Báo toàn bộ thông tin
  const chat = await request("/api/chat", "POST", {
    sessionId,
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
    message: "Dạ ThinkPad T14 i5 RAM 16GB giá 25 triệu còn sẵn hàng, giao hôm nay được, bảo hành 12 tháng chính hãng, có xuất hóa đơn công ty và chuyển khoản được anh nha."
  });
  console.log(`Customer: "${chat.reply}"`);
  console.log(`  Completion Ready: ${chat.completion_ready}`);
  console.log(`  Missing: ${JSON.stringify(chat.missing_topics)}`);
  console.log(`  Resolved: ${JSON.stringify(chat.resolved_topics)}`);
  console.log(`  Action: ${chat.recommended_action}`);
  console.log(`  Forced Reply: forced=${chat.completion_forced_reply}, variant_id=${chat.completion_variant_id}`);
}

async function runScenarioG() {
  console.log("\n=== RUNNING SCENARIO G: Missing critical topic ===");
  
  console.log("\nCase 1: Sale chưa báo giá (price)");
  const start1 = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId1 = start1.sessionId;
  let chat1 = await request("/api/chat", "POST", {
    sessionId: sessionId1,
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
    message: "Dạ bên em còn mẫu i5 RAM 16GB, sẵn sàng giao trong ngày và bảo hành đầy đủ ạ."
  });
  console.log(`Customer: "${chat1.reply}"`);
  console.log(`  Completion Ready: ${chat1.completion_ready}`);
  console.log(`  Missing: ${JSON.stringify(chat1.missing_topics)}`);
  
  console.log("\nCase 2: Sale chưa báo tồn kho (stock)");
  const start2 = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId2 = start2.sessionId;
  let chat2 = await request("/api/chat", "POST", {
    sessionId: sessionId2,
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
    message: "Dạ mẫu i5 RAM 16GB bên em giá 25 triệu, bảo hành 12 tháng và hỗ trợ giao tận nơi ạ."
  });
  console.log(`Customer: "${chat2.reply}"`);
  console.log(`  Completion Ready: ${chat2.completion_ready}`);
  console.log(`  Missing: ${JSON.stringify(chat2.missing_topics)}`);
}

async function runScenarioH() {
  console.log("\n=== RUNNING SCENARIO H: Assistant-style / role inversion bait ===");
  const start = await request("/api/customer-start", "POST", {
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context"
  });
  let sessionId = start.sessionId;
  console.log(`[Customer start] Customer: "${start.reply}"`);

  // Gửi mồi câu lật vai
  const bait = "Dạ bên mình cần em hỗ trợ thêm thông tin gì cho dự án của mình không ạ? Tôi có thể hỗ trợ bạn tư vấn cấu hình chi tiết.";
  console.log(`Sale bait: "${bait}"`);
  
  const chat = await request("/api/chat", "POST", {
    sessionId,
    personaId: "tp_004_002_logistics_followup_tendency_high_frequency_operational_coordination_mixed_context",
    message: bait
  });
  console.log(`Customer: "${chat.reply}" [Source: ${chat.reply_source}]`);
  console.log(`  assistant_style_detected: ${chat.assistant_style_detected}`);
  console.log(`  role_inversion_detected: ${chat.role_inversion_detected}`);
  console.log(`  fallback_variant_id: ${chat.fallback_variant_id}`);
}

async function main() {
  try {
    await runScenarioA();
    await runScenarioB();
    await runScenarioC();
    await runScenarioD();
    await runScenarioE();
    await runScenarioF();
    await runScenarioG();
    await runScenarioH();
    console.log("\n=== ALL SCENARIOS EVALUATED ===");
  } catch (err: any) {
    console.error("QA error:", err.message);
  }
}

main();
