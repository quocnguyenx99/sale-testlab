# AI SALES TESTLAB — MIND MAP TỔNG THỂ (CHAT 1VS1)

> Dùng file này để đọc như mind map hoặc dán vào Mapify.  
> Tag: [P0] bắt buộc V1 · [P1] làm sau V1 · [P2] nâng cao · [FE] frontend · [API] endpoint · [BE] backend · [DB] database · [RUNTIME] runtime-core · [AI] Local AI · [REALTIME] SSE · [ADMIN] quản trị · [SALE] người luyện tập

- AI SALES TESTLAB
  - 1. SALES WEB APP [FE] [SALE]
    - 1.1 Đăng nhập `/login` [P0]
      - Nhiệm vụ: xác thực Sale trước khi vào hệ thống
      - Chức năng
        - Email + mật khẩu
        - Remember login
        - Hiển thị lỗi đăng nhập
      - API
        - POST `/api/v1/auth/login`
        - GET `/api/v1/auth/me`
      - BE
        - AuthController → AuthService → UserRepository
      - DB
        - app_users
      - Ghi chú: trang duy nhất không dùng Sales App sidebar

    - 1.2 Quên mật khẩu `/forgot-password` [P1]
      - Nhiệm vụ: phục hồi tài khoản
      - API: POST `/api/v1/auth/forgot-password`
      - Ghi chú: có thể làm sau nếu V1 dùng tài khoản nội bộ do Admin cấp

    - 1.3 Dashboard `/dashboard` [P0]
      - Nhiệm vụ: cho Sale biết mình đang luyện tập thế nào
      - Chức năng
        - Tiến độ tuần
        - Tổng số phiên
        - Điểm trung bình
        - Tỷ lệ thành công/chốt
        - Rank hiện tại
        - Hoạt động gần đây
        - Persona gợi ý
        - Nút bắt đầu luyện tập
      - API
        - GET `/api/v1/me/dashboard`
        - GET `/api/v1/me/recent-sessions`
        - GET `/api/v1/me/recommended-personas`
      - BE
        - DashboardController → DashboardService
      - DB
        - simulation_sessions + simulation_evaluations + customer_personas
      - Ghi chú: ưu tiên 1 Dashboard DTO, tránh FE gọi quá nhiều API nhỏ

    - 1.4 Chế độ luyện tập `/training` [P0]
      - Nhiệm vụ: chọn hình thức luyện tập
      - Chức năng
        - Luyện tập đơn 1vs1 → bật ở V1
        - Đối kháng → Coming Soon [P2]
        - Sale AI Challenge → Coming Soon [P2]
        - Gợi ý chế độ nên luyện
      - API
        - GET `/api/v1/training/modes`
      - Ghi chú: V1 chỉ phát triển 1vs1 để tránh phình scope

    - 1.5 Thư viện khách hàng `/customers` [P0]
      - Nhiệm vụ: chọn AI Customer Persona muốn luyện
      - Chức năng
        - Search tên/persona
        - Filter ngành
        - Filter độ khó
        - Filter nhóm nhu cầu
        - Persona nổi bật
        - Card persona
        - Bắt đầu luyện tập
      - API
        - GET `/api/v1/personas?search=&difficulty=&industry=`
      - BE
        - PersonaController → PersonaService → PersonaRepository
      - DB
        - customer_personas
      - Ghi chú: FE chỉ nhận thông tin an toàn; KHÔNG trả system prompt/runtime prompt cho Sale

    - 1.6 Chi tiết khách hàng `/customers/:personaId` [P0]
      - Nhiệm vụ: giúp Sale hiểu bối cảnh trước khi luyện
      - Chức năng
        - Persona profile
        - Vai trò
        - Tính cách
        - Độ khó
        - Bối cảnh mua hàng
        - Chủ đề thường quan tâm
        - Scenario phù hợp
      - API
        - GET `/api/v1/personas/:personaId/public-profile`
        - GET `/api/v1/personas/:personaId/scenarios`
      - Ghi chú: có thể triển khai Drawer trên desktop thay vì page riêng

    - 1.7 Thiết lập phiên `/practice/new` [P0]
      - Nhiệm vụ: cấu hình phiên trước khi chat
      - Chức năng
        - Persona đã chọn
        - Scenario
        - Mode SALE_FIRST / CUSTOMER_FIRST
        - Mức độ nếu scenario cho phép
        - Xác nhận bắt đầu
      - API
        - GET `/api/v1/scenarios?personaId=`
        - POST `/api/v1/simulator/sessions`
      - BE
        - SimulationSessionController → SimulationSessionService
      - DB
        - simulation_sessions
      - Ghi chú: tại lúc Start phải snapshot persona/scenario/model để lịch sử không đổi về sau

    - 1.8 Hội thoại 1vs1 `/practice/:sessionId` [P0] [REALTIME]
      - Nhiệm vụ: màn hình quan trọng nhất — Sale nói chuyện với AI Customer
      - Khu vực trái — Customer Context
        - Avatar + tên
        - Vai trò
        - Mood
        - Độ khó
        - Scenario
        - Mức tương tác
      - Khu vực giữa — Chat
        - Message list
        - User message
        - AI Customer response
        - Streaming indicator
        - Composer
        - Quick action chips
        - Stop generation
        - End session
      - Khu vực phải — AI Coach
        - Warning
        - Suggestion
        - Customer signals
        - Conversation progress
        - Có thể ẩn/Drawer trên mobile
      - API
        - GET `/api/v1/simulator/sessions/:sessionId`
        - GET `/api/v1/simulator/sessions/:sessionId/messages`
        - POST `/api/v1/simulator/sessions/:sessionId/messages/stream` [SSE]
        - POST `/api/v1/simulator/sessions/:sessionId/stop`
      - BE
        - SimulationMessageController
        - → SimulationOrchestratorService
        - → runtime-core
        - → AI Provider
        - → Local AI
      - DB
        - simulation_sessions
        - conversation_turns
      - Ghi chú
        - FE không gọi Local AI trực tiếp
        - Idempotency-Key chống gửi trùng khi reconnect/retry
        - Chỉ component StreamingMessage cập nhật theo chunk; tránh rerender toàn page

    - 1.9 Kết quả phiên `/practice/:sessionId/result` [P0]
      - Nhiệm vụ: cho Sale biết mình làm tốt/chưa tốt ở đâu
      - Chức năng
        - Overall score
        - Mở đầu
        - Khai thác nhu cầu
        - Tư vấn sản phẩm
        - Xử lý từ chối
        - Chốt đơn
        - Điểm mạnh
        - Điểm cần cải thiện
        - Gợi ý cách nói tốt hơn
        - Luyện tập lại
      - API
        - GET `/api/v1/simulator/sessions/:sessionId/evaluation`
      - BE
        - EvaluationController → EvaluationService
      - DB
        - simulation_evaluations
      - Ghi chú: Runtime đóng vai khách; Evaluator chấm Sale — hai nhiệm vụ tách riêng

    - 1.10 Replay & Khoảnh khắc `/practice/:sessionId/replay` [P0]
      - Nhiệm vụ: chỉ ra chính xác Sale mất/được điểm ở câu nào
      - Chức năng
        - Transcript
        - Highlight moment
        - Timestamp/turn
        - Skill tag
        - AI insight
        - Câu nói thay thế
      - API
        - GET `/api/v1/simulator/sessions/:sessionId/replay`
      - BE
        - EvaluationController / SessionController
      - DB
        - conversation_turns + simulation_evaluations
      - Ghi chú: đây là page có giá trị đào tạo rất cao, nên có trong V1

    - 1.11 Lịch sử `/history` [P0]
      - Nhiệm vụ: xem các phiên đã luyện
      - Chức năng
        - Filter ngày
        - Filter persona
        - Filter scenario
        - Filter kết quả
        - Xem result
        - Xem replay
        - Luyện lại
      - API
        - GET `/api/v1/me/sessions?page=&persona=&result=&from=&to=`
      - DB
        - simulation_sessions + simulation_evaluations

    - 1.12 Bảng xếp hạng `/leaderboard` [P1]
      - Nhiệm vụ: gamification, tạo động lực luyện tập
      - Chức năng
        - Tuần / tháng / quý
        - Cá nhân / phòng ban
        - Top 3
        - Rank chi tiết
      - API
        - GET `/api/v1/leaderboard?period=week&teamId=`
      - Ghi chú: chỉ làm khi scoring V1 đã ổn định

    - 1.13 Hồ sơ `/profile` [P1]
      - Nhiệm vụ: thống kê cá nhân
      - Chức năng
        - User info
        - Team
        - Tổng phiên
        - Điểm trung bình
        - Kỹ năng mạnh/yếu
      - API
        - GET `/api/v1/me/profile`
        - GET `/api/v1/me/skill-summary`

  - 2. ADMIN WEB APP [FE] [ADMIN]
    - 2.1 Admin Dashboard `/admin/dashboard` [P0]
      - Tổng user, session, completion, score
      - User activity
      - Kỹ năng yếu theo team
      - Persona usage
      - API: GET `/api/v1/admin/analytics/overview`

    - 2.2 Người dùng `/admin/users` [P0]
      - CRUD Sale / Manager / Admin
      - Enable / disable
      - Gán team và role
      - API: `/api/v1/admin/users/*`
      - DB: app_users

    - 2.3 Nhóm bán hàng `/admin/teams` [P0]
      - CRUD team
      - Gán Sale vào team
      - Manager của team
      - API: `/api/v1/admin/teams/*`
      - DB: sales_teams + team_members

    - 2.4 AI Personas `/admin/personas` [P0]
      - List/search/filter
      - Create/edit/clone
      - Draft → Active → Archived
      - Import persona đã anonymized
      - Preview public profile
      - API: `/api/v1/admin/personas/*`
      - DB: customer_personas

    - 2.5 Scenarios `/admin/scenarios` [P0]
      - Create/edit/clone
      - Objective
      - Initial message
      - Max turns
      - Assign Persona
      - Assign Dataset
      - Default AI Model
      - API: `/api/v1/admin/scenarios/*`
      - DB: scenarios + scenario_personas + scenario_datasets

    - 2.6 Products `/admin/products` [P0]
      - Search SKU/model/name
      - View product grounding data
      - Alias/model alternative name
      - Import catalog
      - API: `/api/v1/admin/products/*`
      - DB: products + product_aliases

    - 2.7 AI Models `/admin/ai-models` [P0]
      - Provider/base URL/model
      - Test connection
      - Active model
      - Health history
      - API: `/api/v1/admin/ai-model-configs/*`
      - DB: ai_model_configs + ai_model_health_logs

    - 2.8 Sessions `/admin/sessions` [P0]
      - Search/filter toàn bộ phiên
      - Theo Sale/persona/scenario/result
      - API: GET `/api/v1/admin/sessions`

    - 2.9 Session Diagnostics `/admin/sessions/:id` [P0]
      - Transcript
      - Runtime state
      - Reply source
      - Guard actions
      - Token/latency
      - Evaluation
      - API
        - GET `/api/v1/admin/sessions/:id`
        - GET `/api/v1/admin/sessions/:id/logs`
      - Ghi chú: dữ liệu debug này chỉ Admin thấy, Sale không cần thấy

    - 2.10 Analytics `/admin/analytics` [P1]
      - Theo Sale/team
      - Persona
      - Scenario
      - Model
      - Latency/error
      - Skill trend
      - API: `/api/v1/admin/analytics/*`

    - 2.11 Datasets `/admin/datasets` [P1]
      - Context/example/evaluation knowledge
      - Items
      - Validate/checksum
      - API: `/api/v1/admin/datasets/*`

    - 2.12 Prompt Templates `/admin/prompts` [P1]
      - Version prompt
      - Clone draft
      - Preview
      - Activate
      - Rollback bằng version cũ
      - API: `/api/v1/admin/prompt-templates/*`

    - 2.13 Evaluations `/admin/evaluations` [P1]
      - Xem score/rubric
      - Re-evaluate nếu evaluator version thay đổi
      - API: `/api/v1/admin/evaluations/*`

    - 2.14 Import Jobs `/admin/import-jobs` [P1]
      - Theo dõi import Persona/Product/Dataset
      - Success/fail count
      - Error details
      - API: `/api/v1/admin/import-jobs/*`

    - 2.15 Audit Logs `/admin/audit-logs` [P1]
      - Ai sửa gì, lúc nào
      - API: GET `/api/v1/admin/audit-logs`

    - 2.16 Settings `/admin/settings` [P1]
      - Default model
      - Retention
      - Feature flags
      - Privacy configuration

  - 3. BACKEND API [BE]
    - 3.1 Auth Module
      - AuthController
      - AuthService
      - UserRepository
      - API: login / me / logout / refresh
      - DB: app_users

    - 3.2 User & Team Module
      - UserController
      - TeamController
      - UserService / TeamService
      - DB: app_users / sales_teams / team_members

    - 3.3 Persona Module
      - PersonaController
      - PersonaService
      - PersonaRepository
      - Public DTO vs Admin DTO
      - DB: customer_personas

    - 3.4 Scenario Module
      - ScenarioController
      - ScenarioAssignmentController
      - ScenarioService
      - DB: scenarios / scenario_personas / scenario_datasets

    - 3.5 Product Knowledge Module
      - ProductController
      - ProductImportController
      - ProductService
      - ProductRepository
      - DB: products / product_aliases

    - 3.6 AI Model Module
      - AIModelConfigController
      - AIModelHealthController
      - AIModelService
      - DB: ai_model_configs / health_logs

    - 3.7 Simulator Session Module
      - SimulationSessionController
      - Start / state / history / stop
      - Snapshot config at start
      - DB: simulation_sessions

    - 3.8 Simulator Message Module [REALTIME]
      - SimulationMessageController
      - SimulationOrchestratorService
      - SSE Writer
      - Idempotency protection
      - DB: conversation_turns
      - Runtime: runtime-core
      - AI: AI Provider → Local AI

    - 3.9 Evaluation Module
      - EvaluationController
      - EvaluationService
      - Evaluator adapter
      - DB: simulation_evaluations
      - Output: score + strengths + weaknesses + highlights

    - 3.10 Dashboard / Analytics Module
      - DashboardController
      - AnalyticsController
      - Aggregate sessions + evaluations
      - Ghi chú: đừng lưu mọi KPI trực tiếp trong user; tính từ lịch sử trước, cache sau

    - 3.11 Import Module
      - ImportJobController
      - Persona/Product/Dataset importer
      - Anonymization gate
      - DB: import_jobs

    - 3.12 System Module
      - Health live
      - Health ready
      - Version
      - AI health
      - Graceful shutdown

  - 4. RUNTIME CORE [RUNTIME]
    - Nguyên tắc
      - Pure TypeScript
      - KHÔNG biết Express
      - KHÔNG gọi Prisma
      - KHÔNG phụ thuộc UI
      - Nhận object → xử lý → trả object

    - 4.1 Product Grounding
      - Nhận diện sản phẩm Sale/Customer đang nói tới
      - Resolve model, alias, lựa chọn kiểu “mẫu thứ hai”
      - Lấy product context cần thiết
      - Ghi chú: giải quyết defect product context hiện tại

    - 4.2 Conversation Memory
      - Nhớ sản phẩm
      - Giá
      - Stock
      - Giao hàng
      - Thanh toán
      - Các thông tin đã nói trước đó
      - Module: conversationMemory

    - 4.3 Progress Tracker
      - Topic nào đã hỏi
      - Topic nào đã trả lời
      - Topic nào đã xác nhận
      - Module: conversationProgressTracker

    - 4.4 Runtime State Router
      - Xác định hội thoại đang ở giai đoạn nào
      - Ví dụ greeting / discovery / pricing / objection / closing
      - Module: runtimeStateRouter

    - 4.5 Identity & Buyer Voice
      - AI phải luôn là Customer
      - Không nói như tư vấn viên
      - Không đổi vai
      - Module: conversationIdentity

    - 4.6 Prompt Builder
      - Ghép Persona + Scenario + Memory + Product + Progress
      - Output prompt cho Local AI
      - Module: runtimePromptBuilder

    - 4.7 AI Provider [AI]
      - OpenAI-compatible
      - vLLM / LM Studio
      - Ollama nếu cần
      - Timeout
      - AbortController
      - Streaming
      - Ghi chú: adapter nằm ở BE/infrastructure, interface dùng cho runtime orchestration

    - 4.8 Guard Pipeline
      - Anti repetition
      - Customer voice guard
      - Identity drift guard
      - Product safety
      - Buyer-role violation
      - Consultant tone blocking
      - Module: repetitionGuard + safetyGuards + identity guards

    - 4.9 Completion & Deal State
      - Detect buying signal
      - Objection
      - Closing
      - Terminal state
      - Module: conversationCompletion + dealState

    - 4.10 Deterministic Fallback
      - Khi Local AI timeout/sai vai/sai response
      - Dùng responseBank để giữ hệ thống không chết
      - Module: responseBank

    - 4.11 Runtime Output
      - rawModelOutput
      - finalResponse
      - runtimeState
      - replySource
      - guardActions
      - updatedMemory
      - updatedProgress
      - updatedDealState
      - diagnostics

  - 5. RUNTIME FLOW — 1 MESSAGE [FLOW]
    - Sale nhập message
    - Sales FE gửi POST stream + Idempotency-Key
    - Backend validate Zod
    - Load session snapshot
    - Product grounding
    - Update memory
    - Update progress
    - Route runtime state
    - Build identity + prompt
    - Gọi Local AI
    - Buffer/check response
    - Run Guard Pipeline
    - Chọn final response hoặc fallback
    - Persist turn + session state
    - SSE gửi final response về FE
    - FE render customer reply
    - Nếu terminal → Evaluation → Result page
    - Ghi chú: FE không bao giờ gọi model trực tiếp

  - 6. DATABASE [DB]
    - User Domain
      - app_users
      - sales_teams
      - team_members
    - Training Config Domain
      - customer_personas
      - scenarios
      - scenario_personas
      - datasets
      - dataset_items
      - scenario_datasets
      - products
      - product_aliases
      - prompt_templates
      - ai_model_configs
      - ai_model_health_logs
    - Runtime Domain
      - simulation_sessions
      - conversation_turns
      - simulation_feedback
      - simulation_evaluations
    - System Domain
      - import_jobs
      - system_audit_logs
    - Ghi chú: chỉ dữ liệu persona đã anonymized được import vào DB

  - 7. PHASE TRIỂN KHAI [ROADMAP]
    - Phase 0 [P0]
      - Freeze regression tests
      - TypeScript + UTF-8 audit
    - Phase 1 [P0]
      - Monorepo
      - packages/ui
      - packages/contracts
      - Backend skeleton
      - MySQL + Prisma
    - Phase 2 [P0]
      - Auth/User/Team
      - Persona
      - Scenario
      - Product
      - AI Model
    - Phase 3 [P0]
      - Vertical Slice
      - Login → chọn Persona → start session → 1 message → Local AI → lưu DB
    - Phase 4 [P0]
      - Runtime core integration
      - Guards
      - Memory
      - Product grounding
      - SSE
    - Phase 5 [P0]
      - Sales App core pages
      - Dashboard / Customer / Practice / Result / Replay / History
    - Phase 6 [P0/P1]
      - Admin pages
      - Evaluation
      - Analytics
    - Phase 7 [P1]
      - Leaderboard
      - Prompt editor
      - Dataset UI
      - Import jobs
    - Phase 8 [P2]
      - Đối kháng
      - Sale AI Challenge
      - Advanced gamification

