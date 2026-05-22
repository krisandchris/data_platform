# Changelog

## v0.0.2 - 2026-05-22

- Added PostgreSQL + Redis deployment defaults and migration tooling for durable platform state.
- Added import validation detail rendering and pagination for scan validation / import preview records.
- Added asset sample preview pagination and long `sample_id` layout containment.
- Reworked QC workspace batch queue into paginated horizontal rows for dense review.
- Fixed Docker rollout packaging and startup checks for database-mode deployments.

## v0.0.1 - 2026-05-21

- Added Docker Compose LAN deployment with Nginx frontend proxy and FastAPI backend service.
- Added Docker deployment support for readonly dataset mounts and writable runtime state mounts.
- Added deployed batch creation from `urban_violation_0520`-style zip archives.
- Increased Docker upload limits for frequent 3-5 GiB archive uploads and disabled Nginx request buffering for API uploads.
- Added frontend archive upload progress and backend processing state.
- Improved Sample Review sample switching to avoid image blanking, topbar layout jitter, and transient lease readonly warnings.
- Improved overlapping bbox selection with coordinate hit testing, nearest-corner ranking, modifier-key cycling, and restored editable bbox dragging.
