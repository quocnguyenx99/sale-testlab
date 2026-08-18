KNOWN ISSUE — PHASE 7 EVALUATOR

ID:
PHASE7_EVALUATOR_ROBUSTNESS_AND_SEMANTICS

STATUS:
OPEN / DEFERRED FOR MANUAL ACCEPTANCE FOLLOW-UP

SEVERITY:
MEDIUM

CURRENT IMPACT:
Does not invalidate Phase 7 architecture,
but prevents declaring full live manual acceptance fully reliable.

CONFIRMED FINDINGS:

1. Evaluator is designed to evaluate SALE performance,
   not Customer AI performance.

2. Customer turns are intended to provide context/evidence;
   SALE is the evaluation subject.

3. Subject lock is currently only PARTIAL.
   Prompt says to evaluate Sale skills, but does not strongly enforce:
   - Sale is the only evaluation subject;
   - Customer is context only;
   - Customer behavior must not itself be scored;
   - observations must describe concrete Sale behavior.

4. Phase 7 contract is intentionally minimal.
   It is appropriate for:
   - overall score;
   - criterion scores;
   - short summaries;
   - evidence references.

   It is NOT intended to provide deep coaching.
   Deep learning feedback belongs to Phase 8 AI Coach.

5. Strengths / improvementAreas currently reuse criterion summaries.
   They are not a separate rich synthesis layer.

6. Evidence references exist but semantic grounding validation
   is not yet maximally strict.

7. Long sessions are truncated to the latest 60 turns.
   Early discovery/opening context can therefore be omitted
   in sessions longer than 60 turns.

8. One real manual Evaluation attempt failed with:
   INVALID_PROVIDER_RESPONSE.

9. A provider-compatible probe reproduced:
   HTTP 200
   but message.content was not valid parseable JSON.

10. A later retry succeeded.

CURRENT CLASSIFICATION:

EVALUATOR_PROVIDER_STRUCTURED_OUTPUT_INSTABILITY

Secondary observation:

EVALUATOR_SUBJECT_LOCK_PARTIAL

NOT CURRENTLY PROVEN:

- timeout as primary cause;
- DB defect;
- Runtime defect;
- scoring-engine defect;
- Coach defect.

REPAIR STATUS:

DEFERRED.

Do not currently:

- increase timeout;
- modify Runtime;
- modify Coach;
- modify DB schema;
- add permissive JSON repair;
- change evaluator scores/rubric.

REVISIT TRIGGER:

Reopen Phase 7 repair if:

- INVALID_PROVIDER_RESPONSE recurs across real manual sessions;
- evaluator clearly evaluates Customer instead of Sale;
- evidence is demonstrably unrelated to the scored Sale behavior;
- 60-turn truncation materially mis-scores real sessions;
- manual evaluation failure rate becomes operationally meaningful.

EXPECTED FUTURE REPAIR SCOPE:

- strengthen Sale-only evaluator subject instruction;
- improve bounded structured-output robustness if malformed wrappers recur;
- strengthen evidence validation;
- optionally improve evaluator evidence UX.

No Runtime / Customer AI / Coach architectural change expected.
