import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Dataset,
  ImportJobDetail,
  LabelConfig,
  LabelConfigSaveResult,
  LabelConfigValidationResult,
  QcQueueItem,
  ReviewSampleDetail,
} from '../shared/types/contract';

const mockApiClient = vi.hoisted(() => ({
  listDatasets: vi.fn(),
  getImportJob: vi.fn(),
  getReviewSample: vi.fn(),
  listQcQueue: vi.fn(),
  submitReviewDecision: vi.fn(),
  validateLabelEdit: vi.fn(),
  submitLabelEdit: vi.fn(),
  validateLabelConfig: vi.fn(),
  saveLabelConfig: vi.fn(),
  activateLabelConfig: vi.fn(),
  getActiveLabelConfig: vi.fn(),
  getLabelSuggestions: vi.fn(),
}));

vi.mock('../services/urbanViolationApi', () => ({
  apiClient: mockApiClient,
}));

import DatasetsPage from '../features/datasets/DatasetsPage.vue';
import ImportJobPage from '../features/import/ImportJobPage.vue';
import ReviewWorkbenchPage from '../features/review-workbench/ReviewWorkbenchPage.vue';
import LabelConfigUploadPanel from '../features/datasets/components/LabelConfigUploadPanel.vue';
import AppShell from '../app/layouts/AppShell.vue';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const dataset: Dataset = {
  id: 'ds-live',
  name: 'urban_violation',
  version: 'live',
  status: 'active',
  createdAt: '2026-05-15T00:00:00Z',
  updatedAt: '2026-05-15T00:00:00Z',
  tags: [],
};

const importJob: ImportJobDetail = {
  id: 'job-1',
  datasetId: 'ds-live',
  state: 'ValidationFailed',
  activeStep: 10,
  createdAt: '2026-05-15T00:00:00Z',
  updatedAt: '2026-05-15T00:00:00Z',
  totals: {
    rawAssets: 2,
    stage1Parsed: 2,
    stage2Parsed: 1,
    stage2Failures: 1,
  },
  coverage: {
    stage1: 1,
    stage2: 0.5,
  },
  warnings: [
    {
      id: 'w1',
      severity: 'blocking',
      title: 'Missing stage2 response',
      message: 'sample-2 has no stage2 response.',
    },
  ],
  validationRows: [
    {
      sampleId: 'sample-1',
      imagePath: 'images/sample-1.jpg',
      stage1Path: 'stage1/sample-1.json',
      stage2Path: 'stage2/sample-1.json',
      status: 'ready',
    },
    {
      sampleId: 'sample-2',
      imagePath: 'images/sample-2.jpg',
      stage1Path: 'stage1/sample-2.json',
      failurePath: 'failures/sample-2.json',
      status: 'stage2_failed',
    },
  ],
  mappingSteps: [],
};

const reviewDetail: ReviewSampleDetail = {
  asset: {
    id: 'asset-1',
    datasetId: 'ds-live',
    sampleId: 'sample-1',
    imageUrl: '/api/media/sample-1',
    width: 1280,
    height: 720,
    importedAt: '2026-05-15T00:00:00Z',
    stage1Status: 'ready',
    stage2Status: 'ready',
    judgeDecision: 'pass',
    qcStatus: 'needs_review',
    hasStage2Failure: false,
    violationCategories: ['goods_blocking_road'],
    sampleCategories: ['positive samples'],
    candidateCount: 1,
    highestConfidence: 0.9,
    updatedAt: '2026-05-15T00:00:00Z',
  },
  stage1: {
    sampleId: 'sample-1',
    environmentAnalysis: 'street',
    sceneElements: ['sidewalk'],
    keyAnchors: [],
    keyRelations: [
      {
        relationIndex: 'R1',
        subject: 'goods',
        relation: 'blocks',
        object: 'sidewalk',
        bbox: [320, 180, 640, 360],
      },
    ],
  },
  stage2: {
    sampleId: 'sample-1',
    factVerifications: [
      {
        relationIndex: 'R1',
        subject: 'goods',
        relation: 'blocks',
        object: 'sidewalk',
        bbox: [320, 180, 640, 360],
        visibilityLevel: 'clear',
        informationLossType: 'none',
        subjectVisible: true,
        subjectMatch: true,
        keyAttributesVisible: ['visible goods'],
        bboxObservation: 'bbox aligned',
        globalContextObservation: 'sidewalk visible',
        observations: 'aligned',
        verificationResult: 'supported',
        verificationConfidence: 0.94,
      },
    ],
    candidates: [
      {
        violationCategory: 'goods_blocking_road',
        evidenceRelationIndices: ['R1'],
        evidenceReasoning: 'goods block sidewalk',
        segmentationTargets: ['goods'],
        confidence: 0.88,
        sampleCategory: 'positive samples',
      },
    ],
  },
  auditArtifacts: [],
  labelEditHistory: [],
};

const qcQueue: QcQueueItem[] = [
  {
    sampleId: 'sample-1',
    assetId: 'asset-1',
    status: 'needs_review',
    judgeDecision: 'pass',
    highestConfidence: 0.9,
    primaryCategory: 'goods_blocking_road',
    stage2Failure: false,
    updatedAt: '2026-05-15T00:00:00Z',
  },
];

const labelConfig: LabelConfig = {
  configId: 'label-config-1',
  datasetId: 'ds-live',
  schemaVersion: 'label_config_v1',
  datasetType: 'urban_violation',
  version: 'urban_violation_labels_v1',
  status: 'active',
  fields: [
    {
      field: 'violation_category',
      mode: 'closed_enum',
      labelZh: '违法类别',
      allowCustom: false,
      options: [
        { code: 'goods_blocking_road', labelZh: '物品占道', aliases: [] },
        { code: 'no violation', labelZh: '无违法', aliases: [] },
      ],
    },
    {
      field: 'sample_category',
      mode: 'closed_enum',
      labelZh: '样本类别',
      allowCustom: false,
      options: [{ code: 'positive samples', labelZh: '正样本', aliases: [] }],
    },
    {
      field: 'relation',
      mode: 'closed_enum',
      labelZh: '事实关系',
      allowCustom: false,
      options: [
        { code: 'blocks', labelZh: '阻挡', aliases: [] },
        { code: 'near', labelZh: '靠近', aliases: [] },
      ],
    },
    {
      field: 'visibility_level',
      mode: 'closed_enum',
      labelZh: '可见性',
      allowCustom: false,
      options: [
        { code: 'clear', labelZh: '清晰', aliases: [] },
        { code: 'occluded', labelZh: '遮挡', aliases: [] },
      ],
    },
    {
      field: 'information_loss_type',
      mode: 'closed_enum',
      labelZh: '信息损失',
      allowCustom: false,
      options: [
        { code: 'none', labelZh: '无', aliases: [] },
        { code: 'occlusion', labelZh: '遮挡', aliases: [] },
      ],
    },
    {
      field: 'verification_result',
      mode: 'closed_enum',
      labelZh: '核验结果',
      allowCustom: false,
      options: [
        { code: 'supported', labelZh: '支持', aliases: [] },
        { code: 'weakly_supported', labelZh: '弱支持', aliases: [] },
      ],
    },
    {
      field: 'scene_elements',
      mode: 'open_tags',
      labelZh: '场景元素',
      allowCustom: true,
      options: [{ code: 'sidewalk', labelZh: '人行道', aliases: [] }],
    },
    {
      field: 'segmentation_targets',
      mode: 'open_tags',
      labelZh: '分割目标',
      allowCustom: true,
      options: [{ code: 'goods', labelZh: '货物', aliases: [] }],
    },
  ],
};

const labelValidation: LabelConfigValidationResult = {
  valid: true,
  datasetId: 'ds-live',
  schemaVersion: 'label_config_v1',
  version: 'urban_violation_labels_v1',
  summary: {
    fieldCount: labelConfig.fields.length,
    closedEnumCount: labelConfig.fields.filter((field) => field.mode === 'closed_enum').length,
    openTagsCount: labelConfig.fields.filter((field) => field.mode === 'open_tags').length,
    optionCount: labelConfig.fields.reduce((total, field) => total + field.options.length, 0),
  },
  errors: [],
  warnings: [],
  normalizedConfig: labelConfig,
};

const labelSaveResult: LabelConfigSaveResult = {
  configId: 'label-config-1',
  datasetId: 'ds-live',
  schemaVersion: 'label_config_v1',
  version: 'urban_violation_labels_v1',
  status: 'active',
  validation: labelValidation,
  config: labelConfig,
};

const makeReviewDetail = (sampleId: string): ReviewSampleDetail => ({
  ...reviewDetail,
  asset: {
    ...reviewDetail.asset,
    id: `asset-${sampleId}`,
    sampleId,
  },
  stage1: {
    ...reviewDetail.stage1,
    sampleId,
  },
  stage2: reviewDetail.stage2
    ? {
        ...reviewDetail.stage2,
        sampleId,
      }
    : undefined,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockApiClient.getActiveLabelConfig.mockResolvedValue(labelConfig);
  mockApiClient.getLabelSuggestions.mockResolvedValue([{ value: 'sidewalk', labelZh: '人行道' }]);
  mockApiClient.validateLabelConfig.mockResolvedValue(labelValidation);
  mockApiClient.saveLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.activateLabelConfig.mockResolvedValue(labelSaveResult);
  mockApiClient.validateLabelEdit.mockResolvedValue({
    valid: true,
    errors: [],
    warnings: [],
    checkedAt: '2026-05-18T00:00:00Z',
  });
  mockApiClient.submitLabelEdit.mockResolvedValue({
    saved: true,
    sampleId: 'sample-1',
    submitAction: 'save_draft',
    taskStatus: 'annotation_draft',
    editId: 'patch-1',
    operationCount: 1,
    updatedAt: '2026-05-18T00:00:00Z',
  });
});

describe('route rendering and live route states', () => {
  it('uses a focused chrome-free shell on the sample review route', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', name: 'datasets', component: { template: '<div />' } },
        {
          path: '/datasets/:id/samples/:sampleId/review',
          name: 'sample-review',
          component: { template: '<div />' },
        },
      ],
    });
    await router.push('/datasets/ds-live/samples/sample-1/review');
    await router.isReady();

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div class="review-slot">Review body</div>',
      },
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.classes()).toContain('app-shell--review-focus');
    expect(wrapper.text()).toContain('Review body');
    expect(wrapper.text()).not.toContain('城市治理数据平台');
    expect(wrapper.find('input[placeholder="搜索图像、任务、运行、标签..."]').exists()).toBe(false);
  });

  it('renders the datasets route from API data', async () => {
    mockApiClient.listDatasets.mockResolvedValue([dataset]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/datasets', component: DatasetsPage },
        { path: '/datasets/:id/overview', component: { template: '<div />' } },
        { path: '/datasets/:id/import-jobs/:jobId', component: { template: '<div />' } },
      ],
    });
    await router.push('/datasets');
    await router.isReady();

    const wrapper = mount(RouterView, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('urban_violation');
    expect(wrapper.text()).toContain('ds-live');
  });

  it('shows route-level empty state for datasets', async () => {
    mockApiClient.listDatasets.mockResolvedValue([]);
    const wrapper = mount(DatasetsPage, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('No datasets returned by the backend.');
  });
});

describe('import and review routes', () => {
  it('parses, validates, and saves an uploaded label config JSON file', async () => {
    const wrapper = mount(LabelConfigUploadPanel, {
      props: {
        datasetId: 'ds-live',
      },
    });
    await flushPromises();

    const input = wrapper.find('input[type="file"]');
    const file = new File(
      [
        JSON.stringify({
          schema_version: 'label_config_v1',
          version: 'urban_violation_labels_v1',
          fields: [
            {
              field: 'violation_category',
              mode: 'closed_enum',
              allow_custom: false,
              options: [{ code: 'goods_blocking_road' }],
            },
            {
              field: 'scene_elements',
              mode: 'open_tags',
              allow_custom: true,
              options: [{ code: 'sidewalk' }],
            },
          ],
        }),
      ],
      'label_config.json',
      { type: 'application/json' },
    );
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [file],
    });
    input.element.dispatchEvent(new Event('change'));
    await flushPromises();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(wrapper.text()).toContain('urban_violation_labels_v1');
    expect(wrapper.text()).toContain('closed_enum_count');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验配置'));
    await validateButton?.trigger('click');
    await flushPromises();

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存配置'));
    await saveButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelConfig).toHaveBeenCalledWith('ds-live', {
      fileName: 'label_config.json',
      config: expect.objectContaining({ version: 'urban_violation_labels_v1' }),
    });
    expect(mockApiClient.saveLabelConfig).toHaveBeenCalledWith('ds-live', {
      fileName: 'label_config.json',
      config: expect.objectContaining({ version: 'urban_violation_labels_v1' }),
      activate: true,
    });
  });

  it('displays import job validation status from the API', async () => {
    mockApiClient.getImportJob.mockResolvedValue(importJob);
    const wrapper = mount(ImportJobPage, {
      props: {
        id: 'ds-live',
        jobId: 'job-1',
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('ValidationFailed');
    expect(wrapper.text()).toContain('stage2_failed');
    expect(wrapper.text()).toContain('Missing stage2 response');
  });

  it('validates without saving and submits label-edit draft/change payloads', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    const subjectInput = wrapper.find('.relation-editor input');
    await subjectInput.setValue('goods updated');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验修改'));
    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(1);
    expect(mockApiClient.submitLabelEdit).not.toHaveBeenCalled();
    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        taskMode: 'label_edit',
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'relation:R1',
            field: 'subject',
            op: 'replace',
            after: 'goods updated',
          }),
        ]),
      }),
    );

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    await saveButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.submitLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        submitAction: 'save_draft',
        taskStatus: 'annotation_draft',
        labelConfigId: 'label-config-1',
        labelConfigVersion: 'urban_violation_labels_v1',
      }),
    );

    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('提交修改'));
    await submitButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledTimes(2);
    expect(mockApiClient.submitLabelEdit).toHaveBeenLastCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        submitAction: 'submit_changes',
        taskStatus: 'annotation_submitted',
        labelConfigId: 'label-config-1',
        labelConfigVersion: 'urban_violation_labels_v1',
        operations: expect.any(Array),
      }),
    );
  });

  it('keeps review evidence visible but disables patch and submit when active label config is missing', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);
    mockApiClient.getActiveLabelConfig.mockRejectedValue(new Error('config_missing'));

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).toContain('R1 · goods blocks sidewalk');
    expect(wrapper.text()).toContain('请先上传并激活标签配置');
    const submitButton = wrapper.findAll('button').find((button) => button.text().includes('提交修改'));
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存草稿'));
    expect(submitButton?.attributes('disabled')).toBeDefined();
    expect(saveButton?.attributes('disabled')).toBeDefined();
  });

  it('renders bare index rails, label-edit bottom bar, and readonly model visibility references', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('.relation-index-track').text()).toBe('R1');
    expect(wrapper.find('.candidate-index-track').text().replace(/\s+/g, '')).toBe('C1+');
    expect(wrapper.find('[aria-label="模型可见性参考"]').text()).toContain('subject_visible');
    expect(wrapper.find('[aria-label="模型可见性参考"]').text()).toContain('true');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('校验修改');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('保存草稿');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('提交修改');
    expect(wrapper.text()).not.toContain('vote note');
    expect(wrapper.text()).not.toContain('提交质检');
    expect(wrapper.text()).not.toContain('人工精标');
  });

  it('marks unreferenced relation boxes black instead of selected red', async () => {
    const orphanDetail: ReviewSampleDetail = {
      ...reviewDetail,
      stage1: {
        ...reviewDetail.stage1,
        keyRelations: [
          ...reviewDetail.stage1.keyRelations,
          {
            relationIndex: 'R2',
            subject: 'sign',
            relation: 'near',
            object: 'sidewalk',
            bbox: [100, 100, 220, 220],
          },
        ],
      },
      stage2: reviewDetail.stage2
        ? {
            ...reviewDetail.stage2,
            factVerifications: [
              ...reviewDetail.stage2.factVerifications,
              {
                ...reviewDetail.stage2.factVerifications[0],
                relationIndex: 'R2',
                subject: 'sign',
                relation: 'near',
                object: 'sidewalk',
                bbox: [100, 100, 220, 220],
              },
            ],
          }
        : undefined,
    };
    mockApiClient.getReviewSample.mockResolvedValue(orphanDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    await wrapper.findAll('.relation-index-track .index-button').find((button) => button.text().includes('R2'))?.trigger('click');
    await flushPromises();

    const unreferencedBoxes = wrapper.findAll('.bbox-shell__box--black');
    expect(unreferencedBoxes.length).toBeGreaterThan(0);
    expect(unreferencedBoxes.some((box) => box.classes().includes('bbox-shell__box--selected'))).toBe(false);
  });

  it('allows empty segmentation targets and sends a delete operation for removed candidates', async () => {
    mockApiClient.getReviewSample.mockResolvedValue(reviewDetail);
    mockApiClient.listQcQueue.mockResolvedValue(qcQueue);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    await wrapper.find('.tag button').trigger('click');

    const validateButton = wrapper.findAll('button').find((button) => button.text().includes('校验修改'));
    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'candidate:C1',
            field: 'segmentation_targets',
            op: 'replace',
            after: [],
          }),
        ]),
      }),
    );

    await wrapper.find('.candidate-delete-button').trigger('click');
    await flushPromises();

    expect(wrapper.find('.candidate-index-track').text().replace(/\s+/g, '')).toBe('+');
    expect(wrapper.find('[aria-label="标注修改底栏"]').text()).toContain('已修改 1 项');

    await validateButton?.trigger('click');
    await flushPromises();

    expect(mockApiClient.validateLabelEdit).toHaveBeenLastCalledWith(
      'ds-live',
      'sample-1',
      expect.objectContaining({
        operations: expect.arrayContaining([
          expect.objectContaining({
            scope: 'candidate:C1',
            field: 'candidate',
            op: 'delete_candidate',
            after: null,
          }),
        ]),
      }),
    );
  });

  it('keeps the current review visible while switching samples', async () => {
    const nextDetail = makeReviewDetail('sample-2');
    const nextDetailRequest = deferred<ReviewSampleDetail>();
    mockApiClient.getReviewSample
      .mockResolvedValueOnce(reviewDetail)
      .mockReturnValueOnce(nextDetailRequest.promise);
    mockApiClient.listQcQueue.mockResolvedValue([
      ...qcQueue,
      {
        ...qcQueue[0],
        sampleId: 'sample-2',
        assetId: 'asset-sample-2',
      },
    ]);

    const wrapper = mount(ReviewWorkbenchPage, {
      props: {
        id: 'ds-live',
        sampleId: 'sample-1',
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('Loading review sample...');

    await wrapper.setProps({ sampleId: 'sample-2' });
    await flushPromises();

    expect(wrapper.text()).toContain('sample-1');
    expect(wrapper.text()).not.toContain('Loading review sample...');
    expect(wrapper.text()).not.toContain('正在切换到 sample-2');

    nextDetailRequest.resolve(nextDetail);
    await flushPromises();

    expect(wrapper.text()).toContain('sample-2');
    expect(wrapper.text()).not.toContain('正在切换到 sample-2');
  });
});
