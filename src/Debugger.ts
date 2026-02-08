import { CpcVm } from "./CpcVm";
import { Breakpoint, DebugEvent, DebugEventType, DebugListener, DebugSnapshot, DebugState, StepMode } from "./DebuggerTypes";

export class Debugger {
	private readonly vm: CpcVm;
	private state: DebugState = "idle";
	private readonly breakpoints: Map<number, Breakpoint> = new Map();
	private speed = 100;
	private breakOnError = false;
	private stepMode: StepMode | null = null;
	private stepDepth = 0;
	private skipBreakpoint: number | null = null;
	private currentLine: number | string = 0;
	private listeners: DebugListener[] = [];

	constructor(vm: CpcVm) {
		this.vm = vm;
	}

	// State Management

	private setState(newState: DebugState) {
		if (this.state !== newState) {
			this.state = newState;
			this.emit({
				type: "stateChange",
				snapshot: this.getSnapshot()
			});
		}
	}

	// Execution Control

	pause(): void {
		this.setState("paused");
		this.vm.vmStop("debug", 70); // Request pause
		this.emit({
			type: "paused",
			snapshot: this.getSnapshot()
		});
	}

	resume(): void {
		if (this.state === "paused" && typeof this.currentLine === "number") {
			this.skipBreakpoint = this.currentLine;
		}
		this.setState("running");
		this.stepMode = null;
		this.emit({
			type: "resumed",
			snapshot: this.getSnapshot()
		});
	}

	stepInto(): void {
		this.setState("stepping");
		this.stepMode = "into";
		this.stepDepth = this.vm.vmGetGosubStack().length;
		this.vm.vmStop("", 0, true); // Ensure loop continues if stopped
	}

	stepOver(): void {
		this.setState("stepping");
		this.stepMode = "over";
		this.stepDepth = this.vm.vmGetGosubStack().length;
		this.vm.vmStop("", 0, true);
	}

	stepOut(): void {
		this.setState("stepping");
		this.stepMode = "out";
		this.stepDepth = this.vm.vmGetGosubStack().length;
		this.vm.vmStop("", 0, true);
	}

	reset(): void {
		this.setState("idle");
		this.stepMode = null;
		this.stepDepth = 0;
	}

	setSpeed(speed: number): void {
		this.speed = Math.max(0, Math.min(100, speed));
	}

	// Breakpoints

	addBreakpoint(line: number, condition?: string): Breakpoint {
		const bp: Breakpoint = {
			id: Date.now() + Math.random(),
			line,
			enabled: true,
			condition,
			hitCount: 0
		};
		this.breakpoints.set(line, bp);
		return bp;
	}

	removeBreakpoint(line: number): void {
		this.breakpoints.delete(line);
	}

	toggleBreakpoint(line: number): Breakpoint | undefined {
		const bp = this.breakpoints.get(line);
		if (bp) {
			bp.enabled = !bp.enabled;
			return bp;
		}
		return this.addBreakpoint(line);
	}

	getBreakpoints(): Breakpoint[] {
		return Array.from(this.breakpoints.values());
	}

	clearBreakpoints(): void {
		this.breakpoints.clear();
	}

	// Inspection

	getSnapshot(): DebugSnapshot {
		return {
			line: this.currentLine,
			state: this.state,
			gosubStack: [...this.vm.vmGetGosubStack()],
			variables: this.vm.vmGetAllVariables(),
			error: undefined // TODO: Get error from VM
		};
	}

	getCallStack(): (number | string)[] {
		return [...this.vm.vmGetGosubStack()];
	}

	getVariables(): Record<string, any> {
		return this.vm.vmGetAllVariables();
	}

	// Events

	on(listener: DebugListener): void {
		this.listeners.push(listener);
	}

	off(listener: DebugListener): void {
		this.listeners = this.listeners.filter(l => l !== listener);
	}

	private emit(event: DebugEvent) {
		this.listeners.forEach(l => l(event));
	}

	// Core Hook

	onLine(line: number | string): void {
		this.currentLine = line;

		if (this.state === "idle") {
			return;
		}

		let shouldPause = false;
		let hitBreakpoint: Breakpoint | undefined;

		// 1. Check breakpoints
		if (typeof line === "number") {
			if (this.skipBreakpoint !== null && this.skipBreakpoint !== line) {
				this.skipBreakpoint = null;
			}

			const bp = this.breakpoints.get(line);
			if (bp && bp.enabled) {
				if (this.skipBreakpoint === line) {
					this.skipBreakpoint = null;
				} else {
					// TODO: Condition check
					shouldPause = true;
					hitBreakpoint = bp;
					bp.hitCount = (bp.hitCount || 0) + 1;
				}
			}
		}

		// 2. Check stepping
		if (!shouldPause && this.state === "stepping") {
			const currentDepth = this.vm.vmGetGosubStack().length;
			if (this.stepMode === "into") {
				shouldPause = true;
			} else if (this.stepMode === "over") {
				if (currentDepth <= this.stepDepth) {
					shouldPause = true;
				}
			} else if (this.stepMode === "out") {
				if (currentDepth < this.stepDepth) {
					shouldPause = true;
				}
			}
		}

		if (shouldPause) {
			this.setState("paused");
			this.vm.vmStop("debug", 70); // Force stop with high priority
			this.emit({
				type: hitBreakpoint ? "breakpoint" : "step",
				snapshot: this.getSnapshot(),
				breakpoint: hitBreakpoint
			});
		} else {
			// Throttle if speed < 100
			if (this.speed < 100) {
				// Simple delay logic or request VM to wait
				// For now, just continue
			}
		}
	}
}
