
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Controller } from "../../src/Controller";
import { Model } from "../../src/Model";
import { View } from "../../src/View";
import { ModelPropID, ViewID } from "../../src/Constants";

describe("Debugger Console Integration", () => {
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
        if (controller) controller.dispose();
    });

    it("should evaluate expression while paused", () => {
        const script = `
            10 a = 10
            20 a = 20
        `;
        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(20);

        controller.startParseRun();
        vi.runAllTimers();

        expect(debuggerInstance.getSnapshot().state).toBe("paused");

        const result = debuggerInstance.eval("a*2");
        expect(result.value).toBe(20);
    });

    it("should execute statement while paused", () => {
        const script = `
            10 a = 10
            20 a = 20
        `;
        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(20);

        controller.startParseRun();
        vi.runAllTimers();

        const execResult = debuggerInstance.exec("let a=42");
        expect(execResult.error).toBeUndefined();

        const evalResult = debuggerInstance.eval("a");
        expect(evalResult.value).toBe(42);
    });

    it("should read memory", () => {
        // POKE something
        const script = `
            10 POKE 40000, 255
            20 a = 20
        `;
        view.setAreaValue(ViewID.inputText, script);

        const debuggerInstance = controller.getDebugger();
        debuggerInstance.addBreakpoint(20);

        controller.startParseRun();
        vi.runAllTimers();

        const memory = debuggerInstance.getMemoryRange(40000, 1);
        expect(memory[0]).toBe(255);
    });
});
