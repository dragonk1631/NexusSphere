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

let lastTime = 0;
let loopCounter = 0;
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

// === PERFORMANCE PROFILER ===
let profUpdateTotal = 0;
let profRenderTotal = 0;
let profFrameCount = 0;
let profDroppedFrames = 0;
let profMaxFrameTime = 0;
let profLastRafTime = 0;
let profRafJitterTotal = 0;
let profLastLogTime = performance.now(); // SEPARATE timer for profiling output

function gameLoop(timestamp: number) {
  // Prevent potential undefined timestamp on first call
  if (!timestamp) timestamp = performance.now();

  // --- FPS Update ---
  if (timestamp - fpsLastTime >= 1000) {
    currentFps = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = timestamp;
    fpsDiv.innerText = `FPS: ${currentFps}`;

    // Color Coding for Performance Monitoring
    if (currentFps >= 58) fpsDiv.style.color = '#00ff00';      // Green (Good)
    else if (currentFps >= 30) fpsDiv.style.color = '#ffff00'; // Yellow (Warning)
    else fpsDiv.style.color = '#ff0000';                       // Red (Bad)

    // Also update FPS div to include real vs rAF info
    fpsDiv.innerText = `FPS: ${currentFps}`;
  }

  if (!currentGame) return;

  // Closure capture of loopCounter to detect if a new loop was started
  const currentLoopId = loopCounter;

  // Strict 60 FPS Logic
  // We want to update AND render exactly 60 times per second.
  // No variable rendering. This is the "Console Syle" loop.
  const INTERVAL = 1000 / 60; // 16.666ms

  const elapsed = timestamp - lastTime;

  // Epsilon to handle 59.94Hz vs 60Hz mismatch (avoid dropping frames due to 0.001ms diff)
  if (elapsed >= INTERVAL - 1.0) {
    // --- PROFILING: Measure rAF jitter ---
    if (profLastRafTime > 0) {
      const rafDelta = timestamp - profLastRafTime;
      profRafJitterTotal += Math.abs(rafDelta - INTERVAL);
      if (rafDelta > 20) profDroppedFrames++; // >20ms = likely dropped
    }
    profLastRafTime = timestamp;

    // Update Logic
    const t0 = performance.now();
    if (currentGame) {
      currentGame.update(INTERVAL); // Always pass fixed delta
    }
    const t1 = performance.now();

    // Render Logic
    if (currentGame) {
      currentGame.render();
      fpsFrameCount++;
    }
    const t2 = performance.now();

    // Accumulate profiling data
    profUpdateTotal += (t1 - t0);
    profRenderTotal += (t2 - t1);
    profMaxFrameTime = Math.max(profMaxFrameTime, t2 - t0);
    profFrameCount++;

    // --- PROFILING: Log every 2 seconds (using SEPARATE timer) ---
    if (timestamp - profLastLogTime >= 2000 && profFrameCount > 0) {
      const elapsed2 = (timestamp - profLastLogTime) / 1000;
      const avgUpdate = (profUpdateTotal / profFrameCount).toFixed(2);
      const avgRender = (profRenderTotal / profFrameCount).toFixed(2);
      const avgTotal = ((profUpdateTotal + profRenderTotal) / profFrameCount).toFixed(2);
      const avgJitter = (profRafJitterTotal / profFrameCount).toFixed(2);
      const renderDetail = (currentGame as any)?._lastRenderProfile || 'N/A';
      console.log(
        `[PERF] FPS:${(profFrameCount / elapsed2).toFixed(0)} | ` +
        `Avg: U=${avgUpdate}ms R=${avgRender}ms T=${avgTotal}ms | ` +
        `Max:${profMaxFrameTime.toFixed(1)}ms | ` +
        `Drop:${profDroppedFrames} | Jitter:${avgJitter}ms | ` +
        `${renderDetail}`
      );
      // Reset
      profUpdateTotal = 0;
      profRenderTotal = 0;
      profFrameCount = 0;
      profDroppedFrames = 0;
      profMaxFrameTime = 0;
      profRafJitterTotal = 0;
      profLastLogTime = timestamp;
    }

    // Sync Time
    // Modulo prevents drift, but we clamp to avoid spiral of death
    const excess = elapsed % INTERVAL;
    lastTime = timestamp - excess;
  }

  // Loop
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

    // Reset Loop State
    lastTime = performance.now();
    fpsFrameCount = 0;

    // Slight delay to align first frame
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
