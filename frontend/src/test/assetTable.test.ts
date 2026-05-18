import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { fixtureApiClient } from '../services/fixtures';
import AssetTable from '../features/datasets/components/AssetTable.vue';

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
});
