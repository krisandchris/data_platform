import { describe, expect, it } from 'vitest';
import { fixtureApiClient } from '../services/fixtures';

describe('fixture API adapter', () => {
  it('filters stage2 failures and keeps media browser-safe', async () => {
    const failures = await fixtureApiClient.listAssets('ds_urban_violation_001', {
      stage2State: 'failed',
    });

    expect(failures).toHaveLength(1);
    expect(failures[0].hasStage2Failure).toBe(true);
    expect(failures[0].imageUrl).toMatch(/^\/api\//);
  });

  it('returns review detail with bbox data', async () => {
    const detail = await fixtureApiClient.getReviewSample(
      'ds_urban_violation_001',
      '000142_0_1762483003246',
    );

    expect(detail.stage1.keyRelations[0].bbox).toHaveLength(4);
    expect(detail.stage2?.factVerifications.length).toBeGreaterThan(0);
  });
});
