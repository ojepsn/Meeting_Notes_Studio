# Settings Reference

The desktop app uses one unified `Settings` entry point with multiple internal sections.

## AI Settings

Purpose:

- configure AI behavior and model selection

Includes:

- API key
- text model selection
- transcription model selection
- model recommendations
- model pricing refresh

## AI Diagnostics

Purpose:

- give visibility into AI activity and reliability

Includes:

- request totals
- success rate
- cache hits
- retries
- recent request history

## Themes

Purpose:

- control desktop appearance

Current curated theme families:

- `Fluent Slate`
- `Atlas Blue`
- `Graphite Forest`
- `Stone Olive`
- `Nordic Teal`
- `Copper Ink`

Each supports:

- `Light`
- `Dark`

## Output Formatting

Purpose:

- control output-level defaults

Includes:

- output language
- default desktop template
- standardized document layout presets for export styling

Current output layout presets:

- `Modern Aptos` for the most balanced modern Microsoft-style business output
- `Enterprise Sans` for compact executive and board-facing documents
- `Editorial Serif` for more formal, premium client-ready notes
- `Board Briefing` for denser briefing packs and leadership updates
- `Digital Inter` for digital-first product and operations teams

These presets are used when exporting Output to Word and PDF, so document typography stays consistent with the user’s selected formatting preference.

## People & Labels

Purpose:

- keep reusable people and classification values in one place

Includes:

- saved people
- saved domains
- saved projects
- saved activities
- saved tags
- abbreviations

These saved values are used by session capture and suggestion flows.

## Other Upcoming Settings

### Default Capture UI

The desktop app lets the user choose the default Capture presentation:

- `Full` for the complete editor
- `Minimal` for a reduced writing-first capture surface

This is the default only. Inside the Notes workspace, the user can still switch between `Minimal` and `Full` directly from the Capture header.

### Default Output UI

The desktop app also lets the user choose the default Output presentation:

- `Full` for the complete output workspace
- `Minimal` for a calmer document-first editing surface

This is the default only. Inside the Notes workspace, the user can still switch between `Minimal` and `Full` directly from the Output header.
New People, Domains, Projects, and Activities can be entered directly in notes, then saved here for future reuse after Output is created.

## Prompts

Purpose:

- manage prompt families for AI-driven workflows

Includes:

- meeting-minutes prompts
- personal-notes and dictation prompts
- revision rules
- translation rules
- reusable extra prompt blocks
- `Load latest recommended prompts`

## Templates for meetings/notes

Purpose:

- manage built-in and custom note structures

Templates define:

- capture fields
- output sections
- template-specific instructions
- one top-level category: `Meeting note`, `Quick note`, or `Voice note`

Templates only appear inside their own top-level category.
In Settings, users create new templates from inside the relevant category, such as meeting templates under `Meeting note` or voice templates under `Voice note`.
Built-in templates are editable, and the app also provides a `Restore default templates` action to return the template library to the shipped defaults.

## Other Upcoming Settings

Purpose:

- hold settings and maintenance actions that should not clutter the primary note workflow

Currently includes:

- check for updates
- import current browser app data
- export backup file
- create local safety backup
- open data folder
- open database folder
- exact storage paths for:
  - database
  - attachments
  - local backups
