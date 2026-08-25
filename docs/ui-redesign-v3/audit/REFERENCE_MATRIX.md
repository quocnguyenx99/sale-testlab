# UI Redesign V3 — Reference Matrix

External products are principles, not pixel-copy sources. Existing TestLab behavior always wins.

| TestLab area | Zalo principle | Haravan principle | Corporate EDU principle | V3 implementation rule |
| --- | --- | --- | --- | --- |
| Brand | decisive familiar blue | consistent operational accent | credible institutional tone | `#0068FF` primary; no indigo/purple gradient |
| Typography | high Vietnamese readability | compact labels and tables | calm long-form learning copy | Inter Variable with Vietnamese subset; 12px metadata minimum |
| App shell | mobile clarity | grouped operational navigation | learner context persists | 248px / 72px / drawer at canonical breakpoints |
| Primary navigation | direct destinations | task-based groups | learning before administration | Dashboard standalone; training, tracking, management groups |
| Mobile navigation | obvious drawer action | compact workspace | maintain learning context | max 288px drawer; no bottom nav; full keyboard contract |
| Buttons | clear action color | compact predictable controls | one next learning action | 8px radius; 40–44px; hover/pressed/focus/disabled |
| Forms | familiar field rhythm | efficient repeated entry | supportive validation | visible labels, inline recovery, focused form width |
| Data lists | readable conversation/contact rows | scan-friendly operations | status and next step visible | ResponsiveDataList; tables only for real comparison |
| Surfaces | low visual noise | hierarchy without decoration | content grouping by lesson purpose | spacing first; border or shadow, not both by default |
| Status | short textual states | stable operational vocabulary | constructive progress language | semantic StatusBadge with text/icon, no color-only state |
| Dashboard | direct next action | concise operational summary | continue learning and progress | shell now; hierarchy rebuilt in UI-V3-3 |
| Customer/persona | contact identity clarity | filterable inventory | practice context | identity and behavior summary before CTA |
| Practice setup | simple conversation entry | structured configuration | clear learning objective | selected customer + setup; plain-language modes |
| Training Room | conversation dominates | contextual panel is secondary | uninterrupted deliberate practice | chat-first widths; context collapses before transcript |
| Evaluation | readable feedback | structured scan | scoring authority and criteria | no client scoring; progressive detail |
| Coach | concise message guidance | actionable structured output | constructive improvement/refinement | advisory presentation; suggestions look hypothetical |
| Progress | direct summaries | data-density discipline | evidence of development over time | metric strip + narrative; backend formulas unchanged |
| Leaderboard | recognizable identity | ranked operational list | motivation without punishment | restrained ranking, safe identity, no casino visuals |
| Management | direct controls | toolbar/list/editor patterns | curriculum governance | operational layouts; lifecycle/API unchanged |
| Empty/error | direct language | clear recovery | supportive next step | one real action; no blame, no fake data |
| Accessibility | readable mobile interaction | keyboard-efficient controls | inclusive learning access | skip link, focus visibility, trap/restoration, reduced motion |

## Conflict resolution

When references disagree, use this order:

1. Existing TestLab business, privacy, auth, and AI behavior.
2. `docs/DESIGN.md` canonical V3 rules.
3. This implementation blueprint and approved real-browser audit.
4. The reference principles above.
5. Designer preference.

## Explicit exclusions

- Do not copy Zalo chat chrome or consumer social behaviors.
- Do not copy Haravan branding, commerce terminology, or dense desktop-only assumptions.
- Do not add generic LMS course catalogs, certificates, curricula, or gamification beyond implemented TestLab features.
- Do not introduce dark mode, a new UI framework, decorative animation, or AI-purple aesthetics in V3 foundation.
