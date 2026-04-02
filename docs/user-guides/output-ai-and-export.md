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

## AI Settings

AI behavior is controlled in `Settings`:

- text model selection
- transcription model selection
- prompt families
- reusable prompt blocks
- diagnostics and history

AI settings are intended to stay local to the machine and not be mixed into shared session data files.

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
