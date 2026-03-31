# NoteSmith Desktop Migration Blueprint

This repository now contains the first scaffold for the future desktop app in `apps/desktop`.

## Current direction

- Keep the existing PWA untouched as the live production/prototype version.
- Build the future desktop app alongside it.
- Use `React + TypeScript + Tauri + SQLite`.
- Keep the architecture local-first, but sync-ready later.

## Foundation already scaffolded

- root npm workspace
- desktop React/Vite app
- Tauri shell with updater plugin configured for GitHub Releases
- SQLite-oriented repository abstraction
- first migrated domain slices:
  - sessions
  - templates
  - todos
  - settings

## Immediate next milestones

1. Install JavaScript dependencies and verify the Vite app runs.
2. Install Rust / Cargo and verify the Tauri shell builds locally.
3. Replace the temporary snapshot persistence with full SQLite repositories per entity.
4. Migrate the capture, output, and settings workflows feature-by-feature from the current PWA.
5. Move audio, attachments, and AI jobs into dedicated desktop services.

## Update flow

The Tauri app is scaffolded to use the built-in updater with GitHub Releases.

Before production use, update:

- `apps/desktop/src-tauri/tauri.conf.json`
- replace `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`
- publish signed updater artifacts through GitHub Releases

## Important note

This first pass is intentionally a foundation, not a full feature parity rebuild yet.
