# Documentation Strategy

This page explains how NoteSmith documentation is structured and maintained.

## Goals

The documentation should:

- help end users understand how to use the app confidently
- help developers understand how the app is built
- help future AI-assisted development by keeping the repo readable and searchable
- scale as the product grows from a meeting-note tool into a broader desktop work assistant

## Best-Practice Principles

The documentation approach follows current common guidance from Google, Microsoft, and Write the Docs:

- write for scanning, not for long uninterrupted reading
- separate guides, reference, and architecture instead of mixing all three
- keep docs close to the code in the repository
- update docs together with major product and architecture changes
- prefer clear headings, explicit terminology, and stable page structure
- optimize docs for both human readers and AI-assisted discovery

## Documentation Model

NoteSmith docs are divided into four layers:

### 1. Product Overview

High-level pages that answer:

- what the app is
- who it is for
- what workflows it supports
- how the product is evolving

### 2. User Guides

Task-oriented pages that answer:

- how to capture a meeting note
- how to record or upload audio
- how to generate output
- how to work with AI settings and prompt families

### 3. Reference

Reference pages answer:

- what each setting does
- what each capture mode supports
- what each feature includes
- what the current app can and cannot do

### 4. Architecture and Development

Technical pages answer:

- how the desktop app is structured
- how AI prompting and runtime logic work
- how persistence, attachments, and release automation work
- how to build, run, and release the app

## Writing Guidance

When adding or updating documentation:

- start with the user or developer question the page is answering
- keep the most important explanation near the top
- use short sections and meaningful headings
- avoid mixing implementation detail into user guides unless it materially helps the user
- avoid vague wording like "stuff", "things", or "basically"
- prefer explicit terms such as `Capture`, `Output`, `People`, `Prompt families`, or `Audio attachments`

## Maintenance Rule

For NoteSmith, documentation should be updated when one of these changes:

- a user-facing workflow changes
- a settings section changes
- a feature is added or removed
- architecture meaningfully changes
- release/build/update behavior changes

If a change is too small to warrant a full docs update, at least verify that existing docs are still true.
