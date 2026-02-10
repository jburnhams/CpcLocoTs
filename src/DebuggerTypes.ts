export type DebugState = "idle" | "running" | "paused" | "stepping";

export type StepMode = "into" | "over" | "out";

export interface StackFrame {
	returnLabel: number | string;   // where RETURN will go
	depth: number;                  // 0-based index in stack
}

export interface Breakpoint {
	id: number;
	line: number;                  // BASIC line number
	enabled: boolean;
	condition?: string;            // optional BASIC expression, e.g. "x%>10"
	hitCount?: number;             // how many times hit so far
}

export interface DebugSnapshot {
	line: number | string;         // current BASIC line
	state: DebugState;
	gosubStack: (number | string)[];  // copy of CpcVm.gosubStack
	variables: Record<string, any>;   // snapshot from Variables.getAllVariables()
	error?: { code: number; message: string; line: number | string };
}

export type DebugEventType =
	| "paused"       // execution paused (breakpoint, step, manual)
	| "resumed"      // execution continuing
	| "step"         // single step completed
	| "error"        // error/exception occurred
	| "breakpoint"   // breakpoint hit
	| "stateChange"; // DebugState changed

export interface DebugEvent {
	type: DebugEventType;
	snapshot: DebugSnapshot;
	breakpoint?: Breakpoint;       // set when type === "breakpoint"
}

export type DebugListener = (event: DebugEvent) => void;

export interface SpeedConfig {
	linesPerChunk: number;   // how many lines to run before yielding
	delayMs: number;         // setTimeout delay between chunks
}

export interface LineRange {
	line: number | string;       // BASIC line number/label
	startPos: number;            // character offset in source
	endPos: number;              // character offset in source
}

export interface BreakpointState {
	breakpoints: { line: number; enabled: boolean; condition?: string }[];
}
