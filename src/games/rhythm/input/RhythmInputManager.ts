import { GameState } from '../types/GameTypes';

/**
 * Interface for components that need to react to game inputs.
 */
export interface IGameInputHandler {
    getCurrentState(): GameState;
    onLanePress(lane: number, timeMs: number): void;
    onLaneRelease(lane: number, timeMs: number): void;
    onMenuPointerDown(x: number, y: number): void;
    onMenuPointerMove(x: number, y: number): void;
    onMenuPointerUp(x: number, y: number): void;
    onMenuKey(code: string): void;
    onGameOverPointer(x: number, y: number): void;
    onGameOverKey(code: string): void;
    onResultKey(code: string): void;
    onWheel(deltaY: number): void;
    onFileDrop(files: FileList): void;
}

/**
 * RhythmInputManager centralizes input state and coordinate mapping.
 * It follows the Stage 3 roadmap by owning input states and routing.
 */
export class RhythmInputManager {
    private canvas: HTMLCanvasElement;
    private handler: IGameInputHandler;
    private boundHandlers: Record<string, any> = {};

    // -- Input State (Moved from RhythmGame) --
    private keyState: boolean[] = [false, false, false, false, false, false];
    private pointerLanes: Map<number, number> = new Map();
    private isTouchDown: boolean = false;
    private isMouseDown: boolean = false;
    private mouseLane: number = -1;
    private touchStartY: number = 0;

    // -- Layout Info (For lane calculation) --
    private laneCount: number = 6;
    private laneBottomWidth: number = 100;
    private keyMode: 4 | 6 = 4;

    constructor(canvas: HTMLCanvasElement, handler: IGameInputHandler) {
        this.canvas = canvas;
        this.handler = handler;
        this.initBoundHandlers();
    }

    public updateLayout(laneCount: number, laneBottomWidth: number): void {
        this.laneCount = laneCount;
        this.laneBottomWidth = laneBottomWidth;
    }

    public updateKeyMode(mode: 4 | 6): void {
        this.keyMode = mode;
    }

    public getKeyState(lane: number): boolean {
        return this.keyState[lane] || false;
    }

    public getLaneStates(): boolean[] {
        return this.keyState;
    }

    public resetStates(): void {
        this.keyState.fill(false);
        this.pointerLanes.clear();
        this.isTouchDown = false;
        this.isMouseDown = false;
        this.mouseLane = -1;
    }

    public getIsTouchDown(): boolean { return this.isTouchDown; }
    public getIsMouseDown(): boolean { return this.isMouseDown; }
    public getTouchStartY(): number { return this.touchStartY; }
    public getMouseLane(): number { return this.mouseLane; }

    private initBoundHandlers(): void {
        this.boundHandlers.keydown = (e: KeyboardEvent) => {
            const state = this.handler.getCurrentState();
            const code = e.code;

            if (state === GameState.PLAYING) {
                const lane = this.getLaneFromKey(code);
                if (lane !== -1 && !this.keyState[lane]) {
                    this.keyState[lane] = true;
                    this.handler.onLanePress(lane, e.timeStamp);
                }
            } else if (state === GameState.MENU || state === GameState.PAUSED) {
                this.handler.onMenuKey(code);
            } else if (state === GameState.GAMEOVER) {
                this.handler.onGameOverKey(code);
            } else if (state === GameState.RESULT) {
                this.handler.onResultKey(code);
            }
        };

        this.boundHandlers.keyup = (e: KeyboardEvent) => {
            const state = this.handler.getCurrentState();
            if (state === GameState.PLAYING) {
                const lane = this.getLaneFromKey(e.code);
                if (lane !== -1) {
                    this.keyState[lane] = false;
                    this.handler.onLaneRelease(lane, e.timeStamp);
                }
            }
        };

        const handlePointer = (clientX: number, clientY: number, id: number, type: 'down' | 'move' | 'up') => {
            const state = this.handler.getCurrentState();
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            if (state === GameState.PLAYING) {
                const lane = this.getLaneFromTouch(x, y);
                if (type === 'down') {
                    if (lane !== -1) {
                        this.pointerLanes.set(id, lane);
                        this.keyState[lane] = true;
                        this.handler.onLanePress(lane, performance.now());
                    } else {
                        // HUD Interaction during gameplay (e.g., Pause Button)
                        this.handler.onMenuPointerDown(x, y);
                    }
                } else if (type === 'move') {
                    const oldLane = this.pointerLanes.get(id) ?? -1;
                    if (lane !== oldLane) {
                        if (oldLane !== -1) {
                            this.keyState[oldLane] = false;
                            this.handler.onLaneRelease(oldLane, performance.now());
                        }
                        if (lane !== -1) {
                            this.keyState[lane] = true;
                            this.handler.onLanePress(lane, performance.now());
                        }
                        this.pointerLanes.set(id, lane);
                    }
                } else if (type === 'up') {
                    const oldLane = this.pointerLanes.get(id) ?? -1;
                    if (oldLane !== -1) {
                        this.keyState[oldLane] = false;
                        this.handler.onLaneRelease(oldLane, performance.now());
                    }
                    this.pointerLanes.delete(id);
                }
            } else if (state === GameState.MENU || state === GameState.PAUSED) {
                if (type === 'down') this.handler.onMenuPointerDown(x, y);
                else if (type === 'move') this.handler.onMenuPointerMove(x, y);
                else if (type === 'up') this.handler.onMenuPointerUp(x, y);
            } else if (type === 'down') {
                if (state === GameState.GAMEOVER) this.handler.onGameOverPointer(x, y);
                else if (state === GameState.RESULT) this.handler.onResultKey('Enter'); // Result touch maps to continue
            }
        };

        this.boundHandlers.touchstart = (e: TouchEvent) => {
            e.preventDefault();
            this.isTouchDown = true;
            if (e.touches.length > 0) {
                this.touchStartY = e.touches[0].clientY;
            }
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                handlePointer(t.clientX, t.clientY, t.identifier, 'down');
            }
        };
        this.boundHandlers.touchmove = (e: TouchEvent) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                handlePointer(t.clientX, t.clientY, t.identifier, 'move');
            }
        };
        this.boundHandlers.touchend = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 0) {
                this.isTouchDown = false;
            }
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                handlePointer(t.clientX, t.clientY, t.identifier, 'up');
            }
        };
        this.boundHandlers.mousedown = (e: MouseEvent) => {
            this.isMouseDown = true;
            handlePointer(e.clientX, e.clientY, -1, 'down');
        };
        this.boundHandlers.mousemove = (e: MouseEvent) => {
            handlePointer(e.clientX, e.clientY, -1, 'move');
        };
        this.boundHandlers.mouseup = (e: MouseEvent) => {
            this.isMouseDown = false;
            handlePointer(e.clientX, e.clientY, -1, 'up');
        };
        this.boundHandlers.wheel = (e: WheelEvent) => {
            e.preventDefault();
            this.handler.onWheel(e.deltaY);
        };
        this.boundHandlers.dragover = (e: DragEvent) => {
            const state = this.handler.getCurrentState();
            if (state === GameState.MENU) {
                e.preventDefault();
                e.dataTransfer!.dropEffect = 'copy';
            }
        };
        this.boundHandlers.drop = (e: DragEvent) => {
            const state = this.handler.getCurrentState();
            if (state === GameState.MENU) {
                e.preventDefault();
                if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                    this.handler.onFileDrop(e.dataTransfer.files);
                }
            }
        };
    }

    private getLaneFromTouch(x: number, y: number): number {
        if (y < this.canvas.height * 0.4) return -1;

        const totalWidthBottom = this.laneBottomWidth * this.laneCount;
        const startX = (this.canvas.width - totalWidthBottom) / 2;

        if (x < startX || x > startX + totalWidthBottom) return -1;

        const lane = Math.floor((x - startX) / this.laneBottomWidth);
        return Math.max(0, Math.min(lane, this.laneCount - 1));
    }

    private getLaneFromKey(code: string): number {
        if (this.keyMode === 4) {
            const keyMap4: Record<string, number> = { 'KeyD': 1, 'KeyF': 2, 'KeyJ': 3, 'KeyK': 4 };
            return keyMap4[code] ?? -1;
        }
        const keyMap6: Record<string, number> = { 'KeyS': 0, 'KeyD': 1, 'KeyF': 2, 'KeyJ': 3, 'KeyK': 4, 'KeyL': 5 };
        return keyMap6[code] ?? -1;
    }

    public register(): void {
        window.addEventListener('keydown', this.boundHandlers.keydown);
        window.addEventListener('keyup', this.boundHandlers.keyup);
        this.canvas.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundHandlers.touchend, { passive: false });
        this.canvas.addEventListener('mousedown', this.boundHandlers.mousedown);
        window.addEventListener('mousemove', this.boundHandlers.mousemove);
        window.addEventListener('mouseup', this.boundHandlers.mouseup);
        this.canvas.addEventListener('wheel', this.boundHandlers.wheel, { passive: false });
        this.canvas.addEventListener('dragover', this.boundHandlers.dragover);
        this.canvas.addEventListener('drop', this.boundHandlers.drop);
    }

    public unregister(): void {
        window.removeEventListener('keydown', this.boundHandlers.keydown);
        window.removeEventListener('keyup', this.boundHandlers.keyup);
        this.canvas.removeEventListener('touchstart', this.boundHandlers.touchstart);
        this.canvas.removeEventListener('touchmove', this.boundHandlers.touchmove);
        this.canvas.removeEventListener('touchend', this.boundHandlers.touchend);
        this.canvas.removeEventListener('mousedown', this.boundHandlers.mousedown);
        window.removeEventListener('mousemove', this.boundHandlers.mousemove);
        window.removeEventListener('mouseup', this.boundHandlers.mouseup);
        this.canvas.removeEventListener('wheel', this.boundHandlers.wheel);
        this.canvas.removeEventListener('dragover', this.boundHandlers.dragover);
        this.canvas.removeEventListener('drop', this.boundHandlers.drop);
    }
}
