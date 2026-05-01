// ============================================================
// [CRITICAL] Legacy Data Cleanup — runs BEFORE anything else
// Removes all old localStorage keys from previous versions to prevent
// zombie data from being displayed by cached old code.
// ============================================================
(() => {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.includes('nexussphere_highscores_v2') ||
                key.includes('nexussphere_highscores_v3') ||
                key.includes('NexusSphere_Favorites_v2') ||
                key.includes('NexusSphere_Favorites_v3') ||
                key.includes('nexus-stats-v2') ||
                key.includes('nexus-stats-v3') ||
                key.includes('nexus-song-records-v2') ||
                key.includes('nexus-song-records-v3')
            )) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        if (keysToRemove.length > 0) {
            console.log(`[Cleanup] Removed ${keysToRemove.length} legacy localStorage keys`);
        }
    } catch (e) { /* ignore */ }

    // Force Service Worker update: unregister old SW so new one takes over immediately
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(reg => {
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
                reg.update();
            });
        });
    }
})();

import './style.css';
import { PongGame } from './games/puzzle/PongGame';
import { RhythmGame } from './games/rhythm/RhythmGame';
import { EditorGame } from './games/editor/EditorGame';
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
import { MobileFullscreenExitScreen } from './ui/MobileFullscreenExitScreen';
import { AuthService } from './services/auth/AuthService';


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

// Initial FPS Visibility v50
const initialShowFps = localStorage.getItem('nexus_show_fps') === 'true';
fpsDiv.style.display = initialShowFps ? 'block' : 'none';

document.body.appendChild(fpsDiv);

// Listener for Setting Changes
window.addEventListener('nexus-setting-changed', (e: any) => {
  if (e.detail.key === 'nexus_show_fps') {
    fpsDiv.style.display = e.detail.value ? 'block' : 'none';
  }
});

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
      await document.documentElement.requestFullscreen().catch(() => {
        // Silently ignore: Common browser security restriction
      });

      // Small delay to allow browser to transition before locking
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 2. Screen Orientation Lock - USUALLY REQUIRES FULLSCREEN
    if (screen.orientation && (screen.orientation as any).lock) {
      // Add a small 2s timeout for the lock itself so it doesn't hang the entire loading process
      const lockPromise = (screen.orientation as any).lock('landscape');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000));
      
      await Promise.race([lockPromise, timeoutPromise]).catch(() => {
        // Silently ignore: Often not supported on desktop or restricted on mobile
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
    // AUDIO UNLOCK: The first user gesture unlocks the AudioContext for all audio.
    globalAudioEngine.resume();
    MenuMusicManager.getInstance().tryUnblock();
  };

  window.addEventListener('click', handleInteraction, { once: true });
  window.addEventListener('touchstart', handleInteraction, { once: true });
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
  const isMobile = ScreenUtils.isMobile() && !ScreenUtils.isStandalone();
  const loading = LoadingOverlay.getInstance();
  
  // [OPTIMIZATION] On mobile, we skip the global loading overlay initially to prevent 
  // the "half-cut" portrait canvas flicker before the full-screen request UI.
  if (!isMobile) {
    loading.show("INITIALIZING NEXUS SPHERE...");
  }
  
  // Define initialization tasks as a promise to handle mobile background loading
  const baseInitTask = (async () => {
    // Initialize Auth Service
    try {
      await AuthService.getInstance().init();
      
      const auth = AuthService.getInstance();
      if (auth.isSignedIn()) {
          const { ScoreManager } = await import('./core/score/ScoreManager');
          await ScoreManager.getInstance().syncWithServer();
      }
    } catch (e) {
      console.error("[main] Failed to initialize AuthService. Proceeding as Guest.", e);
    }

    // Wait for initial theme background assets (Shaders, etc)
    await BackgroundRenderer.getInstance().waitForReady((p) => {
      if (!isMobile) loading.updateProgress(p);
    });
  })();

  // Register the global interaction handler for ALL platforms (audio unlock + fullscreen)
  setupGlobalInteraction();

  if (isMobile) {
    // On mobile, show the user-gesture request screen IMMEDIATELY
    new MobileStartScreen(async () => {
      // MobileStartScreen tap IS the first user gesture — unlock audio immediately
      globalAudioEngine.resume(); // Unlock primary engine
      MenuMusicManager.getInstance().tryUnblock();
      
      // Ensure background initialization is complete before transitioning to Title
      // (Usually fast enough that it's already done by the time the user reads the screen)
      await baseInitTask;
      showTitle();
    });
  } else {
    // On PC/Standalone, wait for init then show title
    await baseInitTask;
    await showTitle();
    loading.hide();
  }
};

import { SystemInitializer } from './core/SystemInitializer';

const showTitle = async () => {
  // 1. Start background initialization immediately
  const initPromise = SystemInitializer.getInstance().run((p, status) => {
    if (titleScreen) {
      titleScreen.setProgress(p);
      titleScreen.setStatus(status);
    }
  });

  titleScreen = new TitleScreen(async () => {
    // 2. Unlock Audio immediately on the "PUSH START" click
    globalAudioEngine.resume();
    
    // 3. Wait for initialization if not finished
    const loading = LoadingOverlay.getInstance();
    loading.show("FINISHING INITIALIZATION...");
    
    // Safety check: ensure background and library are 100% ready
    await Promise.all([
      BackgroundRenderer.getInstance().waitForReady((p) => loading.updateProgress(p)),
      initPromise
    ]);

    if (titleScreen) titleScreen.destroy();
    titleScreen = null;
    
    loading.hide();
    
    // [STABILITY] Enable history guard ONLY after auth processing and title interaction are done.
    // We add a small delay to ensure Clerk has finished its URL cleanup (replaceState) to avoid SecurityErrors.
    setTimeout(() => {
        console.log("[main] Activating History Guard...");
        enableHistoryGuard();
    }, 500);
    
    mainMenu = new MainMenu(handleGameStart);
    mainMenu.show();
  });

  // Wait for TitleScreen to be visually ready (background loaded)
  await titleScreen.waitForReady();
};

startApp();

// --- Mobile Initialization ---
const initMobile = () => {
  if (ScreenUtils.isMobile()) {
    if (ScreenUtils.isStandalone()) {
      setupGlobalInteraction();
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
      const isHidden = document.visibilityState === 'hidden';

      if (isHidden) {
        console.log("[Main] Page hidden. Pausing audio and game state...");
        
        // 1. Pause active game
        if (currentGame) {
          currentGame.pause();
        }

        // 2. Pause Menu BGM
        MenuMusicManager.getInstance().pauseMusic(true);

      } else {
        console.log("[Main] Page visible. Resuming necessary services...");

        // 1. Force Resume AudioContext (Critical for mobile after sleep)
        globalAudioEngine.resume();

        // 2. Resume Menu BGM only if it was auto-paused
        const musicManager = MenuMusicManager.getInstance();
        if (!currentGame && musicManager.shouldResume()) {
          musicManager.resumeMusic();
        }

        // 3. For orientation lock (existing logic)
        if (document.fullscreenElement && ScreenUtils.isStandalone()) {
          enforceLandscape(false);
        }
      }
    });

    // Handle Fullscreen Exit on Mobile
    document.addEventListener('fullscreenchange', () => {
      // If mobile, not standalone (PWA), and fullscreen is exited
      if (ScreenUtils.isMobile() && !ScreenUtils.isStandalone()) {
        const isStartScreenActive = !!document.getElementById('mobile-start-screen');
        const isExitScreenActive = !!document.getElementById('mobile-fullscreen-exit-screen');
        
        if (!document.fullscreenElement && !isStartScreenActive && !isExitScreenActive) {
          console.log("[Main] Fullscreen exited on mobile. Forcing refresh screen.");
          new MobileFullscreenExitScreen();
        }
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
  // ROOT UNLOCK: Claim audio ownership immediately on the user gesture stack
  // before any async launch orchestration begins.
  globalAudioEngine.resume();

  if (mode === 'rhythm') {
    launchGame(RhythmGame);
  } else if (mode === 'pong') {
    launchGame(PongGame);
  } else if (mode === 'editor') {
    launchGame(EditorGame);
  }
}


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


