import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Debugger } from '../../src/Debugger';
import { CpcVm } from '../../src/CpcVm';

describe('Debugger Breakpoints', () => {
	let vm: CpcVm;
	let dbg: Debugger;

	beforeEach(() => {
		vm = {
			vmGetGosubStack: vi.fn().mockReturnValue([]),
			vmStop: vi.fn(),
			vmGetAllVariables: vi.fn().mockReturnValue({})
		} as any;
		dbg = new Debugger(vm);
	});

	it('should add and remove breakpoints', () => {
		dbg.addBreakpoint(10);
		expect(dbg.getBreakpoints()).toHaveLength(1);
		expect(dbg.getBreakpoints()[0].line).toBe(10);

		dbg.removeBreakpoint(10);
		expect(dbg.getBreakpoints()).toHaveLength(0);
	});

	it('should toggle breakpoints', () => {
		const bp = dbg.addBreakpoint(20);
		expect(bp.enabled).toBe(true);

		dbg.toggleBreakpoint(20);
		expect(dbg.getBreakpoints()[0].enabled).toBe(false);

		dbg.toggleBreakpoint(20);
		expect(dbg.getBreakpoints()[0].enabled).toBe(true);
	});

	it('should clear breakpoints', () => {
		dbg.addBreakpoint(10);
		dbg.addBreakpoint(20);
		dbg.clearBreakpoints();
		expect(dbg.getBreakpoints()).toHaveLength(0);
	});

	it('should pause on enabled breakpoint', () => {
		dbg.resume(); // Set state to running
		dbg.addBreakpoint(10);

		dbg.onLine(10);

		expect(vm.vmStop).toHaveBeenCalledWith("debug", 70);
		expect(dbg.getSnapshot().state).toBe("paused");
	});

	it('should not pause on disabled breakpoint', () => {
		dbg.resume();
		const bp = dbg.addBreakpoint(10);
		bp.enabled = false;

		dbg.onLine(10);

		expect(vm.vmStop).not.toHaveBeenCalledWith("debug", 70);
	});

	it('should evaluate conditional breakpoint', () => {
		dbg.resume();
		const bp = dbg.addBreakpoint(10, "x>5");

		const evaluator = vi.fn();
		dbg.setConditionEvaluator(evaluator);

		// Condition true
		evaluator.mockReturnValue(true);
		dbg.onLine(10);
		expect(vm.vmStop).toHaveBeenCalledWith("debug", 70);
		expect(evaluator).toHaveBeenCalledWith("x>5");

		// Reset
		dbg.resume();
		vi.clearAllMocks(); // Clear calls to vmStop

		// Condition false
		evaluator.mockReturnValue(false);
		dbg.onLine(10);
		expect(vm.vmStop).not.toHaveBeenCalledWith("debug", 70);
	});

	it('should increment hit count', () => {
		dbg.resume();
		const bp = dbg.addBreakpoint(10);

		dbg.onLine(10);
		expect(bp.hitCount).toBe(1);

		dbg.resume(); // resumes and sets skipBreakpoint to currentLine if paused.
		// Wait, resume sets skipBreakpoint to currentLine if paused.
		// So calling onLine(10) immediately again should NOT trigger.

		dbg.onLine(10);
		expect(bp.hitCount).toBe(1); // Should still be 1 (skipped)

		// Move to another line
		dbg.onLine(20);

		// Move back to 10
		dbg.onLine(10);
		expect(bp.hitCount).toBe(2);
	});
});
