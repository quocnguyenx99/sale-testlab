# AI SALES TESTLAB V3 — ANTIGRAVITY UI REDESIGN BRIEF

## 1. Project

Project:

AI Sales TestLab V3

Repository:

D:/Workspace/sale-testlab-data-pipeline

Frontend:

apps/sales-web

Current stack:

- React
- Vite
- TypeScript
- TailwindCSS
- Lucide icons
- Existing authenticated V3 backend API

This task is a UI/UX redesign.

It is NOT a backend rewrite.

---

## 2. Main Objective

Redesign the entire Sales TestLab frontend so it feels:

- modern
- professional
- clean
- easy to understand
- suitable for internal sales training
- visually consistent
- responsive
- comfortable for daily use

The UI should feel like a polished internal SaaS training product,
not a developer playground.

Priority:

1. Usability
2. Visual hierarchy
3. Consistency
4. Readability
5. Responsive behavior
6. Professional appearance

---

## 3. Critical Boundary

Frontend redesign scope:

apps/sales-web

DO NOT modify backend behavior unless separately approved.

DO NOT modify:

- Runtime behavior
- Customer AI
- Evaluator logic
- AI Coach logic
- Progress analytics formulas
- Prisma schema
- migrations
- authentication semantics
- ownership logic
- API contracts
- /api/v3 behavior

If frontend appears to need a backend change:

STOP

and report the missing backend capability.

Do not change backend automatically.

---

## 4. Existing Features Must Continue Working

The redesign must preserve all current working flows.

Including:

- Login
- Dashboard
- Persona / AI Customer Library
- New Practice setup
- Customer-first mode
- Sale-first mode
- Training chat
- Stop session
- Result
- Evaluation
- AI Coach
- History
- Replay
- Progress Analytics
- Dashboard Progress summary
- Authentication
- Logout

Audit the router/source to confirm exact current routes before changes.

Do not remove working functionality for visual simplicity.

---

## 5. Current Product Roles

Current role domain:

SALE
MANAGER
ADMIN

The redesign must not invent new authorization behavior.

Backend remains authorization authority.

Role-aware management UI belongs to the RBAC roadmap and should not be
invented during this redesign unless already implemented in source.

---

## 6. UX Philosophy

The application should guide the user through:

Dashboard

→ choose training/customer

→ configure training

→ practice conversation

→ finish session

→ see result

→ evaluate performance

→ receive AI Coach feedback

→ review progress/history

The user should always understand:

- where they are
- what they should do next
- what state the session is in
- how to return to previous work
- what action is primary

Avoid information overload.

---

## 7. Design System

Before redesigning individual pages, define a small reusable design system.

Audit existing Tailwind setup first.

Define/reuse:

- colors
- typography
- spacing
- radius
- shadows
- cards
- buttons
- badges
- inputs
- tabs
- modal/dialog
- empty states
- skeleton/loading
- error states
- page headers
- content widths

Prefer reusable components.

Do not create page-specific styling everywhere.

Do not introduce a large UI framework unless separately approved.

---

## 8. Visual Direction

Desired direction:

Modern enterprise SaaS.

Clean and light.

Professional but not boring.

Use strong hierarchy and whitespace.

Avoid:

- excessive gradients
- excessive glassmorphism
- neon UI
- gaming dashboard appearance
- overly dense admin tables
- too many unrelated colors
- huge decorative elements
- unnecessary animations

Animations should be subtle and functional.

---

## 9. Main Navigation

Audit current AppLayout.

Redesign navigation so primary areas are easy to understand.

Likely product areas include:

- Tổng quan
- Khách hàng AI
- Luyện tập
- Lịch sử
- Tiến độ

Use current routes as authority.

Do not create fake menu items for future features.

Navigation must work on:

desktop
tablet
mobile

---

## 10. Dashboard

Goal:

Give the Sale a clear starting point.

Dashboard should prioritize:

- greeting / current context
- primary CTA to start practice
- recent sessions
- progress summary
- useful training state

Do not turn Dashboard into a dense analytics console.

Progress API failure must remain non-blocking.

---

## 11. AI Customer Library

Make personas easy to browse.

Consider:

- search
- clear persona card hierarchy
- role/customer type
- difficulty
- communication style
- concise preview
- clear CTA to practice

Do not expose private persona/runtime internals.

Use only existing safe DTO fields.

---

## 12. Practice Setup

Make session setup simple.

The Sale should clearly understand:

- selected customer
- training mode
- what the mode means
- how to start

Avoid unnecessarily complex forms.

Primary CTA must be obvious.

---

## 13. Training Chat

This is the most important screen.

Design for long daily usage.

Prioritize:

- conversation readability
- clear Sale vs Customer distinction
- comfortable message width
- timestamps/status only when useful
- sticky input area
- session state
- easy stop/finish action

Runtime Insight should remain secondary to the conversation.

Do not allow insight panels to overpower the chat.

Responsive mobile chat is mandatory.

Do not modify message generation behavior.

---

## 14. Result

Result screen should have strong information hierarchy.

Suggested flow:

Session result

→ performance summary

→ Evaluation

→ AI Coach

Avoid one extremely long wall of cards.

Use grouping, sections and progressive disclosure where useful.

Do not hide essential results behind unnecessary interaction.

---

## 15. Evaluation

Preserve current evaluator semantics.

UI should make it easy to understand:

- overall score
- criteria
- strengths
- improvement areas
- evaluation state

Do not recalculate scores in frontend.

Backend data is authoritative.

---

## 16. AI Coach

Coach should look action-oriented rather than analytical.

Prioritize:

- what to improve
- why
- what to do
- suggested phrasing
- next practice focus

Keep suggestion cards easy to scan.

Do not automatically generate Coach feedback.

Existing CTA/state behavior must remain unchanged.

---

## 17. History / Replay

History should be easy to scan.

Important information:

- date
- customer/persona
- mode
- status
- result/evaluation summary where already available

Running session:
continue training

Completed session:
view replay/result

Do not change ownership behavior.

---

## 18. Progress

Preserve existing backend analytics.

Main sections:

- summary
- overall trend
- skills
- strongest area
- needs attention
- recent evaluated sessions

Charts must remain readable on small screens.

Do not create new analytics formulas in frontend.

---

## 19. Responsive Requirements

Mandatory breakpoints:

Desktop
Tablet
Mobile

Every page must be reviewed in all three.

No horizontal overflow.

Tables must adapt or become cards on mobile.

Chat input must remain usable with mobile keyboard.

Navigation must not consume excessive screen area.

---

## 20. Accessibility

Maintain:

- keyboard navigation
- visible focus
- semantic buttons/links
- form labels
- accessible modal behavior
- readable contrast
- textual state indicators

Do not communicate important information using color alone.

---

## 21. Data / Privacy Boundary

Never expose:

- raw prompts
- raw model responses
- Runtime internals
- guard diagnostics
- full persona internals
- source customer identifiers
- exact private stock data
- database credentials
- auth tokens
- cookies
- raw dataset content

Frontend may only use existing public DTOs.

---

## 22. Technical Rules

Prefer:

existing React/Vite/Tailwind architecture

small reusable components

existing API clients

existing DTO contracts

existing router

existing authentication

Avoid:

major dependency migration

Next.js migration

state-management rewrite

backend rewrite

API rewrite

large architecture refactor

unless separately approved.

---

## 23. Implementation Strategy

DO NOT redesign every page immediately.

First:

1. Audit existing frontend.
2. Capture current page inventory.
3. Identify shared UI patterns.
4. Propose design tokens.
5. Propose shell/navigation redesign.
6. Propose page-by-page redesign plan.
7. Show plan.
8. STOP and wait for approval.

After approval implement incrementally.

Preferred slices:

UI-1
Design system + application shell

UI-2
Dashboard

UI-3
Persona Library + Practice Setup

UI-4
Training Chat

UI-5
Result + Evaluation + AI Coach

UI-6
History + Replay

UI-7
Progress

UI-8
Responsive/accessibility/regression polish

Do not implement all slices in one uncontrolled change.

---

## 24. Validation

For each UI slice:

- TypeScript PASS
- lint PASS
- build PASS
- existing behavior preserved
- desktop review
- tablet review
- mobile review
- no Console errors
- API calls unchanged unless approved
- no new AI calls caused by rendering
- privacy boundary preserved

---

## 25. Git Policy

Work on a dedicated UI branch.

Do not rewrite history.

Do not force push.

Do not mix unrelated backend feature development into UI redesign.

Use small reviewable commits after each approved UI slice.

---

## 26. First Task

Your FIRST task is PLAN ONLY.

Audit the existing frontend.

Do not modify files.

Return:

# TESTLAB UI REDESIGN AUDIT

## Current page inventory

## Current design system

## Current shared components

## UX problems

## Visual consistency problems

## Responsive problems

## Pages ranked by redesign priority

## Proposed design direction

## Proposed design tokens

## Proposed component system

## Proposed navigation

## Page-by-page redesign plan

## Files likely affected

## Dependencies required

## Risks

## Validation plan

## Recommended UI implementation slices

## FINAL VERDICT

Return ONE:

UI_REDESIGN_PLAN_READY

UI_REDESIGN_REQUIRES_PRODUCT_DECISION

UI_REDESIGN_REQUIRES_BACKEND_CHANGE

UI_REDESIGN_BLOCKED

Then STOP.

Wait for approval.
