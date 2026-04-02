# Testing Strategy

This page defines the testing direction for the NoteSmith desktop app.

## Rule Going Forward

Meaningful app changes should include:

- code changes
- relevant documentation updates
- unit tests for changed logic where feasible
- verification by running the relevant test and build commands

This is now the default expectation for ongoing work.

## Current State

The desktop app already has meaningful unit-test coverage in the AI support layer, especially around:

- prompt resolution
- model pricing
- runtime behavior
- status mapping
- message formatting
- metrics
- request history
- OpenAI client behavior

Current command:

```bash
npm run test --workspace @notesmith/desktop
```

## Current Gaps

The biggest untested areas are currently:

- app-level workflow orchestration in `App.tsx`
- state logic in `useDesktopStore.ts`
- repository behavior in `lib/db/repository.ts`
- file/attachment flows in `lib/files/attachmentStore.ts`
- legacy migration behavior in `lib/storage/migrateLegacy.ts`
- export service behavior in `lib/export/exportService.ts`
- feature-level UI logic in:
  - `SessionEditor`
  - `OutputWorkspace`
  - `SettingsCard`
  - `PeoplePicker`
  - `SessionsSidebar`
  - `TodosCard`
  - `TemplatesCard`

These areas are where product regressions are most likely to happen.

## Testing Priority Order

### Priority 1: product-critical logic

Add or expand tests for:

- prompt-family selection by capture mode
- output action selection logic
- audio-recording and transcription flow helpers
- people parsing/suggestion rules
- repository normalization and migration logic

### Priority 2: persistence and file behavior

Add tests for:

- attachment record mapping
- persisted attachment handling helpers
- settings normalization
- local snapshot/repository behavior

### Priority 3: UI-level interaction tests

Add component tests for:

- `PeoplePicker`
- `SessionEditor`
- `OutputWorkspace`
- `SettingsCard`

These should focus on real user behavior, not implementation details.

## Practical Standard

When implementing a new feature:

- test pure logic directly
- test boundary/service logic where regressions would be expensive
- test UI interaction when the feature changes user workflow materially

Avoid writing large brittle tests that mostly duplicate implementation details.

## Verification Workflow

Preferred verification for desktop changes:

```bash
npm run test --workspace @notesmith/desktop
npm run build --workspace @notesmith/desktop
```

When relevant:

```bash
npm run tauri:dev
```

## Future Direction

The long-term target is for the desktop app to have reliable coverage across:

- AI services
- persistence
- file/attachment logic
- session/output workflow logic
- key UI interactions

The goal is not test quantity for its own sake.
The goal is confidence when the app evolves quickly.
