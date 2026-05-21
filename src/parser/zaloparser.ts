export type ParsedRow = {
  conversation_id?: string;
  sender_id?: string;
  sender_name?: string;
  content?: string;
  created_at?: string;
  raw_content?: object | string | null;
  parse_status?: "ok" | "row_parse_failed";
  parse_warnings?: string[];
};

import * as fs from "fs";
import * as readline from "readline";

export async function parseZaloData(
  filePath: string,
  _fileHash: string,
  _month: string
): Promise<ParsedRow[]> {
  const rows: ParsedRow[] = [];
  let currentConversationId = "unknown_conversation";
  let blockIndex = 0;

  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("Conversation")) {
      currentConversationId = line;
      continue;
    }

    if (line === "SenderId | SenderName | Content | CreateAt") {
      continue;
    }

    if (!line.includes("|")) {
      continue;
    }
    
    blockIndex++;

    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 4) {
      rows.push({
        conversation_id: currentConversationId,
        sender_id: "",
        sender_name: "",
        content: line,
        created_at: "",
        raw_content: line,
        parse_status: "row_parse_failed",
        parse_warnings: ["Malformed row: not enough '|' columns"]
      });
      continue;
    }

    const sender_id = parts[0];
    const sender_name = parts[1];
    const content = parts.slice(2, parts.length - 1).join("|").trim();
    const created_at = parts[parts.length - 1];

    let raw_content: object | string | null = content;
    try {
      raw_content = JSON.parse(content) as object;
    } catch {
      raw_content = content;
    }

    rows.push({
      conversation_id: currentConversationId,
      sender_id,
      sender_name,
      content,
      created_at,
      raw_content,
      parse_status: "ok",
      parse_warnings: []
    });
  }

  return rows;
}
