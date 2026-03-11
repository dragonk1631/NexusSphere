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
let lastRenderTimestamp = 0;
let accumulator = 0;
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

PerformanceMonitor.start();

function gameLoop(timestamp: number) {
  // Prevent potential undefined timestamp on first call
  if (!timestamp) timestamp = performance.now();

  PerformanceMonitor.recordFrame();

  // --- FPS Update ---
  if (timestamp - fpsLastTime >= 1000) {
    currentFps = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = timestamp;
    
    // Get extended performance metrics
    const snapshot = PerformanceMonitor.getSnapshot(currentFps);
    
    fpsDiv.innerText = `FPS: ${currentFps} | JS: ${snapshot.workDuration}ms | Jit: ${snapshot.jitter}ms | Stall: ${snapshot.longTasks}`;

    // Color Coding for Performance Monitoring
    if (currentFps >= 58 && snapshot.jitter < 5) fpsDiv.style.color = '#00ff00';      // Green (Good)
    else if (currentFps >= 30 || snapshot.jitter < 15) fpsDiv.style.color = '#ffff00'; // Yellow (Warning)
    else fpsDiv.style.color = '#ff0000';                       // Red (Bad)

    // Log load metrics to console periodically
    AudioEngineLogger.metric('RENDER', `FPS: ${currentFps}, Jitter: ${snapshot.jitter}ms, Stalls: ${snapshot.longTasks}`);
  }

  PerformanceMonitor.beginFrame();

  if (!currentGame) {
    PerformanceMonitor.endFrame();
    return;
  }

  const currentLoopId = loopCounter;
  const FIXED_STEP = 1000 / 60; // 16.66ms
  const MAX_ACCUMULATION = 200;

  if (!lastTime) lastTime = timestamp;
  let frameTime = timestamp - lastTime;
  lastTime = timestamp;

  // Cap frame time to prevent spiraling after backgrounding
  if (frameTime > MAX_ACCUMULATION) frameTime = FIXED_STEP;

  // Track elapsed for updates in the persistent accumulator
  accumulator += frameTime;
  
  // Update logic: catch up with fixed steps
  // This ensures game logic runs at 60Hz regardless of display refresh rate
  while (accumulator >= FIXED_STEP) {
    if (currentGame) {
      currentGame.update(FIXED_STEP);
    }
    accumulator -= FIXED_STEP;
  }

  // Render logic: 
  // On 120Hz/90Hz, we still ideally want to render at 60fps to save battery.
  // We use a 'lastRenderTimestamp' check, but with a more forgiving 'fuzzy' 
  // window to avoid the 40fps plateau caused by 1-2ms jitters.
  const now = performance.now();
  const timeSinceLastRender = now - lastRenderTimestamp;
  const TARGET_RENDER_INTERVAL = 1000 / 60;

  // Allow a 4ms buffer (approx 1/4 of a 60Hz frame or 1/2 of 120Hz frame)
  // to ensure that if a 120Hz vsync arrives at 16.0ms instead of 16.6ms, 
  // we still grab it for 60fps instead of waiting for 25ms.
  if (timeSinceLastRender >= TARGET_RENDER_INTERVAL - 4) {
    if (currentGame) {
      currentGame.render();
      lastRenderTimestamp = now;
      fpsFrameCount++;
    }
  }

  PerformanceMonitor.endFrame();

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
    MenuMusicManager.getInstance(globalAudioEngine).stopMusic();

    console.log("[Launch] Entering enforceLandscape...");
    console.time("launch_enforceLandscape");
    await enforceLandscape(true);
    console.timeEnd("launch_enforceLandscape");

    loopCounter++; // Increment to invalidate previous loops

    // Clear ALL UI before switching
    UIManager.getInstance().clear();

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
    currentGame.create();
    console.timeEnd("launch_create");

    // Reset Loop State
    lastTime = performance.now();
    lastRenderTimestamp = lastTime;
    accumulator = 0;
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
