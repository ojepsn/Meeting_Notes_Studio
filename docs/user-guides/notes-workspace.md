# Notes Workspace

The `Notes` workspace is the main working area of the desktop app.

It is designed around one stable shell:

- left workspace rail
- center workspace canvas
- right inspector

Secondary tools such as Settings, Sessions, To-dos, and Back-up open as overlays so the main workspace stays focused.

## Capture Modes

The Notes workspace supports three explicit capture modes.

### Meeting note

Use this for:

- meetings
- calls
- interviews
- structured minutes

Typical fields:

- title
- private toggle
- top-level audio capture
- expandable meeting details:
  - people
  - domain
  - project
  - activity
  - tags
  - date
  - start time
  - end time
- manual notes
- transcript
- highlights
- attachments

Default expectation:

- the final output is usually AI-generated meeting minutes

### Quick note

Use this for:

- short typed notes
- lightweight work notes
- personal notes

Typical fields:

- title
- private toggle
- main note body
- optional date/time/people/domain/project/activity/tag details

Default expectation:

- the user can create output directly or polish it with AI

### Voice note

Use this for:

- dictation
- spoken reflections
- audio-first note capture

Typical fields:

- title
- private toggle
- top-level audio capture
- dictation/transcript field
- optional written note
- audio recording/upload

Default expectation:

- the user can transcribe to output or transcribe and polish

## Capture and Output

Each session has two workspace views:

### Capture

This is where rough material is collected:

- top-level audio capture for meeting and voice sessions
- typed notes
- transcript text
- images
- audio
- people
- domain
- project
- activity
- tags
- time/date context

### Output

This is where the session's document is shaped:

- title and note details can still be edited here
- direct output creation
- AI polishing
- translation
- revision
- export

## Templates

Templates are scoped inside capture modes.

Examples:

- meeting templates
- 1:1 / phone call
- personal note
- voice memo

Each template belongs to one top-level category only, so a meeting template cannot appear inside `Quick note` or `Voice note`, and vice versa.

New templates are created in Settings inside the matching category:

- meeting templates under `Meeting note`
- note templates under `Quick note`
- voice templates under `Voice note`

Both built-in and custom templates can be edited in Settings. If needed, the built-in template set can be restored to the shipped defaults.

The capture mode defines the workflow.
The template defines the structure inside that workflow.

## People

The `People` field supports:

- search
- typeahead selection
- recent/frequent suggested people behind an expandable disclosure
- adding new people into the session
- Enter, comma, and semicolon as quick add actions

After generation, the app can suggest saving newly seen people into the shared `People` database if they are not already stored.

`Domain`, `Project`, and `Activity` follow the same pattern:

- search and typeahead from saved values
- recent/frequent suggestions
- free entry for new values
- prompt to save new values into the reusable app lists after Output is created

## Private Notes

Each session can be marked as `Private` in both `Capture` and `Output`.

This is useful when:

- the note should stay out of normal public-facing session lists
- you want to separate sensitive personal or confidential notes from ordinary work notes

In `All Sessions`, you can filter:

- public notes
- private notes
- or both together

## Domain, Project, Activity, and Tags

The Notes workspace also supports lightweight classification metadata:

- `Domain`
- `Project`
- `Activity`
- `Tags`

Best-practice usage in the app:

- use `Domain` for the top-level business area behind the note
- use `Project` for recurring work streams you want to sort and revisit often
- use `Activity` for the concrete stream of work inside the project or domain
- use `Tags` for flexible cross-cutting labels such as initiatives, activities, themes, or temporary tracking labels

These fields use the same modern picker pattern as `People`:

- type to search saved values inline
- click recent/frequent suggestions from an expandable mini-card
- add new values directly from the input
- save newly used values for reuse after Output is created
