import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Controller } from "../../src/Controller";
import { Model } from "../../src/Model";
import { View } from "../../src/View";
import { ModelPropID, ViewID } from "../../src/Constants";

describe("Debugger Stepping Integration", () => {
	let controller: Controller;
	let model: Model;
	let view: View;

	beforeEach(() => {
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
			<div id="debugArea"></div>
			<div id="debugCallStackList"></div>
			<div id="debugLineLabel"></div>
		`;

		view = new View();
		const areaValues: Record<string, string> = {};

		// Minimal mocks for View
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
			[ModelPropID.debug]: 0,
			[ModelPropID.speed]: 100,
			[ModelPropID.implicitLines]: true // Enable implicit lines to match other integration tests
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

	it("should step over GOSUB", () => {
		const script = `10 a = 1
20 GOSUB 100
30 a = 3
40 END
100 a = 2
110 RETURN`;
		view.setAreaValue(ViewID.inputText, script);
		const debuggerInstance = controller.getDebugger();
		debuggerInstance.addBreakpoint(20);

		controller.startParseRun();
		vi.runAllTimers(); // Should hit breakpoint at 20

		expect(debuggerInstance.getSnapshot().line).toBe(20);
		expect(debuggerInstance.getVariables()["aR"]).toBe(1);

		// Step Over
		debuggerInstance.stepOver();
		controller.startContinue();
		vi.runAllTimers(); // Should run 100, 110, and pause at 30

		expect(debuggerInstance.getSnapshot().line).toBe(30);
		expect(debuggerInstance.getVariables()["aR"]).toBe(2); // Subroutine executed
	});

	it("should step out of GOSUB", () => {
		const script = `10 GOSUB 100
20 END
100 a = 1
110 a = 2
120 RETURN`;
		view.setAreaValue(ViewID.inputText, script);
		const debuggerInstance = controller.getDebugger();
		debuggerInstance.addBreakpoint(100);

		controller.startParseRun();
		vi.runAllTimers(); // Should hit breakpoint at 100

		expect(debuggerInstance.getSnapshot().line).toBe(100);
		expect(debuggerInstance.getVariables()["aR"]).toBe(0);

		// Execute line 100
		debuggerInstance.stepInto();
		controller.startContinue();
		vi.runAllTimers();
		expect(debuggerInstance.getSnapshot().line).toBe(110);
		expect(debuggerInstance.getVariables()["aR"]).toBe(1);

		// Step Out
		debuggerInstance.stepOut();
		controller.startContinue();
		vi.runAllTimers(); // Should run 110, 120 (RETURN) and pause at 20

		expect(debuggerInstance.getSnapshot().line).toBe(20);
		expect(debuggerInstance.getVariables()["aR"]).toBe(2);
	});

	it("should correct call stack", () => {
		const script = `10 GOSUB 20
20 GOSUB 30
25 RETURN
30 a = 1
35 RETURN
40 END`;
		view.setAreaValue(ViewID.inputText, script);
		const debuggerInstance = controller.getDebugger();
		debuggerInstance.addBreakpoint(30);

		controller.startParseRun();
		vi.runAllTimers(); // Hit breakpoint at 30

		const stack = debuggerInstance.getCallStack();

		// Expected stack:
		// 0: 30 (Current)
		// 1: 25 (Return from 20)
		// 2: 40 (Return from 10)

		expect(stack).toHaveLength(3);
		expect(stack[0].returnLabel).toBe(30);
		expect(stack[0].depth).toBe(2);

		// Note: return labels might be internal generated labels (e.g. "20g0") or line numbers
		// We use loose matching or parseInt
		const label1 = String(stack[1].returnLabel);
		const label2 = String(stack[2].returnLabel);

		// Return from 20 (GOSUB 30) -> should go to 25
		// CodeGenerator might generate "20g0" which falls through to 25
		expect(label1).toMatch(/^(20|25)/);
		expect(stack[1].depth).toBe(1);

		// Return from 10 (GOSUB 20) -> should go to 20
		// CodeGenerator might generate "10g0" which falls through to 20
		expect(label2).toMatch(/^(10|20)/);
		expect(stack[2].depth).toBe(0);
	});
});
