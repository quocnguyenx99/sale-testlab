import { generateLocalAIReply } from "./runtime/localAIRuntimeAdapter";

async function testConnection() {
  console.log("Checking connection to Qwen3:8B at http://192.168.117.73:9001/v1/chat/completions...");
  
  try {
    const result = await generateLocalAIReply(
      "Xin chào, tôi là khách hàng. Tôi muốn hỏi cấu hình máy này thế nào?",
      ["test_pattern"],
      ["test_constraint"]
    );
    
    console.log("\n==================================================");
    console.log("CONNECTION SUCCESSFUL!");
    console.log("==================================================");
    console.log(`Source: ${result.reply_source}`);
    console.log(`Reply: "${result.generated_reply}"`);
    console.log(`Fallback Reason (if any): ${result.fallback_reason || "None"}`);
    console.log("==================================================\n");
  } catch (error) {
    console.error("\n==================================================");
    console.error("CONNECTION FAILED!");
    console.error("==================================================");
    console.error(error);
    console.error("==================================================\n");
  }
}

testConnection();
