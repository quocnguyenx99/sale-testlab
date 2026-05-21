import * as fs from "fs";
import * as path from "path";

const MONTH = "2026-03";
const ENRICHED_FILE = path.join(process.cwd(), "sale-testlab-data", "10d_training_personas_enriched", MONTH, "training_personas_enriched.jsonl");

type EnrichedPersona = {
  persona_id: string;
  name: string;
  display_name: string;
  buyer_role: string;
  organization_type: string;
  salutation_style: string;
  purchase_context: string;
};

if (fs.existsSync(ENRICHED_FILE)) {
  const content = fs.readFileSync(ENRICHED_FILE, "utf8");
  const lines = content.split("\n").filter(Boolean);
  console.log(`Total personas found: ${lines.length}`);
  for (const line of lines) {
    const p = JSON.parse(line) as EnrichedPersona;
    console.log(`ID: ${p.persona_id} | Name: ${p.name} | Display: ${p.display_name} | Role: ${p.buyer_role} | Style: ${p.salutation_style}`);
    console.log(`  Context: ${p.purchase_context}`);
  }
} else {
  console.log("Enriched file not found!");
}
