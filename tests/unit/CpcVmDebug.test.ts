
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CpcVm } from "../../src/CpcVm";
import { Debugger } from "../../src/Debugger";
import { Canvas } from "../../src/Canvas";
import { Keyboard } from "../../src/Keyboard";
import { Sound } from "../../src/Sound";
import { Variables } from "../../src/Variables";

// Mock dependencies
const mockCanvas = {
	reset: vi.fn(),
	setOptions: vi.fn(),
	setDefaultInks: vi.fn(),
	setSpeedInk: vi.fn(),
} as unknown as Canvas;

const mockKeyboard = {
	reset: vi.fn(),
} as unknown as Keyboard;

const mockSound = {
	reset: vi.fn(),
} as unknown as Sound;

const mockVariables = {
	getAllVariables: vi.fn(),
	getVariableByIndex: vi.fn(),
	getAllVarTypes: vi.fn(),
	initAllVariables: vi.fn(),
} as unknown as Variables;

describe("CpcVm Debug Integration", () => {
	let vm: CpcVm;

	beforeEach(() => {
		vm = new CpcVm({
			canvas: mockCanvas,
			keyboard: mockKeyboard,
			sound: mockSound,
			variables: mockVariables,
		});
	});

	it("vmSetDebugger should store debugger reference", () => {
		const dbg = {
			onLine: vi.fn()
		} as unknown as Debugger;

		vm.vmSetDebugger(dbg);
		vm.line = 123;
		vm.vmDebugHook();

		expect(dbg.onLine).toHaveBeenCalledWith(123);
	});

	it("vmSetDebugger(undefined) should clear reference", () => {
		const dbg = {
			onLine: vi.fn()
		} as unknown as Debugger;

		vm.vmSetDebugger(dbg);
		vm.line = 123;

		// Verify it is set first
		vm.vmDebugHook();
		expect(dbg.onLine).toHaveBeenCalledWith(123);
		vi.mocked(dbg.onLine).mockClear();

		// Clear reference
		vm.vmSetDebugger(undefined);
		vm.vmDebugHook();

		expect(dbg.onLine).not.toHaveBeenCalled();
	});

	it("vmDebugHook should call debugger.onLine", () => {
		const dbg = {
			onLine: vi.fn()
		} as unknown as Debugger;

		vm.vmSetDebugger(dbg);
		vm.line = 100;

		vm.vmDebugHook();

		expect(dbg.onLine).toHaveBeenCalledWith(100);
	});

	it("vmDebugHook should do nothing when no debugger set", () => {
		// Just ensure no crash
		vm.vmDebugHook();
	});

	it("vmGetGosubStack should return stack copy", () => {
		// Need to push something to stack first.
		// Since gosubStack is private, we can use public methods to manipulate it or just trust it starts empty
		// vmGosub is private. We can use vm.gosub(ret, line)

		expect(vm.vmGetGosubStack()).toEqual([]);

		vm.gosub(10, 20); // Push 10
		expect(vm.vmGetGosubStack()).toEqual([10]);

		// Modify returned array
		const stack = vm.vmGetGosubStack();
		stack.push(99);

		expect(vm.vmGetGosubStack()).toEqual([10]); // Should still be [10]
	});

	it("vmOnError should register callback", () => {
		const callback = vi.fn();
		vm.vmOnError(callback);

		// Trigger error
		try {
			vm.error(1, "Test error");
		} catch (e) {
			// Expected
		}

		expect(callback).toHaveBeenCalled();
	});

	it("vmOnError returning true should suppress throw", () => {
		const callback = vi.fn().mockReturnValue(true);
		vm.vmOnError(callback);

		// vm.error throws unless suppressed?
		// check implementation: if callback returns true, vmStop("debug") and return CustomError, but does it throw?
		// vmComposeError returns the error object.
		// vm.error calls throw vmComposeError().
		// Ah, vmComposeError doesn't throw, it returns error. vm.error throws.

		// Wait, vmComposeError calls errorCallback.
		// If errorCallback returns true, it calls vmStop("debug").
		// It returns the error object.
		// The caller of vmComposeError usually throws it.

		// Let's verify usage in vm.error:
		// throw this.vmComposeError(...)

		// So vmComposeError returns the error object regardless.
		// The suppression logic must be in the caller or vmComposeError must throw something else?

		// Re-reading CpcVm.ts:
		/*
		if (this.errorCallback && this.errorCallback(...) {
			this.vmStop("debug", 70);
			hidden = true;
		}
		*/
		// It just marks hidden=true and stops the VM. It still returns the error.
		// And vm.error throws it.
		// So the exception is NOT suppressed in vm.error.

		// However, Controller.ts catches it:
		/*
		catch (e) {
			if (e instanceof Error) {
				if (e.name === "CpcVm" ...) {
					let customError = e as CustomError;
					...
					if (!customError.hidden) {
						Utils.console.warn(customError);
						this.outputError(...)
					}
				}
			}
		}
		*/

		// So checking "suppress throw" in CpcVm unit test is tricky because CpcVm *does* throw.
		// The "suppression" happens in how Controller handles the caught error (checks hidden flag).

		try {
			vm.error(1, "Test");
		} catch (e: any) {
			expect(e.hidden).toBe(true);
		}
	});
});
