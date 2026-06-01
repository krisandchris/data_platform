<script lang="ts">
let activeReviewShortcutOwner: symbol | undefined;
</script>

<template>
  <section
    class="sample-detail-workbench"
    :class="{ 'is-switching-sample': isSwitchingSample }"
    :aria-busy="isSwitchingSample ? 'true' : undefined"
  >
    <header class="qc-topbar">
      <div class="sample-meta">
        <div class="meta-block meta-block--sample">
          <span>样本</span>
          <strong>{{ baseSample.asset.sampleId }}</strong>
        </div>
        <div class="meta-block">
          <span>进度</span>
          <strong>{{ progressText }}</strong>
          <div class="progress-meter" aria-hidden="true">
            <i :style="{ width: `${progressPercent}%` }"></i>
          </div>
        </div>
        <div class="meta-block">
          <span>阶段判断</span>
          <div class="chip-row">
            <StatusChip :value="baseSample.asset.judgeDecision" :label="`阶段1 ${statusDisplayLabel(baseSample.asset.judgeDecision)}`" />
            <StatusChip
              :value="baseSample.stage2Failure ? 'stage2_failed' : baseSample.asset.stage2Status"
              :label="statusDisplayLabel(baseSample.stage2Failure ? 'stage2_failed' : baseSample.asset.stage2Status)"
            />
          </div>
        </div>
        <div class="meta-block">
          <span>草稿状态</span>
          <strong :class="['draft-state', patchSaved ? 'draft-state--saved' : 'draft-state--dirty']">
            {{ draftStateText }}
          </strong>
        </div>
        <div class="meta-block">
          <span>当前配置</span>
          <strong>{{ configVersionText }}</strong>
        </div>
        <div class="meta-block">
          <span>分配人</span>
          <strong>{{ assignmentText }}</strong>
        </div>
        <div class="meta-block">
          <span>样本锁</span>
          <strong>{{ leaseText }}</strong>
        </div>
      </div>

      <div class="top-actions">
        <button
          v-if="previousQueueItem"
          class="toolbar-button"
          type="button"
          :disabled="!canGoPrevious"
          aria-keyshortcuts="ArrowLeft A"
          @click="goToPreviousQueueItem"
        >
          <ChevronLeft :size="16" />
          上一个
        </button>
        <button v-else class="toolbar-button" type="button" disabled aria-keyshortcuts="ArrowLeft A">
          <ChevronLeft :size="16" />
          上一个
        </button>
        <button
          v-if="nextQueueItem"
          class="toolbar-button"
          type="button"
          :disabled="!canGoNext"
          aria-keyshortcuts="ArrowRight D"
          @click="goToNextQueueItem"
        >
          下一个
          <ChevronRight :size="16" />
        </button>
        <button v-else class="toolbar-button" type="button" disabled aria-keyshortcuts="ArrowRight D">
          下一个
          <ChevronRight :size="16" />
        </button>
        <RouterLink class="toolbar-button" :to="`/datasets/${baseSample.asset.datasetId}/qc`">
          <ListChecks :size="16" />
          返回列表
        </RouterLink>
      </div>
    </header>

    <div v-if="actionMessage" class="gate-warning">
      <CircleAlert :size="17" />
      <span>{{ actionMessage }}</span>
    </div>
    <div v-if="readonlyReason && !suppressReadonlyWarning" class="gate-warning gate-warning--readonly">
      <CircleAlert :size="17" />
      <span>{{ readonlyReason }}</span>
    </div>
    <div v-if="!readonlyReason && !canEditLabels" class="gate-warning gate-warning--config">
      <CircleAlert :size="17" />
      <span>{{ editGateMessage }}</span>
    </div>

    <div class="review-grid">
      <section class="work-panel evidence-panel">
        <div class="panel-head">
          <strong>图像证据区</strong>
          <span class="pill pill--blue">0-1000 坐标框</span>
        </div>

        <div class="panel-body evidence-body">
          <div class="layer-toggles" aria-label="标注框图层">
            <label :class="{ active: showStage1 }">
              <input v-model="showStage1" type="checkbox" />
              <span class="dot dot--blue"></span>
              阶段1
            </label>
            <label :class="{ active: showStage2 }">
              <input v-model="showStage2" type="checkbox" />
              <span class="dot dot--green"></span>
              阶段2
            </label>
            <label :class="{ active: showCandidates }">
              <input v-model="showCandidates" type="checkbox" />
              <span class="dot dot--purple"></span>
              候选
            </label>
          </div>

          <div class="image-stage">
            <BBoxOverlay
              :image-url="baseSample.asset.imageUrl"
              :image-width="baseSample.asset.width"
              :image-height="baseSample.asset.height"
              :boxes="overlayBoxes"
              :alt="baseSample.asset.sampleId"
              @select-box="selectOverlayBox"
              @update-box="updateOverlayBox"
            />
          </div>

          <div class="scene-strip">
            <div class="fact-block">
              <span class="field-label">环境分析</span>
              <p>{{ baseSample.stage1.environmentAnalysis || '无环境分析' }}</p>
            </div>
            <div class="fact-block">
              <span class="field-label">场景元素 / 关键锚点</span>
              <div class="tag-row">
                <span v-for="element in baseSample.stage1.sceneElements" :key="element" class="tag">
                  {{ optionDisplayLabel('scene_elements', element) }}
                </span>
                <span v-for="anchor in baseSample.stage1.keyAnchors" :key="anchor.anchor" class="tag tag--green">
                  {{ displayLooseValue(anchor.anchor) }}
                </span>
                <em v-if="!baseSample.stage1.sceneElements.length && !baseSample.stage1.keyAnchors.length">
                  暂无
                </em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="review-side-stack">
        <section class="work-panel relation-panel">
          <div class="panel-head">
            <strong>事实关系复核区</strong>
            <span class="pill pill--blue">{{ relationViews.length }} 条关系</span>
          </div>

          <div class="panel-body relation-body">
            <div class="index-track relation-index-track" aria-label="事实关系索引轨">
              <button
                v-for="item in relationViews"
                :key="item.badge"
                class="index-button"
                :class="[
                  `index-button--${relationBoxTone(item)}`,
                  { active: item.badge === activeRelationKey, dirty: item.dirty, warning: item.orphan },
                ]"
                type="button"
                @click="setActiveRelation(item.badge)"
              >
                {{ item.badge }}
                <span v-if="item.dirty || item.orphan" aria-hidden="true"></span>
              </button>
            </div>

            <div v-if="activeRelationView && activeRelationDraft" class="relation-editor">
              <div class="status-row">
                <span class="pill" :class="activeRelationView.orphan ? 'pill--amber' : 'pill--green'">
                  {{ activeRelationView.orphan ? '未被候选引用' : '已引用' }}
                </span>
                <span v-if="activeRelationView.dirty" class="pill pill--amber">已修改</span>
                <span v-if="!activeRelationView.verification" class="pill pill--amber">
                  {{ baseSample.stage2Failure ? '阶段2失败' : '阶段2缺失' }}
                </span>
                <span class="pill">坐标框可在图像区拖拽修改</span>
              </div>

              <div class="editor-grid">
                <label class="field">
                  <span class="mini-label">主体</span>
                  <input
                    :value="activeRelationDraft.subject"
                    :disabled="!canEditLabels"
                    @input="setRelationField('subject', inputValue($event))"
                  />
                </label>
                <label class="field">
                  <span class="mini-label">关系</span>
                  <select
                    :value="activeRelationDraft.relation"
                    :disabled="!canEditLabels || !hasClosedField('relation')"
                    @change="setRelationField('relation', inputValue($event))"
                  >
                    <option v-for="option in selectOptions('relation', activeRelationDraft.relation)" :key="option" :value="option">
                      {{ optionDisplayLabel('relation', option) }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">客体</span>
                  <select
                    :value="activeRelationDraft.object"
                    :disabled="!canEditLabels"
                    @change="setRelationField('object', inputValue($event))"
                  >
                    <option v-for="option in objectOptions(activeRelationDraft.object)" :key="option" :value="option">
                      {{ optionDisplayLabel('object', option) }}
                    </option>
                  </select>
                </label>
              </div>

              <label class="field">
                <span class="mini-label">描述</span>
                <textarea
                  :value="activeRelationDraft.description"
                  :disabled="!canEditLabels"
                  rows="2"
                  @input="setRelationField('description', inputValue($event))"
                ></textarea>
              </label>

              <div class="verification-grid">
                <label class="field">
                  <span class="mini-label">可见性</span>
                  <select
                    :value="activeRelationDraft.visibilityLevel"
                    :disabled="!canEditLabels || !hasClosedField('visibility_level')"
                    @change="setRelationField('visibilityLevel', inputValue($event))"
                  >
                    <option
                      v-for="option in selectOptions('visibility_level', activeRelationDraft.visibilityLevel)"
                      :key="option"
                      :value="option"
                    >
                      {{ optionDisplayLabel('visibility_level', option) }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">信息损失</span>
                  <select
                    :value="activeRelationDraft.informationLossType"
                    :disabled="!canEditLabels || !hasClosedField('information_loss_type')"
                    @change="setRelationField('informationLossType', inputValue($event))"
                  >
                    <option
                      v-for="option in selectOptions('information_loss_type', activeRelationDraft.informationLossType)"
                      :key="option"
                      :value="option"
                    >
                      {{ optionDisplayLabel('information_loss_type', option) }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">核验结果</span>
                  <select
                    :value="activeRelationDraft.verificationResult"
                    :disabled="!canEditLabels || !hasClosedField('verification_result')"
                    @change="setRelationField('verificationResult', inputValue($event))"
                  >
                    <option
                      v-for="option in selectOptions('verification_result', activeRelationDraft.verificationResult)"
                      :key="option"
                      :value="option"
                    >
                      {{ optionDisplayLabel('verification_result', option) }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">置信度</span>
                  <input
                    :value="activeRelationDraft.verificationConfidence"
                    :disabled="!canEditLabels"
                    min="0"
                    max="1"
                    step="0.01"
                    type="number"
                    @input="setRelationField('verificationConfidence', numberValue($event))"
                  />
                </label>
              </div>

              <label class="field field--observation">
                <span class="mini-label">坐标框观察</span>
                <textarea
                  :value="activeRelationDraft.bboxObservation"
                  :disabled="!canEditLabels"
                  rows="3"
                  @input="setRelationField('bboxObservation', inputValue($event))"
                ></textarea>
              </label>

              <label class="field field--observation">
                <span class="mini-label">全局上下文观察</span>
                <textarea
                  :value="activeRelationDraft.globalContextObservation"
                  :disabled="!canEditLabels"
                  rows="3"
                  @input="setRelationField('globalContextObservation', inputValue($event))"
                ></textarea>
              </label>

              <div class="reference-block" aria-label="模型可见性参考">
                <span class="field-label">模型可见性参考</span>
                <div class="reference-grid">
                  <div class="reference-item">
                    <span class="mini-label">主体可见</span>
                    <strong>{{ referenceBoolean(activeRelationView.verification?.subjectVisible) }}</strong>
                  </div>
                  <div class="reference-item">
                    <span class="mini-label">主体匹配</span>
                    <strong>{{ referenceBoolean(activeRelationView.verification?.subjectMatch) }}</strong>
                  </div>
                </div>
                <div class="tag-row">
                  <span
                    v-for="attribute in activeRelationView.verification?.keyAttributesVisible ?? []"
                    :key="attribute"
                    class="tag"
                  >
                    {{ displayLooseValue(attribute) }}
                  </span>
                  <em v-if="!(activeRelationView.verification?.keyAttributesVisible.length)">暂无</em>
                </div>
              </div>
            </div>

            <div v-else class="empty-callout">没有事实关系可复核。</div>
          </div>
        </section>

        <section class="work-panel candidate-panel">
          <div class="panel-head">
            <strong>候选结论与质检裁决</strong>
            <span class="pill pill--amber">{{ reviewDraft.candidateDrafts.length }} 个候选</span>
          </div>

          <div class="panel-body candidate-body">
            <div class="index-track candidate-index-track" aria-label="候选索引轨">
              <button
                v-for="candidate in reviewDraft.candidateDrafts"
                :key="candidate.id"
                class="index-button"
                :class="{ active: candidate.id === activeCandidateId, dirty: candidateDirty(candidate) }"
                type="button"
                @click="setActiveCandidate(candidate.id)"
              >
                {{ candidate.id }}
                <span v-if="candidateDirty(candidate)" aria-hidden="true"></span>
              </button>
              <button class="index-button index-button--add" type="button" :disabled="!canEditLabels" @click="addCandidate">
                +
              </button>
            </div>

            <div v-if="activeCandidateDraft" class="candidate-editor">
              <div class="candidate-editor-header">
                <div class="candidate-header-meta">
                  <span class="pill pill--blue">
                    {{ activeCandidateDraft.id }} · {{ activeCandidateDraft.violationCategory || '未选择类别' }}
                  </span>
                  <span class="pill" :class="canEditLabels ? 'pill--green' : 'pill--amber'">
                    {{ canEditLabels ? '标签配置可编辑' : '只读' }}
                  </span>
                  <span class="pill pill--amber">{{ activeCandidateDraft.evidenceRelationIds.length }} 条证据关系</span>
                </div>
                <button
                  class="candidate-delete-button"
                  type="button"
                  :disabled="!canEditLabels"
                  @click="deleteCandidate(activeCandidateDraft.id)"
                >
                  <Trash2 :size="15" />
                  删除
                </button>
              </div>

              <div class="candidate-form">
                <div class="field-row">
                  <label class="field">
                    <span class="mini-label">violation_category</span>
                    <select
                      :value="activeCandidateDraft.violationCategory"
                      :disabled="!canEditLabels || !hasClosedField('violation_category')"
                      @change="setCandidateField('violationCategory', inputValue($event))"
                    >
                      <option
                        v-for="option in selectOptions('violation_category', activeCandidateDraft.violationCategory)"
                        :key="option"
                        :value="option"
                      >
                        {{ option }}
                      </option>
                    </select>
                  </label>
                  <label class="field">
                    <span class="mini-label">样本类别</span>
                    <select
                      :value="activeCandidateDraft.sampleCategory"
                      :disabled="!canEditLabels || !hasClosedField('sample_category')"
                      @change="setCandidateField('sampleCategory', inputValue($event))"
                    >
                      <option
                        v-for="option in selectOptions('sample_category', activeCandidateDraft.sampleCategory)"
                        :key="option"
                        :value="option"
                      >
                        {{ optionDisplayLabel('sample_category', option) }}
                      </option>
                    </select>
                  </label>
                </div>

                <label class="field">
                  <span class="mini-label">置信度</span>
                  <input
                    :value="activeCandidateDraft.confidence"
                    :disabled="!canEditLabels"
                    min="0"
                    max="1"
                    step="0.01"
                    type="number"
                    @input="setCandidateField('confidence', numberValue($event))"
                  />
                  <input
                    class="range-input"
                    :value="activeCandidateDraft.confidence"
                    :disabled="!canEditLabels"
                    min="0"
                    max="1"
                    step="0.01"
                    type="range"
                    @input="setCandidateField('confidence', numberValue($event))"
                  />
                </label>

                <div class="field field--tags">
                  <span class="mini-label">分割目标</span>
                  <div class="tag-edit-list">
                    <span v-for="tag in activeCandidateDraft.segmentationTargets" :key="tag" class="tag">
                      {{ optionDisplayLabel('segmentation_targets', tag) }}
                      <button type="button" :disabled="!canEditLabels" @click="removeCandidateTag(tag)">×</button>
                    </span>
                    <em v-if="!activeCandidateDraft.segmentationTargets.length">暂无</em>
                  </div>
                  <div class="tag-input-row">
                    <input
                      v-model="candidateTagInput"
                      :list="tagListId('segmentation_targets')"
                      :disabled="!canEditLabels"
                      placeholder="输入目标后回车"
                      @input="loadTagSuggestions('segmentation_targets')"
                      @keydown.enter.prevent="addCandidateTag"
                    />
                    <datalist :id="tagListId('segmentation_targets')">
                      <option
                        v-for="suggestion in tagSuggestions('segmentation_targets')"
                        :key="suggestion"
                        :value="suggestion"
                        :label="optionDisplayLabel('segmentation_targets', suggestion)"
                      />
                    </datalist>
                    <button type="button" :disabled="!canEditLabels" @click="addCandidateTag">添加</button>
                  </div>
                </div>

                <label class="field">
                  <span class="mini-label">证据推理</span>
                  <textarea
                    :value="activeCandidateDraft.evidenceReasoning"
                    :disabled="!canEditLabels"
                    rows="4"
                    @input="setCandidateField('evidenceReasoning', inputValue($event))"
                  ></textarea>
                </label>

                <label class="field">
                  <span class="mini-label">关系提示</span>
                  <input
                    :value="activeCandidateDraft.relationHint"
                    :disabled="!canEditLabels"
                    @input="setCandidateField('relationHint', inputValue($event))"
                  />
                </label>
              </div>

              <div class="evidence-table">
                <span class="field-label">证据关系</span>
                <label v-for="relation in relationViews" :key="relation.badge" class="evidence-check">
                  <input
                    type="checkbox"
                    :checked="activeCandidateDraft.evidenceRelationIds.includes(relation.badge)"
                    :disabled="!canEditLabels"
                    @change="toggleCandidateRelation(relation.badge, checkedValue($event))"
                  />
                  <span>
                    <strong>
                      {{ relation.badge }} · {{ displayLooseValue(relation.draft.subject) }}
                      {{ optionDisplayLabel('relation', relation.draft.relation) }}
                      {{ displayLooseValue(relation.draft.object) }}
                    </strong>
                    <em>{{ relation.draft.description || '无关系描述' }}</em>
                  </span>
                  <span class="status-token" :class="relation.orphan ? 'status-token--amber' : 'status-token--green'">
                    {{ relation.orphan ? '未关联' : '已关联' }}
                  </span>
                </label>
              </div>
            </div>

            <div v-else class="candidate-empty">
              <TriangleAlert :size="18" />
              <div>
                <strong>{{ baseSample.stage2Failure ? '阶段2未产出候选结论' : '无候选结论' }}</strong>
                <p>{{ baseSample.stage2Failure?.message ?? '需要人工基于阶段1关系和图像证据补判。' }}</p>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section class="review-action-bar" aria-label="标注修改底栏">
      <div class="bottom-status" aria-label="修改状态">
        <span class="pill pill--blue">当前样本修改 {{ operationCount }} 项</span>
        <span class="pill pill--blue">批次草稿 {{ savedDraftSampleCount }}/{{ batchTotalCount }}</span>
        <span class="pill" :class="autosavePillClass">{{ autosaveStatusText }}</span>
        <label class="autosave-interval-control">
          <span>间隔</span>
          <select :value="autosaveIntervalMs" @change="setAutosaveInterval(inputValue($event))">
            <option v-for="option in autosaveIntervalOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <span class="pill" :class="validationPillClass">{{ validationStatusText }}</span>
      </div>
      <div class="label-edit-actions">
        <button
          class="decision-button skip"
          type="button"
          :disabled="!canSkipSample"
          aria-keyshortcuts="X"
          @click="skipSample"
        >
          <SkipForward :size="17" />
          跳过样本
        </button>
        <button
          class="decision-button validate"
          type="button"
          :disabled="!canValidateChanges"
          aria-keyshortcuts="V"
          @click="validateChanges"
        >
          <ShieldCheck :size="17" />
          校验修改
        </button>
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveBatchDraft"
          aria-keyshortcuts="S"
          @click="saveDraft"
        >
          <Save :size="17" />
          保存草稿
        </button>
        <button
          class="submit-button"
          type="button"
          :disabled="submitPending"
          @click="openBatchSubmitModal"
        >
          <Send :size="17" />
          提交批次修改
        </button>
      </div>
    </section>

    <div v-if="submitModalOpen" class="modal-backdrop" role="presentation">
      <section
        class="batch-submit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-submit-title"
      >
        <header class="batch-submit-header">
          <div>
            <span class="mini-label">批次</span>
            <h2 id="batch-submit-title">提交批次修改</h2>
          </div>
          <strong>{{ baseSample.asset.datasetId }}</strong>
        </header>
        <div class="batch-submit-stats" aria-label="批次提交统计">
          <span>样本总数 <strong>{{ batchTotalCount }}</strong></span>
          <span>已保存草稿 <strong>{{ savedDraftSampleCount }}</strong></span>
          <span>未保存 <strong>{{ unsavedDraftSampleCount }}</strong></span>
          <span>校验错误 <strong>{{ batchValidationErrorCount }}</strong></span>
          <span>跳过/未修改 <strong>{{ skippedOrUnmodifiedCount }}</strong></span>
          <span>本次有修改 <strong>{{ changedDraftSampleCount }}</strong></span>
        </div>
        <div v-if="batchSubmitBlockReasons.length" class="submit-blockers" aria-label="提交阻塞原因">
          <strong>暂不能提交</strong>
          <ul>
            <li v-for="reason in batchSubmitBlockReasons" :key="reason">{{ reason }}</li>
          </ul>
        </div>
        <p class="batch-submit-note">
          提交后该批次进入待质检负责人确认状态，普通标注员不可继续编辑。
        </p>
        <footer class="batch-submit-actions">
          <button class="decision-button" type="button" @click="submitModalOpen = false">取消</button>
          <button
            class="submit-button"
            type="button"
            :disabled="!batchSubmitReady || submitPending"
            @click="confirmBatchSubmit"
          >
            <Send :size="17" />
            确认提交批次修改
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ListChecks,
  Save,
  Send,
  ShieldCheck,
  SkipForward,
  Trash2,
  TriangleAlert,
} from 'lucide-vue-next';
import BBoxOverlay, { type OverlayBox } from '../../../shared/components/BBoxOverlay.vue';
import StatusChip from '../../../shared/components/StatusChip.vue';
import type {
  BatchLabelEditDraft,
  BatchLabelEditDraftPayload,
  BatchLabelEditDraftSaveResult,
  BatchLabelEditDraftSample,
  BatchLabelEditDraftValidation,
  BatchLabelEditSubmitPayload,
  BatchLabelEditSubmitResult,
  BBox,
  FactVerification,
  BatchQcAssignment,
  CurrentUser,
  LabelConfig,
  LabelEditOperation,
  LabelEditPatchPayload,
  LabelEditValidationResult,
  QcQueueItem,
  QcTask,
  ReviewSampleDetail,
  SampleLease,
  Stage2Candidate,
  StageRelation,
} from '../../../shared/types/contract';

const props = defineProps<{
  detail: ReviewSampleDetail;
  queueItems: QcQueueItem[];
  labelConfig?: LabelConfig;
  labelConfigMissing?: boolean;
  labelConfigGateMessage?: string;
  labelSuggestions?: Record<string, string[]>;
  requestLabelSuggestions?: (field: string, query: string) => Promise<string[]>;
  validateLabelEdit?: (payload: LabelEditPatchPayload) => Promise<LabelEditValidationResult>;
  batchDraft?: BatchLabelEditDraft;
  saveBatchDraft?: (payload: BatchLabelEditDraftPayload) => Promise<BatchLabelEditDraftSaveResult>;
  autosaveBatchDraft?: (payload: BatchLabelEditDraftPayload) => Promise<BatchLabelEditDraftSaveResult>;
  submitBatchLabelEdits?: (payload: BatchLabelEditSubmitPayload) => Promise<BatchLabelEditSubmitResult>;
  currentUser?: CurrentUser;
  batchAssignment?: BatchQcAssignment;
  qcTask?: QcTask;
  sampleLease?: SampleLease;
  readonlyReason?: string;
  suppressReadonlyWarning?: boolean;
  releaseSampleLease?: (options?: { preserveDisplayedLease?: boolean }) => Promise<void> | void;
  isSwitchingSample?: boolean;
  switchError?: string;
}>();

interface RelationDraft {
  subject: string;
  relation: string;
  object: string;
  description: string;
  bbox: BBox;
  visibilityLevel: string;
  informationLossType: string;
  verificationResult: string;
  verificationConfidence: number;
  bboxObservation: string;
  globalContextObservation: string;
}

interface CandidateDraft {
  id: string;
  sourceIndex?: number;
  violationCategory: string;
  sampleCategory: string;
  confidence: number;
  segmentationTargets: string[];
  evidenceReasoning: string;
  evidenceRelationIds: string[];
  relationHint: string;
}

interface ReviewDraft {
  relationDrafts: Record<string, RelationDraft>;
  candidateDrafts: CandidateDraft[];
  deletedCandidateDrafts: CandidateDraft[];
}

interface BatchDraftEntry {
  payload: BatchLabelEditDraftSample;
  dirty: boolean;
  saved: boolean;
  savedAt?: string;
  savedSignature?: string;
  validation?: LabelEditValidationResult;
}

interface RelationView {
  base: StageRelation;
  verification?: FactVerification;
  badge: string;
  tone: RelationIdentityTone;
  draft: RelationDraft;
  orphan: boolean;
  dirty: boolean;
}

type BBoxTone = NonNullable<OverlayBox['tone']>;
type RelationIdentityTone = Exclude<BBoxTone, 'purple'>;
type BatchSaveKind = 'manual' | 'autosave';

const DEFAULT_AUTOSAVE_INTERVAL_MS = 180_000;
const AUTOSAVE_INTERVAL_STORAGE_KEY = 'urbanViolationReviewAutosaveIntervalMs';
const AUTOSAVE_INTERVAL_OPTIONS = [
  { label: '1分钟', value: 60_000 },
  { label: '2分钟', value: 120_000 },
  { label: '3分钟', value: 180_000 },
  { label: '5分钟', value: 300_000 },
] as const;
const FIELD_VALUE_LABELS: Record<string, Record<string, string>> = {
  relation: {
    blocks: '阻挡',
    near: '靠近',
    occupying: '占据',
    occupies: '占据',
    adjacent_to: '相邻',
    overlaps: '重叠',
  },
  object: {
    pedestrian_walkway: '人行道',
    tactile_paving: '盲道',
    parking_line_or_parking_zone: '停车线或停车区域',
    curb_or_edge: '路缘或边界',
    roadway: '车行道',
    shop_boundary: '店铺边界',
    counter_or_operation_area: '柜台或经营区域',
    entrance_or_exit: '出入口',
    public_area: '公共区域',
    sidewalk: '人行道',
    'sidewalk passage': '人行道',
    curb: '路缘或边界',
    'crosswalk edge': '路缘或边界',
    road: '车行道',
    'road lane': '车行道',
    intersection: '公共区域',
  },
  visibility_level: {
    clear: '清晰',
    partial: '部分可见',
    tiny: '目标极小',
    blurry: '模糊',
    occluded: '遮挡',
  },
  information_loss_type: {
    none: '无',
    occlusion: '遮挡',
    blur: '模糊',
    truncation: '截断',
    low_resolution: '低分辨率',
    unknown: '未知',
  },
  verification_result: {
    supported: '支持',
    weakly_supported: '弱支持',
    unsupported: '不支持',
    unclear: '不确定',
  },
  sample_category: {
    'positive samples': '正样本',
    'negative samples': '负样本',
    'hard boundary samples': '困难边界样本',
  },
  scene_elements: {
    sidewalk: '人行道',
    tactile_paving: '盲道',
    'nonmotor vehicle': '非机动车',
    nonmotor_vehicle: '非机动车',
    electric_vehicle: '电动车',
    pedestrian: '行人',
    curb: '路缘',
    shared_bicycle: '共享单车',
    storefront: '店面',
    carton: '纸箱',
    temporary_vendor_stall: '临时摊位',
    outdoor_table_chair: '户外桌椅',
    'motor vehicle': '机动车',
    traffic_signal: '交通信号灯',
    'traffic signal': '交通信号灯',
    'roadside vendor': '路边摊贩',
    'roadside goods': '路边货物',
  },
  segmentation_targets: {
    electric_vehicle: '电动车',
    nonmotor_vehicle: '非机动车',
    'nonmotor vehicle': '非机动车',
    motor_vehicle: '机动车',
    'motor vehicle': '机动车',
    shared_bicycle: '共享单车',
    bicycle: '自行车',
    goods: '货物',
    carton: '纸箱',
    person: '人员',
    pedestrian: '行人',
    vendor_stall: '摊位',
    table_chair: '桌椅',
    umbrella: '雨伞',
    'no parking sign': '禁停标志',
  },
  key_attributes: {
    wheel: '车轮',
    body_outline: '车身轮廓',
    'visible goods': '可见货物',
    sign_panel: '标志牌',
    edge: '边缘',
  },
};
const STATUS_LABELS: Record<string, string> = {
  active: '有效',
  assigned: '已分配',
  blocked: '已阻塞',
  clean: '无修改',
  completed: '已完成',
  expired: '已过期',
  failed: '失败',
  in_progress: '进行中',
  manual_review: '人工复核',
  needs_changes: '需修改',
  passed: '已通过',
  pending: '待处理',
  ready: '就绪',
  rejected: '已拒绝',
  released: '已释放',
  revoked: '已撤销',
  stage2_failed: '阶段2失败',
  success: '成功',
};

const instance = getCurrentInstance();
const router = instance?.appContext.config.globalProperties.$router as
  | { push: (target: string) => Promise<unknown> | void }
  | undefined;
const baseSample = computed(() => props.detail);
const showStage1 = ref(true);
const showStage2 = ref(true);
const showCandidates = ref(true);
const activeRelationKey = ref(relationBadge(props.detail.stage1.keyRelations[0]?.relationIndex ?? 'R1'));
const activeImageRelationKey = ref('');
const activeCandidateId = ref('');
const reviewDraft = ref<ReviewDraft>(createReviewDraft(props.detail));
const candidateTagInput = ref('');
const remoteSuggestions = ref<Record<string, string[]>>({});
const validationResult = ref<LabelEditValidationResult>();
const lastSavedAt = ref<string>();
const patchSaved = ref(Boolean(props.detail.humanReview));
const actionMessage = ref('');
const validationPending = ref(false);
const savePending = ref(false);
const submitPending = ref(false);
const batchDraftEntries = ref<Record<string, BatchDraftEntry>>({});
const batchSaveKind = ref<BatchSaveKind>();
const saveQueue = ref<Promise<BatchLabelEditDraftSaveResult | undefined>>();
const autosaveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');
const autosaveMessage = ref('');
const lastAutosavedAt = ref<string>();
const autosaveIntervalMs = ref(readAutosaveIntervalMs());
const submitModalOpen = ref(false);
const navigationPending = ref(false);
const RELATION_TONE_OVERRIDES: Record<string, RelationIdentityTone> = {
  R1: 'blue',
  R2: 'cyan',
  R3: 'green',
  R4: 'orange',
};
const DEFAULT_RELATION_TONES: RelationIdentityTone[] = ['blue', 'green', 'orange', 'cyan', 'yellow', 'teal'];
const ORPHAN_RELATION_TONE: BBoxTone = 'purple';
const RELATION_OBJECT_OPTIONS = [
  'pedestrian_walkway',
  'tactile_paving',
  'parking_line_or_parking_zone',
  'curb_or_edge',
  'roadway',
  'shop_boundary',
  'counter_or_operation_area',
  'entrance_or_exit',
  'public_area',
];
const shortcutOwner = Symbol('review-workbench-shortcuts');
let autosaveTimer: number | undefined;

if (reviewDraft.value.candidateDrafts.length) {
  activeCandidateId.value = reviewDraft.value.candidateDrafts[0].id;
}

watch(
  () => props.detail.asset.sampleId,
  () => {
    resetReviewDraftForCurrentSample(true);
    remoteSuggestions.value = {};
    lastSavedAt.value = undefined;
    actionMessage.value = '';
  },
);

const canEditLabels = computed(() => Boolean(props.labelConfig && !props.labelConfigMissing && !props.readonlyReason));
const editGateMessage = computed(() => props.readonlyReason || props.labelConfigGateMessage || '请先上传并激活标签配置');
const assignmentText = computed(() => {
  const assignment = props.batchAssignment;
  if (!assignment || assignment.status === 'revoked') {
    return '未分配';
  }
  return `${assignment.assigneeDisplayName || assignment.assigneeUserId} · ${statusDisplayLabel(assignment.status)}`;
});
const leaseText = computed(() => {
  const lease = props.sampleLease;
  if (!lease) {
    return '无样本锁';
  }
  const isExpired = lease.status === 'active' && leaseExpired(lease.expiresAt);
  const suffix = lease.expiresAt && !isExpired ? ` · ${timeLeft(lease.expiresAt)}` : '';
  const status = isExpired ? 'expired' : lease.status;
  return `${statusDisplayLabel(status)} · ${lease.userDisplayName || lease.userId}${suffix}`;
});
const currentQueueIndex = computed(() =>
  props.queueItems.findIndex((item) => item.sampleId === baseSample.value.asset.sampleId),
);
const previousQueueItem = computed(() =>
  currentQueueIndex.value > 0 ? props.queueItems[currentQueueIndex.value - 1] : undefined,
);
const nextQueueItem = computed(() =>
  currentQueueIndex.value >= 0 && currentQueueIndex.value < props.queueItems.length - 1
    ? props.queueItems[currentQueueIndex.value + 1]
    : undefined,
);
const reviewedCount = computed(
  () => props.queueItems.filter((item) => item.status === 'passed' || item.status === 'rejected').length,
);
const progressText = computed(() => {
  if (currentQueueIndex.value < 0 || props.queueItems.length === 0) {
    return `已复核 ${reviewedCount.value}`;
  }
  return `${currentQueueIndex.value + 1} / ${props.queueItems.length}`;
});
const progressPercent = computed(() => {
  if (props.queueItems.length === 0 || currentQueueIndex.value < 0) {
    return 0;
  }
  return Math.round(((currentQueueIndex.value + 1) / props.queueItems.length) * 100);
});
const configVersionText = computed(() => props.labelConfig?.version ?? '无激活配置');

const relationViews = computed<RelationView[]>(() => {
  const evidenceKeys = new Set<string>();
  reviewDraft.value.candidateDrafts.forEach((candidate) => {
    candidate.evidenceRelationIds.forEach((relationId) => evidenceKeys.add(relationBadge(relationId)));
  });

  return baseSample.value.stage1.keyRelations.map((relation) => {
    const badge = relationBadge(relation.relationIndex);
    const verification = baseSample.value.stage2?.factVerifications.find((item) =>
      relationIdsMatch(item.relationIndex, badge),
    );
    const draft = reviewDraft.value.relationDrafts[badge] ?? createRelationDraft(relation, verification);
    return {
      base: relation,
      verification,
      badge,
      tone: relationTone(badge),
      draft,
      orphan: !evidenceKeys.has(badge),
      dirty: relationDirty(relation, verification, draft),
    };
  });
});

const activeRelationView = computed(() =>
  relationViews.value.find((item) => item.badge === activeRelationKey.value) ?? relationViews.value[0],
);
const activeRelationDraft = computed(() => activeRelationView.value?.draft);
const activeCandidateDraft = computed(() =>
  reviewDraft.value.candidateDrafts.find((candidate) => candidate.id === activeCandidateId.value),
);
const activeCandidateRelationKeys = computed(() => new Set(activeCandidateDraft.value?.evidenceRelationIds ?? []));
const operations = computed(() => buildOperations());
const operationCount = computed(() => operations.value.length);
const patchPayload = computed<LabelEditPatchPayload>(() => ({
  sampleId: baseSample.value.asset.sampleId,
  taskMode: 'label_edit',
  labelConfigId: props.labelConfig?.configId,
  labelConfigVersion: props.labelConfig?.version,
  leaseId: props.sampleLease?.leaseId,
  baseRevision: props.qcTask?.taskRevision,
  operations: operations.value,
}));
const batchDraftEntryList = computed(() => Object.values(batchDraftEntries.value));
const dirtyDraftEntries = computed(() =>
  batchDraftEntryList.value.filter((entry) => entry.dirty && entry.payload.operations.length > 0),
);
const hasUnsavedDirty = computed(() => dirtyDraftEntries.value.length > 0);
const unsavedDirtySampleIds = computed(() => dirtyDraftEntries.value.map((entry) => entry.payload.sampleId));
const validationErrorSampleIds = computed(() =>
  batchDraftEntryList.value
    .filter((entry) => entry.validation && !entry.validation.valid)
    .map((entry) => entry.payload.sampleId),
);
const savedDraftSampleIds = computed(() =>
  Array.from(new Set(batchDraftEntryList.value.filter((entry) => entry.saved).map((entry) => entry.payload.sampleId))),
);
const savedDraftSampleCount = computed(() => {
  const remoteCount = props.batchDraft?.savedSampleCount ?? 0;
  return Math.max(remoteCount, savedDraftSampleIds.value.length);
});
const unsavedDraftSampleCount = computed(() => dirtyDraftEntries.value.length);
const changedDraftSampleCount = computed(() =>
  batchDraftEntryList.value.filter((entry) => entry.payload.operations.length > 0).length,
);
const batchTotalCount = computed(() =>
  props.batchDraft?.totalSampleCount ?? (props.queueItems.length || Math.max(changedDraftSampleCount.value, 1)),
);
const skippedOrUnmodifiedCount = computed(() =>
  Math.max(batchTotalCount.value - changedDraftSampleCount.value, 0),
);
const batchValidationErrorCount = computed(() =>
  batchDraftEntryList.value.reduce((total, entry) => {
    if (!entry.validation || entry.validation.valid) {
      return total;
    }
    return total + Math.max(entry.validation.errors.length, 1);
  }, 0),
);
const actionPending = computed(() =>
  validationPending.value || savePending.value || submitPending.value || navigationPending.value || Boolean(props.isSwitchingSample),
);
const canSaveBatchDraft = computed(() =>
  canEditLabels.value && hasUnsavedDirty.value && Boolean(props.saveBatchDraft) && !actionPending.value,
);
const canValidateChanges = computed(() =>
  canEditLabels.value && Boolean(props.validateLabelEdit) && !actionPending.value,
);
const canRunNavigationAction = computed(() => !actionPending.value);
const canGoPrevious = computed(() => Boolean(previousQueueItem.value) && canRunNavigationAction.value);
const canGoNext = computed(() => Boolean(nextQueueItem.value) && canRunNavigationAction.value);
const canSkipSample = computed(() => canRunNavigationAction.value);
const validationIssueCount = computed(() => {
  if (!canEditLabels.value) {
    return 1;
  }
  return validationResult.value?.errors.length ?? 0;
});
const validationStatusText = computed(() => {
  if (!canEditLabels.value) {
    return '字段非法 1 项';
  }
  if (!validationResult.value) {
    return '未校验';
  }
  return validationResult.value.valid ? '字段合法' : `字段非法 ${validationIssueCount.value} 项`;
});
const validationPillClass = computed(() => {
  if (!canEditLabels.value || (validationResult.value && !validationResult.value.valid)) {
    return 'pill--red';
  }
  if (validationResult.value?.valid) {
    return 'pill--green';
  }
  return 'pill--amber';
});
const autosaveStatusText = computed(() => {
  if (savePending.value && batchSaveKind.value === 'manual') {
    return '自动保存 等待手动保存完成';
  }
  if (autosaveStatus.value === 'saving') {
    return '自动保存中';
  }
  if (autosaveStatus.value === 'failed') {
    return autosaveMessage.value ? `自动保存失败 ${autosaveMessage.value}` : '自动保存失败';
  }
  if (lastAutosavedAt.value) {
    return `自动保存 ${lastAutosavedAt.value}`;
  }
  return hasUnsavedDirty.value ? '自动保存 待保存' : '自动保存 空闲';
});
const autosavePillClass = computed(() => {
  if (autosaveStatus.value === 'failed') {
    return 'pill--red';
  }
  if (autosaveStatus.value === 'saving' || hasUnsavedDirty.value) {
    return 'pill--amber';
  }
  if (lastAutosavedAt.value) {
    return 'pill--green';
  }
  return 'pill--blue';
});
const draftStateText = computed(() => (operationCount.value > 0 ? `${operationCount.value} 项未保存` : '无修改'));
const batchSubmitBlockReasons = computed(() => {
  const reasons: string[] = [];
  const assignment = props.batchAssignment;
  if (!assignment || assignment.status === 'revoked') {
    reasons.push('当前批次没有有效分配');
  }
  if (props.readonlyReason) {
    reasons.push(props.readonlyReason);
  }
  if (!props.labelConfig || props.labelConfigMissing) {
    reasons.push(props.labelConfigGateMessage || '缺少激活标签配置');
  }
  if (savePending.value) {
    reasons.push('草稿保存或自动保存仍在进行');
  }
  if (hasUnsavedDirty.value) {
    reasons.push(`还有 ${unsavedDraftSampleCount.value} 个样本存在未保存修改`);
  }
  if (batchValidationErrorCount.value > 0) {
    reasons.push(`存在 ${batchValidationErrorCount.value} 个校验错误`);
  }
  if (!props.submitBatchLabelEdits) {
    reasons.push('缺少批次提交接口');
  }
  return Array.from(new Set(reasons));
});
const batchSubmitReady = computed(() => batchSubmitBlockReasons.value.length === 0);

const overlayBoxes = computed<OverlayBox[]>(() => {
  const boxes: OverlayBox[] = [];
  if (showStage1.value) {
    relationViews.value.forEach((item) => {
      boxes.push({
        id: `stage1-${item.badge}`,
        label: item.badge,
        bbox: item.draft.bbox,
        tone: relationBoxTone(item),
        relationIndex: item.badge,
        selected: imageRelationSelected(item.badge),
        editable: canEditLabels.value,
      });
    });
  }
  if (showStage2.value && baseSample.value.stage2) {
    baseSample.value.stage2.factVerifications.forEach((verification) => {
      const badge = relationBadge(verification.relationIndex);
      const relationView = relationViews.value.find((item) => item.badge === badge);
      boxes.push({
        id: `stage2-${badge}`,
        label: `S2 ${badge}`,
        bbox: relationView?.draft.bbox ?? verification.bbox,
        tone: relationView ? relationBoxTone(relationView) : relationTone(badge),
        relationIndex: badge,
        selected: imageRelationSelected(badge),
      });
    });
  }
  if (showCandidates.value) {
    activeCandidateRelationKeys.value.forEach((relationId) => {
      const relation = relationViews.value.find((item) => item.badge === relationId);
      if (relation) {
        boxes.push({
          id: `candidate-${activeCandidateId.value}-${relationId}`,
          label: `${activeCandidateId.value} ${relationId}`,
          bbox: relation.draft.bbox,
          tone: candidateBoxTone(relationId),
          relationIndex: relationId,
          selected: imageRelationSelected(relationId),
        });
      }
    });
  }
  return boxes;
});
const autosaveIntervalOptions = AUTOSAVE_INTERVAL_OPTIONS;

watch(
  () => props.batchDraft,
  () => {
    syncRemoteBatchDraft();
  },
  { immediate: true },
);

watch(
  () => [baseSample.value.asset.sampleId, draftSignature(patchPayload.value)],
  () => {
    syncCurrentBatchEntry();
    scheduleAutosaveIfNeeded();
  },
  { immediate: true },
);

onMounted(() => {
  activeReviewShortcutOwner = shortcutOwner;
  scheduleAutosaveIfNeeded();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('keydown', handleWorkbenchKeydown);
});

onBeforeUnmount(() => {
  if (activeReviewShortcutOwner === shortcutOwner) {
    activeReviewShortcutOwner = undefined;
  }
  if (autosaveTimer !== undefined) {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.removeEventListener('keydown', handleWorkbenchKeydown);
});

function createReviewDraft(detail: ReviewSampleDetail): ReviewDraft {
  const relationDrafts = Object.fromEntries(
    detail.stage1.keyRelations.map((relation) => {
      const verification = detail.stage2?.factVerifications.find((item) =>
        relationIdsMatch(item.relationIndex, relation.relationIndex),
      );
      return [relationBadge(relation.relationIndex), createRelationDraft(relation, verification)];
    }),
  );
  const candidateDrafts = (detail.stage2?.candidates ?? []).map((candidate, index) =>
    createCandidateDraft(candidate, index),
  );
  return { relationDrafts, candidateDrafts, deletedCandidateDrafts: [] };
}

function createRelationDraft(relation: StageRelation, verification?: FactVerification): RelationDraft {
  return {
    subject: relation.subject,
    relation: relation.relation,
    object: relation.object,
    description: relation.description ?? '',
    bbox: cloneBbox(relation.bbox),
    visibilityLevel: verification?.visibilityLevel ?? '',
    informationLossType: verification?.informationLossType ?? '',
    verificationResult: verification?.verificationResult ?? '',
    verificationConfidence: verification?.verificationConfidence ?? 0,
    bboxObservation: verification?.bboxObservation ?? '',
    globalContextObservation: verification?.globalContextObservation ?? '',
  };
}

function createCandidateDraft(candidate: Stage2Candidate, index: number): CandidateDraft {
  return {
    id: `C${index + 1}`,
    sourceIndex: index,
    violationCategory: candidate.violationCategory,
    sampleCategory: candidate.sampleCategory,
    confidence: candidate.confidence,
    segmentationTargets: [...candidate.segmentationTargets],
    evidenceReasoning: candidate.evidenceReasoning,
    evidenceRelationIds: candidate.evidenceRelationIndices.map((item) => relationBadge(item)),
    relationHint: candidate.relationHint ?? '',
  };
}

function createEmptyCandidate(): CandidateDraft {
  const nextId = nextCandidateId();
  return {
    id: nextId,
    violationCategory: selectOptions('violation_category', '')[0] ?? '',
    sampleCategory: selectOptions('sample_category', '')[0] ?? '',
    confidence: 0,
    segmentationTargets: [],
    evidenceReasoning: '',
    evidenceRelationIds: activeRelationKey.value ? [activeRelationKey.value] : [],
    relationHint: '',
  };
}

function createRestoredCandidate(candidateId: string): CandidateDraft {
  return {
    id: candidateId,
    sourceIndex: undefined,
    violationCategory: '',
    sampleCategory: '',
    confidence: 0,
    segmentationTargets: [],
    evidenceReasoning: '',
    evidenceRelationIds: [],
    relationHint: '',
  };
}

function nextCandidateId() {
  const usedIds = new Set(
    [...reviewDraft.value.candidateDrafts, ...reviewDraft.value.deletedCandidateDrafts].map((candidate) => candidate.id),
  );
  let index = 1;
  while (usedIds.has(`C${index}`)) {
    index += 1;
  }
  return `C${index}`;
}

function reviewHref(sampleId: string) {
  return `/datasets/${baseSample.value.asset.datasetId}/samples/${sampleId}/review`;
}

function relationBadge(value: string | number) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'R1';
  }
  return /^R/i.test(raw) ? raw.toUpperCase() : `R${raw}`;
}

function relationIdsMatch(a: string | number, b: string | number) {
  return relationBadge(a) === relationBadge(b);
}

function imageRelationSelected(relationId: string | number) {
  return activeImageRelationKey.value === relationBadge(relationId);
}

function relationBoxTone(relation: Pick<RelationView, 'tone' | 'orphan'>): BBoxTone {
  return relation.orphan ? ORPHAN_RELATION_TONE : relation.tone;
}

function candidateBoxTone(relationId: string): RelationIdentityTone {
  return relationTone(relationId);
}

function relationTone(relationId: string): RelationIdentityTone {
  const badge = relationBadge(relationId);
  const overrideTone = RELATION_TONE_OVERRIDES[badge];
  if (overrideTone) {
    return overrideTone;
  }
  const seed = Array.from(badge).reduce((total, char) => total + char.charCodeAt(0), 0);
  return DEFAULT_RELATION_TONES[seed % DEFAULT_RELATION_TONES.length];
}

function cloneBbox(value: readonly number[]): BBox {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, value[3] ?? 0];
}

function hasClosedField(fieldName: string) {
  const field = props.labelConfig?.fields.find((item) => item.field === fieldName && item.mode === 'closed_enum');
  return Boolean(field?.options.length);
}

function selectOptions(fieldName: string, current: string) {
  const options = props.labelConfig?.fields
    .find((field) => field.field === fieldName && field.mode === 'closed_enum')
    ?.options.map((option) => option.code) ?? [];
  return Array.from(new Set([current, ...options].filter(Boolean)));
}

function objectOptions(current: string) {
  return Array.from(new Set([current, ...RELATION_OBJECT_OPTIONS].filter(Boolean)));
}

function optionDisplayLabel(fieldName: string, code: string) {
  if (fieldName === 'violation_category') {
    return code;
  }
  const option = props.labelConfig?.fields
    .find((field) => field.field === fieldName)
    ?.options.find((item) => item.code === code);
  return option?.labelZh || option?.labelEn || FIELD_VALUE_LABELS[fieldName]?.[code] || displayLooseValue(code);
}

function displayLooseValue(value: string) {
  const direct = Object.values(FIELD_VALUE_LABELS)
    .map((labels) => labels[value])
    .find(Boolean);
  if (direct) {
    return direct;
  }
  return value;
}

function statusDisplayLabel(value: string | undefined) {
  if (!value) {
    return '未知';
  }
  return STATUS_LABELS[value] ?? value;
}

function tagListId(field: string) {
  return `tag-suggestions-${field}`;
}

function tagSuggestions(fieldName: string) {
  const configured = props.labelConfig?.fields
    .find((field) => field.field === fieldName)
    ?.options.map((option) => option.code) ?? [];
  return Array.from(new Set([...(props.labelSuggestions?.[fieldName] ?? []), ...(remoteSuggestions.value[fieldName] ?? []), ...configured]));
}

async function loadTagSuggestions(field: string) {
  if (!canEditLabels.value || !props.requestLabelSuggestions) {
    return;
  }
  remoteSuggestions.value = {
    ...remoteSuggestions.value,
    [field]: await props.requestLabelSuggestions(field, candidateTagInput.value),
  };
}

function inputValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

function checkedValue(event: Event) {
  return (event.target as HTMLInputElement).checked;
}

function numberValue(event: Event) {
  const value = Number(inputValue(event));
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}

function referenceBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return '-';
  }
  return value ? '是' : '否';
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) {
    return '未知';
  }
  if (ms <= 0) {
    return '已过期';
  }
  return `剩余 ${Math.ceil(ms / 60000)} 分钟`;
}

function leaseExpired(expiresAt: string | undefined) {
  if (!expiresAt) {
    return false;
  }
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Number.isFinite(ms) && ms <= 0;
}

function toBatchDraftValidation(validation?: LabelEditValidationResult): BatchLabelEditDraftValidation | undefined {
  if (!validation) {
    return undefined;
  }
  return {
    valid: validation.valid,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

function fromBatchDraftValidation(validation?: BatchLabelEditDraftValidation): LabelEditValidationResult | undefined {
  if (!validation) {
    return undefined;
  }
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

function currentBatchDraftSample(): BatchLabelEditDraftSample {
  return {
    sampleId: patchPayload.value.sampleId,
    labelConfigId: patchPayload.value.labelConfigId ?? null,
    labelConfigVersion: patchPayload.value.labelConfigVersion ?? null,
    leaseId: patchPayload.value.leaseId ?? null,
    baseRevision: patchPayload.value.baseRevision ?? null,
    operations: [...patchPayload.value.operations],
    dirty: true,
    saved: false,
    validation: toBatchDraftValidation(validationResult.value),
  };
}

function draftSignature(sample: Pick<BatchLabelEditDraftSample, 'operations' | 'labelConfigId' | 'labelConfigVersion'>) {
  return JSON.stringify({
    labelConfigId: sample.labelConfigId,
    labelConfigVersion: sample.labelConfigVersion,
    operations: sample.operations,
  });
}

function normalizeBatchDraftSampleForCurrentContext(sample: BatchLabelEditDraftSample): BatchLabelEditDraftSample {
  return {
    ...sample,
    sampleId: baseSample.value.asset.sampleId,
    leaseId: sample.leaseId ?? patchPayload.value.leaseId ?? null,
    baseRevision: sample.baseRevision ?? patchPayload.value.baseRevision ?? null,
    labelConfigId: sample.labelConfigId ?? patchPayload.value.labelConfigId ?? null,
    labelConfigVersion: sample.labelConfigVersion ?? patchPayload.value.labelConfigVersion ?? null,
    operations: [...sample.operations],
  };
}

function sampleLevelDraftEntry(): BatchLabelEditDraftSample | undefined {
  const draft = props.detail.myDraft;
  if (!draft || draft.sampleId !== baseSample.value.asset.sampleId) {
    return undefined;
  }
  return {
    sampleId: draft.sampleId,
    leaseId: draft.leaseId ?? patchPayload.value.leaseId ?? null,
    baseRevision: draft.taskRevision ?? patchPayload.value.baseRevision ?? null,
    labelConfigId: draft.labelConfigId ?? patchPayload.value.labelConfigId ?? null,
    labelConfigVersion: draft.labelConfigVersion ?? patchPayload.value.labelConfigVersion ?? null,
    operations: [...draft.operations],
    dirty: false,
    saved: true,
  };
}

function submittedDraftEntry(): BatchLabelEditDraftSample | undefined {
  const submission = props.detail.latestSubmission;
  if (!submission || submission.sampleId !== baseSample.value.asset.sampleId || !submission.operations.length) {
    return undefined;
  }
  return {
    sampleId: submission.sampleId,
    leaseId: undefined,
    baseRevision: submission.taskRevision ?? patchPayload.value.baseRevision ?? null,
    labelConfigId: submission.labelConfigId ?? patchPayload.value.labelConfigId ?? null,
    labelConfigVersion: submission.labelConfigVersion ?? patchPayload.value.labelConfigVersion ?? null,
    operations: [...submission.operations],
    dirty: false,
    saved: true,
  };
}

function currentRemoteBatchDraftSample(): { sample: BatchLabelEditDraftSample; savedAt?: string } | undefined {
  const sampleId = baseSample.value.asset.sampleId;
  const sample = props.batchDraft?.samples.find((entry) => entry.sampleId === sampleId && entry.saved && !entry.dirty);
  if (!sample) {
    return undefined;
  }
  return {
    sample: normalizeBatchDraftSampleForCurrentContext(sample),
    savedAt: props.batchDraft?.updatedAt,
  };
}

function restorableDraftSampleForCurrentSample():
  | { sample: BatchLabelEditDraftSample; savedAt?: string; source: 'local' | 'batch' | 'sample' | 'submitted' | 'cached' }
  | undefined {
  const sampleId = baseSample.value.asset.sampleId;
  const existing = batchDraftEntries.value[sampleId];
  if (existing?.dirty) {
    return {
      sample: normalizeBatchDraftSampleForCurrentContext(existing.payload),
      savedAt: existing.savedAt,
      source: 'local',
    };
  }

  const remote = currentRemoteBatchDraftSample();
  if (remote) {
    return { ...remote, source: 'batch' };
  }

  const sampleLevelDraft = sampleLevelDraftEntry();
  if (sampleLevelDraft) {
    return {
      sample: sampleLevelDraft,
      savedAt: props.detail.myDraft?.updatedAt,
      source: 'sample',
    };
  }

  const submittedDraft = submittedDraftEntry();
  if (submittedDraft) {
    return {
      sample: submittedDraft,
      savedAt: props.detail.latestSubmission?.submittedAt,
      source: 'submitted',
    };
  }

  if (existing?.saved) {
    return {
      sample: normalizeBatchDraftSampleForCurrentContext(existing.payload),
      savedAt: existing.savedAt,
      source: 'cached',
    };
  }

  return undefined;
}

function rememberBatchDraftEntry(
  sample: BatchLabelEditDraftSample,
  options: { dirty?: boolean; saved?: boolean; savedAt?: string; savedSignature?: string } = {},
) {
  const dirty = options.dirty ?? sample.dirty;
  const saved = options.saved ?? sample.saved;
  batchDraftEntries.value = {
    ...batchDraftEntries.value,
    [sample.sampleId]: {
      payload: {
        ...sample,
        dirty,
        saved,
      },
      dirty,
      saved,
      savedAt: options.savedAt,
      savedSignature: options.savedSignature ?? (saved ? draftSignature(sample) : undefined),
      validation: fromBatchDraftValidation(sample.validation),
    },
  };
}

function resetReviewDraftForCurrentSample(preferFirstSelection = false) {
  const source = restorableDraftSampleForCurrentSample();
  const baseDraft = createReviewDraft(props.detail);

  if (!source) {
    reviewDraft.value = baseDraft;
    resetDraftSelection(baseDraft, preferFirstSelection);
    validationResult.value = undefined;
    patchSaved.value = Boolean(props.detail.humanReview);
    return;
  }

  const applyResult = applyBatchDraftOperations(baseDraft, source.sample.operations);
  reviewDraft.value = applyResult.draft;
  resetDraftSelection(applyResult.draft, preferFirstSelection);
  validationResult.value = fromBatchDraftValidation(source.sample.validation);

  if (source.source === 'local') {
    patchSaved.value = false;
    rememberBatchDraftEntry(source.sample, {
      dirty: true,
      saved: false,
      savedAt: source.savedAt,
      savedSignature: batchDraftEntries.value[source.sample.sampleId]?.savedSignature,
    });
    return;
  }

  patchSaved.value = source.sample.saved;
  const canonicalSavedSample: BatchLabelEditDraftSample = {
    ...source.sample,
    operations: [...operations.value],
    dirty: false,
    saved: true,
    validation: source.sample.validation,
  };
  rememberBatchDraftEntry(canonicalSavedSample, {
    dirty: false,
    saved: true,
    savedAt: source.savedAt,
    savedSignature: applyResult.unsupportedOperationCount === 0
      ? draftSignature(canonicalSavedSample)
      : draftSignature(source.sample),
  });
}

function resetDraftSelection(draft: ReviewDraft, preferFirstSelection = false) {
  const relationIds = Object.keys(draft.relationDrafts);
  const firstRelationId = relationIds[0] ?? relationBadge(props.detail.stage1.keyRelations[0]?.relationIndex ?? 'R1');
  if (preferFirstSelection || !draft.relationDrafts[activeRelationKey.value]) {
    activeRelationKey.value = firstRelationId;
  }
  activeImageRelationKey.value = '';
  activeCandidateId.value =
    !preferFirstSelection && draft.candidateDrafts.some((candidate) => candidate.id === activeCandidateId.value)
      ? activeCandidateId.value
      : draft.candidateDrafts[0]?.id ?? '';
  candidateTagInput.value = '';
}

function cloneRelationDraft(draft: RelationDraft): RelationDraft {
  return {
    ...draft,
    bbox: cloneBbox(draft.bbox),
  };
}

function cloneCandidateDraft(draft: CandidateDraft): CandidateDraft {
  return {
    ...draft,
    segmentationTargets: [...draft.segmentationTargets],
    evidenceRelationIds: [...draft.evidenceRelationIds],
  };
}

function cloneReviewDraft(draft: ReviewDraft): ReviewDraft {
  return {
    relationDrafts: Object.fromEntries(
      Object.entries(draft.relationDrafts).map(([key, relation]) => [key, cloneRelationDraft(relation)]),
    ),
    candidateDrafts: draft.candidateDrafts.map((candidate) => cloneCandidateDraft(candidate)),
    deletedCandidateDrafts: draft.deletedCandidateDrafts.map((candidate) => cloneCandidateDraft(candidate)),
  };
}

function applyBatchDraftOperations(
  baseDraft: ReviewDraft,
  operationList: LabelEditOperation[],
): { draft: ReviewDraft; unsupportedOperationCount: number } {
  const draft = cloneReviewDraft(baseDraft);
  let unsupportedOperationCount = 0;

  operationList.forEach((operation) => {
    if (operation.op === 'replace' && applyReplaceOperation(draft, operation)) {
      return;
    }
    if (operation.op === 'delete_candidate' && applyDeleteCandidateOperation(draft, operation)) {
      return;
    }
    unsupportedOperationCount += 1;
  });

  return { draft, unsupportedOperationCount };
}

function applyReplaceOperation(draft: ReviewDraft, operation: LabelEditOperation) {
  const relationId = scopedId(operation.scope, 'relation');
  if (relationId) {
    return applyRelationReplaceOperation(draft, relationId, operation.field, operation.after);
  }
  const verificationRelationId = scopedId(operation.scope, 'verification');
  if (verificationRelationId) {
    return applyVerificationReplaceOperation(draft, verificationRelationId, operation.field, operation.after);
  }
  const candidateId = scopedId(operation.scope, 'candidate');
  if (candidateId) {
    return applyCandidateReplaceOperation(draft, candidateId, operation.field, operation.after);
  }
  return false;
}

function applyRelationReplaceOperation(draft: ReviewDraft, relationId: string, field: string, after: unknown) {
  const relation = draft.relationDrafts[relationId];
  if (!relation) {
    return false;
  }
  if (field === 'subject') {
    relation.subject = stringValue(after);
    return true;
  }
  if (field === 'relation') {
    relation.relation = stringValue(after);
    return true;
  }
  if (field === 'object') {
    relation.object = stringValue(after);
    return true;
  }
  if (field === 'description') {
    relation.description = stringValue(after);
    return true;
  }
  if (field === 'bbox') {
    const bbox = bboxValue(after);
    if (!bbox) {
      return false;
    }
    relation.bbox = bbox;
    return true;
  }
  return false;
}

function applyVerificationReplaceOperation(draft: ReviewDraft, relationId: string, field: string, after: unknown) {
  const relation = draft.relationDrafts[relationId];
  if (!relation) {
    return false;
  }
  if (field === 'visibility_level') {
    relation.visibilityLevel = stringValue(after);
    return true;
  }
  if (field === 'information_loss_type') {
    relation.informationLossType = stringValue(after);
    return true;
  }
  if (field === 'verification_result') {
    relation.verificationResult = stringValue(after);
    return true;
  }
  if (field === 'verification_confidence') {
    relation.verificationConfidence = numberValueFromUnknown(after);
    return true;
  }
  if (field === 'bbox_observation') {
    relation.bboxObservation = stringValue(after);
    return true;
  }
  if (field === 'global_context_observation') {
    relation.globalContextObservation = stringValue(after);
    return true;
  }
  return false;
}

function applyCandidateReplaceOperation(draft: ReviewDraft, candidateId: string, field: string, after: unknown) {
  let candidate = draft.candidateDrafts.find((item) => item.id === candidateId);
  if (!candidate) {
    candidate = createRestoredCandidate(candidateId);
    draft.candidateDrafts.push(candidate);
  }
  if (field === 'violation_category') {
    candidate.violationCategory = stringValue(after);
    return true;
  }
  if (field === 'sample_category') {
    candidate.sampleCategory = stringValue(after);
    return true;
  }
  if (field === 'confidence') {
    candidate.confidence = numberValueFromUnknown(after);
    return true;
  }
  if (field === 'segmentation_targets') {
    candidate.segmentationTargets = stringArrayValue(after);
    return true;
  }
  if (field === 'evidence_relations') {
    candidate.evidenceRelationIds = stringArrayValue(after).map((item) => relationBadge(item));
    return true;
  }
  if (field === 'evidence_reasoning') {
    candidate.evidenceReasoning = stringValue(after);
    return true;
  }
  if (field === 'relation_hint') {
    candidate.relationHint = stringValue(after);
    return true;
  }
  return false;
}

function applyDeleteCandidateOperation(draft: ReviewDraft, operation: LabelEditOperation) {
  const candidateId = scopedId(operation.scope, 'candidate');
  if (!candidateId) {
    return false;
  }
  const candidateIndex = draft.candidateDrafts.findIndex((candidate) => candidate.id === candidateId);
  if (candidateIndex < 0) {
    return false;
  }
  const candidate = draft.candidateDrafts[candidateIndex];
  draft.candidateDrafts.splice(candidateIndex, 1);
  if (candidate.sourceIndex !== undefined && !draft.deletedCandidateDrafts.some((item) => item.id === candidate.id)) {
    draft.deletedCandidateDrafts.push(candidate);
  }
  return true;
}

function scopedId(scope: string, prefix: 'relation' | 'verification' | 'candidate') {
  const match = new RegExp(`^${prefix}:(.+)$`, 'i').exec(scope);
  const raw = match?.[1]?.trim();
  if (!raw) {
    return '';
  }
  return prefix === 'candidate' ? candidateBadge(raw) : relationBadge(raw);
}

function candidateBadge(value: string | number) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'C1';
  }
  return /^C/i.test(raw) ? raw.toUpperCase() : `C${raw}`;
}

function stringValue(value: unknown) {
  return value == null ? '' : String(value);
}

function numberValueFromUnknown(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function stringArrayValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => stringValue(item)).filter(Boolean);
}

function bboxValue(value: unknown): BBox | undefined {
  if (!Array.isArray(value) || value.length < 4) {
    return undefined;
  }
  const values = value.slice(0, 4).map((item) => Number(item));
  if (values.some((item) => !Number.isFinite(item))) {
    return undefined;
  }
  return [values[0], values[1], values[2], values[3]];
}

function syncRemoteBatchDraft() {
  const remoteDraft = props.batchDraft;
  if (!remoteDraft) {
    return;
  }
  const nextEntries = { ...batchDraftEntries.value };
  remoteDraft.samples.forEach((sample) => {
    const existing = nextEntries[sample.sampleId];
    if (existing?.dirty) {
      return;
    }
    const saved = Boolean(sample.saved);
    const dirty = Boolean(sample.dirty && !saved);
    nextEntries[sample.sampleId] = {
      payload: sample,
      dirty,
      saved,
      savedAt: remoteDraft.updatedAt,
      savedSignature: saved ? draftSignature(sample) : existing?.savedSignature,
      validation: fromBatchDraftValidation(sample.validation),
    };
  });
  batchDraftEntries.value = nextEntries;
  resetReviewDraftForCurrentSample();
}

function syncCurrentBatchEntry() {
  const sampleId = baseSample.value.asset.sampleId;
  const operationsList = operations.value;
  const existing = batchDraftEntries.value[sampleId];
  const nextEntries = { ...batchDraftEntries.value };

  if (operationsList.length === 0) {
    if (existing?.dirty && !existing.saved) {
      delete nextEntries[sampleId];
      batchDraftEntries.value = nextEntries;
    }
    return;
  }

  const payload = currentBatchDraftSample();
  const signature = draftSignature(payload);
  const dirty = existing?.savedSignature !== signature;
  nextEntries[sampleId] = {
    payload: {
      ...payload,
      dirty,
      saved: Boolean(existing?.saved && !dirty),
    },
    dirty,
    saved: Boolean(existing?.saved && !dirty),
    savedAt: existing?.savedAt,
    savedSignature: existing?.savedSignature,
    validation: toBatchDraftValidation(validationResult.value) ?? existing?.validation,
  };
  batchDraftEntries.value = nextEntries;
}

function savedAtForResult(result: BatchLabelEditDraftSaveResult) {
  return result.updatedAt ?? new Date().toISOString();
}

function markEntriesSaved(samples: BatchLabelEditDraftSample[], result: BatchLabelEditDraftSaveResult) {
  const savedAt = savedAtForResult(result);
  const nextEntries = { ...batchDraftEntries.value };
  const savedIds = new Set(result.sampleIds.length ? result.sampleIds : samples.map((sample) => sample.sampleId));
  samples.forEach((sample) => {
    if (!savedIds.has(sample.sampleId)) {
      return;
    }
    const savedSignature = draftSignature(sample);
    const current = nextEntries[sample.sampleId];
    if (current && draftSignature(current.payload) !== savedSignature) {
      nextEntries[sample.sampleId] = {
        ...current,
        payload: {
          ...current.payload,
          dirty: true,
          saved: false,
        },
        dirty: true,
        saved: false,
      };
      return;
    }
    nextEntries[sample.sampleId] = {
      payload: {
        ...sample,
        dirty: false,
        saved: true,
      },
      dirty: false,
      saved: true,
      savedAt,
      savedSignature: draftSignature(sample),
      validation: sample.validation,
    };
  });
  batchDraftEntries.value = nextEntries;
}

function clearAutosaveTimer() {
  if (autosaveTimer === undefined) {
    return;
  }
  window.clearTimeout(autosaveTimer);
  autosaveTimer = undefined;
}

function autosaveIntervalAllowed(value: number) {
  return AUTOSAVE_INTERVAL_OPTIONS.some((option) => option.value === value);
}

function readAutosaveIntervalMs() {
  if (typeof window === 'undefined') {
    return DEFAULT_AUTOSAVE_INTERVAL_MS;
  }
  const value = Number(window.localStorage?.getItem(AUTOSAVE_INTERVAL_STORAGE_KEY));
  return autosaveIntervalAllowed(value) ? value : DEFAULT_AUTOSAVE_INTERVAL_MS;
}

function setAutosaveInterval(value: string | number) {
  const nextValue = Number(value);
  if (!autosaveIntervalAllowed(nextValue)) {
    return;
  }
  autosaveIntervalMs.value = nextValue;
  try {
    window.localStorage?.setItem(AUTOSAVE_INTERVAL_STORAGE_KEY, String(nextValue));
  } catch {
    // Preference persistence is best-effort; autosave scheduling still works.
  }
  clearAutosaveTimer();
  scheduleAutosaveIfNeeded();
}

function scheduleAutosaveIfNeeded() {
  if (
    autosaveTimer !== undefined ||
    saveQueue.value ||
    !canEditLabels.value ||
    !props.autosaveBatchDraft ||
    !hasUnsavedDirty.value
  ) {
    return;
  }
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = undefined;
    void runBatchDraftSave('autosave');
  }, autosaveIntervalMs.value);
}

async function runBatchDraftSave(kind: BatchSaveKind) {
  syncCurrentBatchEntry();
  clearAutosaveTimer();
  if (!canEditLabels.value) {
    if (kind === 'manual') {
      actionMessage.value = editGateMessage.value;
    }
    return undefined;
  }
  if (saveQueue.value) {
    if (kind === 'manual') {
      actionMessage.value = '草稿保存正在进行';
    }
    return saveQueue.value;
  }

  const samples = dirtyDraftEntries.value.map((entry) => entry.payload);
  if (!samples.length) {
    if (kind === 'manual') {
      actionMessage.value = '没有待保存的批次草稿';
    }
    return undefined;
  }

  const saveFn = kind === 'autosave' ? props.autosaveBatchDraft : props.saveBatchDraft;
  if (!saveFn) {
    if (kind === 'manual') {
      actionMessage.value = '缺少批次草稿保存接口';
    }
    return undefined;
  }

  savePending.value = true;
  batchSaveKind.value = kind;
  if (kind === 'autosave') {
    autosaveStatus.value = 'saving';
  }
  if (kind === 'manual') {
    actionMessage.value = '';
  }

  const payload: BatchLabelEditDraftPayload = {
    entries: samples,
  };
  const savePromise = saveFn(payload)
    .then((result) => {
      markEntriesSaved(samples, result);
      const resultTime = currentTime();
      if (samples.some((sample) => sample.sampleId === baseSample.value.asset.sampleId)) {
        patchSaved.value = true;
        lastSavedAt.value = resultTime;
      }
      if (kind === 'autosave') {
        autosaveStatus.value = 'saved';
        lastAutosavedAt.value = resultTime;
      } else {
        actionMessage.value = `批次草稿已保存 ${samples.length} 个样本`;
      }
      autosaveMessage.value = '';
      return result;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : kind === 'autosave' ? '自动保存失败' : '保存草稿失败';
      autosaveStatus.value = 'failed';
      autosaveMessage.value = message;
      if (kind === 'manual') {
        actionMessage.value = message;
      }
      return undefined;
    })
    .finally(() => {
      savePending.value = false;
      batchSaveKind.value = undefined;
      saveQueue.value = undefined;
      scheduleAutosaveIfNeeded();
    });

  saveQueue.value = savePromise;
  return savePromise;
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden' && hasUnsavedDirty.value) {
    void runBatchDraftSave('autosave');
  }
}

function handleWorkbenchKeydown(event: KeyboardEvent) {
  if (activeReviewShortcutOwner !== shortcutOwner || !shouldHandlePlainShortcut(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  if ((key === 'arrowleft' || key === 'a') && canGoPrevious.value) {
    event.preventDefault();
    void goToPreviousQueueItem();
    return;
  }
  if ((key === 'arrowright' || key === 'd') && canGoNext.value) {
    event.preventDefault();
    void goToNextQueueItem();
    return;
  }
  if (key === 'x' && canSkipSample.value) {
    event.preventDefault();
    void skipSample();
    return;
  }
  if (key === 'v' && canValidateChanges.value) {
    event.preventDefault();
    void validateChanges();
    return;
  }
  if (key === 's' && canSaveBatchDraft.value) {
    event.preventDefault();
    void saveDraft();
  }
}

function shouldHandlePlainShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  const key = event.key.toLowerCase();
  if (!['arrowleft', 'arrowright', 'a', 'd', 'x', 'v', 's'].includes(key)) {
    return false;
  }

  return !isEditableShortcutTarget(event.target);
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest('input, textarea, select, button, [role="textbox"]')) {
    return true;
  }

  const editable = target.closest('[contenteditable]');
  if (!(editable instanceof HTMLElement)) {
    return false;
  }
  return editable.getAttribute('contenteditable')?.toLowerCase() !== 'false';
}

function markEdited() {
  patchSaved.value = false;
  validationResult.value = undefined;
  actionMessage.value = '';
}

function setRelationField(field: keyof RelationDraft, value: RelationDraft[keyof RelationDraft]) {
  if (!canEditLabels.value || !activeRelationDraft.value) {
    actionMessage.value = editGateMessage.value;
    return;
  }
  const badge = activeRelationKey.value;
  reviewDraft.value = {
    ...reviewDraft.value,
    relationDrafts: {
      ...reviewDraft.value.relationDrafts,
      [badge]: {
        ...activeRelationDraft.value,
        [field]: value,
      },
    },
  };
  markEdited();
}

function setCandidateField(field: keyof CandidateDraft, value: CandidateDraft[keyof CandidateDraft]) {
  if (!canEditLabels.value || !activeCandidateDraft.value) {
    actionMessage.value = editGateMessage.value;
    return;
  }
  const activeId = activeCandidateDraft.value.id;
  reviewDraft.value = {
    ...reviewDraft.value,
    candidateDrafts: reviewDraft.value.candidateDrafts.map((candidate) =>
      candidate.id === activeId ? { ...candidate, [field]: value } : candidate,
    ),
  };
  markEdited();
}

function setActiveRelation(relationId: string) {
  activeRelationKey.value = relationBadge(relationId);
}

function setActiveCandidate(candidateId: string) {
  activeCandidateId.value = candidateId;
  const candidate = reviewDraft.value.candidateDrafts.find((item) => item.id === candidateId);
  if (candidate?.evidenceRelationIds[0]) {
    setActiveRelation(candidate.evidenceRelationIds[0]);
  }
}

function selectOverlayBox(box: OverlayBox) {
  if (box.relationIndex) {
    const relationId = relationBadge(box.relationIndex);
    activeImageRelationKey.value = relationId;
    setActiveRelation(relationId);
  }
}

function updateOverlayBox(box: OverlayBox, bbox: BBox) {
  if (!box.relationIndex || !canEditLabels.value) {
    return;
  }
  activeImageRelationKey.value = relationBadge(box.relationIndex);
  setActiveRelation(box.relationIndex);
  setRelationField('bbox', bbox);
}

function addCandidate() {
  if (!canEditLabels.value) {
    actionMessage.value = editGateMessage.value;
    return;
  }
  const candidate = createEmptyCandidate();
  reviewDraft.value = {
    ...reviewDraft.value,
    candidateDrafts: [...reviewDraft.value.candidateDrafts, candidate],
  };
  activeCandidateId.value = candidate.id;
  markEdited();
}

function deleteCandidate(candidateId: string) {
  if (!canEditLabels.value) {
    actionMessage.value = editGateMessage.value;
    return;
  }

  const candidateIndex = reviewDraft.value.candidateDrafts.findIndex((candidate) => candidate.id === candidateId);
  if (candidateIndex < 0) {
    return;
  }

  const candidate = reviewDraft.value.candidateDrafts[candidateIndex];
  const nextCandidates = reviewDraft.value.candidateDrafts.filter((item) => item.id !== candidateId);
  const nextDeletedCandidates =
    candidate.sourceIndex === undefined
      ? reviewDraft.value.deletedCandidateDrafts
      : [...reviewDraft.value.deletedCandidateDrafts.filter((item) => item.id !== candidate.id), candidate];

  reviewDraft.value = {
    ...reviewDraft.value,
    candidateDrafts: nextCandidates,
    deletedCandidateDrafts: nextDeletedCandidates,
  };
  activeCandidateId.value = nextCandidates[Math.min(candidateIndex, nextCandidates.length - 1)]?.id ?? '';
  candidateTagInput.value = '';
  markEdited();
}

function addCandidateTag() {
  const value = candidateTagInput.value.trim();
  const candidate = activeCandidateDraft.value;
  if (!canEditLabels.value || !candidate || !value || candidate.segmentationTargets.includes(value)) {
    candidateTagInput.value = '';
    return;
  }
  setCandidateField('segmentationTargets', [...candidate.segmentationTargets, value]);
  candidateTagInput.value = '';
}

function removeCandidateTag(tag: string) {
  const candidate = activeCandidateDraft.value;
  if (!candidate) {
    return;
  }
  setCandidateField('segmentationTargets', candidate.segmentationTargets.filter((item) => item !== tag));
}

function toggleCandidateRelation(relationId: string, checked: boolean) {
  const candidate = activeCandidateDraft.value;
  if (!candidate) {
    return;
  }
  const next = checked
    ? Array.from(new Set([...candidate.evidenceRelationIds, relationId]))
    : candidate.evidenceRelationIds.filter((item) => item !== relationId);
  setCandidateField('evidenceRelationIds', next);
}

async function navigateWithDirtyGuard(target: string) {
  if (navigationPending.value || validationPending.value || savePending.value || submitPending.value) {
    return false;
  }

  navigationPending.value = true;
  try {
    if (hasUnsavedDirty.value) {
      const saved = await runBatchDraftSave('manual');
      if (!saved) {
        return false;
      }
    }
    await props.releaseSampleLease?.({ preserveDisplayedLease: true });
    if (router) {
      await router.push(target);
      return true;
    }
    globalThis.location?.assign(target);
    return true;
  } finally {
    navigationPending.value = false;
  }
}

async function goToPreviousQueueItem() {
  if (!previousQueueItem.value || !canGoPrevious.value) {
    return false;
  }
  return navigateWithDirtyGuard(reviewHref(previousQueueItem.value.sampleId));
}

async function goToNextQueueItem() {
  if (!nextQueueItem.value || !canGoNext.value) {
    return false;
  }
  return navigateWithDirtyGuard(reviewHref(nextQueueItem.value.sampleId));
}

async function skipSample() {
  if (!canSkipSample.value) {
    return false;
  }
  const target = nextQueueItem.value
    ? reviewHref(nextQueueItem.value.sampleId)
    : `/datasets/${baseSample.value.asset.datasetId}/qc`;
  return navigateWithDirtyGuard(target);
}

async function validateChanges() {
  if (!canValidateChanges.value || !props.validateLabelEdit) {
    actionMessage.value = editGateMessage.value;
    return undefined;
  }
  validationPending.value = true;
  actionMessage.value = '';
  try {
    const result = await props.validateLabelEdit(patchPayload.value);
    validationResult.value = result;
    syncCurrentBatchEntry();
    actionMessage.value = result.valid ? '字段合法' : `字段非法 ${result.errors.length} 项`;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '字段合法性校验失败';
    validationResult.value = {
      valid: false,
      errors: [{ operationIndex: -1, scope: 'label_edit', field: 'request', code: 'request_failed', message }],
      warnings: [],
    };
    syncCurrentBatchEntry();
    actionMessage.value = message;
    return validationResult.value;
  } finally {
    validationPending.value = false;
  }
}

async function saveDraft() {
  if (!canSaveBatchDraft.value) {
    return undefined;
  }
  await runBatchDraftSave('manual');
}

function openBatchSubmitModal() {
  if (navigationPending.value || submitPending.value) {
    return;
  }
  syncCurrentBatchEntry();
  submitModalOpen.value = true;
}

async function confirmBatchSubmit() {
  syncCurrentBatchEntry();
  if (submitPending.value || !batchSubmitReady.value || !props.submitBatchLabelEdits) {
    actionMessage.value = batchSubmitBlockReasons.value.join('；') || editGateMessage.value;
    return;
  }
  submitPending.value = true;
  actionMessage.value = '';
  try {
    await props.submitBatchLabelEdits({
      unsavedDirtySampleIds: unsavedDirtySampleIds.value,
      validationErrorSampleIds: validationErrorSampleIds.value,
      notes: null,
    });
    patchSaved.value = true;
    lastSavedAt.value = currentTime();
    submitModalOpen.value = false;
    actionMessage.value = '批次修改已提交';
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : '提交批次修改失败';
  } finally {
    submitPending.value = false;
  }
}

function currentTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function relationDirty(base: StageRelation, verification: FactVerification | undefined, draft: RelationDraft) {
  return (
    base.subject !== draft.subject ||
    base.relation !== draft.relation ||
    base.object !== draft.object ||
    (base.description ?? '') !== draft.description ||
    !sameArray(base.bbox, draft.bbox) ||
    (verification?.visibilityLevel ?? '') !== draft.visibilityLevel ||
    (verification?.informationLossType ?? '') !== draft.informationLossType ||
    (verification?.verificationResult ?? '') !== draft.verificationResult ||
    (verification?.verificationConfidence ?? 0) !== draft.verificationConfidence ||
    (verification?.bboxObservation ?? '') !== draft.bboxObservation ||
    (verification?.globalContextObservation ?? '') !== draft.globalContextObservation
  );
}

function candidateDirty(candidate: CandidateDraft) {
  const base = baseSample.value.stage2?.candidates[candidate.sourceIndex ?? -1];
  if (!base) {
    return true;
  }
  return (
    base.violationCategory !== candidate.violationCategory ||
    base.sampleCategory !== candidate.sampleCategory ||
    base.confidence !== candidate.confidence ||
    base.evidenceReasoning !== candidate.evidenceReasoning ||
    (base.relationHint ?? '') !== candidate.relationHint ||
    !sameArray(base.segmentationTargets, candidate.segmentationTargets) ||
    !sameArray(base.evidenceRelationIndices.map((item) => relationBadge(item)), candidate.evidenceRelationIds)
  );
}

function sameArray(a: readonly unknown[], b: readonly unknown[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addReplaceOperation(
  operationsList: LabelEditOperation[],
  scope: string,
  field: string,
  before: unknown,
  after: unknown,
) {
  const changed = Array.isArray(before) && Array.isArray(after) ? !sameArray(before, after) : before !== after;
  if (!changed) {
    return;
  }
  operationsList.push({ scope, field, op: 'replace', before, after });
}

function buildOperations(): LabelEditOperation[] {
  const nextOperations: LabelEditOperation[] = [];
  relationViews.value.forEach((relation) => {
    const scope = `relation:${relation.badge}`;
    const verificationScope = `verification:${relation.badge}`;
    addReplaceOperation(nextOperations, scope, 'subject', relation.base.subject, relation.draft.subject);
    addReplaceOperation(nextOperations, scope, 'relation', relation.base.relation, relation.draft.relation);
    addReplaceOperation(nextOperations, scope, 'object', relation.base.object, relation.draft.object);
    addReplaceOperation(nextOperations, scope, 'description', relation.base.description ?? '', relation.draft.description);
    addReplaceOperation(nextOperations, scope, 'bbox', relation.base.bbox, relation.draft.bbox);
    addReplaceOperation(
      nextOperations,
      verificationScope,
      'visibility_level',
      relation.verification?.visibilityLevel ?? '',
      relation.draft.visibilityLevel,
    );
    addReplaceOperation(
      nextOperations,
      verificationScope,
      'information_loss_type',
      relation.verification?.informationLossType ?? '',
      relation.draft.informationLossType,
    );
    addReplaceOperation(
      nextOperations,
      verificationScope,
      'verification_result',
      relation.verification?.verificationResult ?? '',
      relation.draft.verificationResult,
    );
    addReplaceOperation(
      nextOperations,
      verificationScope,
      'verification_confidence',
      relation.verification?.verificationConfidence ?? 0,
      relation.draft.verificationConfidence,
    );
    addReplaceOperation(
      nextOperations,
      verificationScope,
      'bbox_observation',
      relation.verification?.bboxObservation ?? '',
      relation.draft.bboxObservation,
    );
    addReplaceOperation(
      nextOperations,
      verificationScope,
      'global_context_observation',
      relation.verification?.globalContextObservation ?? '',
      relation.draft.globalContextObservation,
    );
  });

  reviewDraft.value.deletedCandidateDrafts.forEach((candidate) => {
    const base = baseSample.value.stage2?.candidates[candidate.sourceIndex ?? -1];
    nextOperations.push({
      scope: `candidate:${candidate.id}`,
      field: 'candidate',
      op: 'delete_candidate',
      before: base ? candidateSnapshotFromBase(base, candidate.id) : candidateSnapshot(candidate),
      after: null,
    });
  });

  reviewDraft.value.candidateDrafts.forEach((candidate) => {
    const base = baseSample.value.stage2?.candidates[candidate.sourceIndex ?? -1];
    const scope = `candidate:${candidate.id}`;
    addReplaceOperation(nextOperations, scope, 'violation_category', base?.violationCategory ?? '', candidate.violationCategory);
    addReplaceOperation(nextOperations, scope, 'sample_category', base?.sampleCategory ?? '', candidate.sampleCategory);
    addReplaceOperation(nextOperations, scope, 'confidence', base?.confidence ?? 0, candidate.confidence);
    addReplaceOperation(nextOperations, scope, 'segmentation_targets', base?.segmentationTargets ?? [], candidate.segmentationTargets);
    addReplaceOperation(
      nextOperations,
      scope,
      'evidence_relations',
      base?.evidenceRelationIndices.map((item) => relationBadge(item)) ?? [],
      candidate.evidenceRelationIds,
    );
    addReplaceOperation(nextOperations, scope, 'evidence_reasoning', base?.evidenceReasoning ?? '', candidate.evidenceReasoning);
    addReplaceOperation(nextOperations, scope, 'relation_hint', base?.relationHint ?? '', candidate.relationHint);
  });
  return nextOperations;
}

function candidateSnapshot(candidate: CandidateDraft) {
  return {
    id: candidate.id,
    violation_category: candidate.violationCategory,
    sample_category: candidate.sampleCategory,
    confidence: candidate.confidence,
    segmentation_targets: candidate.segmentationTargets,
    evidence_relations: candidate.evidenceRelationIds,
    evidence_reasoning: candidate.evidenceReasoning,
    relation_hint: candidate.relationHint,
  };
}

function candidateSnapshotFromBase(candidate: Stage2Candidate, id: string) {
  return {
    id,
    violation_category: candidate.violationCategory,
    sample_category: candidate.sampleCategory,
    confidence: candidate.confidence,
    segmentation_targets: candidate.segmentationTargets,
    evidence_relations: candidate.evidenceRelationIndices.map((item) => relationBadge(item)),
    evidence_reasoning: candidate.evidenceReasoning,
    relation_hint: candidate.relationHint ?? '',
  };
}
</script>

<style scoped>
.sample-detail-workbench {
  position: fixed;
  inset: 10px 10px 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 58px;
  color: #edf2f7;
}

.qc-topbar,
.work-panel,
.review-action-bar {
  border: 1px solid #343d4c;
  border-radius: 8px;
  background: #171b22;
}

.qc-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-height: 72px;
  padding: 12px;
}

.sample-meta,
.chip-row,
.top-actions,
.layer-toggles,
.tag-row,
.bottom-status,
.label-edit-actions,
.status-row,
.candidate-editor-header,
.candidate-header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
  min-width: 0;
}

.sample-meta {
  gap: 16px;
}

.meta-block {
  display: grid;
  gap: 4px;
  min-width: 116px;
}

.meta-block--sample {
  min-width: min(360px, 100%);
}

.meta-block span,
.field-label,
.mini-label {
  color: #718096;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.meta-block strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #f7fafc;
  font-size: 13px;
}

.progress-meter {
  width: 160px;
  max-width: 100%;
  height: 8px;
  overflow: hidden;
  border: 1px solid #343d4c;
  border-radius: 999px;
  background: #0d1015;
}

.progress-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #4f8cff;
}

.draft-state {
  display: inline-flex;
  width: fit-content;
  min-height: 25px;
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
}

.draft-state--saved {
  color: #c6f6d5;
  background: rgba(72, 187, 120, 0.12);
}

.draft-state--dirty {
  color: #faf089;
  background: rgba(214, 158, 46, 0.12);
}

.toolbar-button,
.decision-button,
.save-button,
.submit-button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #343d4c;
  border-radius: 7px;
  background: #1f2630;
  color: #edf2f7;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.toolbar-button:hover:not(:disabled),
.decision-button:hover:not(:disabled),
.save-button:hover:not(:disabled) {
  border-color: #4a5568;
  background: #262e3a;
}

.sample-detail-workbench.is-switching-sample .review-grid,
.sample-detail-workbench.is-switching-sample .review-action-bar {
  pointer-events: none;
}

.gate-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(214, 158, 46, 0.56);
  border-radius: 8px;
  background: rgba(214, 158, 46, 0.12);
  color: #faf089;
  padding: 10px 12px;
  font-size: 13px;
}

.gate-warning--config {
  border-color: rgba(245, 101, 101, 0.58);
  background: rgba(245, 101, 101, 0.12);
  color: #fed7d7;
}

.gate-warning--readonly {
  border-color: rgba(79, 140, 255, 0.5);
  background: rgba(79, 140, 255, 0.12);
  color: #bfdbfe;
}

.review-grid {
  display: grid;
  grid-template-columns: minmax(540px, 1.2fr) minmax(520px, 0.8fr);
  gap: 10px;
  min-height: 0;
}

.review-side-stack {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  min-height: 0;
}

.work-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #343d4c;
  padding: 10px 12px;
}

.panel-head strong {
  color: #f7fafc;
  font-size: 14px;
}

.pill,
.status-token {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 25px;
  border: 1px solid #343d4c;
  border-radius: 999px;
  background: #1f2630;
  color: #a0aec0;
  padding: 3px 8px;
  font-size: 12px;
  white-space: nowrap;
}

.pill--blue {
  border-color: rgba(79, 140, 255, 0.46);
  background: rgba(79, 140, 255, 0.12);
  color: #bfdbfe;
}

.pill--green,
.status-token--green {
  border-color: rgba(72, 187, 120, 0.46);
  background: rgba(72, 187, 120, 0.12);
  color: #c6f6d5;
}

.pill--amber,
.status-token--amber {
  border-color: rgba(214, 158, 46, 0.46);
  background: rgba(214, 158, 46, 0.12);
  color: #faf089;
}

.pill--red {
  border-color: rgba(245, 101, 101, 0.5);
  background: rgba(245, 101, 101, 0.1);
  color: #fed7d7;
}

.autosave-interval-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 25px;
  border: 1px solid rgba(79, 140, 255, 0.46);
  border-radius: 999px;
  background: rgba(79, 140, 255, 0.1);
  color: #bfdbfe;
  padding: 3px 8px;
  font-size: 12px;
  white-space: nowrap;
}

.autosave-interval-control span {
  font-weight: 800;
}

.autosave-interval-control select {
  min-width: 62px;
  height: 22px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: #111827;
  color: #edf2f7;
  padding: 0 7px;
  font: inherit;
}

.autosave-interval-control select:focus-visible {
  outline: 2px solid rgba(79, 140, 255, 0.72);
  outline-offset: 2px;
}

.panel-body {
  min-height: 0;
  overflow: auto;
  padding: 11px;
}

.evidence-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
}

.layer-toggles label {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border: 1px solid #343d4c;
  border-radius: 7px;
  background: #1f2630;
  color: #a0aec0;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 800;
}

.layer-toggles label.active {
  color: #f7fafc;
}

.layer-toggles input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.dot--blue {
  background: #4f8cff;
}

.dot--green {
  background: #48bb78;
}

.dot--purple {
  background: #9f7aea;
}

.image-stage {
  display: grid;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #343d4c;
  border-radius: 8px;
  background: #0d1015;
}

.image-stage :deep(.bbox-shell) {
  align-self: stretch;
  width: 100%;
  height: 100%;
  max-height: none;
  border: 0;
  border-radius: 0;
  background: #0d1015;
}

.image-stage :deep(.bbox-shell__image) {
  object-fit: fill;
}

.scene-strip {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
  gap: 10px;
}

.fact-block,
.reference-block,
.candidate-empty,
.empty-callout {
  border: 1px solid #343d4c;
  border-radius: 8px;
  background: #1f2630;
  padding: 10px;
}

.fact-block {
  display: grid;
  gap: 7px;
}

.fact-block p {
  margin: 0;
  color: #dbe3ef;
  font-size: 12px;
  line-height: 1.55;
}

.tag-row em,
.tag,
.tag-edit-list em {
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  border: 1px solid rgba(79, 140, 255, 0.46);
  border-radius: 999px;
  background: rgba(79, 140, 255, 0.12);
  color: #bfdbfe;
  padding: 3px 8px;
  font-size: 12px;
  font-style: normal;
}

.tag--green {
  border-color: rgba(72, 187, 120, 0.45);
  background: rgba(72, 187, 120, 0.12);
  color: #c6f6d5;
}

.tag-row em,
.tag-edit-list em {
  border-color: #343d4c;
  background: #11151b;
  color: #718096;
}

.relation-body,
.candidate-body {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
}

.index-track {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.index-button {
  --index-tone: #4a5568;
  --index-tone-soft: rgba(74, 85, 104, 0.18);

  position: relative;
  display: inline-grid;
  width: 100%;
  min-height: 40px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--index-tone) 76%, #11151b 24%);
  border-radius: 8px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--index-tone-soft) 70%, #1f2630 30%), #1f2630 58%);
  color: #edf2f7;
  padding: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 900;
}

.index-button.active {
  border-color: var(--index-tone);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--index-tone) 52%, transparent);
}

.index-button.warning {
  border-style: dashed;
}

.index-button span {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #d69e2e;
}

.index-button--blue {
  --index-tone: #7aa7ff;
  --index-tone-soft: rgba(122, 167, 255, 0.18);
}

.index-button--green {
  --index-tone: #67d391;
  --index-tone-soft: rgba(103, 211, 145, 0.18);
}

.index-button--orange {
  --index-tone: #f6ad55;
  --index-tone-soft: rgba(246, 173, 85, 0.2);
}

.index-button--cyan {
  --index-tone: #22d3ee;
  --index-tone-soft: rgba(34, 211, 238, 0.2);
}

.index-button--yellow {
  --index-tone: #facc15;
  --index-tone-soft: rgba(250, 204, 21, 0.18);
}

.index-button--teal {
  --index-tone: #2dd4bf;
  --index-tone-soft: rgba(45, 212, 191, 0.18);
}

.index-button--purple {
  --index-tone: #c084fc;
  --index-tone-soft: rgba(192, 132, 252, 0.18);
}

.relation-editor,
.candidate-editor {
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.relation-editor,
.candidate-form,
.evidence-table {
  display: grid;
  align-content: start;
  gap: 9px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.verification-grid,
.reference-grid,
.field-row,
.candidate-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.candidate-editor-header {
  grid-column: 1 / -1;
  justify-content: space-between;
  align-items: flex-start;
}

.candidate-header-meta {
  flex: 1 1 auto;
}

.candidate-delete-button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid rgba(245, 101, 101, 0.48);
  border-radius: 7px;
  background: rgba(245, 101, 101, 0.1);
  color: #fecaca;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 900;
}

.field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.field input,
.field select,
.field textarea,
.tag-input-row input {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  border: 1px solid #343d4c;
  border-radius: 7px;
  background: #11151b;
  color: #edf2f7;
  padding: 8px;
  outline: none;
}

.field textarea {
  min-height: 72px;
  resize: none;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.field--observation textarea {
  min-height: 82px;
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.tag-input-row input:focus {
  border-color: #4f8cff;
}

.range-input {
  padding: 0;
  accent-color: #4f8cff;
}

.reference-block {
  display: grid;
  gap: 8px;
}

.reference-item {
  display: grid;
  gap: 4px;
  border: 1px solid #343d4c;
  border-radius: 7px;
  background: #11151b;
  padding: 8px;
}

.reference-item strong {
  color: #edf2f7;
  font-size: 12px;
}

.tag-edit-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tag button {
  display: inline-grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  color: inherit;
  padding: 0;
}

.tag-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px;
}

.tag-input-row button {
  min-height: 36px;
  border: 1px solid rgba(79, 140, 255, 0.58);
  border-radius: 7px;
  background: rgba(79, 140, 255, 0.12);
  color: #dbeafe;
  padding: 0 10px;
  font-weight: 800;
}

.evidence-check {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  border: 1px solid #343d4c;
  border-radius: 7px;
  background: #1f2630;
  padding: 8px;
  color: #a0aec0;
  font-size: 12px;
  line-height: 1.45;
}

.evidence-check input {
  margin-top: 3px;
  accent-color: #48bb78;
}

.evidence-check strong,
.evidence-check em {
  display: block;
}

.evidence-check strong {
  color: #edf2f7;
}

.evidence-check em {
  margin-top: 3px;
  color: #718096;
  font-style: normal;
}

.candidate-empty {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 10px;
  border-color: rgba(245, 101, 101, 0.55);
  background: rgba(245, 101, 101, 0.1);
  color: #fed7d7;
}

.candidate-empty strong,
.candidate-empty p {
  margin: 0;
}

.candidate-empty p {
  margin-top: 4px;
  color: #fecaca;
  font-size: 12px;
  line-height: 1.5;
}

.empty-callout {
  color: #a0aec0;
  font-size: 12px;
}

.review-action-bar {
  position: fixed;
  right: 10px;
  bottom: 0;
  left: 10px;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(360px, 1fr) auto;
  gap: 10px;
  align-items: center;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  padding: 10px;
}

.label-edit-actions {
  justify-content: flex-end;
}

.decision-button,
.save-button,
.submit-button {
  min-height: 38px;
  padding: 0 11px;
}

.decision-button.skip {
  color: #a0aec0;
}

.decision-button.validate {
  color: #69db7c;
}

.save-button {
  border-color: rgba(214, 158, 46, 0.58);
  background: rgba(214, 158, 46, 0.12);
  color: #faf089;
}

.submit-button {
  border-color: #4f8cff;
  background: #4f8cff;
  color: #ffffff;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: end center;
  background: rgba(3, 7, 18, 0.58);
  padding: 24px 16px 76px;
}

.batch-submit-modal {
  display: grid;
  gap: 16px;
  width: min(720px, 100%);
  border: 1px solid #4a5568;
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  color: #edf2f7;
  padding: 18px;
}

.batch-submit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.batch-submit-header h2 {
  margin: 3px 0 0;
  color: #f7fafc;
  font-size: 20px;
}

.batch-submit-header strong {
  max-width: 320px;
  overflow-wrap: anywhere;
  color: #bfdbfe;
  font-size: 13px;
}

.batch-submit-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.batch-submit-stats span,
.submit-blockers {
  border: 1px solid #343d4c;
  border-radius: 8px;
  background: #0f131a;
  padding: 10px;
  color: #a0aec0;
  font-size: 12px;
}

.batch-submit-stats strong {
  margin-left: 4px;
  color: #f7fafc;
  font-size: 15px;
}

.submit-blockers {
  border-color: rgba(245, 101, 101, 0.5);
  background: rgba(245, 101, 101, 0.1);
  color: #fed7d7;
}

.submit-blockers ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.submit-blockers li + li {
  margin-top: 4px;
}

.batch-submit-note {
  margin: 0;
  color: #cbd5e0;
  font-size: 13px;
  line-height: 1.6;
}

.batch-submit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

button:disabled,
input:disabled,
select:disabled,
textarea:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 1320px) {
  .sample-detail-workbench {
    position: static;
    padding-bottom: 0;
    overflow: auto;
  }

  .qc-topbar,
  .review-grid,
  .scene-strip,
  .review-action-bar {
    position: static;
    grid-template-columns: 1fr;
  }

  .review-side-stack {
    grid-template-rows: auto auto;
  }

  .work-panel {
    min-height: 520px;
  }
}

@media (max-width: 760px) {
  .relation-body,
  .candidate-body,
  .editor-grid,
  .verification-grid,
  .reference-grid,
  .field-row,
  .candidate-editor,
  .label-edit-actions {
    grid-template-columns: 1fr;
  }

  .batch-submit-stats {
    grid-template-columns: 1fr;
  }

  .batch-submit-actions {
    flex-direction: column-reverse;
  }

  .index-track {
    grid-auto-flow: column;
    grid-auto-columns: 52px;
    overflow-x: auto;
  }
}
</style>
