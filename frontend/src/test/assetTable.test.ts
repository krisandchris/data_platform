import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { fixtureApiClient } from '../services/fixtures';
import AssetTable from '../features/datasets/components/AssetTable.vue';
import type { AssetListItem } from '../shared/types/contract';

const makeAsset = (sampleId: string, index: number): AssetListItem => ({
  id: `asset-${index}`,
  datasetId: 'ds_urban_violation_001',
  datasetType: 'urban_violation',
  batchKey: 'urban_violation_0520',
  sampleId,
  imageUrl: `/media/ds_urban_violation_001/${sampleId}.jpg`,
  width: 1280,
  height: 720,
  mediaStatus: 'valid',
  importedAt: '2026-05-20T00:00:00Z',
  stage1Status: 'ready',
  stage2Status: 'ready',
  judgeDecision: 'pass',
  qcStatus: 'needs_review',
  labelEditStatus: 'none',
  hasStage2Failure: false,
  violationCategories: ['goods_blocking_road'],
  sampleCategories: ['positive samples'],
  candidateCount: 1,
  highestConfidence: 0.9,
  updatedAt: '2026-05-20T00:00:00Z',
});

describe('AssetTable filters', () => {
  it('filters stage2 failures and violation categories in the route table', async () => {
    const assets = await fixtureApiClient.listAssets('ds_urban_violation_001');
    const wrapper = mount(AssetTable, {
      props: {
        datasetId: 'ds_urban_violation_001',
        assets,
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    const selects = wrapper.findAll('select');
    await selects[2].setValue('failed');

    expect(wrapper.text()).toContain('001710_0_1763108687181');
    expect(wrapper.text()).not.toContain('000142_0_1762483003246');
    expect(wrapper.find('a[href="/datasets/ds_urban_violation_001/samples/001710_0_1763108687181/review"]').exists()).toBe(true);

    await selects[2].setValue('all');
    await selects[4].setValue('goods_blocking_road');

    expect(wrapper.text()).toContain('000233_0_1762483885120');
    expect(wrapper.text()).not.toContain('001710_0_1763108687181');
  });

  it('filters sample category, media status, label edit status, and confidence without leaving the batch route', async () => {
    const assets = await fixtureApiClient.listAssets('ds_urban_violation_001');
    const wrapper = mount(AssetTable, {
      props: {
        datasetId: 'ds_urban_violation_001',
        assets,
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    const selects = wrapper.findAll('select');
    await selects[5].setValue('hard boundary samples');
    await selects[7].setValue('draft');

    expect(wrapper.text()).toContain('001710_0_1763108687181');
    expect(wrapper.text()).not.toContain('000511_0_1762485111234');

    await selects[7].setValue('all');
    await wrapper.find('input[type="number"]').setValue('0.5');

    expect(wrapper.text()).toContain('000511_0_1762485111234');
    expect(wrapper.find('a[href="/datasets/ds_urban_violation_001/samples/000511_0_1762485111234/review"]').exists()).toBe(true);
  });

  it('paginates long sample ids without pushing the right-side asset fields out of the table', async () => {
    const longSampleId =
      'urban_violation_0520_really_long_sample_identifier_for_layout_regression_00000000000000000001';
    const assets = Array.from({ length: 12 }, (_, index) =>
      makeAsset(`${longSampleId}_${String(index + 1).padStart(2, '0')}`, index),
    );
    const wrapper = mount(AssetTable, {
      props: {
        datasetId: 'ds_urban_violation_001',
        assets,
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.findAll('tbody tr')).toHaveLength(10);
    expect(wrapper.text()).toContain('显示 1-10 / 12，每页 10 条');
    expect(wrapper.text()).toContain(`${longSampleId}_01`);
    expect(wrapper.text()).not.toContain(`${longSampleId}_11`);
    expect(wrapper.find('.sample-link').attributes('title')).toBe(`${longSampleId}_01`);

    await wrapper.find('button[aria-label="下一页"]').trigger('click');

    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.text()).toContain('显示 11-12 / 12，每页 10 条');
    expect(wrapper.text()).not.toContain(`${longSampleId}_01`);
    expect(wrapper.text()).toContain(`${longSampleId}_11`);
  });
});
