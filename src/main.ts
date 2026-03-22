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
import { CoreAudioEngine } from './core/audio/CoreAudioEngine';
import { LoadingOverlay } from './games/rhythm/renderer/LoadingOverlay';
import { PerformanceMonitor } from './core/utils/PerformanceMonitor';
import { AudioEngineLogger } from './core/audio/AudioEngineLogger';

// Initialize Global Managers
const globalAudioEngine = new CoreAudioEngine();
UIManager.getInstance();
BackgroundRenderer.getInstance();
MenuMusicManager.getInstance(globalAudioEngine);

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
let currentGame: any = null;

let lastTime = 0;
let accumulator = 0;
// let loopCounter = 0;
let mainMenu: MainMenu;
let titleScreen: TitleScreen | null = null;

// FPS Counter Variables
const fpsDiv = document.createElement('div');
fpsDiv.id = 'fps-counter';
fpsDiv.style.cssText = "position:fixed; top:5px; left:5px; background:rgba(0,0,0,0.5); color:#00ff00; padding:2px 6px; z-index:99999; font-size:14px; pointer-events:none; font-family:monospace; border-radius:4px; font-weight:bold;";
fpsDiv.innerText = `FPS: --`;
document.body.appendChild(fpsDiv);

let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let currentFps = 0;

PerformanceMonitor.start();

PerformanceMonitor.start();

function updateFPSCounter(timestamp: number) {
  if (timestamp - fpsLastTime >= 1000) {
    currentFps = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = timestamp;
    
    const snapshot = PerformanceMonitor.getSnapshot(currentFps);
    fpsDiv.innerText = `FPS: ${currentFps} | JS: ${snapshot.workDuration}ms | Jit: ${snapshot.jitter}ms | Stall: ${snapshot.longTasks}`;

    if (currentFps >= 58 && snapshot.jitter < 5) fpsDiv.style.color = '#00ff00';
    else if (currentFps >= 30 || snapshot.jitter < 15) fpsDiv.style.color = '#ffff00';
    else fpsDiv.style.color = '#ff0000';

    AudioEngineLogger.metric('RENDER', `FPS: ${currentFps}, Jitter: ${snapshot.jitter}ms, Stalls: ${snapshot.longTasks}`);
  }
}

function gameLoop(timestamp: number) {
  if (!timestamp) timestamp = performance.now();

  updateFPSCounter(timestamp);

  PerformanceMonitor.recordFrame();
  PerformanceMonitor.beginFrame();

  const FIXED_STEP = 1000 / 60;

  if (!lastTime) lastTime = timestamp;
  let frameTime = timestamp - lastTime;
  lastTime = timestamp;

  // Limit accumulation to prevent "death spiral"
  if (frameTime > 250) frameTime = FIXED_STEP;

  accumulator += frameTime;
  
  // Logic Update (Locked at 60Hz)
  while (accumulator >= FIXED_STEP) {
    if (currentGame) {
      currentGame.update(FIXED_STEP);
    }
    accumulator -= FIXED_STEP;
  }

  // Render Logic (VSync Aligned + Interpolation)
  // Calculate interpolation alpha: how far we are between the last and next fixed update
  const interpolationAlpha = accumulator / FIXED_STEP;

  // Clear Main Canvas once per frame before any rendering
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // 1. SIGNAL BACKGROUND WORKER (Every VSync for maximum smoothness)
  BackgroundRenderer.getInstance().requestFrame(timestamp);

  // 2. RENDER TITLE SCREEN (if active)
  if (titleScreen) {
    titleScreen.updateAndRender(timestamp, interpolationAlpha);
  }

  // 3. RENDER GAME (if active)
  if (currentGame) {
    currentGame.render(interpolationAlpha);
  }

  fpsFrameCount++;
  PerformanceMonitor.endFrame();
  requestAnimationFrame(gameLoop);
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
      // Add a small 2s timeout for the lock itself so it doesn't hang the entire loading process
      const lockPromise = (screen.orientation as any).lock('landscape');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
      
      await Promise.race([lockPromise, timeoutPromise]).catch((err) => {
        console.warn("[enforceLandscape] Orientation lock skipped or timed out:", err);
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
const startApp = async () => {
  const loading = LoadingOverlay.getInstance();
  loading.show("INITIALIZING NEXUS SPHERE...");
  
  // Wait for initial theme background
  await BackgroundRenderer.getInstance().waitForReady((p) => loading.updateProgress(p));
  
  loading.hide();

  if (ScreenUtils.isMobile() && !ScreenUtils.isStandalone()) {
    new MobileStartScreen(() => {
      showTitle();
    });
  } else {
    showTitle();
  }
};

const showTitle = () => {
  titleScreen = new TitleScreen(async () => {
    if (titleScreen) titleScreen.destroy();
    titleScreen = null;
    
    const loading = LoadingOverlay.getInstance();
    loading.show("LOADING MAIN MENU...");
    
    // Ensure background is ready (in case theme changed)
    await BackgroundRenderer.getInstance().waitForReady((p) => loading.updateProgress(p));
    
    loading.hide();
    mainMenu = new MainMenu(handleGameStart);
    mainMenu.show();
  });
};

startApp();

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
    MenuMusicManager.getInstance(globalAudioEngine).stopMusic();

    console.log("[Launch] Entering enforceLandscape...");
    console.time("launch_enforceLandscape");
    await enforceLandscape(true);
    console.timeEnd("launch_enforceLandscape");


    // Clear ALL UI before switching
    UIManager.getInstance().clear();

    const loading = LoadingOverlay.getInstance();
    loading.show(`LAUNCHING ${GameClass.name.toUpperCase()}...`);

    // Ensure background is ready
    await BackgroundRenderer.getInstance().waitForReady((p) => loading.updateProgress(p));

    // Reset Canvas State with Virtual Dimensions
    updateCanvasSize();

    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }

    currentGame = new GameClass(canvas, globalAudioEngine);

    console.log(`[Launch] Initializing ${GameClass.name}...`);
    console.time("launch_init");
    await currentGame.init();
    console.timeEnd("launch_init");

    console.log("[Launch] Loading assets...");
    console.time("launch_load");
    await currentGame.load();
    console.timeEnd("launch_load");

    console.log("[Launch] Starting display...");
    console.time("launch_create");
    await currentGame.create();
    console.timeEnd("launch_create");

    loading.hide();

    // Reset Loop State
    lastTime = performance.now();
    accumulator = 0;
    fpsFrameCount = 0;

    // requestAnimationFrame(gameLoop); // Managed globally
  } catch (error) {
    console.error("Game launch failed:", error);
    returnToMenu();
  } finally {
    isLaunching = false;
  }
}

function returnToMenu(): void {
  const loading = LoadingOverlay.getInstance();
  loading.show("RETURNING TO MENU...");

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

  // Wait for background readiness before showing menu
  BackgroundRenderer.getInstance().waitForReady().then(() => {
    loading.hide();
    mainMenu = new MainMenu(handleGameStart);
    mainMenu.show();
  });
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

requestAnimationFrame(gameLoop);


