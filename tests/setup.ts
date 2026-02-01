import { Canvas } from '@napi-rs/canvas';

// Patch global HTMLCanvasElement prototype to use @napi-rs/canvas
if (typeof global.HTMLCanvasElement !== 'undefined') {
  global.HTMLCanvasElement.prototype.getContext = function (contextId: string, options?: any) {
    if (contextId === '2d') {
      const width = this.width || 300;
      const height = this.height || 150;
      const canvas = new Canvas(width, height);
      const ctx = canvas.getContext('2d') as any;
      ctx.canvas = this;
      return ctx;
    }
    return null;
  } as any;
}
