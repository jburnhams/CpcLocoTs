import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViewID } from 'cpclocots';
import { CpcLoco } from '../src/main';
import { setupIntegrationTest, startVm, stepExecution, flushCanvas, getPixels } from './IntegrationTestUtils';

describe('Integration Small: Refactored', () => {
    let testContext: any;

    beforeEach(() => {
        testContext = setupIntegrationTest();
    });

    afterEach(() => {
        testContext.clear();
    });

    it('should draw graphics with PLOT and DRAW', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController } = startVm();

        const basicGraphics = '10 MODE 1\\n20 PLOT 0,0,1\\n30 DRAW 319,199,2';
        (CpcLoco as any).view.setAreaValue(ViewID.inputText, basicGraphics.replace(/\\n/g, '\n'));

        coreController.startParseRun();

        for (let i = 0; i < 200; i++) {
            await stepExecution(100);
            flushCanvas();
        }

        const canvasElement = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;
        const data = await getPixels(canvasElement);

        let nonBlack = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) nonBlack++;
        }
        expect(nonBlack).toBeGreaterThan(100);
    });

    it('should handle loops and conditional logic', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController, vm } = startVm();

        const basicLogic = '10 FOR i=1 TO 5\\n20 IF i MOD 2 = 0 THEN PRINT "EVEN";i ELSE PRINT "ODD";i\\n30 NEXT i';
        (CpcLoco as any).view.setAreaValue(ViewID.inputText, basicLogic.replace(/\\n/g, '\n'));

        const printSpy = vi.spyOn(vm, 'print');

        coreController.startParseRun();

        for (let i = 0; i < 40; i++) {
            await stepExecution(100);
            flushCanvas();
        }

        const printedValues = printSpy.mock.calls.map(c => c.slice(1).map(arg => String(arg)).join(''));
        console.log(`DEBUG: Printed logic values: ${JSON.stringify(printedValues)}`);

        expect(printedValues.some(v => v.includes('ODD1'))).toBe(true);
        expect(printedValues.some(v => v.includes('EVEN2'))).toBe(true);
        expect(printedValues.some(v => v.includes('ODD3'))).toBe(true);
        expect(printedValues.some(v => v.includes('EVEN4'))).toBe(true);
        expect(printedValues.some(v => v.includes('ODD5'))).toBe(true);
    });

    it('should handle keyboard input with INKEY$', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController, vm } = startVm();

        const inkeyProg = '10 a$ = INKEY$\\n20 IF a$ = "" GOTO 10\\n30 PRINT "KEY ";a$';
        (CpcLoco as any).view.setAreaValue(ViewID.inputText, inkeyProg.replace(/\\n/g, '\n'));

        const printSpy = vi.spyOn(vm, 'print');

        coreController.startParseRun();

        // Run a bit to enter the loop
        for (let i = 0; i < 10; i++) {
            await stepExecution(50);
        }

        // Simulate keypress
        const keyboard = (coreController as any).keyboard;
        keyboard.putKeyInBuffer('X');

        // Run more to detect key and print
        for (let i = 0; i < 10; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const printedValues = printSpy.mock.calls.map(c => c.slice(1).map(arg => String(arg)).join(''));
        expect(printedValues.some(v => v.includes('KEY X'))).toBe(true);
    });
});
