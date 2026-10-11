import { describe, expect, it } from 'vitest';
import { YAY_VOLUME, YAY_SFX } from '@/lib/packYay';

describe('yay sound', () => {
  it('plays at half the original full volume', () => {
    expect(YAY_VOLUME).toBe(0.5);
  });

  it('is the clip the reveal window celebrates with', () => {
    expect(YAY_SFX).toContain('pack-reveal-complete');
  });
});
