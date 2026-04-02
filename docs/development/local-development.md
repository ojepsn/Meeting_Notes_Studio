# Local Development

This page explains how to work on the NoteSmith desktop app locally.

## Repo Structure

Important locations:

- root legacy PWA files:
  - `index.html`
  - `app.js`
  - `styles.css`
- desktop app:
  - `apps/desktop`
- shared packages:
  - `packages/domain`
  - `packages/prompts`
- documentation:
  - `docs`

## Recommended Day-to-Day Workflow

Use VS Code or another full IDE and run the desktop app in development mode.

Recommended command from the repo root:

```bash
npm run tauri:dev
```

This is the best workflow for:

- iterative UI work
- AI settings changes
- desktop feature development
- testing capture/output flows quickly

## Other Useful Commands

From repo root:

```bash
npm run desktop:build
npm run tauri:build
```

Desktop workspace commands:

```bash
npm run dev --workspace @notesmith/desktop
npm run build --workspace @notesmith/desktop
npm run test --workspace @notesmith/desktop
npm run tauri:dev --workspace @notesmith/desktop
npm run tauri:build --workspace @notesmith/desktop
```

## Development Guidance

Preferred development rules:

- keep the desktop app as the main long-term target
- avoid putting new major long-term features only into the legacy PWA
- keep AI logic out of UI components where possible
- keep persistence logic out of UI components where possible
- treat docs updates as part of meaningful feature work

## Release Model

Use local dev for fast iteration.

Use GitHub Releases only when you want:

- installable desktop builds
- updater testing
- milestone releases

Do not wait for GitHub Releases for ordinary iterative development.
