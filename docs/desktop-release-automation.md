# Desktop Release Automation

The desktop release flow is automated by [desktop-release.yml](../.github/workflows/desktop-release.yml).

## Required GitHub Secrets

- `TAURI_SIGNING_PRIVATE_KEY`
  Put the full contents of `C:\Users\ojepp\.tauri\notesmith-updater.key` into this secret.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  Leave this empty if the updater key has no password.

## Release Flow

1. Update the desktop version in:
   - [apps/desktop/package.json](../apps/desktop/package.json)
   - [apps/desktop/src-tauri/Cargo.toml](../apps/desktop/src-tauri/Cargo.toml)
   - [apps/desktop/src-tauri/tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json)
2. Commit and push the version bump.
3. Create and push a tag like `v0.1.1`.
4. GitHub Actions builds the Windows app, signs updater artifacts, prepares release assets, and publishes the GitHub release.

## Published Assets

- `latest.json`
- `NoteSmith.Desktop_<version>_x64-setup.exe`
- `NoteSmith.Desktop_<version>_x64-setup.nsis.zip`
- `NoteSmith.Desktop_<version>_x64-setup.nsis.zip.sig`
- `NoteSmith.Desktop_<version>_x64_en-US.msi`

## Local Dry Run

After building locally, you can prepare the release payload with:

```powershell
npm run desktop:release:prepare
```

This writes GitHub-ready assets to:

- [apps/desktop/src-tauri/target/release/release-assets](../apps/desktop/src-tauri/target/release/release-assets)
