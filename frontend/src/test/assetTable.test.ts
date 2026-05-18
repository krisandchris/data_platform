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
    await selects[1].setValue('failed');

    expect(wrapper.text()).toContain('001710_0_1763108687181');
    expect(wrapper.text()).not.toContain('000142_0_1762483003246');

    await selects[1].setValue('all');
    await selects[3].setValue('goods_blocking_road');

    expect(wrapper.text()).toContain('000233_0_1762483885120');
    expect(wrapper.text()).not.toContain('001710_0_1763108687181');
  });
});
