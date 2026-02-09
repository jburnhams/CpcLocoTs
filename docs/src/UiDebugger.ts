import { Breakpoint, Controller, DebugEvent, DebugState, View, ViewID } from "cpclocots";

export class UiDebugger {
	private readonly controller: Controller;
	private readonly view: View;

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
		const addBpBtn = View.getElementById1(ViewID.debugAddBreakpointButton);

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

		if (event.type === "step" || event.type === "paused" || event.type === "breakpoint") {
			this.updateLineHighlight(event.breakpoint);
			this.updateCallStack();
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

	public updateVisibility() {
		const debugModeInput = View.getElementById1(ViewID.debugModeInput) as HTMLInputElement;
		const debugArea = View.getElementById1(ViewID.debugArea);

		if (debugModeInput.checked) {
			debugArea.classList.remove("displayNone");
		} else {
			debugArea.classList.add("displayNone");
		}
	}
}
