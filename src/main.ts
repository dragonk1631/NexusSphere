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
// Restore 60 FPS Cap logic to prevent high-refresh rate overload
const FPS_LIMIT = 60;
const FRAME_MIN_TIME = 1000 / FPS_LIMIT;

let lastTime = 0;
let loopCounter = 0;
// let frameDelta = 0;
let mainMenu: MainMenu;

// FPS Counter Variables
const fpsDiv = document.createElement('div');
fpsDiv.id = 'fps-counter';
fpsDiv.style.cssText = "position:fixed; top:5px; right:5px; background:rgba(0,0,0,0.5); color:#00ff00; padding:2px 6px; z-index:99999; font-size:14px; pointer-events:none; font-family:monospace; border-radius:4px; font-weight:bold;";
fpsDiv.innerText = `FPS: --`;
document.body.appendChild(fpsDiv);

let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let currentFps = 0;

function gameLoop(timestamp: number) {
  // --- FPS Update ---
  fpsFrameCount++;
  if (timestamp - fpsLastTime >= 1000) {
    currentFps = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = timestamp;
    fpsDiv.innerText = `FPS: ${currentFps}`;

    // Color Coding for Performance Monitoring
    if (currentFps >= 55) fpsDiv.style.color = '#00ff00';      // Green (Good)
    else if (currentFps >= 30) fpsDiv.style.color = '#ffff00'; // Yellow (Warning)
    else fpsDiv.style.color = '#ff0000';                       // Red (Bad)
  }

  if (!currentGame) return;

  // Closure capture of loopCounter to detect if a new loop was started
  const currentLoopId = loopCounter;

  // 1. Frame Limiter (Cap at 60 FPS)
  const timeSinceLast = timestamp - lastTime;
  if (timeSinceLast < FRAME_MIN_TIME) {
    if (currentLoopId === loopCounter) {
      requestAnimationFrame(gameLoop);
    }
    return;
  }

  // 2. Calculate elapsed time (Variable Step)
  // Clamp at 50ms (20 FPS) to prevent massive jumps/spirals on lag spikes
  let elapsed = timeSinceLast;
  if (elapsed > 50) elapsed = 50;
  if (elapsed < 0) elapsed = 0; // Safety against clock drift

  // Sync lastTime, accounting for the excess delay to maintain smooth 60 FPS average
  lastTime = timestamp - (elapsed % FRAME_MIN_TIME);

  // 3. Fixed-Step Update
  // IMPORTANT: Always pass FRAME_MIN_TIME (16.667ms) as delta, NOT the actual elapsed time.
  // Reason: The game clock (AudioContext.currentTime) is the source of truth for sync.
  //         delta is only used for non-time-critical logic (preGameTimer countdown, animations).
  //         Using a fixed delta prevents logic instability on frame drops.
  const FIXED_DELTA = FRAME_MIN_TIME;
  currentGame.update(FIXED_DELTA);

  // Only continue if this is still the active loop
  if (currentLoopId === loopCounter) {
    requestAnimationFrame(gameLoop);
  }
}

async function launchGame(GameClass: any) {
  // Ensure we are in landscape mode on mobile
  enforceLandscape();

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
  console.log(`[Main] Switching to mode: ${targetMode} `);

  if (targetMode === 'rhythm') {
    launchGame(RhythmGame);
  } else if (targetMode === 'editor') {
    launchGame(EditorGame);
  } else {
    returnToMenu();
  }
});

// --- Mobile Orientation & Navigation Guard ---
async function enforceLandscape() {
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    // Optimization: Don't Spam API if already correct
    if (window.innerWidth > window.innerHeight && document.fullscreenElement) {
      return;
    }

    try {
      // 1. Fullscreen (User interaction required usually)
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => { });
      }

      // 2. Screen Orientation Lock
      if (screen.orientation && (screen.orientation as any).lock) {
        // Only lock if not already landscape
        if (screen.orientation.type.startsWith('portrait')) {
          await (screen.orientation as any).lock('landscape').catch(() => {
            console.warn("Orientation lock failed/rejected - relying on CSS fallback");
          });
        }
      }
    } catch (e) {
      // Ignore errors (e.g. user denied)
    }
  }
}

// History Guard: Prevent Back Button from exiting the app
function enableHistoryGuard() {
  // Push a dummy state so "Back" just pops this state but stays on page
  history.pushState({ page: 'guard' }, '', '');

  window.addEventListener('popstate', () => {
    // User pressed back — push state again to "trap" them
    history.pushState({ page: 'guard' }, '', '');
    // Optional: Show a toast "Press Back again to exit" if needed, 
    // but for now we just keep them here.
  });
}

// Start with Main Menu
mainMenu = new MainMenu(handleGameStart);
mainMenu.show();

// --- Mobile Initialization ---
if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  // 1. Initial Lock Attempt
  window.addEventListener('load', () => {
    setTimeout(enforceLandscape, 1000);
    enableHistoryGuard();
  });

  // 2. Persistent Lock on Interface Change (Rotation/Resize)
  window.addEventListener('resize', () => {
    // Debounce slightly or just call (it has internal checks now)
    enforceLandscape();
  });

  // 3. Re-lock on Visibility Change (e.g. switching back from other apps)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      enforceLandscape();
    }
  });
} else {
  // Desktop: Just handle resize normally
  window.addEventListener('resize', () => {
    if (currentGame) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      currentGame.resize?.(window.innerWidth, window.innerHeight);
    }
  });
}

// Global Resize Handler (Mobile needs this too for rotation updates)
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  currentGame?.resize?.(window.innerWidth, window.innerHeight);
  // Re-enforce on resize (rotation)
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    enforceLandscape();
  }
});
