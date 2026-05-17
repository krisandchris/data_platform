# 标签配置前端上传加载 - 子智能体任务拆分

日期：2026-05-17

## 1. 共同目标

把质检标签配置从“后端包内静态读取”调整为“前端手动上传、后端校验保存、数据集绑定激活、质检工作台按激活版本渲染”。

测试配置文件已放在当前数据集目录：

```text
DATASET/urban_violation/label_config.json
```

该文件用于前端上传与联调测试，不是后端生产自动读取源。

## 2. 统一 API 契约

### 2.1 校验配置

```http
POST /api/datasets/{dataset_id}/label-configs/validate
Content-Type: application/json
```

请求体：

```json
{
  "file_name": "label_config.json",
  "config": {}
}
```

返回：

```json
{
  "valid": true,
  "dataset_id": "urban_violation",
  "schema_version": "label_config_v1",
  "version": "urban_violation_labels_v1",
  "content_hash": "sha256:...",
  "summary": {
    "field_count": 8,
    "closed_enum_count": 6,
    "open_tags_count": 2,
    "option_count": 54
  },
  "errors": [],
  "warnings": [],
  "normalized_config": {}
}
```

### 2.2 保存配置版本

```http
POST /api/datasets/{dataset_id}/label-configs
Content-Type: application/json
```

请求体：

```json
{
  "file_name": "label_config.json",
  "config": {},
  "activate": true
}
```

返回：

```json
{
  "config_id": "label-config-1",
  "dataset_id": "urban_violation",
  "schema_version": "label_config_v1",
  "version": "urban_violation_labels_v1",
  "status": "active",
  "content_hash": "sha256:...",
  "created_at": "2026-05-17T12:00:00Z",
  "activated_at": "2026-05-17T12:00:00Z",
  "validation": {}
}
```

### 2.3 激活配置版本

```http
POST /api/datasets/{dataset_id}/label-configs/{config_id}/activate
```

### 2.4 获取当前激活配置

```http
GET /api/datasets/{dataset_id}/label-config/active
```

如果没有激活配置，返回 `404` 或明确的 `config_missing` 响应；前端必须禁用标签编辑与提交。

### 2.5 获取标签建议

```http
GET /api/datasets/{dataset_id}/label-suggestions?field=segmentation_targets&q=电
```

建议来源为当前激活配置。`scene_elements` 和 `segmentation_targets` 即使建议为空，也允许用户输入自定义标签。

## 3. 后端实现智能体任务

工作树：

```text
/mnt/lc/LC/ares_xtws/0_train_data/data_platform_backend_agent
```

写入范围：

- `src/urban_violation_backend/labels.py`
- `src/urban_violation_backend/api_schemas.py`
- `src/urban_violation_backend/service.py`
- `src/urban_violation_backend/routes.py`
- `tests/test_api.py`
- `backend_contracts/schema.json`
- `task_plan.md`
- `progress.md`

任务：

1. 将现有包内 `dataset_configs/urban_violation.json` 从生产路径降级为 fixture/example，不能在服务启动时自动作为激活配置。
2. 扩展 label config schema，支持 `schema_version`、`dataset_type`、`version`、`fields`。
3. 实现配置校验服务：
   - 字段名唯一。
   - 同字段 option code 唯一。
   - `closed_enum` 必须 `allow_custom=false` 且必须有 options。
   - `open_tags` 必须 `allow_custom=true`。
   - `scene_elements` 与 `segmentation_targets` 必须是 `open_tags`。
   - `violation_category`、`sample_category`、`relation`、`verification_result`、`visibility_level`、`review_decision` 必须是 `closed_enum`。
4. 实现内存版配置版本仓库：
   - validate 只校验不保存。
   - save 生成 `config_id`、`content_hash`、`created_at`。
   - activate 将配置绑定到当前数据集。
   - active 读取当前激活配置。
5. `label-suggestions` 改为读取当前激活配置。
6. 没有激活配置时，`label-suggestions` 与 `label-config/active` 返回明确错误。
7. 更新 OpenAPI 合同。
8. 增加 API 测试，测试数据读取 `DATASET/urban_violation/label_config.json`。

验收：

- `uv run pytest` 通过。
- `uv run python -m urban_violation_backend.cli export-contract --output backend_contracts/schema.json` 通过。
- OpenAPI 包含 validate、save、activate、active、suggestions 接口。
- 后端不再在启动时自动激活包内配置。

## 4. 前端实现智能体任务

工作树：

```text
/mnt/lc/LC/ares_xtws/0_train_data/data_platform_frontend_agent
```

写入范围：

- `src/services/*`
- `src/features/datasets/*`
- `src/features/review-workbench/*`
- 相关测试文件
- `task_plan.md`
- `progress.md`

任务：

1. 新增 label config API client：
   - validate。
   - save。
   - activate。
   - get active。
   - suggestions。
2. 在数据集注册或数据集设置页增加“标签配置上传”入口。
3. 用 `<input type="file" accept=".json,application/json">` 手动选择配置文件。
4. 前端读取文件内容并解析 JSON。
5. 展示配置预览：
   - 配置版本。
   - 字段总数。
   - 闭集字段数。
   - 开放标签字段数。
   - 每个字段的 mode 和 option 数。
   - errors/warnings。
6. 用户确认后调用 save，可选择立即激活。
7. 样本审阅页进入时加载 active config。
8. 如果 active config 缺失：
   - 证据区和模型结果只读展示。
   - 标签字段编辑、保存 patch、提交质检禁用。
   - 显示“请先上传并激活标签配置”状态。
9. 闭集字段控件由 active config options 渲染。
10. `scene_elements` 和 `segmentation_targets` 使用可自由输入 tag 控件，建议项来自 label-suggestions。

验收：

- `npm run test` 通过。
- `npm run build` 通过。
- 浏览器中可以上传 `DATASET/urban_violation/label_config.json`。
- 激活后样本审阅页可读取配置并生成字段控件。
- 未激活配置时审阅页不会允许提交标签修改。

## 5. 联调测试智能体任务

工作树：

```text
/mnt/lc/LC/ares_xtws/0_train_data/data_platform_integration_agent
```

写入范围：

- 集成测试脚本。
- Playwright 或 API smoke 测试。
- `task_plan.md`
- `progress.md`
- 联调报告。

任务：

1. 使用 `DATASET/urban_violation/label_config.json` 作为唯一测试配置输入。
2. API 流程测试：
   - validate config。
   - save config。
   - activate config。
   - get active config。
   - suggestions for `segmentation_targets`。
3. 负向测试：
   - 将 `scene_elements` 改为 `closed_enum` 应校验失败。
   - 闭集字段 `violation_category` 缺少 options 应校验失败。
   - 重复 option code 应校验失败。
4. 前后端联调测试：
   - 前端上传配置。
   - 前端激活配置。
   - 打开样本审阅页。
   - 闭集字段出现配置选项。
   - `segmentation_targets` 可以输入自定义标签。
   - 自定义开放标签不会被后端枚举校验拒绝。
5. 输出联调报告，明确前端、后端、合同和测试数据是否一致。

验收：

- 后端 API smoke 全部通过。
- 前端上传流程可在浏览器验证。
- 样本审阅页在有 active config 时可编辑，在无 active config 时只读。
- 联调报告记录失败项、截图路径和复现命令。

## 6. 执行顺序

1. 后端智能体先完成上传配置生命周期与 OpenAPI 合同。
2. 前端智能体并行实现上传入口和本地预览，可先按约定契约开发。
3. 联调智能体先准备 API/配置负向测试，等待后端合同更新后跑通。
4. 后端完成后，前端更新 client 与工作台 active config 加载。
5. 联调智能体完成端到端验证。
