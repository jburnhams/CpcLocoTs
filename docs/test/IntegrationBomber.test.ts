import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViewID } from 'cpclocots';
import { CpcLoco } from '../src/main';
import * as fs from 'fs';
import * as path from 'path';
import { setupIntegrationTest, startVm, stepExecution, flushCanvas, getPixels } from './IntegrationTestUtils';

describe('Integration: BOMBER.BAS', () => {
    let testContext: any;

    beforeEach(() => {
        testContext = setupIntegrationTest();
    });

    afterEach(() => {
        testContext.clear();
    });

    it('should initialize and load BOMBER.BAS correctly and advance past instructions', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController, vm } = startVm();

        const bomberBasPath = path.resolve(__dirname, '../../basic/BOMBER.BAS');
        const bomberBasic = fs.readFileSync(bomberBasPath, 'utf8');

        (CpcLoco as any).view.setAreaValue(ViewID.inputText, bomberBasic);

        console.log("Calling startParseRun...");
        coreController.startParseRun();

        // Step 1: Run until instructions are displayed
        for (let i = 0; i < 200; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const canvas = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;
        const data = await getPixels(canvas);

        let nonBlackPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) nonBlackPixels++;
        }
        console.log(`DEBUG: Initial state - Non-black pixels: ${nonBlackPixels}`);

        expect(nonBlackPixels).toBeGreaterThan(0);

        // Step 2: Simulate keypress
        console.log("Simulating keypress...");
        const keyboard = (coreController as any).keyboard;
        keyboard.putKeyInBuffer(' ');

        // Step 3: Run until skill selection
        for (let i = 0; i < 200; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const data2 = await getPixels(canvas);

        let greenPixels = 0;
        for (let i = 0; i < data2.length; i += 4) {
            if (data2[i] === 0 && data2[i + 1] === 255 && data2[i + 2] === 0) greenPixels++;
        }
        console.log(`DEBUG: Final state - Green pixels: ${greenPixels}`);
        expect(greenPixels).toBeGreaterThan(0);

        console.log("Bomber integration test finished successfully.");
    }, 60000);
});
