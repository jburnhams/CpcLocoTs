import { describe, it, expect } from 'vitest';
import { CpcLoco } from '../../src/index';

describe('CpcLoco class', () => {
  it('should be defined', () => {
    expect(CpcLoco).toBeDefined();
  });

  it('should have static methods', () => {
    expect(typeof CpcLoco.addIndex).toBe('function');
    expect(typeof CpcLoco.addItem).toBe('function');
    expect(typeof CpcLoco.addRsx).toBe('function');
  });
});
