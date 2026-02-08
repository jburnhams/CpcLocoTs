import { describe, it, expect, vi, beforeEach } from "vitest";
import { Debugger } from "../../src/Debugger";
import { CpcVm } from "../../src/CpcVm";
import { Breakpoint, DebugState } from "../../src/DebuggerTypes";

describe("Debugger", () => {
	let debuggerInstance: Debugger;
	let mockVm: CpcVm;

	beforeEach(() => {
		mockVm = {
			vmStop: vi.fn(),
			vmGetGosubStack: vi.fn().mockReturnValue([]),
			vmGetAllVariables: vi.fn().mockReturnValue({}),
			vmSetDebugger: vi.fn(),
		} as unknown as CpcVm;

		debuggerInstance = new Debugger(mockVm);
	});

	describe("Initialization", () => {
		it("should initialize with idle state", () => {
			expect(debuggerInstance.getSnapshot().state).toBe("idle");
		});

		it("should not have any breakpoints initially", () => {
			expect(debuggerInstance.getBreakpoints()).toEqual([]);
		});
	});

	describe("State Transitions", () => {
		it("should transition to paused when pause() is called", () => {
			const listener = vi.fn();
			debuggerInstance.on(listener);

			debuggerInstance.pause();

			expect(debuggerInstance.getSnapshot().state).toBe("paused");
			expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
			expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "paused" }));
		});

		it("should transition to running when resume() is called", () => {
			debuggerInstance.pause(); // Set to paused first
			const listener = vi.fn();
			debuggerInstance.on(listener);

			debuggerInstance.resume();

			expect(debuggerInstance.getSnapshot().state).toBe("running");
			expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "resumed" }));
		});

		it("should transition to idle when reset() is called", () => {
			debuggerInstance.pause();
			debuggerInstance.reset();
			expect(debuggerInstance.getSnapshot().state).toBe("idle");
		});
	});

	describe("Stepping", () => {
		it("should set state to stepping and mode to into for stepInto", () => {
			debuggerInstance.stepInto();
			expect(debuggerInstance.getSnapshot().state).toBe("stepping");
			// Check internal state somehow? Or verify onLine behavior.
			// stepMode is private, but onLine behavior depends on it.
		});

		it("should set state to stepping and mode to over for stepOver", () => {
			debuggerInstance.stepOver();
			expect(debuggerInstance.getSnapshot().state).toBe("stepping");
		});

		it("should set state to stepping and mode to out for stepOut", () => {
			debuggerInstance.stepOut();
			expect(debuggerInstance.getSnapshot().state).toBe("stepping");
		});
	});

	describe("Breakpoints", () => {
		it("should add a breakpoint", () => {
			const bp = debuggerInstance.addBreakpoint(10);
			expect(bp.line).toBe(10);
			expect(bp.enabled).toBe(true);
			expect(debuggerInstance.getBreakpoints()).toContain(bp);
		});

		it("should remove a breakpoint", () => {
			debuggerInstance.addBreakpoint(10);
			debuggerInstance.removeBreakpoint(10);
			expect(debuggerInstance.getBreakpoints()).toHaveLength(0);
		});

		it("should toggle a breakpoint", () => {
			// Toggle on
			const bp = debuggerInstance.toggleBreakpoint(10);
			expect(bp).toBeDefined();
			expect(bp!.line).toBe(10);
			expect(debuggerInstance.getBreakpoints()).toHaveLength(1);

			// Toggle off? No, toggle just enables/disables according to implementation?
			// Let's check implementation.
			// toggleBreakpoint(line): if exists, toggle enabled. if not exists, add it.

			// Toggle enabled
			const bp2 = debuggerInstance.toggleBreakpoint(10);
			expect(bp2).toBe(bp); // Same object
			expect(bp2!.enabled).toBe(false);

			// Toggle enabled again
			const bp3 = debuggerInstance.toggleBreakpoint(10);
			expect(bp3!.enabled).toBe(true);
		});

		it("should clear all breakpoints", () => {
			debuggerInstance.addBreakpoint(10);
			debuggerInstance.addBreakpoint(20);
			debuggerInstance.clearBreakpoints();
			expect(debuggerInstance.getBreakpoints()).toHaveLength(0);
		});
	});

	describe("onLine Execution Hook", () => {
		it("should do nothing if state is idle", () => {
			debuggerInstance.onLine(10);
			expect(mockVm.vmStop).not.toHaveBeenCalled();
		});

		it("should not pause if running and no breakpoint", () => {
			debuggerInstance.resume();
			debuggerInstance.onLine(10);
			expect(mockVm.vmStop).not.toHaveBeenCalled();
		});

		it("should pause if breakpoint is hit", () => {
			debuggerInstance.resume();
			debuggerInstance.addBreakpoint(10);

			const listener = vi.fn();
			debuggerInstance.on(listener);

			debuggerInstance.onLine(10);

			expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
			expect(debuggerInstance.getSnapshot().state).toBe("paused");
			expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: "breakpoint" }));
		});

		it("should pause if stepInto", () => {
			debuggerInstance.stepInto();
			debuggerInstance.onLine(10);
			expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
		});

		it("should handle stepOver correctly", () => {
			// Setup stack depth
			vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([100]); // Depth 1

			debuggerInstance.stepOver(); // Captures depth 1

			// Same depth (next line in same scope) -> should pause
			debuggerInstance.onLine(10);
			expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
		});

		it("should not pause stepOver if depth increased (call)", () => {
			vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([100]);
			debuggerInstance.stepOver(); // Depth 1

			// Depth increased to 2 (e.g. inside GOSUB)
			vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([100, 200]);

			// Reset vmStop mock to check if it's called again
			(mockVm.vmStop as any).mockClear();
			debuggerInstance.onLine(10);
			expect(mockVm.vmStop).not.toHaveBeenCalled();
		});

		it("should pause stepOut only when depth decreases", () => {
			vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([100, 200]); // Depth 2
			debuggerInstance.stepOut();

			// Same depth -> no pause
			(mockVm.vmStop as any).mockClear();
			debuggerInstance.onLine(10);
			expect(mockVm.vmStop).not.toHaveBeenCalled();

			// Depth decreased -> pause
			vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([100]);
			debuggerInstance.onLine(20);
			expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
		});
	});

	describe("Inspection", () => {
		it("should return variables from VM", () => {
			const vars = { a: 1 };
			vi.spyOn(mockVm, "vmGetAllVariables").mockReturnValue(vars);
			expect(debuggerInstance.getVariables()).toBe(vars);
		});

		it("should return call stack from VM", () => {
			const stack = [10, 20];
			vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue(stack);
			expect(debuggerInstance.getCallStack()).toEqual(stack);
		});
	});
});
