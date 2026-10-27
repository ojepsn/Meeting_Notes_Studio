# ChatGPT Outlook calendar import

NoteSmith can receive a calendar snapshot from ChatGPT without connecting directly to Microsoft Graph. Outlook data flows in one direction only:

`Outlook -> ChatGPT -> NoteSmith`

NoteSmith exposes one local import action. It cannot use that connection to read Outlook, send NoteSmith data to ChatGPT, or write anything back to Outlook.

## Set up

1. Keep the installed NoteSmith desktop app open.
2. Open **Settings -> ChatGPT Calendar Import**.
3. Confirm that the local importer is running, then copy its address.
4. In ChatGPT, add a custom MCP server using **Secure MCP Tunnel** and paste the copied address.
5. In the same ChatGPT chat, enable both the Outlook Calendar connector and the NoteSmith import server.

## Import prompt

Use this prompt when you want to refresh NoteSmith:

> Read every Outlook calendar event from today through six days later, using my current local timezone. Then call `notesmith_reconcile_outlook_calendar` exactly once with the complete snapshot and `completeSnapshot` set to `true`. Include stable Outlook event IDs and iCalUIds when available. Do not include past events or events beyond the seven-day window.

NoteSmith independently enforces the seven-day window. A complete snapshot lets it add new meetings, update changed meetings, and remove meetings that are no longer present, while preserving NoteSmith-owned notes, classifications, sessions, and timelogs.
