
import { BasicLexer } from "./BasicLexer";
import { BasicParser } from "./BasicParser";
import { CodeGeneratorJs } from "./CodeGeneratorJs";
import { CpcVm } from "./CpcVm";
import { Variables } from "./Variables";

export interface EvalResult {
	value?: any;
	error?: string;
}

export class Evaluator {
	private readonly codeGenerator: CodeGeneratorJs;

	constructor(lexer: BasicLexer, parser: BasicParser) {
		this.codeGenerator = new CodeGeneratorJs({
			lexer: lexer,
			parser: parser,
			implicitLines: false,
			noCodeFrame: true,
			quiet: true
		});
	}

	evaluate(expression: string, variables: Variables, vm: CpcVm): EvalResult {
		// Ensure lexer and parser are in the correct state
		const options = this.codeGenerator.getOptions();
		options.lexer.setOptions({
			keepWhiteSpace: false
		});
		options.parser.setOptions({
			keepTokens: false,
			keepBrackets: false,
			keepColons: false,
			keepDataComma: false
		});

		// wrap in assignment to capture result
		// use a variable name that is unlikely to collide
		let tempVar = "eval.result"; // eval.result becomes eval_result in JS
		let input = "1 let " + tempVar + "=(" + expression + ")";

		let output = this.codeGenerator.generate(input, variables);

		if (output.error && (output.error.message.includes("Type error") || output.error.message.includes("Type mismatch"))) {
			tempVar = "eval.result$";
			input = "1 let " + tempVar + "=(" + expression + ")";
			output = this.codeGenerator.generate(input, variables);
		}

		if (output.error) {
			return { error: output.error.message };
		}

		try {
			const code = output.text;
			// The code generated with noCodeFrame usually assumes 'o' and 'v' are available.
			// 'v' is initialized as o.vmGetAllVariables().

			// eslint-disable-next-line no-new-func
			const fn = new Function("o", "v", code);
			const vars = variables.getAllVariables();
			fn(vm, vars);

			// Now find the result variable.
			// CodeGeneratorJs logic:
			// name = name.toLowerCase().replace(/\./g, "_");
			// + type suffix.
			const mangledTempVar = tempVar.toLowerCase().replace(/\./g, "_");
			const keys = Object.keys(vars);
			let resultKey = "";

			for (let i = 0; i < keys.length; i += 1) {
				const key = keys[i];
				if (tempVar.endsWith("$")) {
					if (key === mangledTempVar) {
						resultKey = key;
						break;
					}
				} else {
					// Check for numeric types (R, I)
					if (key === mangledTempVar + "R" || key === mangledTempVar + "I") {
						resultKey = key;
						break;
					}
				}
			}

			let result;
			if (resultKey) {
				result = vars[resultKey];
				// Cleanup
				delete vars[resultKey];
			}

			return { value: result };
		} catch (e) {
			return { error: String(e) };
		}
	}

	execute(statement: string, variables: Variables, vm: CpcVm): EvalResult {
		// block GOTO/GOSUB/RUN/CHAIN/LOAD/MERGE/SAVE/NEW/LIST/EDIT/RENUM
		// Check for forbidden commands at the start of the statement
		if (/^(?:\d+\s+)?\s*(?:goto|gosub|run|chain|list|new|load|merge|save|edit|renum)\b/i.test(statement.trim())) {
			return { error: "Command not allowed in console" };
		}

		// Ensure lexer and parser are in the correct state
		const options = this.codeGenerator.getOptions();
		options.lexer.setOptions({
			keepWhiteSpace: false
		});
		options.parser.setOptions({
			keepTokens: false,
			keepBrackets: false,
			keepColons: false,
			keepDataComma: false
		});

		const input = "1 " + statement;
		const output = this.codeGenerator.generate(input, variables);

		if (output.error) {
			return { error: output.error.message };
		}

		try {
			const code = output.text;
			// eslint-disable-next-line no-new-func
			const fn = new Function("o", "v", code);
			fn(vm, variables.getAllVariables());
			return {}; // Success, no value
		} catch (e) {
			return { error: String(e) };
		}
	}
}
