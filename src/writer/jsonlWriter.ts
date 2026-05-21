import * as fs from "fs";
import * as path from "path";

export async function writeJsonl(filePath: string, data: unknown[]): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const lines = data.map((item) => JSON.stringify(item)).join("\n");
  await fs.promises.writeFile(filePath, `${lines}\n`, "utf8");
}

export async function appendJsonl(filePath: string, data: unknown[]): Promise<void> {
  if (data.length === 0) return;
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const lines = data.map((item) => JSON.stringify(item)).join("\n");
  await fs.promises.appendFile(filePath, `${lines}\n`, "utf8");
}
