import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViewID } from 'cpclocots';
import { CpcLoco } from '../src/main';
import { setupIntegrationTest, startVm, stepExecution, flushCanvas, getPixels } from './IntegrationTestUtils';

describe('Integration Simple: Refactored', () => {
    let testContext: any;

    beforeEach(() => {
        testContext = setupIntegrationTest();
    });

    afterEach(() => {
        if (testContext) testContext.clear();
    });

    it('should initialize and display PRINT output', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController, vm } = startVm();

        const basicProg = '10 PRINT "HELLO WORLD"';
        (CpcLoco as any).view.setAreaValue(ViewID.inputText, basicProg);

        const printSpy = vi.spyOn(vm, 'print');
        coreController.startParseRun();

        for (let i = 0; i < 20; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const printedValues = printSpy.mock.calls.map(c => String(c[1]));
        console.log(`DEBUG: Printed HELLO WORLD values: ${JSON.stringify(printedValues)}`);

        const controller = (CpcLoco as any).controller;
        const canvasObj = controller.controller.canvas;
        const canvasElement = (canvasObj as any).canvas;

        const pixels = await getPixels(canvasElement);

        let nonZero = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
                nonZero++;
            }
        }
        console.log(`DEBUG: Non-zero pixels: ${nonZero}`);
        expect(nonZero).toBeGreaterThan(0);
        expect(printedValues).toContain('HELLO WORLD');
    });

    it('should calculate arithmetic and display it', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController, vm } = startVm();

        const basicProg = '10 PRINT 123 + 456';
        (CpcLoco as any).view.setAreaValue(ViewID.inputText, basicProg);

        const printSpy = vi.spyOn(vm, 'print');
        coreController.startParseRun();

        for (let i = 0; i < 20; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const printedValues = printSpy.mock.calls.map(c => String(c[1]));
        console.log(`DEBUG: Printed arithmetic values: ${JSON.stringify(printedValues)}`);

        const controller = (CpcLoco as any).controller;
        const canvasObj = controller.controller.canvas;
        const canvasElement = (canvasObj as any).canvas;

        const pixels = await getPixels(canvasElement);

        let nonZero = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
                nonZero++;
            }
        }
        console.log(`DEBUG: Non-zero pixels (arithmetic): ${nonZero}`);
        expect(nonZero).toBeGreaterThan(0);
        expect(printedValues).toContain('579');
    });
});
