# Sale TestLab Data Pipeline / AI Customer TestLab

Audit ngày `2026-05-22`

Mode: `READ-ONLY`

Phạm vi:

- đọc codebase
- đọc pipeline/runtime/playground/test
- không sửa code
- không chạy live QA
- không gọi model thật

---

## PHẦN 1 — Executive Summary

Dự án hiện đã vượt xa mức prototype pipeline đơn thuần.

- Pipeline dữ liệu đã chạy thực tế tới `11B`, có artifact cho `2026-03`.
- Runtime playground đã có khung Phase 12 khá đầy đủ: progress, identity lock, repetition
  guard, response bank, completion engine, metadata trace.
- Runtime hiện đủ để hardening tiếp ở lớp hội thoại.
- Chưa nên mở rộng lớn sang DB/FE đầy đủ trước khi chốt contract của `12H/13A`.
- Có thể bắt đầu chuẩn bị FE/DB MVP mỏng sau khi freeze schema session outcome.

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Data pipeline | Khá hoàn chỉnh | Có output thực tế từ `00_raw` đến `11B`, tháng chính là `2026-03` |
| Runtime Phase 12 | Đã hình thành rõ | Có các module guard/deterministic + local model adapter |
| Playground QA | Có nhưng chưa thống nhất | Có offline/live runner, có report tốt và report xấu từ các thời điểm khác nhau |
| Persona runtime | Dùng được cho training | Từ `2248` profiles rút xuống `16` enriched personas |
| DB/FE MVP | Chưa nên mở rộng mạnh | Cần chốt outcome/session contract trước |
| Phase 12H/13A readiness | Gần sẵn sàng | Nên làm tiếp, nhưng phải bổ sung deal-state schema trước |

Kết luận ngắn:

- Nên tiếp tục runtime trước.
- Nên vào `12H/13A` ngay, nhưng theo hướng schema-first + detector-first.
- FE/DB chỉ nên dựng lớp mỏng bọc quanh runtime sau khi chốt output session.

---

## PHẦN 2 — Project Structure Map

```text
sale-testlab-data-pipeline/
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── opencode.json
├── plan_detail/
│   ├── plan_001.md
│   ├── plan_002.md
│   ├── plan_003*.md
│   └── qa_001.md
├── sale-testlab-data/
│   ├── 00_raw/
│   ├── 01_normalized/
│   ├── 02_filtered/
│   ├── 03_sessions/
│   ├── 04_behavior/
│   ├── 05_aggregated/
│   ├── 05b_context/
│   ├── 05c_pruned/
│   ├── 06_persona_drafts/
│   ├── 06c_refined_personas/
│   ├── 07_runtime_personas/
│   ├── 07b_persona_archetypes/
│   ├── 08_runtime_simulator/
│   ├── 10_training_personas/
│   ├── 10c_training_personas_clean/
│   ├── 10d_training_personas_enriched/
│   ├── 11b_playground_qa/
│   ├── config/
│   ├── logs/
│   └── _backup/
└── src/
    ├── parser/
    ├── normalizer/
    ├── pipeline/
    ├── playground/
    ├── runtime/
    ├── types/
    ├── utils/
    ├── writer/
    └── run-phase*.ts
```

| Folder | Vai trò | Trạng thái | Ghi chú |
|---|---|---|---|
| `src/parser` | Parse raw Zalo | Có | Tối giản, line-based |
| `src/normalizer` | Normalize content | Có | Còn mỏng |
| `src/pipeline` | Core logic pipeline | Có | Là xương sống Phase 3-10 |
| `src/runtime` | Runtime Phase 12 | Có | Là phần giá trị cao nhất hiện tại |
| `src/playground` | HTTP playground + QA runners | Có | Dùng thật |
| `src/writer` | JSONL/manifest writer | Có | Hỗ trợ ingest |
| `src/utils` | Logger/hash | Có | Hạ tầng nhẹ |
| `sale-testlab-data/00_raw` | Raw private data | Có | Không nên động sâu |
| `sale-testlab-data/01..07` | Pipeline outputs | Có | Chạy thật cho `2026-03` |
| `sale-testlab-data/10..11b` | Training persona + QA | Có | Dùng cho playground |
| `sale-testlab-data/config` | Config data | Yếu | Các file đang rỗng |
| `sale-testlab-data/logs` | Manifest/log parse | Có | Phase 1 có log khá sạch |
| `plan_detail` | Ghi chú kế hoạch/audit cũ | Có | Hữu ích làm lịch sử kỹ thuật |

Nhận xét thêm:

- `README.md` đang trống.
- `sale-testlab-data/config` có `ai_batch_config.json`, `filter_keywords.json`,
  `persona_schema.json`, `privacy_rules.json`, `role_mapping.json` nhưng đều `0 bytes`.
- Repo hiện thiên mạnh về logic backend/local scripts, chưa có DB/FE app thật.

---

## PHẦN 3 — File-by-file Responsibility

| File | Vai trò | Được dùng ở đâu | Mức độ quan trọng | Rủi ro |
|---|---|---|---|---|
| `src/playground/server.ts` | HTTP server, session orchestration, prompt build, model call, guards, metadata | Playground runtime | Rất cao | God file |
| `src/runtime/conversationProgressTracker.ts` | Topic tracking `requested/answered/confirmed` | Chat runtime, tests | Rất cao | Regex cứng |
| `src/runtime/conversationIdentity.ts` | Pronoun lock, drift detection | Prompt + guard | Rất cao | Heuristic dễ lệch |
| `src/runtime/repetitionGuard.ts` | Block hỏi lại, detect generic loop/free-form loop | Guard layer | Cao | Regex/token heuristic |
| `src/runtime/conversationCompletion.ts` | Completion readiness, closing reply, reopen detection | Final reply override | Rất cao | Chưa có deal outcome thật |
| `src/runtime/responseBank.ts` | Deterministic fallback theo topic | Guard fallback | Cao | Template smell |
| `src/runtime/runtimePromptBuilder.ts` | Prompt build cho runtime persona/enriched persona | Model input | Rất cao | Prompt ngày càng dài |
| `src/runtime/runtimeConstraints.ts` | Runtime states, forbidden behaviors, assistant-style detect | Prompt + safety | Cao | Hardcode rules |
| `src/runtime/runtimeStateRouter.ts` | Keyword routing sang runtime state | Chat runtime | Cao | Keyword bias |
| `src/runtime/conversationMemory.ts` | Memory flags đã bàn tới topic nào | Prompt context | Trung bình | Chỉ boolean, nông |
| `src/runtime/localAIRuntimeAdapter.ts` | Gọi endpoint local model + fallback | Model integration | Rất cao | Phụ thuộc endpoint nội bộ |
| `src/runtime/productScenarioCatalog.ts` | Catalog scenario + opening templates | Customer-start | Cao | Hardcode toàn bộ |
| `src/runtime/customerOpeningBuilder.ts` | Match persona -> scenario -> opening | Customer-start | Cao | Score rule đơn giản |
| `src/playground/run_qa_phase12f_live.ts` | Live QA qua HTTP thật | Manual/live runtime QA | Cao | Có gọi model thật nếu chạy |
| `src/playground/run_qa_phase12f2_offline.ts` | Offline QA logic guard/completion/fallback | Logic QA | Cao | Không cover model behavior thật |
| `src/runtime/phase12f2.null-guard.regression.test.ts` | Null-safe progress/completion paths | Regression | Cao | Chỉ bảo vệ crash, không bảo vệ chất lượng |

Các root file quan trọng:

| File | Nhận xét |
|---|---|
| `package.json` | Có scripts cho phase runners và một phần tests, nhưng chưa cover hết `phase12e1`, `phase12f2.null-guard` |
| `tsconfig.json` | Strict mode bật |
| `AGENTS.md` | Quy tắc bảo mật/local-first khá rõ |
| `README.md` | Trống |
| `.gitignore` | Đã ignore `sale-testlab-data/` và `.env` |

Đặc biệt:

- `server.ts`: trung tâm orchestration runtime.
- `conversationProgressTracker.ts`: quyết định topic nào còn thiếu.
- `conversationIdentity.ts`: quyết định lock xưng hô.
- `repetitionGuard.ts`: chống loop.
- `conversationCompletion.ts`: bước chốt cuối, nhưng mới là completion chứ chưa là deal outcome.
- `responseBank.ts`: deterministic fallback theo topic.
- `runtimePromptBuilder.ts`: nơi gom persona + memory + progress + identity + scenario vào prompt.
- `localAIRuntimeAdapter.ts`: adapter cho local endpoint kiểu OpenAI-compatible.
- `run_qa_phase12f_live.ts`: live QA theo case.
- `run_qa_phase12f2_offline.ts`: offline QA logic runtime.
- `phase12f2.null-guard.regression.test.ts`: regression bảo vệ null/missing progress state.

---

## PHẦN 4 — Architecture Flow Hiện Tại

Runtime flow hiện tại trong `src/playground/server.ts`:

```text
/api/customer-start
  -> load enriched persona
  -> choose scenario from productScenarioCatalog
  -> build opening
  -> build identity_profile
  -> init memory_slots
  -> init conversation_progress
  -> save session
  -> return opening + metadata

/api/chat
  -> load session / create session
  -> update memory_slots from sale message
  -> update conversation_progress from sale message
  -> route runtime_state
  -> build enriched runtime prompt
  -> generate local AI candidate
  -> anti-repeat regenerate
  -> assistant-style guard
  -> greeting guard
  -> repeated-topic / generic-loop / free-form-loop guard
  -> reopened-answered-topic guard
  -> evaluate completion
  -> completion reply override
  -> identity drift guard
  -> final forced completion guard
  -> update progress from customer reply
  -> persist session
  -> return reply + debug metadata
```

ASCII flow:

```text
/api/chat
  -> session init/load
  -> update progress
  -> update memory
  -> state router
  -> prompt builder
  -> model candidate
  -> assistant/repetition/identity guards
  -> response bank fallback
  -> completion engine
  -> final reopen/final_guard
  -> final reply
  -> metadata payload
```

Điểm quan trọng:

- Deterministic layer rất mạnh.
- Model chỉ là 1 bước trong pipeline reply.
- Metadata trả ra nhiều: `progress_before`, `progress_after`, `identity_profile`,
  `completion_ready`, `guard_trigger_reasons`, `fallback_variant_id`, `completion_variant_id`.

---

## PHẦN 5 — Phase 12 Breakdown

| Phase | Mục tiêu | Module/File | Trạng thái | Ghi chú |
|---|---|---|---|---|
| 12C | Progress tracking | `src/runtime/conversationProgressTracker.ts` | Đã có | Track topic theo `requested/answered/confirmed` |
| 12D | Identity lock | `src/runtime/conversationIdentity.ts` | Đã có | Lock xưng hô + drift detect |
| 12E | Response bank | `src/runtime/responseBank.ts` | Đã có | Fallback theo topic |
| 12E.1 | Stabilization | `src/runtime/phase12e1.regression.test.ts` | Đã có | Nữ xưng hô, proactive info, free-form loop |
| 12F | Completion engine | `src/runtime/conversationCompletion.ts` | Đã có | `completion_ready`, `recommended_action`, closing bank |
| 12F.2 | Live/runtime hardening | `src/playground/server.ts`, `src/runtime/phase12f2.regression.test.ts`, `src/runtime/phase12f2.null-guard.regression.test.ts` | Đã có | Reopen detection, null-safe, final guard |
| 12F.3 | Không thấy file riêng | Không rõ | Chưa tách riêng | Có thể đã gộp vào `12F.2` |

Phân loại theo cơ chế:

| Nhóm | Thành phần |
|---|---|
| Deterministic guard | progress tracker, identity drift, repetition guard, reopen detect, completion evaluator |
| Model-generated | `generateLocalAIReply()` trong `src/runtime/localAIRuntimeAdapter.ts` |
| Fallback/template | response bank, closing bank, deterministic local fallback |
| Metadata/debug | `raw_model_reply`, `candidate_reply_before_guards`, `guard_trigger_reasons`, `completion_reason` |

Nhận xét:

- Phase 12 hiện thiên mạnh về "reply control".
- Chưa có "deal control" thật sự.
- `completion_ready` mới là "đủ thông tin để chốt bước tiếp", chưa phải "khách đã chốt".

---

## PHẦN 6 — Test & QA Coverage

| Test file/runner | Kiểm tra gì | Có gọi model thật không | Khi nào dùng |
|---|---|---|---|
| `src/runtime/phase12cd.regression.test.ts` | price answered, repeated topic block, generic fallback loop, identity drift | Không | Sau đổi progress/identity |
| `src/runtime/phase12e.regression.test.ts` | response bank naturalness, topic transition | Không | Sau đổi fallback bank |
| `src/runtime/phase12e1.regression.test.ts` | female identity, short answers, proactive sale info, free-form loop | Không | Sau đổi stabilization rules |
| `src/runtime/phase12f.regression.test.ts` | completion readiness, forced closing, female closing pronouns | Không | Sau đổi completion engine |
| `src/runtime/phase12f2.regression.test.ts` | reopened answered topics, proactive full info, false positive guard | Không | Sau đổi reopen/final guard |
| `src/runtime/phase12f2.null-guard.regression.test.ts` | null-safe init, null next topic, broken progress object | Không | Sau sửa crash risk |
| `src/playground/run_qa_phase12f2_offline.ts` | Mô phỏng offline end-to-end logic guard/completion | Không | Logic QA nhanh |
| `src/playground/run_qa_phase12f_live.ts` | Live HTTP QA qua playground server | Có | Hardening runtime thật |
| `src/playground/run_live_qa.ts` | Manual/live scenario runner | Có | Debug integration |
| `src/playground/run_qa_scenarios.ts` | Scenario logic nhỏ, nhanh | Không | Smoke logic cục bộ |

Offline QA dùng để test logic gì:

- progress resolution
- memory update
- identity lock
- response bank
- completion forcing
- reopen detection
- repetition guard

Live QA dùng để test gì:

- wiring thật của `/api/customer-start` và `/api/chat`
- interplay giữa prompt, model, guard, fallback
- latency, assistant-style drift, payload metadata
- regression chỉ xuất hiện khi model thật sinh câu tự do

Manual QA dùng để test gì:

- cảm giác hội thoại
- persona voice
- độ tự nhiên
- edge cases khó mô tả bằng assert

Thứ tự nên chạy test:

1. `test:phase12cd`
2. `test:phase12e`
3. `phase12e1`
4. `test:phase12f`
5. `test:phase12f2`
6. `phase12f2.null-guard`
7. `run_qa_phase12f2_offline.ts`
8. `run_qa_phase12f_live.ts` khi đã duyệt endpoint local
9. manual playground QA

Lưu ý audit hiện tại:

- Tôi không chạy test.
- Repo có dấu hiệu tồn tại 2 lớp báo cáo QA khác nhau:
  - `sale-testlab-data/11b_playground_qa/2026-03/playground_qa_report.json` khá tích cực
  - `plan_detail/qa_001.md` ghi nhận nhiều lỗi nặng ở thời điểm trước
- Kết luận: QA history đã có tiến triển, nhưng không thể coi runtime đã ổn tuyệt đối.

---

## PHẦN 7 — Current Strengths

- Pipeline chạy thật trên dữ liệu tháng `2026-03`, không còn là skeleton.
- Phase 1 có manifest/hash/incremental ingestion khá an toàn.
- Pipeline có audit/summary ở gần như mọi stage.
- Privacy posture nhìn chung đúng hướng local-first.
- Runtime Phase 12 có tách module tương đối rõ.
- Completion engine đã tồn tại và đã có regression test riêng.
- Identity lock đã có both build profile và drift detect.
- Repetition guard đã tiến từ regex generic sang có free-form loop detect.
- Null guard regression thể hiện team đã va chạm crash edge case thật.
- Payload debug từ playground server khá giàu, thuận tiện follow-up.

Các điểm mạnh thực chứng:

- `manifest_2026-03.json` cho thấy đã ingest `10` raw files, file lớn nhất ~`32MB`.
- `03_sessions` có `25,269` sessions từ `206,101` messages.
- `2248` entities được aggregate.
- Từ đó lọc còn `192` runtime personas approved.
- Cuối cùng rút về `16` enriched training personas để playground dùng.

---

## PHẦN 8 — Current Weaknesses / Technical Debt

| Risk | Severity | Impact | Recommended Fix |
|---|---|---|---|
| `server.ts` là God file | Cao | Khó harden, khó test, khó thêm 12H/13A | Tách `session service`, `guard pipeline`, `response composer` |
| Progress tracker regex cứng | Cao | Bỏ sót câu trả lời ngắn/proactive | Chuyển topic detectors sang config/rule tables |
| Completion != deal outcome | Cao | Khóa phiên sai hoặc chốt giả | Thêm `deal_state` riêng |
| Scenario/product catalog hardcode | Cao | Không scale theo domain mới | Tách data file + loader |
| Response/closing bank còn template | Trung bình-Cao | Persona voice nông | Sinh bank theo persona family/config |
| Identity heuristic còn rule-based | Trung bình-Cao | Drift xưng hô edge cases | Chuẩn hóa identity schema per persona/session |
| Memory chỉ boolean | Trung bình | Không biết giá nào, model nào, delivery nào | Nâng lên typed slots |
| Runtime state router keyword-based | Trung bình | Route sai state khi sales nói dài/phức tạp | Hybrid scorer hoặc classifier local nhẹ |
| Config folder rỗng | Cao | Nhiều thứ lẽ ra data-driven vẫn hardcode trong code | Bắt đầu chuyển rules/config ra JSON |
| QA reports thiếu thống nhất | Trung bình | Khó biết baseline thật | Freeze một test matrix chuẩn |
| Local model endpoint phụ thuộc nội bộ | Trung bình | Live QA không ổn định | Standardize adapter + endpoint contract |
| README trống | Thấp-Trung bình | Onboarding kém | Viết technical README/AUDIT.md |

Technical debt rõ nhất:

1. `server.ts` đang làm quá nhiều.
2. Nhiều regex/rule nằm hardcode rải rác trong runtime.
3. Chưa có contract outcome/session result.
4. Chưa có persistent storage/session history layer.
5. Chưa có persona/scenario config externalized.

---

## PHẦN 9 — Hardcoded vs Data-driven Analysis

| Thành phần | Hiện tại | Hardcode hay data-driven? | Có thể mở rộng từ raw Zalo không? | Cách mở rộng |
|---|---|---|---|---|
| `productScenarioCatalog` | Catalog scenario + opening templates | Hardcode | Có, một phần | Sinh scenario families từ product/category frequency |
| customer opening | Chọn theo scenario + hash | Nửa hardcode | Có | Rút opening intents từ sessions sales-ready |
| `responseBank` | Topic fallback templates | Hardcode | Có, gián tiếp | Học tone/template theo persona family |
| completion bank | Closing templates theo action | Hardcode | Có, gián tiếp | Rút closing intents từ sessions có payment/document/hold |
| topic aliases | Regex trong progress/reopen/memory/router | Hardcode | Có | Build alias dictionary từ corpora normalized |
| persona runtime | Dựa trên pipeline outputs | Data-driven hơn | Có | Tăng quality bằng richer extraction |
| deal closing signals | Gần như chưa có | Chưa có | Có, rất nên | Extract từ raw sales sessions có quote/payment/hold/approval |
| identity profile | Dựa salutation/display/opening | Nửa hardcode | Có, ít | Build salutation priors từ cleaned persona metadata |

Kết luận:

- Hardcode chấp nhận được ở MVP:
  - response bank
  - closing bank
  - scenario seed templates
  - state keyword router ở mức prototype
- Hardcode nên chuyển sang config/data sớm:
  - topic regex/aliases
  - scenario catalog
  - do-not-do / response constraints
  - persona-family opening rules
- Hardcode nguy hiểm nếu để lâu:
  - deal outcome logic
  - pronoun/identity routing edge rules
  - completion criteria
  - session end behavior

---

## PHẦN 10 — Readiness for Phase 12H/13A

Đánh giá: đã sẵn sàng bắt đầu `12H/13A`, nhưng chưa sẵn sàng shipping outcome-based training.

1. `completion_ready` khác gì `deal_outcome`?

- `completion_ready`: sale đã cung cấp đủ thông tin tối thiểu để hội thoại đi tới bước chốt.
- `deal_outcome`: khách đã thể hiện trạng thái giao dịch cụ thể, ví dụ xin báo giá, xin giữ hàng,
  chờ duyệt, chờ thanh toán, từ chối, hoặc chốt thành công.

2. Runtime hiện đã biết "đủ thông tin" nhưng đã biết "khách chốt" chưa?

- Biết "đủ thông tin": có.
- Biết "khách chốt": chưa.
- Bằng chứng: `src/runtime/conversationCompletion.ts` chỉ dùng `progress` để suy ra
  `completion_ready` và `recommended_action`, không có `buying_signals` hay `deal_outcome`.

3. Cần bổ sung schema gì?

Đề xuất `deal_state`:

```text
deal_state:
- buying_signals: string[]
- closing_signals: string[]
- deal_outcome: enum
- outcome_confidence: number
- should_end_session: boolean
- end_reason: string
- next_best_action: string
- training_success: boolean
```

4. Cần bổ sung detector gì?

- `detectQuoteRequest()`
- `detectHoldRequest()`
- `detectApprovalDependency()`
- `detectPaymentIntent()`
- `detectCommitmentIntent()`
- `detectStallIntent()`
- `detectRejectionIntent()`
- `detectSessionEndIntent()`

5. Cần lấy gì từ raw Zalo?

- câu xin báo giá chính thức
- câu xin hóa đơn/chứng từ để trình duyệt
- câu giữ hàng/giữ giá
- câu hẹn thanh toán/chuyển khoản
- câu chờ sếp/chờ kế toán/chờ nội bộ duyệt
- câu từ chối mềm và từ chối cứng
- các motif hội thoại dừng do stall

6. Cần đưa gì vào persona runtime?

- `closing_style`
- `approval_dependency_level`
- `budget_rigidity`
- `payment_readiness`
- `decision_speed`
- `preferred_next_step`
- `stall_patterns`
- `acceptable_outcomes`

Đề xuất outcome enum:

- `not_ready`
- `ready_to_close`
- `quote_requested`
- `payment_info_requested`
- `hold_requested`
- `customer_committed`
- `pending_approval`
- `pending_payment`
- `stalled`
- `closed_lost`
- `closed_won_simulated`

Kết luận section này:

- Nên làm `12H/13A`.
- Nhưng làm theo schema trước, không nên chỉ vá thêm regex vào `completion_ready`.

---

## PHẦN 11 — Training Success Criteria

Không phải phiên nào cũng cần `closed_won_simulated`.

Định nghĩa nên theo outcome phù hợp bối cảnh.

| Tình huống | Có thể xem là thành công không | Ghi chú |
|---|---|---|
| Khách chốt mua | Có | Outcome mạnh nhất |
| Khách xin báo giá | Có, nếu scenario phù hợp | Đặc biệt B2B/research persona |
| Khách cần sếp duyệt | Có thể có | Nếu sale đã đưa đủ thông tin và chốt next step đúng |
| Khách giữ hàng | Có thể có | Với logistics/availability scenarios |
| Khách hẹn lại | Có thể có | Nếu sale đã tạo next step rõ |
| Khách từ chối | Có thể vẫn tốt | Nếu sale khám phá đúng và dừng đúng |
| Sale nói mãi không tới kết quả | Không | `stalled` |

Đề xuất success criteria:

- Theo persona:
  - price-sensitive: thành công nếu sale chốt được quote/price frame hợp lý
  - logistics-heavy: thành công nếu chốt stock + delivery + hold/next step
  - payment-followup: thành công nếu chốt payment/doc flow
  - comparison persona: thành công nếu sale làm rõ model/config và đạt next step
- Theo scenario:
  - research scenario: `quote_requested` hoặc `ready_to_close` là đủ tốt
  - logistics scenario: `hold_requested` hoặc `customer_committed` tốt
  - payment scenario: `payment_info_requested` hoặc `pending_payment` tốt
- Max turns:
  - soft limit `12-18`
  - hard limit `20-24`
- Stalled detection:
  - 3 lượt không tạo signal mới
  - lặp topic answered
  - sale không tiến state
- Manual end by sale:
  - cần có
- Session result card:
  - cần có ngay khi làm FE
- Review sau phiên:
  - nên có từ MVP

Trả lời trực tiếp:

- Phiên nào cũng cần `closed_won` không: không.
- `pending_approval` có tính là thành công không: có, nếu đúng persona/scenario và next step rõ.
- Khách từ chối có thể vẫn là phiên tốt không: có, nếu sale xử lý đúng và đạt learning objective.
- Khi nào UI nên khóa input và hiện review:
  - `should_end_session = true`
  - hoặc đạt `max_turns`
  - hoặc user manual end
  - hoặc `deal_outcome` thuộc nhóm terminal:
    `closed_won_simulated`, `closed_lost`, `stalled`

---

## PHẦN 12 — DB/FE MVP Readiness

Đánh giá:

- Chưa nên dựng full web app production.
- Có thể bắt đầu MVP mỏng sau khi freeze `session/deal_state` contract.

Nếu chưa:

- chốt `12H/13A`
- freeze response payload
- chuẩn hóa session result schema
- tách runtime service boundary

Nếu bắt đầu MVP mỏng, schema Laravel/MySQL đề xuất:

| Table | Mục đích |
|---|---|
| `users` | User đăng nhập |
| `personas` | Snapshot persona runtime dùng cho training |
| `training_sessions` | Session-level state, outcome, metrics |
| `chat_messages` | Transcript từng turn |
| `session_runtime_logs` | Guard triggers, state changes, metadata |
| `session_scores` | Review/scoring/outcome card |

Gợi ý fields chính:

- `training_sessions`
  - `id`
  - `user_id`
  - `persona_id`
  - `scenario_id`
  - `status`
  - `runtime_version`
  - `completion_ready`
  - `deal_outcome`
  - `training_success`
  - `turn_count`
  - `started_at`
  - `ended_at`

- `chat_messages`
  - `id`
  - `session_id`
  - `role`
  - `text`
  - `runtime_state`
  - `reply_source`
  - `latency_ms`

- `session_runtime_logs`
  - `id`
  - `session_id`
  - `turn_index`
  - `guard_triggered`
  - `guard_trigger_reasons`
  - `identity_profile_json`
  - `progress_json`
  - `memory_json`
  - `completion_json`
  - `deal_state_json`

React FE pages:

| Page | Mục đích |
|---|---|
| Login | Auth tối giản |
| Persona Selection | Chọn persona/scenario |
| Training Chat | Chat runtime |
| Session Result | Outcome + review |
| History | Xem lịch sử phiên |
| Admin Persona Viewer | Xem persona metadata |

Integration đề xuất:

```text
React
  -> Laravel API
  -> Runtime service (Node/TS, tách từ playground/server)
  -> Local model endpoint
  -> Laravel lưu transcript + logs + outcome
  -> React render result/review
```

Kết luận phần này:

- Không nên build FE/DB lớn khi runtime outcome chưa freeze.
- Nhưng có thể chuẩn bị thin wrapper.

---

## PHẦN 13 — Recommended Roadmap

### Option A

1. Finish `12H/13A`
2. Freeze runtime contract
3. Build thin DB/FE MVP
4. Pilot internal
5. Add scoring engine
6. Add voice later

### Option B

1. Build thin DB/FE wrapper now
2. Keep runtime evolving
3. Add deal closing later

Đánh giá:

- Nên chọn **Option A**.

Lý do:

- Runtime hiện đã có đủ cấu trúc để đi thêm 1 bước outcome/state.
- Nếu build FE/DB trước khi chốt `deal_state`, bạn sẽ refactor API, DB schema, UI state 2 lần.
- `12H/13A` chính là điểm chuyển từ "chat simulator" sang "training product".

Roadmap tôi khuyến nghị:

1. Thiết kế `deal_state` schema và payload contract.
2. Thêm detectors cho quote/hold/approval/payment/stall/rejection.
3. Gắn `training_success` + `should_end_session`.
4. Thêm regression/offline QA cho outcome engine.
5. Freeze `/api/chat` response schema.
6. Tách runtime service khỏi `server.ts`.
7. Dựng Laravel/MySQL + React MVP mỏng.
8. Chạy pilot nội bộ.
9. Sau đó mới làm scoring/review nâng cao.

---

## PHẦN 14 — Final Recommendation

Dự án hiện ở mức:

- Pipeline local-first khá hoàn chỉnh.
- Runtime Phase 12 đã vượt mức demo.
- Chưa tới mức production app, nhưng đủ nền để làm `12H/13A`.

Khuyến nghị trực tiếp:

- Nên tiếp tục runtime trước, chưa nên ưu tiên web app trước.
- Nên vào `12H/13A` ngay.
- Nên giữ Gemma cho hardening hiện tại nếu endpoint đang ổn.
- Có thể thử Qwen local như benchmark phụ, không nên đổi model chính ngay.
- Không nên làm semantic memory/vector search lúc này.
- Không nên làm voice lúc này.
- Bước tiếp theo chính xác:
  1. Thiết kế `deal_state` schema.
  2. Thêm outcome detectors + session end rule.
  3. Viết regression/offline QA cho `12H/13A`.
  4. Freeze runtime contract.
  5. Sau đó mới dựng DB/FE MVP mỏng.

---

## Validation

- Không chạy test.
- Không chạy live QA.
- Không gọi model thật.
- Đọc codebase, runners, summaries, QA reports, pipeline artifacts.

## Risks

- `server.ts` đang là God file.
- `completion_ready` dễ bị hiểu nhầm là `deal_outcome`.
- Hardcode runtime rules còn nhiều.
- QA baseline hiện có dấu hiệu chưa thống nhất giữa các report.
