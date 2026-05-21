import * as fs from "fs";
import * as path from "path";

export async function writeManifest(filePath: string, manifest: unknown): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(manifest, null, 2), "utf8");
}

export async function readManifest(filePath: string): Promise<any | null> {
  try {
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    // Return null if malformed or inaccessible
  }
  return null;
}

export async function updateManifest(filePath: string, fileRecord: any): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  let existingManifest = await readManifest(filePath);
  
  if (!existingManifest) {
    existingManifest = {
      version: "1.0",
      processed_files: []
    };
  }
  
  const files: any[] = existingManifest.processed_files || [];
  const existingIdx = files.findIndex((f) => f.source_file === fileRecord.source_file);
  
  if (existingIdx !== -1) {
    files[existingIdx] = fileRecord;
  } else {
    files.push(fileRecord);
  }
  
  existingManifest.processed_files = files;
  await fs.promises.writeFile(filePath, JSON.stringify(existingManifest, null, 2), "utf8");
}
