# TESTLAB UI REDESIGN V3 IMPLEMENTATION BLUEPRINT

**Status:** approved execution blueprint

**Branch:** `feat/testlab-ui-redesign-v3`

**Stable functional branch:** `feat/testlab-v3` (read-only)
**Canonical design authority:** `docs/DESIGN.md`

## 1. Objective

Replace the previous generic indigo/card-heavy presentation with a cohesive TestLab product system while preserving every functional, privacy, authorization, and AI boundary.

Visual direction:

> Zalo communication clarity + Haravan operational UX + corporate EDU hierarchy + TestLab AI training identity.

This is a progressive frontend migration, not a framework rewrite. React, Vite, Tailwind 3, the existing router, contexts, services, and DTOs remain in place.

## 2. Reference principles

### Zalo

- Blue is decisive and familiar, not decorative.
- Conversation is readable, direct, and visually dominant.
- Mobile interaction is compact with obvious touch targets.
- Status and action language is short and concrete.

### Haravan

- Navigation groups mirror operational tasks.
- Management screens optimize scanning, filtering, and repeated work.
- Controls are compact, predictable, and enterprise-appropriate.
- Lists and tables carry information without excessive card decoration.

### Corporate EDU/LMS

- Learning context and next action appear before analytics detail.
- Improvement language is constructive, not punitive.
- Progress, assignment, and completion states are explicit.
- Role boundaries remain understandable without exposing policy internals.

### TestLab-specific

- Training conversation wins space over context panels.
- Evaluation remains the scoring authority; Coach remains advice.
- AI generation is always explicit, never triggered by page render.
- Vietnamese typography and long-form feedback must remain comfortable.

## 3. Real-browser audit basis

The approved audit captured 27/27 route families at:

- desktop `1440×900`;
- tablet `1024×768`;
- mobile `390×844`;
- SALE, MANAGER, ADMIN, public, loading, empty, error, and focused data states where deterministic fixtures allowed.

Temporary evidence lives in `output/playwright/ui-redesign-v3/audit/screenshots/`. Canonical documents do not depend on those files being committed.

### Findings carried into implementation

- Old `#4F46E5` indigo dominates brand, focus, selected navigation, and CTA states.
- Desktop navigation is an ungrouped flat list; Dashboard is not visually separated from training work.
- 1024px switches to the same mobile header instead of a useful collapsed rail.
- Sidebar has no user-controlled collapse and child routes do not consistently describe parent activity.
- Metadata reaches 11px in user identity, below the V3 minimum.
- Card + border + shadow patterns repeat across content and flatten hierarchy.
- Login shows a remember-login control without a verified product contract.
- Mobile content generally stacks safely, but shell context and navigation are too sparse.
- Management pages leave large empty canvases without a strong operational structure.
- Shared Modal lacks the full focus-trap/restoration/scroll-lock contract.

Full evidence is indexed in `docs/ui-redesign-v3/audit/`.

## 4. Role and route matrix

### Public

- `/login`: anonymous only.
- unmatched routes: branded 404 without private data.

### SALE

- `/dashboard`, `/customers`, `/practice/new`, `/practice/:sessionId`, `/practice/:sessionId/result`.
- `/my-training-assignments` and detail.
- `/history` and replay.
- `/progress`, `/leaderboard`.

### MANAGER

- Personal training routes already granted by `USE_OWN_TRAINING`.
- `/training-programs`, `/training-assignments` and allowed descendants.
- `/manage/personas`, `/manage/scenarios` and version/editor descendants.
- `/leaderboard`.

### ADMIN

- Same visible product functionality as permitted by current capabilities.
- No new User Management or System navigation until a real route and approved product slice exist.

All visibility is computed from `authorizationPolicy.ts` through the existing navigation policy. Visual grouping does not create authorization.

## 5. Target information architecture

Dashboard is the first standalone item. The rest is grouped:

- **Luyện tập** — Khách hàng AI, Luyện tập, Bài tập được giao.
- **Theo dõi** — Lịch sử, Tiến độ, Bảng xếp hạng.
- **Quản lý đào tạo** — Chương trình, Phân công.
- **Quản lý nội dung** — Persona, Tình huống.

Groups with no visible child are omitted. SALE sees personal work first. MANAGER/ADMIN retain personal practice and gain only currently authorized management groups.

## 6. Responsive shell strategy

### Desktop `>=1280px`

- 248px expanded sidebar by default.
- User can collapse to 72px; preference is local-only.
- 56px compact topbar and 32px content gutter.

### Tablet `1024–1279px`

- Fixed 72px collapsed rail.
- Accessible tooltip for each icon.
- 24px content gutter.

### Mobile `<1024px`

- 56px topbar and navigation drawer up to 288px.
- Focus trap, Escape, scroll lock, focus restoration, and close-after-navigation.
- 16px content gutter; no bottom navigation.

Shell implementation must leave room for the later Training Room rule: conversation first, context collapsible or drawer-based.

## 7. Page targets

### Login

Foundation slice applies brand, typography, useful product context, authentic form controls, and responsive composition. Authentication behavior is unchanged. Remove unimplemented remember-login UI.

### Dashboard — UI-V3-3

Rebuild information hierarchy around next practice, assigned work, progress preview, recent sessions, and leaderboard preview. Reduce independent cards and keep one primary action.

### Customers + Practice setup — UI-V3-3

Improve persona discovery, filtering, selection, and setup clarity. Preserve current persona/scenario DTOs and session creation behavior.

### My assignments — UI-V3-3

Emphasize due/completion context and next actionable assignment without changing training assignment rules.

### Training Room — UI-V3-4

Give the transcript and composer visual priority. Desktop context may be visible at wide widths; tablet collapses context; mobile uses a drawer. Do not expose Runtime-private state.

### Result + Evaluation + Coach — UI-V3-4

Create a learning sequence rather than an equal-card wall. Scores remain Evaluation-owned; Coach phrasing remains clearly advisory and evidence-grounded.

### History + Replay — UI-V3-5

Use responsive data lists, clearer filters/status, and a read-only replay hierarchy. No automatic AI calls.

### Progress + Leaderboard — UI-V3-5

Use metric strips and scan-friendly analytics. Preserve backend formulas, tie handling, privacy scopes, and low-data semantics.

### Programs + Assignments — UI-V3-6

Adopt operational toolbars, responsive lists, focused editors, and sticky actions where justified. Preserve lifecycle and assignment rules.

### Persona + Scenario management — UI-V3-6

Clarify entity/version relationships and publishing state. Preserve immutable published versions and all existing APIs.

## 8. Component migration

### KEEP

- `Brand`: preserve semantic product identity API; restyle internally.
- `Avatar`: keep behavior and reuse canonical geometry.
- authorization policy and navigation visibility functions.
- business feature components until their assigned slice.

### REFACTOR in UI-V3-2

- `AppLayout` into AppSidebar, AppTopbar, and MobileNavDrawer responsibilities.
- `Button`: V3 color, geometry, focus, pressed, and loading foundation.
- `PageHeader`: V3 type scale and responsive action layout.
- `Badge`: explicit StatusBadge semantics while keeping compatibility.
- `FormControls`: canonical input/focus/error styles.
- `Feedback`: unified loading/empty/error/forbidden foundations.
- `Modal`: dialog semantics, focus trap, Escape, restoration, and scroll lock.

### REPLACE progressively

- generic Card wrappers where Section, Surface, MetricStrip, FormSection, or ResponsiveDataList communicates hierarchy better;
- page-local status pills with `StatusBadge`;
- improvised toolbar rows with `PageToolbar`/`FilterBar`;
- wide mobile tables with `ResponsiveDataList`.

### NEW only when audited

- `AppSidebar`, `AppTopbar`, `MobileNavDrawer`;
- `Surface`, `SectionHeader`, `StatusBadge`, `Skeleton`, `InlineAlert`;
- foundations for `PageToolbar`, `ResponsiveDataList`, `MetricStrip`, `FormField`, and `StickyActionBar`.

Avoid a giant component package or abstractions without current callers.

## 9. Implementation slices

### UI-V3-1 — Design authority and audit documentation

- Rewrite `docs/DESIGN.md`.
- Rewrite this blueprint.
- Create screenshot index, page audit, and reference matrix.
- Commit independently after documentation audit.

### UI-V3-2 — Foundation and App Shell

- Add Be Vietnam Pro Variable.
- Implement canonical tokens through Tailwind and CSS variables.
- Refactor shell/navigation, Login foundation, shared states, and justified primitives.
- Validate role navigation, responsiveness, accessibility, console/network boundaries.
- Commit independently.

### UI-V3-3 — Learner entry surfaces

- Dashboard, Customers, Practice Setup, My Assignments.

### UI-V3-4 — Core learning loop

- Training Room, Result, Evaluation, Coach.

### UI-V3-5 — Review and progression

- History, Replay, Progress, Leaderboard.

### UI-V3-6 — Management operations and final polish

- Programs, Assignments, Persona/Scenario management, cross-page accessibility/regression.

No later slice begins without visual review of the preceding checkpoint.

## 10. Browser review gates

Every slice runs at `1440×900`, `1024×768`, and `390×844` as relevant.

UI-V3-2 acceptance requires:

- Login, Dashboard shell, all three role sidebars;
- expanded desktop, collapsed tablet/user choice, mobile drawer;
- active parent route behavior;
- 403 and 404;
- keyboard focus, drawer focus trap, Escape, restoration, scroll lock;
- no horizontal overflow or unexpected console errors;
- zero Evaluation POST, Coach POST, and unexpected Customer AI calls.

Focused comparison screenshots belong under `output/playwright/ui-redesign-v3/implementation/<slice>/` and are not committed by default.

## 11. API and business compatibility

The redesign changes presentation only. It must not modify:

- backend source, Prisma, migrations, or database data;
- Runtime or Customer AI;
- Evaluation/Coach behavior or triggering;
- Progress, Gamification, or Leaderboard calculations;
- Training Program, Assignment, Persona, or Scenario lifecycles;
- authentication, session, RBAC, ownership, or public DTO contracts.

Selectors may change only when focused browser tests are updated in the same slice without weakening behavioral assertions.

## 12. Validation order

1. Review file scope and privacy-sensitive rendering.
2. Sales Web canonical typecheck.
3. ESLint with zero warnings.
4. Production build and font bundle/network audit.
5. Focused deterministic auth/navigation tests.
6. Real-browser role, viewport, accessibility, console, and network acceptance.
7. `git diff --check`, source classification, and screenshot exclusion.

## 13. Risks and controls

- **Navigation regression:** keep capability policy canonical; test SALE/MANAGER/ADMIN.
- **Drawer accessibility:** deterministic focus/scroll tests plus real keyboard review.
- **Page selector breakage:** preserve semantic labels and update only focused UI selectors.
- **Font weight/bundle growth:** one variable family, one package import, no CDN or static weight set.
- **Scope creep:** page-specific content stays in UI-V3-3 through UI-V3-6.
- **Screenshot churn:** output remains temporary and untracked.

## 14. Definition of done

A slice is done only when its planned source, deterministic checks, real-browser review, business-call audit, Git scope audit, and reviewable commit all pass. Passing documentation alone never proves implementation completion.
