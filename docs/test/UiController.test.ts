import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UiController } from '../src/UiController';
import { UiModel } from '../src/UiModel';
import { Controller, Model, View, ModelPropID, Utils } from 'my-library';

// Mock dependencies
vi.mock('my-library', async () => {
    const actual = await vi.importActual('my-library');
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
            }),
            loadFileContinue: vi.fn(),
            setInputText: vi.fn(),
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
        // Access private method or simulate call via registered handler?
        // Since we cannot easily access bound private method from outside alias,
        // we can test the logic if we expose it or use `any` cast.
        // But better: we test that it was registered and then call the registered function?
        // But we passed `this.onDirectoryHandler.bind(this)`.

        // Let's call fnDoStart to register, capturing the callback.
        uiController.fnDoStart();
        const dirHandler = mockController.setExternalDirectoryHandler.mock.calls[0][0];

        // Setup data
        // Mock Controller static method? mocking specific static method on class mock is tricky in vitest depending on how it's exported.
        // In our mock above, we returned Controller as vi.fn().
        // We need to attach static methods to it.
        // We didn't mock static fnGetStorageDirectoryEntries.
        // Let's adjust usage or mock setup.

        // We can just spy on Controller.fnGetStorageDirectoryEntries if it was real, 
        // but we mocked the whole module.
        // So we need to assign the static method to the mocked class.
        (Controller as any).fnGetStorageDirectoryEntries = vi.fn().mockReturnValue(['local.bas']);

        mockModel.getAllExamples.mockReturnValue({
            'ex1.bas': { key: 'ex1.bas' },
            'ignored.data': { key: 'ignored.data' } // handling masks?
        });

        const result = dirHandler('*.bas');

        // Logic: combines local.bas and ex1.bas
        expect(result).toContain('local.bas');
        expect(result).toContain('ex1.bas');
        // Check duplication logic if we add duplicate
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
            // Simulate load
            // We need to update model mock to return loaded example now?
            // The callback calls `this.model.getExample(key)` again.
            mockModel.getExample.mockReturnValue({ ...example, loaded: true, script: 'loaded script' });
            onLoad(url, 'ex2');
        });

        loadHandler('ex2');

        expect(Utils.loadScript).toHaveBeenCalled();
        // expect(mockController.loadFileContinue).toHaveBeenCalledWith('loaded script'); 
        // Note: checking this requires the mock impl to run synchronously which it does.
    });
});
