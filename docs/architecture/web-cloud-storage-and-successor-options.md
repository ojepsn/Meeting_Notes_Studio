# Web Cloud Storage and Successor App Options

**Status:** Deferred for future consideration  
**Recorded:** 2026-08-10  
**Scope:** Meeting Notes Studio web/PWA only. This memo does not propose changes to the Tauri desktop app.

## Purpose

Meeting Notes Studio currently stores its primary data locally in the browser using IndexedDB, with ZIP/JSON backup and import support. This is simple, private, offline-friendly, and available to anyone using the public web app, but it does not provide automatic access to the same data across devices.

Cloud integration is not being built now. This memo preserves the options, preferred direction, and security requirements for when the topic is resumed.

## Product Requirements Discussed

- Keep local-only use available without an account.
- Offer optional cloud storage and synchronization for users who want access across devices.
- Require a personal login for cloud data.
- Ensure users cannot read or modify another user's data.
- Allow the public web app to remain usable by other people without exposing the owner's cloud storage.
- Preserve offline use and a user-controlled backup/export path.
- Support additions, updates, and deletions across devices without silent data loss.
- Leave room for future web-only capabilities beyond meeting notes.

## Cloud Service Options

### Supabase

The preferred option discussed was Supabase because it combines authentication, PostgreSQL, row-level security, private file storage, and realtime capabilities. Each cloud record would carry a `user_id`, and database policies would enforce that authenticated users can only select, insert, update, or delete their own rows.

This is the recommended starting point if cloud integration is added later. It fits a browser client well and provides a clear path from a JSON-oriented data model to more normalized relational data over time.

### Firebase and Firestore

Firebase is the strongest alternative when built-in offline caching and synchronization are the main priorities. Firebase Authentication and Firestore Security Rules can isolate data by user. The tradeoff is adopting a NoSQL document model, usage-based pricing, and security rules that must be designed carefully together with every query.

### Appwrite

Appwrite offers authentication, databases, storage, and explicit per-row permissions, with cloud-hosted and self-hosted options. It is attractive if self-hosting or platform portability becomes a priority, but it introduces additional deployment and operational choices.

### Cloudflare D1 and Workers

Cloudflare D1 could provide inexpensive SQLite-style storage behind a Worker API. It would require more custom work for authentication, authorization, synchronization, and conflict handling. It was not considered the best first implementation for this app.

### Cloud-Synchronized Files

Storing a single backup file in OneDrive, Google Drive, or another synchronized folder would be simpler conceptually but is not recommended as the primary sync design. Concurrent edits, browser file access, conflict resolution, and reliable deletion propagation would be difficult.

## Recommended Storage Model

The web app should remain local-first even when cloud sync is enabled:

1. Save every edit immediately to IndexedDB.
2. Add local changes to a durable synchronization queue.
3. Upload queued changes after authentication and when connectivity is available.
4. Download remote changes made on other devices.
5. Retain deletion tombstones until every device can observe the deletion.
6. Track revisions so concurrent offline edits are detected.
7. Create a conflict copy when changes cannot be merged safely rather than silently discarding data.

The first server model could remain close to the current application structure:

```text
cloud_records
  id
  user_id
  record_type
  payload_json
  revision
  updated_at
  deleted_at
```

User settings could be stored separately. Record types could initially include sessions, todos, templates, participants, abbreviations, and preferences. Audio and large attachments should remain local at first, then move to private object storage only if needed.

## Access and Account Modes

The public web app should support two explicit modes:

- **Local only:** No account is required. Data remains in the current browser profile.
- **Cloud sync:** The user signs in, and local IndexedDB data is synchronized with that user's private cloud records.

There are two possible cloud-account policies:

- Initially disable public cloud registration and provision only the owner's account. Everyone else can still use local-only mode.
- Later allow users to create their own accounts. Database-level authorization must isolate every account from every other account.

On logout, the app should ask whether to keep an offline copy on the device or remove the synchronized cache. This is important on shared computers because server authorization cannot protect data left in an unlocked browser profile.

## Security Baseline

Any future cloud implementation should include all of the following:

- HTTPS for all application and API traffic.
- Email login using a magic link, one-time code, or strong password, with optional MFA.
- Backend-enforced row-level access controls for reads, creates, updates, and deletes.
- No anonymous access policy on private cloud tables.
- No service-role, administrator, or database secret embedded in browser code.
- Automated authorization tests proving that one account cannot access another account's records.
- Private storage policies for any uploaded audio or attachments.
- Soft deletion and recoverable backups.
- A Content Security Policy and careful dependency management for the public app.
- Continued ZIP/JSON export so cloud storage is never the only recovery path.

Provider-managed encryption at rest is a reasonable initial security level. Client-side end-to-end encryption could be considered for particularly sensitive material, but it would add key recovery, search, synchronization, and multi-device complexity. It should be treated as a separate architectural decision.

## Separate Successor Repository Option

An alternative to adding cloud functionality directly to the current web app is to preserve the current PWA and create a separate successor repository. This would allow the existing app to remain stable while a broader web product is developed independently.

Three approaches were considered:

1. Copy the current PWA into a new repository and evolve it incrementally. This is fastest but carries forward the large `app.js` structure and its technical debt.
2. Build a new web app and migrate features gradually. This takes longer to reach parity but provides the cleanest long-term architecture.
3. Create a web monorepo containing both a legacy app and a new app with shared packages. This supports gradual migration but adds build and repository complexity.

The preferred approach is a clean successor repository with a modern web architecture, using the current app as the behavioral specification and import source.

Suggested structure:

```text
meeting-notes-studio-web/
  apps/
    web/
  packages/
    domain/
    storage/
    export/
    ai/
  migrations/
  tests/
```

The user interface should depend on a storage interface rather than directly on IndexedDB or a cloud SDK:

```text
Application
    |
Storage service
    |
    +-- Local IndexedDB provider
    +-- Cloud synchronization provider
    +-- Backup import/export provider
```

For repository history, either create a clean repository and record the source baseline tag, or extract only the web files and their Git history. A clean repository was preferred, with the original repository and baseline version linked in its documentation.

## Suggested Future Sequence

When this work is resumed:

1. Confirm whether to enhance the existing PWA or create the successor repository.
2. Freeze and tag the current web app as the migration baseline.
3. Document the current backup schema and assign stable IDs to all synchronized record types.
4. Implement and test local IndexedDB storage behind a storage interface.
5. Verify import compatibility with existing ZIP/JSON backups.
6. Add authentication and cloud synchronization behind a feature flag.
7. Test additions, updates, deletions, offline edits, conflict copies, logout cleanup, and account isolation across at least two browsers.
8. Start with owner-only cloud registration before considering general account creation.
9. Add private audio or attachment storage only after core record synchronization is reliable.

## Current Decision

No cloud integration or successor repository will be built at this time. The current Meeting Notes Studio web app will continue using local browser storage and backups while development focuses on other features.
