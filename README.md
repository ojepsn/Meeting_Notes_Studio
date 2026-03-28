# NoteSmith

NoteSmith is a lightweight browser-based meeting notes app inspired by products like Granola. It helps capture rough notes during a conversation and turns them into cleaner, more professional-looking meeting notes that are easier to review and share.

## What the app does

- Captures raw meeting notes in a simple writing workspace
- Supports browser-based dictation when speech recognition is available
- Lets you add quick highlights and meeting participants
- Offers multiple note templates such as general meetings, standups, client calls, 1:1s, and interviews
- Saves note sessions locally in the browser
- Generates polished notes with sections like:
  - Executive Summary
  - Highlights
  - Discussion Points
  - Decisions
  - Action Items

## How it works

The app currently runs entirely in the browser with no backend.

- Raw notes, metadata, and session history are stored in `localStorage`
- The polished output is generated with client-side formatting logic in JavaScript
- Speech capture uses the browser `SpeechRecognition` API when supported

## Project files

- `index.html` - app structure and UI layout
- `styles.css` - visual design and responsive styling
- `app.js` - note session management, formatting logic, and dictation support

## Running the app

Because this is a static web app, you can run it by opening `index.html` in a browser.

For the best experience:

- Use a modern Chromium-based browser for speech recognition support
- Keep the tab active while dictation is running

## Current limitations

- Notes are only stored locally in the current browser
- Dictation depends on browser support and may not work everywhere
- The note polishing is rule-based, not powered by an LLM yet
- There is no authentication, syncing, export workflow, or backend storage

## Next improvements

- Connect the polish step to an LLM for higher-quality summaries
- Add export to Markdown, PDF, or email-ready formats
- Support audio uploads or live meeting transcription
- Add cloud sync and user accounts
- Add richer editing controls for polished notes

## Goal

This version is a strong prototype for a professional meeting notes product: fast to open, easy to use during a call, and focused on turning messy input into structured output.
