# AZ-104 structured-answer ID migration handoff

## Goal

Fix incorrect grading for English matching and ordering questions, starting with AZ-104 only. The solution must work in both Practice and Mock Exam, remain correct if the user switches language during an attempt, and avoid a manual edit of question-bank records.

No implementation has been made yet. This document captures the verified problem and recommended implementation.

## Verified problem

The application loads Chinese questions as the canonical bank in `state.questions` and loads English questions separately in `state.questionsEn`.

`getDisplayQuestion(rawQuestion, lang, questionsEn)` returns the English record for rendering when `lang === 'en'`, but the current answer state and grading are still tied to the raw Chinese record.

For a matching question such as `AZ-104 #41`:

```text
English UI lets the user select: Network Contributor on LB1
Chinese grading record expects: LB1 的網路參與者 (Network Contributor on LB1)
```

The current matching and ordering implementations submit visible text values, then use exact string equality. Therefore a correct English choice cannot equal the translated Chinese grading string.

### Relevant code paths

- `src/App.jsx`
  - `getDisplayQuestion`: ~799–806 — chooses the English object only for display.
  - `QuestionInput`: ~2675 onward — matching dropdown values are option text; ordering selections are step text.
  - `computeCorrect`: ~276–300 — Practice compares answer text to the passed question's `correct_answer` / `ordered_steps`.
  - `PracticeTab`: ~2183–2211 — renders `currentQ` (possibly EN), but submits and grades `currentQRaw` (ZH).
  - `SUBMIT_EXAM`: ~569–607 — builds its map from `state.questions` (ZH) and compares submitted text to ZH text.
  - `ExamTab`: ~3477–3559 — renders an English `examQ` when language is EN.

### AZ-104 impact (current bank)

All counts are among the 603 AZ-104 questions that have an EN counterpart.

| Type | Total | English answers that cannot be graded correctly |
|---|---:|---:|
| Single choice | 371 | 0 |
| Multiple choice | 31 | 0 |
| Matching | 182 | 147 |
| Ordering | 19 | 19 |
| Total | 603 | 166 |

Single/multiple choices are safe because their submitted values are stable option keys such as `A`, `B`, and `C`, not localized text.

The bug occurs in **both Practice and Mock Exam**, only when English is displayed, and only for affected structured questions. In Chinese mode it does not occur.

Other subjects have known affected structured English records too, but are explicitly out of scope for the initial implementation:

| Subject | Matching | Ordering |
|---|---:|---:|
| AZ-900 | 139 | 4 |
| SCS-C03 | 4 | 3 |

There is also a separate data-parity problem in `SOA-C02 #340`: the ZH record is an ordering question but its EN counterpart is an empty single-choice simulation. Do not attempt to solve that data issue as part of the AZ-104 migration.

## Design decision

Do **not** grade translated display strings. Store and compare a language-neutral choice ID instead.

Keep existing display text fields to minimize JSON churn, and add optional parallel ID fields:

### Matching schema

```json
{
  "available_options": [
    "Contributor on LB1",
    "Network Contributor on LB1"
  ],
  "available_option_ids": ["opt-1", "opt-2"],
  "matches": [
    {
      "use_case": "To add a backend pool to LB1:",
      "correct_answer": "Network Contributor on LB1",
      "correct_option_id": "opt-2"
    }
  ]
}
```

The matching Chinese record has the same IDs in the same positions, but localized values in `available_options` and `correct_answer`.

### Ordering schema

```json
{
  "available_steps": ["Configure ...", "Create ..."],
  "available_step_ids": ["step-1", "step-2"],
  "ordered_steps": ["Configure ...", "Create ..."],
  "ordered_step_ids": ["step-1", "step-2"]
}
```

Both ZH and EN records use the same `available_step_ids` and `ordered_step_ids`; only the text arrays differ.

The existing text fields should be retained for explanations, backward readability, and a legacy fallback.

## Automated AZ-104 migration

Create a one-time Node script, for example:

```text
scripts/migrate-az104-structured-ids.mjs
```

It should process only the 12 AZ-104 bank files:

```text
public/data/az_104_1_100.json
public/data/az_104_101_200.json
public/data/az_104_201_300.json
public/data/az_104_301_400.json
public/data/az_104_401_500.json
public/data/az_104_501_605.json
public/data/az_104_en_1_100.json
public/data/az_104_en_101_200.json
public/data/az_104_en_201_300.json
public/data/az_104_en_301_400.json
public/data/az_104_en_401_500.json
public/data/az_104_en_501_605.json
```

### Generation algorithm

1. Load all six ZH and six EN AZ-104 files; map each question by `exam-id`.
2. Process only `type === 'matching'` or `type === 'ordering'`.
3. Require an EN counterpart with the same type. Stop with a clear error if absent or mismatched.
4. For a matching question:
   - Give each option its deterministic per-question ID: `opt-1`, `opt-2`, ... in `available_options` order.
   - Resolve each `matches[].correct_answer` to its option index, then write `matches[].correct_option_id`.
   - Do this separately for ZH and EN, then assert that the resulting correct-option ID sequence is identical.
   - Write the same `available_option_ids` sequence to both records.
5. For an ordering question:
   - Give each step `step-1`, `step-2`, ... in `available_steps` order.
   - Resolve `ordered_steps` to IDs and write `ordered_step_ids`.
   - Do this separately for ZH and EN, then assert the ordered ID sequences are identical.
   - Write the same `available_step_ids` sequence to both records.
6. Refuse to write a record where a correct text is missing from the respective available list, a required list is empty, duplicate text makes an answer index ambiguous, or the ZH/EN derived correct-ID sequences differ.
7. Write formatted JSON with the repository's existing formatting style. The script must be idempotent: a second run produces no diff.

### Audit already completed

The current AZ-104 data was checked before this handoff:

- 201 structured AZ-104 ZH/EN pairs total (182 matching, 19 ordering)
- no missing EN counterpart
- no type mismatch
- no mismatch in the position of any correct answer/ordered step between ZH and EN

Therefore deterministic positional IDs are safe for AZ-104 today, provided the migration script retains the stated validation gates.

## App implementation plan

### 1. Normalize structured choices inside `QuestionInput`

Add a small adapter that returns choices shaped like `{ id, text }`.

- Matching: pair `available_option_ids[i]` with `available_options[i]`.
- Ordering: pair `available_step_ids[i]` with `available_steps[i]`.
- The `<select>` value and all `onAnswer(...)` payloads must use IDs, while labels remain localized text.
- Ordering's selection, removal, and reordering logic must operate on step IDs. Render labels by looking up the ID.

For questions with explicit ID fields, `practiceAnswers` and `examAnswers` will therefore contain values such as `opt-2` and `step-3`, rather than translated text.

### 2. Grade IDs in one shared helper

Update `computeCorrect`:

- Matching with `correct_option_id`: compare each submitted ID to that field.
- Ordering with `ordered_step_ids`: compare submitted ID sequence to that field.
- Keep the existing string-based path only as a legacy fallback.

Then refactor `SUBMIT_EXAM` to call `computeCorrect(q, userAns)` instead of duplicating matching/ordering grading logic. This prevents Practice and Mock Exam from drifting apart again.

### 3. Avoid an unsafe fallback for old structured banks

Other subjects will initially have no explicit IDs. Their existing ZH behaviour should remain unchanged.

For a legacy structured question rendered in EN, do **not** silently compare English text with a ZH record. A compatibility adapter may derive temporary IDs from list positions (`opt-1`, `step-1`) only after a validation check proves the paired ZH/EN records have:

- the same question type;
- equivalent option/step position for every correct answer; and
- no ambiguity from duplicate values.

If the pair cannot be validated, use the raw-language structured answer UI (or make it visibly unavailable) rather than marking a correct English answer wrong.

For the initial AZ-104-only change, the minimal safe compatibility behavior is:

- explicit IDs for AZ-104 use the new canonical-ID path;
- other banks retain the existing legacy path;
- do not claim that legacy English matching/ordering is fixed until those subjects are migrated or given a validated positional adapter.

### 4. Language switching

ID answers remain valid if a user switches between ZH and EN mid-question. The component simply renders the selected IDs using the newly selected language's text. This is the reason not to apply the tempting but fragile patch of grading against whichever localized question is currently displayed.

## Validation and tests

Extend `scripts/validate-bank.mjs` or create a focused cross-language validator to check optional structured IDs:

- all IDs are unique within a question;
- array lengths match (`available_options` / `available_option_ids`, `available_steps` / `available_step_ids`);
- every `correct_option_id` is present in `available_option_ids`;
- every `ordered_step_id` is present in `available_step_ids`;
- matching ZH/EN records have the same type and same canonical correct IDs when both have IDs;
- a ZH/EN pair is migrated on both sides or neither. Half-migrated pairs are the failure this scheme exists to prevent: the migrated side renders IDs into the answer while the other side still grades by text, so a perfect answer scores 0 — and because it is a data-only slip it produces no error anywhere else.

Run:

```bash
npm run validate:bank
npm run lint
npm run build
```

Add focused automated tests if the project test layout permits it. At minimum, test `computeCorrect` for:

1. AZ-104 #41: English matching ID answer is correct against the ZH raw record.
2. One AZ-104 ordering question: English ordered IDs are correct against the ZH raw record.
3. An incorrect ID sequence remains wrong.
4. Existing single/multiple choice grading is unchanged.
5. A language switch after selecting a structured answer preserves its selected choice and correct grading.

`test/validateBank.test.mjs` mutation-tests the validator itself by running it
(via `BANK_DATA_DIR`) against throwaway fixture banks: a fully migrated pair
passes, and half-migrated / divergent-canonical-answer pairs fail. Removing a
rule from `validate-bank.mjs` must make one of these tests fail.

Manual browser acceptance checks:

1. Practice, AZ-104 #41, EN: select both English correct values; it is marked correct.
2. Practice, AZ-104 ordering question, EN: correct sequence is marked correct.
3. Mock Exam containing either question, EN: score is correct after submission.
4. Start in EN, answer, switch to ZH before submission: selection remains visible in Chinese and grades correctly.
5. Start in ZH, answer, switch to EN before submission: selection remains visible in English and grades correctly.

## Non-goals for this change

- Do not manually translate or rewrite question text.
- Do not migrate AZ-900, SCS-C03, or other subjects yet.
- Do not solve the independent SOA-C02 #340 type mismatch in this task.
- Do not change single/multiple choice answer schema.

## Repository state at handoff

- `npm run validate:bank` passed before this document was created.
- There was already an untracked user file, `CODEBASE_AUDIT_NOTES.md`; leave it untouched.
