# Output, AI, and Export

The `Output` view is where a session becomes a readable, reusable document.

## Output Creation Paths

Different note types use different default output paths.

### Meeting note

Primary path:

- `Generate meeting notes`

Why:

- meetings usually benefit from synthesis, structure, and follow-up extraction

### Quick note

Available paths:

- `Create output`
- `Polish with AI`

Why:

- short notes should not be forced through AI just to exist as output

### Voice note

If transcript text already exists:

- `Create output`
- `Polish with AI`

If the note is audio-only:

- `Transcribe to output`
- `Transcribe and polish`

## AI Features

Current AI-driven workflows include:

- meeting minutes generation
- personal-note and dictation polishing
- revision of existing output
- translation
- audio transcription

Output also now supports reviewed follow-up creation:

- create follow-up todos into the linked activity
- create follow-up meetings into the linked activity
- review bullet-style suggestions before creation
- review arbitrary selected output text before creation
- carry parsed owner/date hints into that review step

## AI Settings

AI behavior is controlled in `Settings`:

- text model selection
- transcription model selection
- prompt families
- reusable prompt blocks
- diagnostics and history

AI settings are intended to stay local to the machine and not be mixed into shared session data files.

## Export Formats

The desktop app can export Output as:

- text (`.txt`)
- markdown (`.md`)
- HTML (`.html`)
- Word (`.docx`)
- PDF (`.pdf`)

When images are marked for inclusion in polished output, Word and PDF export attempt to carry those staged images into the exported document as well.

## Export Layout Presets

`Settings` -> `Output formatting` now includes standardized document layout presets for professional business output.

Current presets:

- `Modern Aptos`
- `Enterprise Sans`
- `Editorial Serif`
- `Board Briefing`
- `Digital Inter`

These presets control:

- title font
- heading font
- body font
- metadata and caption font
- default sizes
- line spacing rhythm

The selected preset is used by:

- Word export (`.docx`)
- PDF export (`.pdf`)
- HTML export (`.html`)

## Follow-up Review

When a session belongs to a linked meeting activity, Output can act as a bridge back into work execution.

Current behavior:

- selected text can be reviewed as either a `Todo` or a `Meeting`
- the user can edit the description before creation
- the user can set a date before creation
- the user can add an owner hint using the same People picker pattern used elsewhere in the app
- created follow-ups stay tied to the linked activity so Calendar, Activities, Todos, and Time remain aligned

## Prompt Families

Prompt management is separated by function:

- meeting minutes
- personal notes and dictation
- shared revision and translation
- reusable extra prompt blocks

This avoids turning the app into one giant general-purpose prompt editor.

## Export

Current export paths in the desktop app include:

- text
- markdown
- HTML

The architecture is also preparing for richer document export, including more structured output and richer attachment/image handling.
