/**
 * presets.js — Carrega e gerencia os casos de estudo pré-definidos.
 */

'use strict';

let PRESETS_DATA = null;

/**
 * Carrega os presets do arquivo JSON.
 * @returns {Promise<Array>}
 */
async function carregarPresets() {
  if (PRESETS_DATA) return PRESETS_DATA;
  try {
    const response = await fetch('./data/presets.json');
    const json = await response.json();
    PRESETS_DATA = json.presets;
    return PRESETS_DATA;
  } catch (e) {
    console.error('Erro ao carregar presets:', e);
    return [];
  }
}

/**
 * Carrega presets personalizados do localStorage.
 * @returns {Array}
 */
function carregarPresetsPersonalizados() {
  try {
    const raw = localStorage.getItem('presets_personalizados');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Salva um preset personalizado no localStorage.
 * @param {Object} preset
 */
function salvarPresetPersonalizado(preset) {
  const existentes = carregarPresetsPersonalizados();
  const idx = existentes.findIndex(p => p.id === preset.id);
  if (idx >= 0) {
    existentes[idx] = preset;
  } else {
    existentes.push(preset);
  }
  localStorage.setItem('presets_personalizados', JSON.stringify(existentes));
}

/**
 * Remove um preset personalizado.
 * @param {string} id
 */
function removerPresetPersonalizado(id) {
  const existentes = carregarPresetsPersonalizados();
  const novos = existentes.filter(p => p.id !== id);
  localStorage.setItem('presets_personalizados', JSON.stringify(novos));
}

/**
 * Obtém todos os presets (embutidos + personalizados).
 * @returns {Promise<Array>}
 */
async function todosPresets() {
  const embutidos = await carregarPresets();
  const personalizados = carregarPresetsPersonalizados().map(p => ({
    ...p,
    _personalizado: true,
  }));
  return [...embutidos, ...personalizados];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { carregarPresets, carregarPresetsPersonalizados, salvarPresetPersonalizado, removerPresetPersonalizado, todosPresets };
} else {
  window.Presets = { carregarPresets, carregarPresetsPersonalizados, salvarPresetPersonalizado, removerPresetPersonalizado, todosPresets };
}
