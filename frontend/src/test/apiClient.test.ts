import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../services/http';
import { HttpUrbanViolationApi, LabelEditValidationError } from '../services/urbanViolationApi';

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'content-type': 'application/json' },
  });

describe('HTTP API adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the default browser fetch bound to globalThis', async () => {
    let observedThis: unknown;
    const fetcher = vi.fn(function (
      this: unknown,
      _input: Parameters<typeof fetch>[0],
      _init?: Parameters<typeof fetch>[1],
    ) {
      observedThis = this;
      return Promise.resolve(jsonResponse({ status: 'ok' }));
    });
    vi.stubGlobal('fetch', fetcher);

    const client = new HttpClient({ baseUrl: 'http://backend.test' });

    await client.get('/health');

    expect(observedThis).toBe(globalThis);
  });

  it('maps backend contract datasets into frontend view models', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse([
        {
          dataset_id: 'ds-live',
          name: 'urban_violation',
          root_path: '/mnt/internal/urban_violation',
          total_assets: 797,
          stage1_count: 797,
          stage2_success_count: 780,
          stage2_failure_count: 19,
          created_at: '2026-05-15T00:00:00Z',
        },
      ]),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const datasets = await api.listDatasets();

    expect(fetcher).toHaveBeenCalledWith('http://backend.test/datasets', expect.objectContaining({ method: 'GET' }));
    expect(datasets[0]).toMatchObject({
      id: 'ds-live',
      name: 'urban_violation',
      status: 'active',
      datasetType: 'urban_violation',
      batchKey: 'ds-live',
      rootPath: '/mnt/internal/urban_violation',
    });
  });

  it('normalizes dataset batch fields, asset summary, and latest import context', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          dataset: {
            dataset_id: 'urban_violation__0508_fixture',
            name: '0508 fixture',
            dataset_type: 'urban_violation',
            batch_key: '0508_fixture',
            lifecycle_status: 'qc_ready',
            active_label_config_version: 'urban_violation_labels_v1',
            active_import_job_id: 'job-0508',
            total_assets: 797,
            stage1_count: 797,
            stage2_success_count: 780,
            stage2_failure_count: 19,
            created_at: '2026-05-18T00:00:00Z',
          },
          totals: {
            rawAssets: 797,
            stage1Parsed: 797,
            stage2Parsed: 780,
            stage2Failures: 19,
          },
          coverage: {
            stage1: 1,
            stage2: 0.9787,
          },
          latest_import_job: {
            job_id: 'job-0508',
            dataset_id: 'urban_violation__0508_fixture',
            state: 'PreviewReady',
            expected_assets: 797,
            imported_assets: 797,
            failure_count: 19,
          },
          asset_summary: {
            media: { total: 797, valid: 797, missing: 0 },
            preannotation: { stage1_ready: 797, stage2_ready: 780, stage2_failed: 19 },
            qc: { total: 797, pending: 186, submitted: 528 },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          dataset_id: 'urban_violation__0508_fixture',
          dataset_type: 'urban_violation',
          batch_key: '0508_fixture',
          media: { total: 797, valid: 797, missing: 0 },
          import_health: { imported: 797, orphan_annotations: 1, path_warnings: 2 },
          preannotation: { stage1_ready: 797, stage2_ready: 780, stage2_failed: 19 },
          qc: { total: 797, pending: 186, submitted: 528 },
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const summary = await api.getDatasetSummary('urban_violation__0508_fixture');
    const assetSummary = await api.getAssetSummary('urban_violation__0508_fixture');

    expect(summary.dataset).toMatchObject({
      id: 'urban_violation__0508_fixture',
      datasetType: 'urban_violation',
      batchKey: '0508_fixture',
      lifecycleStatus: 'qc_ready',
      activeLabelConfigVersion: 'urban_violation_labels_v1',
    });
    expect(summary.latestImportJob).toMatchObject({ id: 'job-0508', state: 'PreviewReady' });
    expect(summary.assetSummary?.preannotation).toMatchObject({ stage2Ready: 780, stage2Failed: 19 });
    expect(fetcher.mock.calls[1][0]).toBe('http://backend.test/datasets/urban_violation__0508_fixture/assets/summary');
    expect(assetSummary).toMatchObject({
      datasetType: 'urban_violation',
      batchKey: '0508_fixture',
      media: { total: 797, valid: 797 },
      preannotation: { stage1Ready: 797, stage2Ready: 780, stage2Failed: 19 },
    });
  });

  it('uses batch-scoped import job orchestration endpoints', async () => {
    const jobPayload = {
      job_id: 'job-0508',
      dataset_id: 'urban_violation__0508_fixture',
      dataset_type: 'urban_violation',
      batch_key: '0508_fixture',
      state: 'PreviewReady',
      expected_assets: 797,
      imported_assets: 797,
      stage2_success_count: 780,
      failure_count: 19,
      warnings: [{ id: 'w-stage2', severity: 'warning', title: 'STEP2 failures', message: '19 failures preserved.' }],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ import_jobs: [jobPayload] }))
      .mockResolvedValueOnce(jsonResponse({ ...jobPayload, state: 'Draft' }))
      .mockResolvedValueOnce(jsonResponse({ ...jobPayload, state: 'Scanning' }))
      .mockResolvedValueOnce(jsonResponse({ ...jobPayload, state: 'PreviewReady' }))
      .mockResolvedValueOnce(jsonResponse({ ...jobPayload, state: 'QCQueueGenerated' }))
      .mockResolvedValueOnce(jsonResponse({ ...jobPayload, state: 'Scanning' }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const jobs = await api.listImportJobs('urban_violation__0508_fixture');
    const created = await api.createImportJob('urban_violation__0508_fixture', {
      datasetType: 'urban_violation',
      batchKey: '0508_fixture',
      sourceMode: 'local_directory',
      sourceUri: 'DATASET/urban_violation',
    });
    const scanned = await api.scanImportJob('urban_violation__0508_fixture', 'job-0508');
    const validated = await api.validateImportJob('urban_violation__0508_fixture', 'job-0508');
    const confirmed = await api.confirmImportJob('urban_violation__0508_fixture', 'job-0508');
    const retried = await api.retryImportJob('urban_violation__0508_fixture', 'job-0508');

    expect(jobs[0]).toMatchObject({ id: 'job-0508', state: 'PreviewReady', warningCount: 1 });
    expect(created.state).toBe('Draft');
    expect(scanned.state).toBe('Scanning');
    expect(validated.validationReport?.warnings[0].message).toContain('19 failures');
    expect(confirmed.state).toBe('QCQueueGenerated');
    expect(retried.state).toBe('Scanning');
    expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://backend.test/api/datasets/urban_violation__0508_fixture/import-jobs',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/import-jobs',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/import-jobs/job-0508/scan',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/import-jobs/job-0508/validate',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/import-jobs/job-0508/confirm',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/import-jobs/job-0508/retry',
    ]);
    expect(fetcher.mock.calls[1][1]?.body).toBe(
      JSON.stringify({
        dataset_type: 'urban_violation',
        batch_key: '0508_fixture',
        source_mode: 'local_directory',
        source_uri: 'DATASET/urban_violation',
      }),
    );
  });

  it('uses snake_case backend filters and blocks local absolute media paths', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        assets: [
          {
            asset_id: 'asset-1',
            sample_id: 'sample-1',
            image_url: '/mnt/lc/private/sample.jpg',
            width: 1280,
            height: 720,
            source_image_path_internal: '/mnt/lc/private/sample.jpg',
            has_stage2_failure: true,
          },
        ],
      }),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const assets = await api.listAssets('ds-live', {
      judgeDecision: 'soft_fail',
      stage2State: 'failed',
      violationCategory: 'goods_blocking_road',
    });

    const requestUrl = String(fetcher.mock.calls[0][0]);
    expect(requestUrl).toContain('judge_decision=soft_fail');
    expect(requestUrl).toContain('failure_status=failed');
    expect(requestUrl).toContain('category=goods_blocking_road');
    expect(assets[0].imageUrl).toBeUndefined();
    expect(assets[0].hasStage2Failure).toBe(true);
  });

  it('maps review details and uses label-edit validate/save endpoints without QC vote fields', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          asset: {
            asset_id: 'asset-1',
            sample_id: 'sample-1',
            image_url: '/api/media/sample-1',
            width: 1280,
            height: 720,
            source_image_path_internal: '/mnt/internal/sample.jpg',
          },
          stage1_preannotation: {
            sample_id: 'sample-1',
            environment_analysis: 'street scene',
            scene_elements: ['curb'],
            key_anchors: ['curb'],
            key_relations: [
              {
                bbox: [320, 180, 640, 360],
                subject: 'goods',
                relation: 'blocks',
                object: 'sidewalk',
                description: 'goods blocks sidewalk',
              },
            ],
            judge_decision: 'pass',
          },
          stage2_preannotation: {
            sample_id: 'sample-1',
            fact_verifications: [
              {
                bbox: [320, 180, 640, 360],
                relation_index: 0,
                subject: 'goods',
                relation: 'blocks',
                object: 'sidewalk',
                visibility_level: 'clear',
                information_loss_type: 'none',
                subject_visible: true,
                subject_match: true,
                key_attributes_visible: ['goods', 'edge'],
                bbox_observation: 'bbox is aligned',
                global_context_observation: 'sidewalk is visible',
                verification_result: 'supported',
                verification_confidence: 0.94,
              },
            ],
            candidates: [
              {
                violation_category: ['goods_blocking_road'],
                evidence_relation_indices: [0],
                evidence_reasoning: 'goods block the walkway',
                relation_hint: 'R1',
                segmentation_targets: ['goods'],
                confidence: 0.88,
                sample_category: 'positive samples',
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          valid: true,
          dataset_id: 'ds-live',
          sample_id: 'sample-1',
          checked_operation_count: 1,
          errors: [],
          warnings: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          saved: true,
          state: {
            edit_id: 'label-edit-1',
            dataset_id: 'ds-live',
            sample_id: 'sample-1',
            task_mode: 'label_edit',
            submit_action: 'save_draft',
            task_status: 'annotation_draft',
            label_config_id: 'label-config-1',
            label_config_version: 'urban_violation_labels_v1',
            operations: [
              {
                scope: 'relation:R1',
                field: 'subject',
                op: 'replace',
                before: 'goods',
                after: 'goods updated',
                tag_payload: {
                  raw_text: 'goods updated',
                  normalized_text: 'goods updated',
                  canonical_code: null,
                  source: 'human',
                  status: 'custom',
                },
              },
            ],
            updated_at: '2026-05-18T00:00:00Z',
          },
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const detail = await api.getReviewSample('ds-live', 'sample-1');
    const patch = {
      sampleId: 'sample-1',
      taskMode: 'label_edit' as const,
      labelConfigId: 'label-config-1',
      labelConfigVersion: 'urban_violation_labels_v1',
      operations: [
        {
          scope: 'relation:R1',
          field: 'subject',
          op: 'replace' as const,
          before: 'goods',
          after: 'goods updated',
        },
      ],
    };
    const validation = await api.validateLabelEdit('ds-live', 'sample-1', patch);
    const saveResult = await api.submitLabelEdit('ds-live', 'sample-1', {
      ...patch,
      submitAction: 'save_draft',
      taskStatus: 'annotation_draft',
    });

    expect(detail.stage1.keyRelations[0]).toMatchObject({ relationIndex: 'R1', subject: 'goods' });
    expect(detail.stage2?.factVerifications[0]).toMatchObject({
      informationLossType: 'none',
      subjectVisible: true,
      subjectMatch: true,
      keyAttributesVisible: ['goods', 'edge'],
      bboxObservation: 'bbox is aligned',
      globalContextObservation: 'sidewalk is visible',
    });
    expect(detail.stage2?.candidates[0].violationCategory).toBe('goods_blocking_road');
    expect(fetcher.mock.calls[1][0]).toBe(
      'http://backend.test/datasets/ds-live/samples/sample-1/label-edits/validate',
    );
    const validateBody = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(validateBody).toMatchObject({
      task_mode: 'label_edit',
      label_config_id: 'label-config-1',
      label_config_version: 'urban_violation_labels_v1',
      operations: [expect.objectContaining({ scope: 'relation:R1', field: 'subject', op: 'replace' })],
    });
    expect(validateBody).not.toHaveProperty('sample_id');
    expect(validateBody).not.toHaveProperty('submit_action');
    expect(JSON.stringify(validateBody)).not.toContain('review_decision');
    expect(JSON.stringify(validateBody)).not.toContain('change_note');
    expect(fetcher.mock.calls[2][0]).toBe(
      'http://backend.test/datasets/ds-live/samples/sample-1/label-edits',
    );
    const saveBody = JSON.parse(String(fetcher.mock.calls[2][1]?.body));
    expect(saveBody).toMatchObject({
      submit_action: 'save_draft',
      task_status: 'annotation_draft',
    });
    expect(saveBody).not.toHaveProperty('sample_id');
    expect(JSON.stringify(saveBody)).not.toContain('review_decision');
    expect(JSON.stringify(saveBody)).not.toContain('change_note');
    expect(validation.valid).toBe(true);
    expect(validation).toMatchObject({ datasetId: 'ds-live', sampleId: 'sample-1', checkedOperationCount: 1 });
    expect(saveResult).toMatchObject({
      saved: true,
      sampleId: 'sample-1',
      submitAction: 'save_draft',
      taskStatus: 'annotation_draft',
      editId: 'label-edit-1',
      operationCount: 1,
    });
    expect(saveResult.state).toMatchObject({ editId: 'label-edit-1', taskStatus: 'annotation_draft' });
    expect(saveResult.state?.operations[0].tagPayload).toMatchObject({
      rawText: 'goods updated',
      normalizedText: 'goods updated',
      canonicalCode: null,
      source: 'human',
      status: 'custom',
    });
  });

  it('turns backend submit_changes 422 details into a label-edit validation error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          detail: {
            valid: false,
            dataset_id: 'ds-live',
            sample_id: 'sample-1',
            checked_operation_count: 1,
            errors: [
              {
                operation_index: 0,
                scope: 'candidate:C1',
                field: 'confidence',
                code: 'invalid_field_value',
                message: 'confidence must be between 0 and 1',
              },
            ],
            warnings: [],
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      ),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    let caughtError: unknown;
    try {
      await api.submitLabelEdit('ds-live', 'sample-1', {
        sampleId: 'sample-1',
        taskMode: 'label_edit',
        operations: [
          {
            scope: 'candidate:C1',
            field: 'confidence',
            op: 'replace',
            before: 0.8,
            after: 1.5,
          },
        ],
        submitAction: 'submit_changes',
        taskStatus: 'annotation_submitted',
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(LabelEditValidationError);
    expect((caughtError as LabelEditValidationError).validation).toMatchObject({
      valid: false,
      datasetId: 'ds-live',
      sampleId: 'sample-1',
      checkedOperationCount: 1,
      errors: [
        {
          operationIndex: 0,
          scope: 'candidate:C1',
          field: 'confidence',
          code: 'invalid_field_value',
        },
      ],
    });
    const submitBody = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(submitBody).toMatchObject({
      task_mode: 'label_edit',
      submit_action: 'submit_changes',
      task_status: 'annotation_submitted',
    });
    expect(submitBody).not.toHaveProperty('sample_id');
  });

  it('uses the dataset-scoped JSON label config API contract', async () => {
    const labelConfig = {
      schema_version: 'label_config_v1',
      dataset_type: 'urban_violation',
      version: 'urban_violation_labels_v1',
      fields: [
        {
          field: 'violation_category',
          mode: 'closed_enum',
          label_zh: '违法类别',
          allow_custom: false,
          options: [{ code: 'goods_blocking_road', label_zh: '物品占道' }],
        },
        {
          field: 'scene_elements',
          mode: 'open_tags',
          label_zh: '场景元素',
          allow_custom: true,
          options: [{ code: 'sidewalk', label_zh: '人行道' }],
        },
      ],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          valid: true,
          dataset_id: 'ds-live',
          schema_version: 'label_config_v1',
          version: 'urban_violation_labels_v1',
          summary: {
            field_count: 2,
            closed_enum_count: 1,
            open_tags_count: 1,
            option_count: 2,
          },
          errors: [],
          warnings: [],
          normalized_config: labelConfig,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          config_id: 'label-config-1',
          dataset_id: 'ds-live',
          schema_version: 'label_config_v1',
          version: 'urban_violation_labels_v1',
          status: 'active',
          validation: { valid: true, summary: { field_count: 2 }, errors: [], warnings: [] },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ config_id: 'label-config-1', dataset_id: 'ds-live', ...labelConfig }))
      .mockResolvedValueOnce(jsonResponse({ suggestions: [{ value: 'sidewalk', label_zh: '人行道' }] }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const validation = await api.validateLabelConfig('ds-live', {
      fileName: 'label_config.json',
      config: labelConfig,
    });
    const saved = await api.saveLabelConfig('ds-live', {
      fileName: 'label_config.json',
      config: labelConfig,
      activate: true,
    });
    const active = await api.getActiveLabelConfig('ds-live');
    const suggestions = await api.getLabelSuggestions('ds-live', 'scene_elements', 'side');

    expect(fetcher.mock.calls[0][0]).toBe('http://backend.test/api/datasets/ds-live/label-configs/validate');
    expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify({ file_name: 'label_config.json', config: labelConfig }));
    expect(fetcher.mock.calls[1][0]).toBe('http://backend.test/api/datasets/ds-live/label-configs');
    expect(fetcher.mock.calls[1][1]?.body).toBe(
      JSON.stringify({ file_name: 'label_config.json', config: labelConfig, activate: true }),
    );
    expect(fetcher.mock.calls[3][0]).toBe(
      'http://backend.test/api/datasets/ds-live/label-suggestions?field=scene_elements&q=side',
    );
    expect(validation.summary).toMatchObject({ fieldCount: 2, closedEnumCount: 1, openTagsCount: 1 });
    expect(saved).toMatchObject({ configId: 'label-config-1', status: 'active' });
    expect(active.fields[0]).toMatchObject({ field: 'violation_category', options: [{ code: 'goods_blocking_road' }] });
    expect(suggestions[0]).toMatchObject({ value: 'sidewalk', labelZh: '人行道' });
  });
});
