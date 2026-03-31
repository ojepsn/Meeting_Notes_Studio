# NoteSmith Desktop Handoff

## Current Product Direction

NoteSmith is evolving from a browser-based meeting and note assistant into a larger local-first desktop work assistant.

Near-term focus:
- keep the current PWA usable
- build a new desktop app alongside it
- preserve strong local-first behavior
- continue expanding AI-driven workflows

Planned product direction:
- sessions and structured notes
- transcription and AI polishing
- todos/tasks
- templates and prompt customization
- attachments such as audio, images, PDFs, and transcripts
- later: calendar and broader assistant workflows

## Target Architecture

Desktop target:
- `React + TypeScript + Tauri + SQLite`

Architecture goals:
- local-first desktop app
- modular AI orchestration layer
- structured persistence in SQLite
- file storage for large assets
- future-ready for mobile and sync, but not dependent on backend now

High-level layers:
1. UI layer
2. feature/domain modules
3. AI service/orchestration layer
4. persistence layer
5. file/attachment layer

Future direction:
- React Native mobile app
- backend sync/API later
- desktop remains local-first even after sync is added

## What Has Already Been Migrated

New desktop app scaffold exists in:
- `apps/desktop`

Shared packages exist in:
- `packages/domain`
- `packages/prompts`

Implemented in the new desktop codebase:
- npm workspace root
- React + TypeScript + Vite desktop frontend
- Tauri shell scaffold
- built-in updater config scaffold for GitHub Releases
- first domain models for:
  - sessions
  - templates
  - todos
  - settings
  - attachments
- repository layer with:
  - browser fallback persistence
  - Tauri SQLite-oriented persistence path
- first desktop UI shell with:
  - capture view
  - output view
  - sessions sidebar
  - templates card
  - todos card
  - settings card
  - backup/import/export card
- import from current browser app local storage into the new desktop app
- first AI services:
  - generate notes
  - revise output
  - translate output
  - transcribe audio
- first file/export services:
  - transcript import
  - attachment metadata
  - text export

## What Remains

Core migration work still to do:
- replace remaining snapshot-like save flow with fully normalized per-entity repositories everywhere
- fully wire real SQLite usage in day-to-day flows
- migrate feature behavior from the current PWA into the new desktop app, including:
  - templates UI and custom template editor
  - prompt settings UI
  - output options and section controls
  - saved participants management
  - abbreviations UI
  - backup/import/export parity
  - audio recording and upload flows
  - large audio chunking
  - attachment persistence beyond transcript import
  - richer export flows
  - AI revision / translate / transcript-only UX parity
- move more logic out of app-level components and into feature services
- add proper AI job tracking and persistence
- add real file storage strategy for recordings and imported files

## Known Blockers

Main blocker on the previous machine:
- Windows Defender blocked Cargo-generated build scripts during `tauri build`
- error seen was `os error 225`

Tooling status from previous machine:
- Rust/Cargo installed
- Microsoft C++ Build Tools installed
- React/Vite build passed
- Tauri native build did not complete because Defender blocked generated build artifacts

Other important note:
- updater public key in `apps/desktop/src-tauri/tauri.conf.json` is still a placeholder
- do not finalize updater setup until release signing keys are intentionally generated and stored safely

## Recommended Next Steps

On the new machine:
1. Clone the repo and install dependencies
2. Verify `npm run build --workspace @notesmith/desktop`
3. Install/verify Rust + Cargo and Visual C++ build tools if needed
4. Verify `npm run tauri:build --workspace @notesmith/desktop`
5. Continue migration in this order:
   - settings and prompt management
   - template system and custom sections
   - AI generation/revision workflows
   - transcript/audio workflows
   - attachment handling
   - export/document generation

Recommended architectural rule going forward:
- UI components should not call OpenAI directly
- UI components should not own persistence logic
- new work should go into feature services and infrastructure modules

Practical short-term goal:
- make the new desktop app feature-complete enough to replace the PWA for daily use
- then continue expanding it as the main product foundation
