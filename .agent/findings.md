# Findings

- The retained frontend still calls the existing backend label-edit endpoints: `my-draft`, `my-batch-draft`, and `submit-batch`.
- Offline startup uses file state and no data root by default; manual ZIP upload is the retained import entry.
- Postgres/Redis modules were only needed by removed database/coordination modes and migration tests.
- State-store persistence is still needed for offline users, assignments, tasks, leases, drafts, batch drafts, and submissions.
