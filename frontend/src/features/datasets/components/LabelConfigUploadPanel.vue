<template>
  <section class="panel label-config-panel">
    <div class="panel__header label-config-panel__header">
      <div>
        <h2 class="panel__title">标签配置上传</h2>
        <p>手动选择 JSON 配置，校验后保存为数据集标签配置版本。</p>
      </div>
      <div class="active-config">
        <span>Active</span>
        <strong>{{ activeConfig?.version ?? '未激活' }}</strong>
      </div>
    </div>

    <div class="panel__body label-config-panel__body">
      <div class="upload-strip">
        <input
          ref="fileInput"
          class="visually-hidden"
          type="file"
          accept=".json,application/json"
          @change="onFileChange"
        />
        <button class="button" type="button" @click="fileInput?.click()">
          <Upload :size="17" />
          选择 JSON
        </button>
        <div class="selected-file">
          <FileJson :size="18" />
          <span>{{ fileName || '尚未选择 label_config.json' }}</span>
        </div>
        <button class="button" type="button" :disabled="!parsedConfig || validating" @click="validateConfig">
          <Loader2 v-if="validating" :size="16" class="spin" />
          <CheckCircle2 v-else :size="16" />
          校验配置
        </button>
        <label class="activate-toggle">
          <input v-model="activateImmediately" type="checkbox" />
          保存后立即激活
        </label>
      </div>

      <div v-if="parseError" class="label-config-alert label-config-alert--error">
        <TriangleAlert :size="17" />
        <span>{{ parseError }}</span>
      </div>
      <div v-else-if="statusMessage" class="label-config-alert label-config-alert--success">
        <CheckCircle2 :size="17" />
        <span>{{ statusMessage }}</span>
      </div>

      <div class="preview-grid">
        <div class="preview-metrics">
          <div>
            <span>version</span>
            <strong>{{ previewVersion }}</strong>
          </div>
          <div>
            <span>field_count</span>
            <strong>{{ previewSummary.fieldCount }}</strong>
          </div>
          <div>
            <span>closed_enum_count</span>
            <strong>{{ previewSummary.closedEnumCount }}</strong>
          </div>
          <div>
            <span>open_tags_count</span>
            <strong>{{ previewSummary.openTagsCount }}</strong>
          </div>
        </div>

        <div class="field-preview">
          <table>
            <thead>
              <tr>
                <th>field</th>
                <th>mode</th>
                <th>options</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in previewFields" :key="field.field">
                <td>{{ field.field }}</td>
                <td>{{ field.mode }}</td>
                <td>{{ field.options.length }}</td>
              </tr>
              <tr v-if="!previewFields.length">
                <td colspan="3">选择配置后显示字段预览</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="validation-columns">
        <div class="validation-box" :class="{ empty: !previewErrors.length }">
          <strong>errors</strong>
          <ul v-if="previewErrors.length">
            <li v-for="issue in previewErrors" :key="issueKey(issue)">
              <span v-if="issue.field">{{ issue.field }}: </span>{{ issue.message }}
            </li>
          </ul>
          <p v-else>暂无错误</p>
        </div>
        <div class="validation-box validation-box--warning" :class="{ empty: !previewWarnings.length }">
          <strong>warnings</strong>
          <ul v-if="previewWarnings.length">
            <li v-for="issue in previewWarnings" :key="issueKey(issue)">
              <span v-if="issue.field">{{ issue.field }}: </span>{{ issue.message }}
            </li>
          </ul>
          <p v-else>暂无警告</p>
        </div>
      </div>

      <div class="save-actions">
        <button
          class="button button--primary"
          type="button"
          :disabled="!canSave || saving"
          @click="saveConfig"
        >
          <Loader2 v-if="saving" :size="16" class="spin" />
          <ShieldCheck v-else :size="16" />
          保存配置
        </button>
        <button
          v-if="saveResult && saveResult.status !== 'active'"
          class="button"
          type="button"
          :disabled="activating"
          @click="activateSavedConfig"
        >
          <Loader2 v-if="activating" :size="16" class="spin" />
          <ShieldCheck v-else :size="16" />
          激活当前版本
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { CheckCircle2, FileJson, Loader2, ShieldCheck, TriangleAlert, Upload } from 'lucide-vue-next';
import { apiClient } from '../../../services/urbanViolationApi';
import type {
  LabelConfig,
  LabelConfigField,
  LabelConfigIssue,
  LabelConfigSaveResult,
  LabelConfigSummary,
  LabelConfigValidationResult,
} from '../../../shared/types/contract';

const props = defineProps<{
  datasetId: string;
}>();

const emit = defineEmits<{
  saved: [result: LabelConfigSaveResult];
}>();

const fileInput = ref<HTMLInputElement>();
const fileName = ref('');
const parsedConfig = ref<unknown>();
const parseError = ref('');
const validation = ref<LabelConfigValidationResult>();
const saveResult = ref<LabelConfigSaveResult>();
const activeConfig = ref<LabelConfig>();
const activateImmediately = ref(true);
const validating = ref(false);
const saving = ref(false);
const activating = ref(false);
const statusMessage = ref('');

const localFields = computed(() => normalizeLocalFields(parsedConfig.value));
const localSummary = computed<LabelConfigSummary>(() => summarizeFields(localFields.value));
const localIssues = computed(() => validateLocalConfig(parsedConfig.value, localFields.value));
const previewFields = computed(() => validation.value?.normalizedConfig?.fields ?? localFields.value);
const previewSummary = computed(() => validation.value?.summary ?? localSummary.value);
const previewVersion = computed(() => validation.value?.version ?? localVersion(parsedConfig.value));
const previewErrors = computed(() => [...localIssues.value.errors, ...(validation.value?.errors ?? [])]);
const previewWarnings = computed(() => [...localIssues.value.warnings, ...(validation.value?.warnings ?? [])]);
const canSave = computed(() => Boolean(parsedConfig.value && validation.value?.valid && previewErrors.value.length === 0));

onMounted(() => {
  void loadActiveConfig();
});

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  validation.value = undefined;
  saveResult.value = undefined;
  statusMessage.value = '';
  parsedConfig.value = undefined;
  parseError.value = '';

  if (!file) {
    fileName.value = '';
    return;
  }

  fileName.value = file.name;
  try {
    parsedConfig.value = JSON.parse(await readFileText(file));
  } catch (err) {
    parseError.value = err instanceof Error ? `JSON 解析失败：${err.message}` : 'JSON 解析失败';
  } finally {
    input.value = '';
  }
}

async function validateConfig() {
  if (!parsedConfig.value || !fileName.value) {
    return;
  }
  validating.value = true;
  statusMessage.value = '';
  try {
    validation.value = await apiClient.validateLabelConfig(props.datasetId, {
      fileName: fileName.value,
      config: parsedConfig.value,
    });
    statusMessage.value = validation.value.valid ? '后端校验通过，可以保存配置。' : '后端校验未通过，请修正错误后重试。';
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : '配置校验失败';
  } finally {
    validating.value = false;
  }
}

async function saveConfig() {
  if (!parsedConfig.value || !fileName.value || !canSave.value) {
    return;
  }
  saving.value = true;
  statusMessage.value = '';
  try {
    saveResult.value = await apiClient.saveLabelConfig(props.datasetId, {
      fileName: fileName.value,
      config: parsedConfig.value,
      activate: activateImmediately.value,
    });
    statusMessage.value =
      saveResult.value.status === 'active'
        ? `已保存并激活 ${saveResult.value.version}`
        : `已保存 ${saveResult.value.version}，可手动激活。`;
    await loadActiveConfig();
    emit('saved', saveResult.value);
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : '配置保存失败';
  } finally {
    saving.value = false;
  }
}

async function activateSavedConfig() {
  if (!saveResult.value?.configId) {
    return;
  }
  activating.value = true;
  statusMessage.value = '';
  try {
    saveResult.value = await apiClient.activateLabelConfig(props.datasetId, saveResult.value.configId);
    statusMessage.value = `已激活 ${saveResult.value.version}`;
    await loadActiveConfig();
    emit('saved', saveResult.value);
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : '配置激活失败';
  } finally {
    activating.value = false;
  }
}

async function loadActiveConfig() {
  try {
    activeConfig.value = await apiClient.getActiveLabelConfig(props.datasetId);
  } catch {
    activeConfig.value = undefined;
  }
}

function normalizeLocalFields(value: unknown): LabelConfigField[] {
  const record = isRecord(value) ? value : {};
  return arrayValue(record.fields).map((item) => {
    const field = isRecord(item) ? item : {};
    return {
      field: stringValue(field.field),
      mode: stringValue(field.mode, 'closed_enum'),
      labelZh: optionalString(field.label_zh ?? field.labelZh),
      labelEn: optionalString(field.label_en ?? field.labelEn),
      allowCustom: Boolean(field.allow_custom ?? field.allowCustom),
      maxItems: numberValue(field.max_items ?? field.maxItems),
      options: arrayValue(field.options).map((option) => {
        const itemRecord = isRecord(option) ? option : {};
        return {
          code: stringValue(itemRecord.code),
          labelZh: optionalString(itemRecord.label_zh ?? itemRecord.labelZh),
          labelEn: optionalString(itemRecord.label_en ?? itemRecord.labelEn),
          description: optionalString(itemRecord.description),
          sortOrder: numberValue(itemRecord.sort_order ?? itemRecord.sortOrder),
          aliases: arrayValue(itemRecord.aliases).flatMap((alias) => (typeof alias === 'string' ? [alias] : [])),
        };
      }),
    };
  });
}

function summarizeFields(fields: LabelConfigField[]): LabelConfigSummary {
  return {
    fieldCount: fields.length,
    closedEnumCount: fields.filter((field) => field.mode === 'closed_enum').length,
    openTagsCount: fields.filter((field) => field.mode === 'open_tags').length,
    optionCount: fields.reduce((total, field) => total + field.options.length, 0),
  };
}

function validateLocalConfig(value: unknown, fields: LabelConfigField[]): { errors: LabelConfigIssue[]; warnings: LabelConfigIssue[] } {
  const errors: LabelConfigIssue[] = [];
  const warnings: LabelConfigIssue[] = [];
  const record = isRecord(value) ? value : {};
  if (!record.schema_version && !record.schemaVersion) {
    warnings.push({ field: 'schema_version', message: '缺少 schema_version，建议补充以支持后续升级。' });
  }
  const fieldNames = new Set<string>();
  fields.forEach((field) => {
    if (!field.field) {
      errors.push({ message: '存在未命名字段。' });
      return;
    }
    if (fieldNames.has(field.field)) {
      errors.push({ field: field.field, message: '字段名重复。' });
    }
    fieldNames.add(field.field);
    const optionCodes = new Set<string>();
    field.options.forEach((option) => {
      if (optionCodes.has(option.code)) {
        errors.push({ field: field.field, message: `option code 重复：${option.code}` });
      }
      optionCodes.add(option.code);
    });
    if (field.mode === 'closed_enum' && field.options.length === 0) {
      errors.push({ field: field.field, message: 'closed_enum 字段必须提供 options。' });
    }
    if (field.mode === 'closed_enum' && field.allowCustom) {
      errors.push({ field: field.field, message: 'closed_enum 字段不允许 allow_custom=true。' });
    }
    if (field.mode === 'open_tags' && !field.allowCustom) {
      errors.push({ field: field.field, message: 'open_tags 字段必须 allow_custom=true。' });
    }
  });
  ['scene_elements', 'segmentation_targets'].forEach((fieldName) => {
    const field = fields.find((item) => item.field === fieldName);
    if (field && field.mode !== 'open_tags') {
      errors.push({ field: fieldName, message: `${fieldName} 必须配置为 open_tags。` });
    }
  });
  return { errors, warnings };
}

function localVersion(value: unknown) {
  const record = isRecord(value) ? value : {};
  return stringValue(record.version, 'unversioned-label-config');
}

function readFileText(file: File) {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsText(file);
  });
}

function issueKey(issue: LabelConfigIssue) {
  return `${issue.field ?? 'global'}-${issue.code ?? issue.message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
</script>

<style scoped>
.label-config-panel {
  margin-top: 14px;
}

.label-config-panel__header p {
  margin: 4px 0 0;
  color: var(--muted);
}

.active-config {
  display: grid;
  gap: 2px;
  min-width: 180px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.active-config span,
.preview-metrics span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.active-config strong,
.preview-metrics strong {
  overflow-wrap: anywhere;
}

.label-config-panel__body {
  display: grid;
  gap: 16px;
}

.upload-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.selected-file {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  min-width: min(360px, 100%);
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--muted);
}

.activate-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #24324b;
  font-weight: 700;
}

.label-config-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 8px;
  font-weight: 700;
}

.label-config-alert--error {
  border: 1px solid #ffd1d1;
  background: var(--red-soft);
  color: var(--red);
}

.label-config-alert--success {
  border: 1px solid #c8f1d8;
  background: var(--green-soft);
  color: #137333;
}

.preview-grid {
  display: grid;
  grid-template-columns: minmax(220px, 0.38fr) minmax(0, 1fr);
  gap: 14px;
}

.preview-metrics {
  display: grid;
  gap: 10px;
}

.preview-metrics div {
  display: grid;
  gap: 2px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-subtle);
}

.field-preview {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.field-preview table {
  width: 100%;
  border-collapse: collapse;
}

.field-preview th,
.field-preview td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}

.field-preview th {
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
}

.validation-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.validation-box {
  min-height: 96px;
  padding: 12px;
  border: 1px solid #ffd1d1;
  border-radius: 8px;
  background: var(--red-soft);
  color: #9f1239;
}

.validation-box--warning {
  border-color: #ffd8a8;
  background: var(--orange-soft);
  color: #9a3412;
}

.validation-box.empty {
  border-color: var(--line);
  background: var(--panel-subtle);
  color: var(--muted);
}

.validation-box ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.validation-box p {
  margin: 8px 0 0;
}

.save-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 920px) {
  .preview-grid,
  .validation-columns {
    grid-template-columns: 1fr;
  }
}
</style>
