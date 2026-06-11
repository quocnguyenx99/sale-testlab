# Phase 8 Qwen Content Compatibility Fix

## 1. Root Cause
- Root cause was not the endpoint host, timeout, or privacy sanitizer.
- The local Qwen endpoint previously returned a reasoning-only shape for the Phase 8 request path:
  - `choices[0].message.reasoning` existed
  - `choices[0].message.content` was `null`
- The adapter correctly rejected that as `invalid_response_format` because reasoning must not be treated as the final customer reply.
- The compatibility gap was request-side: the existing request path did not explicitly disable Qwen/vLLM thinking at the chat-template level.

## 2. Compatibility Tests Performed
### Test A — synthetic dummy compatibility call
- Synthetic prompt only, no project data.
- Metadata-only result: PASS
- Result after fix:
  - `ai_called = true`
  - `reply_source = local_ai_generated`
  - `content_type = string`
  - `content_length = 5`
  - `reasoning_type = undefined`
  - `reasoning_length = 0`
  - `finish_reason = stop`
  - `stop_reason = null`
  - `error_type = null`
  - non-empty final content: YES

### Test B — tiny Phase 8 sample with 1 archetype
- Command:
  - `npx tsx src/run-phase8.ts --month=2026-03 --input-source=archetypes --limit-records=1 --batch-size=1 --concurrency=1 --timeout-ms=30000 --retry-count=0 --metadata-only`
- Result: PASS

## 3. Request/Body Change Applied
Applied minimal compatibility fix in `src/runtime/localAIRuntimeAdapter.ts`:
- explicit non-streaming request remains in use: `stream = false`
- retained OpenAI-compatible `messages` array
- added guarded request option when thinking-disable is enabled:
  - `chat_template_kwargs: { enable_thinking: false }`
- did **not** accept reasoning as final answer
- did **not** weaken validator

Request metadata after fix:
- endpoint host class: `rfc1918`
- model name: `qwen3-8b`
- request body keys:
  - `model`
  - `temperature`
  - `top_p`
  - `max_tokens`
  - `stream`
  - `messages`
  - `chat_template_kwargs`
- stream enabled: `false`
- disable thinking requested: `true`
- response_format set: `null`
- messages format: `openai_chat_messages`

## 4. Files Changed
- `src/runtime/localAIRuntimeAdapter.ts`
- `src/run-phase8.ts`

## 5. Tiny Phase 8 Sample Result
- `selected_count`: 1
- `ai_called`: true
- `fallback_count`: 0
- `fallback_rate`: 0.0%
- `timeout_count`: 0
- `timeout_rate`: 0.0%
- `local_ai_generated_count`: 1
- `privacy_leak_detected`: false
- `blocked_fields_detected_count`: 0

Response metadata:
- `content_type`: `string`
- `content_length range`: `32..32`
- `reasoning_type`: `undefined`
- `reasoning_length range`: `0..0`
- `finish_reason/stop_reason`:
  - finish: `stop`
  - stop: `null`
- `error_type set`: `none`
- `parse_attempt_status`: `string_content`
- `missing_required_fields`: none

## 6. Output Artifacts
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_selection.json`
  - size: 338 bytes
- `sale-testlab-data/08_runtime_simulator/2026-03/runtime_simulation_audit.json`
  - size: 2194 bytes

## 7. Privacy / AI Status
- Prompt text written anywhere: NO
- Reply text written anywhere: NO
- Reasoning text written anywhere: NO
- Persona/archetype content printed: NO
- Qwen/local AI called: YES
- Phase 8c run: NO

## 8. Readiness Decision
- Safe to rerun 5-archetype Phase 8 sample: YES
- Phase 8c remains blocked: YES
- Reason:
  - compatibility fix is now validated on synthetic prompt and on a tiny real Phase 8 sample
  - Phase 8c should stay blocked until Phase 8 is rerun at 5 archetypes and remains stable

## 9. Blockers / Warnings
- Warning: endpoint response still includes top-level metadata keys like `prompt_text`, but no prompt text was printed or copied into Phase 8 outputs.
- Warning: this validation covers 1-archetype sample only; 5-archetype rerun is still required before Phase 8c.
