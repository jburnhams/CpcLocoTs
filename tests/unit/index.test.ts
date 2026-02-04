import { describe, it, expect } from 'vitest';
import { Controller, Model, CpcVm } from '../../src/index';

describe('Library Exports', () => {
  it('should export core classes', () => {
    expect(Controller).toBeDefined();
    expect(Model).toBeDefined();
    expect(CpcVm).toBeDefined();
  });
});
