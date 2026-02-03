// main.ts - CpcLoco App Entry Point

import {
    Model, View, Controller, Utils, ModelPropID, ViewID, NodeAdapt, ICpcVmRsx
} from "my-library"; // Importing from library

import { UiModel } from "./UiModel";
import { UiController } from "./UiController";
import { UiEventHandler } from "./UiEventHandler";
import { cpcconfig } from "./cpcconfig";

// Configuration Types
export type ConfigEntryType = string | number | boolean;
export type ConfigType = Record<string, ConfigEntryType>;

type RedirectExamplesType = Record<string, Record<"database" | "example", string>>;

export class CpcLoco {
    private static readonly config: ConfigType = {
        arrayBounds: false,
        autorun: true,
        basicVersion: "1.1",
        bench: 0,
        canvasType: "graphics",
        databaseDirs: "examples",
        database: "examples",
        debug: 0,
        example: "CpcLoco",
        exampleIndex: "0index.js",
        implicitLines: false,
        input: "",
        integerOverflow: false,
        kbdLayout: "alphanum",
        linesOnLoad: true,
        dragElements: false,
        palette: "color",
        prettyBrackets: true,
        prettyColons: true,
        prettyLowercaseVars: false,
        prettySpace: false,
        processFileImports: true,
        selectDataFiles: false,
        showConsoleLog: false,
        showCpc: true,
        showDisass: false,
        showExport: false,
        showGallery: false,
        showInput: true,
        showInp2: false,
        showKbd: false,
        showKbdSettings: false,
        showMore: false,
        showOutput: false,
        showPretty: false,
        showRenum: false,
        showResult: false,
        showSettings: false,
        showVariable: false,
        showView: false,
        sound: true,
        speed: 100,
        trace: false
    };

    public static model: UiModel; // Use UiModel
    public static view: View;
    public static controller: UiController; // Use UiController
    private static eventHandler: UiEventHandler;

    private static fnHereDoc(fn: () => void) {
        return String(fn).
            replace(/^[^/]+\/\*\S*/, "").
            replace(/\*\/[^/]+$/, "");
    }

    static addIndex(dir: string, input: Record<string, unknown> | (() => void)) {
        if (typeof input === "function") {
            input = {
                [dir]: JSON.parse(this.fnHereDoc(input).trim())
            };
        }
        return CpcLoco.controller.addIndex(dir, input);
    }

    static addItem(key: string, input: string | (() => void)) {
        const inputString = (typeof input !== "string") ? this.fnHereDoc(input) : input;
        return CpcLoco.controller.addItem(key, inputString);
    }

    static addRsx(key: string, RsxConstructor: new () => ICpcVmRsx) {
        return CpcLoco.controller.addRsx(key, RsxConstructor);
    }

    private static fnParseArgs(args: string[], config: ConfigType) {
        for (let i = 0; i < args.length; i += 1) {
            const nameValue = args[i],
                nameValueList = Utils.split2(nameValue, "="),
                name = nameValueList[0];

            if (config.hasOwnProperty(name)) {
                let value: ConfigEntryType = nameValueList[1];
                if (value !== undefined) {
                    switch (typeof config[name]) {
                        case "string": break;
                        case "boolean": value = (value === "true"); break;
                        case "number": value = Number(value); break;
                        default: break;
                    }
                }
                config[name] = value;
            }
        }
        return config;
    }

    private static fnDecodeUri(s: string) {
        const rPlus = /\+/g;
        let decoded = "";
        try {
            decoded = decodeURIComponent(s.replace(rPlus, " "));
        } catch (err) {
            err.message += ": " + s;
            Utils.console.error(err);
        }
        return decoded;
    }

    private static fnParseUri(urlQuery: string, config: ConfigType) {
        const rSearch = /([^&=]+)=?([^&]*)/g,
            args: string[] = [];
        let match: RegExpExecArray | null;

        while ((match = rSearch.exec(urlQuery)) !== null) {
            const name = CpcLoco.fnDecodeUri(match[1]),
                value = CpcLoco.fnDecodeUri(match[2]);
            if (value !== null && config.hasOwnProperty(name)) {
                args.push(name + "=" + value);
            }
        }
        CpcLoco.fnParseArgs(args, config);
    }

    private static fnMapObjectProperties(arg: any) {
        if (typeof arg === "object") {
            const res = [];
            for (const key in arg) {
                const value = arg[key];
                if (typeof value !== "object" && typeof value !== "function") {
                    res.push(key + ": " + value);
                }
            }
            arg = String(arg) + "{" + res.join(", ") + "}";
        }
        return arg;
    }

    private static createDebugUtilsConsole(CpcLocoLog: string) {
        const currentConsole = Utils.console;
        return {
            consoleLog: { value: CpcLocoLog || "" },
            console: currentConsole,
            rawLog: function (fnMethod: (args: any) => void, level: string, args: any) {
                if (level) args.unshift(level);
                if (fnMethod && fnMethod.apply) fnMethod.apply(console, args);
                if (this.consoleLog) {
                    this.consoleLog.value += args.map(CpcLoco.fnMapObjectProperties).join(" ") + ((level !== null) ? "\n" : "");
                }
            },
            log: function () { this.rawLog(this.console && this.console.log, "", Array.prototype.slice.call(arguments)); },
            debug: function () { this.rawLog(this.console && this.console.debug, "DEBUG:", Array.prototype.slice.call(arguments)); },
            info: function () { this.rawLog(this.console && this.console.info, "INFO:", Array.prototype.slice.call(arguments)); },
            warn: function () { this.rawLog(this.console && this.console.warn, "WARN:", Array.prototype.slice.call(arguments)); },
            error: function () { this.rawLog(this.console && this.console.error, "ERROR:", Array.prototype.slice.call(arguments)); },
            changeLog: function (log: any) {
                const oldLog = this.consoleLog;
                this.consoleLog = log;
                if (oldLog && oldLog.value && log) log.value += oldLog.value;
            }
        };
    }

    private static fnRedirectExamples(redirectExamples: RedirectExamplesType) {
        const name = this.model.getProperty(ModelPropID.database) + "/" + this.model.getProperty(ModelPropID.example);

        if (redirectExamples[name]) {
            this.model.setProperty(ModelPropID.database, redirectExamples[name].database);
            this.model.setProperty(ModelPropID.example, redirectExamples[name].example);
        }
    }

    static fnDoStart() {
        const startConfig = CpcLoco.config,
            winCpcConfig = (typeof window !== "undefined" && (window as any).cpcConfig) || {};

        Object.assign(startConfig, cpcconfig, winCpcConfig);

        const redirectExamples = startConfig.redirectExamples as unknown as RedirectExamplesType;
        delete (startConfig as any).redirectExamples;

        const coreModel = new Model(startConfig);
        CpcLoco.model = new UiModel(coreModel); // Wrap core model

        const myGlobalThis = (typeof globalThis !== "undefined") ? globalThis : Function("return this")();

        if (!myGlobalThis.process) { // browser
            CpcLoco.fnParseUri(window.location.search.substring(1), startConfig);
        } else { // nodeJs
            // CpcLoco.fnParseArgs(myGlobalThis.process.argv.slice(2), startConfig);
        }

        CpcLoco.view = new View();

        const debug = Number(CpcLoco.model.getProperty<number>(ModelPropID.debug));
        Utils.debug = debug;

        let UtilsConsole = Utils.console as any,
            CpcLocoLog = "";

        if (UtilsConsole.CpcLocoLog) {
            CpcLocoLog = UtilsConsole.CpcLocoLog;
            UtilsConsole.CpcLocoLog = undefined;
        }

        if (Utils.debug > 0 && CpcLoco.model.getProperty<boolean>(ModelPropID.showConsoleLog)) {
            UtilsConsole = CpcLoco.createDebugUtilsConsole(CpcLocoLog);
            Utils.console = UtilsConsole;
            Utils.console.log("CpcLoco log started at", Utils.dateFormat(new Date()));
            UtilsConsole.changeLog(View.getElementById1(ViewID.consoleLogText));
        }

        if (redirectExamples) {
            this.fnRedirectExamples(redirectExamples);
        }

        const coreController = new Controller(coreModel, CpcLoco.view);
        CpcLoco.controller = new UiController(coreController, CpcLoco.model, CpcLoco.view);

        CpcLoco.eventHandler = new UiEventHandler({
            model: CpcLoco.model as any, // Expects Model but we pass UiModel (which shares interface partially or we fix type)
            // UiEventHandler expects Model class from library? No, it expects what we pass.
            // But UiEventHandler is in docs/src, so it should use UiModel type if we updated it.
            // Let's verify UiEventHandler imports.
            view: CpcLoco.view,
            controller: CpcLoco.controller
        });

        // We need to attach the event handler to the view?
        // View adds listeners? View interacts with DOM.
        // CpcLoco.view has direct DOM access?
        // The View class in library has `View.getElementById1` etc.
        // It doesn't seem to attach event listeners itself globally.
        // The Controller (old) did it? Or UiEventHandler?
        // UiEventHandler implements EventListenerObject.
        // We need to register it.

        // Where was CommonEventHandler used before?
        // In Controller: `this.commonEventHandler = new CommonEventHandler(...)`.
        // And View attached it?
        // No, View has static methods mainly.
        // Controller attached listeners?
        // `Controller.initDropZone` used `this.fnOnDragoverHandler`.

        // We need to register the event listener on the document or specific elements.
        // CommonEventHandler.ts didn't seem to register itself.
        // Ah, `View` (library) might have logic to bind events if passed?
        // No.

        // Wait, `index.html` has `onclick="CpcLoco.controller.onWindowClick(event)"`?
        // Let's check `docs/index.html`.

        CpcLoco.controller.fnDoStart(); // Init UI controller
        CpcLoco.controller.onDatabaseSelectChange();
    }

    static fnOnLoad() {
        Utils.console.log("CpcLoco started at", Utils.dateFormat(new Date()));
        CpcLoco.fnDoStart();

        // Bind events if needed.
        // Example: document.addEventListener('click', CpcLoco.eventHandler);
        // But UiEventHandler has handleEvent, so passing it as listener works.
        // Where do we attach?
        // The buttons in HTML probably reference `CpcLoco.controller` or similar?
        // No, `ViewID` elements are found and listeners added?

        // In `CommonEventHandler.ts`, `createEventDefMap` maps IDs to functions.
        // But who calls `addEventListener`?
        // It seems `CommonEventHandler` (UiEventHandler) doesn't add listeners.
        // Does `View` do it?

        // Let's check `View.ts` or old `Controller.ts`.
        // Old Controller: `this.view.setAreaValue...`
        // It didn't seem to add listeners in constructor.

        // Maybe `index.html` has inline event handlers?
    }
}

declare global {
    interface Window {
        CpcLoco: typeof CpcLoco;
        cpcConfig: ConfigType;
    }
}

if (typeof window !== "undefined") {
    (window as any).CpcLoco = CpcLoco; // Assignment to window

    window.onload = () => {
        CpcLoco.fnOnLoad();
    };
}

const MyPolyfills = (typeof window !== "undefined" && (window as any).Polyfills) ? (window as any).Polyfills : (globalThis as any).Polyfills;
if (MyPolyfills && MyPolyfills.isNodeAvailable) {
    NodeAdapt.doAdapt();
    CpcLoco.fnOnLoad();
    Utils.console.debug("End of main.");
}
