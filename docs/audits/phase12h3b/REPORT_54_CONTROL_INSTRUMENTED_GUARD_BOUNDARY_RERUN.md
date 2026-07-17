# REPORT 54 - CONTROL Instrumented Guard Boundary Rerun

Timestamp: 2026-07-17

## Checkpoint

- REPORT_53 checkpoint: `2d2dc92`.
- Production repository integrity: source unchanged; only local `.playwright-cli/` remains untracked.
- No production prompt, guard policy, model parameter or Variant D change was made.

## Static call order

`handleChatEnriched` calls local Qwen, then interleaves free-form repetition/response-bank routing,
repeated-topic handling, reopened-topic handling, completion recovery, safety guards, buyer-role lock
and final generic-fallback validation. `applySafetyGuards` itself can perform identity/product-context
repairs or fallback. The response bank can be selected at multiple earlier branches.

## Instrumentation status

The production API exports only final aggregate reason labels. It has no snapshot after each modifying
branch. A temporary source copy is required to add hash-only snapshots at the actual branch points;
deriving a first boundary from final labels would be invalid.

No CONTROL live rerun was performed in this report because the required instrumentation was not yet
present. Running it without snapshots would repeat REPORT_52's attribution problem.

## Required temporary observer contract

The temporary copy must emit, for one invocation only: original candidate hash, a snapshot after each
reply-changing branch, function and reason family, source transition, final hash and pairing IDs.
It must synthetically validate safe preservation, candidate/state intervention, identity/completion/final
guard actions, missing snapshot, pairing mismatch and earliest-modification selection before Qwen runs.

## Decision

- CONTROL pairs tested under exact-boundary instrumentation: 0.
- Observer schema/pairing errors: not applicable; live observer not constructed.
- Repeatable defect: not proven.
- Narrow patch scope: none.
- Local Qwen calls: 0. External/cloud AI calls: 0.

## Next action

Create the prescribed temporary instrumented runtime copy and validate its synthetic trace suite before
the six-slot CONTROL rerun. Do not touch production files, do not run Variant D and do not run larger
gates first.

## Verdict

`OBSERVER_INSTRUMENTATION_INCOMPLETE`
