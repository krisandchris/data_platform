# Label Edits API

Last updated: 2026-05-20

Purpose: validate label edits, persist batch drafts/autosaves, submit full-batch modifications, and support qc_lead confirmation/return.

## Sample Compatibility Endpoints

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/validate` | `LabelEditValidateRequest` | `LabelEditValidationResponse` | `label_edit:write` |
| `GET` | `/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/my-draft` | none | `LabelEditDraftResponse | None` | draft owner |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/label-edits` | `LabelEditSubmitRequest` | `LabelEditSubmitResponse` | `label_edit:write` |
| `GET` | `/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/history` | none | `list[LabelEditSubmissionResponse]` | `dataset:read` |

## Batch Draft And Submit Endpoints

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/datasets/{dataset_id}/label-edits/my-batch-draft` | none | `BatchDraftSummaryResponse` | draft owner |
| `PUT` | `/api/datasets/{dataset_id}/label-edits/my-batch-draft` | `BatchDraftSaveRequest` | `BatchDraftSummaryResponse` | `label_edit:write` |
| `POST` | `/api/datasets/{dataset_id}/label-edits/my-batch-draft/autosave` | `BatchDraftSaveRequest` | `BatchDraftSummaryResponse` | `label_edit:write` |
| `POST` | `/api/datasets/{dataset_id}/label-edits/submit-batch` | `BatchSubmitRequest` | `BatchSubmitResponse` | `label_edit:write` |

## Lead Confirmation Endpoints

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/{submission_id}/confirm` | none | `LabelEditSubmissionResponse` | `label_edit:confirm` |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/label-edits/{submission_id}/return` | reason body | `LabelEditSubmissionResponse` | `label_edit:confirm` |

Design notes:

- Validation checks field legality only.
- Save draft persists current user's dirty batch draft workspace.
- Autosave uses the same draft contract and must be idempotent.
- Batch submit submits the whole assigned batch, not only the active sample.
- Batch submit blocks unsaved dirty edits, validation errors, missing assignment, missing active label config, stale revision, or readonly state.
- Lead confirmation creates the accepted/returned state for downstream closed-loop analysis.
