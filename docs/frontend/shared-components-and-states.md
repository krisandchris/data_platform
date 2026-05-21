# Shared Components And States

Last updated: 2026-05-20

## Core Components

- `AppShell.vue`: global shell, sidebar, topbar, review focus mode.
- `DatasetTypeBatchPanel.vue`: batch list, client directory scan, batch creation, QC generation.
- `LabelConfigUploadPanel.vue`: type-scoped config upload, validation, save, reload, history.
- `AssetTable.vue`: asset filtering and sample review links.
- `ImportStepper.vue`: import job stage display.
- `ReviewWorkbenchShell.vue`: protected sample review layout and editing behavior.
- `BBoxOverlay.vue`: quantized bbox rendering/editing.

## Shared States

- Loading: show page-local loading without breaking current navigation.
- Error: show concrete backend message.
- Empty backend result: distinguish from filtered-out data.
- Permission denied: redirect protected account subpages to `/account`; keep operation errors visible on other pages.
- Missing active label config: disable edit/write actions.
- Missing assignment or lease: review page becomes readonly.
- Media failure: show fallback image state instead of broken image icon.
- Route batch switch: clear stale batch data before rendering new batch data.

## Protected Review Behavior

- Do not modify review layout, bbox behavior, right panels, or bottom bar semantics without explicit user approval.
- Review page remains chrome-free.
- Save draft and submit batch behavior must stay aligned with backend batch draft and batch submit APIs.
