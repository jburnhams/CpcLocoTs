
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

    test('Should parse valid .BAS files from basic/ directory', () => {
        const basicDir = path.join(__dirname, '../../basic');
        const files = fs.readdirSync(basicDir).filter(file => file.endsWith('.BAS') || file.endsWith('.bas'));

        expect(files.length).toBeGreaterThan(0);

        files.forEach(file => {
            const filePath = path.join(basicDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            // Assuming the files are ASCII as verified during exploration.
            // If they were binary, we would need BasicTokenizer.decode first.

            try {
                const result = parseScript(content);
                expect(result).toBeDefined();
                expect(Array.isArray(result)).toBe(true);
            } catch (error) {
                console.error(`Failed to parse ${file}:`, error);
                throw error;
            }
        });
    });

    test('Should detect syntax errors in invalid scripts', () => {
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
                // Note: Parser might report "Expected )" or unexpected token
                errorPartial: 'Expected )'
            },
            {
                name: 'Syntax error in command',
                script: '10 GOTO\n', // Missing line number
                errorPartial: 'Expected line number'
            }
        ];

        invalidScripts.forEach(item => {
            try {
                parseScript(item.script);
                throw new Error(`Should have failed for ${item.name}`);
            } catch (e: any) {
                // Check if the error message contains expected text
                // The error object from BasicParser via Utils.composeError usually has a message property
                const msg = e.message || String(e);
                expect(msg).toContain(item.errorPartial);
            }
        });
    });
});
