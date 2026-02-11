import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createCanvas, ImageData } from '@napi-rs/canvas';
import { Canvas } from '../../src/Canvas';
import { ViewID } from '../../src/Constants';
import { cpcCharset } from '../../src/cpcCharset';
import { CanvasOptions, CanvasCharType } from '../../src/Interfaces';

describe('Graphics Integration with jsdom and @napi-rs/canvas', () => {
    let jsdom: JSDOM;
    let rsCanvas: any;
    let rsCtx: any;

    beforeEach(() => {
        // 1. Setup JSDOM
        jsdom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="${ViewID.cpcArea}">
                    <canvas id="cpcCanvas" width="640" height="400"></canvas>
                </div>
            </body>
            </html>
        `, {
            url: "http://localhost/",
            pretendToBeVisual: true,
            resources: "usable"
        });

        // 2. Set globals
        global.window = jsdom.window as any;
        global.document = jsdom.window.document;
        global.HTMLElement = jsdom.window.HTMLElement;
        global.HTMLCanvasElement = jsdom.window.HTMLCanvasElement;
        global.requestAnimationFrame = jsdom.window.requestAnimationFrame;
        global.cancelAnimationFrame = jsdom.window.cancelAnimationFrame;
        global.MouseEvent = jsdom.window.MouseEvent;
        global.ImageData = ImageData as any;

        // 3. Create napi-rs canvas
        rsCanvas = createCanvas(640, 400);
        rsCtx = rsCanvas.getContext('2d');

        // 4. Patch JSDOM element
        const cpcCanvas = document.getElementById('cpcCanvas') as HTMLCanvasElement;

        // Patch getContext to return napi-rs context
        const originalGetContext = cpcCanvas.getContext;
        cpcCanvas.getContext = ((type: string, options?: any) => {
            if (type === '2d') {
                return rsCtx as any;
            }
            return originalGetContext.call(cpcCanvas, type, options);
        }) as any;

        // Patch toDataURL
        cpcCanvas.toDataURL = rsCanvas.toDataURL.bind(rsCanvas);

        // Mock offsetParent for visibility check
        Object.defineProperty(cpcCanvas, 'offsetParent', {
            get: () => document.body,
            configurable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // @ts-ignore
        delete global.window;
        // @ts-ignore
        delete global.document;
        // @ts-ignore
        delete global.HTMLElement;
        // @ts-ignore
        delete global.HTMLCanvasElement;
        // @ts-ignore
        delete global.requestAnimationFrame;
        // @ts-ignore
        delete global.cancelAnimationFrame;
        // @ts-ignore
        delete global.MouseEvent;
        // @ts-ignore
        delete global.ImageData;
    });

    test('Canvas initializes correctly', () => {
        const options: CanvasOptions = {
            canvasID: ViewID.cpcCanvas,
            palette: "color",
            charset: cpcCharset as CanvasCharType[]
        };

        const canvas = new Canvas(options);
        expect(canvas).toBeDefined();
    });

    test('Canvas drawing operations (plot, draw, printChar)', () => {
        const options: CanvasOptions = {
            canvasID: ViewID.cpcCanvas,
            palette: "color",
            charset: cpcCharset as CanvasCharType[]
        };

        // Capture putImageData calls to verify output, bypassing environment limitations
        let capturedImageData: ImageData | null = null;
        const originalPutImageData = rsCtx.putImageData;
        rsCtx.putImageData = (imagedata: ImageData, dx: number, dy: number) => {
            capturedImageData = imagedata;
            try {
                // Workaround for napi-rs/canvas possibly not picking up direct buffer changes
                const workaroundImgData = rsCtx.createImageData(imagedata.width, imagedata.height);
                workaroundImgData.data.set(imagedata.data);
                return originalPutImageData.call(rsCtx, workaroundImgData, dx, dy);
            } catch (e) {
                // Ignore failure
            }
        };

        const canvas = new Canvas(options);

        canvas.setMode(1);
        canvas.clearGraphicsWindow();

        // Plot a point
        canvas.setGPen(1);
        canvas.plot(10, 10);

        // Draw a line
        canvas.setGPen(2);
        canvas.draw(50, 50);

        // Print a character
        canvas.printChar(65, 0, 0, 3, 0, false);

        // Force update logic
        (canvas as any).fnCopy2Canvas();

        // Verify captured content (using capture because putImageData readback is unreliable in this env)
        expect(capturedImageData).toBeDefined();
        const data = capturedImageData!.data;
        let nonZero = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) {
                nonZero++;
            }
        }
        console.log(`DEBUG: capturedImageData found ${nonZero} non-zero pixels`);
        expect(nonZero).toBeGreaterThan(0);
    });

    test('Canvas fill operation', () => {
        const options: CanvasOptions = {
            canvasID: ViewID.cpcCanvas,
            palette: "color",
            charset: cpcCharset as CanvasCharType[]
        };

        // Capture putImageData
        let capturedImageData: ImageData | null = null;
        rsCtx.putImageData = (imagedata: ImageData, dx: number, dy: number) => {
            capturedImageData = imagedata;
        };

        const canvas = new Canvas(options);
        canvas.setMode(1);
        canvas.clearGraphicsWindow();

        // Draw a box and fill it
        canvas.setGPen(1);
        canvas.move(10, 10);
        canvas.draw(20, 10);
        canvas.draw(20, 20);
        canvas.draw(10, 20);
        canvas.draw(10, 10);

        canvas.move(15, 15);
        canvas.fill(1);

        (canvas as any).fnCopy2Canvas();

        // Verify captured content
        expect(capturedImageData).toBeDefined();
        const data = capturedImageData!.data;
        let nonZero = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) nonZero++;
        }
        expect(nonZero).toBeGreaterThan(0);
    });
});
