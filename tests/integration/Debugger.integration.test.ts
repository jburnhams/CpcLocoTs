import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Controller } from "../../src/Controller";
import { Model } from "../../src/Model";
import { View } from "../../src/View";
import { ModelPropID, ViewID } from "../../src/Constants";
import { Debugger } from "../../src/Debugger";

describe("Debugger Integration", () => {
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
            [ModelPropID.speed]: 100,
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

    it("should hit breakpoint and pause execution", () => {
        const script = `
            10 a = 1
            20 a = 2
            30 a = 3
        `;

        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(20);

        // Start run
        controller.startParseRun();

        // The loop is started with setTimeout(..., 0)
        vi.runAllTimers();

        const snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.state).toBe("paused");
        expect(snapshot.line).toBe(20);

        // Check variable 'a' (should be 1 because line 20 not executed yet)
        // Variable 'a' (real) is compiled to 'aR'
        expect(snapshot.variables["aR"]).toBe(1);

        // Resume
        debuggerInstance.resume(); // Set state to running
        controller.startContinue(); // Restart loop

        vi.runAllTimers(); // Run until end (or next break)

        // Check if finished
        const snapshot2 = debuggerInstance.getSnapshot();

        // But we can check variables. a should be 3.
        expect(snapshot2.variables["aR"]).toBe(3);
    });

    it("should allow navigating to GOSUB source location via stack frame", () => {
        const script = "10 GOSUB 100\n20 END\n100 PRINT \"sub\"\n110 RETURN";

        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(110); // Pause at RETURN

        controller.startParseRun();
        vi.runAllTimers();

        const snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.state).toBe("paused");
        expect(snapshot.line).toBe(110);

        const stack = debuggerInstance.getCallStack();
        expect(stack.length).toBe(2);
        // stack[0] is current line 110
        // stack[1] is return address

        const returnLabel = stack[1].returnLabel;
        // It should be 10g0
        expect(String(returnLabel)).toMatch(/10g0/);

        // Check if we can get source range for it
        const range = debuggerInstance.getLineRange(returnLabel);
        expect(range).toBeDefined();
        // 10 GOSUB 100.
        // It should point to GOSUB statement.
        // 10 is line number.
        expect(range!.line).toBe(returnLabel);
        expect(range!.startPos).toBeGreaterThan(0);
        expect(range!.endPos).toBeGreaterThan(range!.startPos);
    });
});
