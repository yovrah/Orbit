@echo off
title Orbit HTTPS Tunnel
echo Starting secure public HTTPS tunnel on port 23810...
echo --------------------------------------------------
echo Note: This bypasses browser HTTPS Mixed Content blocks 
echo and allows remote control over cellular data (4G/5G).
echo --------------------------------------------------
npx localtunnel --port 23810
pause
