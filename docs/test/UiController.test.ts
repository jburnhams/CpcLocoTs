import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UiController } from '../src/UiController';
import { UiModel } from '../src/UiModel';
import { Controller, Model, View, ModelPropID, Utils } from 'cpclocots';
import { CpcLoco } from '../src/main';

// Mock dependencies
vi.mock('cpclocots', async () => {
    const actual = await vi.importActual('cpclocots');
    return {
        ...actual,
        Controller: vi.fn(),
        Model: vi.fn(),
        View: vi.fn(),
        Utils: {
            ...actual.Utils,
            console: {
                log: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
            localStorage: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                key: vi.fn(),
                length: 0,
                removeItem: vi.fn(),
            },
            loadScript: vi.fn(),
        }
    };
});

describe('UiController', () => {
    let uiController: UiController;
    let mockController: any;
    let mockModel: any;
    let mockView: any;
    let mockCoreModel: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup View mock static method
        (View as any).getElementById1 = vi.fn().mockReturnValue({
            addEventListener: vi.fn(),
            disabled: false,
            classList: {
                remove: vi.fn(),
                add: vi.fn(),
            },
            value: "100", // for speed input
            checked: false // for checkbox
        });

        // Setup mocks
        mockCoreModel = {
            getProperty: vi.fn(),
            setProperty: vi.fn(),
            addDatabases: vi.fn(),
            getAllDatabases: vi.fn().mockReturnValue({}),
            getDatabase: vi.fn(),
            getAllExamples: vi.fn(),
            getExample: vi.fn(),
            setExample: vi.fn(),
            removeExample: vi.fn(),
        };

        // UiModel wraps Model, but for unit test of UiController we pass UiModel.
        // But UiController constructor expects UiModel.
        // We can mock UiModel instance or just cast mockCoreModel
        mockModel = mockCoreModel as unknown as UiModel;

        mockView = {
            setSelectOptions: vi.fn(),
            setSelectValue: vi.fn(),
            getSelectValue: vi.fn(),
            setHidden: vi.fn(),
            setAreaInputList: vi.fn(),
            getSelectOptions: vi.fn(),
        } as unknown as View;

        // Controller mock
        // We need methods that UiController calls in constructor/fnDoStart
        mockController = {
            setExternalLoadHandler: vi.fn(),
            setExternalDirectoryHandler: vi.fn(),
            setStorageUpdateHandler: vi.fn(),
            getVm: vi.fn().mockReturnValue({
                vmGetInFileObject: vi.fn().mockReturnValue({}),
                vmStop: vi.fn(),
                vmRegisterRsx: vi.fn(),
                closein: vi.fn(),
                vmGetLoadHandler: vi.fn(),
            }),
            loadFileContinue: vi.fn(),
            setInputText: vi.fn(),
            startMainLoop: vi.fn(),
            getDebugger: vi.fn().mockReturnValue({
                pause: vi.fn(),
                resume: vi.fn(),
                stepInto: vi.fn(),
                setSpeed: vi.fn(),
                on: vi.fn(),
                getCurrentLineRange: vi.fn(),
            }),
        };

        uiController = new UiController(mockController, mockModel, mockView);
    });

    it('should register handlers on fnDoStart', () => {
        uiController.fnDoStart();
        expect(mockController.setExternalLoadHandler).toHaveBeenCalled();
        expect(mockController.setExternalDirectoryHandler).toHaveBeenCalled();
        expect(mockController.setStorageUpdateHandler).toHaveBeenCalled();
    });

    it('should handle directory listing combining storage and examples', () => {
        uiController.fnDoStart();
        const dirHandler = mockController.setExternalDirectoryHandler.mock.calls[0][0];

        (Controller as any).fnGetStorageDirectoryEntries = vi.fn().mockReturnValue(['local.bas']);

        mockModel.getAllExamples.mockReturnValue({
            'ex1.bas': { key: 'ex1.bas' },
            'ignored.data': { key: 'ignored.data' } // handling masks?
        });

        const result = dirHandler('*.bas');

        // Logic: combines local.bas and ex1.bas
        expect(result).toContain('local.bas');
        expect(result).toContain('ex1.bas');
    });

    it('should load example externally', () => {
        uiController.fnDoStart();
        const loadHandler = mockController.setExternalLoadHandler.mock.calls[0][0];

        // Case 1: Example exists and loaded
        const example = { key: 'ex1', loaded: true, script: 'print "hello"' };
        mockModel.getExample.mockReturnValue(example);

        loadHandler('ex1');

        expect(mockController.loadFileContinue).toHaveBeenCalledWith('print "hello"');
    });

    it('should load example from URL if not loaded', () => {
        uiController.fnDoStart();
        const loadHandler = mockController.setExternalLoadHandler.mock.calls[0][0];

        const example = { key: 'ex2', loaded: false };
        mockModel.getExample.mockReturnValue(example);
        mockModel.getDatabase = vi.fn().mockReturnValue({ src: 'http://db' });

        // Setup Utils.loadScript callback invocation
        (Utils.loadScript as any).mockImplementation((url: string, onLoad: any, onError: any) => {
            mockModel.getExample.mockReturnValue({ ...example, loaded: true, script: 'loaded script' });
            onLoad(url, 'ex2');
        });

        loadHandler('ex2');

        expect(Utils.loadScript).toHaveBeenCalled();
    });
    it('should update example property on selection change', () => {
        uiController.fnDoStart();

        // Setup
        mockView.getSelectValue.mockReturnValue('newExample');
        mockView.getSelectOptions.mockReturnValue([{ value: 'newExample', text: 'New Example' }]);
        mockModel.getProperty.mockImplementation((prop: string) => {
            if (prop === ModelPropID.database) return 'examples'; // Non-storage
            if (prop === ModelPropID.example) return 'oldExample';
            return '';
        });
        mockModel.getDatabase.mockReturnValue({ src: 'http://db' });

        // Act
        uiController.onExampleSelectChange();

        // Assert
        expect(mockModel.setProperty).toHaveBeenCalledWith(ModelPropID.example, 'newExample');
    });

    afterEach(() => {
        CpcLoco.fnDoStop();
        vi.restoreAllMocks();
    });
});
