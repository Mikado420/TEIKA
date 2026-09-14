import { processFunc } from "./app.js";
import { escapeHtml } from './utils.js';
import { state } from './state.js';

/** グラデーション置換ロジック **/
export function replaceGradation() {
  const editor = u('.input').first();
  let text = editor.value;
  const getInitialState = (fullText, startIndex) => {
    let bpm = 120,
      measure = [4, 4];
    const lines = fullText.substring(0, startIndex).split(/\r?\n/);
    for (let line of lines) {
      const rawLine = line.split('//')[0].trim();
      if (!rawLine) continue;
      const parts = rawLine.split(/[ \t]+/);
      const cmdName = parts[0].toUpperCase();
      if (rawLine.toUpperCase().startsWith('BPM:')) bpm = parseFloat(rawLine.substring(4).trim()) || bpm;
      if (cmdName === '#BPMCHANGE') bpm = parseFloat(parts[1]) || bpm;
      if (cmdName === '#MEASURE') {
        const v = parts[1];
        if (v && v.includes('/')) {
          const p = v.split('/');
          measure = [parseInt(p[0]) || 4, parseInt(p[1]) || 4];
        }
      }
    }
    return {
      bpm,
      measure
    };
  };
  const checkNesting = targetText => {
    const startIndices = [];
    const endIndices = [];
    let sPos = targetText.indexOf('#GRADSTART');
    while (sPos !== -1) {
      startIndices.push(sPos);
      sPos = targetText.indexOf('#GRADSTART', sPos + 10);
    }
    let ePos = targetText.indexOf('#GRADEND');
    while (ePos !== -1) {
      endIndices.push(ePos);
      ePos = targetText.indexOf('#GRADEND', ePos + 8);
    }
    if (startIndices.length !== endIndices.length) throw new Error("エラー: #GRADSTART と #GRADEND の対が一致しません。");
    const segments = [];
    for (let i = 0; i < startIndices.length; i++) {
      if (i < startIndices.length - 1 && startIndices[i + 1] < endIndices[i]) {
        throw new Error(`エラー: 行 ${targetText.substring(0, startIndices[i + 1]).split('\n').length} 付近で入れ子を検出しました。`);
      }
      segments.push({
        start: startIndices[i],
        end: endIndices[i] + 8
      });
    }
    return segments;
  };
  const isNote = token => token.length === 1 && /^[0-9A-G]$/i.test(token);
  try {
    const segments = checkNesting(text);
    if (segments.length === 0) return;
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const blockRaw = text.substring(seg.start, seg.end);
      const headerMatch = blockRaw.match(/#GRADSTART\s+([^\n]+)/);
      if (!headerMatch) continue;
      const args = headerMatch[1].trim().split(/\s+/);
      const sHS = parseFloat(args[0]),
        eHS = parseFloat(args[1]);
      const accelArg = args.find(a => a.toLowerCase().startsWith('a'));
      const accel = accelArg ? parseFloat(accelArg.substring(1)) : 1.0;
      const hasAccel = !!accelArg;
      const content = blockRaw.substring(headerMatch[0].length, blockRaw.lastIndexOf('#GRADEND')).trim();
      const initialState = getInitialState(text, seg.start);
      let curBPM = initialState.bpm,
        curMeas = [...initialState.measure],
        totalTime = 0;
      let timeline = [];
      const tokens = content.match(/(#[A-Z0-9_]+(?:[ \t]+[^\n\r]+)?|[0-9A-G]|,)/gi) || [];
      let measures = [],
        tempM = [];
      tokens.forEach(t => {
        tempM.push(t);
        if (t === ',') {
          measures.push(tempM);
          tempM = [];
        }
      });
      if (tempM.length) measures.push(tempM);
      measures.forEach(mTokens => {
        if (mTokens.filter(isNote).length === 0) {
          const commaIdx = mTokens.lastIndexOf(',');
          if (commaIdx !== -1) {
            mTokens.splice(commaIdx, 0, '0');
          } else {
            mTokens.push('0');
          }
        }
        const notesInMeas = mTokens.filter(isNote);
        const noteCountInMeasure = notesInMeas.length;
        let noteIndex = 0;
        mTokens.forEach(t => {
          if (isNote(t)) {
            const measureBeats = curMeas[0] / curMeas[1] * 4;
            const measureDurationInBeats = 60 / curBPM * measureBeats;
            const noteInterval = measureDurationInBeats / noteCountInMeasure;
            timeline.push({
              type: 'note',
              value: t,
              time: totalTime,
              isFirst: noteIndex === 0
            });
            totalTime += noteInterval;
            noteIndex++;
          } else if (t === ',') {
            timeline.push({
              type: 'comma',
              value: ',',
              time: totalTime
            });
          } else if (t.startsWith('#')) {
            const cmdParts = t.trim().split(/[ \t]+/);
            const cmdName = cmdParts[0].toUpperCase();
            if (cmdName === '#BPMCHANGE') {
              curBPM = parseFloat(cmdParts[1]) || curBPM;
              timeline.push({
                type: 'cmd',
                value: t,
                time: totalTime
              });
            } else if (cmdName === '#MEASURE') {
              const v = cmdParts[1];
              if (v && v.includes('/')) {
                const p = v.split('/');
                curMeas = [parseInt(p[0]) || 4, parseInt(p[1]) || 4];
              }
              timeline.push({
                type: 'cmd',
                value: t,
                time: totalTime
              });
            } else if (cmdName === '#DELAY') {
              const dVal = parseFloat(cmdParts[1]) || 0;
              timeline.push({
                type: 'cmd',
                value: t,
                time: totalTime
              });
              totalTime += dVal;
            } else {
              timeline.push({
                type: 'cmd',
                value: t,
                time: totalTime
              });
            }
          }
        });
      });
      let result = "",
        lastHS = -1;
      const finalDuration = totalTime;
      timeline.forEach((item, idx) => {
        const progress = finalDuration > 0 ? Math.min(1, item.time / finalDuration) : 0;
        let hs;
        if (hasAccel) {
          hs = sHS * Math.pow(eHS / sHS, Math.pow(progress, 1 + (accel - 1) * 0.4));
        } else {
          hs = sHS + (eHS - sHS) * progress;
        }
        hs = Math.round(hs * 1000) / 1000;
        if (item.type === 'cmd') {
          if (hs !== lastHS) {
            result += (result && !result.endsWith('\n') ? '\n' : '') + `#SCROLL ${parseFloat(hs.toFixed(3))}\n`;
            lastHS = hs;
          }
          result += item.value + "\n";
        } else if (item.type === 'note') {
          if ((item.value !== '0' || item.isFirst) && hs !== lastHS) {
            result += (result && !result.endsWith('\n') ? '\n' : '') + `#SCROLL ${parseFloat(hs.toFixed(3))}\n`;
            lastHS = hs;
          }
          result += item.value;
        } else if (item.type === 'comma') {
          result += ",\n";
          if (idx === timeline.length - 1) {
            result += `#SCROLL ${parseFloat(eHS.toFixed(3))}\n`;
          }
        }
      });
      text = text.substring(0, seg.start) + result.trim() + text.substring(seg.end);
    }
    u('.input').first().value = text;
    processFunc();
  } catch (e) {
    u('.errors').text(e.message);
  }
}

/** UI Logic **/

function highlightTJA(text) {
  const lines = text.split('\n');
  let rendaState = 0; // 0:通常, 5:黄連打中, 7:風船中
  let inActiveChart = false; // #START〜#END の区間をトラッキング

  const highlightedLines = lines.map(line => {
    const trimmed = line.trim();
    const upperLine = trimmed.toUpperCase();
    let lineHtml = "";

    // 行をトリムしたものが#STARTならアクティブ区間開始
    if (upperLine.startsWith('#START')) {
      inActiveChart = true;
    }
    if (trimmed.startsWith('//')) {
      // コメント: 薄いグレー
      lineHtml = `<span style="color: #6e7681; font-style: italic;">${escapeHtml(line)}</span>`;
    } else if (trimmed.startsWith('#')) {
      // 命令コマンド: 鮮やかなブルー（太字）
      lineHtml = `<span style="color: #58a6ff; font-weight: bold;">${escapeHtml(line)}</span>`;

      // #END が現れたらアクティブ区間終了
      if (upperLine.startsWith('#END')) {
        inActiveChart = false;
      }
    } else if (/^[A-Z0-9_\-]+:/.test(trimmed.toUpperCase())) {
      // ヘッダー要素: 白色（太字）
      lineHtml = `<span style="color: #e3e3e6; font-weight: bold;">${escapeHtml(line)}</span>`;
    } else {
      // 譜面データ（ノーツ）: 1文字ずつカラー判定して色分け復元
      let result = "";
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const escapedChar = escapeHtml(char);
        const textShadow = "text-shadow: 0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(255,255,255,0.05);";
        if (rendaState === 5) {
          result += `<span style="color: #ffff00; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          if (char === '8') rendaState = 0;
        } else if (rendaState === 7) {
          result += `<span style="color: #ff9100; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          if (char === '8') rendaState = 0;
        } else {
          if (char === '5' || char === '6') {
            rendaState = 5;
            result += `<span style="color: #ffff00; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          } else if (char === '7') {
            rendaState = 7;
            result += `<span style="color: #ff9100; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          } else if (char === '1' || char === '3') {
            result += `<span style="color: #ff3333; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          } else if (char === '2' || char === '4') {
            result += `<span style="color: #33ebff; font-weight: bold; ${textShadow}">${escapedChar}</span>`;
          } else if (char === '0' && inActiveChart) {
            // 【仕様維持】#STARTから#END区間の休符(0)をグレーに
            result += `<span style="color: #6e7681;">${escapedChar}</span>`;
          } else {
            result += escapedChar;
          }
        }
      }
      lineHtml = result;
    }
    const finalHtml = lineHtml === "" ? "&#8203;" : lineHtml;
    return `<div class="highlight-row" style="width:100%;">${finalHtml}</div>`;
  });
  return highlightedLines.join('');
}

export function updateLineNumbers(text) {
  const lineNumbers = u('.line-numbers').first();
  if (!lineNumbers) return;
  const lines = text.split('\n');
  const measureStartMap = {};
  let inActiveChart = false;
  let currentMeasureNum = 1;
  let currentMeasureStartLineIndex = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const rawLine = line.split('//')[0].trim();
    const upperLine = rawLine.toUpperCase();
    if (upperLine === '#START') {
      inActiveChart = true;
      currentMeasureNum = 1;
      currentMeasureStartLineIndex = null;
      continue;
    }
    if (upperLine === '#END') {
      inActiveChart = false;
      continue;
    }
    if (inActiveChart) {
      if (rawLine !== "") {
        if (currentMeasureStartLineIndex === null) {
          currentMeasureStartLineIndex = i;
          measureStartMap[i] = currentMeasureNum;
        }
        const commaCount = (rawLine.match(/,/g) || []).length;
        if (commaCount > 0) {
          currentMeasureStartLineIndex = null;
          currentMeasureNum += commaCount;
        }
      }
    }
  }
  let html = "";
  for (let i = 0; i < lines.length; i++) {
    const isError = i + 1 === state.errorLineNumber;
    const bgStyle = isError ? "background: rgba(255, 0, 0, 0.2);" : "";
    let measureSuffix = "";
    if (measureStartMap[i] !== undefined) {
      measureSuffix = `<span style="color: #ff8800; font-size: 6.5px; font-weight: normal; font-family: sans-serif; text-align: right; width: 18px; transform: scale(0.9); display: inline-block;">${measureStartMap[i]}</span>`;
    } else {
      measureSuffix = `<span style="width: 18px; display: inline-block;"></span>`;
    }
    html += `<div class="line-number-row" style="${bgStyle} height: 18px;" id="ln-row-${i}">` + `<span style="color: #555562; font-size: 8px; text-align: right; width: 18px; font-family: monospace; display: inline-block;">${i + 1}</span>` + measureSuffix + `</div>`;
  }
  lineNumbers.innerHTML = html;
  debouncedSyncLineHeights();
}

// 【要件2: 修正】ズレを直した縦画面用のレイアウト同期＆バッチ処理設計

// 【要件2: 修正】ズレを直した縦画面用のレイアウト同期＆バッチ処理設計
export function syncLineHeights() {
  const container = u('.editor-container').first();
  if (!container) return;
  const highlightRows = container.querySelectorAll('.highlight-row');
  const lnRows = container.querySelectorAll('.line-number-row');
  const len = Math.min(highlightRows.length, lnRows.length);
  const heights = new Array(len);

  // バッチRead処理: 決め打ち制限(textContent.length < 30)を撤廃し、すべての行の物理高さを実測取得してズレを解消！
  for (let i = 0; i < len; i++) {
    heights[i] = highlightRows[i].getBoundingClientRect().height;
  }
  const isMobile = window.innerWidth <= 768;
  const defaultHeight = isMobile ? '16px' : '18px';

  // バッチWrite処理: 実測された物理高さを左側の行番号ブロックに確実にバインド
  for (let i = 0; i < len; i++) {
    const lnRow = lnRows[i];
    const h = heights[i];
    if (h > 0) {
      lnRow.style.height = h + 'px';
    } else {
      lnRow.style.height = defaultHeight;
    }
  }
  syncScroll();
}

export function debouncedSyncLineHeights() {
  if (state.syncHeightTimeout) clearTimeout(state.syncHeightTimeout);
  state.syncHeightTimeout = setTimeout(() => {
    syncLineHeights();
  }, 50);
}

export function syncScroll() {
  backdrop.scrollTop = textarea.scrollTop;
  backdrop.scrollLeft = textarea.scrollLeft;
  const lineNumbers = u('.line-numbers').first();
  if (lineNumbers) {
    lineNumbers.scrollTop = textarea.scrollTop;
  }
}

export function updateHighlight() {
  if (state.pendingHighlightUpdate) return;
  state.pendingHighlightUpdate = true;
  requestAnimationFrame(() => {
    const text = textarea.value;
    highlightDiv.innerHTML = highlightTJA(text);
    updateLineNumbers(text);
    state.pendingHighlightUpdate = false;
  });
}
export const textarea = u('.input').first();
export const backdrop = u('.backdrop').first();
export const highlightDiv = u('.highlight').first();
