import { vi } from 'vitest';
import { ViewID, Utils } from 'cpclocots';
import { CpcLoco } from '../src/main';

export async function getPixels(canvasEl: HTMLCanvasElement): Promise<Uint8ClampedArray> {
    const { createCanvas } = await import('@napi-rs/canvas');
    const helperCanvas = createCanvas(canvasEl.width, canvasEl.height);
    const helperCtx = helperCanvas.getContext('2d');
    // We need the underlying napi-rs canvas for drawImage to work in this environment
    if ((canvasEl as any)._napiCanvas) {
        helperCtx.drawImage((canvasEl as any)._napiCanvas, 0, 0);
    } else {
        helperCtx.drawImage(canvasEl as any, 0, 0);
    }
    return helperCtx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
}

export function setupIntegrationTest() {
    // Mock localStorage
    const localStorageMock = (() => {
        let store: Record<string, string> = {};
        return {
            getItem: vi.fn().mockImplementation((key: string) => store[key] || null),
            setItem: vi.fn().mockImplementation((key: string, value: string) => {
                store[key] = value.toString();
            }),
            clear: vi.fn().mockImplementation(() => {
                store = {};
            }),
            removeItem: vi.fn().mockImplementation((key: string) => {
                delete store[key];
            }),
            key: vi.fn().mockImplementation((index: number) => Object.keys(store)[index] || null),
            get length() {
                return Object.keys(store).length;
            },
        };
    })();

    Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        enumerable: true,
        configurable: true,
        writable: true
    });
    (global as any).localStorage = localStorageMock; // Ensure it's available globally too
    Utils.localStorage = localStorageMock as any; // Explicitly set it on the Utils class

    // Mock AudioContext
    const mockAudioParam = {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
    };
    const mockNode = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: mockAudioParam,
        frequency: mockAudioParam,
        start: vi.fn(),
        stop: vi.fn(),
        type: 'sine',
    };
    (window as any).AudioContext = vi.fn().mockImplementation(() => {
        const startTime = Date.now();
        return {
            createGain: vi.fn().mockReturnValue(mockNode),
            createChannelMerger: vi.fn().mockReturnValue(mockNode),
            createOscillator: vi.fn().mockReturnValue(mockNode),
            createBuffer: vi.fn().mockReturnValue({
                getChannelData: vi.fn().mockReturnValue(new Float32Array(1000))
            }),
            createBufferSource: vi.fn().mockReturnValue({
                buffer: null,
                connect: vi.fn().mockReturnValue(mockNode),
                start: vi.fn(),
                stop: vi.fn()
            }),
            createBiquadFilter: vi.fn().mockReturnValue({
                connect: vi.fn().mockReturnValue(mockNode),
                type: '',
                frequency: { value: 0 }
            }),
            destination: mockNode,
            state: 'suspended',
            resume: vi.fn().mockResolvedValue(undefined),
            get currentTime() { return (Date.now() - startTime) / 1000; }
        };
    });

    // Mock HTML element offsetParent for visibility check
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
        get() {
            return this.parentNode ? document.body : null;
        }
    });

    // Bulletproof DOM: Create all ViewIDs with appropriate tags
    document.body.innerHTML = '';
    for (const id of Object.values(ViewID)) {
        if (typeof id === 'string') {
            let tagName = 'div';
            if (id.toLowerCase().includes('canvas')) {
                tagName = 'canvas';
            } else if (id.endsWith('Select')) {
                tagName = 'select';
            } else if (id.endsWith('Input')) {
                tagName = 'input';
            } else if (id.endsWith('Button')) {
                tagName = 'button';
            } else if (id.endsWith('Text') || id.endsWith('Area')) {
                tagName = 'textarea';
            }

            const el = document.createElement(tagName);
            el.id = id;
            if (tagName === 'input') {
                el.setAttribute('type', id === ViewID.fileInput ? 'file' : 'text');
            }
            document.body.appendChild(el);
        }
    }

    // Ensure cpcCanvas has correct dimensions
    const canvas = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;
    if (canvas) {
        canvas.width = 640;
        canvas.height = 400;
    }

    const cpcArea = document.getElementById(ViewID.cpcArea);
    if (cpcArea && canvas) {
        cpcArea.appendChild(canvas);
    }

    return {
        clear: () => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
            (CpcLoco as any).view = undefined;
            (CpcLoco as any).controller = undefined;
            (CpcLoco as any).basicVm = undefined;
        }
    };
}

export function startVm(options: any = {}) {
    console.log('DEBUG: startVm called with options:', JSON.stringify(options));
    CpcLoco.fnDoStart(options);
    const uiController = (CpcLoco as any).controller;
    // The UIController contains the core Controller
    const coreController = (uiController as any).controller;
    const vm = coreController ? coreController.getVm() : undefined;

    console.log('DEBUG: CpcLoco uiController is:', !!uiController, 'coreController is:', !!coreController, 'vm is:', !!vm);

    return { coreController, vm };
}

export async function stepExecution(ms: number) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        vi.advanceTimersByTime(16);
        await new Promise(r => process.nextTick(r));
    }
}

export function flushCanvas() {
    const c = (CpcLoco as any).controller;
    // c is uiController, it has .controller which is coreController
    const core = (c as any).controller;
    if (core && core.canvas) {
        core.canvas.fnCopy2Canvas();
    }
}
