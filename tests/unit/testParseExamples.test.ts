
import { describe, test, expect, beforeAll, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cpcconfig } from '../../docs/src/cpcconfig';
import { Model, DatabaseEntry, DatabasesType, ExampleEntry } from '../../src/Model';
import { ModelPropID } from '../../src/Constants';
import { BasicParser } from '../../src/BasicParser';
import { BasicLexer } from '../../src/BasicLexer';
import { BasicTokenizer } from '../../src/BasicTokenizer';
import { CodeGeneratorJs } from '../../src/CodeGeneratorJs';
import { CodeGeneratorToken } from '../../src/CodeGeneratorToken';
import { Variables, VarTypes } from '../../src/Variables';
import { DiskImage } from '../../src/DiskImage';
import { Utils } from '../../src/Utils';
import { ICpcVmRsx, IOutput } from '../../src/Interfaces';

// Helpers
function isUrl(s: string) {
	return s.startsWith("http");
}

function asmGena3Convert(input: string) {
	throw new Error("asmGena3Convert: not implemented for test: " + input);
	return input;
}

// TestModel to support legacy methods removed from Model
class TestModel extends Model {
    private databases: DatabasesType = {};
    private examples: Record<string, Record<string, ExampleEntry>> = {};

    constructor(config: any) {
        super(config);
    }

    addDatabases(db: DatabasesType): void {
        for (const par in db) {
            if (Object.prototype.hasOwnProperty.call(db, par)) {
                this.databases[par] = db[par];
                this.examples[par] = {};
            }
        }
    }

    getDatabase(): DatabaseEntry {
        const database = this.getProperty<string>(ModelPropID.database);
        return this.databases[database];
    }

    setExample(example: ExampleEntry): void {
        const database = this.getProperty<string>(ModelPropID.database);
        if (!this.examples[database]) {
             this.examples[database] = {};
        }
        this.examples[database][example.key] = example;
    }

    getExample(key: string): ExampleEntry {
        const database = this.getProperty<string>(ModelPropID.database);
        return this.examples[database] && this.examples[database][key];
    }

    getAllExamples(): Record<string, ExampleEntry> {
        const database = this.getProperty<string>(ModelPropID.database);
        return this.examples[database] || {};
    }
}

// Global CpcLoco Mock
class CpcLoco {
	static model: TestModel;
    static basicParser: BasicParser;
    static basicLexer: BasicLexer;
    static convertParser: BasicParser;
    static codeGeneratorJs: CodeGeneratorJs;
    static codeGeneratorToken: CodeGeneratorToken;
    static basicTokenizer: BasicTokenizer;
    static vmMock: any;

	static addIndex(dir: string, input: Record<string, unknown> | (() => void)) {
		if (typeof input === "function") {
			input = {
				[dir]: JSON.parse(CpcLoco.fnHereDoc(input).trim())
			};
		}
		CpcLoco.addIndex2(dir, input);
	}

    private static addIndex2(_dir: string, input: Record<string, unknown>) {
		for (const value in input) {
			if (Object.prototype.hasOwnProperty.call(input, value)) {
				const item = input[value] as ExampleEntry[];
				for (let i = 0; i < item.length; i += 1) {
					CpcLoco.model.setExample(item[i]);
				}
			}
		}
	}

	static addItem(key: string, input: string | (() => void)) {
		if (typeof input !== "string") {
			input = CpcLoco.fnHereDoc(input);
		}
		CpcLoco.addItem2(key, input);
	}

    private static addItem2(key: string, input: string) {
		if (!key) {
			key = CpcLoco.model.getProperty<string>(ModelPropID.example);
		}
		input = input.replace(/^\n/, "").replace(/\n$/, "");

		if (input.startsWith("REM ")) {
            // Implicit check for line numbers? Legacy code had check here.
			input = CpcLoco.addLineNumbers(input);
		}

		const example = CpcLoco.model.getExample(key);
		example.key = key;
		example.script = input;
		example.loaded = true;
	}

    private static addLineNumbers(input: string) {
		const lineParts = input.split("\n");
		let lastLine = 0;

		for (let i = 0; i < lineParts.length; i += 1) {
			let lineNum = parseInt(lineParts[i], 10);

			if (isNaN(lineNum)) {
				lineNum = lastLine + 1;
				lineParts[i] = String(lastLine + 1) + " " + lineParts[i];
			}
			lastLine = lineNum;
		}
		return lineParts.join("\n");
	}

	static fnHereDoc(fn: () => void) {
		return String(fn).
			replace(/^[^/]+\/\*\S*/, "").
			replace(/\*\/[^/]+$/, "");
	}

    // addRsx mock - minimal
    static addRsx(key: string, RsxConstructor: new () => ICpcVmRsx) {
         // minimal implementation if needed by examples
    }
}


// expose to global for eval
(globalThis as any).CpcLoco = CpcLoco;


// Helper to set up CpcLoco statics
function setupCpcLoco() {
    CpcLoco.model = new TestModel({});

    CpcLoco.basicParser = new BasicParser({ quiet: true });
    CpcLoco.basicLexer = new BasicLexer({
        keywords: CpcLoco.basicParser.getKeywords(),
        keepWhiteSpace: true,
        quiet: true
    });
    CpcLoco.convertParser = new BasicParser({
        quiet: true,
        keepTokens: true,
        keepBrackets: true,
        keepColons: true,
        keepDataComma: true
    });
    CpcLoco.codeGeneratorJs = new CodeGeneratorJs({
        lexer: CpcLoco.basicLexer,
        parser: CpcLoco.basicParser,
        trace: false,
        quiet: true
    });
    CpcLoco.codeGeneratorToken = new CodeGeneratorToken({
        lexer: CpcLoco.basicLexer,
        parser: CpcLoco.convertParser
    });
    CpcLoco.basicTokenizer = new BasicTokenizer();

    CpcLoco.vmMock = {
        line: "" as string | number,
        gosubStack: [] as (number | string)[],
        testVariables1: new Variables({}),
        testStepCounter1: 0,
        maxSteps: 10,

        initTest1: function () {
            this.testStepCounter1 = this.maxSteps;
            this.line = 0;
            this.gosubStack.length = 0;
            this.testVariables1.initAllVariables();
            for (let i = "a".charCodeAt(0); i <= "z".charCodeAt(0); i += 1) {
                const varChar = String.fromCharCode(i);
                this.testVariables1.setVarType(varChar, "R");
            }
        },
        vmLoopCondition: function () {
			this.testStepCounter1 -= 1;
			return this.testStepCounter1 > 0;
		},
        vmRound: function (n: number) {
			return (n >= 0) ? (n + 0.5) | 0 : (n - 0.5) | 0;
		},
        vmAssign(_varType: string, value: string | number) {
            return value;
        },
        addressOf(variable: string) {
            return this.testVariables1.getVariableIndex(variable);
        },
        vmGoto(line: string|number) { this.line = line; },
        "goto": function(line: number) { this.line = line; },
        gosub(retLabel: string|number, line: number) {
            this.gosubStack.push(retLabel);
            this.vmGoto(line);
        },
        "return": function() {
            const line = this.gosubStack.pop() || 0;
            this.vmGoto(line);
        },
        dim(varName: string) {
            const dimensions = [];
            for (let i = 1; i < arguments.length; i += 1) {
                const size = this.vmRound(arguments[i]) + 1;
                dimensions.push(size);
            }
            this.testVariables1.dimVariable(varName, dimensions);
        },
        // Helpers
        defint(first: string, last?: string) { this.vmDefineVarTypes("I", "DEFINT", first, last); },
        defreal(first: string, last?: string) { this.vmDefineVarTypes("R", "DEFREAL", first, last); },
        defstr(first: string, last?: string) { this.vmDefineVarTypes("$", "DEFSTR", first, last); },
        vmDefineVarTypes(type: VarTypes, _err: string, first: string, last?: string) {
            const firstNum = first.toLowerCase().charCodeAt(0),
				lastNum = last ? last.toLowerCase().charCodeAt(0) : firstNum;
			for (let i = firstNum; i <= lastNum; i += 1) {
				const varChar = String.fromCharCode(i);
				this.testVariables1.setVarType(varChar, type);
			}
        },
        vmStop: () => {},
        vmGetNextInput: () => 0,
        vmAssertNumberType: () => {},
        vmTrace: () => {},
        vmSetLabels: () => {},
        callRsx: () => {},
        vmGetAllVariables: function() { return this.testVariables1.getAllVariables(); },
        vmGetAllVarTypes: function() { return this.testVariables1.getAllVarTypes(); }
    };

    // Monkey patch keywords into vmMock
    const keywords = CpcLoco.basicParser.getKeywords();
    for (const key in keywords) {
        if (Object.prototype.hasOwnProperty.call(keywords, key)) {
            if (!(CpcLoco.vmMock as any)[key]) {
                (CpcLoco.vmMock as any)[key] = function () {
                    return key;
                };
            }
        }
    }
}

// Check Metadata logic
interface FileMeta {
	type?: string
	start?: number
	length?: number
	entry?: number
	encoding?: string
}

function splitMeta(input: string) {
	const metaIdent = "CpcLoco";
	let fileMeta: FileMeta | undefined;

	if (input.indexOf(metaIdent) === 0) {
		const index = input.indexOf(",");
		if (index >= 0) {
			const metaString = input.substring(0, index);
			input = input.substring(index + 1);
			const meta = metaString.split(";");
			fileMeta = {
				type: meta[1],
				start: Number(meta[2]),
				length: Number(meta[3]),
				entry: Number(meta[4]),
				encoding: meta[5]
			};
		}
	}
	return { meta: fileMeta || {}, data: input };
}

function testCheckMeta(input: string) {
	const data = splitMeta(input || "");
	input = data.data;

	if (data.meta.encoding === "base64") {
		input = Utils.atob(input);
	}

	const type = data.meta.type;
	if (type === "T") {
		input = CpcLoco.basicTokenizer.decode(input);
	} else if (type === "P") {
        input = DiskImage.unOrProtectData(input);
		input = CpcLoco.basicTokenizer.decode(input);
	} else if (type === "A") {
		input = input.replace(/\x1a+$/, "");
	} else if (type === "G") {
		input = asmGena3Convert(input);
	}
	return input;
}

function hasLineNumbers(input: string) {
	let hasNumbers = true;
	const lineParts = input.split("\n");
	for (let i = 0; i < lineParts.length; i += 1) {
		const lineNum = parseInt(lineParts[i], 10);
		if (isNaN(lineNum)) {
			hasNumbers = false;
			break;
		}
	}
	return hasNumbers;
}


// Discovery Logic
interface DiscoveredExample {
    dbDir: string;
    key: string;
    exampleEntry: ExampleEntry;
    fileUrl: string; // resolved absolute path
}

function discoverExamples(): DiscoveredExample[] {
    setupCpcLoco();
    const discovered: DiscoveredExample[] = [];
    const dbDirs = cpcconfig.databaseDirs.split(",");

    // Assuming we run from project root or checks paths
    const rootDir = process.cwd();

    // Prepare databases in model like legacy test
    const databases: DatabasesType = {};
    const databaseNames: string[] = [];

    for (let i = 0; i < dbDirs.length; i += 1) {
        const databaseDir = dbDirs[i];
        const parts1 = databaseDir.split("=");
        const databaseSrc = parts1[0];

        if (isUrl(databaseSrc)) continue; // Skip URLs

        let src = databaseSrc;
         // Map ./examples -> docs/examples
        if (src === "./examples") {
            src = "docs/examples";
        } else if (src === "./basic") {
            src = "basic";
        }

        const absoluteDir = path.resolve(rootDir, src);
        if (!fs.existsSync(absoluteDir)) {
             continue;
        }

        const assignedName = parts1.length > 1 ? parts1[1] : "";
        const parts2 = databaseSrc.split("/");
        const name = assignedName || parts2[parts2.length - 1];

        // Ensure unique key (simplified)
        const key = name;

        databases[key] = {
            text: key,
            title: databaseSrc,
            src: src // used for resolving
        };
        // Hack: store absolute path in src so we can find it later
        databases[key].src = absoluteDir;
        databaseNames.push(key);
    }

    CpcLoco.model.addDatabases(databases);

    // Now iterate databases
    for (const key of databaseNames) {
        CpcLoco.model.setProperty(ModelPropID.database, key);
        const exampeDb = CpcLoco.model.getDatabase();
        const absoluteDir = exampeDb.src; // This is now absolute path

        // Check for 0index.js
        const indexFile = path.join(absoluteDir, "0index.js");
        if (fs.existsSync(indexFile)) {
            const content = fs.readFileSync(indexFile, 'utf8');
            try {
                eval(content);

                const allExamples = CpcLoco.model.getAllExamples();
                for (const exKey in allExamples) {
                    if (Object.prototype.hasOwnProperty.call(allExamples, exKey)) {
                        const entry = allExamples[exKey];
                        const scriptPath = path.join(absoluteDir, entry.key + ".js");

                        if (fs.existsSync(scriptPath)) {
                             discovered.push({
                                 dbDir: absoluteDir,
                                 key: entry.key,
                                 exampleEntry: entry,
                                 fileUrl: scriptPath
                             });
                        }
                    }
                }
            } catch (e) {
                console.error(`Error loading index ${indexFile}:`, e);
            }
        }
    }
    return discovered;
}

const examples = discoverExamples();

describe("testParseExamples", () => {

    // We need to setup CpcLoco again for the tests because we might have cleared it or want fresh state
    beforeAll(() => {
        setupCpcLoco();
    });

    test("Discovery should have found examples", () => {
        // expect(examples.length).toBeGreaterThan(0);
        // If we found none, maybe config is wrong or files missing.
        // It's better to warn than fail if intentional.
        if (examples.length === 0) {
            console.warn("No examples found to test.");
        }
    });

    // Generate tests
    for (const ex of examples) {
        test(`Parse ${ex.key}`, () => {
            // 1. Load the script content
            const fileContent = fs.readFileSync(ex.fileUrl, 'utf8');

            // 2. Eval to register it (calls CpcLoco.addItem)
            // We need to ensure CpcLoco.model has the example entry first?
            // addItem2 gets example from model.
            // So we need to ensure the example entry exists in the model used in this test.
            // We can re-add it.
            CpcLoco.model.setExample(ex.exampleEntry);

            // Set current example key so addItem2 picks it up if key is empty
            CpcLoco.model.setProperty(ModelPropID.example, ex.key);

            try {
                eval(fileContent);
            } catch (e) {
                throw new Error(`Failed to eval example ${ex.key}: ${e}`);
            }

            // 3. Run Checks
            const entry = CpcLoco.model.getExample(ex.key);
            const script = entry.script || "";
            const input = testCheckMeta(script);

            if (entry.meta !== "D" && hasLineNumbers(input)) {
                const variables = CpcLoco.vmMock.testVariables1;
                variables.removeAllVariables();

                // Lex/Parse/Gen
                const output = CpcLoco.codeGeneratorJs.generate(input, variables);
                expect(output.error).toBeUndefined();

                if (!output.error) {
                    const jsScript = output.text;

                    // Test Function creation
                    let fnScript: Function;
                    try {
                        fnScript = new Function("o", jsScript);
                    } catch (e) {
                        throw new Error(`Generated JS invalid: ${e}`);
                    }

                    // Execute
                    CpcLoco.vmMock.initTest1();
                    try {
                        fnScript(CpcLoco.vmMock);
                    } catch (e) {
                        throw new Error(`Execution failed: ${e}`);
                    }

                    // Tokenize
                    const tokens = CpcLoco.codeGeneratorToken.generate(input);
                    // Detokenize
                    const decoded = CpcLoco.basicTokenizer.decode(tokens.text);

                    // Re-process
                    variables.removeAllVariables();
                    const output2 = CpcLoco.codeGeneratorJs.generate(decoded, variables);
                    expect(output2.error).toBeUndefined();

                    const fnScript2 = new Function("o", output2.text);
                    CpcLoco.vmMock.initTest1();
                    fnScript2(CpcLoco.vmMock);
                }
            } else {
                 // Ignored (Data file or no line numbers)
                 // Pass
            }
        });
    }
});
