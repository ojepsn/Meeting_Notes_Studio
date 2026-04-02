# Audio Recording and Transcription

NoteSmith supports audio as a session attachment and transcription source.

## Current Audio Options

Users can currently:

- upload audio into a session
- record microphone audio directly into a session
- record computer audio directly into a session
- record microphone and computer audio together into a session
- transcribe session audio into transcript/output flows

## Recording Modes

The recording UI is designed around three recording modes.

### Microphone

Current status:

- available now

Best for:

- one-person dictation
- voice notes
- people speaking in the room

Behavior:

- records live microphone audio
- saves the result as a session audio attachment
- the saved recording can be transcribed using the normal transcription flow

### Computer audio

Current status:

- available now

Best for:

- Zoom playback
- Teams playback
- webinars
- speaker output from the computer

Behavior:

- asks the user to share a window, screen, or app with audio
- records the shared computer audio into the session
- saves the result as a session audio attachment
- the saved recording can be transcribed using the normal transcription flow
- before the picker opens, the app reminds the user to choose the Zoom/Teams window or screen and enable audio sharing

Important:

- the user must enable audio sharing in the system picker
- exact picker wording and audio-sharing options depend on platform/runtime behavior

### Microphone + computer audio

Current status:

- available now

Best for:

- hybrid meetings
- room voices plus remote participants
- speaker playback plus local conversation

Behavior:

- captures room speech through the microphone
- captures remote voices through shared computer audio
- mixes both sources into one saved session recording
- saves the result as a session audio attachment for transcription
- before the picker opens, the app reminds the user to choose the Zoom/Teams window or screen and enable audio sharing

This remains the most demanding recording case, but it is now treated as its own explicit recording mode rather than a side effect of microphone capture.

## Transcription Paths

The app supports multiple output paths depending on note type and available audio/text:

### Meeting note

- usually AI-generated meeting minutes are the main path

### Quick note

- can create output directly
- can polish with AI

### Voice note

If text already exists:

- `Create output`
- `Polish with AI`

If only audio exists:

- `Transcribe to output`
- `Transcribe and polish`

## Why Recording Modes Matter

Not all audio capture scenarios are equivalent.

### Simple dictation

- microphone recording is usually enough

### In-room meeting

- microphone recording is usually workable
- quality depends on microphone placement and room acoustics

### Room voices plus Zoom or Teams audio

- microphone-only capture is usually not ideal
- echo cancellation can reduce speaker playback in the microphone path
- dedicated computer-audio or mixed capture is the better solution

## Current Best Practice in NoteSmith

The product model is:

1. capture audio intentionally
2. save it as a first-class session attachment
3. transcribe it when needed
4. turn that transcript into output directly or with AI assistance
