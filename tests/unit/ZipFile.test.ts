// ZipFile.test.ts - Vitest tests for CpcLoco ZipFile

import { describe, test, expect } from 'vitest';
import { Utils } from "../../src/Utils";
import { ZipFile } from "../../src/ZipFile";

type TestsType = Record<string, string>;
type AllTestsType = Record<string, TestsType>;

describe("ZipFile: Tests", () => {
	// examples store.zip and deflate.zip taken from https://github.com/bower/decompress-zip/tree/master/test/assets/file-mode-pack
	// deflate example created by: Controller.exportAsBase64("deflate.zip.xxx")
	const allTests: AllTestsType = {
		store: {
			"CpcLoco;B;0;404;;base64,UEsDBAoAAAAAAGyFJkYAAAAAAAAAAAAAAAAFAAAAZGlyMS9QSwMECgAAAAAAbIUmRgAAAAAAAAAAAAAAAAUAAABkaXIyL1BLAwQUAAgAAABshSZGAAAAAAAAAAAAAAAABQAAAGZpbGUxYWJjUEsHCMJBJDUDAAAAAwAAAFBLAwQUAAgAAABshSZGAAAAAAAAAAAAAAAABQAAAGZpbGUyeHl6UEsHCGe6jusDAAAAAwAAAFBLAQItAwoAAAAAAGyFJkYAAAAAAAAAAAAAAAAFAAAAAAAAAAAAEADtAQAAAABkaXIxL1BLAQItAwoAAAAAAGyFJkYAAAAAAAAAAAAAAAAFAAAAAAAAAAAAEADJASMAAABkaXIyL1BLAQItAxQACAAAAGyFJkbCQSQ1AwAAAAMAAAAFAAAAAAAAAAAAIADtgUYAAABmaWxlMVBLAQItAxQACAAAAGyFJkZnuo7rAwAAAAMAAAAFAAAAAAAAAAAAIADJgXwAAABmaWxlMlBLBQYAAAAABAAEAMwAAACyAAAAAAA=": "file1=abc,file2=xyz"
		},
		deflate: {
			"CpcLoco;B;0;408;;base64,UEsDBAoAAAAAAGyFJkYAAAAAAAAAAAAAAAAFAAAAZGlyMS9QSwMECgAAAAAAbIUmRgAAAAAAAAAAAAAAAAUAAABkaXIyL1BLAwQUAAgACABshSZGAAAAAAAAAAAAAAAABQAAAGZpbGUxS0xKBgBQSwcIwkEkNQUAAAADAAAAUEsDBBQACAAIAGyFJkYAAAAAAAAAAAAAAAAFAAAAZmlsZTKrqKwCAFBLBwhnuo7rBQAAAAMAAABQSwECLQMKAAAAAABshSZGAAAAAAAAAAAAAAAABQAAAAAAAAAAABAA7QEAAAAAZGlyMS9QSwECLQMKAAAAAABshSZGAAAAAAAAAAAAAAAABQAAAAAAAAAAABAAyQEjAAAAZGlyMi9QSwECLQMUAAgACABshSZGwkEkNQUAAAADAAAABQAAAAAAAAAAACAA7YFGAAAAZmlsZTFQSwECLQMUAAgACABshSZGZ7qO6wUAAAADAAAABQAAAAAAAAAAACAAyYF+AAAAZmlsZTJQSwUGAAAAAAQABADMAAAAtgAAAAAA": "file1=abc,file2=xyz"
		}
	};

	function fnExtractZipFiles(zip: ZipFile) {
		const result: string[] = [];

		if (zip) {
			const zipDirectory = zip.getZipDirectory(),
				entries = Object.keys(zipDirectory);

			for (let i = 0; i < entries.length; i += 1) {
				const name = entries[i],
					data = zip.readData(name);

				if (data) {
					result.push(name + "=" + data);
				}
			}
		}
		return result.join(",");
	}

	for (const category in allTests) {
		if (Object.prototype.hasOwnProperty.call(allTests, category)) {
			describe(category, () => {
				const tests = allTests[category];
				for (const key in tests) {
					if (Object.prototype.hasOwnProperty.call(tests, key)) {
						test(category + ": " + key.substring(0, 30) + "...", () => {
							const parts = Utils.split2(key, ","),
								// meta = parts[0],
								data = Utils.atob(parts[1]), // decode base64
								zip = new ZipFile({
									data: Utils.string2Uint8Array(data),
									zipName: "name"
								}),
								expected = tests[key];
							let result: string;

							try {
								result = fnExtractZipFiles(zip);
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
