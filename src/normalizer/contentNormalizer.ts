type ParsedMessage = {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content_type: string;
  text: string;
  raw_content: Record<string, unknown> | string | null;
  created_at: string;
};

export function normalizeContent(message: ParsedMessage): ParsedMessage {
  return {
    ...message,
    content_type: message.content_type || "unknown",
    text: (message.text || "").trim()
  };
}
