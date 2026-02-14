
import { vi } from "vitest";
import { CpcVm } from "../../src/CpcVm";
import { Debugger } from "../../src/Debugger";
import { DebugEvent, DebugListener } from "../../src/DebuggerTypes";
import { BasicLexer } from "../../src/BasicLexer";
import { BasicParser } from "../../src/BasicParser";
import { CodeGeneratorJs } from "../../src/CodeGeneratorJs";
import { Variables } from "../../src/Variables";

export function createMockVm(): CpcVm {
	return {
		vmStop: vi.fn(),
		vmGetGosubStack: vi.fn().mockReturnValue([]),
		vmGetAllVariables: vi.fn().mockReturnValue({}),
		vmSetDebugger: vi.fn(),
		vmOnError: vi.fn(),
		vmDebugHook: vi.fn(),
		line: 0,
		variables: new Variables(),
		// Add other necessary properties mocked as needed
	} as unknown as CpcVm;
}

export function createDebugger(mockVm: CpcVm): Debugger {
	return new Debugger(mockVm);
}

export function collectEvents(dbg: Debugger): { events: DebugEvent[], listener: DebugListener } {
	const events: DebugEvent[] = [];
	const listener: DebugListener = (event) => {
		events.push(event);
	};
	dbg.on(listener);
	return { events, listener };
}

export function compileBasic(source: string, debug: boolean = false): string {
	const parser = new BasicParser();
	const lexer = new BasicLexer({ keywords: parser.getKeywords() });
	const codegen = new CodeGeneratorJs({
		lexer,
		parser,
		debug,
		implicitLines: true
	});

	const variables = new Variables();
	const output = codegen.generate(source, variables);

	if (output.error) {
		throw output.error;
	}
	return output.text;
}
