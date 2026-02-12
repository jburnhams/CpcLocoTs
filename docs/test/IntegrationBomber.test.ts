import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViewID, Utils, ModelPropID } from 'cpclocots';
import { CpcLoco } from '../src/main';
import * as fs from 'fs';
import * as path from 'path';
import { setupIntegrationTest, startVm, stepExecution, flushCanvas, getPixels } from './IntegrationTestUtils';

function countPixels(data: Uint8ClampedArray, r: number, g: number, b: number): number {
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
        // Exact match for emulator colors
        if (data[i] === r && data[i + 1] === g && data[i + 2] === b) {
            count++;
        }
    }
    return count;
}

describe('Integration: BOMBER.BAS', () => {
    let testContext: any;

    beforeEach(() => {
        testContext = setupIntegrationTest();
    });

    afterEach(() => {
        testContext.clear();
    });

    it('should verify visual output and process key responses through game stages', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { coreController } = startVm();

        const bomberBasPath = path.resolve(__dirname, '../../basic/BOMBER.BAS');
        const bomberBasic = fs.readFileSync(bomberBasPath, 'utf8');

        (CpcLoco as any).view.setAreaValue(ViewID.inputText, bomberBasic);

        // Pre-create bomber.bak to avoid OPENIN error and infinite load loop
        // The file contains the high score (e.g., "0").
        // We use a simple ASCII format.
        Utils.localStorage.setItem("bomber.bak", "0");

        console.log("Calling startParseRun...");

        // Enable user activation but keep sound disabled initially to speed up drawing
        (coreController as any).sound.setActivatedByUser();
        (coreController as any).model.setProperty(ModelPropID.sound, false);
        coreController.setSoundActive();

        coreController.startParseRun();

        const canvas = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;
        const keyboard = (coreController as any).keyboard;

        // --- Step 1: Verify Instructions Screen ---
        console.log("Step 1: Running until instructions are displayed...");

        await vi.waitFor(async () => {
            await stepExecution(50);
            flushCanvas();
            const dataInstructions = await getPixels(canvas);
            const greenPixels = countPixels(dataInstructions, 0, 255, 0); // Green text
            const redPixels = countPixels(dataInstructions, 255, 0, 0);   // Red text
            expect(greenPixels).toBeGreaterThan(0);
            expect(redPixels).toBeGreaterThan(0); // "Press any key to start" is in Red (PEN 2)
        }, { timeout: 15000, interval: 50 }); // Allow time for loading

        console.log("Instructions screen verified.");

        // --- Step 2: Verify Skill Selection Screen ---
        console.log("Step 2: Transitioning to Skill Selection...");
        keyboard.putKeyInBuffer(' ', true); // Press Space to exit instructions

        await vi.waitFor(async () => {
            await stepExecution(50);
            flushCanvas();
            const dataSkill = await getPixels(canvas);
            const redPixelsSkill = countPixels(dataSkill, 255, 0, 0); // Red text (PEN 2)
            const greenPixelsSkill = countPixels(dataSkill, 0, 255, 0); // Green text (Should be cleared)

            // Wait for red text to appear AND green text to be cleared (new screen)
            expect(redPixelsSkill).toBeGreaterThan(0);
            expect(greenPixelsSkill).toBeLessThan(100); // Should be significantly less or zero (allowing for some border/artifact)
        }, { timeout: 10000, interval: 50 });

        console.log("Skill Selection verified.");

        // --- Step 3: Verify Speed Selection Screen ---
        console.log("Step 3: Transitioning to Speed Selection...");
        keyboard.putKeyInBuffer(' ', true); // Press Space to select default skill

        // The screen might look similar (red text), so we rely on the state advancement
        // Ideally we would check for specific text content if we had OCR, but pixel counts works
        await vi.waitFor(async () => {
            await stepExecution(50);
            flushCanvas();
            const dataSpeed = await getPixels(canvas);
            const redPixelsSpeed = countPixels(dataSpeed, 255, 0, 0); // Red text
            expect(redPixelsSpeed).toBeGreaterThan(0);
        }, { timeout: 10000, interval: 50 });

        console.log("Speed Selection verified.");

        // --- Step 4: Verify Game Start ---
        console.log("Step 4: Starting Game...");
        keyboard.putKeyInBuffer(' ', true); // Press Space to select default speed

        await vi.waitFor(async () => {
            await stepExecution(50);
            flushCanvas();
            const dataGame = await getPixels(canvas);
            const redPixelsGame = countPixels(dataGame, 255, 0, 0);

            // Check if we are in Game (Red count increased significantly from Speed screen, indicating SCORE text etc.)
            // Mode 0 text is chunky
            expect(redPixelsGame).toBeGreaterThan(3000);
        }, { timeout: 20000, interval: 50 }); // Game drawing takes time

        console.log("Game Start verified.");

        // --- Step 5: Verify Gameplay & Sound ---
        console.log("Step 5: Dropping Bomb...");

        // Enable sound now
        (coreController as any).model.setProperty(ModelPropID.sound, true);
        coreController.setSoundActive();

        // Ensure AudioContext mock is captured
        const audioContextMock = (window as any).AudioContext;
        const audioContextInstance = audioContextMock.mock.results[0].value;
        const createOscillatorSpy = vi.spyOn(audioContextInstance, 'createOscillator');

        // Initial state before bomb
        const preBombData = await getPixels(canvas);

        keyboard.putKeyInBuffer(' ', true); // Drop bomb

        await vi.waitFor(async () => {
            await stepExecution(50);
            flushCanvas();

            // Verify Sound
            expect(createOscillatorSpy).toHaveBeenCalled();

            // Verify Visual Change
            const postBombData = await getPixels(canvas);
            expect(postBombData).not.toEqual(preBombData);
        }, { timeout: 5000, interval: 50 });

        console.log("Sound generation and visual change verified.");
        console.log("Bomber integration test finished successfully.");
    }, 60000);
});
