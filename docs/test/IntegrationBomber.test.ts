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
        // Run long enough for the program to start and display instructions
        for (let i = 0; i < 200; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const dataInstructions = await getPixels(canvas);
        const greenPixels = countPixels(dataInstructions, 0, 255, 0); // Green text
        const redPixels = countPixels(dataInstructions, 255, 0, 0);   // Red text

        console.log(`Instructions Screen: Green=${greenPixels}, Red=${redPixels}`);
        expect(greenPixels).toBeGreaterThan(0);
        // "Press any key to start" is in Red (PEN 2)
        expect(redPixels).toBeGreaterThan(0);

        // --- Step 2: Verify Skill Selection Screen ---
        console.log("Step 2: Transitioning to Skill Selection...");
        keyboard.putKeyInBuffer(' ', true); // Press Space to exit instructions

        // Run loop to process key and draw new screen
        for (let i = 0; i < 200; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const dataSkill = await getPixels(canvas);
        const redPixelsSkill = countPixels(dataSkill, 255, 0, 0); // Red text (PEN 2)
        const greenPixelsSkill = countPixels(dataSkill, 0, 255, 0); // Green text (Should be cleared)

        console.log(`Skill Selection: Red=${redPixelsSkill}, Green=${greenPixelsSkill}`);
        expect(redPixelsSkill).toBeGreaterThan(0);
        expect(greenPixelsSkill).toBeLessThan(greenPixels); // Should be significantly less or zero

        // --- Step 3: Verify Speed Selection Screen ---
        console.log("Step 3: Transitioning to Speed Selection...");
        keyboard.putKeyInBuffer(' ', true); // Press Space to select default skill

        for (let i = 0; i < 200; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const dataSpeed = await getPixels(canvas);
        const redPixelsSpeed = countPixels(dataSpeed, 255, 0, 0); // Red text

        console.log(`Speed Selection: Red=${redPixelsSpeed}`);
        expect(redPixelsSpeed).toBeGreaterThan(0);

        // --- Step 4: Verify Game Start ---
        console.log("Step 4: Starting Game...");
        keyboard.putKeyInBuffer(' ', true); // Press Space to select default speed

        // Wait for MODE 0 switch and building drawing
        for (let i = 0; i < 1000; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        const dataGame = await getPixels(canvas);
        // Check for Game colors (MODE 0 default palette)
        // Color 24 (Yellow #FFFF00), Color 20 (Cyan #00FFFF), Color 15 (Orange #FF8000)
        const yellowPixels = countPixels(dataGame, 255, 255, 0);
        const cyanPixels = countPixels(dataGame, 0, 255, 255);
        const orangePixels = countPixels(dataGame, 255, 128, 0);
        const redPixelsGame = countPixels(dataGame, 255, 0, 0);
        const whitePixelsGame = countPixels(dataGame, 255, 255, 255);

        console.log(`Game Start: Yellow=${yellowPixels}, Cyan=${cyanPixels}, Orange=${orangePixels}, Red=${redPixelsGame}, White=${whitePixelsGame}`);

        // With sound disabled, drawing should complete. Red pixels increased significantly (>3000) indicating Game Start (SCORE text etc.)
        expect(redPixelsGame).toBeGreaterThan(3000);

        // --- Step 5: Verify Gameplay & Sound ---
        console.log("Step 5: Dropping Bomb...");

        // Enable sound now
        (coreController as any).model.setProperty(ModelPropID.sound, true);
        coreController.setSoundActive();

        // Ensure AudioContext mock is captured
        const audioContextMock = (window as any).AudioContext;
        // Check if any instance was created (Controller creates one on init/start)
        expect(audioContextMock).toHaveBeenCalled();
        const audioContextInstance = audioContextMock.mock.results[0].value;
        const createOscillatorSpy = vi.spyOn(audioContextInstance, 'createOscillator');

        // Initial state before bomb
        const preBombData = await getPixels(canvas);
        const preBombNonBlack = countPixels(preBombData, 0, 0, 0); // Count black to see if it changes (inverse)

        // Retry dropping bomb
        for (let i = 0; i < 5; i++) {
            keyboard.putKeyInBuffer(' ', true); // Drop bomb
            await stepExecution(50);
            flushCanvas();
        }

        // Run loop to process input and update game
        for (let i = 0; i < 200; i++) {
            await stepExecution(50);
            flushCanvas();
        }

        // Verify Sound
        expect(createOscillatorSpy).toHaveBeenCalled();
        console.log("Sound generation verified.");

        // Verify Visual Change
        const postBombData = await getPixels(canvas);
        const postBombNonBlack = countPixels(postBombData, 0, 0, 0);

        // Just checking if image data changed is safer than counting specific pixels
        let changed = false;
        for(let i=0; i<preBombData.length; i++) {
            if (preBombData[i] !== postBombData[i]) {
                changed = true;
                break;
            }
        }
        console.log(`Visual change detected: ${changed}`);
        expect(changed).toBe(true);

        console.log("Bomber integration test finished successfully.");
    }, 60000);
});
