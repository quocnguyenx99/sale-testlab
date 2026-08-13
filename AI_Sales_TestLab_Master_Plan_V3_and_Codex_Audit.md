# AI SALES TESTLAB — MASTER PLAN V3 (SCOPED 1VS1)

> Mục tiêu: biến codebase TestLab hiện tại thành một web app luyện tập bán hàng 1vs1 hiện đại, nhưng KHÔNG mở rộng quá sớm sang AI Coach realtime, gamification, đối kháng hoặc analytics nâng cao.
>
> Nguyên tắc: Reuse first → Refactor only where necessary → Build vertical slices → Protect current runtime behavior.

---

## 1. PRODUCT SCOPE MỚI

### Core V1
Sales App chỉ cần flow:

1. Login
2. Home
3. AI Customer Library
4. Session Setup
5. Chat 1vs1
6. Result

Có thể bổ sung sau khi core chạy ổn:

7. History
8. Replay
9. Leaderboard

### Không làm trong V1
- Đối kháng Sale vs Sale
- Sale AI Challenge
- AI Coach realtime bằng LLM riêng
- Evaluator nhiều rubric phức tạp
- Gamification nâng cao
- Achievement/Tournament
- CRM integration
- Advanced Analytics
- Multi-agent orchestration

---

## 2. PRODUCT PRINCIPLE

Hệ thống V1 tập trung vào một câu hỏi:

> “Sale có thể chọn một AI Customer, vào một tình huống bán hàng, chat 1vs1 ổn định với Local AI, kết thúc phiên và xem một kết quả đơn giản hay chưa?”

Nếu câu trả lời chưa PASS thì không mở rộng feature.

---

# 3. FE — SALES APP V1

## Page 1 — Login
Route: `/login`

Mục đích:
- Sale đăng nhập
- Vào hệ thống

Chức năng V1:
- Email
- Password
- Login
- Error state
- Remember session nếu auth architecture hỗ trợ

Không cần ngay:
- Google Workspace
- SSO
- Forgot password phức tạp

Tag: `[P0] [AUTH]`

## Page 2 — Home
Route: `/dashboard`

Mục đích:
- Landing page sau login
- Bắt đầu luyện tập nhanh
- Xem vài phiên gần nhất

V1 chỉ cần:
- Greeting
- CTA “Bắt đầu luyện tập”
- Số phiên gần đây
- Điểm/result gần đây nếu đã có
- 3–5 recent sessions

Không cần ngay:
- Rank Gold IV
- Tỷ lệ chốt nâng cao
- Weekly training goal phức tạp
- AI recommendation engine

Tag: `[P0] [SUMMARY]`

## Page 3 — AI Customer Library
Route: `/customers`

Mục đích:
- Chọn Persona để luyện tập

Chức năng:
- List personas
- Search
- Filter đơn giản: difficulty, role/customer type nếu data có
- Persona card: tên hiển thị, vai trò, độ khó, mô tả ngắn, CTA “Luyện tập”

Persona Detail:
- ưu tiên Drawer/Modal, KHÔNG cần page riêng ở V1

Không được show:
- system prompt
- hidden runtime config
- hidden scoring rules

Tag: `[P0] [PERSONA]`

## Page 4 — Session Setup
Route: `/practice/new`

Mục đích:
- Chuẩn bị context trước khi vào chat

Input:
- selected Persona
- Scenario
- Mode: CUSTOMER_FIRST / SALE_FIRST
- Difficulty nếu thực sự có override

CTA: “Bắt đầu phiên”

V1 tránh setup quá nhiều trường.

Tag: `[P0] [SESSION]`

## Page 5 — Chat 1vs1
Route: `/practice/:sessionId`

Đây là core page.

### Layout đề xuất
Desktop:
- Left: Persona Context
- Center: Chat
- Optional Right Drawer/Panel: Runtime Insight

Không triển khai full AI Coach realtime ngay.

### Persona Context
Hiển thị:
- avatar
- display name
- role
- difficulty
- scenario
- vài context public

### Chat
Chức năng:
- load history
- send message
- AI response
- customer-first opening
- sale-first mode
- loading state
- retry/failure state
- stop generation nếu streaming đã hỗ trợ
- end session

### Runtime Insight
KHÔNG gọi LLM Coach riêng.

Chỉ hiển thị dữ liệu có thể lấy từ runtime hiện tại, ví dụ:
- runtime state
- topic progress
- known memory slots
- product context
- deal state/signal đơn giản

Ví dụ:

State: `PRICE_DISCUSSION`

Progress: `4/9 topics`

Known:
- product
- quantity
- price concern

Unknown:
- budget
- delivery

Tag: `[P0] [CORE] [RUNTIME]`

## Page 6 — Result
Route: `/practice/:sessionId/result`

Mục đích:
- cho Sale biết phiên vừa rồi diễn ra thế nào

V1 không giả lập evaluator quá sâu.

Nên dùng:
- session status
- deal outcome
- number of turns
- completed topics
- missing topics
- runtime signals
- simple deterministic score nếu logic hiện tại đủ đáng tin

Không bắt buộc V1:
- 6 kỹ năng với điểm 92/85/68…
- AI Curator Review dài
- coaching rewrite
- radar chart

Tag: `[P0] [RESULT]`

---

# 4. FE P1 — SAU KHI 1VS1 ỔN

## History
Route: `/history`
- list sessions
- filter đơn giản
- xem result
- luyện lại

## Replay
Route: `/practice/:sessionId/replay`
- transcript
- runtime state theo turn
- highlight dựa trên rule/runtime signals
- chưa bắt buộc dùng LLM evaluator

## Leaderboard
Chỉ làm khi:
- có user/team
- scoring đã ổn định
- có đủ session history

---

# 5. ADMIN FE — CHỈ LÀM SAU SALES CORE

Admin V1 tối thiểu:
1. Personas
2. Scenarios
3. AI Model Config
4. Sessions / diagnostics

Các phần sau để P1:
- Dataset editor
- Prompt version UI
- Analytics
- Import Jobs UI
- Audit Logs UI
- User/team management nâng cao

---

# 6. BACKEND V1

Backend không cần full Master Plan ngay.
Chỉ cần các domain phục vụ đúng 6 page FE.

## Auth
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

Nếu Codex audit thấy auth chưa cần ở vertical slice đầu, có thể mock/dev-only trước.

## Personas
- `GET /api/v1/personas`
- `GET /api/v1/personas/:id`

## Scenarios
- `GET /api/v1/scenarios`
- `GET /api/v1/scenarios/:id`

Nếu scenario hiện tại được runtime assign tự động, Codex phải kiểm tra xem có thật sự cần table/API Scenario ngay V1 không.

## Sessions
- `POST /api/v1/simulator/sessions`
- `GET /api/v1/simulator/sessions/:id`
- `POST /api/v1/simulator/sessions/:id/stop`
- `GET /api/v1/simulator/sessions/:id/messages`

## Chat
Bước đầu có thể giữ non-streaming để migrate an toàn:
- `POST /api/v1/simulator/sessions/:id/messages`

Sau khi regression + contract ổn:
- `POST /api/v1/simulator/sessions/:id/messages/stream`

Nguyên tắc:
- Không ép SSE vào phase đầu nếu làm tăng rủi ro refactor.
- Streaming là UX improvement, không phải prerequisite cho V1 vertical slice.

## Result / Runtime Summary
- `GET /api/v1/simulator/sessions/:id/result`

Backend tổng hợp:
- status
- turns
- runtime state
- progress
- deal state
- selected runtime diagnostics an toàn cho FE

Không trả:
- raw hidden prompt
- sensitive diagnostics
- private raw data

---

# 7. BACKEND LAYERING

Giữ định hướng:

Router → Controller → Service → Repository → Prisma/MySQL

Riêng Chat:

Router → SimulationMessageController → SimulationOrchestratorService → Runtime Core → AI Adapter → Local AI

Controller phải mỏng.
Runtime Core KHÔNG phụ thuộc Express/Prisma.

---

# 8. RUNTIME CORE — V1

Ưu tiên reuse các module hiện có:

1. runtimeStateRouter
2. runtimeConstraints
3. runtimePromptBuilder
4. conversationMemory
5. conversationProgressTracker
6. conversationIdentity
7. conversationCompletion
8. dealState
9. repetitionGuard
10. responseBank
11. safetyGuards
12. customerOpeningBuilder
13. productScenarioCatalog
14. productKnowledge

Không viết lại runtime nếu chưa chứng minh cần thiết.

## Runtime Insight
Runtime Insight là projection của state hiện tại cho FE.

Ví dụ output:

```json
{
  "runtimeState": "PRICE_DISCUSSION",
  "progress": {"completed": 4, "total": 9},
  "knownTopics": ["product", "quantity", "price"],
  "missingTopics": ["budget", "delivery"],
  "dealOutcome": "IN_PROGRESS"
}
```

Mục tiêu:
- tận dụng runtime hiện có
- không thêm AI Coach LLM

---

# 9. AI COACH — DEFER

V1 KHÔNG có AI Coach realtime độc lập.

Phase sau mới đánh giá:
Sale message → Coach Analyzer → Suggestion

Lý do:
- tăng số AI calls
- tăng latency
- tăng token/load
- cần rubric
- cần validate độ chính xác
- làm scope Runtime phình nhanh

---

# 10. EVALUATOR — DEFER / SIMPLE FIRST

V1 dùng deterministic/runtime-derived result nếu phù hợp.

Ví dụ:
- topic completion
- deal outcome
- objection handled
- closing signal
- conversation completion

Phase sau mới cân nhắc EvaluationEngine riêng.
Evaluator phải tách khỏi AI Customer runtime.

---

# 11. DATABASE — MINIMUM FIRST

Không bắt buộc dựng toàn bộ schema Master Plan ngay.
Minimum V1 dự kiến, nhưng phải để Codex audit codebase xác nhận:

## users
- id
- email
- display_name
- password_hash / auth identity
- role
- status

## customer_personas
- id
- source key
- display name
- public summary
- runtime config/reference
- version
- status
- anonymized flag

## scenarios
Chỉ tạo nếu audit xác nhận runtime hiện tại có concept này rõ ràng và cần quản trị.

## simulation_sessions
- id
- user_id
- persona_id
- scenario_id nullable
- mode
- status
- runtime_snapshot
- memory_state
- progress_state
- deal_state
- started_at
- ended_at

## conversation_turns
- id
- session_id
- turn_number
- user_input
- ai_response
- runtime_state
- reply_source
- status
- diagnostics safe/internal
- latency
- timestamps

Optional later:
- evaluations
- feedback
- teams
- leaderboard aggregates
- prompt template version tables
- dataset management tables
- audit logs

---

# 12. DATA / PRIVACY

Giữ boundary:

Raw pipeline data → local filesystem only

Chỉ anonymized runtime personas và normalized product catalog mới được đưa vào web runtime/database nếu cần.

Không mở API browse raw folders.

---

# 13. IMPLEMENTATION STRATEGY

Không triển khai kiểu FE hết → BE hết → DB hết → Runtime hết.
Dùng vertical slice.

## Phase A — Audit / Baseline
Không sửa code.
Codex kiểm tra:
- current branch / HEAD
- build
- tests
- regression files
- runtime module dependencies
- playground behavior
- session lifecycle
- product knowledge
- current model adapter
- current defects
- filesystem data boundaries

Output:
- current truth
- risk
- feasibility
- migration map

## Phase B — FE Shell với Mock Data
- React + Vite
- Router
- layout
- shared UI
- Login mock
- Dashboard mock
- Customer Library mock
- Session Setup mock
- Chat UI mock
- Result mock

Gate:
- full UX flow click-through hoạt động

## Phase C — First Vertical Slice
Mục tiêu:
Customer Library → select Persona → Start Session → Send one message → existing runtime → Local AI → return response

Có thể dùng in-memory persistence ban đầu nếu migration DB chưa sẵn sàng, nhưng phải xác định đây chỉ là transitional step.

Gate:
- existing runtime behavior không regress
- AI Customer 1vs1 chạy từ new FE

## Phase D — Backend Refactor
Tách playground monolith từng phần:
1. Personas
2. Session lifecycle
3. Message orchestration
4. AI adapter
5. runtime boundary

Không rewrite toàn bộ `server.ts` một lần.

Gate:
- old regression tests pass
- behavior comparison pass

## Phase E — DB Persistence
Thêm Prisma/MySQL cho:
- users
- personas
- sessions
- turns

Import anonymized persona.
Session không mất khi restart.

Gate:
- restart backend → session history vẫn còn

## Phase F — Runtime Insight
Expose safe runtime summary:
- state
- progress
- deal state
- known/missing topics

## Phase G — Streaming
Refactor AI adapter:
- provider abstraction nếu cần
- AbortController
- stream support

Chỉ làm sau non-stream path ổn.
Phải audit guard behavior trước khi stream raw tokens ra FE.

## Phase H — Simple Result
Dùng runtime-derived metrics.
Không tạo fake precision.

## Phase I — P1
Sau khi V1 ổn:
- History
- Replay
- Evaluator
- AI Coach
- Advanced Admin
- Analytics
- Leaderboard

---

# 14. V1 ACCEPTANCE CRITERIA

V1 chỉ hoàn thành khi:

1. Sale login hoặc dev auth flow hoạt động
2. Persona list hiển thị từ source thật hoặc DB
3. Chọn Persona được
4. Start session được
5. CUSTOMER_FIRST hoạt động
6. SALE_FIRST hoạt động
7. Message đi qua runtime hiện có
8. AI Customer trả lời đúng persona
9. Product grounding không regress
10. Memory/progress không regress
11. Guard/fallback behavior không regress
12. Kết thúc session được
13. Result summary đọc được
14. Session/turn persistence hoạt động nếu DB phase đã vào V1
15. Regression tests hiện tại pass
16. Raw/non-anonymized data không bị expose

---

# 15. ARCHITECTURE TARGET

```text
Sales Web (React + Vite)
        |
        | REST / later SSE
        v
Express Backend
        |
        +--> Auth / Personas / Sessions
        |
        +--> Simulation Orchestrator
                    |
                    v
              Runtime Core
                    |
                    v
               AI Adapter
                    |
                    v
                Local AI

Express Backend
        |
        v
Prisma / MySQL

Persona Pipeline
        |
        +--> anonymized runtime personas
        +--> normalized product knowledge
```

---

# 16. CODEX DOUBLE-CHECK PROMPT

## Recommended execution mode

Use a strong coding/reasoning model available in Codex.

For cost/token efficiency:
- first pass: medium reasoning, read-only audit
- only use higher reasoning for ambiguous runtime/orchestration findings
- do NOT ask Codex to implement in this run

## PROMPT FOR CODEX

```text
ROLE
You are acting as a senior software architect and codebase auditor.

CONTEXT
This repository is the existing AI Sales TestLab / customer simulation codebase.
It currently contains a TypeScript/Node data pipeline, a playground server, runtime persona logic, product grounding, Local AI integration, and regression tests.

A previous master plan proposed a large monorepo with:
- React/Vite Sales/Simulator frontend
- React/Vite Admin frontend
- Express backend
- Prisma/MySQL
- runtime-core extraction
- SSE streaming
- analytics/evaluator/admin modules

We now intentionally REDUCE the initial product scope.

The new V1 goal is ONLY:
Login
→ Home
→ AI Customer Library
→ Session Setup
→ Chat 1vs1 with AI Customer
→ Simple Result

Optional after core:
History
Replay

Explicitly deferred:
- Sale-vs-Sale competition
- Sale AI Challenge
- realtime LLM AI Coach
- complex evaluator/rubric system
- leaderboard/gamification
- advanced analytics
- CRM integration
- multi-agent architecture

IMPORTANT
The current runtime behavior is the highest-value asset.
Do not propose rewriting it unless source evidence proves refactoring is required.

OBJECTIVE
Perform a READ-ONLY architecture audit against the ACTUAL CURRENT CODEBASE and determine whether this scoped V1 plan is:
1. technically feasible,
2. compatible with current runtime behavior,
3. appropriately sized,
4. safely migratable without unnecessary rewrites.

DO NOT MODIFY ANY FILE.
DO NOT CREATE IMPLEMENTATION CODE.
DO NOT RUN DESTRUCTIVE COMMANDS.
DO NOT CHANGE DATABASE/DATA.
DO NOT CHANGE PRODUCTION CONFIG.

FIRST: ESTABLISH CURRENT TRUTH

Inspect and report:

1. Repository state
- branch
- HEAD
- dirty tracked files
- relevant untracked files
- package manager
- Node/TypeScript versions/configs

2. Existing playground
- actual routes
- actual session storage
- exact orchestration entry points
- exact responsibilities currently located in playground/server.ts
- whether current UI can be treated as replaceable shell without affecting runtime

3. Runtime inventory
For each major runtime module, classify:
- REUSE_AS_IS
- REUSE_WITH_WRAPPER
- REFACTOR_REQUIRED
- DO_NOT_TOUCH_YET

At minimum inspect:
- runtimeStateRouter
- runtimeConstraints
- runtimePromptBuilder
- conversationMemory
- conversationProgressTracker
- conversationIdentity
- conversationCompletion
- dealState
- repetitionGuard
- responseBank
- safetyGuards
- customerOpeningBuilder
- productScenarioCatalog
- productKnowledge
- localAIRuntimeAdapter
- runtimeSessionManager

4. Existing tests
- enumerate regression tests
- identify commands required to run them
- identify which tests protect persona identity, buyer voice, product grounding, memory, deal state, completion, repetition/fallback
- report current pass/fail state where safely runnable

5. Current Local AI contract
- provider/API shape
- stream setting
- model config source
- timeout behavior
- abort/cancel support
- whether SSE can be added without changing runtime semantics

6. Data/privacy boundary
- where raw data lives
- where anonymized/runtime persona data lives
- what data runtime reads directly
- what must never be exposed by the new web backend

THEN: AUDIT THE NEW V1 PLAN

A. FE FEASIBILITY
Evaluate these pages:
1. Login
2. Home
3. AI Customer Library
4. Session Setup
5. Chat 1vs1
6. Result

For EACH page return:
- CURRENT SUPPORT: FULL / PARTIAL / NONE
- EXISTING SOURCE TO REUSE: exact file/module/function references
- DATA REQUIRED
- API REQUIRED
- NEW LOGIC REQUIRED
- V1 RECOMMENDATION: KEEP / SIMPLIFY / DEFER

Do not assume dashboard metrics exist if code does not prove them.

B. CHAT 1VS1 FEASIBILITY
Trace one current message end-to-end through the real source:
user input
→ session load/create
→ memory update
→ progress update
→ runtime state
→ prompt build
→ Local AI call
→ guards/fallback
→ final response
→ session mutation

Provide exact file/function references.

Then compare it to this desired future path:
React FE
→ Express endpoint
→ SimulationOrchestratorService
→ runtime-core
→ AI adapter
→ final response
→ FE

Identify the MINIMUM refactor required.

C. RUNTIME INSIGHT FEASIBILITY
We do NOT want a new AI Coach in V1.

Check whether current runtime already has enough data to safely expose:
- runtimeState
- completed topic count
- known/missing topics
- deal state
- selected customer signals

For each proposed field classify:
- DIRECTLY_AVAILABLE
- DERIVABLE
- NOT_RELIABLE_YET

Do not invent fields.

D. SIMPLE RESULT FEASIBILITY
We do NOT want a complex evaluator in V1.

Audit availability/reliability of:
- conversation completion
- total turns
- topic progress
- deal outcome
- objection signal
- closing signal
- training success
- simple total score

Classify each:
- RELIABLE_NOW
- PARTIAL
- SHOULD_NOT_SHOW_YET

If a numeric score would imply false precision, recommend not showing it.

E. BACKEND MINIMUM
Determine minimum Express backend modules required for V1.

Candidate set:
- auth
- personas
- scenarios only if needed
- simulations/sessions
- messages
- result
- system health

For each:
- required now?
- can use existing runtime/filesystem initially?
- requires DB?
- can be deferred?

Do not blindly preserve the old large API plan.

F. DATABASE MINIMUM
Do NOT assume the old full Prisma schema is needed.

Evaluate:
- users
- customer_personas
- scenarios
- simulation_sessions
- conversation_turns

For each classify:
- REQUIRED_V1
- USE_FILESYSTEM_FIRST
- OPTIONAL
- DEFER

Also identify which current data should remain filesystem-only.

G. STREAMING
Audit:
1. Is non-streaming currently stable?
2. What exact changes are required for stream:true?
3. Would streaming raw model tokens bypass any existing post-generation guard/repair logic?
4. Would buffered/guarded streaming be safer?
5. Should SSE be V1 or V1.1?

Give one verdict:
- STREAM_NOW
- DEFER_STREAMING
- BUFFERED_STREAM_ONLY

with evidence.

H. ARCHITECTURE / REPO STRUCTURE
Evaluate whether we truly need full monorepo extraction immediately.

Compare:
OPTION 1
Keep current pipeline/runtime structure, add apps/sales-web + apps/backend, and wrap existing runtime.

OPTION 2
Immediately move runtime to packages/runtime-core and reorganize full monorepo.

Recommend the lower-risk approach based on actual imports/dependencies.

I. REACT + VITE
Evaluate whether React + Vite is appropriate for the scoped authenticated training web app.
Focus on current backend separation, realtime chat UX, migration complexity, reuse, deployment separation.

J. RISK AUDIT
Rank top risks Critical / High / Medium / Low.
Especially inspect:
- regressions from extracting runtime
- product grounding
- ordinal product selection
- price grounding
- identity drift
- candidate loops
- mojibake/encoding
- TS moduleResolution
- session persistence
- streaming guard order
- exposing raw/private data

K. PROPOSE A REVISED DELIVERY PLAN
Prefer:
Phase 0 — Current Truth Audit
Phase 1 — FE mock shell
Phase 2 — First vertical slice against existing runtime
Phase 3 — Backend boundary extraction
Phase 4 — Minimum DB persistence
Phase 5 — Runtime Insight
Phase 6 — Streaming if safe
Phase 7 — Simple Result
Phase 8 — History/Replay
Phase 9 — Evaluator/Coach only after evidence

Change the order if source evidence proves a safer sequence.

VALIDATION REQUIREMENTS
Every major claim must include:
- file path
- function/class name
- approximate line range if possible

Clearly separate:
FACT — directly proven by source
INFERENCE — architectural conclusion
UNKNOWN — needs verification

OUTPUT FORMAT
Return exactly these sections:
1. EXECUTIVE VERDICT
2. CURRENT CODEBASE TRUTH
3. V1 FE PAGE MATRIX
4. CHAT 1VS1 TRACE
5. RUNTIME REUSE MATRIX
6. RUNTIME INSIGHT FEASIBILITY
7. SIMPLE RESULT FEASIBILITY
8. MINIMUM BACKEND
9. MINIMUM DATABASE
10. STREAMING VERDICT
11. REPO / MONOREPO VERDICT
12. RISK REGISTER
13. REVISED PHASE PLAN
14. KEEP / SIMPLIFY / DEFER LIST
15. OPEN QUESTIONS
16. FINAL GO / NO-GO

FINAL GO / NO-GO must be one of:
GO_AS_PROPOSED
GO_WITH_NARROW_CHANGES
REPLAN_REQUIRED
BLOCKED_BY_CURRENT_DEFECTS

Also provide:
- confidence: HIGH / MEDIUM / LOW
- top 5 changes recommended before implementation

ACTION POLICY
READ ONLY.
Do not edit.
Do not create files unless explicitly asked afterward.
Do not install dependencies.
Do not migrate data.
Do not modify production/runtime config.
Stop after the audit and wait for approval.
```

---

# 17. WHAT WE WANT FROM CODEX

The audit is successful if Codex tells us, with source evidence:

1. Which V1 FE pages are actually supported by current data/runtime.
2. Which features are currently aspirational.
3. Whether Runtime Insight can reuse current deterministic state.
4. Whether Simple Result can be produced without a new evaluator.
5. Which runtime files should not be touched.
6. Minimum API needed.
7. Minimum DB needed.
8. Whether streaming should be deferred.
9. Whether full monorepo refactor is premature.
10. The safest first implementation slice.

Only after that audit should implementation begin.
