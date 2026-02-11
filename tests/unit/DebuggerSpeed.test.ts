import { describe, it, expect, vi, beforeEach } from "vitest";
import { Debugger } from "../../src/Debugger";
import { CpcVm } from "../../src/CpcVm";

describe("Debugger Speed Control", () => {
	let mockVm: CpcVm;
	let debuggerInstance: Debugger;

	beforeEach(() => {
		mockVm = {
			vmStop: vi.fn(),
			vmGetGosubStack: vi.fn().mockReturnValue([]),
			vmGetAllVariables: vi.fn().mockReturnValue({}),
			vmSetDebugger: vi.fn(),
			vmOnError: vi.fn()
		} as unknown as CpcVm;
		debuggerInstance = new Debugger(mockVm);
		debuggerInstance.resume(); // Set state to running
	});

	it("should run full speed when speed is 100", () => {
		debuggerInstance.setSpeed(100);
		debuggerInstance.onLine(10);
		expect(mockVm.vmStop).not.toHaveBeenCalled();
		expect(debuggerInstance.nextDelay).toBe(0);
	});

	it("should throttle when speed is 50", () => {
		debuggerInstance.setSpeed(50);
		// speed 50 -> delay 100ms, lines 11
		const speedConfig = (debuggerInstance as any).speedConfig;
		expect(speedConfig.linesPerChunk).toBe(11);
		expect(speedConfig.delayMs).toBe(100);

		// Execute 10 lines (counter 1 to 10)
		for (let i = 0; i < 10; i++) {
			debuggerInstance.onLine(10 + i);
			expect(mockVm.vmStop).not.toHaveBeenCalled();
		}

		// Execute 11th line
		debuggerInstance.onLine(20);
		expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
		expect(debuggerInstance.nextDelay).toBe(100);
	});

	it("should pause when speed is 0", () => {
		debuggerInstance.setSpeed(0);
		const speedConfig = (debuggerInstance as any).speedConfig;
		expect(speedConfig.linesPerChunk).toBe(1); // Effectively paused

		debuggerInstance.onLine(10);
		expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
	});
});
