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
let frameDelta = 0;
let mainMenu: MainMenu;

function gameLoop(timestamp: number) {
  if (!currentGame) return;

  const elapsed = timestamp - lastTime;
  lastTime = timestamp;
  frameDelta += elapsed;

  // Permissive threshold to handle rAF jitter on high-refresh screens (120Hz+)
  const threshold = FRAME_MIN_TIME - 0.5;

  if (frameDelta >= threshold) {
    // Pass accumulated delta to maintain speed consistency
    currentGame.update(frameDelta);

    // Greedy accumulation: maintain the remainder for the next frame
    // This prevents "lost time" and keeps the average at exactly 60 FPS
    frameDelta -= FRAME_MIN_TIME;

    // Safety cap: if delta is still huge (tab was suspended), reset
    if (frameDelta > FRAME_MIN_TIME) frameDelta = 0;
  }

  requestAnimationFrame(gameLoop);
}

async function launchGame(GameClass: any) {
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
