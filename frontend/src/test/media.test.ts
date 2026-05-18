import { describe, expect, it } from 'vitest';
import { isBrowserSafeMediaUrl, toBrowserMediaUrl } from '../services/media';

describe('browser media URL safety', () => {
  it('rejects local absolute file paths', () => {
    expect(isBrowserSafeMediaUrl('/mnt/lc/private/image.jpg')).toBe(false);
    expect(isBrowserSafeMediaUrl('file:///tmp/image.jpg')).toBe(false);
    expect(isBrowserSafeMediaUrl('C:\\data\\image.jpg')).toBe(false);
  });

  it('resolves backend-relative URLs against the configured API base', () => {
    expect(toBrowserMediaUrl('/api/datasets/ds/assets/sample/image')).toBe(
      'http://127.0.0.1:8000/api/datasets/ds/assets/sample/image',
    );
  });
});
