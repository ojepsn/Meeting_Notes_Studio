# Desktop Storage and Backups

NoteSmith Desktop stores its local-first data outside the app install directory.

That is important because app updates should replace the installed app without replacing your database.

## Storage model

The desktop app uses Tauri's app directories together with the app identifier:

- identifier: `com.notesmith.desktop`
- database filename: `notesmith.db`

The app shows the exact resolved paths in:

- `Settings` -> `Other upcoming settings`

## What lives where

The desktop app uses these logical locations:

- `App config directory`
  - contains the SQLite database
  - database path: `<appConfigDir>/notesmith.db`
- `App data directory`
  - contains attachments and local backup snapshots
  - attachments path: `<appDataDir>/attachments`
  - local backups path: `<appDataDir>/backups`

The app can open these folders directly from Settings.

## Windows path shape

On Windows, the exact paths depend on the current user profile.

The app resolves and displays the actual paths at runtime, but they will follow this pattern:

- database:
  - `%APPDATA%\\com.notesmith.desktop\\notesmith.db`
- app data folder:
  - the app shows the resolved folder directly in Settings

Because Tauri resolves these paths at runtime, the in-app path display is the source of truth.

## Updates vs uninstall

Normal desktop updates should preserve your local database and attachments because they live in app data/config folders, not inside the installed app folder.

Uninstall and reinstall is less trustworthy as a safety strategy.

To reduce risk before uninstalling:

- use `Export backup file` to save a JSON backup outside AppData
- optionally use `Create local safety backup` for an extra local snapshot
- keep important exported backups in a normal user folder such as Documents or a synced backup location

## Recommended backup practice

For safe day-to-day use:

- rely on in-app updates for normal upgrades
- export a backup file before major upgrades or reinstalls
- keep at least one backup outside AppData

This gives you a recovery path even if the app is later removed or reinstalled.
