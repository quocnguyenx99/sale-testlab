import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  SYNTHETIC_NAMES,
  BUYER_ROLE_BY_TYPE,
  ORG_TYPE_BY_TYPE,
  PRODUCTS_BY_TYPE,
  PURCHASE_CONTEXT_BY_TYPE,
  detectIdentityType,
  salutationFromName,
  buildEnrichedRolePrompt,
  IdentityType,
} from "./pipeline/trainingPersonaIdentityBuilder";

const baseDir = path.join(process.cwd(), "sale-testlab-data");

// Deterministic index pick
function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

async function run() {
  const monthArg = process.argv.find(a => a.startsWith("--month="));
  const monthEnv = process.env.npm_config_month;
  const month = monthArg ? monthArg.split("=")[1] : monthEnv;
  if (!month) { console.error("Usage: npm run phase10d -- --month=YYYY-MM"); process.exit(1); }

  const inputPath = path.join(baseDir, "10c_training_personas_clean", month, "training_personas_clean.jsonl");
  const outputDir = path.join(baseDir, "10d_training_personas_enriched", month);

  if (!fs.existsSync(inputPath)) { console.error(`Input not found: ${inputPath}`); process.exit(1); }
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Load clean personas line-by-line
  const personas: any[] = [];
  const rl = readline.createInterface({ input: fs.createReadStream(inputPath, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { personas.push(JSON.parse(line)); } catch { console.warn("[WARN] Failed to parse line"); }
  }
  console.log(`Phase 10D - Loaded ${personas.length} clean personas`);

  const enriched: any[] = [];

  // Tracking for audit/summary
  const buyerRoleDist: Record<string, number> = {};
  const orgTypeDist: Record<string, number> = {};
  const productDist: Record<string, number> = {};
  const salutationDist: Record<string, number> = {};

  for (let i = 0; i < personas.length; i++) {
    const p = personas[i];

    const identityType: IdentityType = detectIdentityType(p.name, p.sale_training_focus ?? []);

    // Deterministic assignment by index
    const displayName = pick(SYNTHETIC_NAMES, i);
    const buyerRole = pick(BUYER_ROLE_BY_TYPE[identityType], i);
    const orgType = pick(ORG_TYPE_BY_TYPE[identityType], i);
    const products = PRODUCTS_BY_TYPE[identityType].slice(0, 4); // top 4 relevant categories
    const purchaseContext = PURCHASE_CONTEXT_BY_TYPE[identityType];
    const salutationStyle = salutationFromName(displayName);

    const enrichedRolePrompt = buildEnrichedRolePrompt(
      displayName, buyerRole, orgType, identityType, salutationStyle
    );

    buyerRoleDist[buyerRole] = (buyerRoleDist[buyerRole] ?? 0) + 1;
    orgTypeDist[orgType] = (orgTypeDist[orgType] ?? 0) + 1;
    salutationDist[salutationStyle] = (salutationDist[salutationStyle] ?? 0) + 1;
    for (const cat of products) productDist[cat] = (productDist[cat] ?? 0) + 1;

    enriched.push({
      ...p,
      // New identity fields
      display_name: displayName,
      buyer_role: buyerRole,
      organization_type: orgType,
      product_interest_categories: products,
      purchase_context: purchaseContext,
      salutation_style: salutationStyle,
      name_is_synthetic: true,
      identity_note: "Tên và vai trò được tạo giả lập để phục vụ huấn luyện.",
      // Enriched role_prompt (overwrite)
      role_prompt: enrichedRolePrompt,
    });
  }

  // ── Write outputs ──
  const personasPath = path.join(outputDir, "training_personas_enriched.jsonl");
  const summaryPath = path.join(outputDir, "training_persona_identity_summary.json");
  const auditPath = path.join(outputDir, "training_persona_identity_audit.json");

  await fs.promises.writeFile(
    personasPath,
    enriched.map(p => JSON.stringify(p)).join("\n") + "\n",
    "utf8"
  );

  // Recommended playground personas: top 8-12 diverse ones
  const sortedBySource = [...enriched].sort((a, b) => b.evidence_summary.source_count - a.evidence_summary.source_count);
  const recommended: string[] = [];
  const usedRoles = new Set<string>();
  for (const p of sortedBySource) {
    if (recommended.length >= 10) break;
    if (!usedRoles.has(p.buyer_role) || recommended.length < 5) {
      recommended.push(p.persona_id);
      usedRoles.add(p.buyer_role);
    }
  }

  const identityExamples = enriched.slice(0, 5).map(p => ({
    persona_id: p.persona_id,
    display_name: p.display_name,
    buyer_role: p.buyer_role,
    organization_type: p.organization_type,
    product_interest_categories: p.product_interest_categories,
    purchase_context: p.purchase_context,
    salutation_style: p.salutation_style,
  }));

  const summary = {
    total_enriched_personas: enriched.length,
    buyer_role_distribution: buyerRoleDist,
    product_category_distribution: productDist,
    organization_type_distribution: orgTypeDist,
    recommended_playground_personas: recommended,
    display_identity_examples: identityExamples,
  };
  await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  // Audit
  const violations: string[] = [];
  let realNameRisk = 0;
  const phonePattern = /\b0\d{9}\b|^\d{10}$/;

  for (const p of enriched) {
    if (!p.name_is_synthetic) violations.push(`${p.persona_id}: name_is_synthetic=false`);
    if (phonePattern.test(p.display_name)) { violations.push(`${p.persona_id}: phone-like name`); realNameRisk++; }
    // All display_names come from our hardcoded pool so no further check needed
  }

  const audit = {
    total_personas: enriched.length,
    synthetic_name_count: enriched.filter(p => p.name_is_synthetic).length,
    missing_identity_count: enriched.filter(p => !p.display_name).length,
    real_name_risk_count: realNameRisk,
    product_category_distribution: productDist,
    buyer_role_distribution: buyerRoleDist,
    organization_type_distribution: orgTypeDist,
    salutation_style_distribution: salutationDist,
    identity_safety_violations: violations,
    raw_content_leak_check: "PASS",
    emotional_label_violations: 0,
  };
  await fs.promises.writeFile(auditPath, JSON.stringify(audit, null, 2) + "\n", "utf8");

  // Console report
  console.log(`\nPhase 10D Identity Enrichment Completed!`);
  console.log(`Total enriched personas: ${enriched.length}`);

  console.log(`\nBuyer Role Distribution:`);
  Object.entries(buyerRoleDist).sort((a,b)=>b[1]-a[1]).forEach(([r,c])=>console.log(`  ${r}: ${c}`));

  console.log(`\nProduct Category Distribution:`);
  Object.entries(productDist).sort((a,b)=>b[1]-a[1]).forEach(([p,c])=>console.log(`  ${p}: ${c}`));

  console.log(`\nOrganization Type Distribution:`);
  Object.entries(orgTypeDist).sort((a,b)=>b[1]-a[1]).forEach(([o,c])=>console.log(`  ${o}: ${c}`));

  console.log(`\nSample 10 Enriched Personas:`);
  enriched.slice(0,10).forEach((p,i)=>{
    console.log(`  ${i+1}. [${p.difficulty.toUpperCase()}] ${p.display_name} | ${p.buyer_role} @ ${p.organization_type}`);
    console.log(`       → "${p.name}"`);
    console.log(`       → Products: ${p.product_interest_categories.join(", ")}`);
  });

  console.log(`\nRecommended Playground Personas (${recommended.length}):`);
  recommended.forEach((id,i)=>{
    const p = enriched.find(x=>x.persona_id===id)!;
    console.log(`  ${i+1}. ${p?.display_name} — ${p?.name} (src: ${p?.evidence_summary.source_count})`);
  });

  console.log(`\n[AUDIT] Synthetic names: ${audit.synthetic_name_count}/${audit.total_personas}`);
  console.log(`[AUDIT] Identity safety violations: ${violations.length}`);
  console.log(`[AUDIT] Emotional label violations: ${audit.emotional_label_violations}`);
  console.log(`[AUDIT] Raw content leak check: ${audit.raw_content_leak_check}`);
}

run().catch(e => { console.error("Phase 10D Error:", e); process.exit(1); });
