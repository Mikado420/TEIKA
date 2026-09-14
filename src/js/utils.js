/** 定数 **/
export const CHART_PADDING_TOP = 130,
  CHART_PADDING_BOTTOM = 20,
  CHART_BG = '#cccccc';

export const ROW_MARGIN_BOTTOM = 20,
  ROW_HEIGHT_INFO = 18,
  ROW_HEIGHT_NOTE = 34,
  ROW_HEIGHT = ROW_HEIGHT_INFO + ROW_HEIGHT_NOTE;

export const ROW_OFFSET_NOTE_CENTER = ROW_HEIGHT_INFO + ROW_HEIGHT_NOTE / 2,
  ROW_LEADING = 30,
  ROW_TRAILING = 30,
  BEAT_WIDTH = 48,
  NOTE_RADIUS = 9;

export const formatBpm = val => Math.round(val * 1000) / 1000;

export const getNoteX = beat => ROW_LEADING + beat * BEAT_WIDTH;

export const getRowY = row => CHART_PADDING_TOP + (ROW_HEIGHT + ROW_MARGIN_BOTTOM) * row;

/** mc2tja 統合ロジック **/

/** mc2tja 統合ロジック **/
export const gcd = (a, b) => b ? gcd(b, a % b) : a;

export const lcm = (a, b) => a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b);

export async function loadFileWithEncoding(arrayBuffer) {
  const ui8 = new Uint8Array(arrayBuffer);
  try {
    return new TextDecoder('utf-8', {
      fatal: true
    }).decode(ui8);
  } catch (e) {
    return new TextDecoder('shift-jis').decode(ui8);
  }
}

export function calculateEasing(t, type) {
  switch (type) {
    case 0:
    default:
      return t;
  }
}

export function escapeHtml(string) {
  return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}