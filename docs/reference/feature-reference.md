# Feature Reference

This page summarizes the major desktop app capabilities at a glance.

## Workspaces

Current:

- `Notes`
- `Todos`
- `Activities`
- `Calendar`
- `Time`

Planned:

- `Assistant`
- `Files`

## Notes Workspace

### Capture modes

- `Meeting note`
- `Quick note`
- `Voice note`

### Shared note concepts

- sessions
- private flag
- templates
- templates are scoped to one capture category each
- people
- domain
- project
- activity
- tags
- attachments
- capture/output split

### Quick creation shortcuts

- `td ...` creates a todo
- `act ...` creates an activity
- `meet ...` creates a meeting activity
- from a linked meeting session, these shortcuts inherit the current work context where possible

## Work Model

Current work structure is now oriented around:

- `Domain`
- `Project`
- `Activity`
- `Todo`
- `Time log`

Current behaviors:

- todos can be linked directly to an activity
- meeting activities can sit under a parent activity
- activities act as the main container for fast follow-up work
- child todos and child meetings can be added from inside the activity detail card
- time logs can be added live or edited retrospectively

## Todos

Current todo capabilities:

- unassigned or activity-linked todos
- quick add with optional activity context
- split execution-focused layout with list + live detail panel
- running timer strip for active todo work
- convert todo to activity
- start/stop time tracking
- manual time-log entry
- retrospective time-log editing and deletion

## Activities

Current activity capabilities:

- top-level task and meeting activities
- child meeting activities under a parent activity
- quick add child todos from the activity detail card
- quick add child meetings from the activity detail card
- meeting-session linking for meeting activities
- activity-level time logs, including retrospective edits
- split work-hub layout with list + live detail panel
- summary cards for open todos, child meetings, and next meeting visibility
- linked meeting-session output preview directly from the activity workspace

## Attachments

Current attachment types in the desktop model:

- audio
- image
- pdf
- document
- transcript

Current user-facing attachment workflows are strongest for:

- audio
- images
- transcript files

## Audio

Current:

- upload audio
- microphone recording
- computer-audio recording
- hybrid microphone + computer-audio recording
- audio transcription

## Images

Current:

- upload image
- preview image
- caption image
- choose whether the image should be included in output

## Output

Current output operations:

- create output
- generate meeting notes
- polish with AI
- transcribe to output
- transcribe and polish
- revise output
- translate output
- export text/markdown/HTML/Word/PDF

## Calendar

Current calendar capabilities:

- full-screen-first planner layout
- remembered calendar UI state such as day span, scale, details width, and full-screen mode
- today as the leftmost column on open
- current time scrolled into view on open
- draggable divider between the grid and details pane
- click-to-create scheduling
- drag-to-move scheduled items
- resize meeting blocks in the grid
- direct editing from the calendar details pane
- optional activity context while creating items directly from the grid
- link todos to an existing activity or set a parent activity for meetings from the details pane
- create or open a linked meeting session from calendar meeting details
- detect whether the linked meeting session already has output
- preview linked session output as a formatted overlay from calendar

## Time

Current time capabilities:

- dedicated time workspace
- active timer summary
- recent logs in one correction surface
- per-day totals
- per-activity totals
- per-project totals
- per-domain totals
- direct open-back into the linked todo or activity
- CSV and Markdown export for reporting readiness

## Notes output follow-up

Current output follow-up capabilities:

- linked activity is visible from the Output workspace when a session belongs to a meeting activity
- follow-up todos can be added directly from Output back into the linked activity

## AI

Current AI capabilities:

- configurable model selection
- prompt-family management
- request diagnostics
- request history
- updateable model/pricing recommendations

## Persistence

Current persistence direction:

- local-first desktop data
- repo/package-level domain models
- SQLite-oriented desktop repository path
- attachment persistence in app data

## Updating

Desktop updating uses:

- GitHub Releases
- Tauri updater flow
- in-app update checking
