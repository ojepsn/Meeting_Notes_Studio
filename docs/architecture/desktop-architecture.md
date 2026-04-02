# Desktop Architecture

The desktop app is the strategic product foundation for NoteSmith.

## Stack

- `React`
- `TypeScript`
- `Vite`
- `Tauri`
- `SQLite`

## Architectural Goals

- local-first behavior
- desktop-quality workflows
- modular AI integration
- structured persistence
- future-ready for mobile and sync

## High-Level Layers

### UI layer

Located mainly under:

- `apps/desktop/src/app`
- `apps/desktop/src/features`
- `apps/desktop/src/components`

Responsibilities:

- workspace shell
- overlays
- forms
- interaction flows

### Feature/domain layer

Feature areas include:

- sessions
- output
- todos
- templates
- settings

Responsibilities:

- task-specific workflows
- UI and feature logic close together

### AI layer

Located mainly under:

- `apps/desktop/src/lib/ai`

Responsibilities:

- model selection
- prompt resolution
- generation
- revision
- translation
- transcription
- diagnostics and history

### Persistence layer

Located mainly under:

- `apps/desktop/src/lib/db`

Responsibilities:

- local snapshot/repository access
- SQLite schema and access
- settings normalization
- compatibility with earlier saved data

### File/attachment layer

Located mainly under:

- `apps/desktop/src/lib/files`

Responsibilities:

- selecting files
- persisting files into app data
- loading saved files
- attachment metadata mapping

## App Shell

The desktop app uses a stable shell:

- left workspace rail
- center canvas
- right inspector
- overlay panels for secondary tools

This shell is designed to stay consistent as future workspaces are added.

## Why Local-First

The desktop app is designed so that users can:

- capture notes quickly
- keep data on-device
- work offline or semi-offline
- use the app as a serious daily desktop tool

Future sync and mobile support can be layered on later without discarding the local-first model.
