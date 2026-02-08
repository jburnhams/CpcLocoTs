import { CpcVm } from "./CpcVm";
import { Breakpoint, DebugEvent, DebugEventType, DebugListener, DebugSnapshot, DebugState, StepMode, SpeedConfig, LineRange } from "./DebuggerTypes";

export type ConditionEvaluator = (condition: string) => boolean;

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

	private lineCounter = 0;
	private speedConfig: SpeedConfig = { linesPerChunk: Infinity, delayMs: 0 };
	public nextDelay = 0;
	private sourceMap: Record<string, number[]> = {};
	private conditionEvaluator?: ConditionEvaluator;

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

	setConditionEvaluator(evaluator: ConditionEvaluator): void {
		this.conditionEvaluator = evaluator;
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
		if (this.speed === 100) {
			this.speedConfig = { linesPerChunk: Infinity, delayMs: 0 };
		} else if (this.speed === 0) {
			this.speedConfig = { linesPerChunk: 1, delayMs: 0 }; // effectively paused
		} else {
			// Map 1-99 to delay and chunk size
			// Slower speed -> higher delay, smaller chunk
			// Faster speed -> lower delay, larger chunk
			// Example:
			// 50 -> delay 100ms, lines 11
			// 99 -> delay 2ms, lines 20
			// 1 -> delay 198ms, lines 1
			const delay = Math.floor((100 - this.speed) * 2); // 2ms to 198ms
			const lines = Math.floor(this.speed / 5) + 1; // 1 to 20 lines
			this.speedConfig = {
				linesPerChunk: lines,
				delayMs: delay
			};
		}
	}

	getSpeed(): number {
		return this.speed;
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

	setSourceMap(map: Record<string, number[]>): void {
		this.sourceMap = map;
	}

	getCurrentLineRange(): LineRange | null {
		const entry = this.sourceMap[String(this.currentLine)];
		if (entry) {
			return {
				line: this.currentLine,
				startPos: entry[0],
				endPos: entry[0] + entry[1]
			};
		}
		return null;
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
		this.nextDelay = 0; // Reset delay

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
					let conditionMet = true;
					if (bp.condition && this.conditionEvaluator) {
						try {
							conditionMet = this.conditionEvaluator(bp.condition);
						} catch (e) {
							console.warn("Condition evaluation error:", e);
							conditionMet = false; // Treat error as false
						}
					}

					if (conditionMet) {
						shouldPause = true;
						hitBreakpoint = bp;
						bp.hitCount = (bp.hitCount || 0) + 1;
					}
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

		// 3. Check speed throttle
		if (!shouldPause && this.speed < 100) {
			if (this.speed === 0) {
				shouldPause = true; // Paused
			} else {
				this.lineCounter += 1;
				if (this.lineCounter >= this.speedConfig.linesPerChunk) {
					this.lineCounter = 0;
					this.nextDelay = this.speedConfig.delayMs;

					// Throttle pause
					this.vm.vmStop("debug", 70);
					// Emit step event to update UI (highlight)
					this.emit({
						type: "step",
						snapshot: this.getSnapshot()
					});
					return; // Return, do not set state to paused
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
		}
	}
}
