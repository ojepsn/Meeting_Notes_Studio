# Product Overview

NoteSmith is evolving from a browser-based note app into a local-first desktop work assistant.

Its current primary focus is helping users:

- capture meetings, calls, quick notes, and voice notes
- combine typed notes with transcript material
- generate polished output documents
- manage prompt settings and AI behavior
- store work locally on the machine first

## Product Direction

The desktop app is now the strategic direction.

Current product priorities:

- meeting note capture
- quick written notes
- voice-note capture and transcription
- AI-assisted meeting minutes
- AI-assisted note polishing
- images and attachments
- prompt and model control

Planned future expansion:

- tasks
- calendar
- assistant workflows
- files and references
- future sync/mobile support

## Core Product Model

The app is organized around a single `Notes` workspace with explicit capture modes:

- `Meeting note`
- `Quick note`
- `Voice note`

Every session has two broad phases:

- `Capture`
- `Output`

This is a foundational product rule:

- `Capture` is where rough input is gathered
- `Output` is the readable working/final document for the session

AI may improve the output, but `Output` is not limited to AI-generated content.

Current desktop UX direction:

- keep the center canvas for the primary task only
- make one primary action obvious in each workspace state
- move secondary tools into the inspector, overlays, or disclosures
- prefer calm minimal presentations by default, with deeper controls available on demand

## Desktop App Direction

The long-term desktop foundation is:

- `React`
- `TypeScript`
- `Tauri`
- `SQLite`

The desktop app is local-first by design:

- local settings
- local data
- local attachments
- local desktop workflows

Future mobile and sync are planned, but not required for the desktop app to function well.

## Legacy PWA

The original browser-based PWA still exists in the repo root and remains useful as a historical and transitional implementation.

The desktop app now lives in:

- `apps/desktop`

The long-term goal is for the desktop app to become the main daily-use product foundation.
