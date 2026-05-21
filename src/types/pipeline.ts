export type ContentType =
  | "text"
  | "image"
  | "file"
  | "sticker"
  | "undo"
  | "bankcard"
  | "unknown";

export type ParseStatus =
  | "ok"
  | "content_json_failed"
  | "row_parse_failed";

export type MessageCategory =
  | "internal_operation"
  | "accounting"
  | "logistics"
  | "warehouse"
  | "sales"
  | "customer_support"
  | "casual_chat"
  | "media_only"
  | "noise"
  | "unknown";

export interface NormalizedMessage {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content_type: ContentType;
  text: string;
  raw_content: Record<string, unknown> | string | null;
  created_at: string;
  source_file: string;
  source_file_hash: string;
  month: string;
  parse_status: ParseStatus;
  parse_warnings: string[];
}

export interface ClassifiedMessage extends NormalizedMessage {
  message_category: MessageCategory;
  confidence: number;
  confidence_reason: string[];
  is_internal: boolean;
  is_noise: boolean;
  candidate_sales: boolean;
  persona_signal: boolean;
  filter_reason: string;
  matched_rules: string[];
}

export interface ClassificationSummary {
  total_messages: number;
  category_counts: Record<MessageCategory, number>;
  content_type_counts: Record<ContentType, number>;
  internal_count: number;
  noise_count: number;
  candidate_sales_count: number;
  persona_signal_count: number;
}
