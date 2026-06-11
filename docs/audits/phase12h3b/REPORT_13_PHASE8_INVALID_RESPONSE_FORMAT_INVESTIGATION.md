# Phase 8 Invalid Response Format Investigation

## 1. Investigation Status
- Investigation status: PASS
- Phase 8c: NOT RUN
- Commit: NOT PERFORMED
- Push: NOT PERFORMED

## 2. Root Cause
- `invalid_response_format` is returned by `generateLocalAIReply(...)` in `src/runtime/localAIRuntimeAdapter.ts`.
- The exact fallback branch is triggered after `extractContentWithDiagnostics(...)` fails to extract a usable customer reply.
- Expected accepted output shape:
  - OpenAI-compatible `choices[0].message.content` as non-empty string, or
  - `choices[0].text` as non-empty string, or
  - `message.content` text parts array that can be safely joined.
- Tiny sample result shows the local endpoint returned:
  - `choices[0].message.reasoning` present as string
  - `choices[0].message.content = null`
- Therefore the adapter classified the response as `invalid_response_format`.
- Root cause summary:
  - Qwen/local endpoint is producing reasoning-only metadata in `message.reasoning`
  - no final answer in `message.content`
  - validator is correct to reject this for Phase 8 runtime output
  - consuming `reasoning` as final customer reply would be unsafe and would weaken the boundary

## 3. Files Changed
- `src/runtime/localAIRuntimeAdapter.ts`
- `src/run-phase8.ts`
- Existing dirty files remain:
  - `src/run-phase8c.ts`
  - `docs/audits/phase12h3b/REPORT_10_PHASE8_QWEN_PLAN.md`
  - `docs/audits/phase12h3b/REPORT_11_PHASE8_PRIVACY_HARDENING_DRY_RUN.md`
  - `docs/audits/phase12h3b/REPORT_12_PHASE8_REAL_SAMPLE.md`
  - `docs/audits/phase12h3b/REPORT_13_PHASE8_INVALID_RESPONSE_FORMAT_INVESTIGATION.md`

## 4. Diagnostics Added
Added metadata-only diagnostics:
- `response_shape_keys`
- `choice_keys`
- `message_keys`
- `content_type`
- `content_length`
- `trimmed_content_length`
- `starts_with_json_object`
- `starts_with_markdown_fence`
- `parse_attempt_status`
- `missing_required_fields`
- `error_type`
- `response_source`
- `model_name`
- `latency_ms`
- `reasoning_type`
- `reasoning_length`

No prompt text or full reply text is logged or written.

## 5. Tiny Sample Run
Command used:
- `npx tsx src/run-phase8.ts --month=2026-03 --input-source=archetypes --limit-records=1 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=0 --metadata-only`

Result:
- PASS/FAIL: FAIL
- `selected_count`: 1
- `ai_called`: true
- `fallback_count`: 1
- `fallback_rate`: 100.0%
- `timeout_count`: 0
- `timeout_rate`: 0.0%
- `privacy_leak_detected`: false
- `blocked_fields_detected_count`: 0

Diagnostics summary:
- `response_shape_keys`: `choices, created, id, kv_transfer_params, model, object, prompt_logprobs, prompt_routed_experts, prompt_text, prompt_token_ids, service_tier, system_fingerprint, usage`
- `choice_keys`: `finish_reason, index, logprobs, message, routed_experts, stop_reason, token_ids`
- `message_keys`: `annotations, audio, content, function_call, reasoning, refusal, role, tool_calls`
- `content_type`: `null`
- `content_length range`: `0..0`
- `trimmed_content_length range`: `0..0`
- `starts_with_json_object_count`: 0
- `starts_with_markdown_fence_count`: 0
- `parse_attempt_status`: `reasoning_only`
- `missing_required_fields`: `choices[0].message.content`
- `reasoning_type`: `string`
- `reasoning_length range`: `34..34`
- `error_type set`: `invalid_response_format`

Latency:
- min/avg/max: `238 / 238 / 238 ms`

## 6. Output Artifacts
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_selection.json`
  - size: 338 bytes
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_audit.json`
  - size: 2248 bytes

## 7. Privacy / AI Status
- Prompt text written anywhere: NO
- Full reply text written anywhere: NO
- Persona/archetype content printed: NO
- Qwen/local AI called: YES
- Phase 8c run: NO

## 8. Minimal Fix Decision
Recommended minimal fix:
- Do **not** accept `message.reasoning` as final customer reply.
- Keep current privacy boundary and keep rejecting reasoning-only responses.
- Treat this as a local model/endpoint response-shape issue.
- Next fix should target endpoint/request compatibility so final answer is emitted into `choices[0].message.content`.

Not recommended:
- using reasoning text as final reply
- storing raw reasoning text
- weakening validator to accept reasoning-only output

## 9. Readiness Decision
- Safe to rerun 5-archetype Phase 8 sample now: NO
- Safe to proceed to Phase 8c: NO
- Phase 8c remains blocked until the local endpoint returns valid `message.content` output or an equivalent accepted final-text field.

## 10. Blockers / Warnings
- Blocker: local endpoint returns reasoning-only response shape for this Phase 8 prompt path.
- Blocker: fallback rate did not improve; it remains 100% on the tiny sample.
- Warning: `prompt_text` appears as a top-level response key from the endpoint shape, but no prompt text was printed or copied into Phase 8 outputs.
