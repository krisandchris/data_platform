# Label Config API

Last updated: 2026-05-20

Purpose: validate, save, list, activate, reload, and read type-scoped label configs.

## Preferred Type-Scoped Endpoints

| Method | Path | Request schema | Response schema | Permission |
| --- | --- | --- | --- | --- |
| `POST` | `/api/dataset-types/{dataset_type}/label-configs/validate` | `LabelConfigValidateRequest` | `LabelConfigValidationReport` | `label_config:manage` |
| `POST` | `/api/dataset-types/{dataset_type}/label-configs` | `LabelConfigSaveRequest` | `StoredLabelConfig` | `label_config:manage` |
| `GET` | `/api/dataset-types/{dataset_type}/label-configs` | none | `list[StoredLabelConfig]` | `dataset:read` |
| `POST` | `/api/dataset-types/{dataset_type}/label-configs/{config_id}/activate` | none | `StoredLabelConfig` | `label_config:manage` |
| `GET` | `/api/dataset-types/{dataset_type}/label-config/active` | none | `StoredLabelConfig` | `dataset:read` |
| `POST` | `/api/dataset-types/{dataset_type}/label-config/active/reload` | none | `StoredLabelConfig` | `label_config:manage` |

## Compatibility Dataset-Id Endpoints

| Method | Path | Request schema | Response schema |
| --- | --- | --- | --- |
| `POST` | `/api/datasets/{dataset_id}/label-configs/validate` | `LabelConfigValidateRequest` | `LabelConfigValidationReport` |
| `POST` | `/api/datasets/{dataset_id}/label-configs` | `LabelConfigSaveRequest` | `StoredLabelConfig` |
| `GET` | `/api/datasets/{dataset_id}/label-configs` | none | `list[StoredLabelConfig]` |
| `POST` | `/api/datasets/{dataset_id}/label-configs/{config_id}/activate` | none | `StoredLabelConfig` |
| `GET` | `/api/datasets/{dataset_id}/label-config/active` | none | `StoredLabelConfig` |
| `POST` | `/api/datasets/{dataset_id}/label-config/active/reload` | none | `StoredLabelConfig` |

## Suggestions

| Method | Path | Query | Response schema |
| --- | --- | --- | --- |
| `GET` | `/api/datasets/{dataset_id}/label-suggestions` | `field`, `q` | `LabelSuggestionResponse` |

## Behavior

- Label config is scoped by dataset type.
- Identical content reuses the existing `content_hash`.
- Changed content with the same semantic `config.version` returns conflict.
- Changed content with a new semantic version creates one history version and may activate it.
- Reload active is read-only for history.
