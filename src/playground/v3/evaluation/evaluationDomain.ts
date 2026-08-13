import { z } from "zod";

export const EVALUATOR_VERSION = "testlab-evaluator-v1";

export type EvaluationCriterionKey =
  | "TOPIC_COVERAGE"
  | "NEEDS_DISCOVERY"
  | "PRODUCT_CONSULTATION"
  | "OBJECTION_HANDLING"
  | "COMMUNICATION"
  | "CLOSING";

export type EvaluationCriterionSource = "DETERMINISTIC" | "LLM" | "HYBRID";
export type EvaluationApplicability = "APPLICABLE" | "NOT_APPLICABLE";

export const QUALITATIVE_CRITERION_KEYS = ["NEEDS_DISCOVERY", "PRODUCT_CONSULTATION", "OBJECTION_HANDLING", "COMMUNICATION", "CLOSING"] as const;

export interface EvaluationCriterionDefinition {
  key: EvaluationCriterionKey;
  label: string;
  description: string;
  weight: number;
  source: EvaluationCriterionSource;
}

export const EVALUATION_RUBRIC: readonly EvaluationCriterionDefinition[] = [
  { key: "TOPIC_COVERAGE", label: "Độ bao phủ chủ đề", description: "Mức độ hoàn tất các chủ đề bán hàng được Runtime xác định.", weight: 25, source: "DETERMINISTIC" },
  { key: "NEEDS_DISCOVERY", label: "Khám phá nhu cầu", description: "Chất lượng câu hỏi và khả năng làm rõ nhu cầu thực tế.", weight: 20, source: "LLM" },
  { key: "PRODUCT_CONSULTATION", label: "Tư vấn sản phẩm", description: "Mức độ liên kết giải pháp với nhu cầu đã trao đổi.", weight: 20, source: "LLM" },
  { key: "OBJECTION_HANDLING", label: "Xử lý băn khoăn", description: "Khả năng ghi nhận và xử lý phản đối có thật trong hội thoại.", weight: 15, source: "LLM" },
  { key: "COMMUNICATION", label: "Giao tiếp", description: "Sự rõ ràng, mạch lạc và phù hợp vai trò bán hàng.", weight: 10, source: "LLM" },
  { key: "CLOSING", label: "Chốt bước tiếp theo", description: "Khả năng xác nhận cam kết hoặc bước tiếp theo khi có cơ hội.", weight: 10, source: "LLM" }
] as const;

export interface EvaluationInput {
  sessionId: string;
  persona: { displayName: string; role: string; customerType: string; summary: string };
  scenario: { title: string; description: string };
  mode: "CUSTOMER_FIRST" | "SALE_FIRST";
  turns: Array<{ sequence: number; sender: "CUSTOMER" | "SALE"; content: string }>;
  outcome: string;
  trainingStatus: string;
  resolvedTopics: string[];
  missingTopics: string[];
  signals: string[];
}

export interface EvaluatedCriterion {
  key: EvaluationCriterionKey;
  label: string;
  score: number | null;
  weight: number;
  effectiveWeight: number;
  source: EvaluationCriterionSource;
  applicability: EvaluationApplicability;
  summary: string;
  evidenceTurnSequences: number[];
}

export interface SessionEvaluationRecord {
  id: string;
  sessionId: string;
  evaluatorVersion: string;
  status: "COMPLETED" | "FAILED";
  overallScore: number | null;
  criteria: EvaluatedCriterion[];
  strengths: string[];
  improvementAreas: string[];
  failureCode: string | null;
  evaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const qualitativeCriterionSchema = z.object({
  key: z.enum(QUALITATIVE_CRITERION_KEYS),
  score: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(280),
  evidenceTurnSequences: z.array(z.number().int().positive()).max(8)
}).strict();

export const qualitativeEvaluationSchema = z.object({
  criteria: z.array(qualitativeCriterionSchema).max(5)
}).strict();

export type QualitativeEvaluation = z.infer<typeof qualitativeEvaluationSchema>;
