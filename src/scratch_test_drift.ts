import { detectIdentityDrift } from "./runtime/conversationIdentity";

const identityProfile = {
  customer_self_pronoun: "anh" as const,
  customer_target_pronoun: "em" as const,
  sale_expected_self_pronoun: "em" as const,
  sale_expected_target_pronoun: "anh" as const,
  tone_style: "business_casual" as const,
  conversation_role: "customer_to_sales" as const
};

const testCases = [
  "Vậy em gửi giúp anh báo giá và cấu hình chi tiết nhé.",
  "Anh đang cần check tiếng Anh của máy này.",
  "Hình ảnh của máy này có đẹp không em?",
  "Bên em có bán lẻ hay chỉ bán sỉ?",
  "Em hỗ trợ anh buổi tối nhé.",
  "Bàn phím này gõ êm không em?",
  "Chứng minh giúp anh.",
  "Gửi em thông tin cơ bản nhé."
];

for (const reply of testCases) {
  const result = detectIdentityDrift(reply, identityProfile);
  console.log(`Reply: "${reply}"`);
  console.log(`  drift_detected: ${result.identity_drift_detected}`);
  console.log(`  forbidden_matches:`, result.forbidden_phrase_matches);
  console.log("-----------------------------------------");
}
