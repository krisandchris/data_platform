# Sample Review Page

Last updated: 2026-05-21

Route: `/datasets/:id/samples/:sampleId/review`

Components:

- `ReviewWorkbenchPage.vue`
- `ReviewWorkbenchShell.vue`
- `BBoxOverlay.vue`

## Protected Layout

```text
+------------------------------------------------------------------+
| Review topbar: sample, progress, model judgement, draft, config    |
+------------------------------------------------------------------+
| Warnings: action message, readonly reason, missing config           |
+------------------------------------------------------------------+
| Image evidence panel                    | Relation review panel     |
| - layer toggles                         | - relation index rail      |
| - zoomable/pannable bbox image stage    | - relation editor          |
| - scene/context strip                   | - verification editor      |
|                                         +--------------------------+
|                                         | Candidate/verdict panel   |
|                                         | - candidate index rail     |
|                                         | - candidate editor         |
|                                         | - evidence relations       |
+------------------------------------------------------------------+
| Bottom bar: status chips + autosave interval + 跳过/校验/保存草稿/提交批次修改 |
+------------------------------------------------------------------+
```

## Editable Fields

- Relation: `subject`, `relation`, `object`, `description`, `bbox`.
- Verification: `visibilityLevel`, `informationLossType`, `verificationResult`, `verificationConfidence`, `bboxObservation`, `globalContextObservation`.
- Candidate: `violationCategory`, `sampleCategory`, `confidence`, `segmentationTargets`, `evidenceReasoning`, `relationHint`, `evidenceRelationIds`.

Read-only reference fields:

- `subjectVisible`
- `subjectMatch`
- `keyAttributesVisible`

## Bbox Rules

- Bbox values are 0-1000 quantized coordinates.
- Rendered positions must scale from the actual image stage size.
- Default box line width is 2px.
- Selected state changes color only.
- Default color palette excludes red, black, and purple.
- Unreferenced Relation boxes use purple and turn red only when explicitly selected.
- Mouse wheel zooms image stage.
- Middle mouse button pans only when zoomed.

## Bottom Bar

Actions:

- `跳过样本`
- `校验修改`
- `保存草稿`
- `提交批次修改`

Rules:

- `校验修改` validates field legality only.
- `保存草稿` persists dirty edits in the current batch draft workspace.
- Autosave uses the same draft payload and should be idempotent.
- Autosave interval is configurable in the bottom bar with fixed options: `1分钟`, `2分钟`, `3分钟`, `5分钟`.
- The default interval is `3分钟`; the browser remembers the reviewer selection locally.
- Changing the interval while dirty reschedules the next autosave without interrupting an in-flight save.
- `提交批次修改` submits the assigned batch, not only the active sample.
- Submit remains button/modal confirmed; no instant submit shortcut.

## Keyboard Shortcuts

- `ArrowLeft` or `A`: previous sample.
- `ArrowRight` or `D`: next sample.
- `X`: skip sample.
- `V`: validate only.
- `S`: save batch draft.
- `Ctrl/Cmd+S`, `Ctrl/Cmd+Enter`, relation cycling, candidate cycling, and layer-number shortcuts are unbound.
- Shortcuts are ignored in inputs, selects, textareas, buttons, contenteditable nodes, repeated keydown, IME composition, and modified key events.

## States

- Loading review sample.
- Backend error.
- Empty detail.
- Silent refresh keeps current workbench visible.
- Readonly when missing assignment, wrong assignee, missing lease, or missing active label config.
- Validation unvalidated/valid/invalid.
- Save/autosave/batch submit pending.
- Media fallback when image fails.

## API

- `GET /api/datasets/{batch_id}/samples/{sample_id}/review`
- `GET /api/datasets/{batch_id}/qc`
- `GET /api/dataset-types/{dataset_type}/label-config/active`
- `GET /api/datasets/{batch_id}/label-suggestions`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/lease`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/lease/{lease_id}/heartbeat`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/lease/{lease_id}/release`
- `GET /api/datasets/{batch_id}/samples/{sample_id}/label-edits/my-draft`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits/validate`
- `POST /api/datasets/{batch_id}/samples/{sample_id}/label-edits`
- `GET /api/datasets/{batch_id}/label-edits/my-batch-draft`
- `PUT /api/datasets/{batch_id}/label-edits/my-batch-draft`
- `POST /api/datasets/{batch_id}/label-edits/my-batch-draft/autosave`
- `POST /api/datasets/{batch_id}/label-edits/submit-batch`

## Permission Boundary

- Login required.
- Editing requires active label config, batch assignment to current user, active sample lease held by current user, and `label_edit:write`.
