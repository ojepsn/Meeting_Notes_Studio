# AI and Prompts Architecture

NoteSmith is built to support multiple AI-driven workflows, not just one generation prompt.

## Core Principle

AI configuration is split by workflow.

This is intentional.

The app should not rely on one universal prompt for every kind of note or transformation.

## Prompt Families

Current prompt families:

- `Meeting minutes`
- `Personal notes & dictation`
- `Revision`
- `Translation`
- `Reusable extra prompt blocks`

## Why Prompt Families Matter

Different workflows need different behavior:

- meeting minutes need structure, decisions, follow-up, and business-ready synthesis
- personal notes need lighter cleanup and proportionate editing
- revision should preserve structure and apply specific changes
- translation should preserve structure and intent

## Prompt Resolution

Prompt resolution is handled in the AI layer so saved settings, defaults, and older prompt data can be normalized consistently.

This includes:

- default built-in prompt families
- saved custom prompt values
- compatibility with older prompt storage
- reusable prompt blocks

## Generation Logic

Generation uses the session's capture mode:

- `meeting-note` uses meeting-minutes prompt families
- `quick-note` uses personal-notes prompt families
- `voice-note` uses personal-notes prompt families

This allows the product model and AI behavior to stay aligned.

## AI Runtime Responsibilities

The AI layer also tracks:

- request history
- diagnostics
- cache events
- retries
- model guidance

The goal is for AI to be visible and inspectable rather than mysterious.

## Design Rule

UI components should not embed OpenAI behavior directly.

Instead:

- UI gathers user intent
- services resolve prompts and model choices
- runtime code executes requests
- diagnostics/history record what happened

This keeps the app extensible as more AI features are added over time.
