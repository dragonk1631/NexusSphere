@echo off
title NexusSphere - Full Stack Development
echo ======================================================
echo   NexusSphere - Global Ranking System Dev Mode
echo ======================================================
echo.
echo [1/2] Starting BACKEND (Wrangler/D1 Database)...
echo.

:: Start backend on Port 8788 (configured in wrangler.toml)
start "NexusSphere Backend" cmd /k "npm run dev:server"

:: Wait for backend to stabilize
timeout /t 5 /nobreak > nul

echo.
echo [2/2] Starting FRONTEND (Vite/HTTPS)...
echo.

:: Start Frontend on Port 5173
start "NexusSphere Frontend" cmd /k "npm run dev"

:: Open browser after a small delay
timeout /t 5 /nobreak > nul
start "" "https://localhost:5173"

echo.
echo ======================================================
echo   Launch Complete! Both servers are running.
echo   Check the separate windows for logs.
echo ======================================================
