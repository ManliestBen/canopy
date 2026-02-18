import { describe, it, expect } from 'vitest';
import { TARGET_WIDTH, TARGET_HEIGHT } from './config';

describe('config', () => {
  it('defines target display resolution for 1920x1080', () => {
    expect(TARGET_WIDTH).toBe(1920);
    expect(TARGET_HEIGHT).toBe(1080);
  });
});
