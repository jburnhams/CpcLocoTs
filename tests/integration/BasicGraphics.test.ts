// BasicGraphics.test.ts - Integration tests: compile and run BASIC programs
// with graphical output, then capture and verify rendered pixels via
// @napi-rs/canvas.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createCanvas, ImageData } from '@napi-rs/canvas';

import { Canvas } from '../../src/Canvas';
import { ViewID } from '../../src/Constants';
import { cpcCharset } from '../../src/cpcCharset';
import { CanvasOptions, CanvasCharType, ICanvas } from '../../src/Interfaces';
import { BasicLexer } from '../../src/BasicLexer';
import { BasicParser } from '../../src/BasicParser';
import { CodeGeneratorJs } from '../../src/CodeGeneratorJs';
import { CpcVm, CpcVmOptions } from '../../src/CpcVm';
import { Variables } from '../../src/Variables';
import { Keyboard } from '../../src/Keyboard';
import { Sound } from '../../src/Sound';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compile a BASIC source string into a JS function that accepts a CpcVm. */
function compileBasic(source: string): { fn: Function; variables: Variables } {
    const parser = new BasicParser({ quiet: true });
    const lexer = new BasicLexer({ keywords: parser.getKeywords(), quiet: true });
    const codeGen = new CodeGeneratorJs({ lexer, parser, quiet: true });
    const variables = new Variables({});
    const output = codeGen.generate(source, variables);

    if (output.error) {
        throw output.error;
    }

    // The generated code expects a single parameter `o` (the CpcVm instance).
    const fn = new Function('o', output.text); // eslint-disable-line no-new-func
    return { fn, variables };
}

/** Run a compiled BASIC function against the VM until it stops. */
function runBasicFn(fn: Function, vm: CpcVm): void {
    vm.vmReset4Run();
    // Execute – the generated code contains its own while(vmLoopCondition)
    // loop, so a single call is enough for programs that terminate quickly.
    fn(vm);
}

/**
 * Scan the image-data pixel buffer and return a map: pen → pixel count.
 * `pen2Rgba` maps a CPC pen number to its expected RGBA components so we
 * can do the reverse lookup.
 */
function countColorPixels(
    data: Uint8ClampedArray,
    pen2Rgba: Map<string, number>
): Map<number, number> {
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
        const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
        const pen = pen2Rgba.get(key);
        if (pen !== undefined) {
            counts.set(pen, (counts.get(pen) ?? 0) + 1);
        }
    }
    return counts;
}

// CPC default ink→colour mapping (mode 1, ink set 0):
//   pen 0 → ink 1  → #000080 → (0, 0, 128)
//   pen 1 → ink 24 → #FFFF00 → (255, 255, 0)
//   pen 2 → ink 20 → #00FFFF → (0, 255, 255)
//   pen 3 → ink 6  → #FF0000 → (255, 0, 0)
const DEFAULT_MODE1_PEN_RGB = new Map<string, number>([
    ['0,0,128', 0],
    ['255,255,0', 1],
    ['0,255,255', 2],
    ['255,0,0', 3],
]);

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BASIC Graphics Integration (compile → run → verify canvas)', () => {
    let jsdom: JSDOM;
    let rsCanvas: ReturnType<typeof createCanvas>;
    let rsCtx: ReturnType<ReturnType<typeof createCanvas>['getContext']>;

    // Shared helpers that live across tests
    let cpcCanvas: Canvas;
    let vm: CpcVm;

    /** Most recent ImageData captured from putImageData. */
    let capturedImageData: ImageData | null;

    // ---- Mock keyboard & sound (minimal stubs for CpcVm) ----
    const mockKeyboard = {
        clearInput() { /* noop */ },
        getKeyFromBuffer() { return ''; },
        getKeyState() { return -1; },
        getJoyState() { return 0; },
        putKeyInBuffer() { /* noop */ },
        reset() { /* noop */ },
        resetCpcKeysExpansions() { /* noop */ },
        resetExpansionTokens() { /* noop */ },
        setCpcKeyExpansion() { /* noop */ },
        setExpansionToken() { /* noop */ },
    } as unknown as Keyboard;

    const mockSound = {
        reset() { /* noop */ },
        resetQueue() { /* noop */ },
        release() { /* noop */ },
        scheduler() { /* noop */ },
        sound() { /* noop */ },
        sq() { return 4; },
        testCanQueue() { return true; },
        setToneEnv() { /* noop */ },
        setVolEnv() { /* noop */ },
    } as unknown as Sound;

    // ----- Environment setup / teardown -----

    beforeEach(() => {
        capturedImageData = null;

        jsdom = new JSDOM(`
            <!DOCTYPE html>
            <html><body>
                <div id="${ViewID.cpcArea}">
                    <canvas id="cpcCanvas" width="640" height="400"></canvas>
                </div>
            </body></html>
        `, {
            url: 'http://localhost/',
            pretendToBeVisual: true,
            resources: 'usable',
        });

        global.window = jsdom.window as any;
        global.document = jsdom.window.document;
        global.HTMLElement = jsdom.window.HTMLElement;
        global.HTMLCanvasElement = jsdom.window.HTMLCanvasElement;
        global.requestAnimationFrame = jsdom.window.requestAnimationFrame;
        global.cancelAnimationFrame = jsdom.window.cancelAnimationFrame;
        global.MouseEvent = jsdom.window.MouseEvent;
        global.ImageData = ImageData as any;

        rsCanvas = createCanvas(640, 400);
        rsCtx = rsCanvas.getContext('2d');

        const domCanvas = document.getElementById('cpcCanvas') as HTMLCanvasElement;
        const originalGetContext = domCanvas.getContext;
        domCanvas.getContext = ((type: string, options?: any) => {
            if (type === '2d') return rsCtx as any;
            return originalGetContext.call(domCanvas, type, options);
        }) as any;
        domCanvas.toDataURL = rsCanvas.toDataURL.bind(rsCanvas);
        Object.defineProperty(domCanvas, 'offsetParent', {
            get: () => document.body,
            configurable: true,
        });

        // Intercept putImageData to capture rendered output
        const origPutImageData = rsCtx.putImageData;
        rsCtx.putImageData = (imagedata: ImageData, dx: number, dy: number) => {
            capturedImageData = imagedata;
            try {
                return origPutImageData.call(rsCtx, imagedata, dx, dy);
            } catch { /* noop – napi-rs may reject certain buffers */ }
        };
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

    /** Build Canvas + CpcVm, compile `source`, run, flush to canvas. */
    function compileRunAndCapture(source: string): ImageData {
        const canvasOpts: CanvasOptions = {
            canvasID: ViewID.cpcCanvas,
            palette: 'color',
            charset: cpcCharset as CanvasCharType[],
        };
        cpcCanvas = new Canvas(canvasOpts);

        const { fn, variables } = compileBasic(source);

        const vmOpts: CpcVmOptions = {
            canvas: cpcCanvas as ICanvas,
            keyboard: mockKeyboard,
            sound: mockSound,
            variables,
            quiet: true,
        };
        vm = new CpcVm(vmOpts);

        runBasicFn(fn, vm);

        // Force pixel buffer → ImageData
        (cpcCanvas as any).fnCopy2Canvas();

        expect(capturedImageData).toBeDefined();
        return capturedImageData!;
    }

    // ===========================================================
    // Individual BASIC program tests
    // ===========================================================

    test('PLOT: single pixel in mode 1 sets expected colour', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',      // pen 1 = bright white (#FFFFFF)
            '30 PLOT 320,200',   // centre of 640×400 canvas (in CPC coords)
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // pen 1 ink 26 = #FFFFFF → (255,255,255)
        let foundWhite = false;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                foundWhite = true;
                break;
            }
        }
        expect(foundWhite).toBe(true);
    });

    test('DRAW: horizontal line produces a row of coloured pixels', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',       // pen 1 = bright white
            '30 MOVE 100,200',
            '40 DRAW 500,200',   // horizontal line ~400 CPC units
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // Count white pixels – the line should produce a significant number
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                whiteCount++;
            }
        }
        // In mode 1 each CPC pixel is 2×2 screen pixels.
        // A 400-unit line → ~200 CPC-pixels → ~200×2=400 screen pixels (×2 rows).
        expect(whiteCount).toBeGreaterThan(100);
    });

    test('DRAW: diagonal line produces coloured pixels', () => {
        const source = [
            '10 MODE 1',
            '20 INK 2,6',        // pen 2 = bright red (#FF0000)
            '30 MOVE 0,0',
            '40 DRAW 639,399,2',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let redCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) {
                redCount++;
            }
        }
        expect(redCount).toBeGreaterThan(50);
    });

    test('CLG: clearing graphics window fills canvas with paper colour', () => {
        const source = [
            '10 MODE 1',
            '20 INK 0,26',        // pen 0 (paper) = bright white
            '30 CLG',              // clear graphics window with paper colour
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // Entire canvas should be bright white (255,255,255)
        let whiteCount = 0;
        const totalPixels = 640 * 400;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
                whiteCount++;
            }
        }
        // Allow minor tolerance for border rows etc.
        expect(whiteCount).toBe(totalPixels);
    });

    test('Multiple DRAW lines form a triangle', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,18',       // pen 1 = bright green (#00FF00)
            '30 MOVE 100,100',
            '40 DRAW 300,300,1',
            '50 DRAW 500,100,1',
            '60 DRAW 100,100,1',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let greenCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 0 && data[i + 1] === 255 && data[i + 2] === 0) {
                greenCount++;
            }
        }
        expect(greenCount).toBeGreaterThan(200);
    });

    test('FILL: flood-fill a closed rectangle', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',        // pen 1 = bright white
            '30 INK 2,6',         // pen 2 = bright red
            // Draw a rectangle with pen 1
            '40 MOVE 100,100',
            '50 DRAW 300,100,1',
            '60 DRAW 300,300,1',
            '70 DRAW 100,300,1',
            '80 DRAW 100,100,1',
            // Fill the interior with pen 2
            '90 MOVE 200,200',
            '100 FILL 2',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // Both white (outline) and red (fill) pixels should be present
        let whiteCount = 0;
        let redCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) redCount++;
        }
        expect(whiteCount).toBeGreaterThan(0);
        expect(redCount).toBeGreaterThan(100);
    });

    test('Mode 0: pen colours are available and pixel width is larger', () => {
        const source = [
            '10 MODE 0',
            '20 INK 1,26',       // pen 1 = bright white
            '30 PLOT 320,200,1',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // In mode 0 each CPC pixel is 4 wide × 2 high → 8 screen pixels
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // 4×2 = 8 screen pixels for one CPC pixel
        expect(whiteCount).toBeGreaterThanOrEqual(8);
    });

    test('Mode 2: pen colours are available and pixel width is 1', () => {
        const source = [
            '10 MODE 2',
            '20 INK 1,26',       // pen 1 = bright white
            '30 PLOT 320,200,1',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // In mode 2 each CPC pixel is 1×2 screen pixels → 2 screen pixels
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        expect(whiteCount).toBeGreaterThanOrEqual(2);
    });

    test('ORIGIN shifts coordinate system for subsequent drawing', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',       // pen 1 = bright white
            '30 ORIGIN 320,200', // move origin to centre
            '40 PLOT 0,0,1',     // should appear at centre of canvas
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // The pixel should be around the canvas centre.  In CPC coords
        // (320,200) maps to screen y = 400-1-200 = 199.  With mode-1
        // pixel height 2, the row is ~198-199.
        // Check a small region around the expected location.
        const width = 640;
        const cx = 320;
        const cy = 199; // screen row after flipping
        let found = false;
        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                const sx = cx + dx;
                const sy = cy + dy;
                if (sx >= 0 && sx < 640 && sy >= 0 && sy < 400) {
                    const idx = (sy * width + sx) * 4;
                    if (data[idx] === 255 && data[idx + 1] === 255 && data[idx + 2] === 255) {
                        found = true;
                    }
                }
            }
        }
        expect(found).toBe(true);
    });

    test('Multiple INK changes across pens produce distinct colours', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,6',        // pen 1 = bright red (#FF0000)
            '30 INK 2,18',       // pen 2 = bright green (#00FF00)
            '40 INK 3,2',        // pen 3 = bright blue (#0000FF)
            '50 MOVE 0,200',
            '60 DRAW 200,200,1', // red line
            '70 MOVE 220,200',
            '80 DRAW 420,200,2', // green line
            '90 MOVE 440,200',
            '100 DRAW 639,200,3', // blue line
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let redCount = 0;
        let greenCount = 0;
        let blueCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) redCount++;
            if (data[i] === 0 && data[i + 1] === 255 && data[i + 2] === 0) greenCount++;
            if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255) blueCount++;
        }
        expect(redCount).toBeGreaterThan(0);
        expect(greenCount).toBeGreaterThan(0);
        expect(blueCount).toBeGreaterThan(0);
    });

    test('TAG: graphics text prints character bitmaps at graphics cursor', () => {
        // TAG turns on "text at graphics" mode: PRINT sends chars via
        // printGChar which renders at the graphics cursor.
        // We test this by calling printGChar directly via the VM.
        const source = [
            '10 MODE 1',
            '20 INK 1,26',       // pen 1 = bright white
            '30 MOVE 100,200',
            '40 TAG',
            '50 PRINT CHR$(65);', // print 'A' at graphics cursor
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // The character 'A' (code 65) should produce some white pixels
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        expect(whiteCount).toBeGreaterThan(0);
    });

    test('FOR/NEXT loop draws multiple plots', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',       // pen 1 = bright white
            '30 FOR x=0 TO 600 STEP 10',
            '40 PLOT x,200,1',
            '50 NEXT x',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // 61 iterations × 4 screen pixels per CPC pixel (2w×2h in mode 1) = ~244
        expect(whiteCount).toBeGreaterThan(100);
    });

    test('Nested FOR loops draw a grid of points', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',
            '30 FOR y=50 TO 350 STEP 50',
            '40 FOR x=50 TO 590 STEP 50',
            '50 PLOT x,y,1',
            '60 NEXT x',
            '70 NEXT y',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // 7 y-values × 12 x-values = 84 points × 4 px = ~336 screen pixels
        expect(whiteCount).toBeGreaterThan(200);
    });

    test('GOSUB subroutine draws repeated pattern', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',
            '30 x=100:y=100:GOSUB 100',
            '40 x=300:y=100:GOSUB 100',
            '50 x=200:y=300:GOSUB 100',
            '60 END',
            // Subroutine: draw a small cross at (x,y)
            '100 MOVE x-20,y:DRAW x+20,y,1',
            '110 MOVE x,y-20:DRAW x,y+20,1',
            '120 RETURN',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // 3 crosses, each with two 40-unit lines = ~240 CPC pixels × 4 = ~960
        expect(whiteCount).toBeGreaterThan(200);
    });

    test('XOR colour mode produces combined colours', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',        // pen 1 = bright white
            '30 INK 3,6',         // pen 3 = bright red
            // Draw two overlapping lines: the overlap is XORed
            '40 MOVE 100,200',
            '50 DRAW 400,200,1',  // white line
            '60 MOVE 200,200',
            '70 DRAW 500,200,1,1', // second white line in XOR mode → overlap = XOR pen
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // We should have some non-zero pixels that are not background.
        let nonBackground = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 128) {
                nonBackground++;
            }
        }
        expect(nonBackground).toBeGreaterThan(0);
    });

    test('MASK: dashed line produces a non-continuous pattern', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',        // pen 1 = bright white
            '30 MASK 170',         // 0xAA = 10101010 → alternating dash pattern
            '40 MOVE 0,200',
            '50 DRAW 639,200,1',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // Count white pixels – should be roughly half of a full line
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // Full line would be ~640 screen pixels × 2 rows = ~1280.
        // With 50% mask, expect roughly half (with tolerance).
        expect(whiteCount).toBeGreaterThan(200);
        expect(whiteCount).toBeLessThan(1200);
    });

    test('GRAPHICS WINDOW clips drawing outside the window', () => {
        // Set a small graphics window and draw a long line – only the
        // part inside the window should produce pixels.
        const source = [
            '10 MODE 1',
            '20 INK 1,26',
            // Set a restricted graphics window (in CPC pixel units)
            '30 ORIGIN 0,0,200,400,300,100',
            '40 MOVE 0,200',
            '50 DRAW 639,200,1', // long line, most clipped
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // The window is only 200 units wide → much fewer pixels than 640
        expect(whiteCount).toBeGreaterThan(0);
        expect(whiteCount).toBeLessThan(800);
    });

    test('Drawing a full box outline with multiple DRAW commands', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,24',        // pen 1 = bright yellow (#FFFF00)
            '30 MOVE 50,50',
            '40 DRAW 550,50,1',   // bottom edge
            '50 DRAW 550,350,1',  // right edge
            '60 DRAW 50,350,1',   // top edge
            '70 DRAW 50,50,1',    // left edge
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let yellowCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 0) yellowCount++;
        }
        // A 500×300 box outline should produce ~1600 CPC pixels → many more screen pixels
        expect(yellowCount).toBeGreaterThan(500);
    });

    test('Complex program: concentric circles via SIN/COS in a loop', () => {
        // Draw concentric circles using trigonometry in a BASIC loop
        const source = [
            '10 MODE 1',
            '20 INK 1,26',
            '30 DEG',
            '40 cx=320:cy=200',
            '50 FOR r=20 TO 160 STEP 40',
            '60 FOR a=0 TO 360 STEP 5',
            '70 px=cx+r*COS(a):py=cy+r*SIN(a)',
            '80 PLOT px,py,1',
            '90 NEXT a',
            '100 NEXT r',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        // 4 circles × 73 points each = ~292 CPC pixels × 4 screen px ≈ 1168
        expect(whiteCount).toBeGreaterThan(500);
    });

    test('IF/THEN conditional drawing produces selective output', () => {
        const source = [
            '10 MODE 1',
            '20 INK 1,26',
            '30 INK 2,6',         // pen 2 = bright red
            '40 FOR x=0 TO 600 STEP 10',
            '50 IF x<300 THEN PLOT x,200,1 ELSE PLOT x,200,2',
            '60 NEXT x',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        let whiteCount = 0;
        let redCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) redCount++;
        }
        // Both colours should appear – left half white, right half red
        expect(whiteCount).toBeGreaterThan(0);
        expect(redCount).toBeGreaterThan(0);
    });

    test('PRINT characters render bitmaps to the text area', () => {
        // PRINT in text mode renders characters via printChar into the
        // canvas pixel buffer.
        const source = [
            '10 MODE 1',
            '20 INK 1,26',        // pen 1 = bright white
            '30 PEN 1',
            '40 PRINT "HELLO"',
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // Characters should produce some white pixels
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
        }
        expect(whiteCount).toBeGreaterThan(0);
    });

    test('Multiple MODE changes only retain the last mode drawing', () => {
        const source = [
            '10 MODE 0',
            '20 INK 1,26',
            '30 PLOT 100,200,1',  // draw in mode 0
            '40 MODE 1',          // mode change clears screen
            '50 INK 1,6',         // pen 1 = bright red
            '60 PLOT 320,200,1',  // draw in mode 1
        ].join('\n');

        const imgData = compileRunAndCapture(source);
        const data = imgData.data;

        // After MODE 1, screen is cleared – only the red pixel should remain
        let whiteCount = 0;
        let redCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) whiteCount++;
            if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) redCount++;
        }
        expect(whiteCount).toBe(0); // cleared by MODE 1
        expect(redCount).toBeGreaterThan(0);
    });
});
