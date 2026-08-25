# UI Redesign V3 — Screenshot Index

This index records the approved real-browser audit. The PNG files are temporary working evidence under `output/playwright/`; canonical design documentation remains valid if those artifacts are later removed.

## Capture profile

- Desktop: `1440×900`
- Tablet: `1024×768`
- Mobile: `390×844`
- Total captures: 324
- Safe fixture interception: used for deterministic states
- Database writes: none
- Evaluation POST / Coach POST / Customer AI: none

## Logical index

| ID | Route or flow | Role/state | Viewports | Temporary audit path pattern |
| --- | --- | --- | --- | --- |
| AUTH-01 | `/login` | public / unauthenticated | desktop, tablet, mobile | `screenshots/public/{viewport}/*login*` |
| AUTH-02 | `/dashboard` auth restore | SALE/MANAGER/ADMIN fixture | desktop, tablet, mobile | `screenshots/public/{viewport}/*auth-contract-dashboard*` |
| AUTHZ-01 | protected management route | SALE / forbidden | desktop, tablet, mobile | `screenshots/public/{viewport}/*role-aware*` |
| SHELL-01 | `/dashboard` | SALE | desktop, tablet, mobile | `screenshots/public/{viewport}/*dashboard*` |
| SHELL-02 | `/dashboard` | MANAGER | desktop, tablet, mobile | `screenshots/public/{viewport}/*role-aware-dashboard*` |
| SHELL-03 | `/dashboard` | ADMIN | desktop, tablet, mobile | `screenshots/public/{viewport}/*role-aware-dashboard*` |
| CUSTOMER-01 | `/customers` | SALE / persona list | desktop, tablet, mobile | `screenshots/sale/{viewport}/*persona-setup-customers*` |
| PRACTICE-01 | `/practice/new` | SALE / setup | desktop, tablet, mobile | `screenshots/sale/{viewport}/*persona-setup-practice-new*` |
| PRACTICE-02 | `/practice/:sessionId` | SALE / active chat | desktop, tablet, mobile | `screenshots/sale/{viewport}/*training-chat*` |
| RESULT-01 | `/practice/:sessionId/result` | SALE / deterministic result | desktop, tablet, mobile | `screenshots/sale/{viewport}/*session-result*` |
| EVAL-01 | `/practice/:sessionId/result` | SALE / Evaluation completed | desktop, tablet, mobile | `screenshots/sale/{viewport}/*evaluation*` |
| COACH-01 | `/practice/:sessionId/result` | SALE / Coach states | desktop, tablet, mobile | `screenshots/sale/{viewport}/*coaching*` |
| HISTORY-01 | `/history` | SALE / list and empty states | desktop, tablet, mobile | `screenshots/sale/{viewport}/*history-replay-history-*` |
| REPLAY-01 | `/history/:sessionId` | SALE / running/completed replay | desktop, tablet, mobile | `screenshots/sale/{viewport}/*history-replay-history-sess*` |
| PROGRESS-01 | `/progress` | SALE / low and populated data | desktop, tablet, mobile | `screenshots/sale/{viewport}/*progress-redesign*` |
| LEADERBOARD-01 | `/leaderboard` | SALE/MANAGER/ADMIN fixture states | desktop, tablet, mobile | `screenshots/public/{viewport}/*gamification-leaderboard*` |
| PROGRAM-01 | `/training-programs` | MANAGER/ADMIN | desktop, tablet, mobile | `screenshots/public/{viewport}/*training-programs-training-programs-nav*` |
| PROGRAM-02 | `/training-programs/new` | MANAGER/ADMIN / editor | desktop, tablet, mobile | `screenshots/public/{viewport}/*training-programs-new*` |
| PROGRAM-03 | `/training-programs/:programId` | MANAGER/ADMIN / saved program | desktop, tablet, mobile | `screenshots/public/{viewport}/*phase10b-program*` |
| ASSIGN-01 | `/training-assignments` | MANAGER/ADMIN | desktop, tablet, mobile | `screenshots/public/{viewport}/*training-assignments*` |
| ASSIGN-02 | `/training-assignments/new` | MANAGER/ADMIN / create | desktop, tablet, mobile | `screenshots/manager/{viewport}/custom-training-assignments-new.png` |
| MYASSIGN-01 | `/my-training-assignments` | SALE | desktop, tablet, mobile | `screenshots/sale/{viewport}/custom-my-training-assignments.png` |
| PERSONA-01 | `/manage/personas` | MANAGER/ADMIN / list | desktop, tablet, mobile | `screenshots/manager/{viewport}/custom-manage-personas.png` |
| PERSONA-02 | `/manage/personas/new` and version routes | MANAGER/ADMIN / editor/version | desktop, tablet, mobile | `screenshots/manager/{viewport}/custom-manage-personas-*.png` |
| SCENARIO-01 | `/manage/scenarios` | MANAGER/ADMIN / list | desktop, tablet, mobile | `screenshots/manager/{viewport}/custom-manage-scenarios.png` |
| SCENARIO-02 | `/manage/scenarios/new` and version routes | MANAGER/ADMIN / editor/version | desktop, tablet, mobile | `screenshots/manager/{viewport}/custom-manage-scenarios-*.png` |
| NOTFOUND-01 | unmatched route | public/authenticated 404 | desktop, tablet, mobile | captured during role-aware navigation audit |

## Interpretation notes

- The first directory is capture classification, not a security claim. Several deterministic authenticated fixture runs are stored under `public` because they originated in public/auth browser scripts.
- Filenames preserve the source acceptance script, route fragment, sequence, and action (`goto`, `nav`, or `scripted`).
- Repeated screenshots represent different deterministic states or navigation paths; they are intentionally summarized into logical IDs above.
- No screenshots are approved as production assets.

## Implementation acceptance inventory

These captures were produced after the corresponding local implementation checkpoint. They remain temporary, untracked evidence under `output/playwright/ui-redesign-v3/implementation/`.

### UI-V3-3 — learner activation and brand

- `ui-v3-3/brand-login-1440.png`
- `ui-v3-3/brand-login-390.png`
- `ui-v3-3/learner-dashboard-1440.png`
- `ui-v3-3/learner-mobile-nav-390.png`
- Persona Library, Practice Setup and learner assignment flows are additionally covered by the deterministic `persona-setup-browser.py` and `training-assignments-browser.py` acceptance scripts.

### UI-V3-4 — training and feedback

- `ui-v3-4/training-room-1440.png`
- `ui-v3-4/training-room-390.png`
- `ui-v3-4/result-before-evaluation-1440.png`
- `ui-v3-4/result-evaluation-coach-1440.png`
- `ui-v3-4/result-390.png`

### UI-V3-5 — progress and history

- `ui-v3-5/history-1280.png`
- `ui-v3-5/replay-1280.png`
- `ui-v3-5/replay-390.png`
- `ui-v3-5/progress-1280.png`
- `ui-v3-5/progress-390.png`
- `ui-v3-5/leaderboard-1280.png`
- `ui-v3-5/leaderboard-390.png`

### UI-V3-6 — training operations and managed content

- `ui-v3-6/program-list-768.png`
- `ui-v3-6/program-editor-1280.png`
- `ui-v3-6/program-editor-390.png`
- `ui-v3-6/assignment-detail-1280.png`
- `ui-v3-6/assignment-list-1280.png`
- `ui-v3-6/assignment-list-390.png`
- `ui-v3-6/persona-management-1280.png`
- `ui-v3-6/persona-version-1280.png`
- `ui-v3-6/scenario-management-1280.png`
- `ui-v3-6/scenario-management-390.png`
- `ui-v3-6/scenario-version-1280.png`
- `ui-v3-6/scenario-version-390.png`

All implementation acceptance runs used safe API fixtures, reported no unexpected console errors, and asserted zero automatic Customer AI, Evaluation or Coach calls where those boundaries applied.
