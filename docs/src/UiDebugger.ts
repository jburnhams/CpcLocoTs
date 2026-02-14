import { Breakpoint, Controller, DebugEvent, DebugState, ErrorInfo, SelectOptionElement, View, ViewID } from "cpclocots";

export class UiDebugger {
	private readonly controller: Controller;
	private readonly view: View;
	private previousVariables: Record<string, any> = {};

	constructor(controller: Controller, view: View) {
		this.controller = controller;
		this.view = view;
		this.init();
	}

	private init() {
		// Wire up buttons
		const pauseBtn = View.getElementById1(ViewID.debugPauseButton);
		const resumeBtn = View.getElementById1(ViewID.debugResumeButton);
		const stepBtn = View.getElementById1(ViewID.debugStepIntoButton);
		const stepOverBtn = View.getElementById1(ViewID.debugStepOverButton);
		const stepOutBtn = View.getElementById1(ViewID.debugStepOutButton);
		const speedInput = View.getElementById1(ViewID.debugSpeedInput) as HTMLInputElement;
		const debugModeInput = View.getElementById1(ViewID.debugModeInput) as HTMLInputElement;
		const breakOnErrorInput = View.getElementById1(ViewID.debugBreakOnErrorInput) as HTMLInputElement;
		const addBpBtn = View.getElementById1(ViewID.debugAddBreakpointButton);
		const consoleRunBtn = View.getElementById1(ViewID.debugConsoleRunButton);
		const consoleClearBtn = View.getElementById1(ViewID.debugConsoleClearButton);
		const consoleInput = View.getElementById1(ViewID.debugConsoleInput) as HTMLInputElement;
		const memoryRefreshBtn = View.getElementById1(ViewID.debugMemoryRefreshButton);
		const memoryAddrInput = View.getElementById1(ViewID.debugMemoryAddrInput) as HTMLInputElement;

		pauseBtn.addEventListener("click", () => this.controller.getDebugger().pause());
		resumeBtn.addEventListener("click", () => this.controller.getDebugger().resume());
		stepBtn.addEventListener("click", () => this.controller.getDebugger().stepInto());
		stepOverBtn.addEventListener("click", () => this.controller.getDebugger().stepOver());
		stepOutBtn.addEventListener("click", () => this.controller.getDebugger().stepOut());
		addBpBtn.addEventListener("click", () => this.addBreakpointFromInput());

		speedInput.addEventListener("input", () => {
			const speed = Number(speedInput.value);
			this.controller.getDebugger().setSpeed(speed);
		});

		debugModeInput.addEventListener("change", () => {
			this.updateVisibility();
			// We assume UiEventHandler or UiController handles the actual property update and fnDebugMode call
		});

		breakOnErrorInput.addEventListener("change", () => {
			this.controller.getDebugger().setBreakOnError(breakOnErrorInput.checked);
		});

		consoleRunBtn.addEventListener("click", () => this.evalConsoleInput());
		consoleClearBtn.addEventListener("click", () => this.clearConsoleLog());
		consoleInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.evalConsoleInput();
			}
		});

		memoryRefreshBtn.addEventListener("click", () => this.refreshMemoryDump());
		memoryAddrInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.refreshMemoryDump();
			}
		});

		document.addEventListener("keydown", this.onKeyDown.bind(this));

		this.controller.getDebugger().on(this.onDebugEvent.bind(this));

		// Initial state
		this.updateVisibility();
		this.updateControls("idle");
		this.updateBreakpointList();
	}

	private addBreakpointFromInput() {
		const input = View.getElementById1(ViewID.debugBreakpointInput) as HTMLInputElement;
		// Format: "line" or "line if condition"
		const value = input.value.trim();
		let line = 0;
		let condition: string | undefined;

		const match = value.match(/^(\d+)(?:\s+(?:if\s+)?(.+))?$/i);
		if (match) {
			line = parseInt(match[1], 10);
			if (match[2]) {
				condition = match[2];
			}
		}

		if (!isNaN(line) && line > 0) {
			this.controller.getDebugger().addBreakpoint(line, condition);
			input.value = "";
			this.updateBreakpointList();
		}
	}

	private updateBreakpointList() {
		const list = View.getElementById1(ViewID.debugBreakpointList);
		list.innerHTML = "";
		const breakpoints = this.controller.getDebugger().getBreakpoints();

		// Sort by line number
		breakpoints.sort((a, b) => a.line - b.line);

		breakpoints.forEach(bp => {
			const div = document.createElement("div");
			// div.className = "debug-bp-item";

			const toggleCb = document.createElement("input");
			toggleCb.type = "checkbox";
			toggleCb.checked = bp.enabled;
			toggleCb.title = "Enable/Disable";
			toggleCb.addEventListener("change", () => {
				this.controller.getDebugger().toggleBreakpoint(bp.line);
			});

			const span = document.createElement("span");
			span.textContent = " " + bp.line + (bp.condition ? " if " + bp.condition : "") + " ";
			if (bp.hitCount && bp.hitCount > 0) {
				span.textContent += "(" + bp.hitCount + ") ";
			}

			const btn = document.createElement("button");
			btn.textContent = "x";
			btn.title = "Remove breakpoint";
			btn.addEventListener("click", () => {
				this.controller.getDebugger().removeBreakpoint(bp.line);
				this.updateBreakpointList();
			});

			div.appendChild(toggleCb);
			div.appendChild(span);
			div.appendChild(btn);
			list.appendChild(div);
		});
	}

	private onDebugEvent(event: DebugEvent) {
		if (event.type === "stateChange" || event.type === "paused" || event.type === "resumed") {
			this.updateControls(event.snapshot.state);
		}

		if (event.type === "step" || event.type === "paused" || event.type === "breakpoint" || event.type === "error") {
			this.updateLineHighlight(event.breakpoint);
			this.updateCallStack();
			this.updateErrorDisplay(event.snapshot.error);
			this.refreshVariables(event.snapshot.variables);
		} else {
			this.updateErrorDisplay(undefined);
		}

		if (event.type === "breakpoint") {
			this.updateBreakpointList(); // update hit count
		}
	}

	private updateControls(state: DebugState) {
		const pauseBtn = View.getElementById1(ViewID.debugPauseButton) as HTMLButtonElement;
		const resumeBtn = View.getElementById1(ViewID.debugResumeButton) as HTMLButtonElement;
		const stepBtn = View.getElementById1(ViewID.debugStepIntoButton) as HTMLButtonElement;
		const stepOverBtn = View.getElementById1(ViewID.debugStepOverButton) as HTMLButtonElement;
		const stepOutBtn = View.getElementById1(ViewID.debugStepOutButton) as HTMLButtonElement;

		if (state === "running") {
			pauseBtn.disabled = false;
			resumeBtn.disabled = true;
			stepBtn.disabled = true;
			stepOverBtn.disabled = true;
			stepOutBtn.disabled = true;
		} else if (state === "paused" || state === "stepping") {
			pauseBtn.disabled = true;
			resumeBtn.disabled = false;
			stepBtn.disabled = false;
			stepOverBtn.disabled = false;
			stepOutBtn.disabled = false;
		} else { // idle
			pauseBtn.disabled = true;
			resumeBtn.disabled = true;
			stepBtn.disabled = true;
			stepOverBtn.disabled = true;
			stepOutBtn.disabled = true;
		}
	}

	private updateCallStack() {
		const list = View.getElementById1(ViewID.debugCallStackList);
		list.innerHTML = "";
		const stack = this.controller.getDebugger().getCallStack();

		stack.forEach((frame, index) => {
			const li = document.createElement("li");
			let text = "";
			if (index === 0) {
				text += "Line " + frame.returnLabel + " (current)";
			} else {
				text += "return to line " + frame.returnLabel;
			}
			li.textContent = text;
			list.appendChild(li);
		});
	}

	private updateLineHighlight(hitBp?: Breakpoint) {
		const range = this.controller.getDebugger().getCurrentLineRange();
		const label = View.getElementById1(ViewID.debugLineLabel);

		if (range) {
			let text = "Line: " + range.line;
			if (hitBp) {
				text += " (Breakpoint)";
			}
			label.textContent = text;
			this.view.setAreaSelection(ViewID.inputText, range.startPos, range.endPos);
		} else {
			label.textContent = "Line: -";
		}
	}

	private updateErrorDisplay(error: ErrorInfo | undefined) {
		const div = View.getElementById1(ViewID.debugErrorInfo);
		const span = View.getElementById1(ViewID.debugErrorText);

		if (error) {
			div.classList.remove("displayNone");
			span.textContent = error.message + " (" + error.code + ")" + (error.info ? ": " + error.info : "");

			// Also update line label if we have error info
			const label = View.getElementById1(ViewID.debugLineLabel);
			label.textContent = "Error at line " + error.line;
		} else {
			div.classList.add("displayNone");
			span.textContent = "";
		}
	}

	private evalConsoleInput() {
		const input = View.getElementById1(ViewID.debugConsoleInput) as HTMLInputElement;
		const text = input.value.trim();
		if (!text) {
			return;
		}

		// Try eval first
		let result = this.controller.getDebugger().eval(text);
		let output = "";

		if (result.error) {
			// If eval failed, maybe it is a statement?
			const execResult = this.controller.getDebugger().exec(text);
			if (execResult.error) {
				// If both fail, show eval error unless it looks like a statement
				// Also prioritize specific "Command not allowed" error from exec
				if (execResult.error.includes("Command not allowed") || /^(?:\d+\s+)?\s*(?:let|print|input|poke|call|cls|mode|border|ink|pen|paper|sound|ent|env|origin|window|move|draw|plot|tag|tagoff|cursor)\b/i.test(text)) {
					output = "Error: " + execResult.error;
				} else {
					output = "Error: " + result.error;
				}
			} else {
				output = "OK";
				this.refreshVariables(this.controller.getDebugger().getVariables());
			}
		} else {
			output = String(result.value);
			if (typeof result.value === "string") {
				output = '"' + output + '"';
			}
		}

		this.appendToConsoleLog(text, output);
		input.value = "";
	}

	private appendToConsoleLog(input: string, result: string) {
		const log = View.getElementById1(ViewID.debugConsoleLog);
		const div = document.createElement("div");
		div.textContent = "> " + input + "\n" + result;
		log.appendChild(div);
		log.scrollTop = log.scrollHeight;
	}

	private clearConsoleLog() {
		const log = View.getElementById1(ViewID.debugConsoleLog);
		log.innerHTML = "";
	}

	private refreshMemoryDump() {
		const input = View.getElementById1(ViewID.debugMemoryAddrInput) as HTMLInputElement;
		let addr = parseInt(input.value, 16);
		if (isNaN(addr)) {
			addr = 0;
		}

		// Ensure 0-65535
		/* eslint-disable no-bitwise */
		addr = addr & 0xffff;

		const data = this.controller.getDebugger().getMemoryRange(addr, 256);
		const dump = View.getElementById1(ViewID.debugMemoryDump);
		dump.textContent = this.formatHexDump(addr, data);
	}

	private formatHexDump(start: number, data: number[]): string {
		let out = "";
		for (let i = 0; i < data.length; i += 16) {
			const rowAddr = (start + i) & 0xffff;
			let hex = "";
			let ascii = "";
			for (let j = 0; j < 16; j++) {
				if (i + j < data.length) {
					const byte = data[i + j];
					hex += byte.toString(16).toUpperCase().padStart(2, "0") + " ";
					ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : ".";
				} else {
					hex += "   ";
					ascii += " ";
				}
			}
			out += rowAddr.toString(16).toUpperCase().padStart(4, "0") + ": " + hex + " " + ascii + "\n";
		}
		/* eslint-enable no-bitwise */
		return out;
	}

	public updateVisibility() {
		const debugModeInput = View.getElementById1(ViewID.debugModeInput) as HTMLInputElement;
		const debugArea = View.getElementById1(ViewID.debugArea);

		if (debugModeInput.checked) {
			debugArea.classList.remove("displayNone");
		} else {
			debugArea.classList.add("displayNone");
		}
	}

	private onKeyDown(event: KeyboardEvent) {
		const debugModeInput = View.getElementById1(ViewID.debugModeInput) as HTMLInputElement;
		if (!debugModeInput.checked) {
			return;
		}

		const dbg = this.controller.getDebugger();
		const state = dbg.getSnapshot().state;

		switch (event.key) {
			case "F5":
				event.preventDefault();
				if (state === "paused" || state === "stepping") {
					dbg.resume();
				} else if (state === "idle") {
					this.controller.startRun();
				}
				break;
			case "F10":
				event.preventDefault();
				if (state === "paused") {
					dbg.stepOver();
				}
				break;
			case "F11":
				event.preventDefault();
				if (state === "paused") {
					if (event.shiftKey) {
						dbg.stepOut();
					} else {
						dbg.stepInto();
					}
				}
				break;
			case "F9":
				event.preventDefault();
				this.toggleBreakpointAtCursor();
				break;
			case "Escape":
				if (state === "running" || state === "stepping") {
					event.preventDefault();
					dbg.pause();
				}
				break;
		}
	}

	private toggleBreakpointAtCursor() {
		const input = View.getElementByIdAs<HTMLTextAreaElement>(ViewID.inputText);
		const cursor = input.selectionStart;
		const text = input.value;
		// Count newlines before cursor
		let lineIndex = 0;
		for (let i = 0; i < cursor && i < text.length; i++) {
			if (text[i] === "\n") {
				lineIndex++;
			}
		}

		// Find line number in that line
		const lines = text.split("\n");
		if (lineIndex < lines.length) {
			const lineContent = lines[lineIndex];
			const match = lineContent.match(/^\s*(\d+)/);
			if (match) {
				const lineNum = parseInt(match[1], 10);
				this.controller.getDebugger().toggleBreakpoint(lineNum);
				this.updateBreakpointList();
			}
		}
	}

	private getChangedVariables(current: Record<string, any>): string[] {
		const changed: string[] = [];
		const allKeys = new Set([...Object.keys(this.previousVariables), ...Object.keys(current)]);

		allKeys.forEach(key => {
			if (this.previousVariables[key] !== current[key]) {
				changed.push(key);
			}
		});
		return changed;
	}

	private refreshVariables(variables: Record<string, any>) {
		const changed = this.getChangedVariables(variables);
		const maxVarLength = 35;
		const varNames = Array.from(new Set([...Object.keys(this.previousVariables), ...Object.keys(variables)])).sort();
		const items: SelectOptionElement[] = [];

		for (let i = 0; i < varNames.length; i += 1) {
			const key = varNames[i];
			const value = variables[key];
			const title = key + "=" + value;

			let strippedTitle = title.substring(0, maxVarLength);

			if (title !== strippedTitle) {
				strippedTitle += " ...";
			}

			if (changed.includes(key)) {
				strippedTitle += " *"; // Indicate change
			}

			const item: SelectOptionElement = {
				value: key,
				text: strippedTitle,
				title: strippedTitle,
				selected: false
			};

			items.push(item);
		}

		this.view.setSelectOptions(ViewID.varSelect, items);

		// If current selection is in changed list, update text area
		const currentSelection = this.view.getSelectValue(ViewID.varSelect);
		// Check if selected variable changed (value update or deletion)
		if (changed.includes(currentSelection)) {
			const val = variables[currentSelection];
			this.view.setAreaValue(ViewID.varText, String(val));
		} else if (currentSelection && variables[currentSelection] !== undefined) {
			// Update text area if variable exists and we just refreshed (to be safe)
			const val = variables[currentSelection];
			this.view.setAreaValue(ViewID.varText, String(val));
		}

		this.previousVariables = { ...variables };
	}
}
