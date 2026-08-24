# TESTLAB UI DESIGN SYSTEM V3

> Canonical visual authority for AI Sales TestLab V3. This document supersedes the previous indigo/card-heavy direction. Product behavior, API contracts, authorization, AI behavior, scoring, privacy, and data ownership remain authoritative outside this document.

## 1. Product philosophy

TestLab is a daily sales-practice workspace, not a marketing site or a game dashboard. Its interface combines:

- Zalo-inspired communication clarity: familiar rhythm, readable conversation, decisive blue actions.
- Haravan-inspired operational UX: compact navigation, predictable management patterns, scan-friendly lists.
- Corporate EDU/LMS hierarchy: clear learning context, progress language, and calm guidance.
- TestLab identity: AI-assisted training that feels credible, private, and controlled.

The product should feel focused, dependable, contemporary, and distinctly Vietnamese. Prefer useful hierarchy over decoration and direct language over promotional copy.

## 2. Non-negotiable boundaries

- Frontend renders existing public DTOs; it never recalculates Evaluation, Progress, XP, leaderboard, or Coach decisions.
- Role and navigation visibility derive from the existing capability policy.
- A visual render must not trigger Evaluation, Coach, or Customer AI calls.
- Never expose prompts, model responses, auth/session data, Runtime internals, private persona sources, or database fields outside public DTOs.
- Do not add fake controls. A visible control must perform a real, accessible action.

## 3. Color system

### Brand

| Token | Value | Use |
| --- | --- | --- |
| `brand` | `#0068FF` | primary action, active navigation, selected control |
| `brand-hover` | `#0059DE` | pointer hover |
| `brand-pressed` | `#004BC2` | pressed/active |
| `brand-soft` | `#EAF2FF` | active row, selected background |
| `brand-subtle` | `#F3F7FF` | low-emphasis brand surface |

The former `#4F46E5` indigo is deprecated as a primary color. Do not introduce purple gradients or a second competing accent.

### Neutral

| Token | Value |
| --- | --- |
| `canvas` | `#F5F7FB` |
| `surface` | `#FFFFFF` |
| `surface-subtle` | `#F8FAFC` |
| `surface-elevated` | `#FFFFFF` |
| `ink` | `#172033` |
| `ink-secondary` | `#667085` |
| `muted` | `#98A2B3` |
| `border` | `#E4E9F0` |
| `border-strong` | `#D0D7E2` |

Use one cool-neutral family throughout. Do not mix warm-gray cards into the blue-neutral shell.

### Semantic

| Meaning | Strong | Soft |
| --- | --- | --- |
| Success | `#087A55` | `#ECFDF3` |
| Warning | `#B54708` | `#FFFAEB` |
| Danger | `#B42318` | `#FEF3F2` |
| Info | `#175CD3` | `#EFF8FF` |

Semantic colors communicate actual state, never decoration. Pair every color signal with text or an icon. Focus uses a visible `#0068FF` ring with sufficient separation from the surface.

## 4. Typography

Use only **Be Vietnam Pro Variable**, self-hosted through `@fontsource-variable/be-vietnam-pro`. Runtime font CDN requests are forbidden.

| Role | Size / line | Weight | Notes |
| --- | --- | --- | --- |
| Page title | 30 / 38 | 700 | tracking `-0.025em`, balanced wrap |
| Section title | 20 / 28 | 650–700 | sentence case |
| List/card title | 15–16 / 24 | 600 | concise |
| Body | 14 / 22 | 400 | default reading text |
| Form/table | 14 / 20 | 400–600 | labels 500 |
| Metadata | 12 / 18 minimum | 400–600 | never 10–11px |
| Metric | 28–36 | 700 | tabular numerals |
| Chat | 15 / 22 | 400–600 | optimized for long sessions |

Use `text-wrap: balance` for short headings and `text-wrap: pretty` for prose. Avoid all-caps except compact navigation group labels with deliberate tracking.

## 5. Spacing and geometry

Use a 4px base with an 8px primary rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48.

- Button/input: 8px radius.
- Small badge/tag: 6px radius.
- Semantic card/surface: 12px radius.
- Dialog/drawer: 16px radius.
- Avoid 20–32px rounding on routine enterprise UI.

Borders separate adjacent regions. Shadows communicate elevation. A normal surface should not automatically combine border and shadow.

Approved shadows:

- dropdown: compact blue-tinted elevation;
- dialog/drawer: stronger blue-gray elevation;
- sticky/floating action or chat composer: only when separation is otherwise unclear.

## 6. Motion

- Default transition: 160ms; allowed range 140–180ms.
- Animate `transform`, `opacity`, color, and shadow only.
- Pressed controls may translate by 1px or scale to 0.98.
- No decorative entrance sequences or new animation library.
- Under `prefers-reduced-motion: reduce`, remove non-essential transitions and smooth scrolling.

## 7. Application shell

### Breakpoints

- `>=1280px`: 248px expanded sidebar by default.
- `1024–1279px`: 72px collapsed rail.
- `<1024px`: sidebar becomes a drawer, maximum width 288px.

These breakpoints are shell-owned. Pages must not independently invent competing navigation breakpoints.

### Sidebar

- Dashboard is the first standalone primary item.
- Remaining items are grouped by user task, with 12px minimum group labels.
- Nav row is 40px; icon is 18px.
- Active state uses `brand-soft`, brand-hover text/icon, and a 3px left indicator.
- Expanded/collapsed preference may be stored in local storage only.
- Collapsed items expose accessible names and tooltips.
- User identity and logout remain visible without crowding the main navigation.

Canonical groups:

1. Dashboard / Tổng quan.
2. **Luyện tập**: Khách hàng AI, Luyện tập, Bài tập được giao when available.
3. **Theo dõi**: Lịch sử, Tiến độ, Bảng xếp hạng.
4. **Quản lý đào tạo**: Chương trình, Phân công.
5. **Quản lý nội dung**: Persona, Tình huống.

Only render items allowed by the existing role/capability policy. A child route highlights its parent item.

### Topbar

- Height 56px.
- Mobile menu trigger below 1024px.
- Compact page/context title and user/role context where useful.
- Do not duplicate sidebar navigation.
- Use a border only where it clarifies scroll separation; avoid persistent heavy shadow.

### Content layout

- Desktop gutter 32px, tablet 24px, mobile 16px.
- Standard content maximum 1280px.
- Analytics/management maximum 1360px.
- Focused forms 880–960px.
- Training room uses a workspace layout rather than a generic container.
- Do not wrap every page in a Card.

## 8. Navigation and role emphasis

SALE prioritizes personal training, assigned work, history, progress, and leaderboard. MANAGER and ADMIN retain current personal functionality plus authorized management groups. The frontend does not create permissions or infer access from labels.

The shell must support conversation priority in later slices:

- `>=1280px`: chat dominant with optional visible context.
- `1024–1279px`: context collapsed by default.
- `<1024px`: full-width chat with context in a drawer.

## 9. Buttons and icon controls

- Primary: brand background, white text, one dominant action per region.
- Secondary: neutral surface and border; never compete with primary.
- Tertiary: text/ghost action for low-emphasis navigation.
- Danger: use only for destructive intent with explicit label.
- Height: 36px compact, 40px default, 44px touch-prominent.
- Icon-only controls require accessible name, tooltip when meaning is not obvious, and at least 40px mobile target.
- Hover, pressed, disabled, loading, and focus-visible states are mandatory.

## 10. Inputs and forms

- Labels remain visible; placeholder is an example, not the label.
- Controls use 8px radius, 40–44px height, and clear focus/error styling.
- Error text sits next to the field and explains recovery.
- Group related fields in `FormSection`; do not place every field in a separate card.
- Keep server validation authoritative and preserve entered values on recoverable errors.

## 11. Tables, lists, and responsive data

- Use tables only when column comparison is essential.
- Headers remain readable, optionally sticky for long datasets.
- On mobile, convert each row into a semantic data list item; do not horizontally squeeze wide desktop tables.
- Toolbars own search/filter/action controls and wrap without overflow.
- Row actions are keyboard accessible and remain associated with their record.

## 12. Surfaces and card reduction

Choose the lightest container that communicates hierarchy:

- `Section`: spacing and heading, no box by default.
- `Surface`: neutral grouped region, optional border or elevation—not both by default.
- `ResponsiveDataList`: repeated records.
- `MetricStrip`: compact related metrics on one surface.
- `PageToolbar`: search, filter, and actions.
- `FormSection`: related form fields.

Cards are appropriate for independently actionable entities, selected content, or clear elevation. Avoid nested cards, equal card towers, and decorative card wrappers around page headers.

## 13. Status badges

Badges use explicit semantic variants: neutral, info, success, warning, danger, and brand. Use sentence case, 12px minimum text, 6px radius, and stable vocabulary. Never use color alone or invent a new status on the client.

## 14. Dialogs and drawers

Required behavior:

- semantic `dialog` with accessible title/description;
- focus moves inside on open and is trapped;
- Escape closes when dismissal is safe;
- closing restores focus to the trigger;
- body scroll is locked while open;
- overlay click behavior is explicit;
- drawer is mobile-safe and no wider than 288px for navigation.

Prefer inline disclosure for simple edits. Do not add a third-party UI framework solely for modal behavior.

## 15. Chat

Conversation is the visual priority. Use 15/22 text, bounded readable bubbles, persistent composer, and restrained blue for the Sale side. Runtime/context information remains secondary. Suggested Coach phrasing must look like an example, never a historical turn.

## 16. Metrics and analytics

- Use tabular numerals and existing backend labels.
- Present a compact metric strip before detailed trends.
- Do not turn training performance into casino/game visuals.
- Missing data is `Chưa có dữ liệu`, never a fabricated zero.
- Charts require textual summaries and accessible labels.

## 17. System states

### Loading

Use layout-shaped skeletons and stable dimensions. Authentication checking may use a compact branded loading state. Do not flash protected content.

### Empty

Explain what is absent, why it matters, and provide one real next action when available. Empty state is not an error.

### Error and retry

Use direct language, a safe message, and a scoped retry action. Never expose internal endpoints, prompts, stack traces, or credentials.

### 401, 403, 404

- 401 follows existing authentication behavior.
- 403 preserves authentication and offers a safe route back.
- 404 explains that the page is unavailable and provides navigation.
- All states use the same typography, focus, and spacing foundations.

## 18. Login

Login uses a clean enterprise EDU composition, V3 blue, and the canonical font. Desktop may include a restrained product-support panel; mobile remains one focused column. Avoid a marketing hero, fake remember-login behavior, and authentication contract changes.

## 19. Responsive behavior

- Design from 320px upward; target acceptance viewports are 390×844, 1024×768, and 1440×900.
- No page-level horizontal overflow.
- Touch targets should be at least 40px, preferably 44px for primary mobile actions.
- Keep action hierarchy when controls stack.
- Dialogs become safe drawers/full-width panels when space requires it.
- Training conversation receives space before context panels.

## 20. Accessibility

- Provide a skip link to the primary content.
- Every route has one meaningful `h1`.
- Keyboard order follows visual order.
- Focus indicators are always visible.
- Drawer/dialog focus trap, Escape, restoration, and scroll lock are required.
- Icons have accessible names; decorative icons are hidden from assistive technology.
- Meet WCAG AA contrast for text and controls.
- Do not rely on color, hover, or motion alone.

## 21. Shared component policy

Create primitives only when an audited page needs them. Preferred foundation: AppSidebar, AppTopbar, MobileNavDrawer, Breadcrumbs, PageHeader, SectionHeader, Surface, StatusBadge, PageToolbar, ResponsiveDataList, FormField, Skeleton, InlineAlert, EmptyState, ErrorState, ForbiddenState, Dialog/Drawer, and StickyActionBar.

Keep business-specific presentation near its feature. Do not create a giant abstract design library.

## 22. Do / don't

### Do

- prioritize readable Vietnamese;
- use one clear primary action;
- separate sections with spacing before adding boxes;
- use capability-driven navigation;
- preserve backend authority and explicit DTO allowlists;
- test desktop, tablet, mobile, keyboard, console, and network behavior.

### Don't

- use old indigo as the brand;
- combine border + shadow on every surface;
- use 10–11px metadata;
- add fake controls, dead links, or decorative animation;
- create nested cards or equal card grids by habit;
- hide inaccessible navigation using hard-coded role copies;
- trigger AI generation on render;
- redesign business workflows inside a visual slice.

## 23. Implementation and review gates

Each UI slice must pass Sales Web typecheck, lint, production build, focused deterministic tests, real-browser review at all three target widths, console/network audit, and `git diff --check`. Each slice stays reviewable and must not mix backend changes.

The page-by-page delivery sequence and audit evidence are defined in `docs/ANTIGRAVITY_UI_REDESIGN.md` and `docs/ui-redesign-v3/audit/`.
