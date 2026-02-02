// Diff.test.ts - Vitest tests for CpcLoco Diff

import { describe, test, expect } from 'vitest';
import { Utils } from "../../src/Utils";
import { Diff } from "../../src/Diff";

// example taken from https://github.com/Slava/diff.js/blob/master/demo/byline.html
const allTests: Record<string, Record<string, string>> = {
	test: {
		"This part of the\ndocument has stayed the\nsame from version to\nversion.  It shouldn't\nbe shown if it doesn't\nchange.  Otherwise, that\nwould not be helping to\ncompress the size of the\nchanges.\n\nThis paragraph contains\ntext that is outdated.\nIt will be deleted in the\nnear future.\n\nIt is important to spell\ncheck this dokument. On\nthe other hand, a\nmisspelled word isn't\nthe end of the world.\nNothing in the rest of\nthis paragraph needs to\nbe changed. Things can\nbe added after it.#This is an important\nnotice! It should\ntherefore be located at\nthe beginning of this\ndocument!\n\nThis part of the\ndocument has stayed the\nsame from version to\nversion.  It shouldn't\nbe shown if it doesn't\nchange.  Otherwise, that\nwould not be helping to\ncompress anything.\n\nIt is important to spell\ncheck this document. On\nthe other hand, a\nmisspelled word isn't\nthe end of the world.\nNothing in the rest of\nthis paragraph needs to\nbe changed. Things can\nbe added after it.\n\nThis paragraph contains\nimportant new additions\nto this document.":
		"+ This is an important\n+ notice! It should\n+ therefore be located at\n+ the beginning of this\n+ document!\n+ \n- compress the size of the\n- changes.\n+ compress anything.\n- This paragraph contains\n- text that is outdated.\n- It will be deleted in the\n- near future.\n- \n- check this dokument. On\n+ check this document. On\n+ \n+ This paragraph contains\n+ important new additions\n+ to this document."
	}
};

describe("Diff: Tests", () => {
    for (const category in allTests) {
        if (allTests.hasOwnProperty(category)) {
            describe(category, () => {
                const tests = allTests[category];
                for (const key in tests) {
                    if (tests.hasOwnProperty(key)) {
                        test(key.substring(0, 50), () => {
                            const parts = Utils.split2(key, "#"),
                                text1 = parts[0],
                                text2 = parts[1],
                                expected = tests[key];
                            let result: string;

                            try {
                                result = Diff.testDiff(text1, text2);
                            } catch (e) {
                                console.error(e);
                                result = String(e);
                            }

                            expect(result).toBe(expected);
                        });
                    }
                }
            });
        }
    }
});
