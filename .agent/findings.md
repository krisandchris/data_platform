# Findings

- Offline retained components import shared types only from dataset type upload, import job, QC page, review workbench, bbox overlay, HTTP/media helpers, and the offline API client.
- Removed full-platform UI paths: account, users/RBAC, audit, dataset center, overview, assets, preannotations, sample pool, export, evaluation, version history, and fixture API.
- `ReviewWorkbenchShell` depends on detailed Stage1/Stage2 fields, so those remain in the slim contract.
- No dependency changes were needed.
