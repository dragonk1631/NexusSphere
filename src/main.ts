import './style.css';
import { PongGame } from './games/puzzle/PongGame';
import { RhythmGame } from './games/rhythm/RhythmGame';

const portalUI = document.getElementById('portal-ui')!;
const gameContainer = document.getElementById('game-container')!;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const startPongBtn = document.getElementById('start-pong')!;
const startRhythmBtn = document.getElementById('start-rhythm')!;

let currentGame: any = null;
let lastTime = 0;

function gameLoop(timestamp: number) {
  if (!currentGame) return;

  const delta = timestamp - lastTime;
  lastTime = timestamp;

  currentGame.update(delta);
  requestAnimationFrame(gameLoop);
}

async function launchGame(GameClass: any) {
  portalUI.style.display = 'none';
  gameContainer.style.display = 'block';

  // 캔버스 크기 설정
  canvas.width = 800;
  canvas.height = 600;

  if (currentGame) {
    currentGame.destroy();
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
    portalUI.style.display = 'block';
    gameContainer.style.display = 'none';
  }
}

startPongBtn.addEventListener('click', () => {
  launchGame(PongGame);
});

startRhythmBtn.addEventListener('click', () => {
  launchGame(RhythmGame);
});
