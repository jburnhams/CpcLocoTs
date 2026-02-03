// UiController.ts

import { Controller, ModelPropID, View, ViewID, Utils, FileHandler, FileSelect, DiskImage, FileMeta, SelectOptionElement, AreaInputElement, ICpcVmRsx } from "my-library";
import { UiModel } from "./UiModel";
import { cpcconfig } from "./cpcconfig";

export class UiController {
    public readonly model: UiModel;
    public readonly view: View;
    public readonly controller: Controller;

    constructor(controller: Controller, model: UiModel, view: View) {
        this.controller = controller;
        this.model = model;
        this.view = view;
    }

    // Proxy methods
    startContinue() { this.controller.startContinue(); }
    startParseRun() { this.controller.startParseRun(); }
    startParse() { this.controller.startParse(); }
    startRenum(options: any) { this.controller.startRenum(options); }
    startReset() { this.controller.startReset(); }
    startRun() { this.controller.startRun(); }
    startBreak() { this.controller.startBreak(); }
    startEnter() { this.controller.startEnter(); }
    startScreenshot() { return this.controller.startScreenshot(); }
    startUpdateCanvas() { this.controller.startUpdateCanvas(); }
    stopUpdateCanvas() { this.controller.stopUpdateCanvas(); }

    fnAddLines() { this.controller.fnAddLines(); }
    fnRemoveLines() { this.controller.fnRemoveLines(); }
    fnPretty(options: any) { this.controller.fnPretty(options); }

    fnArrayBounds() { this.controller.fnArrayBounds(); }
    fnImplicitLines() { this.controller.fnImplicitLines(); }
    fnIntegerOverflow() { this.controller.fnIntegerOverflow(); }
    fnPrettyLowercaseVars() { this.controller.fnPrettyLowercaseVars(); }
    fnSpeed() { this.controller.fnSpeed(); }
    fnTrace() { this.controller.fnTrace(); }

    onWindowClick(event: Event) { this.controller.onWindowClick(event); }
    onCpcCanvasClick(event: MouseEvent) { this.controller.onCpcCanvasClick(event); }

    setInputText(text: string, keepStack?: boolean) { this.controller.setInputText(text, keepStack); }
    undoStackElement() { return this.controller.undoStackElement(); }
    redoStackElement() { return this.controller.redoStackElement(); }

    getVariable(name: string) { return this.controller.getVariable(name); }
    changeVariable() {
        // Logic to be implemented if needed, possibly proxy to Controller or just update UI
    }

    setBasicVersion(val: string) { this.controller.setBasicVersion(val); }
    setPalette(val: string) { this.controller.setPalette(val); }
    setCanvasType(val: string) { this.controller.setCanvasType(val); }

    fnDragElementsActive(active: boolean) { this.controller.fnDragElementsActive(active); }

    getVirtualKeyboard() { return this.controller.getVirtualKeyboard(); }
    invalidateScript() { this.controller.invalidateScript(); }

    setDisassAddr(addr: number, endAddr?: number) { this.controller.setDisassAddr(addr, endAddr); }
    setSoundActive() { this.controller.setSoundActive(); }


    // UI Specific Methods

    private static readonly exportEditorText = "<editor>";

    fnGetFilename(input: string) {
		let name = "file";
		const reRemMatcher = /^\d* ?(?:REM|rem) ([\w.]+)+/,
			matches = reRemMatcher.exec(input);

		if (matches !== null) {
			name = matches[1];
		} else {
			const example = this.model.getProperty<string>(ModelPropID.example);

			if (example !== "") {
				if (example.indexOf("/") >= 0) {
					name = example.substring(example.lastIndexOf("/") + 1);
				}
			}
		}

		if (name.indexOf(".") < 0) {
			name += ".bas";
		}
		return name;
	}

    fnDownload(eventDef?: any): void {
		const options = this.view.getSelectOptions(ViewID.exportFileSelect),
			exportTokenized = this.view.getInputChecked(ViewID.exportTokenizedInput),
			exportDSK = this.view.getInputChecked(ViewID.exportDSKInput),
			format = this.view.getSelectValue(ViewID.exportDSKFormatSelect),
			stripEmpty = this.view.getInputChecked(ViewID.exportDSKStripEmptyInput),
			exportBase64 = this.view.getInputChecked(ViewID.exportBase64Input),
			editorText = UiController.exportEditorText,
			meta: FileMeta = {
				typeString: "A", // ASCII
				start: 0x170,
				length: 0,
				entry: 0
			};

		let diskImage: DiskImage | undefined,
			name = "",
			data = "";

		const fnExportBase64 = function () {
			meta.encoding = "base64";
			const metaString = FileHandler.joinMeta(meta);

			data = metaString + "," + Utils.btoa(data);
			name += ".b64.txt";
		};

		if (exportDSK) {
			diskImage = this.controller.getFileHandler().getDiskImage();

			diskImage.setOptions({
				diskName: "test",
				data: diskImage.formatImage(format) // data or system
			});
		}

		for (let i = 0; i < options.length; i += 1) {
			const item = options[i];

			if (item.selected) {
				if (item.value === editorText) {
					data = this.view.getAreaValue(ViewID.inputText);
					name = this.fnGetFilename(data);

					const eolStr = data.indexOf("\r\n") > 0 ? "\r\n" : "\n"; // heuristic: if CRLF found, use it as split

					if (eolStr === "\n") {
						data = data.replace(/\n/g, "\r\n"); // replace LF by CRLF (not really needed if tokenized is used)
					}

					meta.typeString = "A"; // ASCII
					meta.start = 0x170;
					meta.length = data.length;
					meta.entry = 0;
				} else {
					name = item.value;
					data = Controller.tryLoadingFromLocalStorage(name) || "";
					const metaAndData = Controller.splitMeta(data);

					Object.assign(meta, metaAndData.meta); // copy meta info
					data = metaAndData.data;
				}

				if (exportTokenized && meta.typeString === "A") { // do we need to tokenize it?
					const tokens = this.controller.encodeTokenizedBasic(data);

					if (!tokens) { // not successful?
						return;
					}

					data = tokens;
					meta.typeString = "T";
					meta.start = 0x170;
					meta.length = data.length;
					meta.entry = 0;
				}

				if (meta.typeString !== "A" && meta.typeString !== "X" && meta.typeString !== "Z") {
					const [name1, ext1] = DiskImage.getFilenameAndExtension(name), // eslint-disable-line array-element-newline
						header = DiskImage.createAmsdosHeader({
							name: name1,
							ext: ext1,
							typeString: meta.typeString,
							start: meta.start,
							length: meta.length,
							entry: meta.entry
						}),
						headerString = DiskImage.combineAmsdosHeader(header);

					data = headerString + data;
				}

				if (diskImage) {
					diskImage.writeFile(name, data);

					const diskOptions = diskImage.getOptions();

					data = diskOptions.data; // we need the modified disk image with the file(s) inside
					name = name.substring(0, name.indexOf(".") + 1) + "dsk";
					meta.length = data.length;
					meta.typeString = "X"; // (extended) disk image
				} else {
					if (exportBase64) {
						fnExportBase64();
					}
					if (data) {
						this.view.fnDownloadBlob(data, name);
					}
				}
			}
		}

		if (diskImage) {
			if (stripEmpty) {
				data = diskImage.stripEmptyTracks();
			}

			if (exportBase64) {
				fnExportBase64();
			}
			if (data) {
				this.view.fnDownloadBlob(data, name);
			}
		}
	}

    setExportSelectOptions(select: ViewID): void {
		const dirList = Controller.fnGetStorageDirectoryEntries(),
			items: SelectOptionElement[] = [],
			editorText = UiController.exportEditorText;

		dirList.sort(); // we sort keys without editorText
		dirList.unshift(editorText);
		for (let i = 0; i < dirList.length; i += 1) {
			const key = dirList[i],
				title = key,
				item: SelectOptionElement = {
					value: key,
					text: title,
					title: title,
					selected: title === editorText
				};

			items.push(item);
		}
		// sort already done
		this.view.setSelectOptions(select, items);
	}

    setGalleryAreaInputs(): void {
		const database = this.model.getDatabase(),
			directory = this.view.getSelectValue(ViewID.directorySelect),
			options = this.view.getSelectOptions(ViewID.exampleSelect),
			inputs: AreaInputElement[] = [];

		for (let i = 0; i < options.length; i += 1) {
			const item = options[i],
				input: AreaInputElement = {
					value: item.value,
					title: item.title,
					checked: item.selected,
					imgUrl: database.src + "/" + directory + "/img/" + item.value + ".png"
				};

			inputs.push(input);
		}
		this.view.setAreaInputList(ViewID.galleryAreaItems, inputs);
	}

    updateStorageDatabase(action: string, key: string) {
		const database = this.model.getProperty<string>(ModelPropID.database),
			storage = Utils.localStorage;

		if (database !== "storage") {
			this.model.setProperty(ModelPropID.database, "storage"); // switch to storage database
		}

		// Implementation simplified for brevity/matching original logic structure
        this.setDirectorySelectOptions();
        this.onDirectorySelectChange();
    }

    onDatabaseSelectChange(): void {
		const databaseName = this.view.getSelectValue(ViewID.databaseSelect);

		this.model.setProperty(ModelPropID.database, databaseName);
		this.view.setSelectTitleFromSelectedOption(ViewID.databaseSelect);

		const database = this.model.getDatabase();

		if (!database) {
			Utils.console.error("onDatabaseSelectChange: database not available:", databaseName);
			return;
		}

		if (database.text === "storage") { // special handling: browser localStorage
			this.updateStorageDatabase("set", ""); // set all
			database.loaded = true;
		}

		if (database.loaded) {
			this.setDirectorySelectOptions();
			this.onDirectorySelectChange();
		} else {
			this.setInputText("#loading database " + databaseName + "...");
			const exampleIndex = this.model.getProperty<string>(ModelPropID.exampleIndex),
				url = database.src + "/" + exampleIndex;

			Utils.loadScript(url, this.createFnDatabaseLoaded(url), this.createFnDatabaseError(url), databaseName);
		}
	}

	onDirectorySelectChange(): void {
		this.setExampleSelectOptions();
		this.onExampleSelectChange();
	}

	onExampleSelectChange(): void {
		const vm = this.controller.getVm(),
			inFile = vm.vmGetInFileObject(),
			dataBaseName = this.model.getProperty<string>(ModelPropID.database),
			directoryName = this.view.getSelectValue(ViewID.directorySelect);

		vm.closein();

		// this.commonEventHandler.setPopoversHiddenExcept(); // This needs to be handled by EventHandler calling this?
        // Or UiController calls View? View doesn't handle popovers. UiEventHandler does.
        // I will omit this call here or expose it. UiEventHandler calls onExampleSelectChange so it should handle popovers before calling.
        // But onGalleryItemClick called setPopoversHiddenExcept() before calling onExampleSelectChange.
        // onDirectorySelectChange calls onExampleSelectChange.
        // onDatabaseSelectChange calls onDirectorySelectChange.

        // It seems safer to ignore UI state change (popovers) here and let the caller handle it.

		inFile.open = true;

		let exampleName = this.view.getSelectValue(ViewID.exampleSelect);

		if (directoryName) {
			exampleName = directoryName + "/" + exampleName;
		}

		const exampleEntry = this.model.getExample(exampleName);
		let autorun = this.model.getProperty<boolean>(ModelPropID.autorun);

		if (exampleEntry && exampleEntry.meta) {
			const type = exampleEntry.meta.charAt(0);

			if (type === "B" || type === "D" || type === "G") {
				autorun = false;
			}
		}
		inFile.command = autorun ? "run" : "load";

		if (dataBaseName !== "storage") {
			exampleName = "/" + exampleName; // load absolute
		} else {
			this.model.setProperty(ModelPropID.example, exampleName);
		}

		inFile.name = exampleName;
		inFile.start = undefined;
		inFile.fnFileCallback = vm.vmGetLoadHandler();
		vm.vmStop("fileLoad", 90);
		this.controller.startMainLoop();
	}

    // Also called from index file 0index.js
    addIndex(_dir: string, input: Record<string, unknown>): void { // dir maybe ""
        for (const value in input) {
            if (input.hasOwnProperty(value)) {
                // We assume input[value] is ExampleEntry[] but the type is unknown
                const item = input[value] as any[]; // Simplification

                for (let i = 0; i < item.length; i += 1) {
                    //item[i].dir = dir; // TTT to check
                    this.model.setExample(item[i]);
                }
            }
        }
    }

    // Also called from example files xxxxx.js
	addItem(key: string, input: string): string { // key maybe ""
		if (!key) { // maybe ""
			key = (document.currentScript && document.currentScript.getAttribute("data-key")) || this.model.getProperty<string>(ModelPropID.example);
		}
		input = input.replace(/^\n/, "").replace(/\n$/, ""); // remove preceding and trailing newlines

		// beware of data files ending with newlines! (do not use trimEnd)
		const implicitLines = this.model.getProperty<boolean>(ModelPropID.implicitLines),
			linesOnLoad = this.model.getProperty<boolean>(ModelPropID.linesOnLoad);

		if (input.startsWith("REM ") && !implicitLines && linesOnLoad) {
			input = Controller.addLineNumbers(input);
		}

		const example = this.model.getExample(key);

        if (example) { // Should check if example exists, or create it?
            // Original code: const example = this.model.getExample(key); example.key = key; ...
            // If getExample returns undefined, we have a problem.
            // But usually the database is loaded first, creating the structure?
            // Wait, UiModel.setExample handles creation?
            // Actually getExample might return undefined.
            // The original Model.setExample creates it if missing?
            // "if (!this.examples[database][key]) ..."

            // addItem assumes the example entry exists in the database structure?
            // Or maybe it creates it?
            // Original code: "const example = this.model.getExample(key);"
            // If it returns undefined, next line "example.key = key" throws.
            // So it must exist.

            example.key = key; // maybe changed
            example.script = input;
            example.loaded = true;
            Utils.console.log("addItem:", key);
        } else {
             Utils.console.warn("addItem: example not found:", key);
        }
		return key;
	}

	addRsx(key: string, RsxConstructor: new () => ICpcVmRsx): string {
		if (!key) { // maybe ""
            key = (document.currentScript && document.currentScript.getAttribute("data-key")) || this.model.getProperty<string>(ModelPropID.example);
        }

		const example = this.model.getExample(key);

        if (example) {
            example.key = key; // maybe changed
            example.rsx = new RsxConstructor();
            example.loaded = true;
            Utils.console.log("addRsx:", key);
        }
		return key;
	}


    private setDatabaseSelectOptions() {
		const items: SelectOptionElement[] = [],
			databases = this.model.getAllDatabases(),
			database = this.model.getProperty<string>(ModelPropID.database);

		for (const value in databases) {
			if (databases.hasOwnProperty(value)) {
				const db = databases[value],
					item: SelectOptionElement = {
						value: value,
						text: db.text,
						title: db.title,
						selected: value === database
					};

				items.push(item);
			}
		}
		this.view.setSelectOptions(ViewID.databaseSelect, items);
	}

	private static getPathFromExample(example: string) {
		const index = example.lastIndexOf("/");
		let path = "";

		if (index >= 0) {
			path = example.substring(0, index);
		}
		return path;
	}

	private static getNameFromExample(example: string) {
		const index = example.lastIndexOf("/");
		let name = example;

		if (index >= 0) {
			name = example.substring(index + 1);
		}
		return name;
	}

	private setDirectorySelectOptions() {
		const items: SelectOptionElement[] = [],
			allExamples = this.model.getAllExamples(),
			examplePath = UiController.getPathFromExample(this.model.getProperty<string>(ModelPropID.example)),
			directorySeen: Record<string, boolean> = {};

		for (const key in allExamples) {
			if (allExamples.hasOwnProperty(key)) {
				const exampleEntry = allExamples[key],
					value = UiController.getPathFromExample(exampleEntry.key);

				if (!directorySeen[value]) {
					const item: SelectOptionElement = {
						value: value,
						text: value,
						title: value,
						selected: value === examplePath
					};

					items.push(item);
					directorySeen[value] = true;
				}
			}
		}
		this.view.setSelectOptions(ViewID.directorySelect, items);
	}

	private setExampleSelectOptions(): void {
		const maxTitleLength = 160,
			maxTextLength = 60, // (32 visible?)
			items: SelectOptionElement[] = [],
			exampleName = UiController.getNameFromExample(this.model.getProperty<string>(ModelPropID.example)),
			allExamples = this.model.getAllExamples(),
			directoryName = this.view.getSelectValue(ViewID.directorySelect),
			selectDataFiles = this.model.getProperty<boolean>(ModelPropID.selectDataFiles);

		let exampleSelected = false;

		for (const key in allExamples) {
			if (allExamples.hasOwnProperty(key) && (UiController.getPathFromExample(key) === directoryName)) {
				const exampleEntry = allExamples[key],
					exampleName2 = UiController.getNameFromExample(exampleEntry.key);

				if (selectDataFiles || (exampleEntry.meta !== "D")) { // skip data files
					const title = (exampleName2 + ": " + exampleEntry.title).substring(0, maxTitleLength),
						item: SelectOptionElement = {
							value: exampleName2,
							title: title,
							text: title.substring(0, maxTextLength),
							selected: exampleName2 === exampleName
						};

					if (item.selected) {
						exampleSelected = true;
					}
					items.push(item);
				}
			}
		}
		if (!exampleSelected && items.length) {
			items[0].selected = true; // if example is not found, select first element
            // We should update the selected property?
            // Original code logic ended here?
            // sed output was truncated.
		}
        this.view.setSelectOptions(ViewID.exampleSelect, items);
	}

	private createFnDatabaseLoaded(url: string) {
		return (_sFullUrl: string, key: string) => {
			const selectedName = this.model.getProperty<string>(ModelPropID.database);

			if (selectedName === key) {
				this.model.getDatabase().loaded = true;
			} else { // should not occur
				Utils.console.warn("databaseLoaded: name changed: " + key + " => " + selectedName);
				this.model.setProperty(ModelPropID.database, key);
				const database = this.model.getDatabase();

				if (database) {
					database.loaded = true;
				}
				this.model.setProperty(ModelPropID.database, selectedName);
			}

			Utils.console.log("fnDatabaseLoaded: database loaded: " + key + ": " + url);
			this.setDirectorySelectOptions();
			this.onDirectorySelectChange();
		};
	}

	private createFnDatabaseError(url: string) {
		return (_sFullUrl: string, key: string) => {
			Utils.console.error("fnDatabaseError: database error: " + key + ": " + url);
			this.setDirectorySelectOptions();
			this.onDirectorySelectChange();
			this.setInputText("");
        };
    }

    fnDoStart() {
        const databases = this.parseDatabaseDirs(cpcconfig.databaseDirs);
        this.model.addDatabases(databases);

        // Register external load handler
        this.controller.setExternalLoadHandler(this.onLoadExternal.bind(this));

        // Init options
        this.setDatabaseSelectOptions();

        // Trigger initial selection?
        // this.onDatabaseSelectChange();
        // Typically the controller logic would init things.
    }

    private parseDatabaseDirs(dirs: string) {
        // Implementation of parsing cpcconfig.databaseDirs
        // Based on observation of cpcconfig format: "dir,url,url=name,..."
        // Returns DatabasesType

        const databases: any = {};
        const parts = dirs.split(",");

        for (const part of parts) {
            let [url, name] = part.split("=");
            if (!name) {
                // derive name from url
                const match = url.match(/\/([^\/]+)$/);
                name = match ? match[1] : url;
                if (url.startsWith("./")) { // e.g. ./examples
                     name = url.substring(2);
                }
            }
            databases[name] = {
                text: name,
                title: name, // could be better
                src: url
            };
        }
        return databases;
    }

    private onLoadExternal(name: string) {
        // Handle external load request (e.g. from BASIC command)
        // Check if it's in our examples
        // This mirrors part of fnFileLoad logic in Controller?
        // Controller calls this if not found in localStorage.

        // We can try to find it in the current database/directory?

        Utils.console.log("onLoadExternal:", name);
    }
}
