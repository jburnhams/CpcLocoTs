import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Controller } from "../../src/Controller";
import { Model } from "../../src/Model";
import { View } from "../../src/View";
import { ModelPropID, ViewID } from "../../src/Constants";

describe("Debugger Call Stack Integration", () => {
    let controller: Controller;
    let model: Model;
    let view: View;

    beforeEach(() => {
        // Mock DOM elements required by View/Controller
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

        // Mock View methods
        view = new View();
        const areaValues: Record<string, string> = {};

        vi.spyOn(view, "getAreaValue").mockImplementation((id) => {
            return areaValues[id] || "";
        });
        vi.spyOn(view, "setAreaValue").mockImplementation((id, val) => {
            areaValues[id] = val;
        });
        vi.spyOn(view, "setDisabled").mockImplementation(() => {});
        vi.spyOn(view, "setHidden").mockImplementation(() => {});
        vi.spyOn(view, "setSelectOptions").mockImplementation(() => {});
        vi.spyOn(view, "setSelectValue").mockImplementation(() => {});
        vi.spyOn(view, "getSelectValue").mockImplementation(() => "");
        vi.spyOn(view, "getInputChecked").mockImplementation(() => false);
        vi.spyOn(view, "getInputValue").mockImplementation(() => "");

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
            [ModelPropID.speed]: 50, // Use 50 to ensure large timeout (100ms) for better timer control in tests
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

    it("should display call stack correctly for ON GOSUB", () => {
        const script = `
            10 a = 1
            20 ON a GOSUB 100, 200
            30 PRINT "Back"
            40 END
            100 PRINT "Sub 1": RETURN
            200 PRINT "Sub 2": RETURN
        `;

        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(100);
        debuggerInstance.setSpeed(50); // Set debugger speed to < 100 to ensure throttling breaks the infinite loop

        // Start run
        controller.startParseRun();

        // Run until breakpoint
        vi.runAllTimers(); // Should hit line 100

        const snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.state).toBe("paused");
        expect(snapshot.line).toBe(100);

        const stack = debuggerInstance.getCallStack();
        // Stack should be:
        // [0] Line 100 (current)
        // [1] return to 20g0 (internal label for ON GOSUB return)

        expect(stack.length).toBe(2);
        expect(stack[0].returnLabel).toBe(100);

        // returnLabel can be "20g0", check if it starts with 20 or matches logic
        const returnLabel = String(stack[1].returnLabel);
        expect(parseInt(returnLabel, 10)).toBe(20);
    });

    it("should display call stack correctly for timer (EVERY)", () => {
        const script = `
            10 EVERY 5,1 GOSUB 100
            20 FOR i=1 TO 1000
            30 NEXT i
            40 END
            100 PRINT "Timer"
            110 RETURN
        `;

        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(100);
        debuggerInstance.setSpeed(50); // Set debugger speed to < 100 to ensure throttling (100ms delay)

        // Start run
        controller.startParseRun();

        // Use runAllTimers to execute the loop.
        // With speed 50, the VM yields every few lines with a 100ms delay.
        // runAllTimers will advance the clock by 100ms steps.
        // The timer (EVERY 5 -> 100ms) should trigger during this execution.
        vi.runAllTimers();

        const snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.state).toBe("paused");
        expect(snapshot.line).toBe(100);

        const stack = debuggerInstance.getCallStack();
        // Stack should be:
        // [0] Line 100 (current)
        // [1] return to 30 or 40 (wherever it was interrupted)

        expect(stack.length).toBe(2);
        expect(stack[0].returnLabel).toBe(100);

        // The return label should be 30 or 40
        const returnLine = parseInt(String(stack[1].returnLabel), 10);
        expect([30, 40]).toContain(returnLine);
    });
});
