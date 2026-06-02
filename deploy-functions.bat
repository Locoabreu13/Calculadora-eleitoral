@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   RetotalizaJE - Publicar funcoes do servidor (Firebase)
echo ============================================================
echo.
echo Isso publica a logica de creditos/anti-fraude no servidor.
echo (Nao mexe no site - o site e publicado pelos git-push.)
echo.

where firebase >nul 2>nul
if errorlevel 1 (
  echo [ERRO] A ferramenta "firebase" nao foi encontrada.
  echo.
  echo Faca a instalacao uma unica vez:
  echo   1^) Instale o Node.js: https://nodejs.org  ^(versao LTS^)
  echo   2^) Abra o Prompt de Comando e rode:  npm install -g firebase-tools
  echo   3^) Faca login uma vez:                firebase login
  echo   4^) Rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo Publicando... (pode levar 1 a 2 minutos)
echo.
call firebase deploy --only functions

echo.
echo ------------------------------------------------------------
echo   Concluido. Confira acima se apareceu "Deploy complete!".
echo ------------------------------------------------------------
pause
