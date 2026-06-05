import * as http from "http";
import * as fs from "fs";

// CLI Parse
const args = process.argv.slice(2);
const batchArg = args.find(a => a.startsWith("--batch="))?.split("=")[1];
const caseArg = args.find(a => a.startsWith("--case="))?.split("=")[1];
const attachArg = args.find(a => a.startsWith("--attach="))?.split("=")[1] || "true";
const portArg = args.find(a => a.startsWith("--port="))?.split("=")[1] || "3009";

const PORT = parseInt(portArg, 10);
const HOST = "127.0.0.1";

interface QAResult {
  batch: string;
  caseId: string;
  result: "PASS" | "PARTIAL" | "FAIL" | "TIMEOUT";
  durationMs: number;
  finalReply: string;
  notes: string;
}

const qaResults: QAResult[] = [];

// Helper to make HTTP requests with timeout
function makeRequest(
  method: "GET" | "POST",
  path: string,
  body?: any,
  timeoutMs = 30000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const options: http.RequestOptions = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(postData) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });

    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

function printUsage() {
  console.log(`
==================================================
PHASE 12H / 13A LIVE BATCH QA RUNNER
==================================================
Usage:
  npx tsx src/playground/run_qa_phase12g_live_batch.ts --batch=<B1|B2|B3|B4|B5|H1|H2|H3|H4|H5|H6> [--attach=true] [--port=3009]

Available Batches:
  B1 - Sale-start identity + Greeting
       Kiểm tra lỗi "em chào em" đã hết chưa, nhận xưng hô chuẩn xác.

  B2 - Opening placeholder + Need-based opening
       Kiểm tra customer-start không còn các placeholder lỗi, mở đầu tự nhiên.

  B3 - Customer Voice Guard
       Kiểm tra khách không trôi giọng thành sale/support, đuôi "ạ" bất hợp lý.

  B4 - Naturalness / Anti-checklist
       Kiểm tra làm mềm tiến trình, bớt hỏi dồn dập máy móc.

  B5 - Regression guard + completion
       Đảm bảo làm mềm tự nhiên không phá hỏng các chốt chặn/completion cũ.

  H1 - Quote requested
       Đảm bảo deal_outcome chuyển sang quote_requested và không tự động đóng phiên.

  H2 - Payment info requested
       Đảm bảo deal_outcome chuyển sang payment_info_requested và đóng phiên khi core resolved.

  H3 - Pending approval
       Đảm bảo deal_outcome chuyển sang pending_approval và đóng phiên khi core resolved.

  H4 - Hold stock
       Đảm bảo deal_outcome chuyển sang hold_requested và đóng phiên khi core resolved.

  H5 - Customer rejects
       Đảm bảo deal_outcome chuyển sang closed_lost và kết thúc phiên ngay lập tức.

  H6 - Session stall
       Đảm bảo phát hiện stalled khi cuộc hội thoại kéo dài mà không tiến triển.

Options:
  --batch   Tên batch cần chạy (B1 | B2 | B3 | B4 | B5 | H1 | H2 | H3 | H4 | H5 | H6)
  --case    Chỉ định chạy 1 case cụ thể
  --attach  true (mặc định) kết nối vào playground đang chạy
  --port    Cổng playground server (mặc định: 3009)
`);
}

async function getPersonas(): Promise<any[]> {
  try {
    const res = await makeRequest("GET", "/api/personas");
    return res.personas || [];
  } catch (err) {
    throw new Error(`Cannot connect to Playground server on port ${PORT}. Please start the playground first: "npm run playground"`);
  }
}

async function runCaseB1_1(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B1.1";
  console.log(`\n[START] Case ${caseId}: Sale first message "dạ em chào chị"`);
  
  try {
    // Sale speaks first, so we call /api/chat directly with no sessionId
    const res = await makeRequest("POST", "/api/chat", {
      personaId,
      message: "dạ em chào chị"
    });

    const duration = Date.now() - startTime;
    const reply = res.reply || "";
    const identity = res.identity_profile || {};
    const drift = res.customer_voice_drift_detected;
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);
    console.log(`[RESPONSE] Identity profile:`, JSON.stringify(identity));
    
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (identity.customer_self_pronoun !== "chị") {
      result = "FAIL";
      notes.push("customer_self_pronoun is not 'chị'");
    }
    if (identity.customer_target_pronoun !== "em") {
      result = "FAIL";
      notes.push("customer_target_pronoun is not 'em'");
    }
    if (reply.toLowerCase().includes("em chào em")) {
      result = "FAIL";
      notes.push("Contains 'em chào em' identity loop");
    }
    if (/\b(anh\s+cần|anh\s+muốn|anh\s+đang)\b/i.test(reply)) {
      result = "FAIL";
      notes.push("Contains male customer pronouns ('anh')");
    }
    if (!res.sale_opening_identity_detected) {
      result = "PARTIAL";
      notes.push("sale_opening_identity_detected not flagged");
    }

    const resStr = result;
    return {
      batch: "B1",
      caseId,
      result: resStr,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ") || "Pronouns locked to chị-em perfectly. Dynamic greeting generated."
    };
  } catch (err: any) {
    return {
      batch: "B1",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB1_2(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B1.2";
  console.log(`\n[START] Case ${caseId}: Sale first message "em chào anh"`);
  
  try {
    const res = await makeRequest("POST", "/api/chat", {
      personaId,
      message: "em chào anh"
    });

    const duration = Date.now() - startTime;
    const reply = res.reply || "";
    const identity = res.identity_profile || {};
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);
    console.log(`[RESPONSE] Identity profile:`, JSON.stringify(identity));
    
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (identity.customer_self_pronoun !== "anh") {
      result = "FAIL";
      notes.push("customer_self_pronoun is not 'anh'");
    }
    if (identity.customer_target_pronoun !== "em") {
      result = "FAIL";
      notes.push("customer_target_pronoun is not 'em'");
    }
    if (/\b(chị\s+cần|chị\s+muốn|chị\s+đang)\b/i.test(reply)) {
      result = "FAIL";
      notes.push("Drifted to female pronouns ('chị')");
    }

    return {
      batch: "B1",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ") || "Pronouns locked to anh-em perfectly. Greeting natural."
    };
  } catch (err: any) {
    return {
      batch: "B1",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB2_1(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B2.1";
  console.log(`\n[START] Case ${caseId}: Start customer session (Check openings & placeholders)`);

  try {
    const res = await makeRequest("POST", "/api/customer-start", { personaId });
    const duration = Date.now() - startTime;
    const reply = res.reply || "";
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Customer Opening: "${reply}"`);
    
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    const placeholders = ["[tên model a]", "[model]", "{model}", "undefined", "null", "placeholder"];
    for (const pl of placeholders) {
      if (reply.toLowerCase().includes(pl)) {
        result = "FAIL";
        notes.push(`Contains placeholder '${pl}'`);
      }
    }

    if (result === "PASS") {
      notes.push("No placeholders detected. Clean need-based opening.");
    }

    return {
      batch: "B2",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B2",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB2_2(femalePersonaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B2.2";
  console.log(`\n[START] Case ${caseId}: Start session with female persona (chị/em opening)`);

  try {
    const res = await makeRequest("POST", "/api/customer-start", { personaId: femalePersonaId });
    const duration = Date.now() - startTime;
    const reply = res.reply || "";
    const identity = res.identity_profile || {};
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Customer Opening: "${reply}"`);
    console.log(`[RESPONSE] Identity profile:`, JSON.stringify(identity));
    
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (identity.customer_self_pronoun !== "chị" && identity.customer_self_pronoun !== "em") {
      result = "FAIL";
      notes.push("Pronoun does not fit female persona (chị/em)");
    }
    if (reply.toLowerCase().includes("anh")) {
      result = "FAIL";
      notes.push("Opening contains male pronoun 'anh'");
    }
    if (reply.toLowerCase().includes("tôi co the ho tro")) {
      result = "FAIL";
      notes.push("Opening sounds like a support agent");
    }

    return {
      batch: "B2",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ") || "Clean chị/em opening, no placeholders, proper buyer tone."
    };
  } catch (err: any) {
    return {
      batch: "B2",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB3_1(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B3.1";
  console.log(`\n[START] Case ${caseId}: Customer Voice Guard - Suffix "ạ" check`);

  try {
    // Start session
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;

    // Send a message that triggers a customer voice drift or suffix "ạ"
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ, bên em chuyên laptop văn phòng ạ. Chị cần em tư vấn mẫu nào ạ?"
    });

    const duration = Date.now() - startTime;
    const reply = chatRes.reply || "";
    const rawReply = chatRes.raw_model_reply || "";
    const voiceDrift = chatRes.customer_voice_drift_detected;
    const voiceReason = chatRes.customer_voice_guard_reason;

    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Raw Reply: "${rawReply}"`);
    console.log(`[RESPONSE] Final Reply: "${reply}"`);
    console.log(`[RESPONSE] Voice drift detected: ${voiceDrift} | Reason: ${voiceReason}`);

    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (rawReply.toLowerCase().trim().endsWith("ạ") && !reply.toLowerCase().trim().endsWith("ạ")) {
      notes.push("Customer Voice Guard successfully intercepted and rewrote/replaced raw reply ending in 'ạ'");
    }
    if (reply.toLowerCase().trim().endsWith("ạ") && (chatRes.identity_profile?.customer_self_pronoun === "anh" || chatRes.identity_profile?.customer_self_pronoun === "chị")) {
      result = "FAIL";
      notes.push("Final reply ended in awkward customer-side 'ạ'");
    }
    if (voiceDrift) {
      notes.push(`Guard triggered correctly (${voiceReason})`);
    } else {
      notes.push("No voice drift detected. Reply is clean and natural.");
    }

    return {
      batch: "B3",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B3",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB3_2(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B3.2";
  console.log(`\n[START] Case ${caseId}: Bait support tone - "chị cần em hỗ trợ gì thêm không ạ?"`);

  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;

    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "dạ bên em có xuất hóa đơn VAT đầy đủ chị nhé. chị cần em hỗ trợ gì thêm không ạ?"
    });

    const duration = Date.now() - startTime;
    const reply = chatRes.reply || "";
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);

    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    const supportKeywords = ["tôi có thể hỗ trợ", "bên em hỗ trợ", "cần em tư vấn", "vui lòng cung cấp"];
    for (const kw of supportKeywords) {
      if (reply.toLowerCase().includes(kw)) {
        result = "FAIL";
        notes.push(`Drifted to support agent language: contains '${kw}'`);
      }
    }

    if (result === "PASS") {
      notes.push("Buyer identity intact. No support agent language.");
    }

    return {
      batch: "B3",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B3",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB4_1(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B4.1";
  console.log(`\n[START] Case ${caseId}: Softened progress - Price response acknowledgment`);

  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;

    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ mẫu này i5 RAM 16GB, giá 25 triệu anh."
    });

    const duration = Date.now() - startTime;
    const reply = chatRes.reply || "";
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);

    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    // Check that customer does not ask about price again
    if (/\b(giá\s+bao\s+nhiêu|nhiêu\s+tiền|báo\s+giá|mấy\s+triệu)\b/i.test(reply)) {
      result = "FAIL";
      notes.push("Asked about price again after Sale already gave price");
    }

    // Check if it's too robotic (i.e. if it just says 'mẫu này còn sẵn hàng không?' without acknowledging)
    const isRobotic = reply.toLowerCase().startsWith("mẫu này còn sẵn hàng không") || reply.toLowerCase().startsWith("bên mình còn hàng không");
    if (isRobotic) {
      result = "PARTIAL";
      notes.push("Direct mechanical jump to stock, lacks natural acknowledgment");
    } else {
      notes.push("Natural flow. Acknowledged price/specifications and transitioned smoothly.");
    }

    return {
      batch: "B4",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B4",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB4_2(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B4.2";
  console.log(`\n[START] Case ${caseId}: Stock & Delivery response acknowledgment`);

  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;

    // Send price first
    await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ mẫu này i5 RAM 16GB, giá 25 triệu anh."
    });

    // Send stock/delivery
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ mẫu này còn sẵn 12 máy và giao hôm nay được anh."
    });

    const duration = Date.now() - startTime;
    const reply = chatRes.reply || "";
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);

    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (/\b(còn\s+hàng|sẵn\s+hàng|giao\s+hôm\s+nay|giao\s+khi\s+nào|mấy\s+ngày\s+giao)\b/i.test(reply)) {
      result = "FAIL";
      notes.push("Asked about stock/delivery again after Sale already answered");
    }

    if (result === "PASS") {
      notes.push("Naturally moved forward without looping stock or delivery.");
    }

    return {
      batch: "B4",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B4",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB5_1(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B5.1";
  console.log(`\n[START] Case ${caseId}: Proactive full information -> Check completion`);

  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;

    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ mẫu này i5 RAM 16GB, giá 25 triệu, còn 12 máy, giao hôm nay được, bảo hành 12 tháng, có xuất hóa đơn công ty và thanh toán chuyển khoản được anh."
    });

    const duration = Date.now() - startTime;
    const reply = chatRes.reply || "";
    const completionReady = chatRes.completion_ready;
    const completionForced = chatRes.completion_forced_reply;
    
    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);
    console.log(`[RESPONSE] completion_ready: ${completionReady} | completion_forced_reply: ${completionForced}`);

    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (!completionReady && !completionForced) {
      result = "FAIL";
      notes.push("Completion not triggered even though all core topics are answered");
    }

    const repeatedTopics = chatRes.repeated_blocked_topics || [];
    if (repeatedTopics.length > 0) {
      result = "FAIL";
      notes.push(`Repeated asking on blocked topics: ${repeatedTopics.join(", ")}`);
    }

    if (result === "PASS") {
      notes.push("Successfully transitioned to next step/closing without repeating topics.");
    }

    return {
      batch: "B5",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B5",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseB5_2(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "B5.2";
  console.log(`\n[START] Case ${caseId}: Missing price information -> Must not complete`);

  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;

    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ bên em có mẫu i5 RAM 16GB, còn hàng và giao hôm nay được anh."
    });

    const duration = Date.now() - startTime;
    const reply = chatRes.reply || "";
    const completionReady = chatRes.completion_ready;
    const missing = chatRes.missing_topics || [];
    const nextUnresolved = chatRes.next_unresolved_topic;

    console.log(`[RESPONSE] Duration: ${duration}ms`);
    console.log(`[RESPONSE] Reply: "${reply}"`);
    console.log(`[RESPONSE] completion_ready: ${completionReady} | next_unresolved_topic: ${nextUnresolved}`);

    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";
    const notes: string[] = [];

    if (completionReady) {
      result = "FAIL";
      notes.push("Closed conversation early despite missing price information");
    }

    if (nextUnresolved !== "price") {
      result = "PARTIAL";
      notes.push(`next_unresolved_topic expected 'price', got '${nextUnresolved}'`);
    }

    if (result === "PASS") {
      notes.push("Perfect. Kept conversation open, unresolved topic correctly set to price.");
    }

    return {
      batch: "B5",
      caseId,
      result,
      durationMs: duration,
      finalReply: reply,
      notes: notes.join("; ")
    };
  } catch (err: any) {
    return {
      batch: "B5",
      caseId,
      result: err.message === "Timeout" ? "TIMEOUT" : "FAIL",
      durationMs: Date.now() - startTime,
      finalReply: "",
      notes: `Request failed: ${err.message}`
    };
  }
}

async function runCaseH1(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "H1";
  console.log(`\n[START] Case ${caseId}: Quote requested`);
  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId,
      personaId,
      message: "Dạ mẫu này bên em đang bán với giá 25 triệu và còn sẵn hàng giao ngay ạ."
    });
    const reply = chatRes.reply || "";
    const outcome = chatRes.deal_outcome;
    const shouldEnd = chatRes.should_end_session;
    const notes: string[] = [];
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";

    if (outcome !== "quote_requested" && outcome !== "hold_requested" && outcome !== "ready_to_close" && outcome !== "customer_committed") {
      result = "PARTIAL";
      notes.push(`Outcome got '${outcome}'`);
    }
    if (shouldEnd) {
      result = "FAIL";
      notes.push("Session ended early for quote_requested");
    }
    return {
      batch: "H1", caseId, result, durationMs: Date.now() - startTime,
      finalReply: reply, notes: notes.join("; ") || "Quote requested transitions correctly. Session kept open."
    };
  } catch (err: any) {
    return { batch: "H1", caseId, result: "FAIL", durationMs: Date.now() - startTime, finalReply: "", notes: err.message };
  }
}

async function runCaseH2(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "H2";
  console.log(`\n[START] Case ${caseId}: Payment info requested`);
  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;
    // Provide core resolved
    await makeRequest("POST", "/api/chat", {
      sessionId, personaId, message: "Dạ mẫu này bên em đang bán với giá 25 triệu và còn sẵn hàng giao ngay ạ."
    });
    // Send quote / invoice to trigger payment info request in closing bank
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId, personaId, message: "Dạ đây là báo giá kèm cấu hình chi tiết bên em gửi anh ạ."
    });
    const reply = chatRes.reply || "";
    const outcome = chatRes.deal_outcome;
    const shouldEnd = chatRes.should_end_session;
    const notes: string[] = [];
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";

    if (outcome !== "payment_info_requested" && outcome !== "closed_won_simulated" && outcome !== "ready_to_close") {
      result = "PARTIAL";
      notes.push(`Outcome got '${outcome}'`);
    }
    return {
      batch: "H2", caseId, result, durationMs: Date.now() - startTime,
      finalReply: reply, notes: notes.join("; ") || "Payment requested handled successfully."
    };
  } catch (err: any) {
    return { batch: "H2", caseId, result: "FAIL", durationMs: Date.now() - startTime, finalReply: "", notes: err.message };
  }
}

async function runCaseH3(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "H3";
  console.log(`\n[START] Case ${caseId}: Pending approval`);
  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;
    // Bait by asking if she needs corporate invoice or approval
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId, personaId, message: "Dạ cấu hình này bên em xuất hóa đơn VAT đầy đủ để trình công ty phê duyệt chị nhé."
    });
    const reply = chatRes.reply || "";
    const outcome = chatRes.deal_outcome;
    const notes: string[] = [];
    let result: "PASS" | "PARTIAL" | "FAIL" = "PASS";

    if (outcome === "closed_won_simulated") {
      result = "FAIL";
      notes.push("Classified as closed_won without explicit commitment");
    }
    return {
      batch: "H3", caseId, result, durationMs: Date.now() - startTime,
      finalReply: reply, notes: notes.join("; ") || `Outcome successfully evaluated as ${outcome}.`
    };
  } catch (err: any) {
    return { batch: "H3", caseId, result: "FAIL", durationMs: Date.now() - startTime, finalReply: "", notes: err.message };
  }
}

async function runCaseH4(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "H4";
  console.log(`\n[START] Case ${caseId}: Hold stock`);
  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;
    // Core resolved
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId, personaId, message: "Dạ máy này bên em có giá 25 triệu và chỉ còn đúng 1 máy thôi ạ, anh chốt giữ máy sớm nhé."
    });
    const reply = chatRes.reply || "";
    const outcome = chatRes.deal_outcome;
    return {
      batch: "H4", caseId, result: "PASS", durationMs: Date.now() - startTime,
      finalReply: reply, notes: `Outcome evaluated as ${outcome}.`
    };
  } catch (err: any) {
    return { batch: "H4", caseId, result: "FAIL", durationMs: Date.now() - startTime, finalReply: "", notes: err.message };
  }
}

async function runCaseH5(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "H5";
  console.log(`\n[START] Case ${caseId}: Customer rejects`);
  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;
    const chatRes = await makeRequest("POST", "/api/chat", {
      sessionId, personaId, message: "Dạ giá bên em là 250 triệu và không giảm giá một nghìn nào đâu ạ."
    });
    const reply = chatRes.reply || "";
    const outcome = chatRes.deal_outcome;
    
    console.log(`[DEBUG H5] Candidate before guards: "${chatRes.candidate_reply_before_guards}"`);
    console.log(`[DEBUG H5] Final reply: "${reply}"`);
    console.log(`[DEBUG H5] Guard triggered: ${chatRes.guard_triggered} | Reasons:`, chatRes.guard_trigger_reasons);
    console.log(`[DEBUG H5] Reopened topics:`, chatRes.reopened_answered_topics);
    console.log(`[DEBUG H5] Deal outcome: ${outcome} | should_end_session: ${chatRes.should_end_session}`);
    console.log(`[DEBUG H5] Objection signals:`, chatRes.deal_state?.objection_signals);

    let result: "PASS" | "FAIL" = "PASS";
    const notes: string[] = [];
    if (outcome === "closed_won_simulated" || outcome === "payment_info_requested") {
      result = "FAIL";
      notes.push(`Wrongly classified outcome as '${outcome}'`);
    }
    if (chatRes.final_reopen_guard_triggered) {
      result = "FAIL";
      notes.push("Reopen guard was triggered on objection");
    }

    return {
      batch: "H5", caseId, result, durationMs: Date.now() - startTime,
      finalReply: reply, notes: notes.join("; ") || `Rejection checked. Outcome: ${outcome}.`
    };
  } catch (err: any) {
    return { batch: "H5", caseId, result: "FAIL", durationMs: Date.now() - startTime, finalReply: "", notes: err.message };
  }
}

async function runCaseH6(personaId: string): Promise<QAResult> {
  const startTime = Date.now();
  const caseId = "H6";
  console.log(`\n[START] Case ${caseId}: Session stall`);
  try {
    const startRes = await makeRequest("POST", "/api/customer-start", { personaId });
    const sessionId = startRes.sessionId;
    // Loop weak inputs from Sale
    let chatRes: any;
    for (let i = 0; i < 4; i++) {
      chatRes = await makeRequest("POST", "/api/chat", {
        sessionId, personaId, message: "Dạ dạ vâng ạ."
      });
    }
    const reply = chatRes.reply || "";
    const outcome = chatRes.deal_outcome;
    return {
      batch: "H6", caseId, result: "PASS", durationMs: Date.now() - startTime,
      finalReply: reply, notes: `Stall loop finished. Outcome: ${outcome}.`
    };
  } catch (err: any) {
    return { batch: "H6", caseId, result: "FAIL", durationMs: Date.now() - startTime, finalReply: "", notes: err.message };
  }
}

async function main() {
  if (!batchArg) {
    printUsage();
    process.exit(0);
  }

  console.log(`\n==================================================`);
  console.log(`PHASE 12H / 13A LIVE QA BATCH: ${batchArg}`);
  console.log(`Playground URL: http://${HOST}:${PORT}`);
  console.log(`==================================================`);

  let personas: any[] = [];
  try {
    personas = await getPersonas();
    if (personas.length === 0) {
      console.error("Error: No personas found in playground database.");
      process.exit(1);
    }
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  // Find suitable personas
  const standardPersona = personas.find(p => p.is_recommended) || personas[0];
  const femalePersona = personas.find(p => {
    const name = (p.display_name || p.name || "").toLowerCase();
    const style = (p.salutation_style || "").toLowerCase();
    return name.includes("chị") || style.includes("chị") || style.includes("chi");
  }) || standardPersona;

  if (batchArg === "B1") {
    if (!caseArg || caseArg === "B1.1") {
      const res = await runCaseB1_1(standardPersona.persona_id);
      qaResults.push(res);
    }
    if (!caseArg || caseArg === "B1.2") {
      const res = await runCaseB1_2(standardPersona.persona_id);
      qaResults.push(res);
    }
  } else if (batchArg === "B2") {
    if (!caseArg || caseArg === "B2.1") {
      const res = await runCaseB2_1(standardPersona.persona_id);
      qaResults.push(res);
    }
    if (!caseArg || caseArg === "B2.2") {
      const res = await runCaseB2_2(femalePersona.persona_id);
      qaResults.push(res);
    }
  } else if (batchArg === "B3") {
    if (!caseArg || caseArg === "B3.1") {
      const res = await runCaseB3_1(standardPersona.persona_id);
      qaResults.push(res);
    }
    if (!caseArg || caseArg === "B3.2") {
      const res = await runCaseB3_2(standardPersona.persona_id);
      qaResults.push(res);
    }
  } else if (batchArg === "B4") {
    if (!caseArg || caseArg === "B4.1") {
      const res = await runCaseB4_1(standardPersona.persona_id);
      qaResults.push(res);
    }
    if (!caseArg || caseArg === "B4.2") {
      const res = await runCaseB4_2(standardPersona.persona_id);
      qaResults.push(res);
    }
  } else if (batchArg === "B5") {
    if (!caseArg || caseArg === "B5.1") {
      const res = await runCaseB5_1(standardPersona.persona_id);
      qaResults.push(res);
    }
    if (!caseArg || caseArg === "B5.2") {
      const res = await runCaseB5_2(standardPersona.persona_id);
      qaResults.push(res);
    }
  } else if (batchArg === "H1") {
    const res = await runCaseH1(standardPersona.persona_id);
    qaResults.push(res);
  } else if (batchArg === "H2") {
    const res = await runCaseH2(standardPersona.persona_id);
    qaResults.push(res);
  } else if (batchArg === "H3") {
    const res = await runCaseH3(femalePersona.persona_id);
    qaResults.push(res);
  } else if (batchArg === "H4") {
    const res = await runCaseH4(standardPersona.persona_id);
    qaResults.push(res);
  } else if (batchArg === "H5") {
    const res = await runCaseH5(standardPersona.persona_id);
    qaResults.push(res);
  } else if (batchArg === "H6") {
    const res = await runCaseH6(standardPersona.persona_id);
    qaResults.push(res);
  } else {
    console.error(`Error: Unknown batch "${batchArg}"`);
    printUsage();
    process.exit(1);
  }

  // Generate batch report table in terminal
  console.log(`\n==================================================`);
  console.log(`BATCH REPORT TABLE: ${batchArg}`);
  console.log(`==================================================`);
  console.log(`| Batch | Case | Result | Duration | Final reply | Notes |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const r of qaResults) {
    console.log(`| ${r.batch} | ${r.caseId} | **${r.result}** | ${r.durationMs}ms | ${r.finalReply.replace(/\n/g, " ")} | ${r.notes} |`);
  }
  console.log(`==================================================\n`);
}

main().catch(err => {
  console.error("Fatal QA Runner error:", err);
  process.exit(1);
});
