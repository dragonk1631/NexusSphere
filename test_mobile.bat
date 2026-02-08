@echo off
title NexusSphere - PC & Mobile Test
echo ======================================================
echo   NexusSphere - PC & Mobile Multi-Device Test
echo ======================================================
echo.
echo [ STEP 1 ] PC Testing:
echo   The local preview will open in your default browser.
echo.
echo [ STEP 2 ] Mobile Testing:
echo   1. Connect your phone to the SAME Wi-Fi as this PC.
echo   2. Find your "IPv4 Address" in the list below.
echo   3. Enter "https://[IP Address]:5173" in your phone's browser.
echo.
echo [ ! IMPORTANT ! ]
echo   - The server is now running on SECURE HTTPS.
echo   - Your mobile browser will warn about a "Private Connection".
echo   - Click "Advanced" and then "Proceed to [IP Address] (unsafe)".
echo   - This is REQUIRED for high-quality audio (AudioWorklet) to work.
echo.
echo ------------------------------------------------------
echo [ YOUR LOCAL IP ADDRESSES ]
ipconfig | findstr /i "IPv4"
echo ------------------------------------------------------
echo.
echo Starting Vite server (HTTPS enabled)...
echo.

:: Open local browser in 2 seconds
start "" "https://localhost:5173"

:: Run Vite with host access
npm run dev:host
