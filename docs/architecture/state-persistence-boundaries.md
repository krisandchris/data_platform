# State Persistence Boundaries

Last updated: 2026-05-22

Task ID: `TASK-019`

## Purpose

This document defines the boundary between source files, file-backed mutable state, process-local caches, derived runtime objects, PostgreSQL, and Redis for the PostgreSQL + Redis migration.

The migration goal is not to move every file into a database. It is to move authoritative mutable platform records into PostgreSQL, keep large/source artifacts on the filesystem, and use Redis only for short-lived coordination state.

## Current State Classes

| State class | Current location | Current authority | Notes |
| --- | --- | --- | --- |
| Raw source dataset | `DATASET_ROOT`, usually `DATASET/urban_violation` | Filesystem | Source images and STEP outputs are readonly inputs. Runtime writes must not mutate this tree. |
| Uploaded package archive and extraction output | `PLATFORM_STATE_ROOT/import_uploads/{dataset_type}/{batch_key}/` | Filesystem | Archives live under `archives/`; selected extracted batch source lives under `source/`. This is runtime file content, not database content. |
| Browser media | Backend media routes over source files | Filesystem | Frontend receives backend-served media URLs. Raw absolute paths must not become browser contracts. |
| Dataset type registry | `LABEL_CONFIG_STORE_ROOT/dataset_types.json` | File-backed store | Currently persisted next to label config state. Target moves registry metadata to PostgreSQL. |
| Dataset batch registry | `LABEL_CONFIG_STORE_ROOT/dataset_batches.json` | File-backed store | Stores batch summary and import job payload. Target moves metadata to PostgreSQL while retaining source file paths. |
| Label config versions and active pointer | `LABEL_CONFIG_STORE_ROOT/{dataset_type}/label_configs/` | File-backed store | Versions, registry, active pointer, content hash, and normalized config are durable state. Target moves these records to PostgreSQL. |
| Users, roles, sessions | `PLATFORM_STATE_ROOT/users.json`, `role_bindings.json`, `sessions.json` | `PlatformStateStore` | Target moves authoritative identity, RBAC, and session records to PostgreSQL. Redis may cache session lookups but is not the authority. |
| Audit | `PLATFORM_STATE_ROOT/audit_events.jsonl` | `PlatformStateStore` | Append-only audit records move to PostgreSQL. Redis must never hold the only copy. |
| QC assignment, tasks, leases | `PLATFORM_STATE_ROOT/qc/{dataset_id}/` | `PlatformStateStore` | Target moves assignment, task, and lease history to PostgreSQL. Redis may hold only the active lease lock and TTL. |
| Drafts, batch drafts, submissions | `PLATFORM_STATE_ROOT/qc/{dataset_id}/drafts` and `submissions` | `PlatformStateStore` | Target moves authoritative draft and submission records to PostgreSQL. Redis must not be used as draft storage. |
| Snapshots and modification events | `PLATFORM_STATE_ROOT/qc/{dataset_id}/annotation_snapshots.jsonl` and `modification_events.jsonl` | `PlatformStateStore` | Target moves durable snapshot/event records to PostgreSQL. |
| Sample pool, exports, evaluations | `PLATFORM_STATE_ROOT/sample_pool`, `exports`, and per-batch evaluation files | `PlatformStateStore` plus filesystem artifact files | Metadata moves to PostgreSQL. Export artifact files remain on the filesystem. |
| Process-local registries | `FixtureRuntimeService` fields such as `_registered_batches`, `_import_jobs`, `_accepted_dataset_ids` | In-process cache plus file reload | Target must hydrate these from PostgreSQL metadata and source files at startup or on demand. |
| Derived runtime | `RegisteredBatchRuntime` objects in `_registered_batch_runtimes` | Derived cache | Rebuild from database batch metadata plus filesystem `source_uri`. Do not make this object a database authority. |

## Phase 3 Transitional Boundary

Phase 3 is the PostgreSQL foundation phase only. It may introduce database-backed implementations for foundation domains:

- users, role bindings, sessions, and account status;
- dataset type metadata;
- dataset batch metadata and source pointers;
- import job metadata, lifecycle status, validation summaries, and diagnostics;
- label config versions, normalized payload, content hash, and active pointer;
- audit events.

The following state remains file-backed until the next backend phase moves QC/review state:

- QC assignments, task records, and lease history;
- active editor lease behavior;
- drafts, batch drafts, submissions, snapshots, and modification events;
- correction sample pool items;
- export job metadata and generated export artifact pointers;
- evaluation run metadata.

During this transition, a database-backed foundation store may coexist with file-backed QC/review state. Operators must treat this as an implementation checkpoint, not as a production database cutover. Docker defaults remain file-backed, and Redis is still a later phase.

## Phase 4 Transitional Boundary

Phase 4 is the QC/review state database migration checkpoint. Backend-confirmation-dependent: this section is the expected boundary for the backend `qc-state` branch after it lands and passes integration checks. In this docs worktree, the current database models still show the Phase 3 foundation scope only.

Phase 4 may database-back these additional durable domains:

- QC assignments and per-sample task records;
- sample lease history and current lease rows;
- sample drafts, batch drafts, and immutable submissions;
- annotation snapshots and modification events;
- correction sample pool items;
- export job metadata and artifact pointers;
- evaluation run metadata and metrics payloads.

Phase 4 does not change these boundaries:

- Raw dataset files, uploaded archives, extracted batch source trees, source images, STEP outputs, media bytes, and generated export artifact files remain on the filesystem.
- PostgreSQL may store paths, content types, sizes, hashes, counts, filters, and status metadata for filesystem artifacts, but must not store file bytes as blobs.
- Redis is not implemented in Phase 4. Active lease coordination may use PostgreSQL rows and transactions during this phase, but Redis-backed distributed locks, live progress, and lease TTL enforcement remain Phase 5 work.
- Docker defaults do not switch to database mode in Phase 4. `PLATFORM_STATE_BACKEND=file` remains the default until the Docker rollout phase explicitly changes deployment defaults.
- The file-state import command is still a later rollout prerequisite. Phase 4 database-mode verification can create fresh database state for tests, but it is not a production migration from existing file-backed state.

Operators should treat Phase 4 as a backend verification checkpoint. A production cutover still requires the Redis runtime phase, file-state import tooling, Docker rollout changes, and integration acceptance.

## Target PostgreSQL Responsibilities

The final PostgreSQL target is the authoritative store for durable mutable platform records:

- users, role bindings, sessions, and account status;
- dataset type metadata and dataset batch metadata;
- import job metadata, lifecycle status, validation summaries, diagnostics, and source pointers;
- label config versions, normalized config payload, content hash, active pointer, and conflict metadata;
- audit events;
- QC assignments, task records, lease history, drafts, batch drafts, submissions, snapshots, and modification events;
- correction sample pool items;
- export job metadata, evaluation run metadata, and artifact pointers.

PostgreSQL stores metadata and JSON payloads needed to replay platform state. It does not store raw dataset files, uploaded zip archives, extracted source trees, media bytes, or generated export files.

## Target Redis Responsibilities

Redis is allowed only for short-lived runtime coordination:

- active sample lease lock with owner and TTL;
- owner-checked lease heartbeat and release state;
- distributed locks for QC queue generation and import job execution;
- optional session lookup cache backed by PostgreSQL;
- live upload, extraction, scan, validation, and import progress values;
- optional short-lived task progress for future async work.

Redis is not an authority for:

- drafts;
- batch drafts;
- submissions;
- audit records;
- users;
- role bindings;
- sessions as durable records;
- label config versions or active pointers;
- dataset type or batch metadata;
- import job final state;
- snapshots, modification events, sample pool items, export job metadata, or evaluation metadata.

After a Redis restart, the platform may lose only active locks and live progress hints. PostgreSQL remains the source for durable workflow state, and the UI must fall back to stable states such as "processing" when live progress has expired.

## Filesystem Responsibilities After Migration

The filesystem remains the authority for large and source artifacts:

- `DATASET/` and `DATASET_ROOT` source data;
- uploaded zip archives under `PLATFORM_STATE_ROOT/import_uploads/.../archives`;
- extracted uploaded batch source under `PLATFORM_STATE_ROOT/import_uploads/.../source`;
- source images and STEP output files referenced by imported batch `source_uri`;
- media bytes served through backend media routes;
- generated export artifact files under the configured runtime artifact root.

PostgreSQL may store paths, sizes, hashes, counts, content types, and validation summaries for these files. It must not duplicate the file bytes as database blobs.

## Derived Runtime Rules

`RegisteredBatchRuntime` is a rebuildable view, not durable state.

The database should retain enough batch metadata to rebuild runtime:

- dataset type;
- concrete batch id;
- batch key;
- source mode;
- source structure;
- source URI;
- active import job id and lifecycle status;
- counters and validation summaries that are expensive or useful to display.

At service startup, cache miss, or source refresh, backend code may hydrate a runtime from PostgreSQL metadata and the referenced source tree. Hydration failures should be reported as diagnostics on the batch instead of silently falling back to fixture data.

## Migration Invariants

- File-backed mode remains available until the database path passes integration checks.
- Phase 3 database-backed behavior is limited to foundation domains.
- Phase 4 extends database-backed behavior to QC/review domains only after the backend `qc-state` branch lands and passes integration checks.
- File-state import is explicit and idempotent. It must not run automatically on every container startup.
- The import tool must not mutate `DATASET/`, uploaded archives, extracted source files, media files, or export artifacts.
- Same-ID same-content rows are idempotent.
- Same-ID different-content rows are conflicts and require operator action.
- Docker must not default to database mode in Phase 4; the switch is blocked until PostgreSQL migrations, Redis behavior, file-state import, Docker rollout, and rollback have all been tested.
- Frontend API contracts stay compatible. The frontend should not need to know whether the backend state backend is `file` or `database`.

## Related Documents

- [PostgreSQL + Redis Migration Agent Sequence](./state_migration_agent_sequence.md)
- [PostgreSQL + Redis Migration Runbook](./postgres-redis-migration-runbook.md)
- [Docker LAN Deployment](./deployment.md)
- [Runtime And Validation](../backend/modules/runtime-and-validation.md)
