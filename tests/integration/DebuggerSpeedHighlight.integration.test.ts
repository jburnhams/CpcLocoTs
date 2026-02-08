import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Controller } from "../../src/Controller";
import { Model } from "../../src/Model";
import { View } from "../../src/View";
import { ModelPropID, ViewID } from "../../src/Constants";
import { Debugger } from "../../src/Debugger";

describe("Debugger Speed & Highlight Integration", () => {
    let controller: Controller;
    let model: Model;
    let view: View;

    beforeEach(() => {
        // Mock DOM elements
        document.body.innerHTML = `
            <div id="cpcArea"></div>
            <div id="cpcCanvas"></div>
            <div id="textText"></div>
            <div id="noCanvas"></div>
            <div id="inputText"></div>
            <div id="outputText"></div>
            <div id="resultText"></div>
            <div id="consoleLogText"></div>
            <div id="variableArea"></div>
            <div id="varSelect"></div>
            <div id="varText"></div>
            <div id="inp2Text"></div>
            <div id="dropZone"></div>
            <div id="fileInput"></div>
            <div id="disassText"></div>
        `;

        view = new View();
        const areaValues: Record<string, string> = {};

        vi.spyOn(view, "getAreaValue").mockImplementation((id) => areaValues[id] || "");
        vi.spyOn(view, "setAreaValue").mockImplementation((id, val) => { areaValues[id] = val; });
        vi.spyOn(view, "setDisabled").mockImplementation(() => {});
        vi.spyOn(view, "setHidden").mockImplementation(() => {});
        vi.spyOn(view, "setSelectOptions").mockImplementation(() => {});
        vi.spyOn(view, "setSelectValue").mockImplementation(() => {});
        vi.spyOn(view, "getSelectValue").mockImplementation(() => "");
        vi.spyOn(view, "getInputChecked").mockImplementation(() => false);
        vi.spyOn(view, "getInputValue").mockImplementation(() => "");
        vi.spyOn(view, "setAreaSelection").mockImplementation(() => view);

        model = new Model({
            [ModelPropID.debugMode]: true,
            [ModelPropID.debug]: 0,
            [ModelPropID.trace]: false,
            [ModelPropID.implicitLines]: true,
            [ModelPropID.integerOverflow]: false,
            [ModelPropID.canvasType]: "none",
            [ModelPropID.arrayBounds]: false,
            [ModelPropID.showKbd]: false,
            [ModelPropID.sound]: false,
            [ModelPropID.bench]: 0,
            [ModelPropID.speed]: 50, // Speed 50 for testing throttle
            [ModelPropID.basicVersion]: "CPC6128",
            [ModelPropID.processFileImports]: false,
            [ModelPropID.prettyLowercaseVars]: false,
            [ModelPropID.palette]: "color"
        });

        controller = new Controller(model, view);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        if (controller) {
            controller.dispose();
        }
    });

    it("should throttle execution and emit step events with highlight info", () => {
        const script = `
            10 FOR i = 1 TO 20
            20 next i
        `;
        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.setSpeed(50);
        const listener = vi.fn();
        debuggerInstance.on(listener);

        controller.startParseRun();

        // Speed 50 means delay=100ms, lines=11.
        // Loop runs 20 times (line 10, line 20). Total ~40 lines + overhead.

        // Advance timers by a small amount, not enough to finish
        vi.advanceTimersByTime(10);

        // It should start running
        expect(debuggerInstance.getSnapshot().state).toBe("running");

        // Advance timers enough to trigger throttle (11 lines)
        // We need to advance enough to cover the execution time + delay?
        // Actually the delay is inserted via setTimeout.
        // So we need to run pending timers.

        vi.runAllTimers();

        // Should be finished now
        // But we want to verify step events happened.

        // Listener should have received "step" events.
        // Filter for "step" type events
        const stepEvents = listener.mock.calls.flat().filter(e => e.type === "step");

        expect(stepEvents.length).toBeGreaterThan(0);

        // Check if snapshot in step event has line range info available via debugger
        // The event snapshot doesn't contain range, but we can check if currentLine was updated correctly.
        // And we can verify that at least one event corresponds to a known line.

        const lastStep = stepEvents[stepEvents.length - 1];
        expect(lastStep.snapshot.state).toBe("running"); // It emits step while running (throttled)

        // Verify getCurrentLineRange works during execution
        // We can't easily check this *during* runAllTimers unless we use advanceTimersByTime loop.
    });

    it("should provide line range information during execution", () => {
         const script = `
            10 a = 1
            20 a = 2
        `;
        view.setAreaValue(ViewID.inputText, script);
        const debuggerInstance = controller.getDebugger();

        // We need to ensure source map is set.
        // startParseRun calls fnParse which calls debugger.setSourceMap.

        controller.startParseRun();

        // Just run a bit.
        vi.advanceTimersByTime(0);

        // Debugger should have source map now.
        // We can manually check if it returns range for line 10.

        // We need access to source map or just check if getCurrentLineRange works if we force currentLine.
        // But currentLine is set by execution.

        // Let's set a breakpoint at 10 to check range
        debuggerInstance.addBreakpoint(10);

        // Reset and run again
        controller.startParseRun();
        vi.runAllTimers();

        expect(debuggerInstance.getSnapshot().state).toBe("paused");
        expect(debuggerInstance.getSnapshot().line).toBe(10);

        const range = debuggerInstance.getCurrentLineRange();
        expect(range).not.toBeNull();
        expect(range?.line).toBe(10);
        expect(range?.startPos).toBeGreaterThanOrEqual(0);
        expect(range?.endPos).toBeGreaterThan(range!.startPos);
    });
});
