export type DebugState = "idle" | "running" | "paused" | "stepping";

export type StepMode = "into" | "over" | "out";

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
