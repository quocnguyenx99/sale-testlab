import * as fs from "fs";
import * as path from "path";
import { buildEnrichedRuntimePrompt } from "../runtime/runtimePromptBuilder";
import { generateLocalAIReply } from "../runtime/localAIRuntimeAdapter";
import { buildIdentityProfileFromPersona } from "../runtime/conversationIdentity";
import { createEmptyMemory } from "../runtime/conversationMemory";
import { createEmptyConversationProgress, ensureConversationProgress } from "../runtime/conversationProgressTracker";

interface EnrichedPersona {
  persona_id: string;
  source_archetype_id: string;
  name: string;
  display_name: string;
  buyer_role: string;
  organization_type: string;
  product_interest_categories: string[];
  purchase_context: string;
  salutation_style: string;
  difficulty: string;
  role_prompt: string;
  behavior_rules: string[];
  opening_messages: string[];
  likely_questions: string[];
  objection_patterns: string[];
  closing_conditions: string[];
  do_not_do: string[];
  evidence_summary: { core_behavior_patterns: string[] };
}

async function runSamples() {
  const MONTH = process.env.npm_config_month || "2026-03";
  const ENRICHED_FILE = path.join(
    process.cwd(),
    "sale-testlab-data",
    "10d_training_personas_enriched",
    MONTH,
    "training_personas_enriched.jsonl"
  );

  if (!fs.existsSync(ENRICHED_FILE)) {
    console.error(`Error: Enriched personas file not found at ${ENRICHED_FILE}`);
    process.exit(1);
  }

  // Load enriched personas
  const personas = fs.readFileSync(ENRICHED_FILE, "utf8")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as EnrichedPersona);

  if (personas.length === 0) {
    console.error("Error: No enriched personas found in file.");
    process.exit(1);
  }

  // Select a price-sensitive or standard recommended persona
  const ep = personas.find(p => p.salutation_style.includes("anh-em") || p.salutation_style.includes("chi-em")) || personas[0];
  console.log(`\nSelected Persona: ${ep.display_name} (${ep.buyer_role})`);

  // Ensure output logs folder exists and clean up old log file
  const logPath = "logs/qwen3_instrumentation_log.jsonl";
  const absoluteLogPath = path.join(process.cwd(), logPath);
  if (fs.existsSync(absoluteLogPath)) {
    fs.unlinkSync(absoluteLogPath);
  }

  // Configure environment variables for model execution
  process.env.ENABLE_MODEL_INSTRUMENTATION = "true";
  
  // Set default max tokens to 512 as requested
  if (!process.env.OPENAI_MAX_TOKENS) {
    process.env.OPENAI_MAX_TOKENS = "512";
  }

  const cases = [
    {
      name: "B1 sale-start",
      state: "uncertain_interest" as const,
      saleMessage: "em chào anh ạ, anh cần tìm laptop loại nào ạ?",
      recentMessages: ["Sale: em chào anh ạ, anh cần tìm laptop loại nào ạ?"],
      memory: createEmptyMemory(),
      progress: createEmptyConversationProgress()
    },
    {
      name: "B4 naturalness",
      state: "research_phase" as const,
      saleMessage: "dạ bên em có Dell Latitude 7420 i5 16GB SSD 256GB giá 12 triệu và HP ProBook 450 G8 giá 13 triệu. Anh đang làm việc văn phòng thì chọn Dell nhỏ gọn hơn ạ.",
      recentMessages: [
        "Khách AI: Chào bạn, mình cần mua laptop dùng văn phòng.",
        "Sale: Dạ chào anh, bên em có sẵn hàng nhiều dòng phù hợp lắm ạ.",
        "Khách AI: Tư vấn giúp mình cấu hình văn phòng cơ bản và so sánh vài mẫu được không?",
        "Sale: dạ bên em có Dell Latitude 7420 i5 16GB SSD 256GB giá 12 triệu và HP ProBook 450 G8 giá 13 triệu. Anh đang làm việc văn phòng thì chọn Dell nhỏ gọn hơn ạ."
      ],
      memory: {
        ...createEmptyMemory(),
        product_model_mentioned: true,
        configuration_discussed: true,
        price_discussed: true
      },
      progress: {
        ...createEmptyConversationProgress(),
        product_model: { requested: true, answered: true, confirmed: false },
        configuration: { requested: true, answered: true, confirmed: false },
        price: { requested: false, answered: true, confirmed: false }
      }
    },
    {
      name: "H2 payment",
      state: "payment_phase" as const,
      saleMessage: "dạ anh chuyển khoản cọc giúp em 500k qua Vietcombank STK 1029384756 chủ tài khoản NGUYEN VAN A nhé. Nhận được cọc em sẽ đóng máy giữ hàng cho anh ạ.",
      recentMessages: [
        "Khách AI: Ok em, vậy gửi stk thanh toán để anh cọc máy Dell Latitude 7420 nhé.",
        "Sale: dạ anh chuyển khoản cọc giúp em 500k qua Vietcombank STK 1029384756 chủ tài khoản NGUYEN VAN A nhé. Nhận được cọc em sẽ đóng máy giữ hàng cho anh ạ."
      ],
      memory: {
        ...createEmptyMemory(),
        product_model_mentioned: true,
        configuration_discussed: true,
        price_discussed: true,
        stock_discussed: true,
        payment_discussed: true
      },
      progress: {
        ...createEmptyConversationProgress(),
        product_model: { requested: true, answered: true, confirmed: true },
        configuration: { requested: true, answered: true, confirmed: true },
        price: { requested: true, answered: true, confirmed: true },
        stock: { requested: true, answered: true, confirmed: true },
        payment: { requested: true, answered: true, confirmed: false }
      }
    },
    {
      name: "H5 objection",
      state: "pricing_phase" as const,
      saleMessage: "dạ dòng này bên em đang bán đúng giá niêm yết là 15 triệu, hàng zin đẹp 99% bảo hành 12 tháng nên không giảm thêm được nữa anh ạ.",
      recentMessages: [
        "Khách AI: Mà mẫu này giá 15 triệu hơi cao so với ngân sách của anh chút, có giảm thêm được không em?",
        "Sale: dạ dòng này bên em đang bán đúng giá niêm yết là 15 triệu, hàng zin đẹp 99% bảo hành 12 tháng nên không giảm thêm được nữa anh ạ."
      ],
      memory: {
        ...createEmptyMemory(),
        product_model_mentioned: true,
        price_discussed: true
      },
      progress: {
        ...createEmptyConversationProgress(),
        product_model: { requested: true, answered: true, confirmed: false },
        price: { requested: true, answered: true, confirmed: false }
      }
    },
    {
      name: "manual product-unknown case",
      state: "pricing_phase" as const,
      saleMessage: "cụ thể anh cần chốt giá model nào anh he",
      recentMessages: [
        "Sale: em chào anh",
        "Khách AI: anh muốn chốt mức giá rõ hơn cho mẫu này, em báo giúp anh thêm một mức để so sánh nhé.",
        "Sale: cụ thể anh cần chốt giá model nào anh he"
      ],
      memory: {
        ...createEmptyMemory(),
        price_discussed: true
      },
      progress: {
        ...createEmptyConversationProgress(),
        // Model is not yet resolved! This tests product unknown
        product_model: { requested: false, answered: false, confirmed: false },
        price: { requested: true, answered: true, confirmed: false }
      }
    }
  ];

  console.log("\n==================================================");
  console.log("RUNNING 5 SCENARIOS FOR INSTRUMENTATION");
  console.log("==================================================\n");

  const results: any[] = [];

  for (const c of cases) {
    console.log(`>>> Running Case: ${c.name}`);

    const identity = buildIdentityProfileFromPersona(ep, c.recentMessages[0], false);
    
    const fullPrompt = buildEnrichedRuntimePrompt({
      persona: {
        role_prompt: ep.role_prompt,
        behavior_rules: ep.behavior_rules,
        product_interest_categories: ep.product_interest_categories,
        purchase_context: ep.purchase_context,
        closing_conditions: ep.closing_conditions,
        do_not_do: ep.do_not_do
      },
      runtimeState: c.state,
      recentMessages: c.recentMessages,
      memorySlots: c.memory,
      progress: ensureConversationProgress(c.progress),
      identity
    });

    const usedPatterns = ep.evidence_summary.core_behavior_patterns.slice(0, 4);
    const usedConstraints = ["avoid assistant tone", "buyer simulation"];

    // Make the model call
    const startLogSize = fs.existsSync(absoluteLogPath) 
      ? fs.readFileSync(absoluteLogPath, "utf8").split(/\r?\n/).filter(Boolean).length
      : 0;

    const replyResult = await generateLocalAIReply(fullPrompt, usedPatterns, usedConstraints);

    // Read the log entry appended for this call
    let logEntry: any = null;
    if (fs.existsSync(absoluteLogPath)) {
      const logs = fs.readFileSync(absoluteLogPath, "utf8").split(/\r?\n/).filter(Boolean);
      if (logs.length > startLogSize) {
        logEntry = JSON.parse(logs[logs.length - 1]);
      }
    }

    console.log(`Reply: "${replyResult.generated_reply}"`);
    console.log(`Source: ${replyResult.reply_source}`);
    if (logEntry) {
      console.log(`Tokens: prompt=${logEntry.usage.prompt_tokens}, completion=${logEntry.usage.completion_tokens}, total=${logEntry.usage.total_tokens}`);
      console.log(`Finish Reason: ${logEntry.finish_reason}, Content Null: ${logEntry.content_null}, Reasoning Present: ${logEntry.has_reasoning_field}`);
      results.push(logEntry);
    } else {
      console.log("Warning: No instrumentation log entry recorded for this call.");
    }
    console.log("--------------------------------------------------\n");
  }

  // Print final summary report
  if (results.length > 0) {
    const totalCompletion = results.reduce((acc, r) => acc + r.usage.completion_tokens, 0);
    const avgCompletion = totalCompletion / results.length;
    const maxCompletion = Math.max(...results.map(r => r.usage.completion_tokens));
    const anyLengthFinish = results.some(r => r.finish_reason === "length");
    const anyContentNull = results.some(r => r.content_null === "yes");
    const anyReasoning = results.some(r => r.has_reasoning_field === "yes");

    console.log("==================================================");
    console.log("INSTRUMENTATION SUMMARY REPORT");
    console.log("==================================================");
    console.log(`Average Completion Tokens: ${avgCompletion.toFixed(1)}`);
    console.log(`Max Completion Tokens: ${maxCompletion}`);
    console.log(`Any Finish Reason = Length: ${anyLengthFinish ? "YES" : "NO"}`);
    console.log(`Any Content Null: ${anyContentNull ? "YES" : "NO"}`);
    console.log(`Reasoning Appears: ${anyReasoning ? "YES" : "NO"}`);
    console.log(`Is max_tokens = 512 Enough: ${maxCompletion <= 512 ? "YES" : "NO"}`);
    console.log("==================================================\n");
  }
}

runSamples();
