import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Controller } from "../../src/Controller";
import { Model } from "../../src/Model";
import { View } from "../../src/View";
import { ModelPropID, ViewID } from "../../src/Constants";

describe("Debugger Error Integration", () => {
    let controller: Controller;
    let model: Model;
    let view: View;

    beforeEach(() => {
        // Mock DOM
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
        vi.spyOn(view, "setAreaSelection").mockImplementation(() => {});

        model = new Model({
            [ModelPropID.debugMode]: true,
            [ModelPropID.canvasType]: "none",
            [ModelPropID.basicVersion]: "CPC6128",
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

    it("should pause on error when breakOnError is enabled", () => {
        const script = [
            "10 a = 1",
            "20 error 33 : ' Force an error",
            "30 a = 2"
        ].join("\n");

        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.setBreakOnError(true);

        controller.startParseRun();
        vi.runAllTimers();

        const snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.state).toBe("paused");
        expect(snapshot.line).toBe(20);
        expect(snapshot.error).toBeDefined();
        expect(snapshot.error?.code).toBe(33);
        expect(snapshot.error?.pos).toBeGreaterThan(0); // Should have a valid position

        // Variable a should be 1
        expect(snapshot.variables["aR"]).toBe(1);
    });

    it("should not pause on error when breakOnError is disabled (default)", () => {
        const script = [
            "10 a = 1",
            "20 error 33",
            "30 a = 2"
        ].join("\n");

        view.setAreaValue(ViewID.inputText, script);

        // breakOnError is false by default

        controller.startParseRun();
        vi.runAllTimers();

        const snapshot = controller.getDebugger().getSnapshot();
        expect(snapshot.state).not.toBe("paused");
        // Program should have ended (stopped due to error, but not paused in debugger)
        // Controller sets vmStop("error") and loops exits.
    });

    it("should allow resuming after error to let normal error handling proceed", () => {
        const script = [
            "10 ON ERROR GOTO 40",
            "20 ERROR 33 : ' Force an error",
            "30 END",
            "40 IF ERR=33 THEN a=2",
            "50 RESUME NEXT"
        ].join("\n");

        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.setBreakOnError(true);

        // 1. Run and expect pause at line 20
        controller.startParseRun();
        vi.runAllTimers();

        let snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.state).toBe("paused");
        expect(snapshot.line).toBe(20);
        expect(snapshot.error?.code).toBe(33);

        // 2. Resume. The error should be re-thrown by VM, caught by ON ERROR, and jump to 40.
        // The debugger should NOT pause again on the same error.
        debuggerInstance.resume();
        controller.startContinue(); // Restart loop

        vi.runAllTimers();

        // 3. Verify program finished (or continued past error).
        // Variable 'a' should be 2 (set in error handler)
        snapshot = debuggerInstance.getSnapshot();
        expect(snapshot.variables["aR"]).toBe(2);

        // If it finished, state might be "running" or "idle" depending on implementation details of when snapshot is taken vs loop end.
        // But since we mocked everything and drained timers, it should be done.
        // Actually, if program ends, VM resets? Or just stops?
        // Controller.fnRunLoop exits.
    });
});
