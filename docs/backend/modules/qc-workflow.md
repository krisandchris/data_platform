# QC Workflow API

Last updated: 2026-05-20

Purpose: create and manage batch QC queue, assignment, tasks, and sample leases.

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `GET` | `/api/datasets/{dataset_id}/qc` | none | `QCQueueResponse` | `qc_queue:read` |
| `POST` | `/api/datasets/{dataset_id}/qc/generate` | none | `QCQueueResponse` | queue management boundary |
| `GET` | `/api/datasets/{dataset_id}/qc/assignable-users` | none | `list[UserAccountResponse]` | `batch_assignment:manage` |
| `GET` | `/api/datasets/{dataset_id}/qc/assignment` | none | `BatchQcAssignmentResponse | None` | `qc_queue:read` |
| `POST` | `/api/datasets/{dataset_id}/qc/assignment` | `BatchAssignmentRequest` | `BatchQcAssignmentResponse` | `batch_assignment:manage` |
| `POST` | `/api/datasets/{dataset_id}/qc/assignment/reassign` | `BatchAssignmentActionRequest` | `BatchQcAssignmentResponse` | `batch_assignment:manage` |
| `POST` | `/api/datasets/{dataset_id}/qc/assignment/release` | `BatchAssignmentActionRequest | None` | `batch_assignment:manage` |
| `GET` | `/api/datasets/{dataset_id}/qc/tasks` | none | `list[QcTaskResponse]` | `qc_queue:read` |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/lease` | none | `LeaseAcquireResponse` | `label_edit:write` |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/lease/{lease_id}/heartbeat` | none | `SampleLeaseResponse` | lease owner |
| `POST` | `/api/datasets/{dataset_id}/samples/{sample_id}/lease/{lease_id}/release` | none | `SampleLeaseResponse` | lease owner or force release |

Workflow rules:

- QC queue generation is explicit per concrete batch.
- A batch has one active assignment.
- Admin, batch manager, dataset admin, or QC lead may assign/reassign/release depending on scoped permissions.
- A sample has one active lease.
- Annotators edit only their assigned batch.
- Lease heartbeat keeps the edit session alive.
