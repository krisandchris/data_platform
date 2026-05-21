# TASK-019 QA Findings

## New Contract Coverage
- Added `tests/test_state_store_contract.py` to baseline file-backed contract behavior for:
  - users / role bindings / sessions / audit events
  - assignment / tasks / leases
  - drafts / batch drafts / submissions
  - snapshots / modification events
  - sample pool / exports / evaluations
  - cleanup methods (`clear_assignment`, `remove_sample_pool_items_for_dataset`, `clear_qc_dataset_state`)
- Added `tests/test_label_config_repository_contract.py` to validate repository contract behavior for:
  - save default activation behavior
  - same hash dedup behavior
  - same version + different content conflict behavior
  - reload active behavior without creating new versions

## Baseline Command Findings
- `uv run pytest` in this worktree failed with 4 existing API tests in `tests/test_api.py`:
  - `test_manual_batch_creation_ingests_accessible_source_directory`: expected state `Imported`, actual `Draft`.
  - `test_preannotated_registered_batch_generates_batch_scoped_qc_queue`: expected code `label_config_required`, actual `source_not_ingested`.
  - `test_manual_batch_0520_preannotated_hydration_and_qc_queue_generation`: expected state `Imported`, actual `Draft`.
  - `test_dataset_batch_delete_admin_cleans_runtime_state_and_keeps_source_data`: fixture source dir `DATASET/urban` missing in QA worktree.
- Frontend baselines failed due to missing local frontend deps in current installation state:
  - `npm run test` -> `vitest: not found`
  - `VITE_API_BASE_URL=/api npm run build` -> `vue-tsc: not found`
- `uv run python scripts/docker-compose-auto-subnet.py config` passed and rendered compose config.

## Flakiness
- Focused contract tests (`state_store_contract` + `label_config_repository_contract`) rerun 5 times: 5/5 passed, 0 failures.
- Observed failure rate: 0% for new contract harness.
