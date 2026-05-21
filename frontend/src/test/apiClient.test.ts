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
    globalThis.localStorage?.clear();
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

  it('maps and creates dataset types independently from batches', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            dataset_type: 'urban_violation',
            display_name: '城市违规',
            field_schema_version: '2026-05-18',
            active_label_config_version: 1,
            status: 'active',
            batch_count: 1,
            batches: [
              {
                dataset_id: 'urban_violation__0508_fixture',
                name: '0508 fixture',
                dataset_type: 'urban_violation',
                batch_key: '0508_fixture',
                lifecycle_status: 'qc_ready',
                total_assets: 797,
                stage1_count: 797,
                stage2_success_count: 780,
                stage2_failure_count: 19,
                created_at: '2026-05-18T00:00:00Z',
              },
            ],
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          dataset_type: 'urban_violation',
          display_name: '城市违规',
          field_schema_version: '2026-05-18',
          active_label_config_version: 1,
          status: 'active',
          batch_count: 1,
          batches: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            dataset_type: 'ares_detection',
            display_name: 'Ares Detection',
            field_schema_version: 'draft',
            status: 'active',
            batch_count: 0,
            batches: [],
          },
          { status: 201 },
        ),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const types = await api.listDatasetTypes();
    const detail = await api.getDatasetType('urban_violation');
    const created = await api.createDatasetType({
      datasetType: 'ares_detection',
      displayName: 'Ares Detection',
      fieldSchemaVersion: 'draft',
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, 'http://backend.test/dataset-types', expect.objectContaining({ method: 'GET' }));
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://backend.test/dataset-types/urban_violation',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'http://backend.test/dataset-types',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          dataset_type: 'ares_detection',
          display_name: 'Ares Detection',
          field_schema_version: 'draft',
        }),
      }),
    );
    expect(types[0]).toMatchObject({
      datasetType: 'urban_violation',
      activeLabelConfigVersion: '1',
      batches: [expect.objectContaining({ id: 'urban_violation__0508_fixture' })],
    });
    expect(detail).toMatchObject({
      datasetType: 'urban_violation',
      activeLabelConfigVersion: '1',
      batchCount: 1,
    });
    expect(created).toMatchObject({
      datasetType: 'ares_detection',
      displayName: 'Ares Detection',
      batchCount: 0,
      batches: [],
    });
  });

  it('falls back to dataset type list when detail endpoint is unavailable', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: 'not implemented' }, { status: 501 }))
      .mockResolvedValueOnce(
        jsonResponse({
          dataset_types: [
            {
              dataset_type: 'ares_detection',
              display_name: 'Ares Detection',
              field_schema_version: 'draft',
              status: 'active',
              batch_count: 0,
              batches: [],
            },
          ],
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const detail = await api.getDatasetType('ares_detection');

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'http://backend.test/dataset-types/ares_detection',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(2, 'http://backend.test/dataset-types', expect.objectContaining({ method: 'GET' }));
    expect(detail).toMatchObject({
      datasetType: 'ares_detection',
      batchCount: 0,
    });
  });

  it('uses the backend session-login contract and hydrates roles from /me', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          token: 'session-token-1',
          expires_at: '2026-05-18T12:00:00Z',
          auth_mode: 'session',
          user: {
            user_id: 'platform_admin',
            display_name: 'Platform Admin',
            email: 'admin@example.local',
            status: 'active',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          auth_mode: 'session',
          user_id: 'platform_admin',
          display_name: 'Platform Admin',
          email: 'admin@example.local',
          status: 'active',
          roles: [
            {
              binding_id: 'rb-admin',
              user_id: 'platform_admin',
              role: 'platform_admin',
              scope_type: 'platform',
              scope_id: '*',
            },
          ],
          permissions: ['users:manage', 'roles:manage'],
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const user = await api.login({ username: 'platform_admin', password: 'admin123456' });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'http://backend.test/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 'platform_admin', password: 'admin123456' }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://backend.test/api/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Session-Token': 'session-token-1' }),
      }),
    );
    expect(user).toMatchObject({
      userId: 'platform_admin',
      authMode: 'session',
      roles: ['platform_admin'],
      permissions: ['users:manage', 'roles:manage'],
    });
    expect(user.roleBindings?.[0]).toMatchObject({ role: 'platform_admin', scopeType: 'platform' });
  });

  it('loads the RBAC catalog and falls back when the endpoint is unavailable', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          roles: [
            {
              role: 'dataset_admin',
              label: '数据集管理员',
              description: '管理数据集类型',
              permissions: ['roles:manage', 'audit:read'],
            },
          ],
          scope_types: ['platform', 'dataset_type', 'dataset_batch'],
          permissions: ['roles:manage', 'audit:read'],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ detail: 'not implemented' }, { status: 404 }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const catalog = await api.getRbacCatalog();
    const fallback = await api.getRbacCatalog();

    expect(fetcher).toHaveBeenNthCalledWith(1, 'http://backend.test/api/rbac/catalog', expect.objectContaining({ method: 'GET' }));
    expect(catalog.roles[0]).toMatchObject({
      role: 'dataset_admin',
      label: '数据集管理员',
      permissions: ['roles:manage', 'audit:read'],
    });
    expect(catalog.scopes).toEqual([
      expect.objectContaining({ scopeType: 'platform', label: '全平台' }),
      expect.objectContaining({ scopeType: 'dataset_type', label: '数据集类型' }),
      expect.objectContaining({ scopeType: 'dataset_batch', label: '数据集批次' }),
    ]);
    expect(fallback.roles.some((role) => role.role === 'platform_admin')).toBe(true);
    const fallbackQcLead = fallback.roles.find((role) => role.role === 'qc_lead');
    const legacyConfirmPermission = ['qc', 'submission'].join('_') + ':confirm';
    expect(fallbackQcLead?.permissions).toContain('label_edit:confirm');
    expect(fallbackQcLead?.permissions).not.toContain(legacyConfirmPermission);
  });

  it('creates users with backend-required account fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          user_id: 'reviewer_a',
          display_name: 'Reviewer A',
          email: 'reviewer_a@example.local',
          status: 'active',
          created_at: '2026-05-18T00:00:00Z',
          updated_at: '2026-05-18T00:00:00Z',
        },
        { status: 201 },
      ),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const created = await api.createUser({
      username: 'reviewer_a',
      displayName: 'Reviewer A',
      email: 'reviewer_a@example.local',
      password: 'reviewer123',
      status: 'active',
    });

    expect(fetcher).toHaveBeenCalledWith(
      'http://backend.test/api/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          user_id: 'reviewer_a',
          display_name: 'Reviewer A',
          email: 'reviewer_a@example.local',
          password: 'reviewer123',
          status: 'active',
        }),
      }),
    );
    expect(created).toMatchObject({ userId: 'reviewer_a', displayName: 'Reviewer A' });
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
      sourceStructure: 'images_with_preannotations',
      sourceFileCount: 1596,
      imageCount: 797,
      stage1FileCount: 797,
      stage2FileCount: 799,
      stage2FailureFileCount: 19,
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
        source_structure: 'images_with_preannotations',
        source_file_count: 1596,
        image_count: 797,
        stage1_file_count: 797,
        stage2_file_count: 799,
        stage2_failure_file_count: 19,
      }),
    );
  });

  it('uploads batch archive as raw zip body with query metadata', async () => {
    const jobPayload = {
      job_id: 'manual-import-urban-violation-urban_violation_0520-1',
      dataset_id: 'urban_violation__urban_violation_0520',
      dataset_type: 'urban_violation',
      batch_key: 'urban_violation_0520',
      source_mode: 'uploaded_package',
      source_uri: '/data/platform_state/import_uploads/urban_violation/urban_violation_0520/source',
      source_structure: 'images_with_preannotations',
      state: 'Imported',
      expected_assets: 505,
      imported_assets: 505,
      failure_count: 8,
      warnings: [],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(jobPayload));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));
    const archiveFile = new File(['zip-bytes'], 'urban_violation_0520.zip', { type: 'application/zip' });

    const created = await api.createImportJobArchive('urban_violation', {
      datasetType: 'urban_violation',
      batchKey: 'urban_violation_0520',
      batchName: 'Urban Violation 0520',
      sourceStructure: 'images_with_preannotations',
      archiveFile,
    });

    expect(created.datasetId).toBe('urban_violation__urban_violation_0520');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(
      'http://backend.test/api/datasets/urban_violation/import-jobs/archive?batch_key=urban_violation_0520&batch_name=Urban+Violation+0520&dataset_type=urban_violation&source_structure=images_with_preannotations&archive_file_name=urban_violation_0520.zip',
    );
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(archiveFile);
    expect(init?.headers).toMatchObject({ 'content-type': 'application/zip' });
  });

  it('reports archive upload progress through XMLHttpRequest when a callback is supplied', async () => {
    const jobPayload = {
      job_id: 'manual-import-urban-violation-urban_violation_0520-1',
      dataset_id: 'urban_violation__urban_violation_0520',
      dataset_type: 'urban_violation',
      batch_key: 'urban_violation_0520',
      source_mode: 'uploaded_package',
      source_uri: '/data/platform_state/import_uploads/urban_violation/urban_violation_0520/source',
      source_structure: 'images_with_preannotations',
      state: 'Imported',
      expected_assets: 505,
      imported_assets: 505,
      failure_count: 8,
      warnings: [],
    };
    class FakeXMLHttpRequest {
      static instances: FakeXMLHttpRequest[] = [];

      upload: {
        onprogress: ((event: ProgressEvent) => void) | null;
        onload: ((event: ProgressEvent) => void) | null;
      } = { onprogress: null, onload: null };

      method = '';
      url = '';
      requestHeaders: Record<string, string> = {};
      status = 201;
      statusText = 'Created';
      responseText = JSON.stringify(jobPayload);
      withCredentials = false;
      body: Document | XMLHttpRequestBodyInit | null | undefined;
      onload: ((event: ProgressEvent) => void) | null = null;
      onerror: ((event: ProgressEvent) => void) | null = null;
      ontimeout: ((event: ProgressEvent) => void) | null = null;
      onabort: ((event: ProgressEvent) => void) | null = null;

      constructor() {
        FakeXMLHttpRequest.instances.push(this);
      }

      open(method: string, url: string) {
        this.method = method;
        this.url = url;
      }

      setRequestHeader(name: string, value: string) {
        this.requestHeaders[name] = value;
      }

      getResponseHeader(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      }

      send(body?: Document | XMLHttpRequestBodyInit | null) {
        this.body = body;
        this.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 9 } as ProgressEvent);
        this.upload.onload?.({} as ProgressEvent);
        this.onload?.({} as ProgressEvent);
      }

      abort() {
        this.onabort?.({} as ProgressEvent);
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
    const fetcher = vi.fn<typeof fetch>();
    const progressSpy = vi.fn();
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));
    const archiveFile = new File(['zip-bytes'], 'urban_violation_0520.zip', { type: 'application/zip' });

    const created = await api.createImportJobArchive('urban_violation', {
      datasetType: 'urban_violation',
      batchKey: 'urban_violation_0520',
      sourceStructure: 'images_with_preannotations',
      archiveFile,
      onUploadProgress: progressSpy,
    });

    const xhr = FakeXMLHttpRequest.instances[0];
    expect(created.datasetId).toBe('urban_violation__urban_violation_0520');
    expect(fetcher).not.toHaveBeenCalled();
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toContain('/datasets/urban_violation/import-jobs/archive?');
    expect(xhr.body).toBe(archiveFile);
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.requestHeaders['content-type']).toBe('application/zip');
    expect(progressSpy).toHaveBeenNthCalledWith(1, {
      loadedBytes: 4,
      totalBytes: archiveFile.size,
      percent: 44,
    });
    expect(progressSpy).toHaveBeenLastCalledWith({
      loadedBytes: archiveFile.size,
      totalBytes: archiveFile.size,
      percent: 100,
    });
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

  it('uses batch draft autosave/save and batch submit label-edit endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          dataset_id: 'ds-live',
          user_id: 'annotator_a',
          assignment_id: 'assignment-1',
          sample_count: 2,
          dirty_count: 0,
          saved_count: 1,
          validation_error_count: 0,
          entries: [
            {
              sample_id: 'sample-1',
              lease_id: null,
              base_revision: 7,
              label_config_id: 'label-config-1',
              label_config_version: 'urban_violation_labels_v1',
              operations: [{ scope: 'relation:R1', field: 'subject', op: 'replace', after: 'goods updated' }],
              dirty: false,
              saved: true,
              validation: { valid: true, error_count: 0, warning_count: 0, errors: [], warnings: [] },
            },
          ],
          updated_at: '2026-05-18T00:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          saved: true,
          dataset_id: 'ds-live',
          saved_count: 1,
          sample_count: 2,
          entries: [{ sample_id: 'sample-1', dirty: false, saved: true, operations: [] }],
          updated_at: '2026-05-18T00:01:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          saved: true,
          dataset_id: 'ds-live',
          saved_count: 1,
          sample_count: 2,
          entries: [{ sample_id: 'sample-1', dirty: false, saved: true, operations: [] }],
          updated_at: '2026-05-18T00:02:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          submitted: true,
          dataset_id: 'ds-live',
          assignment_id: 'assignment-1',
          assignee_user_id: 'annotator_a',
          status: 'submitted',
          submitted_sample_count: 1,
          released_lease_count: 1,
          submitted_at: '2026-05-18T00:03:00Z',
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));
    const payload = {
      entries: [
        {
          sampleId: 'sample-1',
          leaseId: null,
          baseRevision: 7,
          labelConfigId: 'label-config-1',
          labelConfigVersion: 'urban_violation_labels_v1',
          operations: [{ scope: 'relation:R1', field: 'subject', op: 'replace' as const, after: 'goods updated' }],
          dirty: true,
          saved: false,
          validation: { valid: true, errorCount: 0, warningCount: 0, errors: [], warnings: [] },
        },
      ],
    };

    const draft = await api.getMyBatchLabelEditDraft('ds-live');
    const saved = await api.saveMyBatchLabelEditDraft('ds-live', payload);
    const autosaved = await api.autosaveMyBatchLabelEditDraft('ds-live', payload);
    const submitted = await api.submitBatchLabelEdits('ds-live', {
      unsavedDirtySampleIds: [],
      validationErrorSampleIds: [],
      notes: null,
    });

    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/datasets/ds-live/label-edits/my-batch-draft',
      'http://backend.test/api/datasets/ds-live/label-edits/my-batch-draft',
      'http://backend.test/api/datasets/ds-live/label-edits/my-batch-draft/autosave',
      'http://backend.test/api/datasets/ds-live/label-edits/submit-batch',
    ]);
    expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'PUT' }));
    const saveBody = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(saveBody).toEqual({
      entries: [
        {
          sample_id: 'sample-1',
          lease_id: null,
          base_revision: 7,
          label_config_id: 'label-config-1',
          label_config_version: 'urban_violation_labels_v1',
          operations: [expect.objectContaining({ scope: 'relation:R1', field: 'subject' })],
          dirty: true,
          saved: false,
          validation: {
            valid: true,
            error_count: 0,
            warning_count: 0,
            errors: [],
            warnings: [],
          },
        },
      ],
    });
    expect(saveBody).not.toHaveProperty('samples');
    expect(saveBody).not.toHaveProperty('total_sample_count');
    expect(JSON.stringify(saveBody)).not.toContain('task_mode');
    expect(JSON.stringify(saveBody)).not.toContain('task_revision');
    expect(JSON.stringify(saveBody)).not.toContain('updated_at');
    expect(JSON.stringify(saveBody)).not.toContain('saved_at');
    expect(JSON.stringify(saveBody)).not.toContain('checked_operation_count');
    const submitBody = JSON.parse(String(fetcher.mock.calls[3][1]?.body));
    expect(submitBody).toEqual({
      unsaved_dirty_sample_ids: [],
      validation_error_sample_ids: [],
      notes: null,
    });
    expect(draft).toMatchObject({
      datasetId: 'ds-live',
      userId: 'annotator_a',
      assignmentId: 'assignment-1',
      totalSampleCount: 2,
      savedSampleCount: 1,
      dirtySampleCount: 0,
      validationErrorCount: 0,
    });
    expect(draft.samples[0]).toMatchObject({ sampleId: 'sample-1', saved: true, validation: { valid: true } });
    expect(saved).toMatchObject({ saved: true, savedSampleCount: 1, sampleIds: ['sample-1'] });
    expect(autosaved).toMatchObject({ saved: true, updatedAt: '2026-05-18T00:02:00Z' });
    expect(saved.draft?.samples[0]).toMatchObject({ sampleId: 'sample-1', saved: true, dirty: false });
    expect(autosaved.draft?.samples[0]).toMatchObject({ sampleId: 'sample-1', saved: true, dirty: false });
    expect(submitted).toMatchObject({
      submitted: true,
      status: 'submitted',
      assignmentId: 'assignment-1',
      assigneeUserId: 'annotator_a',
      releasedLeaseCount: 1,
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
      .mockResolvedValueOnce(
        jsonResponse([
          {
            config_id: 'label-config-1',
            dataset_id: 'ds-live',
            schema_version: 'label_config_v1',
            version: 'urban_violation_labels_v1',
            status: 'active',
            validation: { valid: true, summary: { field_count: 2 }, errors: [], warnings: [] },
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ config_id: 'label-config-1', dataset_id: 'ds-live', ...labelConfig }))
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
    const versions = await api.listLabelConfigs('ds-live');
    const active = await api.getActiveLabelConfig('ds-live');
    const reloaded = await api.reloadActiveLabelConfig('ds-live');
    const suggestions = await api.getLabelSuggestions('ds-live', 'scene_elements', 'side');

    expect(fetcher.mock.calls[0][0]).toBe('http://backend.test/api/dataset-types/ds-live/label-configs/validate');
    expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify({ file_name: 'label_config.json', config: labelConfig }));
    expect(fetcher.mock.calls[1][0]).toBe('http://backend.test/api/dataset-types/ds-live/label-configs');
    const defaultSaveBody = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(defaultSaveBody).toEqual({ file_name: 'label_config.json', config: labelConfig, activate: true });
    expect(defaultSaveBody).not.toHaveProperty('save_as_new_version');
    expect(fetcher.mock.calls[2][0]).toBe('http://backend.test/api/dataset-types/ds-live/label-configs');
    expect(fetcher.mock.calls[3][0]).toBe('http://backend.test/api/dataset-types/ds-live/label-config/active');
    expect(fetcher.mock.calls[4][0]).toBe('http://backend.test/api/dataset-types/ds-live/label-config/active/reload');
    expect(fetcher.mock.calls[5][0]).toBe(
      'http://backend.test/api/datasets/ds-live/label-suggestions?field=scene_elements&q=side',
    );
    expect(validation.summary).toMatchObject({ fieldCount: 2, closedEnumCount: 1, openTagsCount: 1 });
    expect(saved).toMatchObject({ configId: 'label-config-1', status: 'active' });
    expect(versions[0]).toMatchObject({ configId: 'label-config-1', status: 'active' });
    expect(active.fields[0]).toMatchObject({ field: 'violation_category', options: [{ code: 'goods_blocking_road' }] });
    expect(reloaded).toMatchObject({ configId: 'label-config-1', status: 'active' });
    expect(suggestions[0]).toMatchObject({ value: 'sidewalk', labelZh: '人行道' });
  });

  it('normalizes structured 401/403/409 errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          detail: {
            code: 'lease_required',
            message: 'Active sample lease is required.',
            details: {
              dataset_id: 'ds-live',
              sample_id: 'sample-1',
            },
          },
        },
        { status: 409 },
      ),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    await expect(
      api.submitLabelEdit('ds-live', 'sample-1', {
        sampleId: 'sample-1',
        taskMode: 'label_edit',
        submitAction: 'save_draft',
        taskStatus: 'annotation_draft',
        operations: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      payload: {
        code: 'lease_required',
        message: 'Active sample lease is required.',
        details: expect.objectContaining({ dataset_id: 'ds-live' }),
      },
    });
  });

  it('uses auth, assignment, lease, confirmation, and audit endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user_id: 'annotator_a', display_name: '标注员 A', roles: ['annotator'], permissions: ['label.edit'], auth_mode: 'dev_header', status: 'active' }))
      .mockResolvedValueOnce(jsonResponse({ users: [{ user_id: 'annotator_a', display_name: '标注员 A', status: 'active' }] }))
      .mockResolvedValueOnce(jsonResponse({ users: [{ user_id: 'assignable_a', display_name: '可分配用户 A', status: 'active', roles: ['annotator'] }] }))
      .mockResolvedValueOnce(jsonResponse({ binding_id: 'binding-1', user_id: 'annotator_a', role: 'annotator', scope_type: 'dataset_batch', scope_id: 'ds-live' }))
      .mockResolvedValueOnce(jsonResponse({ assignment_id: 'assignment-1', dataset_id: 'ds-live', assignee_user_id: 'annotator_a', status: 'assigned' }))
      .mockResolvedValueOnce(jsonResponse({ assignment_id: 'assignment-1', dataset_id: 'ds-live', assignee_user_id: 'annotator_a', status: 'revoked' }))
      .mockResolvedValueOnce(jsonResponse({ tasks: [{ task_id: 'task-1', dataset_id: 'ds-live', sample_id: 'sample-1', status: 'in_progress', assignee_user_id: 'annotator_a', task_revision: 3 }] }))
      .mockResolvedValueOnce(jsonResponse({ lease_id: 'lease-1', dataset_id: 'ds-live', sample_id: 'sample-1', user_id: 'annotator_a', status: 'active' }))
      .mockResolvedValueOnce(jsonResponse({ submission_id: 'submission-1', dataset_id: 'ds-live', sample_id: 'sample-1', user_id: 'annotator_a', status: 'confirmed', operations: [] }))
      .mockResolvedValueOnce(jsonResponse({ audit_events: [{ event_id: 'audit-1', actor_user_id: 'lead', action: 'label_edit.confirm', entity_type: 'label_edit_submission', entity_id: 'submission-1', dataset_id: 'ds-live', sample_id: 'sample-1', created_at: '2026-05-18T00:00:00Z' }] }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const me = await api.getCurrentUser();
    const users = await api.listUsers();
    const assignableUsers = await api.listBatchAssignableUsers('ds-live');
    const binding = await api.createRoleBinding({
      userId: 'annotator_a',
      role: 'annotator',
      scopeType: 'dataset_batch',
      scopeId: 'ds-live',
    });
    const assignment = await api.assignBatch('ds-live', { assigneeUserId: 'annotator_a' });
    const released = await api.releaseBatchAssignment('ds-live');
    const tasks = await api.listQcTasks('ds-live');
    const lease = await api.acquireSampleLease('ds-live', 'sample-1');
    const confirmed = await api.confirmLabelEditSubmission('ds-live', 'sample-1', 'submission-1');
    const auditEvents = await api.listAuditEvents({ datasetId: 'ds-live', sampleId: 'sample-1' });

    expect(me).toMatchObject({ userId: 'annotator_a', authMode: 'dev_header', roles: ['annotator'] });
    expect(users[0]).toMatchObject({ userId: 'annotator_a', displayName: '标注员 A' });
    expect(assignableUsers[0]).toMatchObject({ userId: 'assignable_a', displayName: '可分配用户 A', roles: ['annotator'] });
    expect(binding).toMatchObject({ bindingId: 'binding-1', scopeType: 'dataset_batch' });
    expect(assignment).toMatchObject({ assignmentId: 'assignment-1', assigneeUserId: 'annotator_a' });
    expect(released).toMatchObject({ assignmentId: 'assignment-1', status: 'revoked' });
    expect(tasks[0]).toMatchObject({ taskId: 'task-1', status: 'in_progress', taskRevision: 3 });
    expect(lease).toMatchObject({ leaseId: 'lease-1', status: 'active' });
    expect(confirmed).toMatchObject({ submissionId: 'submission-1', status: 'confirmed' });
    expect(auditEvents[0]).toMatchObject({ eventId: 'audit-1', action: 'label_edit.confirm' });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/me',
      'http://backend.test/api/users',
      'http://backend.test/api/datasets/ds-live/qc/assignable-users',
      'http://backend.test/api/role-bindings',
      'http://backend.test/api/datasets/ds-live/qc/assignment',
      'http://backend.test/api/datasets/ds-live/qc/assignment/release',
      'http://backend.test/api/datasets/ds-live/qc/tasks',
      'http://backend.test/api/datasets/ds-live/samples/sample-1/lease',
      'http://backend.test/api/datasets/ds-live/samples/sample-1/label-edits/submission-1/confirm',
      'http://backend.test/api/audit-events?dataset_id=ds-live&sample_id=sample-1',
    ]);
    expect(fetcher.mock.calls[5][1]).toEqual(expect.objectContaining({ method: 'POST', body: JSON.stringify({}) }));
  });

  it('posts the batch QC queue generation endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        dataset_id: 'urban_violation__0518_imported',
        dataset_type: 'urban_violation',
        batch_key: '0518_imported',
        qc_queue_id: 'qcq_urban_violation_0518_imported',
        total: 1,
        items: [
          {
            qc_queue_id: 'qcq_urban_violation_0518_imported',
            dataset_id: 'urban_violation__0518_imported',
            dataset_type: 'urban_violation',
            batch_key: '0518_imported',
            sample_id: 'sample-1',
            asset_id: 'asset-1',
            judge_decision: 'pass',
            stage2_status: 'success',
            qc_status: 'pending',
            task_status: 'queued',
          },
        ],
      }),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const workspace = await api.generateQcQueue('urban_violation__0518_imported');

    expect(workspace.queue[0]).toMatchObject({
      sampleId: 'sample-1',
      taskStatus: 'queued',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'http://backend.test/api/datasets/urban_violation__0518_imported/qc/generate',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deletes a dataset batch through the batch endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    await api.deleteDatasetBatch('urban_violation__0518_imported');

    expect(fetcher).toHaveBeenCalledWith(
      'http://backend.test/api/datasets/urban_violation__0518_imported',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('reads batch QC modification event stats and events from concrete batch endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          dataset_id: 'urban_violation__0518_imported',
          total_events: 3,
          changed_sample_count: 2,
          by_event_type: [
            { event_type: 'bbox_adjusted', label: '框位置调整', count: 2 },
            { event_type: 'category_changed', label: '类别修正', count: 1 },
          ],
          by_attribution: [
            { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weight_sum: 1.2 },
          ],
          bbox_offset_bands: { micro: 1, medium: 1, large: 0 },
          changed_samples: [
            {
              sample_id: 'sample-1',
              event_count: 2,
              event_types: ['bbox_adjusted'],
              attribution_codes: ['model_bbox_offset'],
              reviewer_id: 'qc_lead_a',
              confirmed_at: '2026-05-19T09:00:00Z',
            },
          ],
          generated_at: '2026-05-19T10:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          events: [
            {
              event_id: 'event-1',
              dataset_id: 'urban_violation__0518_imported',
              sample_id: 'sample-1',
              event_type: 'bbox_adjusted',
              label: '框位置调整',
              attribution_code: 'model_bbox_offset',
              attribution_label: '模型框偏移',
              weight: 0.8,
              reviewer_id: 'qc_lead_a',
              confirmed_at: '2026-05-19T09:00:00Z',
              created_at: '2026-05-19T09:00:00Z',
              details: { field: 'bbox' },
            },
          ],
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const stats = await api.getDatasetBatchQcModificationEventStats('urban_violation__0518_imported');
    const events = await api.listDatasetBatchQcModificationEvents('urban_violation__0518_imported');

    expect(stats).toMatchObject({
      datasetId: 'urban_violation__0518_imported',
      totalEvents: 3,
      changedSampleCount: 2,
      bboxOffsetBands: { micro: 1, medium: 1, large: 0 },
    });
    expect(stats.byEventType[0]).toMatchObject({ eventType: 'bbox_adjusted', label: '框位置调整', count: 2 });
    expect(stats.byAttribution[0]).toMatchObject({ code: 'model_bbox_offset', weightSum: 1.2 });
    expect(stats.changedSamples[0]).toMatchObject({ sampleId: 'sample-1', eventTypes: ['bbox_adjusted'] });
    expect(events[0]).toMatchObject({
      eventId: 'event-1',
      sampleId: 'sample-1',
      eventType: 'bbox_adjusted',
      attributionCode: 'model_bbox_offset',
      details: { field: 'bbox' },
    });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/datasets/urban_violation__0518_imported/qc/modification-events/stats',
      'http://backend.test/api/datasets/urban_violation__0518_imported/qc/modification-events',
    ]);
  });

  it('maps sample pool stats, list filters, and detail endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          total_items: 3,
          active_items: 2,
          primary_attribution: { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weight_sum: 1.2 },
          involved_batches: ['urban_violation__0508_fixture', 'urban_violation__0518_imported'],
          recently_added_at: '2026-05-19T09:30:00Z',
          by_attribution: [{ code: 'model_bbox_offset', label: '模型框偏移', count: 2, weight_sum: 1.2 }],
          by_status: [{ status: 'active', label: '活跃', count: 2 }],
          generated_at: '2026-05-19T10:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              item_id: 'pool-1',
              dataset_id: 'urban_violation__0508_fixture',
              dataset_type: 'urban_violation',
              batch_id: 'urban_violation__0508_fixture',
              sample_id: 'sample-1',
              category: 'goods_blocking_road',
              attribution_tags: [{ code: 'model_bbox_offset', label: '模型框偏移', count: 2 }],
              event_types: ['relation_bbox_adjust'],
              event_count: 2,
              changed_field_count: 1,
              reviewer_id: 'annotator_a',
              reviewer_display_name: '标注员 A',
              confirmed_by: 'qc_lead_a',
              confirmed_by_display_name: '质检负责人 A',
              confirmed_at: '2026-05-19T09:20:00Z',
              added_at: '2026-05-19T09:21:00Z',
              status: 'active',
              confirmed_snapshot_id: 'snap-confirmed-1',
              source_event_ids: ['event-1'],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          item: {
            item_id: 'pool-1',
            dataset_id: 'urban_violation__0508_fixture',
            sample_id: 'sample-1',
            event_count: 2,
            changed_field_count: 1,
            status: 'active',
          },
          before_snapshot_id: 'snap-baseline-1',
          changed_fields: ['bbox'],
          events: [
            {
              event_id: 'event-1',
              dataset_id: 'urban_violation__0508_fixture',
              sample_id: 'sample-1',
              event_type: 'relation_bbox_adjust',
              label: '关系框调整',
            },
          ],
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const stats = await api.getSamplePoolStats();
    const items = await api.listSamplePoolItems({
      datasetType: 'urban_violation',
      batchId: 'urban_violation__0508_fixture',
      category: 'goods_blocking_road',
      attribution: 'model_bbox_offset',
      eventType: 'relation_bbox_adjust',
      reviewer: 'annotator_a',
      status: 'active',
      search: 'sample-1',
    });
    const detail = await api.getSamplePoolItem('pool-1');

    expect(stats).toMatchObject({
      totalItems: 3,
      activeItems: 2,
      involvedBatchCount: 2,
      primaryAttribution: { code: 'model_bbox_offset', label: '模型框偏移', count: 2, weightSum: 1.2 },
    });
    expect(items[0]).toMatchObject({
      itemId: 'pool-1',
      datasetId: 'urban_violation__0508_fixture',
      sampleId: 'sample-1',
      category: 'goods_blocking_road',
      eventTypes: ['relation_bbox_adjust'],
      changedFieldCount: 1,
      reviewerDisplayName: '标注员 A',
      confirmedByDisplayName: '质检负责人 A',
      confirmedSnapshotId: 'snap-confirmed-1',
    });
    expect(detail).toMatchObject({
      itemId: 'pool-1',
      beforeSnapshotId: 'snap-baseline-1',
      changedFields: ['bbox'],
      events: [expect.objectContaining({ eventId: 'event-1', eventType: 'relation_bbox_adjust' })],
    });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/sample-pool/stats',
      'http://backend.test/api/sample-pool?dataset_type=urban_violation&batch_id=urban_violation__0508_fixture&category=goods_blocking_road&attribution=model_bbox_offset&event_type=relation_bbox_adjust&reviewer=annotator_a&status=active&search=sample-1',
      'http://backend.test/api/sample-pool/items/pool-1',
    ]);
  });

  it('creates, lists, inspects, downloads, and cancels training exports', async () => {
    const exportPayload = {
      export_id: 'export-1',
      format: 'coco_json',
      source: 'current_filters',
      filters: {
        dataset_type: 'urban_violation',
        batch_id: 'urban_violation__0508_fixture',
        status: 'active',
      },
      filter_summary: '状态：活跃',
      sample_count: 12,
      status: 'completed',
      created_at: '2026-05-19T10:00:00Z',
      completed_at: '2026-05-19T10:02:00Z',
      download_url: 'http://backend.test/api/exports/export-1/download',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ export: exportPayload }))
      .mockResolvedValueOnce(jsonResponse({ exports: [exportPayload] }))
      .mockResolvedValueOnce(jsonResponse({ job: exportPayload }))
      .mockResolvedValueOnce(
        jsonResponse({
          export_id: 'export-1',
          download_url: 'http://backend.test/api/exports/export-1/download',
          file_name: 'export-1.json',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ export: { ...exportPayload, status: 'cancelled' } }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const created = await api.createTrainingExport({
      format: 'coco_json',
      source: 'current_filters',
      filters: {
        datasetType: 'urban_violation',
        batchId: 'urban_violation__0508_fixture',
        status: 'active',
      },
    });
    const exports = await api.listTrainingExports();
    const detail = await api.getTrainingExport('export-1');
    const download = await api.downloadTrainingExport('export-1');
    const cancelled = await api.cancelTrainingExport('export-1');

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'http://backend.test/api/exports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          format: 'coco_json',
          source: 'current_filters',
          filters: {
            dataset_type: 'urban_violation',
            batch_id: 'urban_violation__0508_fixture',
            status: 'active',
          },
        }),
      }),
    );
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/exports',
      'http://backend.test/api/exports',
      'http://backend.test/api/exports/export-1',
      'http://backend.test/api/exports/export-1/download',
      'http://backend.test/api/exports/export-1/cancel',
    ]);
    expect(created).toMatchObject({
      exportId: 'export-1',
      format: 'coco_json',
      source: 'current_filters',
      filters: { datasetType: 'urban_violation', batchId: 'urban_violation__0508_fixture', status: 'active' },
      sampleCount: 12,
      status: 'completed',
      downloadUrl: 'http://backend.test/api/exports/export-1/download',
    });
    expect(exports[0].filterSummary).toBe('状态：活跃');
    expect(detail.exportId).toBe('export-1');
    expect(download).toMatchObject({
      exportId: 'export-1',
      url: 'http://backend.test/api/exports/export-1/download',
      fileName: 'export-1.json',
    });
    expect(api.getTrainingExportDownloadUrl('export-1')).toBe('http://backend.test/api/exports/export-1/download');
    expect(cancelled.status).toBe('cancelled');
  });

  it('uses evaluation and version-history API endpoints with normalized fields', async () => {
    const evaluationPayload = {
      evaluation_id: 'eval-2',
      dataset_id: 'urban_violation__0508_fixture',
      model_name: 'Qwen2.5-VL',
      model_version: 'qwen2.5-vl-qc-v2',
      status: 'completed',
      sample_count: 780,
      source_export_id: 'export-1',
      source_snapshot_id: 'snap-model-2',
      metrics: [{ key: 'mAP50', label: 'mAP50', value: 0.84, baseline_value: 0.81, delta: 0.03 }],
      metric_deltas: [{ key: 'recall', label: '召回率', value: 0.8, baseline_value: 0.76, delta: 0.04 }],
      category_metrics: [{ category: 'goods_blocking_road', label: '物品占道', precision: 0.9, recall: 0.82, f1_score: 0.86, sample_count: 120, delta: 0.02 }],
      changed_sample_count: 12,
      created_at: '2026-05-19T10:00:00Z',
      completed_at: '2026-05-19T10:08:00Z',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ evaluation: evaluationPayload }))
      .mockResolvedValueOnce(jsonResponse({ evaluations: [evaluationPayload] }))
      .mockResolvedValueOnce(jsonResponse({ run: evaluationPayload }))
      .mockResolvedValueOnce(
        jsonResponse({
          left: {
            evaluation_id: 'eval-1',
            model_version: 'qwen2.5-vl-qc-v1',
          },
          right: {
            evaluation_id: 'eval-2',
            model_version: 'qwen2.5-vl-qc-v2',
          },
          metric_delta: {
            mAP: 0.03,
            precision: 0.02,
            recall: 0.04,
            f1: 0.03,
            false_positive_rate: -0.01,
            hard_sample_hit_rate: 0.05,
          },
          category_deltas: [
            {
              category: 'goods_blocking_road',
              label: '物品占道',
              metric_delta: {
                precision: 0.01,
                recall: 0.03,
                f1: 0.02,
              },
            },
          ],
          changed_samples: {
            left_only: ['sample-regressed'],
            right_only: ['sample-improved-1', 'sample-improved-2'],
            intersection: ['sample-overlap'],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          samples: [
            {
              sample_id: 'sample-1',
              category: 'goods_blocking_road',
              change_type: 'improved',
              before_snapshot_id: 'snap-before',
              after_snapshot_id: 'snap-after',
              metric_impacts: [{ key: 'confidence', label: '置信度', value: 0.9, baseline_value: 0.75, delta: 0.15 }],
              reason: 'model improved',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          snapshots: [
            {
              snapshot_id: 'snap-confirmed-1',
              dataset_id: 'urban_violation__0508_fixture',
              sample_id: 'sample-1',
              snapshot_type: 'confirmed',
              source_submission_id: 'submission-1',
              label_config_version: 'urban_violation_labels_v1',
              payload_hash: 'hash-1',
              created_by: 'qc_lead_a',
              created_at: '2026-05-19T09:00:00Z',
              rollback_available: false,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          dataset_id: 'urban_violation__0508_fixture',
          left_snapshot_id: 'snap-baseline-1',
          right_snapshot_id: 'snap-confirmed-1',
          operation_count: 5,
          changed_fields: ['candidate.C1.violation_category'],
          changed_relations: ['R1.bbox'],
          changed_candidates: ['C1.violation_category'],
          rollback_available: false,
        }),
      );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test/api', fetcher }));

    const created = await api.createDatasetBatchEvaluation('urban_violation__0508_fixture', {
      modelVersion: 'qwen2.5-vl-qc-v2',
      modelName: 'Qwen2.5-VL',
      sourceExportId: 'export-1',
      sourceSnapshotId: 'snap-model-2',
      notes: 'phase4 smoke',
    });
    const evaluations = await api.listDatasetBatchEvaluations('urban_violation__0508_fixture');
    const evaluation = await api.getDatasetBatchEvaluation('urban_violation__0508_fixture', 'eval-2');
    const comparison = await api.compareModelEvaluations('eval-1', 'eval-2');
    const deltaSamples = await api.listModelEvaluationDeltaSamples('eval-2');
    const snapshots = await api.listDatasetBatchSnapshots('urban_violation__0508_fixture');
    const diff = await api.diffDatasetBatchSnapshots('urban_violation__0508_fixture', 'snap-baseline-1', 'snap-confirmed-1');

    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'http://backend.test/api/datasets/urban_violation__0508_fixture/evaluations',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/evaluations',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/evaluations/eval-2',
      'http://backend.test/api/evaluations/compare?left_id=eval-1&right_id=eval-2',
      'http://backend.test/api/evaluations/eval-2/delta-samples',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/snapshots',
      'http://backend.test/api/datasets/urban_violation__0508_fixture/snapshots/diff?left_snapshot_id=snap-baseline-1&right_snapshot_id=snap-confirmed-1',
    ]);
    expect(fetcher.mock.calls[0][1]?.body).toBe(
      JSON.stringify({
        model_version: 'qwen2.5-vl-qc-v2',
        model_name: 'Qwen2.5-VL',
        source_export_id: 'export-1',
        source_snapshot_id: 'snap-model-2',
        notes: 'phase4 smoke',
      }),
    );
    expect(created).toMatchObject({ evaluationId: 'eval-2', modelVersion: 'qwen2.5-vl-qc-v2' });
    expect(evaluations[0].categoryMetrics[0]).toMatchObject({ category: 'goods_blocking_road', f1: 0.86 });
    expect(evaluation.metricDeltas[0]).toMatchObject({ key: 'recall', baselineValue: 0.76, delta: 0.04 });
    expect(comparison).toMatchObject({
      leftEvaluationId: 'eval-1',
      rightEvaluationId: 'eval-2',
      leftModelVersion: 'qwen2.5-vl-qc-v1',
      rightModelVersion: 'qwen2.5-vl-qc-v2',
      changedSampleCount: 4,
      improvedCount: 2,
      regressedCount: 1,
    });
    expect(comparison.metricDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'mAP', label: 'mAP', value: 0.03, delta: 0.03 }),
        expect.objectContaining({ key: 'false_positive_rate', label: '误报率', value: -0.01, delta: -0.01 }),
        expect.objectContaining({ key: 'hard_sample_hit_rate', label: '困难样本命中率', value: 0.05, delta: 0.05 }),
      ]),
    );
    expect(comparison.categoryDeltas[0]).toMatchObject({
      category: 'goods_blocking_road',
      precision: 0.01,
      recall: 0.03,
      f1: 0.02,
      delta: 0.02,
    });
    expect(deltaSamples[0]).toMatchObject({ sampleId: 'sample-1', beforeSnapshotId: 'snap-before' });
    expect(snapshots[0]).toMatchObject({ snapshotId: 'snap-confirmed-1', snapshotType: 'confirmed', rollbackAvailable: false });
    expect(diff).toMatchObject({
      leftSnapshotId: 'snap-baseline-1',
      rightSnapshotId: 'snap-confirmed-1',
      changedRelationCount: 1,
      changedCandidateCount: 1,
      changedFieldCount: 1,
      summary: '操作数 5',
      relations: [expect.objectContaining({ field: 'R1.bbox' })],
      candidates: [expect.objectContaining({ field: 'C1.violation_category' })],
    });
  });
});
