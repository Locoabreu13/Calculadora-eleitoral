/* ============================================================
   Redimensionamento do painel da esquerda (sidebar)
   - Arraste o divisor para aumentar/diminuir a largura
   - Duplo clique no divisor = volta ao padrão
   - Teclado: foque o divisor e use ← / → (Home = padrão)
   - A largura escolhida fica salva (localStorage) entre sessões
   Não toca no motor (engine.js) nem nos dados — só ajusta o layout.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'rje:sidebar-w';
  var MIN = 240;          // largura mínima da sidebar (px)
  var MAX = 680;          // largura máxima da sidebar (px)
  var MIN_CONTENT = 360;  // espaço mínimo garantido para a área da direita (px)
  var STEP = 16;          // passo do teclado (px)

  function q(sel) { return document.querySelector(sel); }

  function setWidth(px) {
    var sb = q('.sidebar');
    if (!sb) return;
    sb.style.width = px + 'px';
    sb.style.minWidth = px + 'px';
    sb.style.maxWidth = px + 'px';
  }

  function clearWidth() {
    var sb = q('.sidebar');
    if (!sb) return;
    sb.style.width = sb.style.minWidth = sb.style.maxWidth = '';
  }

  function clamp(w, bodyWidth) {
    if (w < MIN) w = MIN;
    if (w > MAX) w = MAX;
    var maxByContent = bodyWidth - MIN_CONTENT;
    if (w > maxByContent) w = Math.max(MIN, maxByContent);
    return Math.round(w);
  }

  function stacked() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function init() {
    var body = q('.app-body');
    var sb = q('.sidebar');
    var rez = q('#sidebar-resizer');
    if (!body || !sb || !rez) return;

    // Restaura largura salva (só na layout lado-a-lado)
    var saved = parseInt(localStorage.getItem(KEY), 10);
    if (saved && !stacked()) {
      setWidth(clamp(saved, body.getBoundingClientRect().width));
    }

    var dragging = false;

    function onMove(e) {
      if (!dragging) return;
      var rect = body.getBoundingClientRect();
      var w = clamp(e.clientX - rect.left, rect.width);
      setWidth(w);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      rez.classList.remove('is-dragging');
      document.body.classList.remove('resizing-x');
      var w = parseInt(q('.sidebar').style.width, 10);
      if (w) localStorage.setItem(KEY, w);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }

    rez.addEventListener('pointerdown', function (e) {
      if (stacked()) return;          // não arrasta quando empilhado
      e.preventDefault();
      dragging = true;
      rez.classList.add('is-dragging');
      document.body.classList.add('resizing-x');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // Duplo clique = voltar ao padrão responsivo
    rez.addEventListener('dblclick', function () {
      clearWidth();
      localStorage.removeItem(KEY);
    });

    // Acessibilidade por teclado
    rez.addEventListener('keydown', function (e) {
      if (stacked()) return;
      var rect = body.getBoundingClientRect();
      var cur = parseInt(q('.sidebar').style.width, 10) ||
                Math.round(q('.sidebar').getBoundingClientRect().width);
      if (e.key === 'ArrowLeft')  { e.preventDefault(); var l = clamp(cur - STEP, rect.width); setWidth(l); localStorage.setItem(KEY, l); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); var r = clamp(cur + STEP, rect.width); setWidth(r); localStorage.setItem(KEY, r); }
      else if (e.key === 'Home')  { e.preventDefault(); clearWidth(); localStorage.removeItem(KEY); }
    });

    // Se a tela mudar para empilhada, remove a largura fixa
    window.addEventListener('resize', function () {
      if (stacked()) clearWidth();
      else {
        var s = parseInt(localStorage.getItem(KEY), 10);
        if (s) setWidth(clamp(s, body.getBoundingClientRect().width));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
