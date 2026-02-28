import './style.css';
import { PongGame } from './games/puzzle/PongGame';
import { RhythmGame } from './games/rhythm/RhythmGame';
import { EditorGame } from './games/editor/EditorGame';
import { LayoutEditor } from './games/editor/LayoutEditor';
import { MainMenu } from './ui/MainMenu';
import { TitleScreen } from './ui/TitleScreen';
import { MobileStartScreen } from './ui/MobileStartScreen';
import { UIManager } from './core/ui/UIManager';
import { BackgroundRenderer } from './core/graphics/BackgroundRenderer';
import { ScreenUtils } from './core/utils/ScreenUtils';
import { MenuMusicManager } from './core/audio/MenuMusicManager';

// Initialize Global Managers
UIManager.getInstance();
BackgroundRenderer.getInstance();

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

  if (elapsed >= INTERVAL) {
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
      // Data collection logic remains if needed for other features, 
      // but console logging is disabled for runtime performance.

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

// Help prevent multiple simultaneous launch calls
let isLaunching = false;

function updateCanvasSize() {
  const { width, height } = ScreenUtils.getVirtualDimensions();
  canvas.width = width;
  canvas.height = height;

  if (currentGame) {
    currentGame.resize?.(width, height);
  }

  BackgroundRenderer.getInstance().resize();
  if (titleScreen) {
    titleScreen.resize();
  }
}

// --- Mobile Orientation & Navigation Guard ---
async function enforceLandscape(isUserGesture: boolean = false) {
  if (!ScreenUtils.isMobile()) return;

  const isStandalone = ScreenUtils.isStandalone();

  try {
    // 1. Fullscreen - STRICTLY REQUIRES USER GESTURE
    // Skip if already in standalone (PWA) mode as it's already "fullscreen-like"
    if (!isStandalone && isUserGesture && document.fullscreenEnabled && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch((err) => {
        // Log but don't crash; CSS fallback will handle orientation
        console.warn("Fullscreen request failed (expected on some mobile browsers):", err);
      });

      // Small delay to allow browser to transition before locking
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 2. Screen Orientation Lock - USUALLY REQUIRES FULLSCREEN
    if (screen.orientation && (screen.orientation as any).lock) {
      await (screen.orientation as any).lock('landscape').catch(() => {
        // Fallback to CSS is already active via media queries
      });
    }
  } catch (e) {
    // Quietly ignore
  }
}

// Global Interaction Monitor for Fullscreen/Orientation
function setupGlobalInteraction() {
  const handleInteraction = () => {
    enforceLandscape(true);
    // Remove after first success or attempt
    window.removeEventListener('click', handleInteraction);
  };

  window.addEventListener('click', handleInteraction, { once: true });
}

// History Guard: Prevent Back Button from exiting the app
function enableHistoryGuard() {
  if (!window.history.state || window.history.state.page !== 'guard') {
    history.pushState({ page: 'guard' }, '', '');
  }

  window.addEventListener('popstate', () => {
    history.pushState({ page: 'guard' }, '', '');
  });
}

// Start with Title Screen or Mobile Start Screen
let titleScreen: TitleScreen | null = null;
if (ScreenUtils.isMobile() && !ScreenUtils.isStandalone()) {
  new MobileStartScreen(() => {
    titleScreen = new TitleScreen(() => {
      titleScreen = null;
      mainMenu = new MainMenu(handleGameStart);
      mainMenu.show();
    });
  });
} else {
  titleScreen = new TitleScreen(() => {
    titleScreen = null;
    mainMenu = new MainMenu(handleGameStart);
    mainMenu.show();
  });
}

// --- Mobile Initialization ---
const initMobile = () => {
  if (ScreenUtils.isMobile()) {
    if (ScreenUtils.isStandalone()) {
      setupGlobalInteraction();
      enableHistoryGuard();
    }

    // Initial size update
    updateCanvasSize();

    window.addEventListener('resize', () => {
      updateCanvasSize();
      // Only orientation lock without gesture if we're already fullscreen
      if (document.fullscreenElement && ScreenUtils.isStandalone()) {
        enforceLandscape(false);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && document.fullscreenElement && ScreenUtils.isStandalone()) {
        enforceLandscape(false);
      }
    });
  } else {
    window.addEventListener('resize', updateCanvasSize);
  }
};

initMobile();

// Global Resize Handler
window.addEventListener('resize', updateCanvasSize);

async function launchGame(GameClass: any) {
  if (isLaunching) return;
  isLaunching = true;

  try {
    MenuMusicManager.getInstance().stopMusic();

    // Ensure we are in landscape mode on mobile (user gesture confirmed here)
    await enforceLandscape(true);

    loopCounter++; // Increment to invalidate previous loops

    // Clear ALL UI before switching
    UIManager.getInstance().clear();

    // Reset Canvas State with Virtual Dimensions
    updateCanvasSize();

    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    currentGame = new GameClass(canvas);

    console.log(`Initializing ${GameClass.name}...`);
    await currentGame.init();

    console.log("Loading assets...");
    await currentGame.load();

    console.log("Starting display...");
    currentGame.create();

    // Reset Loop State
    lastTime = performance.now();
    fpsFrameCount = 0;

    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("Game launch failed:", error);
    returnToMenu();
  } finally {
    isLaunching = false;
  }
}

function returnToMenu(): void {
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }

  // Clear Game Canvas to prevent overlap/ghosting
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
