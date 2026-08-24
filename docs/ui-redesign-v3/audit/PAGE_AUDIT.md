# UI Redesign V3 — Page Audit

## Audit summary

The existing application is functionally broad and generally responsive, but it presents every workflow through the same indigo, bordered-card vocabulary. The V3 redesign should first establish a credible shell and typography, then progressively reshape page hierarchy without altering behavior.

## Cross-product findings

### High priority

- Brand and focus states use deprecated indigo `#4F46E5` rather than TestLab blue `#0068FF`.
- Navigation is a single ungrouped list, so training, monitoring, and management tasks have equal visual weight.
- At exactly 1024px the desktop sidebar disappears; a 72px rail would preserve context and free workspace.
- Drawer/modal accessibility lacks a complete focus-trap, focus-restoration, and body-scroll-lock contract.
- Some user metadata uses 11px text, which is too small for Vietnamese labels.

### Medium priority

- Borders, white cards, and light shadows are stacked too often, reducing hierarchy.
- Page headers, empty states, status pills, toolbars, and form sections are implemented with multiple local patterns.
- Large management canvases do not use operational list/toolbar structure effectively.
- Mobile pages stack correctly but have weak navigation context and inconsistent action placement.

### Preserve

- Existing capability-based navigation visibility.
- Clear primary CTA patterns on Dashboard and empty states.
- Generally safe mobile stacking and sensible page gutters.
- Existing public DTO boundary and explicit AI generation actions.

## Page-by-page findings and targets

### Login

**Observed:** centered card is usable but visually generic; old indigo dominates; supporting copy is small; “remember login” has no confirmed behavior.  
**Target:** V3 blue, Be Vietnam Pro, one real authentication action, restrained EDU context on desktop, direct one-column mobile layout.  
**Slice:** UI-V3-2 foundation only.

### App shell and Dashboard

**Observed:** 240px flat sidebar; all items share one level; user block uses tiny metadata; card stack repeats border + shadow.  
**Target:** standalone Dashboard, grouped navigation, 248/72/drawer behavior, 56px topbar, active parent route, cleaner page canvas. Dashboard content redesign waits for UI-V3-3.  
**Slice:** shell in UI-V3-2; content in UI-V3-3.

### Customers

**Observed:** persona discovery depends on repeated cards and limited scan/filter hierarchy.  
**Target:** clearer library toolbar, persona identity first, concise behavioral summary, one practice CTA.  
**Slice:** UI-V3-3.

### Practice setup

**Observed:** setup works but page structure does not strongly connect selected customer, scenario, mode, and next action.  
**Target:** two-column desktop setup, stacked mobile, plain-language mode selection, persistent primary start action.  
**Slice:** UI-V3-3.

### My training assignments

**Observed:** assignments are functional but status and due/next action compete inside card patterns.  
**Target:** responsive data list with explicit completion state and direct continuation action.  
**Slice:** UI-V3-3.

### Training Room

**Observed:** transcript, runtime context, session chrome, and composer can compete for width; tablet shell leaves little conversation context.  
**Target:** conversation-first workspace, bounded readable messages, stable composer, context visible only at wide desktop and drawer-based on mobile.  
**Slice:** UI-V3-4.

### Result, Evaluation, Coach

**Observed:** sequential sections can become a long wall of visually equal cards; detailed guidance lacks a stronger reading hierarchy.  
**Target:** learning journey with result summary, authoritative Evaluation, advisory Coach, and one next action; suggested phrasing is visually hypothetical.  
**Slice:** UI-V3-4.

### History and Replay

**Observed:** history/replay states are safe but repeated cards do not scale as an operational archive.  
**Target:** responsive data list, compact filters/status, read-only replay timeline, result link where valid.  
**Slice:** UI-V3-5.

### Progress

**Observed:** content is rich but the same boxed surface treatment obscures metric-to-detail hierarchy.  
**Target:** metric strip, trend narrative, criterion comparison, highlights, low-data guidance; no client-side formula changes.  
**Slice:** UI-V3-5.

### Leaderboard

**Observed:** rankings are legible but must avoid consumer-game excess and preserve safe identity exposure.  
**Target:** restrained ranked list, clear current-user context, accessible movement/status, same backend ordering.  
**Slice:** UI-V3-5.

### Training Programs

**Observed:** program list/editor works but long content blocks and persona rows use nested surfaces; action hierarchy varies by viewport.  
**Target:** operational toolbar, responsive list, focused form sections, sticky save foundation where justified.  
**Slice:** UI-V3-6.

### Training Assignments

**Observed:** assignment creation and detail screens contain dense selectors/status in card structures.  
**Target:** guided form sections, responsive target/content lists, explicit immutable state, scoped actions.  
**Slice:** UI-V3-6.

### Persona management

**Observed:** desktop list can leave a very large empty canvas around one bordered card; published/version state lacks operational grouping.  
**Target:** toolbar + responsive data list, clear entity/version context, focused editor width, immutable published state.  
**Slice:** UI-V3-6.

### Scenario management

**Observed:** same structural concerns as Persona management, with linked persona/version information requiring clearer hierarchy.  
**Target:** responsive list/editor and explicit relationship/publishing context.  
**Slice:** UI-V3-6.

### 401 / 403 / 404 and feedback states

**Observed:** semantics are correct, but presentation and accessibility are not fully unified with the shell.  
**Target:** V3 typography/tokens, direct recovery action, preserved auth on 403, accessible loading/error/empty states.  
**Slice:** UI-V3-2.

## Shared component classification

### KEEP

- Brand public API, Avatar, capability policy, navigation policy, existing router and service boundaries.

### REFACTOR

- AppLayout, AuthLayout, Button, PageHeader, Badge, FormControls, Feedback, Modal, PersonaCard styling, AssignmentProgress styling.

### REPLACE progressively

- Generic Card when Section/Surface/List is more semantic.
- Page-local pills, loading blocks, toolbars, and mobile table layouts.

### Add only as justified

- AppSidebar, AppTopbar, MobileNavDrawer, Surface, SectionHeader, StatusBadge, Skeleton, InlineAlert, PageToolbar, ResponsiveDataList, MetricStrip, FormField, StickyActionBar.

## Acceptance priorities

1. Shell breakpoint and role-navigation correctness.
2. Keyboard-safe drawer/dialog behavior.
3. Typography, brand, and focus consistency.
4. No horizontal overflow at target viewports.
5. No render-triggered AI calls or backend/API changes.
6. Progressive card reduction in later page slices.
