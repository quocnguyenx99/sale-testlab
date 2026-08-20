# AI SALES TESTLAB V3 — DESIGN SYSTEM & UI DIRECTION

> **Purpose**
>
> This document is the visual and UX source of truth for the TestLab Sales Web redesign.
> It describes how the product should look, feel, behave, and organize information.
>
> It does **not** override backend behavior, API contracts, authentication, ownership, Runtime, Evaluator, AI Coach, or Progress analytics logic.

---

## 1. Product Identity

**Product:** AI Sales TestLab V3  
**Primary users:** Sales staff practicing customer conversations, reviewing results, receiving AI feedback, and tracking progress.  
**Product type:** Internal AI Sales Training SaaS.

### Desired feeling

The product should feel:

- professional
- calm
- modern
- focused
- trustworthy
- easy to scan
- comfortable for daily use
- clearly AI-assisted without looking experimental
- polished enough to feel like a real internal product, not a developer playground

### Avoid

- generic “AI purple everywhere” styling
- excessive gradients
- neon colors
- gaming dashboard visuals
- heavy glassmorphism
- oversized hero sections
- too many card borders competing for attention
- excessive shadows
- over-animation
- dense admin-table feeling on user-facing screens
- decorative UI that reduces training readability

---

## 2. Design Inspiration

The final design is **not a copy** of any one product.

Use these products only as design-language references:

### Primary inspiration — Intercom

Use for:

- conversational UI
- customer/persona presentation
- Training Chat
- AI Coach
- friendly but professional interaction patterns
- clear action hierarchy

### Structural inspiration — Linear

Use for:

- application shell
- sidebar
- navigation density
- page headers
- spacing discipline
- compact controls
- history/list presentation
- overall SaaS product polish

### Data / AI inspiration — Cohere

Use for:

- Evaluation
- Progress Analytics
- score cards
- skill summaries
- AI-related information hierarchy
- data-heavy sections that still feel clean

### Priority when references conflict

1. Existing TestLab functional behavior
2. `docs/ANTIGRAVITY_UI_REDESIGN.md`
3. This `DESIGN.md`
4. Installed design/redesign skills
5. External inspiration

---

## 3. Core UX Principles

### 3.1 One clear primary action per screen

Every major screen should answer:

> “What should the user do next?”

Primary actions must be visually obvious.

Examples:

- Dashboard → **Bắt đầu luyện tập**
- Persona Library → **Luyện tập với khách hàng này**
- Practice Setup → **Bắt đầu phiên luyện tập**
- Training Chat → **Gửi** / **Kết thúc phiên**
- Result → **Đánh giá phiên** or **Nhận gợi ý từ AI Coach**, depending on state
- Progress → **Xem kết quả phiên gần đây**

### 3.2 Conversation first

Training Chat is the core experience.

Anything secondary must not overpower the conversation:

- Runtime Insight
- metadata
- helper panels
- debug-like status
- session details

### 3.3 Progressive disclosure

Show the most important information first.

Do not show every available field simply because the API returns it.

### 3.4 Backend is authoritative

Frontend must not recalculate:

- Evaluation score
- overall score
- skill score
- trend state
- strongest skill
- needs-attention skill
- AI Coach priority logic

Frontend only formats and presents authoritative backend data.

### 3.5 Safe low-data states

Never show missing data as a score of zero.

Use clear states such as:

- `Chưa có dữ liệu`
- `Điểm khởi đầu`
- `Chưa đủ dữ liệu để xác định xu hướng`
- `Chưa có phiên được đánh giá`

---

## 4. Color System

Use a mostly neutral interface with a restrained indigo/blue accent.

### 4.1 Core palette

```text
Background         #F7F8FA
Surface            #FFFFFF
Surface Subtle     #F3F5F7
Surface Hover      #F8FAFC

Border             #E5E7EB
Border Strong      #D0D5DD

Text Primary       #111827
Text Secondary     #667085
Text Muted         #98A2B3
Text Inverse       #FFFFFF

Primary            #4F46E5
Primary Hover      #4338CA
Primary Soft       #EEF2FF
Primary Border     #C7D2FE

Info               #2563EB
Info Soft          #EFF6FF

Success            #15803D
Success Soft       #F0FDF4

Warning            #B45309
Warning Soft       #FFFBEB

Danger             #B42318
Danger Soft        #FEF3F2
```

### 4.2 Usage rules

Primary indigo is used for:

- primary CTA
- selected navigation
- active states
- key score emphasis
- focus ring

Do not use Primary for every icon or badge.

Use semantic colors only when they communicate actual meaning.

### 4.3 Gradients

Default: **no gradients**.

If used, gradients are allowed only as subtle decorative accents in very limited locations such as a small AI Coach header accent.

Never use large multi-color gradients across pages.

---

## 5. Typography

Preferred stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Do not add a new font dependency if the existing project already has a suitable sans-serif stack.

### Type scale

```text
Page Title         28–32px / 700
Section Title      18–20px / 650–700
Card Title         15–16px / 600
Body               14–15px / 400
Small / Meta       12–13px / 400–500
Large Score        30–40px / 700
```

### Rules

- Avoid tiny text under 12px.
- Avoid excessive uppercase.
- Use line-height generous enough for long Vietnamese text.
- Long AI Coach suggestions should be optimized for reading, not compressed.

---

## 6. Spacing & Geometry

Use an 8px-based spacing rhythm.

```text
4px   micro
8px   tight
12px  compact
16px  default
24px  section spacing
32px  large section spacing
40px+ major page separation
```

### Radius

```text
Inputs / buttons       8–10px
Cards                  12px
Large panels           14–16px
Badges                 999px only when pill is semantically appropriate
```

### Shadows

Use shadows sparingly.

Default cards should prefer:

```text
1px border + white surface
```

over floating shadows.

Use soft shadow only for:

- dropdown
- modal
- elevated composer
- floating mobile navigation if required

---

## 7. Application Shell

### Desktop

Preferred structure:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Sidebar │ Main Content                                           │
│         │                                                        │
│ Logo    │ Page Header                                            │
│         │                                                        │
│ Tổng quan                                                        │
│ Khách hàng AI                                                    │
│ Luyện tập                                                        │
│ Lịch sử                                                          │
│ Tiến độ                                                          │
│         │                                                        │
│         │ Main Page                                              │
│ User    │                                                        │
└──────────────────────────────────────────────────────────────────┘
```

### Sidebar

Style:

- light neutral background
- subtle right border
- compact but not cramped
- icons + Vietnamese labels
- selected item uses `Primary Soft`
- selected icon/text uses `Primary`
- no large colored sidebar block

Suggested width:

```text
232–256px desktop
```

Sidebar should visually recede behind page content.

### Page content

Preferred content max width:

```text
1200–1360px
```

Some pages such as Training Chat may use a wider/full-height layout.

### Mobile

Use compact top bar + drawer/bottom navigation based on existing architecture.

Do not force desktop sidebar into mobile width.

---

## 8. Shared Components

Antigravity should prefer reusable UI primitives rather than page-local copies.

Recommended shared primitives:

- `PageHeader`
- `SectionHeader`
- `Card`
- `StatCard`
- `Button`
- `IconButton`
- `Badge`
- `StatusBadge`
- `EmptyState`
- `ErrorState`
- `Skeleton`
- `Tabs`
- `SearchInput`
- `Modal/Dialog`
- `ScoreDisplay`
- `TrendBadge`
- `SkillScoreRow`
- `PersonaCard`
- `SessionCard`
- `ChatBubble`
- `ChatComposer`

Do not create a component abstraction merely to wrap one div once.

---

## 9. Navigation Labels

Use Vietnamese labels consistently.

Recommended primary navigation:

```text
Tổng quan
Khách hàng AI
Luyện tập
Lịch sử
Tiến độ
```

Do not create future navigation entries until the actual feature exists.

Examples that should NOT appear yet unless implemented:

```text
Chương trình đào tạo
Phân công
Quản lý khách hàng
Quản lý người dùng
```

---

## 10. Login

Goal:

Simple, professional, focused authentication.

### Layout

Desktop:

- centered authentication card or balanced two-column layout
- avoid marketing-heavy hero
- clear product identity
- compact form

Mobile:

- one-column
- comfortable input height
- full-width CTA

### Visual

Use:

- white card
- subtle border
- small TestLab brand mark
- short supporting text

Avoid:

- huge gradient illustration
- animated background
- decorative AI blobs

---

## 11. Dashboard

Dashboard should answer:

1. What can I do now?
2. What did I recently practice?
3. How am I progressing?

### Recommended hierarchy

```text
Page Header
│
├── Primary Practice CTA
│
├── Progress Summary
│
└── Recent Sessions
```

### Header

Example:

```text
Tổng quan
Tiếp tục luyện tập và theo dõi tiến độ của bạn.
```

### Primary training CTA

A visually prominent but compact card:

```text
Sẵn sàng cho phiên luyện tập tiếp theo?

[Bắt đầu luyện tập]
```

Do not use a giant marketing hero.

### Progress Summary

Show only quick information:

- Điểm trung bình
- Phiên đã đánh giá
- Xu hướng
- CTA `Xem tiến độ`

Do not duplicate the full Progress page.

### Recent Sessions

Use a concise list/card layout.

Show:

- Persona
- Date
- Mode
- Status
- Result CTA

---

## 12. AI Customer / Persona Library

Goal:

Make it easy to choose who to practice with.

### Page structure

```text
Khách hàng AI
Search / filters
Persona grid
```

### Persona card

Information priority:

1. Display name
2. Role / customer type
3. Short behavioral summary
4. Difficulty
5. Communication style where available
6. CTA

Suggested card:

```text
┌─────────────────────────────┐
│ Avatar     Anh Quân         │
│            Chủ cửa hàng     │
│                             │
│ Thận trọng, quan tâm giá... │
│                             │
│ Trung bình   •   Giá nhạy   │
│                             │
│ [Luyện tập]                 │
└─────────────────────────────┘
```

Avoid exposing internal persona mechanics.

Do not show raw behavior flags or runtime internals.

---

## 13. Practice Setup

Goal:

Reduce setup friction before training.

### Recommended layout

Two-column on desktop:

```text
Selected Customer       Training Setup
```

Stack vertically on mobile.

### Selected customer

Show concise Persona summary.

### Training mode

Explain modes in plain Vietnamese.

Example:

**Khách hàng mở đầu**  
Khách hàng AI bắt đầu cuộc trò chuyện trước.

**Sale mở đầu**  
Bạn chủ động bắt đầu cuộc trò chuyện.

Use selectable cards or radio-card pattern.

Primary CTA:

```text
Bắt đầu phiên luyện tập
```

---

## 14. Training Chat — Highest Priority Screen

This screen receives the highest design priority.

### Main goal

The conversation must remain comfortable after many messages.

### Desktop layout

Preferred:

```text
┌───────────────────────────────────────────────────────────────┐
│ Session Header                                                │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                Conversation Content                           │
│                                                               │
│ Customer message                                              │
│                                                               │
│                                Sale message                   │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ Composer                                                      │
└───────────────────────────────────────────────────────────────┘
```

Optional secondary panel may exist only if current functionality requires it.

### Message width

Do not stretch messages across the entire screen.

Recommended conversation width:

```text
720–860px
```

### Customer message

Style:

- neutral surface
- left aligned
- subtle border or soft gray bubble

### Sale message

Style:

- right aligned
- `Primary Soft`
- restrained indigo emphasis

### Message bubbles

Customer:

```text
background: #F3F5F7
text: #111827
```

Sale:

```text
background: #EEF2FF
text: #312E81
```

Avoid messenger-style oversized rounded speech bubbles.

### Composer

Composer should feel stable and important.

- sticky bottom
- multiline input
- clear send action
- disabled/loading state
- comfortable touch target

Desktop composer max width should align with conversation content.

### Session header

Show only important state:

- persona
- mode
- session status
- `Kết thúc phiên`

Do not overload with debug metadata.

### Runtime Insight

Keep visually secondary.

If shown:

- subdued panel
- collapsed/compact by default where appropriate
- never compete with messages

### Mobile

Mandatory:

- full-width chat
- sticky composer
- no horizontal overflow
- safe spacing above keyboard
- stop-session action remains accessible

---

## 15. Result Page

Goal:

Turn session output into a clear learning journey.

Avoid one giant vertical wall of equal cards.

### Recommended hierarchy

```text
Session Result
│
├── Result Summary
│
├── Evaluation
│
├── AI Coach
│
└── Next Action
```

Use stronger separation between sections.

### Result header

Show:

- Persona
- Mode
- completion state
- date/time where useful

### Score prominence

If Evaluation exists, overall score may be prominent.

Do not make a score look like a game leaderboard.

---

## 16. Evaluation

Evaluation should answer:

1. How did this session perform?
2. Which criteria were stronger?
3. Which criteria need attention?

### Overall score

Use a clean score display:

```text
78 / 100
```

Optional thin progress ring/bar is acceptable.

Do not use large gaming gauges.

### Criteria

Prefer structured rows/cards:

```text
Khai thác nhu cầu        82
Tư vấn sản phẩm          76
Xử lý băn khoăn          64
Giao tiếp                79
Chốt bước tiếp theo      58
```

Use consistent 0–100 scale.

N/A must display as:

```text
Không áp dụng
```

not zero.

### Strength / improvement areas

Make them easy to scan.

Avoid long repeated evaluator summaries in multiple sections.

---

## 17. AI Coach

AI Coach should feel like an actionable mentor.

Not another analytics dashboard.

### Visual identity

Use subtle AI distinction:

- very light violet/indigo accent
- small icon
- no neon gradient

### Content hierarchy

Recommended:

```text
AI Coach
│
├── Ưu tiên cải thiện
│     ├── Problem
│     ├── Why it matters
│     └── Suggested action / phrasing
│
├── Điểm nên tiếp tục phát huy
│
└── Trọng tâm luyện tập tiếp theo
```

### Coach priority card

Each card should clearly separate:

- skill/topic
- observation
- recommendation
- example phrasing where provided

Avoid displaying raw JSON-like structures.

### Generate state

Do not auto-generate Coach feedback.

Respect existing CTA/state flow.

---

## 18. History

Goal:

Allow rapid scanning of past sessions.

### Desktop

Use compact table/list hybrid.

Columns should prioritize:

- Date
- Persona
- Mode
- Status
- Score if evaluated
- Action

### Mobile

Convert rows into cards.

Do not force horizontal table scrolling.

### Status

Use restrained badges:

- Đang luyện tập
- Hoàn thành

Actions:

Running:

```text
Tiếp tục
```

Completed:

```text
Xem lại
```

---

## 19. Replay

Replay should visually resemble Training Chat but clearly indicate read-only mode.

Add a clear label:

```text
Xem lại phiên luyện tập
```

Do not show active composer.

Messages retain Customer/Sale visual distinction.

Provide clear navigation to:

- Result
- History

---

## 20. Progress Analytics

Goal:

Show development over multiple sessions without becoming a BI dashboard.

### Hierarchy

```text
Tiến độ luyện tập
│
├── Summary
│
├── Xu hướng điểm
│
├── Kỹ năng
│
├── Điểm mạnh / Cần chú ý
│
└── Phiên gần đây
```

### Summary cards

Keep four primary cards:

- Tổng số phiên
- Hoàn thành
- Đã đánh giá
- Điểm trung bình

Secondary text may show:

- recent average
- frequency

### Trend chart

Style:

- clean line chart
- fixed 0–100 scale
- minimal grid
- no gradient-filled chart
- clear textual trend status

### Skill presentation

Prefer one compact skill card/list per criterion.

Each shows:

- label
- average
- recent score
- trend
- sample count where useful

### Highlights

Use two distinct but restrained panels:

```text
Điểm mạnh hiện tại
Cần chú ý
```

Do not call them:

```text
Kỹ năng tốt nhất
Kỹ năng yếu nhất
```

### Low data

Use explanatory text rather than empty charts.

---

## 21. Status & Badge System

Badges should be semantic, compact, and restrained.

### Neutral

```text
background: #F2F4F7
text: #475467
```

### Success

```text
background: #F0FDF4
text: #15803D
```

### Warning

```text
background: #FFFBEB
text: #B45309
```

### Info

```text
background: #EFF6FF
text: #2563EB
```

### Primary

```text
background: #EEF2FF
text: #4338CA
```

Never make every metadata item a badge.

---

## 22. Buttons

### Primary

Use for one dominant action per area.

```text
background: Primary
text: white
```

### Secondary

White/neutral surface with border.

### Ghost

Use for low-priority actions.

### Danger

Use only for destructive/stop actions where appropriate.

### Sizing

```text
Height 36px compact
Height 40px normal
Height 44px important/mobile
```

Avoid pill-shaped buttons by default.

---

## 23. Forms

Inputs should be:

- 40–44px minimum height
- visible labels
- clear focus state
- restrained border
- descriptive errors

Focus:

```text
border Primary
subtle Primary focus ring
```

Avoid floating-label complexity.

---

## 24. Empty States

Empty states should help the user move forward.

Pattern:

```text
Short title
One sentence explanation
Optional primary action
```

Example History:

```text
Chưa có phiên luyện tập
Bắt đầu một phiên để lịch sử luyện tập xuất hiện tại đây.

[Bắt đầu luyện tập]
```

Avoid giant illustrations.

---

## 25. Loading States

Prefer skeletons when layout is known.

Use spinner only for small local actions.

Do not block entire page when one non-critical card is loading.

Example:

Progress API failure must not break Dashboard core.

---

## 26. Error States

Errors should be understandable and recoverable.

Pattern:

```text
Không thể tải dữ liệu
Vui lòng thử lại.

[Thử lại]
```

Do not expose backend error details or stack traces.

---

## 27. Icons

Use existing Lucide icon set.

Rules:

- one icon family only
- icons support labels, not replace them unnecessarily
- typical size 16–20px
- avoid decorative icon overload

---

## 28. Animation

Keep motion subtle.

Allowed:

- 120–200ms hover/focus transitions
- modal transition
- sidebar/mobile drawer
- small loading state

Avoid:

- large entrance animations
- floating decorative objects
- bouncing cards
- animated gradients
- excessive spring effects

---

## 29. Responsive Rules

Mandatory review widths:

```text
Mobile       ~375–430px
Tablet       ~768–1024px
Desktop      1280px+
```

### Mobile priorities

- no horizontal overflow
- minimum touch target ~44px when practical
- one-column forms/cards
- stack stats appropriately
- tables convert to cards when needed
- sticky chat composer remains usable
- page title + actions do not collide

### Tablet

Do not simply stretch mobile layout.

Use two-column layouts where appropriate.

---

## 30. Accessibility

Required:

- meaningful heading hierarchy
- semantic button/link usage
- keyboard navigation
- visible focus state
- sufficient contrast
- form labels
- modal focus handling
- chart textual fallback
- trends not communicated by color alone

---

## 31. Privacy & Data Presentation

Never expose through redesigned UI:

- raw prompts
- raw model responses
- Runtime internals
- guard diagnostics
- raw persona memory internals
- source IDs
- raw dataset identifiers
- auth/session tokens
- cookies
- DB information
- internal provider failures beyond safe user-facing status

Use only safe public DTO fields.

---

## 32. Role / RBAC Visual Boundary

Current role domain may include:

```text
SALE
MANAGER
ADMIN
```

However, the UI redesign must **not invent permissions**.

Rules:

- backend remains authorization authority
- do not add fake Manager/Admin menu items before feature implementation
- do not infer access from visual design
- role-aware UX should follow implemented RBAC behavior only

---

## 33. Implementation Guidance for Antigravity

Before changing code:

1. Read this file completely.
2. Read `docs/ANTIGRAVITY_UI_REDESIGN.md`.
3. Audit current `apps/sales-web` implementation.
4. Reuse existing functionality.
5. Identify reusable UI before introducing new components.
6. Present a redesign plan.
7. STOP and wait for approval.

Do not redesign all pages in one uncontrolled pass.

---

## 34. Recommended UI Implementation Slices

### UI-1 — Design System + Application Shell

Includes:

- color/token normalization
- typography
- spacing/radius
- shared primitives
- sidebar
- app shell
- responsive navigation

Must not change page business behavior.

### UI-2 — Dashboard

Includes:

- page hierarchy
- primary practice CTA
- progress summary
- recent sessions

### UI-3 — Persona Library + Practice Setup

Includes:

- persona cards
- search/filter presentation
- detail presentation
- mode selection
- session start flow

### UI-4 — Training Chat

Highest-priority interaction pass.

Includes:

- session header
- conversation layout
- bubbles
- composer
- loading/state handling
- mobile behavior

### UI-5 — Result + Evaluation + AI Coach

Includes:

- result hierarchy
- score presentation
- criteria
- Coach priority/reinforcement/focus presentation

### UI-6 — History + Replay

Includes:

- history list/table/cards
- status/action hierarchy
- replay read-only conversation

### UI-7 — Progress

Includes:

- stat cards
- trend visualization
- skills
- highlights
- recent evaluated sessions

### UI-8 — Responsive + Accessibility + Regression Polish

Includes:

- desktop/tablet/mobile review
- keyboard/focus
- overflow
- loading/error/empty consistency
- visual consistency cleanup
- regression pass

---

## 35. Validation Requirements Per Slice

Every UI slice must pass:

- TypeScript
- lint
- production build
- existing behavior preserved
- no backend contract change unless separately approved
- no unexpected AI call
- no privacy regression
- desktop review
- tablet review
- mobile review
- no unexpected console error

Do not continue to the next slice after a failed gate.

---

## 36. Final Design Summary

The target TestLab aesthetic is:

> **Intercom-style conversational clarity + Linear-style SaaS structure + Cohere-style AI/data presentation, adapted into one calm and professional internal Sales Training product.**

The end result should feel:

- more mature than the current prototype
- less generic than typical AI-generated dashboards
- easy for Sales staff to learn without technical knowledge
- comfortable for long practice sessions
- consistent across Dashboard, Chat, Result, History, and Progress
- ready for future Training Programs, Assignments, and Admin features without visually redesigning the product again

---

## 37. Non-Negotiables

Do not sacrifice these for visual improvements:

1. Existing working behavior
2. Training Chat readability
3. Responsive/mobile usability
4. Backend authority
5. Privacy boundaries
6. Ownership/auth behavior
7. Evaluation/Coach semantics
8. Progress metric semantics
9. Clear loading/error/empty states
10. Incremental, reviewable implementation

