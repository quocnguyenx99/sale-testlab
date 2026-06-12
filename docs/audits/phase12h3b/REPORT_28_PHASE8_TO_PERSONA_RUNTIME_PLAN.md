# REPORT 28 - Phase 8 To Persona Runtime Plan

## 1. Trạng thái hiện tại đã xác nhận

- Phase 1 -> 7b deterministic chain: PASS
- Phase 8 sampled gate `5 archetypes`: PASS
- Phase 8c sampled gate `5x3`: PASS
- Phase 8c wider gate `10x3`: PASS
- Runtime Contract Phase 12H: giữ nguyên, chưa đổi
- `sale-testlab-data` vẫn local-only, không track git
- Working tree sạch trước khi tạo report này

Điểm quan trọng:

- `07_runtime_personas/2026-03` và `07b_persona_archetypes/2026-03` đã được regenerate mới
  vào ngày `2026-06-11`
- Artifact `10 / 10c / 10d / 11b` hiện có nhưng timestamp cũ hơn:
  `2026-05-15` và `2026-05-18`
- Nghĩa là nhánh training-persona/playground hiện đang lệch so với bộ `07/07b` mới nhất

## 2. Files đã inspect

- `package.json`
- `docs/RUNTIME_CONTRACT_PHASE12H.md`
- `docs/SESSION_HANDOFF_PHASE12H3B_IMPORT_PIPELINE.md`
- `docs/SESSION_HANDOFF_AFTER_PHASE12H_CONTRACT.md`
- `docs/audits/phase12h3b/PHASE12H3B_AUDIT_INDEX.md`
- `docs/audits/phase12h3b/REPORT_09_DETERMINISTIC_CHAIN_COMPLETE.md`
- `docs/audits/phase12h3b/REPORT_26_PHASE8C_CURRENT_STATUS_AND_NEXT_GATE_AUDIT.md`
- `docs/audits/phase12h3b/REPORT_27_PHASE8C_10X3_VALIDATION.md`
- `src/run-phase8.ts`
- `src/run-phase8c.ts`
- `src/run-phase10.ts`
- `src/run-phase10c.ts`
- `src/run-phase10d.ts`
- `src/run-phase11b.ts`
- `src/pipeline/trainingPersonaBuilder.ts`
- `src/pipeline/trainingPersonaIdentityBuilder.ts`
- `src/playground/server.ts`
- `src/runtime/runtimeSessionManager.ts`
- `git status -sb`
- metadata tồn tại của:
  - `sale-testlab-data/07_runtime_personas/2026-03`
  - `sale-testlab-data/07b_persona_archetypes/2026-03`
  - `sale-testlab-data/08_runtime_simulator/2026-03`
  - `sale-testlab-data/10_training_personas/2026-03`
  - `sale-testlab-data/10c_training_personas_clean/2026-03`
  - `sale-testlab-data/10d_training_personas_enriched/2026-03`
  - `sale-testlab-data/11b_playground_qa/2026-03`

## 3. Các phase runner tồn tại sau Phase 8c

Runner có trong source:

- `src/run-phase8.ts`
- `src/run-phase8c.ts`
- `src/run-phase10.ts`
- `src/run-phase10c.ts`
- `src/run-phase10d.ts`
- `src/run-phase11b.ts`

Runner không tồn tại:

- không có `src/run-phase8d.ts`
- không có `src/run-phase9*.ts`
- không có `src/run-phase11.ts`

Kết luận:

- Sau `8c`, codebase không định nghĩa Phase 8d hay Phase 9
- Nhánh tiếp theo trong source là `10 -> 10c -> 10d -> 11b`

## 4. Dependency graph thực tế

```text
00_raw -> 01 -> 02b -> 03 -> 04 -> 05 -> 05b -> 05c -> 06 -> 06c -> 07 -> 07b
                                                        |              |
                                                        |              +--> Phase 10
                                                        |                    -> Phase 10c
                                                        |                    -> Phase 10d
                                                        |                    -> Playground server
                                                        |                    -> Phase 11b
                                                        |
                                                        +--> Phase 8
                                                             -> Phase 8c
```

Diễn giải:

- `Phase 8` và `Phase 8c` là nhánh validation/runtime simulation dùng local AI
- `Phase 10/10c/10d/11b` là nhánh training-persona + playground integration
- `Phase 10` không lấy input từ `Phase 8` hay `8c`
- Input chính của `Phase 10` là `07b_persona_archetypes`

## 5. Mục đích từng phase sau 8c

### Phase 8

Mục đích:

- Chạy local-AI sample trên persona/archetype đã sanitize
- Kiểm tra local endpoint, privacy boundary, metadata-only artifact

Input:

- `07b_persona_archetypes/<month>/persona_archetypes.jsonl`
- hoặc `07_runtime_personas/<month>/runtime_personas.jsonl`

Output:

- `sale-testlab-data/08_runtime_simulator/<month>/...`

Vai trò:

- validation track
- không sinh artifact mà playground cần trực tiếp

### Phase 8c

Mục đích:

- Scenario-based runtime evaluation
- Kiểm tra state alignment, buyer_move, privacy, fallback/timeout

Input:

- tương tự Phase 8, hiện gate đang dùng `archetypes`

Output:

- `sale-testlab-data/08_runtime_simulator/<month>/gemma_eval_results.jsonl`
- `.../gemma_eval_summary.json`
- `.../gemma_eval_audit.json`

Vai trò:

- validation track
- không feed trực tiếp vào Phase 10

### Phase 10

Mục đích:

- Build `training_personas` từ `persona_archetypes`
- Map behavior/context thành training persona cấu trúc hóa

Input:

- `sale-testlab-data/07b_persona_archetypes/<month>/persona_archetypes.jsonl`

Output:

- `sale-testlab-data/10_training_personas/<month>/training_personas.jsonl`
- `.../training_persona_summary.json`
- `.../training_persona_audit.json`

Vai trò:

- bước đầu tạo persona cho huấn luyện/playground

### Phase 10c

Mục đích:

- Cleanup deterministic cho `training_personas`
- Merge duplicate cluster
- Exclude weak/duplicate persona
- Polish phrase, đảm bảo minimum closing conditions

Input:

- `sale-testlab-data/10_training_personas/<month>/training_personas.jsonl`

Output:

- `sale-testlab-data/10c_training_personas_clean/<month>/training_personas_clean.jsonl`
- `.../training_persona_clean_summary.json`
- `.../training_persona_clean_audit.json`

Vai trò:

- làm sạch persona trước khi enrich identity

### Phase 10d

Mục đích:

- Identity enrichment deterministic cho training persona
- Gắn `display_name`, `buyer_role`, `organization_type`, `product_interest_categories`,
  `purchase_context`, `salutation_style`
- Overwrite `role_prompt` bằng enriched prompt

Input:

- `sale-testlab-data/10c_training_personas_clean/<month>/training_personas_clean.jsonl`

Output:

- `sale-testlab-data/10d_training_personas_enriched/<month>/training_personas_enriched.jsonl`
- `.../training_persona_identity_summary.json`
- `.../training_persona_identity_audit.json`

Vai trò:

- đây là nguồn persona chính mà playground hiện đang đọc

### Phase 11b

Mục đích:

- QA/integration check cho playground sau khi có `10d`
- Kiểm tra:
  - API `/api/personas`
  - API `/api/customer-start`
  - API `/api/chat`
  - source playground có dùng `10d` làm primary hay không

Input:

- `sale-testlab-data/10d_training_personas_enriched/<month>/training_personas_enriched.jsonl`
- `.../training_persona_identity_summary.json`
- local playground API tại `http://localhost:3009`

Output:

- `sale-testlab-data/11b_playground_qa/<month>/playground_qa_report.json`
- `.../playground_qa_summary.json`

Vai trò:

- integration gate trước khi coi persona/playground branch là usable

## 6. Phase nào sinh runtime personas?

Sinh runtime personas:

- `Phase 7`
  - output: `sale-testlab-data/07_runtime_personas/<month>/runtime_personas.jsonl`

Sinh archetype gom nhóm từ runtime personas:

- `Phase 7b`
  - output: `sale-testlab-data/07b_persona_archetypes/<month>/persona_archetypes.jsonl`

Sinh training personas cho playground:

- `Phase 10 -> 10c -> 10d`

Kết luận:

- runtime personas gốc đã tồn tại từ `Phase 7`
- nhưng playground hiện tại không lấy `07_runtime_personas` làm source hiển thị chính
- playground đang ưu tiên `10d_training_personas_enriched`

## 7. Playground hiện cần artifact nào?

Từ `src/playground/server.ts`:

- primary source:
  - `sale-testlab-data/10d_training_personas_enriched/<month>/training_personas_enriched.jsonl`
  - `sale-testlab-data/10d_training_personas_enriched/<month>/training_persona_identity_summary.json`
- compatibility fallback:
  - `sale-testlab-data/07_runtime_personas/<month>/runtime_personas.jsonl`

API hiện tại:

- `/api/personas`
  - trả list persona từ `10d` enriched
- `/api/version`
  - trả `playground_version: "phase11-training-personas"`
- `/api/chat`
  - dùng enriched persona + runtime persona compatibility path
- `/api/customer-start`
  - dùng enriched persona opening path

Kết luận:

- artifact bắt buộc cho playground branch hiện tại là `10d`
- `07_runtime_personas` vẫn cần tồn tại để hỗ trợ runtime compatibility/state routing

## 8. Runtime personas đã sẵn sàng hay còn thiếu?

Trả lời ngắn:

- `07_runtime_personas`: đã có
- `07b_persona_archetypes`: đã có
- `10/10c/10d/11b`: có artifact cũ, nhưng hiện stale so với bộ `07/07b` regenerate mới

Metadata hiện tại:

- `07_runtime_personas/2026-03/runtime_personas.jsonl`
  - size `20,993,408 bytes`
  - modified `2026-06-11 10:54:40`
- `07b_persona_archetypes/2026-03/persona_archetypes.jsonl`
  - size `11,001,238 bytes`
  - modified `2026-06-11 11:08:58`
- `10_training_personas/2026-03/training_personas.jsonl`
  - modified `2026-05-15 10:40:13`
- `10c_training_personas_clean/2026-03/training_personas_clean.jsonl`
  - modified `2026-05-15 11:03:18`
- `10d_training_personas_enriched/2026-03/training_personas_enriched.jsonl`
  - modified `2026-05-15 11:09:15`
- `11b_playground_qa/2026-03/playground_qa_report.json`
  - modified `2026-05-18 16:13:02`

Kết luận chính:

- runtime personas gốc không thiếu
- nhưng persona branch dùng cho playground chưa được rebuild lại từ bộ `07b` mới
- vì vậy chưa nên coi `10d/11b` hiện tại là checkpoint cuối cùng cho tháng `2026-03`

## 9. Phase nào gọi Qwen/local AI?

### Gọi local AI trực tiếp

- `src/run-phase8.ts`
  - gọi `generateLocalAIReply(...)`
- `src/run-phase8c.ts`
  - gọi `generateLocalAIReply(...)`

### Gọi local AI gián tiếp qua local playground server

- `src/run-phase11b.ts`
  - gọi `http://localhost:3009/api/customer-start`
  - gọi `http://localhost:3009/api/chat`
  - local server tại `src/playground/server.ts` gọi `generateLocalAIReply(...)`

### Deterministic only

- `src/run-phase10.ts`
- `src/run-phase10c.ts`
- `src/run-phase10d.ts`

## 10. Phase nào có thể chạm dữ liệu nhạy cảm hơn?

### Mức cao hơn

- `Phase 8 / 8c`
  - dùng archetype/runtime persona sanitized
  - đã có privacy hardening
  - không ghi prompt/full reply/reasoning text

- `Phase 11b`
  - chạm enriched persona và playground API
  - không chạm raw Zalo trực tiếp
  - nhưng vì gọi `/api/chat` nên đi qua runtime prompt + model reply path
  - cần giữ metadata-only, không log reply text đầy đủ

### Mức vừa

- `Phase 10 / 10c / 10d`
  - không dùng raw/session trực tiếp
  - nhưng đang log sample persona config, role prompt, opening messages, behavior rules
  - đây là privacy risk với derived persona content

## 11. Memory risks hiện thấy

### Phase 8

- `src/run-phase8.ts`
  - có `readFileSync(..., "utf8").split(...)`
  - đọc full file cho input JSONL

Risk:

- với `archetypes` hiện nhỏ, chấp nhận được
- với `runtime_personas` lớn hơn, vẫn là pattern nên cần để ý nếu scale rộng

### Phase 8c

- `src/run-phase8c.ts`
  - cũng dùng `readFileSync(..., "utf8").split(...)`

Risk:

- gate hiện tại `10x3` vẫn ổn
- nhưng nếu scale lớn hơn hoặc chuyển source sang `runtime_personas`, nên audit tiếp

### Phase 10

- đọc line-by-line bằng `createReadStream + readline`
- nhưng tích toàn bộ `archetypes[]` vào memory
- output ghi bằng `map(...).join("\n")`

Risk:

- với input archetype hiện chỉ 38 record thì memory risk thấp
- pattern write vẫn không phải streaming

### Phase 10c

- đọc line-by-line
- giữ toàn bộ `allPersonas[]` và `cleanPersonas[]` trong memory
- output ghi bằng `map(...).join("\n")`

Risk:

- input hiện nhỏ, memory risk thấp
- chủ yếu là privacy/logging risk

### Phase 10d

- đọc line-by-line
- giữ toàn bộ `personas[]` và `enriched[]`
- output ghi bằng `map(...).join("\n")`

Risk:

- input hiện nhỏ
- memory risk thấp, privacy risk cao hơn do sample logs

### Phase 11b

- `readJsonl()` dùng `readFileSync(...).split(...)`
- `summaryFile` đọc bằng `readFileSync`

Risk:

- input `10d` hiện nhỏ
- memory risk thấp
- integration/local-AI side effect mới là risk chính

### Playground server

- `src/playground/server.ts`
  - đọc `10d` và `07` bằng `readFileSync(...).split(...)` ngay lúc startup

Risk:

- `10d` nhỏ
- `07_runtime_personas.jsonl` hiện ~20MB, vẫn ổn ở local desktop
- nhưng về pattern thì chưa hardened hoàn toàn nếu scale lớn hơn

## 12. Privacy risks hiện thấy

### Privacy risk rõ nhất cần xử lý trước khi chạy downstream

- `src/run-phase10.ts`
  - log top 10 training personas
  - log sample first 5 full configs
  - log `role_prompt`, `behavior_rules`, `opening_messages`, `sale_training_focus`

- `src/run-phase10c.ts`
  - log top 10 clean personas
  - log sample first 5 full configs
  - log `role_prompt`, `behavior_rules`, `opening_messages`, training focus

- `src/run-phase10d.ts`
  - log sample 10 enriched personas
  - log recommended playground personas by display name / name / product categories

### Privacy risk mức vừa

- `src/run-phase11b.ts`
  - đã mask message/reply text ở endpoint test record bằng `maskText(...)`
  - vẫn gọi local playground API nên phải giữ local-only

### Privacy note

- downstream phases này không mở raw Zalo
- nhưng derived persona text vẫn có thể chứa nội dung nhạy cảm nếu log ra console quá nhiều
- do đó trước khi execute, cần harden logging của `10/10c/10d`

## 13. Có cần Phase 8 full trước Phase 10 không?

Không có dependency code bắt buộc.

Kết luận:

- `Phase 10` lấy input từ `07b_persona_archetypes`
- `Phase 8/8c` là validation track song song
- `10/10c/10d/11b` có thể tiến hành tiếp mà không cần full-month `8c`

Tuy nhiên:

- full-scale `8c` vẫn là validation gate có giá trị
- nhưng không phải prerequisite để sinh persona/playground artifact

## 14. Safe execution order được khuyến nghị từ trạng thái hiện tại

### Mục tiêu

- làm mới nhánh persona/playground theo bộ `07/07b` mới nhất
- không scale full-month `8c` trước
- harden runner downstream trước khi chạy

### Thứ tự khuyến nghị

1. Audit/harden `src/run-phase10.ts`
2. Chạy `Phase 10` cho `2026-03`
3. Audit/harden `src/run-phase10c.ts`
4. Chạy `Phase 10c`
5. Audit/harden `src/run-phase10d.ts`
6. Chạy `Phase 10d`
7. Audit/harden `src/playground/server.ts` ở phần persona load nếu cần
8. Audit/harden `src/run-phase11b.ts`
9. Chỉ sau đó mới chạy `Phase 11b`
10. Sau `11b` PASS mới cân nhắc manual playground smoke test
11. Gate lớn hơn của `8c` như `20x3` là optional validation branch, không phải prerequisite

## 15. Commands nên chạy tiếp theo

Chưa chạy ngay trong task này. Khi được approve:

```bash
npx tsx src/run-phase10.ts --month=2026-03
npx tsx src/run-phase10c.ts --month=2026-03
npx tsx src/run-phase10d.ts --month=2026-03
```

Sau khi `10d` được harden và regenerate xong, mới tới:

```bash
npx tsx src/run-phase11b.ts --month=2026-03
```

Nếu cần mở playground thủ công:

```bash
npx tsx src/playground/server.ts
```

Lưu ý:

- `11b` phụ thuộc local server `localhost:3009`
- không nên chạy `11b` trước khi xác nhận source playground đang trỏ đúng `10d` mới

## 16. Commands không nên chạy ngay

Không nên chạy ngay:

- full-month `Phase 8c`
- `Phase 8c` wider gate hơn như `20x3` trước khi chốt nhánh `10/10c/10d/11b`
- bất kỳ `Phase 8d` hay `Phase 9` nào vì source không có
- `Phase 11b` trước khi harden `10/10c/10d`
- cleanup artifact
- bất kỳ command nào in prompt/full reply/reasoning text

## 17. Runtime personas đã playground-ready chưa?

Trả lời chính xác:

- `07_runtime_personas` đã đủ để nói rằng runtime persona artifact gốc đã được generate
- nhưng "playground-ready persona branch" theo code hiện tại chưa nên coi là up-to-date
  vì `10/10c/10d/11b` đang là artifact cũ hơn bộ `07/07b` mới

Nói cách khác:

- runtime persona gốc: `YES`
- playground-ready enriched persona branch cho tháng `2026-03`: `NOT YET REFRESHED`

## 18. Còn thiếu gì trước khi test playground bằng runtime/training personas?

Còn thiếu:

- harden privacy/logging cho `Phase 10`
- harden privacy/logging cho `Phase 10c`
- harden privacy/logging cho `Phase 10d`
- regenerate `10`, `10c`, `10d` từ bộ `07b` mới
- audit/harden `Phase 11b`
- rerun `11b` để xác nhận:
  - playground thực sự dùng `10d` mới
  - recommended persona ordering đúng
  - endpoint integration ổn
  - không có content leak qua log/artifact

## 19. Final recommendation

Kết luận ngắn:

- Không cần full-scale `8c` trước khi đi tiếp nhánh persona/playground
- Nhánh đúng tiếp theo trong source là:
  - `10 -> 10c -> 10d -> 11b`
- Việc cần làm ngay không phải chạy bừa `10/10c/10d/11b`
- Việc đúng là audit/harden runner downstream trước, vì:
  - `10/10c/10d` đang log derived persona content quá nhiều
  - `10/10c/10d/11b` artifact hiện tại đã stale so với `07/07b` mới

Khuyến nghị thực thi:

1. Audit/harden `run-phase10.ts`
2. Audit/harden `run-phase10c.ts`
3. Audit/harden `run-phase10d.ts`
4. Regenerate `10 -> 10c -> 10d`
5. Audit/harden `run-phase11b.ts`
6. Chạy `11b`
7. Sau khi `11b` PASS, mới coi branch persona/playground là sẵn sàng để test thực tế

Decision summary:

- Safe to continue after Phase 8c sampled validation: `YES`
- Safe to jump straight to full-month Phase 8c: `NO`
- Safe next path: `Phase 10 audit/hardening`
- Runtime personas already exist: `YES`
- Playground-ready enriched personas already refreshed for latest 2026-03 chain: `NO`
