#!/bin/bash
# admin-creditos.sh — Adicionar créditos a um usuário (Mac/Linux)
# Uso: ./admin-creditos.sh  (ou dar dois cliques no Finder)

cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  RetotalizaJE — Gerenciar Créditos       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ ! -f "chave-firebase.json" ]; then
  echo "❌ Arquivo 'chave-firebase.json' não encontrado."
  echo ""
  echo "Como obter:"
  echo "  1. Acesse: https://console.firebase.google.com/project/calculadora-eleitoral-60f59/settings/serviceaccounts/adminsdk"
  echo "  2. Clique em 'Gerar nova chave privada'"
  echo "  3. Renomeie o arquivo baixado para: chave-firebase.json"
  echo "  4. Coloque na mesma pasta que este script"
  echo "  5. Rode de novo: ./admin-creditos.sh"
  echo ""
  read -p "Pressione Enter para fechar..."
  exit 1
fi

node scripts/admin-creditos.js

read -p "Pressione Enter para fechar..."
