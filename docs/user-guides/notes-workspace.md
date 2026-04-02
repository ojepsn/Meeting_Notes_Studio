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
- people
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
- main note body
- optional date/time/people details

Default expectation:

- the user can create output directly or polish it with AI

### Voice note

Use this for:

- dictation
- spoken reflections
- audio-first note capture

Typical fields:

- title
- dictation/transcript field
- optional written note
- optional audio recording/upload

Default expectation:

- the user can transcribe to output or transcribe and polish

## Capture and Output

Each session has two workspace views:

### Capture

This is where rough material is collected:

- typed notes
- transcript text
- images
- audio
- people
- time/date context

### Output

This is where the session's document is shaped:

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

The capture mode defines the workflow.
The template defines the structure inside that workflow.

## People

The `People` field supports:

- search
- typeahead selection
- recent/frequent suggested people
- adding new people into the session

After generation, the app can suggest saving newly seen people into the shared `People` database if they are not already stored.
