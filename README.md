# NoteSmith

Professional note capture, AI polishing, export, and PWA installability in a single browser app.

## Overview

NoteSmith helps users capture rough business notes, combine manual writing with live transcript text, and turn that material into structured, professional output. It works as a static web app, supports installation as a PWA, and stores sessions locally in the browser.

## Screenshots

### Desktop workspace

![NoteSmith desktop workspace](./screenshots/notesmith-main.png)

### Mobile layout

![NoteSmith mobile layout](./screenshots/notesmith-mobile.png)

## Feature matrix

| Area | Included |
| --- | --- |
| Capture | Manual notes, live transcript, quick highlights, participants, meeting date, start time, end time |
| Categories | `Meeting`, `Personal Note`, plus user-created custom templates |
| AI | OpenAI API key support, model selection, output language selection, custom instructions, detail slider |
| Output structure | Executive summary, highlights, decisions, action items, custom headers |
| Revision loop | Improve polished output from user comments and revert to previous version |
| Local storage | Sessions, settings, themes, export styles, custom templates, AI catalog snapshot |
| Session management | Create, edit, delete, import, export, save to local file |
| Exports | Word and PDF export with configurable document typography |
| Appearance | Multiple light/dark themes and saved preferences |
| Installability | PWA manifest, service worker, install icons, offline app shell caching |

## Key capabilities

### Capture

- Write manual notes while dictation continues in a separate live transcript field
- Save sessions automatically in browser storage
- Reopen previous sessions from the Recent Sessions rail
- Add quick highlights to bias the polished result toward important takeaways

### Categories and templates

- `Meeting`
  - includes participants, meeting schedule, highlights, transcript, and manual notes
- `Personal Note`
  - hides participants and quick highlights
  - defaults the title to a timestamped personal note name
- Custom templates
  - define which input fields are visible
  - add template-specific AI instructions
  - add template-specific extra headers

### AI polishing

- Connect an OpenAI API key in `AI Settings`
- Choose among cost-eligible OpenAI models
- See model usage guidance and pricing
- Control output language:
  - same as notes
  - Swedish
  - English
- Control output detail level
- Add extra per-session instructions
- Add custom section headers with instructions for the AI
- Keep output focused on business discussion and exclude small talk or private matters

If no API key is present, the app falls back to a local formatting pass.

### Output refinement

- Generate a polished version from the captured notes
- Add comments describing how the output should be improved
- Create an updated version from those comments
- Revert to the previous polished version if needed

### Export

- Export the current polished session to Word
- Export the current polished session to PDF
- Choose from five document typography presets:
  - Modern Aptos
  - Enterprise Helvetica
  - Editorial Georgia
  - Refined Garamond
  - Digital Inter
- Create and save a personal export style

### Themes

- Modern Olive
- Classic Blue SaaS
- Teal Enterprise
- Graphite Forest

Each theme supports both light and dark appearance modes.

## PWA install and use

### What the PWA gives you

- installable app-like experience on desktop and mobile
- separate app window on supported desktop browsers
- home screen install on mobile
- cached core app shell for faster repeat loads

### Install on Windows or Mac with Chrome/Edge

1. Open the deployed app URL over HTTPS.
2. Look for the install icon in the address bar, or open the browser menu.
3. Choose `Install NoteSmith` or `Install app`.
4. Launch it from the desktop, taskbar, or app launcher.

### Install on Android

1. Open the deployed app in Chrome.
2. Open the browser menu.
3. Tap `Add to Home screen` or `Install app`.
4. Confirm the install.

### Install on iPhone or iPad

1. Open the deployed app in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.
4. Confirm the install.

### Update behavior

When a new version is deployed, the installed PWA updates automatically in the background. Users usually see the new version after refreshing the app or closing and reopening it.

## Local data and backup

The app stores data in browser local storage, including:

- sessions
- settings
- export style preferences
- selected theme
- custom templates
- cached AI model catalog data

For backup and transfer, users can:

- export all sessions as JSON
- import sessions from JSON
- save sessions directly to a local file on supported desktop browsers

## Running the project locally

This project is a static web app.

### Simple option

Open `index.html` in a browser.

### Recommended option

Serve the folder from a local web server so the PWA behavior is closer to production.

Examples:

```bash
# any static file server works
# example with npx
npx serve .
```

Then open the local URL in a modern browser.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html` | Main UI, modals, templates, and app shell |
| `styles.css` | Layout, themes, cards, responsive behavior, modal styling |
| `app.js` | Session management, AI integration, dictation logic, output generation, export handling, PWA registration |
| `manifest.webmanifest` | PWA metadata |
| `service-worker.js` | App shell caching and offline support |
| `icons/` | Install icons for the PWA |
| `screenshots/` | README screenshots |

## Current limitations

- AI requests are sent directly from the browser using the user's API key
- speech recognition support varies by browser and device
- local browser storage is not a substitute for cloud sync
- live model catalog refresh depends on browser access to official OpenAI docs pages
- some platform-specific browser APIs behave differently across desktop and mobile

## Future directions

- move AI calls behind a backend
- add optional cloud sync
- expand collaboration and sharing workflows
- add richer pre-export editing controls
- allow even deeper template-level output customization
