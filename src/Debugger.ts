import { CpcVm } from "./CpcVm";
import { Breakpoint, BreakpointState, DebugEvent, DebugEventType, DebugListener, DebugSnapshot, DebugState, StepMode, SpeedConfig, LineRange, StackFrame, ErrorInfo } from "./DebuggerTypes";
import { CustomError } from "./Utils";
import { Evaluator, EvalResult } from "./Evaluator";

export type ConditionEvaluator = (condition: string) => boolean;

export class Debugger {
	private readonly vm: CpcVm;
	private state: DebugState = "idle";
	private readonly breakpoints: Map<number, Breakpoint> = new Map();
	private speed = 100;
	private breakOnError = false;
	private lastError: ErrorInfo | null = null;
	private stepMode: StepMode | null = null;
	private stepDepth = 0;
	private skipBreakpoint: number | null = null;
	private skipErrorLine: number | string | null = null;
	private skipStepCheck = false;
	private currentLine: number | string = 0;
	private listeners: DebugListener[] = [];

	private lineCounter = 0;
	private speedConfig: SpeedConfig = { linesPerChunk: Infinity, delayMs: 0 };
	public nextDelay = 0;
	private sourceMap: Record<string, number[]> = {};
	private conditionEvaluator?: ConditionEvaluator;
	private evaluator?: Evaluator;

	constructor(vm: CpcVm, evaluator?: Evaluator) {
		this.vm = vm;
		this.evaluator = evaluator;
		this.vm.vmOnError(this.handleError.bind(this));
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

	setEvaluator(evaluator: Evaluator): void {
		this.evaluator = evaluator;
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
		if (this.lastError) {
			this.skipErrorLine = this.lastError.line;
			this.lastError = null;
		}
		if (this.state === "paused" && typeof this.currentLine === "number") {
			this.skipBreakpoint = this.currentLine;
		}
		this.setState("running");
		this.stepMode = null;
		this.vm.vmStop("", 0, true); // Clear stop reason
		this.emit({
			type: "resumed",
			snapshot: this.getSnapshot()
		});
	}

	private prepareStep(): void {
		if (this.state === "paused" && typeof this.currentLine === "number") {
			this.skipBreakpoint = this.currentLine;
			this.skipStepCheck = true;
		}
		this.setState("stepping");
		this.vm.vmStop("", 0, true);
	}

	stepInto(): void {
		this.prepareStep();
		this.stepMode = "into";
		this.stepDepth = this.vm.vmGetGosubStack().length;
	}

	stepOver(): void {
		this.prepareStep();
		this.stepMode = "over";
		this.stepDepth = this.vm.vmGetGosubStack().length;
	}

	stepOut(): void {
		this.prepareStep();
		this.stepMode = "out";
		this.stepDepth = this.vm.vmGetGosubStack().length;
	}

	reset(): void {
		this.setState("idle");
		this.stepMode = null;
		this.stepDepth = 0;
	}

	dispose(): void {
		this.vm.vmOnError(undefined);
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

	setBreakOnError(enabled: boolean): void {
		this.breakOnError = enabled;
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

	// Persistence

	exportBreakpoints(): BreakpointState {
		const breakpoints = Array.from(this.breakpoints.values()).map(bp => ({
			line: bp.line,
			enabled: bp.enabled,
			condition: bp.condition
		}));
		return { breakpoints };
	}

	importBreakpoints(state: BreakpointState): void {
		this.clearBreakpoints();
		if (state && state.breakpoints) {
			state.breakpoints.forEach(bp => {
				this.addBreakpoint(bp.line, bp.condition);
				const newBp = this.breakpoints.get(bp.line);
				if (newBp) {
					newBp.enabled = bp.enabled;
				}
			});
		}
	}

	// Inspection

	getSnapshot(): DebugSnapshot {
		return {
			line: this.currentLine,
			state: this.state,
			gosubStack: [...this.vm.vmGetGosubStack()],
			variables: this.vm.vmGetAllVariables(),
			error: this.lastError || undefined
		};
	}

	getCallStack(): StackFrame[] {
		const stack = this.vm.vmGetGosubStack();
		const frames: StackFrame[] = [];

		// Current line is the active frame
		frames.push({
			returnLabel: this.currentLine,
			depth: stack.length
		});

		// Add stack frames in reverse order (most recent caller first)
		for (let i = stack.length - 1; i >= 0; i--) {
			frames.push({
				returnLabel: stack[i],
				depth: i
			});
		}

		return frames;
	}

	getVariables(): Record<string, any> {
		return this.vm.vmGetAllVariables();
	}

	setSourceMap(map: Record<string, number[]>): void {
		this.sourceMap = map;
	}

	getLineRange(line: number | string): LineRange | null {
		const entry = this.sourceMap[String(line)];
		if (entry) {
			return {
				line: line,
				startPos: entry[0],
				endPos: entry[0] + entry[1]
			};
		}
		return null;
	}

	getCurrentLineRange(): LineRange | null {
		return this.getLineRange(this.currentLine);
	}

	// Evaluation / Execution

	eval(expression: string): EvalResult {
		if (!this.evaluator) {
			return { error: "No evaluator attached" };
		}
		if (this.state !== "paused") {
			return { error: "Must be paused to evaluate" };
		}
		return this.evaluator.evaluate(expression, this.vm.variables, this.vm);
	}

	exec(statement: string): EvalResult {
		if (!this.evaluator) {
			return { error: "No evaluator attached" };
		}
		if (this.state !== "paused") {
			return { error: "Must be paused to execute" };
		}
		return this.evaluator.execute(statement, this.vm.variables, this.vm);
	}

	getMemoryRange(start: number, length: number): number[] {
		const data: number[] = [];
		for (let i = 0; i < length; i++) {
			data.push(this.vm.peek(start + i));
		}
		return data;
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

	private handleError(err: CustomError): boolean {
		if (!this.breakOnError) {
			return false;
		}

		const errorLine = err.line || this.currentLine;

		if (this.skipErrorLine !== null && this.skipErrorLine === errorLine) {
			this.skipErrorLine = null;
			return false;
		}

		this.lastError = {
			code: err.errCode !== undefined ? err.errCode : -1,
			message: err.message,
			line: errorLine,
			info: String(err.value || ""),
			pos: err.pos,
			len: err.len
		};

		this.setState("paused");
		this.emit({
			type: "error",
			snapshot: this.getSnapshot()
		});

		return true;
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

		if (this.skipErrorLine !== null && this.skipErrorLine !== line) {
			this.skipErrorLine = null;
		}

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
			if (this.skipStepCheck) {
				this.skipStepCheck = false;
			} else {
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
