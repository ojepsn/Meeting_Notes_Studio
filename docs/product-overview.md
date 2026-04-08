# Product Overview

NoteSmith is evolving from a browser-based note app into a local-first desktop work assistant.

Its current primary focus is helping users:

- capture meetings, calls, quick notes, and voice notes
- combine typed notes with transcript material
- generate polished output documents
- move from calendar planning into note capture and back again
- organize work through domains, projects, activities, and todos
- report and review time with editable time logs
- manage prompt settings and AI behavior
- store work locally on the machine first

## Product Direction

The desktop app is now the strategic direction.

Current product priorities:

- calendar-to-notes workflow for meetings
- meeting note capture
- quick written notes
- voice-note capture and transcription
- AI-assisted meeting minutes
- AI-assisted note polishing
- structured work execution around activities and todos
- local time reporting and correction
- images and attachments
- prompt and model control

Planned future expansion:

- assistant workflows
- files and references
- Outlook calendar import
- richer reporting and dashboards
- future sync/mobile support

## Core Product Model

The app now has two closely connected daily workflows:

- `Calendar -> Notes` for meetings and scheduled work
- `Activities -> Todos -> Time` for execution and reporting

The `Notes` workspace is still the main capture/output surface and uses explicit capture modes:

- `Meeting note`
- `Quick note`
- `Voice note`

Every note session has two broad phases:

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

## Work Model

The current work structure is:

- `Domain`
- `Project`
- `Activity`
- `Todo`
- `Time log`

Important relationships:

- projects can now be linked explicitly to a parent domain
- todos can belong directly to an activity
- meeting activities can have child todos, child meetings, and a linked notes session
- calendar items schedule either todos or activities
- time logs record work against either a todo or an activity

This model supports the main product loop:

- schedule a meeting in Calendar
- create and open a linked session in Notes
- capture and polish output
- create follow-up todos or meetings back into the linked activity
- track execution time through Todos, Activities, and Time

## Current Workspaces

Current active workspaces are:

- `Notes`
- `Todos`
- `Activities`
- `Calendar`
- `Time`
- `Structure`

These are not separate mini-products. They are intended to work as one system:

- `Calendar` for planning and timing
- `Notes` for capture and output
- `Activities` for structured work hubs
- `Todos` for fast execution
- `Time` for reporting and corrections
- `Structure` for domains and projects

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
