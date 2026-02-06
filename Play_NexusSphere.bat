@echo off
chcp 65001 > nul
setlocal

echo ==========================================
echo       NexusSphere 게임을 시작합니다
echo ==========================================
echo.
echo [1/3] 작업 디렉토리로 이동 중...
cd /d "%~dp0"

echo [2/3] 브라우저를 실행합니다...
start http://localhost:5173

echo [3/3] 게임 서버(Vite)를 시작합니다...
echo.
echo * 서버가 실행되면 게임을 즐기세요!
echo * 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo.

call npm run dev

pause
