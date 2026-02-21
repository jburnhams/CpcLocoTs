
import { describe, it, expect } from "vitest";
import { CodeGeneratorJs } from "../../src/CodeGeneratorJs";
import { BasicLexer } from "../../src/BasicLexer";
import { BasicParser } from "../../src/BasicParser";
import { Variables } from "../../src/Variables";

describe("CodeGeneratorJs Debug", () => {
	const parser = new BasicParser();
	const lexer = new BasicLexer({ keywords: parser.getKeywords() });
	const variables = new Variables();

	it("should emit vmDebugHook when debug is enabled", () => {
		const codegen = new CodeGeneratorJs({
			lexer,
			parser,
			debug: true
		});

		const output = codegen.generate("10 PRINT \"A\"", variables);
		expect(output.text).toContain("o.vmDebugHook()");
	});

	it("should emit vmTrace when trace is enabled and debug is disabled", () => {
		const codegen = new CodeGeneratorJs({
			lexer,
			parser,
			debug: false,
			trace: true
		});

		const output = codegen.generate("10 PRINT \"A\"", variables);
		expect(output.text).toContain("o.vmTrace()");
		expect(output.text).not.toContain("o.vmDebugHook()");
	});

	it("should emit vmDebugHook when both debug and trace are enabled", () => {
		const codegen = new CodeGeneratorJs({
			lexer,
			parser,
			debug: true,
			trace: true
		});

		const output = codegen.generate("10 PRINT \"A\"", variables);
		expect(output.text).toContain("o.vmDebugHook()");
		// vmDebugHook handles trace internally if tronFlag is set
	});

	it("should emit neither when both are disabled", () => {
		const codegen = new CodeGeneratorJs({
			lexer,
			parser,
			debug: false,
			trace: false
		});

		const output = codegen.generate("10 PRINT \"A\"", variables);
		expect(output.text).not.toContain("o.vmDebugHook()");
		expect(output.text).not.toContain("o.vmTrace()");
	});

	it("should include GOSUB return labels in sourceMap when debug is enabled", () => {
		const codegen = new CodeGeneratorJs({
			lexer,
			parser,
			debug: true
		});

		const output = codegen.generate("10 GOSUB 100\n100 RETURN", variables);
		const map = codegen.getSourceMap();

		// The label should be 10g0
		expect(map).toHaveProperty("10g0");
		const range = map["10g0"];
		expect(range).toBeDefined();
		// 10 GOSUB 100
		expect(range[0]).toBeGreaterThan(0); // pos
		expect(range[1]).toBe(5); // len of GOSUB
	});
});
