# REPORT 53 - CONTROL Guard Boundary False-Positive Audit

Timestamp: 2026-07-17

## Scope

- Commit tested: `846dc8f`.
- Production source changed: no. Variant D and all prompt-section work stopped.
- No additional Qwen calls were made: the existing 18-pair CONTROL rerun cannot identify a first
  modifying guard boundary from its current API metadata.
- External/cloud AI: not called. Full-12 and full-38: not run.

## Static runtime guard order

In `handleChatEnriched` the post-Qwen flow is interleaved rather than a simple pipeline:

1. `generateLocalAIReply` returns the original candidate.
2. Free-form repetition and early response-bank fallback can change the reply.
3. `detectRepeatedTopicAsking` and `detectReopenedAnsweredTopics` can select response-bank fallback.
4. `evaluateConversationCompletion` and `shouldForceCompletionReply` can force a closing fallback.
5. `applySafetyGuards` can repair identity/salutation/product context or force fallback.
6. Buyer-role lock can select response-bank fallback.
7. Final repeated-generic checks can alter final source.

Available final labels include `guard_trigger_reasons`, reopened-topic metadata, completion metadata,
ambiguous-model metadata, fallback variant/topic and final reply source. They do not identify the
snapshot immediately after each of the six boundaries above.

## Observer limitation

REPORT_52 established four CONTROL safe-candidate interventions, but its corrected observer captures
candidate and final only. A final reason list cannot prove which boundary changed an otherwise safe
candidate because multiple branches can run before the response is returned.

The requested exact-boundary observer must instrument a temporary copy of `handleChatEnriched` with
metadata-only snapshots after repetition, safety, completion, final guard and response-bank routing.
It must record session/turn pairing and never record text. Without that temporary instrumentation,
classifying an intervention as repetition, safety, completion or final-guard false positive would be
speculation.

## Synthetic observer requirement

The next temporary observer must pass label-only cases for safe preservation, candidate repetition,
state repetition, identity repair, completion override, final guard, true false positive, missing
metadata and pairing mismatch before any live CONTROL rerun.

## Patch decision

No repeatable guard defect is proven. No runtime patch is justified.

Do not touch:

- `safetyGuards.ts` guard policy
- buyer-role and salutation protections
- product-context/stock secrecy rules
- completion semantics
- response-bank policy

## Recommended next action

Create a temporary working copy of the runtime server, add boundary-only boolean/reason snapshots,
validate the observer synthetically, then rerun CONTROL six slots x three repetitions. Do not run
Variant D, a prompt patch, full-12 or full-38 beforehand.

## Verdict

`INCONCLUSIVE`
