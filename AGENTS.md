# Sale TestLab Data Pipeline Rules

## Security

- Raw Zalo data is private and must stay local.
- Never send raw Zalo files to external providers.
- Never expose phone numbers, customer codes, bank info, UNC/PDF or internal operations.

## Workflow

- Always create an implementation plan before editing files.
- Never overwrite raw files.
- Every stage must output to a new folder.

## Pipeline Order

1. parse raw Zalo files
2. normalize messages
3. filter trash/internal/candidate sales
4. split sessions
5. score session quality
6. classify sessions with local model
7. extract customer signals
8. create monthly summaries
9. cluster behaviors
10. draft personas
11. export anonymized runtime personas

## AI Usage

- Use local Gemma E2B for raw data processing.
- Use batch processing.
- Keep prompts schema-based and short.
- Prefer JSON output.

## Validation

- Always test on one sample file first.
- Validate JSON schema outputs.
- Add logs and error handling.
