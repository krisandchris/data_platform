<template>
  <section class="sample-detail-workbench">
    <header class="qc-topbar">
      <div class="sample-meta">
        <div class="meta-block meta-block--sample">
          <span>Sample</span>
          <strong>{{ baseSample.asset.sampleId }}</strong>
        </div>
        <div class="meta-block">
          <span>Progress</span>
          <strong>{{ progressText }}</strong>
          <div class="progress-meter" aria-hidden="true">
            <i :style="{ width: `${progressPercent}%` }"></i>
          </div>
        </div>
        <div class="meta-block">
          <span>Stage Judge</span>
          <div class="chip-row">
            <StatusChip :value="baseSample.asset.judgeDecision" :label="`Stage1 ${baseSample.asset.judgeDecision}`" />
            <StatusChip :value="baseSample.stage2Failure ? 'stage2_failed' : baseSample.asset.stage2Status" />
          </div>
        </div>
        <div class="meta-block">
          <span>Draft State</span>
          <strong :class="['draft-state', patchSaved ? 'draft-state--saved' : 'draft-state--dirty']">
            {{ draftStateText }}
          </strong>
        </div>
        <div class="meta-block">
          <span>Active Config</span>
          <strong>{{ configVersionText }}</strong>
        </div>
      </div>

      <div class="top-actions">
        <RouterLink v-if="previousQueueItem" class="toolbar-button" :to="reviewHref(previousQueueItem.sampleId)">
          <ChevronLeft :size="16" />
          Prev
        </RouterLink>
        <button v-else class="toolbar-button" type="button" disabled>
          <ChevronLeft :size="16" />
          Prev
        </button>
        <RouterLink v-if="nextQueueItem" class="toolbar-button" :to="reviewHref(nextQueueItem.sampleId)">
          Next
          <ChevronRight :size="16" />
        </RouterLink>
        <button v-else class="toolbar-button" type="button" disabled>
          Next
          <ChevronRight :size="16" />
        </button>
        <RouterLink class="toolbar-button" :to="`/datasets/${baseSample.asset.datasetId}/qc`">
          <ListChecks :size="16" />
          List
        </RouterLink>
      </div>
    </header>

    <div v-if="actionMessage" class="gate-warning">
      <CircleAlert :size="17" />
      <span>{{ actionMessage }}</span>
    </div>
    <div v-if="!canEditLabels" class="gate-warning gate-warning--config">
      <CircleAlert :size="17" />
      <span>{{ labelConfigGateMessage || '请先上传并激活标签配置' }}</span>
    </div>

    <div class="review-grid">
      <section class="work-panel evidence-panel">
        <div class="panel-head">
          <strong>图像证据区</strong>
          <span class="pill pill--blue">0-1000 bbox</span>
        </div>

        <div class="panel-body evidence-body">
          <div class="layer-toggles" aria-label="bbox layers">
            <label :class="{ active: showStage1 }">
              <input v-model="showStage1" type="checkbox" />
              <span class="dot dot--blue"></span>
              STEP1
            </label>
            <label :class="{ active: showStage2 }">
              <input v-model="showStage2" type="checkbox" />
              <span class="dot dot--green"></span>
              STEP2
            </label>
            <label :class="{ active: showCandidates }">
              <input v-model="showCandidates" type="checkbox" />
              <span class="dot dot--purple"></span>
              Candidate
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
              <span class="field-label">environment_analysis</span>
              <p>{{ baseSample.stage1.environmentAnalysis || '无环境分析' }}</p>
            </div>
            <div class="fact-block">
              <span class="field-label">scene_elements / key_anchors</span>
              <div class="tag-row">
                <span v-for="element in baseSample.stage1.sceneElements" :key="element" class="tag">
                  {{ element }}
                </span>
                <span v-for="anchor in baseSample.stage1.keyAnchors" :key="anchor.anchor" class="tag tag--green">
                  {{ anchor.anchor }}
                </span>
                <em v-if="!baseSample.stage1.sceneElements.length && !baseSample.stage1.keyAnchors.length">
                  empty
                </em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="review-side-stack">
        <section class="work-panel relation-panel">
          <div class="panel-head">
            <strong>Relation 复核区</strong>
            <span class="pill pill--blue">{{ relationViews.length }} relations</span>
          </div>

          <div class="panel-body relation-body">
            <div class="index-track relation-index-track" aria-label="Relation 索引轨">
              <button
                v-for="item in relationViews"
                :key="item.badge"
                class="index-button"
                :class="{ active: item.badge === activeRelationKey, dirty: item.dirty, warning: item.orphan }"
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
                  {{ activeRelationView.orphan ? '未被 Candidate 引用' : '已引用' }}
                </span>
                <span v-if="activeRelationView.dirty" class="pill pill--amber">已修改</span>
                <span v-if="!activeRelationView.verification" class="pill pill--amber">
                  {{ baseSample.stage2Failure ? 'STEP2 failed' : 'STEP2 缺失' }}
                </span>
                <span class="pill">bbox 由图像区拖拽修改</span>
              </div>

              <div class="editor-grid">
                <label class="field">
                  <span class="mini-label">subject</span>
                  <input
                    :value="activeRelationDraft.subject"
                    :disabled="!canEditLabels"
                    @input="setRelationField('subject', inputValue($event))"
                  />
                </label>
                <label class="field">
                  <span class="mini-label">relation</span>
                  <select
                    :value="activeRelationDraft.relation"
                    :disabled="!canEditLabels || !hasClosedField('relation')"
                    @change="setRelationField('relation', inputValue($event))"
                  >
                    <option v-for="option in selectOptions('relation', activeRelationDraft.relation)" :key="option" :value="option">
                      {{ option }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">object</span>
                  <input
                    :value="activeRelationDraft.object"
                    :disabled="!canEditLabels"
                    @input="setRelationField('object', inputValue($event))"
                  />
                </label>
              </div>

              <label class="field">
                <span class="mini-label">description</span>
                <textarea
                  :value="activeRelationDraft.description"
                  :disabled="!canEditLabels"
                  rows="2"
                  @input="setRelationField('description', inputValue($event))"
                ></textarea>
              </label>

              <div class="verification-grid">
                <label class="field">
                  <span class="mini-label">visibility</span>
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
                      {{ option }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">loss type</span>
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
                      {{ option }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">result</span>
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
                      {{ option }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span class="mini-label">confidence</span>
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
                <span class="mini-label">bbox_observation</span>
                <textarea
                  :value="activeRelationDraft.bboxObservation"
                  :disabled="!canEditLabels"
                  rows="3"
                  @input="setRelationField('bboxObservation', inputValue($event))"
                ></textarea>
              </label>

              <label class="field field--observation">
                <span class="mini-label">global_context_observation</span>
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
                    <span class="mini-label">subject_visible</span>
                    <strong>{{ referenceBoolean(activeRelationView.verification?.subjectVisible) }}</strong>
                  </div>
                  <div class="reference-item">
                    <span class="mini-label">subject_match</span>
                    <strong>{{ referenceBoolean(activeRelationView.verification?.subjectMatch) }}</strong>
                  </div>
                </div>
                <div class="tag-row">
                  <span
                    v-for="attribute in activeRelationView.verification?.keyAttributesVisible ?? []"
                    :key="attribute"
                    class="tag"
                  >
                    {{ attribute }}
                  </span>
                  <em v-if="!(activeRelationView.verification?.keyAttributesVisible.length)">empty</em>
                </div>
              </div>
            </div>

            <div v-else class="empty-callout">没有 Relation 可复核。</div>
          </div>
        </section>

        <section class="work-panel candidate-panel">
          <div class="panel-head">
            <strong>Candidate 与质检裁决</strong>
            <span class="pill pill--amber">{{ reviewDraft.candidateDrafts.length }} candidates</span>
          </div>

          <div class="panel-body candidate-body">
            <div class="index-track candidate-index-track" aria-label="Candidate 索引轨">
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
                    {{ canEditLabels ? 'active config ready' : 'read only' }}
                  </span>
                  <span class="pill pill--amber">{{ activeCandidateDraft.evidenceRelationIds.length }} evidence relations</span>
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
                    <span class="mini-label">sample_category</span>
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
                        {{ option }}
                      </option>
                    </select>
                  </label>
                </div>

                <label class="field">
                  <span class="mini-label">confidence</span>
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
                  <span class="mini-label">segmentation_targets</span>
                  <div class="tag-edit-list">
                    <span v-for="tag in activeCandidateDraft.segmentationTargets" :key="tag" class="tag">
                      {{ tag }}
                      <button type="button" :disabled="!canEditLabels" @click="removeCandidateTag(tag)">×</button>
                    </span>
                    <em v-if="!activeCandidateDraft.segmentationTargets.length">empty</em>
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
                      <option v-for="suggestion in tagSuggestions('segmentation_targets')" :key="suggestion" :value="suggestion" />
                    </datalist>
                    <button type="button" :disabled="!canEditLabels" @click="addCandidateTag">添加</button>
                  </div>
                </div>

                <label class="field">
                  <span class="mini-label">evidence_reasoning</span>
                  <textarea
                    :value="activeCandidateDraft.evidenceReasoning"
                    :disabled="!canEditLabels"
                    rows="4"
                    @input="setCandidateField('evidenceReasoning', inputValue($event))"
                  ></textarea>
                </label>

                <label class="field">
                  <span class="mini-label">relation_hint</span>
                  <input
                    :value="activeCandidateDraft.relationHint"
                    :disabled="!canEditLabels"
                    @input="setCandidateField('relationHint', inputValue($event))"
                  />
                </label>
              </div>

              <div class="evidence-table">
                <span class="field-label">Evidence Relations</span>
                <label v-for="relation in relationViews" :key="relation.badge" class="evidence-check">
                  <input
                    type="checkbox"
                    :checked="activeCandidateDraft.evidenceRelationIds.includes(relation.badge)"
                    :disabled="!canEditLabels"
                    @change="toggleCandidateRelation(relation.badge, checkedValue($event))"
                  />
                  <span>
                    <strong>{{ relation.badge }} · {{ relation.draft.subject }} {{ relation.draft.relation }} {{ relation.draft.object }}</strong>
                    <em>{{ relation.draft.description || '无 relation 描述' }}</em>
                  </span>
                  <span class="status-token" :class="relation.orphan ? 'status-token--amber' : 'status-token--green'">
                    {{ relation.orphan ? 'unlinked' : 'linked' }}
                  </span>
                </label>
              </div>
            </div>

            <div v-else class="candidate-empty">
              <TriangleAlert :size="18" />
              <div>
                <strong>{{ baseSample.stage2Failure ? 'STEP2 未产出候选结论' : '无候选结论' }}</strong>
                <p>{{ baseSample.stage2Failure?.message ?? '需要人工基于 STEP1 relation 和图像证据补判。' }}</p>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section class="review-action-bar" aria-label="标注修改底栏">
      <div class="bottom-status" aria-label="修改状态">
        <span class="pill pill--blue">已修改 {{ operationCount }} 项</span>
        <span class="pill" :class="validationPillClass">{{ validationStatusText }}</span>
        <span class="pill" :class="patchSaved ? 'pill--amber' : 'pill--blue'">{{ draftSaveText }}</span>
        <span class="pill pill--blue">{{ configVersionText }}</span>
      </div>
      <div class="label-edit-actions">
        <button class="decision-button skip" type="button" @click="skipSample">
          <SkipForward :size="17" />
          跳过样本
        </button>
        <button
          class="decision-button validate"
          type="button"
          :disabled="!canEditLabels || validationPending"
          @click="validateChanges"
        >
          <ShieldCheck :size="17" />
          校验修改
        </button>
        <button
          class="save-button"
          type="button"
          :disabled="!canSubmitLabelEdit || savePending"
          @click="saveDraft"
        >
          <Save :size="17" />
          保存草稿
        </button>
        <button
          class="submit-button"
          type="button"
          :disabled="!canSubmitLabelEdit || submitPending"
          @click="submitChanges"
        >
          <Send :size="17" />
          提交修改
        </button>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue';
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
  BBox,
  FactVerification,
  LabelConfig,
  LabelEditOperation,
  LabelEditPatchPayload,
  LabelEditSubmitPayload,
  LabelEditSubmitResult,
  LabelEditValidationResult,
  QcQueueItem,
  ReviewSampleDetail,
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
  submitLabelEdit?: (payload: LabelEditSubmitPayload) => Promise<LabelEditSubmitResult>;
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

interface RelationView {
  base: StageRelation;
  verification?: FactVerification;
  badge: string;
  draft: RelationDraft;
  orphan: boolean;
  dirty: boolean;
}

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
const DEFAULT_RELATION_TONES: NonNullable<OverlayBox['tone']>[] = ['blue', 'green', 'orange', 'cyan', 'yellow', 'teal'];

if (reviewDraft.value.candidateDrafts.length) {
  activeCandidateId.value = reviewDraft.value.candidateDrafts[0].id;
}

watch(
  () => props.detail.asset.sampleId,
  () => {
    reviewDraft.value = createReviewDraft(props.detail);
    activeRelationKey.value = relationBadge(props.detail.stage1.keyRelations[0]?.relationIndex ?? 'R1');
    activeImageRelationKey.value = '';
    activeCandidateId.value = reviewDraft.value.candidateDrafts[0]?.id ?? '';
    candidateTagInput.value = '';
    remoteSuggestions.value = {};
    validationResult.value = undefined;
    lastSavedAt.value = undefined;
    patchSaved.value = Boolean(props.detail.humanReview);
    actionMessage.value = '';
  },
);

const canEditLabels = computed(() => Boolean(props.labelConfig && !props.labelConfigMissing));
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
    return `${reviewedCount.value} reviewed`;
  }
  return `${currentQueueIndex.value + 1} / ${props.queueItems.length}`;
});
const progressPercent = computed(() => {
  if (props.queueItems.length === 0 || currentQueueIndex.value < 0) {
    return 0;
  }
  return Math.round(((currentQueueIndex.value + 1) / props.queueItems.length) * 100);
});
const configVersionText = computed(() => props.labelConfig?.version ?? '无 active config');

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
const canSubmitLabelEdit = computed(() => canEditLabels.value && operationCount.value > 0);
const patchPayload = computed<LabelEditPatchPayload>(() => ({
  sampleId: baseSample.value.asset.sampleId,
  taskMode: 'label_edit',
  labelConfigId: props.labelConfig?.configId,
  labelConfigVersion: props.labelConfig?.version,
  operations: operations.value,
}));
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
const draftSaveText = computed(() => {
  if (patchSaved.value && lastSavedAt.value) {
    return `草稿已保存 ${lastSavedAt.value}`;
  }
  if (patchSaved.value) {
    return '草稿已保存';
  }
  return '未保存';
});
const draftStateText = computed(() => (operationCount.value > 0 ? `${operationCount.value} dirty fields` : 'clean'));

const overlayBoxes = computed<OverlayBox[]>(() => {
  const boxes: OverlayBox[] = [];
  if (showStage1.value) {
    relationViews.value.forEach((item) => {
      boxes.push({
        id: `stage1-${item.badge}`,
        label: item.badge,
        bbox: item.draft.bbox,
        tone: item.orphan ? 'purple' : relationTone(item.badge),
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
        tone: relationView?.orphan ? 'purple' : relationTone(badge),
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
          tone: 'purple',
          relationIndex: relationId,
          selected: imageRelationSelected(relationId),
        });
      }
    });
  }
  return boxes;
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

function relationTone(relationId: string): NonNullable<OverlayBox['tone']> {
  const seed = Array.from(relationId).reduce((total, char) => total + char.charCodeAt(0), 0);
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
  return value === undefined ? '-' : String(value);
}

function markEdited() {
  patchSaved.value = false;
  validationResult.value = undefined;
  actionMessage.value = '';
}

function setRelationField(field: keyof RelationDraft, value: RelationDraft[keyof RelationDraft]) {
  if (!canEditLabels.value || !activeRelationDraft.value) {
    actionMessage.value = props.labelConfigGateMessage || '请先上传并激活标签配置';
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
    actionMessage.value = props.labelConfigGateMessage || '请先上传并激活标签配置';
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
    actionMessage.value = props.labelConfigGateMessage || '请先上传并激活标签配置';
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
    actionMessage.value = props.labelConfigGateMessage || '请先上传并激活标签配置';
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

function skipSample() {
  const target = nextQueueItem.value
    ? reviewHref(nextQueueItem.value.sampleId)
    : `/datasets/${baseSample.value.asset.datasetId}/qc`;
  if (router) {
    void router.push(target);
    return;
  }
  globalThis.location?.assign(target);
}

async function validateChanges() {
  if (!canEditLabels.value || !props.validateLabelEdit) {
    actionMessage.value = props.labelConfigGateMessage || '请先上传并激活标签配置';
    return undefined;
  }
  validationPending.value = true;
  actionMessage.value = '';
  try {
    const result = await props.validateLabelEdit(patchPayload.value);
    validationResult.value = result;
    actionMessage.value = result.valid ? '字段合法' : `字段非法 ${result.errors.length} 项`;
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '字段合法性校验失败';
    validationResult.value = {
      valid: false,
      errors: [{ operationIndex: -1, scope: 'label_edit', field: 'request', code: 'request_failed', message }],
      warnings: [],
    };
    actionMessage.value = message;
    return validationResult.value;
  } finally {
    validationPending.value = false;
  }
}

async function saveDraft() {
  if (!canSubmitLabelEdit.value || !props.submitLabelEdit) {
    return;
  }
  savePending.value = true;
  actionMessage.value = '';
  try {
    await props.submitLabelEdit({
      ...patchPayload.value,
      submitAction: 'save_draft',
      taskStatus: 'annotation_draft',
    });
    patchSaved.value = true;
    lastSavedAt.value = currentTime();
    actionMessage.value = '草稿已保存';
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : '保存草稿失败';
  } finally {
    savePending.value = false;
  }
}

async function submitChanges() {
  if (!canSubmitLabelEdit.value || !props.submitLabelEdit) {
    return;
  }
  submitPending.value = true;
  actionMessage.value = '';
  try {
    const validation = await validateChanges();
    if (!validation?.valid) {
      return;
    }
    await props.submitLabelEdit({
      ...patchPayload.value,
      submitAction: 'submit_changes',
      taskStatus: 'annotation_submitted',
    });
    patchSaved.value = true;
    lastSavedAt.value = currentTime();
    actionMessage.value = '修改已提交';
  } catch (error) {
    const validation = validationFromSubmitError(error);
    if (validation) {
      validationResult.value = validation;
      actionMessage.value = `字段非法 ${validation.errors.length} 项`;
      return;
    }
    actionMessage.value = error instanceof Error ? error.message : '提交修改失败';
  } finally {
    submitPending.value = false;
  }
}

function currentTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function validationFromSubmitError(error: unknown): LabelEditValidationResult | undefined {
  if (!isObject(error) || !isObject(error.validation) || typeof error.validation.valid !== 'boolean') {
    return undefined;
  }
  return error.validation as unknown as LabelEditValidationResult;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
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
  position: relative;
  display: inline-grid;
  width: 100%;
  min-height: 40px;
  place-items: center;
  border: 1px solid #343d4c;
  border-radius: 8px;
  background: #1f2630;
  color: #edf2f7;
  padding: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 900;
}

.index-button.active {
  border-color: rgba(79, 140, 255, 0.8);
  box-shadow: 0 0 0 1px rgba(79, 140, 255, 0.35);
}

.index-button.warning {
  border-color: rgba(214, 158, 46, 0.58);
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

  .index-track {
    grid-auto-flow: column;
    grid-auto-columns: 52px;
    overflow-x: auto;
  }
}
</style>
