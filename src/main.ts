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
let lastRenderTimestamp = 0;
let loopCounter = 0;
let mainMenu: MainMenu;

// FPS Counter Variables
const fpsDiv = document.createElement('div');
fpsDiv.id = 'fps-counter';
fpsDiv.style.cssText = "position:fixed; top:5px; left:5px; background:rgba(0,0,0,0.5); color:#00ff00; padding:2px 6px; z-index:99999; font-size:14px; pointer-events:none; font-family:monospace; border-radius:4px; font-weight:bold;";
fpsDiv.innerText = `FPS: --`;
document.body.appendChild(fpsDiv);

let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let currentFps = 0;

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

  // --- FPS LIMITER ---
  const TARGET_FPS = 60;
  const RENDER_INTERVAL = 1000 / TARGET_FPS;

  // --- ACCUMULATOR-BASED FIXED STEP LOOP ---
  const INTERVAL = 1000 / 60; // 16.666ms
  const MAX_ACCUMULATED_TIME = 200; // Panic threshold (200ms)

  if (!lastTime) lastTime = timestamp;
  let elapsed = timestamp - lastTime;

  // Cap elapsed time to prevent "Spiral of Death"
  if (elapsed > MAX_ACCUMULATED_TIME) {
    elapsed = INTERVAL; // Force a jump/skip if lag is too extreme
    lastTime = timestamp - INTERVAL;
  }

  // --- CATCH-UP LOGIC ---
  // If lag occurs, we run multiple update steps but only ONE render step.
  while (elapsed >= INTERVAL) {
    if (currentGame) {
      currentGame.update(INTERVAL);
    }
    elapsed -= INTERVAL;
    lastTime += INTERVAL;
  }

  // --- RENDER (WITH FPS LIMIT) ---
  if (currentGame) {
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimestamp;

    // Only render if target interval has passed (e.g. 16.6ms for 60fps)
    // This effectively caps 90Hz/120Hz displays to 60fps to save battery/heat.
    if (timeSinceLastRender >= RENDER_INTERVAL - 1) { // -1 for small buffer
      currentGame.render();
      lastRenderTimestamp = now;
      fpsFrameCount++;
    }
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
