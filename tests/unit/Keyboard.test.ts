import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keyboard } from '../../src/Keyboard';
import { View } from '../../src/View';
import { ViewID } from '../../src/Constants';

describe('Keyboard Unit Tests', () => {
    let keyboard: Keyboard;
    let mockView: View;

    beforeEach(() => {
        // Mock View
        mockView = {
            addEventListenerById: vi.fn(),
            getCanvas: vi.fn(),
            // Add other necessary methods if required by Keyboard constructor or methods
        } as any as View;

        const options = {
            view: mockView,
            fnOnEscapeHandler: vi.fn(),
            fnOnKeyDown: vi.fn(),
        };

        keyboard = new Keyboard(options);
        keyboard.setActive(true);
    });

    it('should initialize correctly', () => {
        expect(keyboard).toBeDefined();
        expect(mockView.addEventListenerById).toHaveBeenCalledWith('keydown', expect.any(Function), ViewID.cpcArea);
        expect(mockView.addEventListenerById).toHaveBeenCalledWith('keyup', expect.any(Function), ViewID.cpcArea);
    });

    it('should buffer keys when pressed', () => {
        const event = {
            type: 'keydown',
            key: 'a', // Browser sends 'a' when unshifted
            code: 'KeyA',
            keyCode: 65, // browser keycode
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            preventDefault: vi.fn(),
        } as any as KeyboardEvent;

        // Simulate key press handler directly or via private method exposure/casting
        (keyboard as any).fnKeyboardKeydown(event);

        expect(keyboard.getKeyFromBuffer()).toBe('a');
    });

    it('should handle shift key for Uppercase', () => {
        const event = {
            type: 'keydown',
            key: 'A', // Browser sends 'A' when shifted
            code: 'KeyA',
            keyCode: 65,
            shiftKey: true, // Shift is pressed
            ctrlKey: false,
            altKey: false,
            preventDefault: vi.fn(),
        } as any as KeyboardEvent;

        (keyboard as any).fnKeyboardKeydown(event);

        expect(keyboard.getKeyFromBuffer()).toBe('A');
    });

    it('should clear buffer', () => {
        keyboard.putKeyInBuffer('a');
        keyboard.clearInput();
        expect(keyboard.getKeyFromBuffer()).toBe('');
    });

    it('should track key state (pressed/released)', () => {
        const eventDown = {
            type: 'keydown',
            key: 'a',
            code: 'KeyA',
            keyCode: 65,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            preventDefault: vi.fn(),
        } as any as KeyboardEvent;

        (keyboard as any).fnKeyboardKeydown(eventDown);

        // CPC Key code for 'A' is 69
        // Keyboard.key2CpcKey: "65KeyA": 69
        const cpcKeyA = 69;
        expect(keyboard.getKeyState(cpcKeyA)).toBe(0); // 0 means pressed, no modifiers

        const eventUp = {
            type: 'keyup',
            key: 'a',
            code: 'KeyA',
            keyCode: 65,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            preventDefault: vi.fn(),
        } as any as KeyboardEvent;

        (keyboard as any).fnKeyboardKeyup(eventUp);
        expect(keyboard.getKeyState(cpcKeyA)).toBe(-1); // -1 means released
    });

    it('should handle special keys (Arrow keys)', () => {
        const event = {
            type: 'keydown',
            key: 'ArrowUp',
            code: 'ArrowUp',
            keyCode: 38,
            shiftKey: false,
            ctrlKey: false,
            altKey: false,
            preventDefault: vi.fn(),
        } as any as KeyboardEvent;

        (keyboard as any).fnKeyboardKeydown(event);

        // ArrowUp maps to special char 240
        const key = keyboard.getKeyFromBuffer();
        expect(key.charCodeAt(0)).toBe(240);
    });
});
