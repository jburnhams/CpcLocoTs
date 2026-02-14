
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Debugger } from "../../src/Debugger";
import { CpcVm } from "../../src/CpcVm";

describe("Debugger Stepping", () => {
	let debuggerInstance: Debugger;
	let mockVm: CpcVm;

	beforeEach(() => {
		mockVm = {
			vmStop: vi.fn(),
			vmGetGosubStack: vi.fn().mockReturnValue([]),
			vmGetAllVariables: vi.fn().mockReturnValue({}),
			vmSetDebugger: vi.fn(),
			vmOnError: vi.fn(),
		} as unknown as CpcVm;

		debuggerInstance = new Debugger(mockVm);
	});

	it("stepInto should pause on next line", () => {
		debuggerInstance.stepInto();
		debuggerInstance.onLine(10);
		expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
	});

	it("stepOver should pause on next line if stack depth is same", () => {
		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10]);
		debuggerInstance.stepOver();
		debuggerInstance.onLine(10);
		expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
	});

	it("stepOver should not pause if stack depth increased", () => {
		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10]);
		debuggerInstance.stepOver(); // Depth 1

		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10, 20]); // Depth 2
		(mockVm.vmStop as any).mockClear();
		debuggerInstance.onLine(10);
		expect(mockVm.vmStop).not.toHaveBeenCalled();
	});

	it("stepOver should pause when stack depth returns to original", () => {
		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10]);
		debuggerInstance.stepOver(); // Depth 1

		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10, 20]); // Depth 2
		debuggerInstance.onLine(10);

		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10]); // Depth 1
		debuggerInstance.onLine(20);
		expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
	});

	it("stepOut should pause when stack depth decreases", () => {
		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10, 20]); // Depth 2
		debuggerInstance.stepOut();
		(mockVm.vmStop as any).mockClear();

		debuggerInstance.onLine(10);
		expect(mockVm.vmStop).not.toHaveBeenCalled();

		vi.spyOn(mockVm, "vmGetGosubStack").mockReturnValue([10]); // Depth 1
		debuggerInstance.onLine(20);
		expect(mockVm.vmStop).toHaveBeenCalledWith("debug", 70);
	});
});
