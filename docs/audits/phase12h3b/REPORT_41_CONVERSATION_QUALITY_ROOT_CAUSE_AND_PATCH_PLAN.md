# REPORT 41 - Conversation Quality Root Cause And Patch Plan

Timestamp: 2026-06-29 16:58:40 +07:00

Git commit inspected: `54506229921864cb0dff8c82c3d0062f35b540d6`

Status:

- Source changed: NO
- Qwen/local AI called: NO
- `/api/chat` called: NO
- Scope: metadata-only audit

## 1. Current confirmed state

Source report: `REPORT_40_FULL_MARCH_LIVE_CONVERSATION_QUALITY_AUDIT.md`

Confirmed metrics:

- Personas audited: 38
- READY: 3
- REVIEW: 17
- FIX: 18
- Avg total quality score: 12.29 / 20
- Wrong or inconsistent salutation: 24
- Seller-like instead of buyer: 23
- Assistant/support tone: 23
- Low human naturalness: 27
- Repeated question or loop: 23
- Product context missing: 11
- Price context confusing: 13
- Stock context confusing: 23
- Delivery/warranty context confusing: 27
- Privacy issue: 0
- Raw stock leak: 0
- Prompt/reasoning visible: 0
- Full catalog dump: 0

High-level conclusion:

- Privacy and leakage controls are working.
- Product grounding exists, but quality control is still weak.
- Main blockers are buyer voice, salutation, loop handling, and late-turn grounding.
- Current weakness is mostly orchestration-side, not data-security-side.

## 2. Files inspected

Core files:

- `src/playground/server.ts`
- `src/runtime/runtimePromptBuilder.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/conversationIdentity.ts`
- `src/runtime/repetitionGuard.ts`
- `src/runtime/conversationMemory.ts`
- `src/runtime/conversationProgressTracker.ts`
- `src/runtime/conversationCompletion.ts`
- `src/runtime/runtimeSessionManager.ts`
- `src/runtime/customerOpeningBuilder.ts`

Related reports:

- `docs/audits/phase12h3b/REPORT_40_FULL_MARCH_LIVE_CONVERSATION_QUALITY_AUDIT.md`

## 3. Root-cause hypotheses

Primary hypothesis:

- Model output is not the only problem.
- Final reply quality is likely degraded by stacked fallback and rewrite layers.
- Prompt already contains strong buyer-side rules, but post-processing often overrides tone.

Secondary hypothesis:

- Product context extraction is adequate for many turns.
- Weakness appears when context stays vague or late-turn topic routing escalates too early.

Operational hypothesis:

- Current runtime prefers deterministic safety over conversational quality.
- This preserves privacy, but causes formal, repetitive, seller-adjacent wording.

## 4. Source mapping by issue cluster

### A. Salutation drift

Likely source areas:

- `src/runtime/conversationIdentity.ts`
- `src/playground/server.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`

Likely functions:

- `buildIdentityProfileFromPersona`
- `detectIdentityDrift`
- `repairPronounDrift`
- `runCustomerVoiceGuard`
- `rewriteVoiceDrift`
- `buildResponseBankReply`
- `applySafetyGuards`
- `handleChatEnriched`

Likely runtime cause:

- Persona salutation is inferred correctly in many cases.
- Drift likely happens after fallback or rewrite.
- Deterministic variants may ignore active identity nuance.

Why it can affect 24 slots:

- Same fallback bank is reused across many personas.
- One weak salutation pattern can fan out widely.

Smallest safe patch idea:

- Add stronger salutation lock at final reply stage.
- Make response bank render strictly from active identity profile.
- Block seller-style endings more narrowly before final fallback.

### B. Buyer voice drifting into seller/support-agent tone

Likely source areas:

- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/conversationCompletion.ts`
- `src/playground/server.ts`

Likely functions:

- `buildResponseBankReply`
- `gateResponseBankResult`
- `buildBuyerVoiceRepair`
- `applySafetyGuards`
- `buildCompletionReply`
- `handleChatEnriched`

Likely runtime cause:

- Voice bank contains rigid procedural phrasing.
- Completion replies are formal and task-oriented.
- Safety rewrites may fix drift but still sound like operator tone.

Why it can affect 23 slots:

- Any guard-triggered route can bypass natural Qwen reply.
- Same deterministic language appears across many sessions.

Smallest safe patch idea:

- Rewrite fallback bank toward short buyer-side requests.
- Reduce support-like wording in completion and repair branches.
- Keep safety triggers, but soften fallback phrasing.

### C. Low human naturalness

Likely source areas:

- `src/playground/server.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/repetitionGuard.ts`
- `src/runtime/conversationCompletion.ts`

Likely runtime cause:

- Too many deterministic overrides after model generation.
- Repeated bank variants create robotic cadence.
- Completion and loop recovery sound procedural.

Cause type estimate:

- Qwen only: unlikely
- Prompt only: unlikely
- Fallback/post-processing: likely primary
- Mixed prompt + post-processing: possible

Smallest safe patch idea:

- Keep model reply whenever safe.
- Narrow rewrite scope to severe violations only.
- Add lighter buyer-side fallback wording.

### D. Repeated question / loop

Likely source areas:

- `src/runtime/repetitionGuard.ts`
- `src/runtime/conversationProgressTracker.ts`
- `src/runtime/conversationCompletion.ts`
- `src/playground/server.ts`
- `src/runtime/responseBank.ts`

Likely functions:

- `detectRepeatedTopicAsking`
- `detectRepeatedFreeFormLoop`
- `buildDeterministicProgressionFallback`
- `detectReopenedAnsweredTopics`
- `shouldForceCompletionReply`
- `handleChatEnriched`

Likely runtime cause:

- Repetition detector works, but recovery output repeats banked intents.
- Progress may still flag unresolved topics after seller answered weakly.
- Completion forcing can redirect back into repeated ask patterns.

Whether bank/progress/memory likely involved:

- Response bank: yes
- Progress tracker: yes
- Memory: indirect
- Completion routing: yes

Smallest safe patch idea:

- Make progression fallback vary by last resolved topic.
- Prevent bank fallback from re-asking already-answered topics.
- Add stronger turn-to-turn anti-repeat check before final reply.

### E. Stock / delivery / warranty confusion

Likely source areas:

- `src/runtime/conversationMemory.ts`
- `src/runtime/conversationProgressTracker.ts`
- `src/runtime/runtimePromptBuilder.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/conversationCompletion.ts`
- `src/playground/server.ts`

Likely functions:

- `updateMemorySlots`
- `updateProgressFromSaleMessage`
- `buildEnrichedRuntimePrompt`
- `hasDeliveryAsMainQuestion`
- `buildModelConfigRedirect`
- `evaluateConversationCompletion`
- `buildCompletionReply`

Likely runtime cause:

- Product context can remain vague.
- Delivery and warranty are routed too early in some late turns.
- Completion logic pushes next-step behavior before context is fully stable.

Whether structured resource is missing:

- Yes, partially.
- Warranty and delivery are mostly prompt/guard logic.
- They are not fully grounded by structured resource rules.

Smallest safe patch idea:

- Improve late-turn topic gating using memory + progress together.
- Require stronger product specificity before delivery/warranty escalation.
- Keep stock secrecy unchanged.

## 5. Evidence summary by file/function

`src/runtime/runtimePromptBuilder.ts`

- Buyer calibration already exists.
- Product gating already exists.
- Anti-support rules already exist.
- Prompt is not empty; issue is likely downstream.

`src/playground/server.ts`

- Main orchestration layer for final reply.
- Contains many fallback and override paths.
- Highest-likelihood source of tone collapse.

`src/runtime/responseBank.ts`

- Contains reusable deterministic variants.
- Several variants are formal or procedural.
- Likely major source of buyer-tone drift.

`src/runtime/safetyGuards.ts`

- Protects privacy and stock leakage correctly.
- Repair strings are rigid.
- Likely improves safety while hurting naturalness.

`src/runtime/conversationIdentity.ts`

- Identity and pronoun checks are strong.
- Final drift still likely comes from post-model rewrites.

`src/runtime/repetitionGuard.ts`

- Loop detection exists.
- Recovery output is still repetitive.

`src/runtime/conversationCompletion.ts`

- Closing/completion logic is deterministic.
- Can produce operator-like phrasing in late turns.

`src/runtime/conversationMemory.ts`

- Product grounding is regex-driven and useful.
- Vague context still causes topic-routing weakness.

## 6. Risk analysis

Main risk if patching too broadly:

- Fixing tone by weakening guards may re-open privacy or stock leaks.

Main risk if patching too late in stack:

- Cosmetic prompt tuning alone will not fix deterministic fallback output.

Main risk if touching too many modules at once:

- Regressions will be hard to isolate.
- Existing Phase 12H safety guarantees may erode unnoticed.

Safest interpretation:

- Patch in layers.
- Start with buyer-role preservation in fallback and repair paths.
- Do not refactor prompt, memory, and completion together in one pass.

## 7. Staged patch plan

### Patch 1 - tune_salutation + buyer_role_lock

Goal:

- Reduce wrong salutation.
- Stop buyer reply from sounding like seller.

Likely files:

- `src/playground/server.ts`
- `src/runtime/conversationIdentity.ts`
- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`

Likely changes:

- Enforce identity-consistent rendering in fallback bank.
- Tighten final salutation validation before response return.
- Keep pronoun repair minimal.
- Block seller-style endings only when role is clearly wrong.

Expected impact:

- Top FIX slots improve first.
- Salutation and buyer-role errors should drop fastest.

Tests to run:

- Existing Phase 12H.3-A style regressions
- Existing buyer voice guard regressions
- Full March sampled live QA rerun

Acceptance criteria:

- wrong_or_inconsistent_salutation_count <= 8
- seller_like_instead_of_buyer_count <= 8
- assistant_or_support_agent_tone_count <= 8
- privacy_issue_count = 0
- raw_stock_leak_count = 0

### Patch 2 - anti_agent_like / buyer_voice calibration

Goal:

- Raise human buyer feel without removing guard safety.

Likely files:

- `src/runtime/responseBank.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/conversationCompletion.ts`
- `src/playground/server.ts`

Likely changes:

- Rewrite deterministic variants into shorter buyer asks.
- Reduce procedural verbs and support-like wording.
- Preserve strict fallback for severe violations only.

Expected impact:

- Tone becomes less robotic.
- REVIEW personas may move into READY.

Acceptance criteria:

- low_human_naturalness_count improves by at least 30%
- READY count >= 12
- FIX count <= 10
- no regression in privacy metrics

### Patch 3 - loop_guard / progression guard

Goal:

- Reduce repeated asks and stale topic cycling.

Likely files:

- `src/runtime/repetitionGuard.ts`
- `src/runtime/conversationProgressTracker.ts`
- `src/playground/server.ts`
- `src/runtime/responseBank.ts`

Likely changes:

- Improve anti-repeat fallback selection.
- Block repeated unresolved-topic asks after weak seller answer.
- Make progression fallback depend on recent topic history.

Expected impact:

- Lower loop count.
- Cleaner turn 3 and turn 4 transitions.

Acceptance criteria:

- repeated_question_or_loop_count <= 8
- confirmed loop-risk slots <= 2/8
- no regression in chat pass count

### Patch 4 - turn_3 / turn_4 stock-delivery-warranty grounding

Goal:

- Stabilize late-turn context without leaking stock quantity.

Likely files:

- `src/runtime/conversationMemory.ts`
- `src/runtime/conversationProgressTracker.ts`
- `src/runtime/runtimePromptBuilder.ts`
- `src/runtime/safetyGuards.ts`
- `src/runtime/conversationCompletion.ts`
- `src/playground/server.ts`

Likely changes:

- Strengthen product specificity gate before delivery/warranty escalation.
- Align next-topic routing with memory + progress.
- Keep stock secrecy and no raw quantity exposure.

Expected impact:

- Reduce confusing late-turn questions.
- Keep product grounding stable after seller answer.

Acceptance criteria:

- stock_context_confusing_count <= 10
- delivery_warranty_context_confusing_count <= 12
- product_context_wrong_count = 0
- raw_stock_leak_count = 0

## 8. Recommended first patch

Recommended first patch:

- Patch 1 first.

Reason:

- It targets the largest visible buyer-facing defects.
- It is safer than changing memory or completion logic first.
- It reduces salutation drift and seller-like tone without touching product-resource flow.

Recommended second patch:

- Patch 2 immediately after Patch 1.

Reason:

- REPORT_40 shows tone and naturalness are still the biggest demo blockers.
- Patch 2 can improve quality without relaxing privacy rules.

## 9. What not to touch yet

Do not change yet:

- `src/runtime/runtimePromptBuilder.ts` core product/privacy constraints
- Stock secrecy behavior
- Full completion contract
- `/api/chat` product knowledge loading path
- Runtime Contract Phase 12H documents
- Deterministic pipeline Phase 1-11 outputs

Do not do yet:

- Broad prompt rewrite
- Full response system refactor
- DB or FE coupling changes
- Full-month broader rerun before Patch 1 and 2

## 10. Safe execution order

Recommended order:

1. Patch 1
2. Re-run targeted style/live QA
3. Patch 2
4. Re-run REPORT_40-style conversation audit
5. Patch 3 only if loop count remains high
6. Patch 4 only if turn_3/turn_4 confusion remains material

## 11. Final recommendation

Current state:

- Safe for privacy review: yes
- Safe for internal technical demo: partial
- Safe for broader user-facing demo: not yet

Most likely first win:

- Improve fallback/render/orchestration tone.

Most likely wrong move:

- Tuning prompt only.

Pragmatic conclusion:

- Buyer voice and salutation quality should be fixed before DB/UI build-out.
- Current system is structurally usable, but conversation quality is still too noisy for a polished MVP demo.
