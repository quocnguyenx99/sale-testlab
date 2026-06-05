import { detectIdentityDrift } from "./runtime/conversationIdentity";

const identityProfile = {
  customer_self_pronoun: "anh" as const,
  customer_target_pronoun: "em" as const,
  sale_expected_self_pronoun: "em" as const,
  sale_expected_target_pronoun: "anh" as const,
  tone_style: "business_casual" as const,
  conversation_role: "customer_to_sales" as const
};

const reply = "Vậy em gửi giúp anh báo giá và cấu hình chi tiết nhé.";
let t = reply.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").replace(/\s+/g, " ").trim();
t = t.replace(/\bchi\s+tiet\b/g, "chi_tiet")
     .replace(/\bchi\s+phi\b/g, "chi_phi")
     .replace(/\bchi\s+nhanh\b/g, "chi_nhanh")
     .replace(/\btieng\s+anh\b/g, "tieng_anh")
     .replace(/\bhinh\s+anh\b/g, "hinh_anh")
     .replace(/\bphan\s+anh\b/g, "phan_anh")
     .replace(/\btre\s+em\b/g, "tre_em")
     .replace(/\bthong\s+minh\b/g, "thong_minh")
     .replace(/\bchung\s+minh\b/g, "chung_minh")
     .replace(/\bbinh\s+minh\b/g, "binh_minh")
     .replace(/\bcong\s+minh\b/g, "cong_minh");

const pronouns = ["anh", "chi", "em", "toi", "minh", "ban"].filter((p) => new RegExp(`\\b${p}\\b`).test(t));
const expectedSelf = "anh";
const expectedTarget = "em";
const disallowedRolePronouns = pronouns.filter((p) => p !== expectedSelf && p !== expectedTarget && p !== "minh");

console.log("Pronouns found:", pronouns);
console.log("Disallowed pronouns found:", disallowedRolePronouns);

