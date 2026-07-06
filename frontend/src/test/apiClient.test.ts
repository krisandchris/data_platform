import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../services/http';
import { HttpUrbanViolationApi, LabelEditValidationError } from '../services/urbanViolationApi';

const jsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'content-type': 'application/json' },
  });

describe('offline HTTP API adapter', () => {
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

  it('reads dataset type batches for the offline upload entry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        dataset_type: 'urban_violation',
        display_name: '城市违规',
        active_label_config_version: 2,
        batch_count: 1,
        batches: [
          {
            dataset_id: 'urban_violation__0508_797',
            name: '0508_797',
            batch_key: '0508_797',
            lifecycle_status: 'qc_in_progress',
            qc_queue_id: 'qcq_urban_violation_0508_797',
            active_import_job_id: 'manual-import-urban_violation-0508_797-1',
            total_assets: 797,
          },
        ],
      }),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const detail = await api.getDatasetType('urban_violation');

    expect(fetcher).toHaveBeenCalledWith('http://backend.test/dataset-types/urban_violation', expect.objectContaining({ method: 'GET' }));
    expect(detail.batches[0]).toMatchObject({
      id: 'urban_violation__0508_797',
      qcQueueId: 'qcq_urban_violation_0508_797',
      activeImportJobId: 'manual-import-urban_violation-0508_797-1',
    });
  });

  it('uploads a batch archive as raw zip with metadata query', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        job_id: 'manual-import-urban_violation-0508_797-1',
        dataset_id: 'urban_violation__0508_797',
        state: 'Imported',
        expected_assets: 797,
        imported_assets: 797,
      }),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    const job = await api.createImportJobArchive('urban_violation', {
      archiveFile: new Blob(['zip']),
      archiveFileName: '0508_797.zip',
      datasetType: 'urban_violation',
      batchKey: '0508_797',
      batchName: '0508_797',
      sourceMode: 'uploaded_package',
      sourceStructure: 'images_with_preannotations',
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/datasets/urban_violation/import-jobs/archive?');
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('batch_key=0508_797');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(job).toMatchObject({ id: 'manual-import-urban_violation-0508_797-1', totals: { rawAssets: 797 } });
  });

  it('uses retained import, QC, label config, and batch draft endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ job_id: 'job-1', dataset_id: 'ds-live', state: 'Validated' }))
      .mockResolvedValueOnce(jsonResponse({ dataset_id: 'ds-live', queue: [{ sample_id: 'sample-1', asset_id: 'asset-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ version: 'v2', fields: [{ field: 'scene_elements', mode: 'open_tags' }] }))
      .mockResolvedValueOnce(jsonResponse({ saved: true, sample_ids: ['sample-1'], saved_count: 1 }));
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    await api.validateImportJob('ds-live', 'job-1');
    await api.getQcWorkspace('ds-live');
    await api.getActiveLabelConfig('ds-live');
    await api.saveMyBatchLabelEditDraft('ds-live', {
      entries: [
        {
          sampleId: 'sample-1',
          operations: [{ scope: 'relation:r1', field: 'object', op: 'replace', after: '占道经营' }],
          dirty: true,
          saved: false,
        },
      ],
    });

    expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://backend.test/datasets/ds-live/import-jobs/job-1/validate',
      'http://backend.test/datasets/ds-live/qc',
      'http://backend.test/datasets/ds-live/label-config/active',
      'http://backend.test/datasets/ds-live/label-edits/batch/draft',
    ]);
    expect(fetcher.mock.calls[3]?.[1]).toMatchObject({
      body: JSON.stringify({
        entries: [
          {
            sample_id: 'sample-1',
            label_config_id: null,
            label_config_version: null,
            lease_id: null,
            base_revision: null,
            operations: [
              {
                scope: 'relation:r1',
                field: 'object',
                op: 'replace',
                after: '占道经营',
              },
            ],
            dirty: true,
            saved: false,
          },
        ],
      }),
    });
  });

  it('throws validation errors for rejected label edit submissions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        saved: false,
        validation: {
          valid: false,
          errors: [{ operation_index: 0, scope: 'candidate:c1', field: 'bbox', code: 'invalid_bbox', message: 'bbox invalid' }],
        },
      }),
    );
    const api = new HttpUrbanViolationApi(new HttpClient({ baseUrl: 'http://backend.test', fetcher }));

    await expect(
      api.submitLabelEdit('ds-live', 'sample-1', {
        sampleId: 'sample-1',
        submitAction: 'submit_changes',
        taskStatus: 'annotation_submitted',
        operations: [{ scope: 'candidate:c1', field: 'bbox', op: 'replace', after: [0, 0, 0, 0] }],
      }),
    ).rejects.toBeInstanceOf(LabelEditValidationError);
  });
});
