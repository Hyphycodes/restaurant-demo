# Architecture and demo boundaries

Public and admin routes share typed content under `src/content`. Server repositories resolve persisted content against static fallbacks. Media components request semantic identifiers from `assets.ts`; they do not embed vendor image URLs.

`Db` is the common data interface. The SQL adapter and migrations preserve a production-compatible architecture. This portfolio build always chooses `DemoDb`, which overlays compressed browser-scoped changes on `buildDemoRecords`. Changes travel in bounded HttpOnly cookies, so new serverless instances resolve the same visitor state. Concurrent mutations within an action are serialized. Cookie state is treated as untrusted fictional data and never confers authentication authority. No hosted database is contacted. The file-backed `LocalDb` remains available for the existing integration tests.

Request-scoped React caching keeps a visitor's content from entering a cross-user appearance cache. Each browser gets a fictional owner, employee or manager identity appropriate to the selected demo. Existing capability checks still control the screen and action surfaces. These identities confer no external authority.

External delivery is blocked at provider construction as well as at webhook/cron middleware. All mutation demos affect only fictional temporary records. Uploaded files and external image imports are not permitted. The production hosting filesystem is never used for uploads.

The visitor workspace expires after one hour and has a 9,000-character compressed storage budget. A visible reset action restores defaults. Persistent production operations would need a newly provisioned database and authenticated users in a separate implementation. The permanent demo guard should remain in this public portfolio repository.

The staff app retains its mobile navigation, schedule, shift detail, availability, training, profile and announcements. Manager mode reveals team scheduling and operations. Public reservation and ordering flows are explicitly simulated and collect no payment information.
