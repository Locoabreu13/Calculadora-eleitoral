@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ╔══════════════════════════════════════════╗
echo ║  RetotalizaJE — Gerenciar Créditos       ║
echo ╚══════════════════════════════════════════╝
echo.

if not exist "chave-firebase.json" (
  echo ❌ Arquivo "chave-firebase.json" nao encontrado.
  echo.
  echo Como obter:
  echo  1. Acesse: https://console.firebase.google.com/project/calculadora-eleitoral-60f59/settings/serviceaccounts/adminsdk
  echo  2. Clique em "Gerar nova chave privada"
  echo  3. Renomeie o arquivo baixado para:  chave-firebase.json
  echo  4. Coloque na mesma pasta que este arquivo .bat
  echo  5. Rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

node scripts\admin-creditos.js

pause
