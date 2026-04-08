# Work, Structure, and Time

The desktop app now supports a structured work model alongside notes.

The current hierarchy is:

- `Domain`
- `Project`
- `Activity`
- `Todo`
- `Time log`

This model is designed to support two related workflows:

- plan and capture meetings through `Calendar` and `Notes`
- execute and report work through `Activities`, `Todos`, `Time`, and `Structure`

## Structure Workspace

Use `Structure` when you want to manage the reusable work structure more deliberately.

Current uses:

- create new domains
- create new projects
- assign a project to an explicit parent domain
- rename saved domains and projects
- inspect linked activities and todos before drilling further
- jump into filtered `Activities`, `Todos`, or `Time`

`Structure` is for slower setup and review.
Fast daily work creation still happens more naturally in:

- `Calendar`
- `Notes`
- `Activities`
- `Todos`

## Activities Workspace

`Activities` is the current work hub.

Use it for:

- task activities
- meeting activities
- child todos
- child meetings
- linked meeting sessions
- activity-level time tracking

Typical workflow:

1. Create or open an activity.
2. Add child todos or child meetings.
3. If it is a meeting activity, create or open the linked session.
4. Capture notes in `Notes`.
5. Create follow-up work back into the same activity.

## Todos Workspace

`Todos` is the execution surface.

Use it for:

- fast follow-up work
- starting and stopping work timers
- seeing activity context
- correcting time logs in retrospect

Todos can be:

- standalone
- linked directly to an activity

The more common long-term pattern is for todos to belong to an activity.

## Time Workspace

`Time` is the reporting and correction surface.

Current capabilities include:

- running timer visibility
- recent log correction
- per-day totals
- per-activity totals
- per-project totals
- per-domain totals
- totals by workspace
- totals by work type
- period comparison
- saved report presets
- CSV, Markdown, and JSON export

Time logs can be corrected after the fact.
This is important when:

- a user forgets to stop a timer
- start or end time needs adjustment
- notes need to be added to the log

## Calendar and Meetings

Meetings are modeled as activities of type `meeting`.

This means a meeting can:

- live in the calendar
- belong to a project and domain
- have a linked notes session
- generate follow-up todos
- generate time logs

This keeps planning, capture, execution, and reporting aligned instead of splitting meetings into a separate system.
