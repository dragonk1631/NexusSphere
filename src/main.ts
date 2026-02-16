import './style.css';
import { PongGame } from './games/puzzle/PongGame';
import { RhythmGame } from './games/rhythm/RhythmGame';
import { EditorGame } from './games/editor/EditorGame';
import { LayoutEditor } from './games/editor/LayoutEditor';
import { MainMenu } from './ui/MainMenu';
import { UIManager } from './core/ui/UIManager';

// Initialize UI Manager
UIManager.getInstance();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
let currentGame: any = null;
const FPS_LIMIT = 60;
const FRAME_MIN_TIME = 1000 / FPS_LIMIT;
let lastTime = 0;
let loopCounter = 0;
let frameDelta = 0;
let mainMenu: MainMenu;

function gameLoop(timestamp: number) {
  if (!currentGame) return;

  // Closure capture of loopCounter to detect if a new loop was started
  const currentLoopId = loopCounter;

  // 1. Calculate elapsed time, but clamp it to prevent massive jumps (e.g. from backgrounding)
  // 100ms clamp is enough to allow for some lag without breaking game logic/sync
  const elapsed = Math.min(100, timestamp - lastTime);
  lastTime = timestamp;
  frameDelta += elapsed;

  // Fixed Step Logic: Ensure game updates at constant rate (e.g. 60hz) 
  // regardless of screen refresh rate or lag spikes.
  const FIXED_STEP = 1000 / 60; // 16.666ms

  if (frameDelta >= FIXED_STEP) {
    let steps = 0;
    const MAX_STEPS = 5; // Prevent spiral of death on massive lag

    while (frameDelta >= FIXED_STEP) {
      currentGame.update(FIXED_STEP);
      frameDelta -= FIXED_STEP;
      steps++;

      if (steps >= MAX_STEPS) {
        // If we are too far behind, just give up and snap to now
        // This prevents the game from running in fast-forward for too long
        console.warn(`[Main] Lag Spike detected! Skipped ${frameDelta.toFixed(1)}ms`);
        frameDelta = 0;
        break;
      }
    }
  }

  // Only continue if this is still the active loop
  if (currentLoopId === loopCounter) {
    requestAnimationFrame(gameLoop);
  }
}

async function launchGame(GameClass: any) {
  loopCounter++; // Increment to invalidate previous loops

  // Clear ALL UI before switching
  UIManager.getInstance().clear();

  // Reset Canvas State
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }

  currentGame = new GameClass(canvas);

  try {
    console.log(`Initializing ${GameClass.name}...`);
    await currentGame.init();

    // Check if Game initialized into Test Mode (skips standard load/create)
    if (currentGame.isTestMode) {
      console.log(`[Main] ${GameClass.name} started in Test Mode. Skipping standard load sequence.`);

      lastTime = performance.now();
      requestAnimationFrame(gameLoop);
      return;
    }

    console.log("Loading assets...");
    await currentGame.load();

    console.log("Starting display...");
    currentGame.create();

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("Game launch failed:", error);
    returnToMenu();
  }
}

function returnToMenu(): void {
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }
  UIManager.getInstance().clear();
  mainMenu = new MainMenu(handleGameStart);
  mainMenu.show();
}

function handleGameStart(mode: string) {
  if (mode === 'rhythm') {
    launchGame(RhythmGame);
  } else if (mode === 'pong') {
    launchGame(PongGame);
  } else if (mode === 'editor') {
    launchGame(EditorGame);
  } else if (mode === 'layout_editor') {
    launchGame(LayoutEditor);
  }
}

// Listen for Layout Editor exit event
window.addEventListener('layout-exit', () => {
  returnToMenu();
});

// Listen for Game Switch event (e.g. Editor -> Rhythm)
window.addEventListener('switch-game', (e: any) => {
  const targetMode = e.detail.targetMode;
  console.log(`[Main] Switching to mode: ${targetMode}`);

  if (targetMode === 'rhythm') {
    launchGame(RhythmGame);
  } else if (targetMode === 'editor') {
    launchGame(EditorGame);
  } else {
    returnToMenu();
  }
});

// --- Mobile Orientation Enforcement ---
async function enforceLandscape() {
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (e) {
      console.warn("Orientation lock failed (User interaction might be required or unsupported):", e);
    }
  }
}

// Start with Main Menu
mainMenu = new MainMenu(handleGameStart);
mainMenu.show();

// Trigger Lock on first Interaction
window.addEventListener('click', () => enforceLandscape(), { once: true });
window.addEventListener('touchstart', () => enforceLandscape(), { once: true });

// Handle Window Resize
window.addEventListener('resize', () => {
  if (currentGame) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    currentGame.resize?.(window.innerWidth, window.innerHeight);
  }
});
