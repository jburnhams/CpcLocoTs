
import { describe, test, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BasicLexer } from '../../src/BasicLexer';
import { BasicParser } from '../../src/BasicParser';

describe('Basic Parsing Integration Tests', () => {
    beforeAll(() => {
        // Mock Polyfills and window if needed, similar to browser.test.ts
        const globalAny = global as any;
        globalAny.window = globalAny.window || {};
        globalAny.Polyfills = globalAny.Polyfills || { console: console, isNodeAvailable: true };
        globalAny.window.Polyfills = globalAny.Polyfills;
    });

    const parseScript = (script: string) => {
        const parser = new BasicParser({
            basicVersion: "1.1"
        });
        const lexer = new BasicLexer({
            keywords: parser.getKeywords()
        });

        const tokens = lexer.lex(script);
        const parseTree = parser.parse(tokens);
        return parseTree;
    };

    describe('Valid .BAS files', () => {
        const basicDir = path.join(__dirname, '../../basic');
        // Ensure directory exists and read files
        let files: string[] = [];
        try {
            if (fs.existsSync(basicDir)) {
                files = fs.readdirSync(basicDir).filter(file => file.endsWith('.BAS') || file.endsWith('.bas'));
            }
        } catch (e) {
            console.error("Could not read basic directory", e);
        }

        test('should have .BAS files to test', () => {
            expect(files.length).toBeGreaterThan(0);
        });

        files.forEach(file => {
            test(`should parse ${file} correctly`, () => {
                const filePath = path.join(basicDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');

                // Assuming the files are ASCII as verified during exploration.
                // If they were binary, we would need BasicTokenizer.decode first.

                expect(() => {
                    const result = parseScript(content);
                    expect(result).toBeDefined();
                    expect(Array.isArray(result)).toBe(true);
                }).not.toThrow();
            });
        });
    });

    describe('Invalid scripts (Error Detection)', () => {
        const invalidScripts = [
            {
                name: 'Missing TO in FOR loop',
                script: '10 FOR I=1 10\n',
                errorPartial: 'Expected to'
            },
            {
                name: 'Invalid keyword',
                script: '10 INVALIDKEYWORD\n',
                errorPartial: 'Expected ='
            },
            {
                name: 'Mismatched parentheses',
                script: '10 PRINT (1+2\n', // Missing closing )
                errorPartial: 'Expected )'
            },
            {
                name: 'Syntax error in command',
                script: '10 GOTO\n', // Missing line number
                errorPartial: 'Expected line number'
            }
        ];

        invalidScripts.forEach(item => {
            test(`should detect error in: ${item.name}`, () => {
                expect(() => parseScript(item.script)).toThrow(item.errorPartial);
            });
        });
    });
});
