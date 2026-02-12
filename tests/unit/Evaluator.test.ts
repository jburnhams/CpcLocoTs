
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BasicLexer } from "../../src/BasicLexer";
import { BasicParser } from "../../src/BasicParser";
import { Evaluator } from "../../src/Evaluator";
import { Variables } from "../../src/Variables";
import { CpcVm } from "../../src/CpcVm";

describe("Evaluator", () => {
	let evaluator: Evaluator;
	let variables: Variables;
	let vm: CpcVm;

	beforeEach(() => {
		const parser = new BasicParser({});
		const lexer = new BasicLexer({ keywords: parser.getKeywords() });
		evaluator = new Evaluator(lexer, parser);
		variables = new Variables({});

		// Mock CpcVm methods used by generated code
		vm = {
			vmGetAllVariables: () => variables.getAllVariables(),
			vmAssign: (type: string, val: any) => {
                if (type === "I") return Math.round(Number(val));
                if (type === "R") return Number(val);
                return val;
            },
			vmRound: (val: any) => Math.round(Number(val)),
			vmAssertNumber: () => {},
            // Add other methods if needed
            print: vi.fn(),
		} as unknown as CpcVm;
	});

	test("evaluate: simple arithmetic", () => {
		const result = evaluator.evaluate("1+2", variables, vm);
		expect(result.error).toBeUndefined();
		expect(result.value).toBe(3);
	});

	test("evaluate: string expression", () => {
		const result = evaluator.evaluate('"hello"+" world"', variables, vm);
		expect(result.value).toBe("hello world");
	});

	test("evaluate: variable access", () => {
		variables.setVariable("aR", 10); // CodeGeneratorJs uses 'aR'
		const result = evaluator.evaluate("a*2", variables, vm);
		expect(result.value).toBe(20);
	});

	test("evaluate: syntax error", () => {
		const result = evaluator.evaluate("1+", variables, vm);
		expect(result.error).toBeDefined();
	});

	test("execute: simple assignment", () => {
		const result = evaluator.execute("let x=42", variables, vm);
		expect(result.error).toBeUndefined();
		expect(variables.getVariable("xR")).toBe(42); // CodeGeneratorJs uses 'xR'
	});

	test("execute: forbidden command", () => {
		const result = evaluator.execute("goto 10", variables, vm);
		expect(result.error).toContain("Command not allowed");
	});

    test("execute: forbidden command case insensitive", () => {
		const result = evaluator.execute("RUN", variables, vm);
		expect(result.error).toContain("Command not allowed");
	});

    test("execute: allowed command", () => {
        // print generates o.print call.
        const result = evaluator.execute('print "hello"', variables, vm);
        expect(result.error).toBeUndefined();
        expect(vm.print).toHaveBeenCalled();
    });
});
