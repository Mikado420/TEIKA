import { HIT_POSITION_X_DEFAULT, HIT_POSITION_X } from "./state.js";
import { state, BASE_SCROLL_FACTOR, NOTE_COLORS, JUDGE_BAD } from './state.js';

function triggerTaikoEffect(part, time) {
  state.taikoEffects[part].active = true;
  state.taikoEffects[part].startTime = time;
}

function clearTaikoEffects() {
  for (const key in state.taikoEffects) {
    state.taikoEffects[key].active = false;
  }
  state.autoLastSide = 'L';
}

function triggerAutoHitSide(hitType, time, isBig = false) {
  const hitQueue = [];
  if (hitType === 'don') {
    if (isBig) {
      hitQueue.push({
        part: 'donR',
        priority: state.positionPriority.donR
      });
      hitQueue.push({
        part: 'donL',
        priority: state.positionPriority.donL
      });
      state.autoLastSide = 'R';
    } else {
      if (state.autoLastSide === 'L') {
        hitQueue.push({
          part: 'donR',
          priority: state.positionPriority.donR
        });
        state.autoLastSide = 'R';
      } else {
        hitQueue.push({
          part: 'donL',
          priority: state.positionPriority.donL
        });
        state.autoLastSide = 'L';
      }
    }
  } else if (hitType === 'ka') {
    if (isBig) {
      hitQueue.push({
        part: 'kaR',
        priority: state.positionPriority.kaR
      });
      hitQueue.push({
        part: 'kaL',
        priority: state.positionPriority.kaL
      });
      state.autoLastSide = 'R';
    } else {
      if (state.autoLastSide === 'L') {
        hitQueue.push({
          part: 'kaR',
          priority: state.positionPriority.kaR
        });
        state.autoLastSide = 'R';
      } else {
        hitQueue.push({
          part: 'kaL',
          priority: state.positionPriority.kaL
        });
        state.autoLastSide = 'L';
      }
    }
  }
  hitQueue.sort((a, b) => b.priority - a.priority);
  hitQueue.forEach(h => {
    triggerTaikoEffect(h.part, time);
  });
}

function createSynthesizedAudioBuffer(ctx, type) {
  const rate = ctx.sampleRate || 44100;
  const duration = 0.12;
  const length = rate * duration;
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  if (type === 'don') {
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      data[i] = Math.sin(2 * Math.PI * 140 * Math.exp(-35 * t)) * Math.exp(-12 * t);
    }
  } else if (type === 'ka') {
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-45 * t) * 0.4 + Math.sin(2 * Math.PI * 380 * Math.exp(-25 * t)) * Math.exp(-18 * t) * 0.25;
    }
  } else {
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      data[i] = Math.sin(2 * Math.PI * 750 * Math.exp(-12 * t)) * Math.exp(-8 * t) * 0.45;
    }
  }
  return buffer;
}

async function loadAudioBuffer(url, key) {
  if (!state.audioContext) return;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    state.audioBuffers[key] = await state.audioContext.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn(`Failed to load online audio, using synthesis fallback instead.`, e);
  }
}

export function initializeAudio() {
  if (!state.audioContext) {
    try {
      state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      state.seGainNode = state.audioContext.createGain();
      state.seGainNode.gain.value = state.seVolume;
      state.seGainNode.connect(state.audioContext.destination);
      state.musicGainNode = state.audioContext.createGain();
      state.musicGainNode.gain.value = state.musicVolume;
      state.musicGainNode.connect(state.audioContext.destination);
      state.audioBuffers['don'] = createSynthesizedAudioBuffer(state.audioContext, 'don');
      state.audioBuffers['ka'] = createSynthesizedAudioBuffer(state.audioContext, 'ka');
      state.audioBuffers['balloon'] = createSynthesizedAudioBuffer(state.audioContext, 'balloon');
    } catch (e) {
      console.error("Web Audio API is not supported in this browser");
      return;
    }
  } else {
    if (state.seGainNode) state.seGainNode.gain.value = state.seVolume;
    if (state.musicGainNode) state.musicGainNode.gain.value = state.musicVolume;
  }
  ['don', 'ka', 'balloon'].forEach(key => {
    const base64 = localStorage.getItem(`se_${key}`);
    if (base64) {
      loadAudioBuffer(base64, key);
    } else {
      const defaultFilename = key === 'don' ? './Sounds/dong.wav' : key === 'ka' ? './Sounds/ka.wav' : './Sounds/balloon.wav';
      loadAudioBuffer(defaultFilename, key);
    }
  });
}

function playSEAtTime(type, audioTime) {
  if (!state.audioContext || !state.audioBuffers[type] || !state.seGainNode) return;
  const source = state.audioContext.createBufferSource();
  source.buffer = state.audioBuffers[type];
  source.connect(state.seGainNode);
  source.start(audioTime);
}

export function updateChartState(timeSec) {
  if (!state.currentChartData) {
    return;
  }
  while (state.state_commandIndex < state.currentChartData.commands.length) {
    const cmd = state.currentChartData.commands[state.state_commandIndex];
    if (cmd.time > timeSec) {
      break;
    }
    switch (cmd.type) {
      case 'BPMCHANGE':
        state.state_currentBPM = cmd.value;
        break;
      case 'GOGOSTART':
        if (!state.state_isGogo) {
          state.lastGogoStartTime = cmd.time;
        }
        state.state_isGogo = true;
        break;
      case 'GOGOEND':
        state.state_isGogo = false;
        break;
    }
    state.state_commandIndex++;
  }
  u('#jiro-preview-container').toggleClass('gogo-time-bg', state.state_isGogo);
}

export function seekChartState(timeSec) {
  state.state_commandIndex = 0;
  state.state_currentBPM = state.tjaParsed ? state.tjaParsed.headers.bpm || 120 : 120;
  state.state_isGogo = false;
  state.state_jposStartTime = -Infinity;
  state.state_jposDuration = 0;
  state.state_jposStartX = HIT_POSITION_X_DEFAULT;
  state.state_jposEndX = HIT_POSITION_X_DEFAULT;
  state.state_jposEasing = 0;
  state.lastGogoStartTime = -Infinity;
  if (!state.currentChartData) {
    updateChartState(0);
    return;
  }
  while (state.state_commandIndex < state.currentChartData.commands.length) {
    const cmd = state.currentChartData.commands[state.state_commandIndex];
    if (cmd.time > timeSec) {
      break;
    }
    switch (cmd.type) {
      case 'BPMCHANGE':
        state.state_currentBPM = cmd.value;
        break;
      case 'GOGOSTART':
        state.lastGogoStartTime = cmd.time;
        state.state_isGogo = true;
        break;
      case 'GOGOEND':
        state.state_isGogo = false;
        break;
    }
    state.state_commandIndex++;
  }
  updateChartState(timeSec);
}

export function drawJiroPremiumNote(ctx, x, y, type) {
  const isBig = type === '3' || type === '4' || type === '6' || type === '7';
  const r = isBig ? 26 : 17;
  const color = NOTE_COLORS[type] || '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r - 4.2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawJiroBalloonNote(ctx, rx, ry, note) {
  const x = Math.round(rx);
  const y = Math.round(ry);
  const r = 19;
  const length = 68;
  const color = '#f44336';
  const strokeColor = '#000000';
  const strokeWidth = 1.5;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 5, y - r + 3);
  ctx.quadraticCurveTo(x + 20, y - 6, x + 32, y - 10);
  ctx.bezierCurveTo(x + 50, y - 20, x + length + 4, y - 15, x + length - 2, y);
  ctx.bezierCurveTo(x + length + 4, y + 15, x + 50, y + 20, x + 32, y + 10);
  ctx.quadraticCurveTo(x + 20, y + 6, x + 5, y + r - 3);
  ctx.closePath();
  ctx.lineWidth = strokeWidth * 2 + 1;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r - 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// 【要件1＆3: 完全修正】描画レイヤー順「ゴーゴー背景 ➔ レーン ➔ 判定枠・オーラ ➔ ノーツ（最前面）」

// 【要件1＆3: 完全修正】描画レイヤー順「ゴーゴー背景 ➔ レーン ➔ 判定枠・オーラ ➔ ノーツ（最前面）」
export function updateJiroPreview(time = state.currentElapsedTime) {
  if (!state.jiroCanvas || !state.jiroCtx) {
    state.jiroCanvas = document.getElementById('jiro-previewCanvas');
    if (state.jiroCanvas) {
      state.jiroCtx = state.jiroCanvas.getContext('2d');
    }
  }
  if (!state.jiroCanvas || !state.jiroCtx) return;
  if (!state.currentChartData) {
    state.jiroCtx.clearRect(0, 0, state.jiroCanvas.width, state.jiroCanvas.height);
    seekChartState(0);
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const container = document.getElementById('jiro-preview-container');
  const rectWidth = container.clientWidth > 0 ? container.clientWidth : 946;
  const rectHeight = container.clientHeight > 0 ? container.clientHeight : 150;

  // 【軽量化】サイズ変更時のみCanvasバッファサイズを設定してガタつきを完全に防止
  if (state.jiroCanvas.width !== rectWidth * dpr || state.jiroCanvas.height !== rectHeight * dpr) {
    state.jiroCanvas.width = rectWidth * dpr;
    state.jiroCanvas.height = rectHeight * dpr;
  }
  state.jiroCtx.resetTransform();
  state.jiroCtx.scale(dpr, dpr);
  const elapsedTime = time;
  const baseCenterY = rectHeight / 2;
  const canvasMargin = 100;

  // ----------------------------------------------------
  // レイヤー 1: レーンの背景・ゴーゴー背景の描画（定位置に完全固定・最背面）
  // ----------------------------------------------------
  state.jiroCtx.clearRect(0, 0, rectWidth, rectHeight);
  const laneHeight = 76;
  const laneTop = baseCenterY - laneHeight / 2;

  // レーン背景
  state.jiroCtx.fillStyle = '#1b1b22';
  state.jiroCtx.fillRect(110, laneTop, rectWidth - 110, laneHeight);

  // ゴーゴー背景色の描画（色の濃さをほんの少し濃く維持）
  if (state.state_isGogo) {
    const grad = state.jiroCtx.createLinearGradient(110, 0, rectWidth, 0);
    grad.addColorStop(0, 'rgba(255, 69, 0, 0.45)');
    grad.addColorStop(0.5, 'rgba(255, 140, 0, 0.22)');
    grad.addColorStop(1, 'rgba(255, 140, 0, 0.05)');
    state.jiroCtx.fillStyle = grad;
    state.jiroCtx.fillRect(110, laneTop, rectWidth - 110, laneHeight);
  }

  // レーン枠境界線
  state.jiroCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  state.jiroCtx.lineWidth = 2;
  state.jiroCtx.strokeRect(110, laneTop, rectWidth - 110, laneHeight);

  // ----------------------------------------------------
  // レイヤー 2: レーン（小節線）の描画
  // ----------------------------------------------------
  const drawBarlines = state.currentChartData.drawBarlines || [];
  for (let i = 0; i < drawBarlines.length; i++) {
    const note = drawBarlines[i];
    const {
      bpm,
      scroll
    } = note;
    const pixelsPerSecondX = BASE_SCROLL_FACTOR * bpm * scroll * state.scrollMultiplier;
    const timeDiff = note.time - elapsedTime;
    const x = HIT_POSITION_X + timeDiff * pixelsPerSecondX;

    // 太鼓マスクの背面に入り込まないようクリップ
    if (x < 110 || x > rectWidth + canvasMargin || pixelsPerSecondX === 0) continue;
    if (!note.barlineVisible) continue;
    state.jiroCtx.beginPath();
    state.jiroCtx.moveTo(x, laneTop);
    state.jiroCtx.lineTo(x, laneTop + laneHeight);
    state.jiroCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    state.jiroCtx.lineWidth = 2;
    state.jiroCtx.stroke();
  }

  // ----------------------------------------------------
  // レイヤー 3: 判定枠（常時タイトオーラ ＆ 突入時高速破裂アニメ）の描画（※流れるノーツの背面に固定！）
  // ----------------------------------------------------
  const radiusNormal = 27.5;
  if (state.state_isGogo) {
    const gogoElapsed = elapsedTime - state.lastGogoStartTime;
    let auraScale = 1.0;
    let auraAlpha = 1.0;
    const animDuration = 0.28;

    // 突入時オーラ破裂アニメーション
    if (gogoElapsed >= 0 && gogoElapsed < animDuration) {
      const peakTime = 0.06; // 0.06sで頂点に急拡大
      if (gogoElapsed < peakTime) {
        const t = gogoElapsed / peakTime;
        auraScale = 1.0 + t * 1.5; // 最大2.5倍へ爆発
        auraAlpha = 0.6 + t * 0.4;
      } else {
        const t = (gogoElapsed - peakTime) / (animDuration - peakTime);
        auraScale = 2.5 - t * 1.5; // タイトな1.0倍へ急速収束
        auraAlpha = 1.0 - t * 0.12; // 0.88へ減衰
      }
    } else {
      // 常時ゴーゴー中：アニメーションを完全停止させ、静止したタイトオーラを描画（濃さ0.88）
      auraScale = 1.0;
      auraAlpha = 0.88;
    }

    // オレンジ色のタイトオーラ円形グラデーション
    const innerRadius = radiusNormal * 0.95;
    const outerRadius = radiusNormal * 1.35 * auraScale;
    state.jiroCtx.save();
    const radGrad = state.jiroCtx.createRadialGradient(HIT_POSITION_X, baseCenterY, innerRadius, HIT_POSITION_X, baseCenterY, outerRadius);
    radGrad.addColorStop(0, `rgba(255, 90, 0, ${auraAlpha * 0.95})`);
    radGrad.addColorStop(0.4, `rgba(255, 140, 0, ${auraAlpha * 0.6})`);
    radGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');
    state.jiroCtx.beginPath();
    state.jiroCtx.arc(HIT_POSITION_X, baseCenterY, outerRadius, 0, Math.PI * 2);
    state.jiroCtx.fillStyle = radGrad;
    state.jiroCtx.fill();
    state.jiroCtx.restore();
  }

  // 判定枠の本体白サークル
  state.jiroCtx.beginPath();
  state.jiroCtx.arc(HIT_POSITION_X, baseCenterY, radiusNormal, 0, Math.PI * 2);
  state.jiroCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  state.jiroCtx.lineWidth = 2.5;
  state.jiroCtx.stroke();
  state.jiroCtx.beginPath();
  state.jiroCtx.arc(HIT_POSITION_X, baseCenterY, 18.5, 0, Math.PI * 2);
  state.jiroCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  state.jiroCtx.lineWidth = 1.5;
  state.jiroCtx.stroke();

  // ----------------------------------------------------
  // レイヤー 4: 流れるノーツ（音符・連打・風船）の描画（最前面レイヤー！）
  // ----------------------------------------------------
  const drawNormalNotes = state.currentChartData.drawNormalNotes || [];
  let activeRollNote = null;

  // インデックス降順（右側から順番に）で描画することにより、左側のノーツを最前面にする
  for (let i = drawNormalNotes.length - 1; i >= 0; i--) {
    const note = drawNormalNotes[i];
    if (state.chartCoolDownUntil !== null && note.time < state.chartCoolDownUntil) {
      if (note.type >= '5' && note.type <= '7' && note.endTime > elapsedTime) {} else {
        continue;
      }
    }
    const {
      bpm,
      scroll
    } = note;
    const pixelsPerSecondX = BASE_SCROLL_FACTOR * bpm * scroll * state.scrollMultiplier;
    const timeDiff = note.time - elapsedTime;
    const x = HIT_POSITION_X + timeDiff * pixelsPerSecondX;

    // 【軽量化】画面外の不要ノーツは完全にスキップして描画負荷を排除
    if (x < -canvasMargin || x > rectWidth + canvasMargin) continue;
    if (note.type >= '1' && note.type <= '4') {
      if (note.judgeResult === 'hit') continue;
      drawJiroPremiumNote(state.jiroCtx, x, baseCenterY, note.type);
    } else if (note.type === '5' || note.type === '6') {
      const pixelsPerSecondX_End = BASE_SCROLL_FACTOR * bpm * scroll * state.scrollMultiplier;
      const endTimeDiff = note.endTime - elapsedTime;
      const endX = HIT_POSITION_X + endTimeDiff * pixelsPerSecondX_End;
      if (x < -canvasMargin && endX < -canvasMargin || x > rectWidth + canvasMargin && endX > rectWidth + canvasMargin) continue;
      if (elapsedTime >= note.time && elapsedTime <= note.endTime) activeRollNote = note;
      const isBig = note.type === '6';
      const size = isBig ? 26 : 17;
      const color = NOTE_COLORS[note.type];
      state.jiroCtx.beginPath();
      state.jiroCtx.moveTo(x, baseCenterY);
      state.jiroCtx.lineTo(endX, baseCenterY);
      state.jiroCtx.strokeStyle = '#000000';
      state.jiroCtx.lineWidth = size * 2;
      state.jiroCtx.lineCap = 'round';
      state.jiroCtx.stroke();
      state.jiroCtx.beginPath();
      state.jiroCtx.moveTo(x, baseCenterY);
      state.jiroCtx.lineTo(endX, baseCenterY);
      state.jiroCtx.strokeStyle = '#FFFFFF';
      state.jiroCtx.lineWidth = (size - 1.5) * 2;
      state.jiroCtx.stroke();
      state.jiroCtx.beginPath();
      state.jiroCtx.moveTo(x, baseCenterY);
      state.jiroCtx.lineTo(endX, baseCenterY);
      state.jiroCtx.strokeStyle = color;
      state.jiroCtx.lineWidth = (size - 3) * 2;
      state.jiroCtx.stroke();
      state.jiroCtx.lineCap = 'butt';
      if (x >= -canvasMargin && x <= rectWidth + canvasMargin) {
        drawJiroPremiumNote(state.jiroCtx, x, baseCenterY, note.type);
      }
    } else if (note.type === '7') {
      if (note.judgeResult === 'hit' || note.judgeResult === 'miss') continue;
      const pixelsPerSecondX_End = BASE_SCROLL_FACTOR * bpm * scroll * state.scrollMultiplier;
      const endTimeDiff = note.endTime - elapsedTime;
      const endX = HIT_POSITION_X + endTimeDiff * pixelsPerSecondX_End;
      let displayX = x,
        stayAtHitPos = false;
      if (note.judgeResult === 'pending') {
        if (elapsedTime <= note.endTime) {
          if (pixelsPerSecondX > 0) {
            if (x <= HIT_POSITION_X && endX > HIT_POSITION_X) stayAtHitPos = true;
          } else if (pixelsPerSecondX < 0) {
            if (x >= HIT_POSITION_X && endX < HIT_POSITION_X) stayAtHitPos = true;
          }
          if (stayAtHitPos) {
            displayX = HIT_POSITION_X;
          }
          activeRollNote = note;
        } else {
          displayX = endX;
        }
      }
      if (displayX > rectWidth + canvasMargin || displayX < -canvasMargin) continue;
      drawJiroBalloonNote(state.jiroCtx, displayX, baseCenterY, note);
      const remainingHits = note.hits - note.currentHits;
      state.jiroCtx.fillStyle = 'white';
      state.jiroCtx.font = 'bold 20px Inter';
      state.jiroCtx.textBaseline = 'middle';
      state.jiroCtx.textAlign = 'center';
      if (note.hits > 0 && note.judgeResult === 'pending') state.jiroCtx.fillText(remainingHits.toString(), displayX, baseCenterY);
    }
  }

  // ----------------------------------------------------
  // 5. 太鼓本体グラフィックの描画 (定位置に完全固定マスク)
  // ----------------------------------------------------
  state.jiroCtx.fillStyle = '#111113';
  state.jiroCtx.fillRect(0, 0, 110, rectHeight);

  // セパレータ境界線
  state.jiroCtx.strokeStyle = '#222';
  state.jiroCtx.lineWidth = 3;
  state.jiroCtx.beginPath();
  state.jiroCtx.moveTo(110, 0);
  state.jiroCtx.lineTo(110, rectHeight);
  state.jiroCtx.stroke();
  const taikoX = 55;
  const taikoY = baseCenterY;
  const taikoR = 43;

  // 太鼓の外輪
  state.jiroCtx.beginPath();
  state.jiroCtx.arc(taikoX, taikoY, taikoR, 0, Math.PI * 2);
  state.jiroCtx.fillStyle = '#1e1e1e';
  state.jiroCtx.fill();
  state.jiroCtx.lineWidth = 4;
  state.jiroCtx.strokeStyle = '#121212';
  state.jiroCtx.stroke();

  // 太鼓の面
  state.jiroCtx.beginPath();
  state.jiroCtx.arc(taikoX, taikoY, taikoR - 11, 0, Math.PI * 2);
  state.jiroCtx.fillStyle = '#2d2d2d';
  state.jiroCtx.fill();
  state.jiroCtx.lineWidth = 3;
  state.jiroCtx.strokeStyle = '#1d1d1d';
  state.jiroCtx.stroke();

  // ----------------------------------------------------
  // 6. 太鼓ヒット時の面・縁の発光エフェクト
  // ----------------------------------------------------
  const rInner = taikoR - 11;
  const partsOrder = ['kaR', 'donR', 'donL', 'kaL'];
  partsOrder.forEach(part => {
    const eff = state.taikoEffects[part];
    if (!eff.active) return;
    const progress = (elapsedTime - eff.startTime) / state.EFFECT_DURATION;
    if (progress >= 1.0 || progress < 0) {
      eff.active = false;
      return;
    }
    const opacity = 1.0 - progress;
    state.jiroCtx.save();
    state.jiroCtx.beginPath();
    if (part === 'donL') {
      state.jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 0.5, Math.PI * 1.5, false);
      state.jiroCtx.fillStyle = `rgba(244, 67, 54, ${opacity * 0.75})`;
      state.jiroCtx.fill();
    } else if (part === 'donR') {
      state.jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 1.5, Math.PI * 2.5, false);
      state.jiroCtx.fillStyle = `rgba(244, 67, 54, ${opacity * 0.75})`;
      state.jiroCtx.fill();
    } else if (part === 'kaL') {
      state.jiroCtx.arc(taikoX, taikoY, taikoR, Math.PI * 0.5, Math.PI * 1.5, false);
      state.jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 1.5, Math.PI * 0.5, true);
      state.jiroCtx.closePath();
      state.jiroCtx.fillStyle = `rgba(33, 150, 243, ${opacity * 0.75})`;
      state.jiroCtx.fill();
    } else if (part === 'kaR') {
      state.jiroCtx.arc(taikoX, taikoY, taikoR, Math.PI * 1.5, Math.PI * 2.5, false);
      state.jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 2.5, Math.PI * 1.5, true);
      state.jiroCtx.closePath();
      state.jiroCtx.fillStyle = `rgba(33, 150, 243, ${opacity * 0.75})`;
      state.jiroCtx.fill();
    }
    state.jiroCtx.restore();
  });

  // ----------------------------------------------------
  // 7. コンボ表示の描画 (最前面)
  // ----------------------------------------------------
  if (state.currentCombo > 0) {
    state.jiroCtx.save();
    state.jiroCtx.fillStyle = '#ffffff';
    state.jiroCtx.font = `bold ${Math.floor(22 * state.comboBounceScale)}px "Hiragino Kaku Gothic ProN", Meiryo, sans-serif`;
    state.jiroCtx.textBaseline = 'middle';
    state.jiroCtx.textAlign = 'center';
    state.jiroCtx.strokeStyle = '#000000';
    state.jiroCtx.lineWidth = 5;
    state.jiroCtx.strokeText(`${state.currentCombo}`, taikoX, taikoY);
    state.jiroCtx.fillText(`${state.currentCombo}`, taikoX, taikoY);
    state.jiroCtx.restore();
  }
  const rollDisplay = u('#jiro-roll-display').first();
  if (rollDisplay) {
    if (activeRollNote && activeRollNote.type !== '7') {
      rollDisplay.textContent = activeRollNote.currentHits;
      rollDisplay.style.opacity = 1;
      if (activeRollNote.type === '6') rollDisplay.style.color = NOTE_COLORS['6'];else rollDisplay.style.color = NOTE_COLORS['5'];
    } else {
      rollDisplay.style.opacity = 0;
    }
  }
}

export function setChartTime(time) {
  clearTaikoEffects();
  if (!state.currentChartData) {
    state.currentElapsedTime = 0;
    state.currentMeasureIndex = 0;
    state.currentCombo = 0;
    updateComboDisplay();
    updateMeasureDisplay();
    seekChartState(0);
    updateJiroPreview(0);
    return;
  }
  const wasPlaying = state.isPlaying;
  if (wasPlaying) stopSimulation();
  state.currentElapsedTime = time;
  state.currentMeasureIndex = findMeasureIndex(time);
  let initialCombo = 0;
  state.currentChartData.notes.forEach(note => {
    note.seScheduled = false;
    if (note.time < time) {
      if (note.type >= '5' && note.type <= '7' && note.endTime > time) {
        note.judgeResult = 'pending';
        note.currentHits = 0;
        note.lastAutoHitTime = 0;
      } else {
        note.judgeResult = 'hit';
        if (note.type === '1' || note.type === '2' || note.type === '3' || note.type === '4') initialCombo++;
        if (note.type === '7' && note.hits > 0) note.currentHits = note.hits;
        if (note.type === '5' || note.type === '6') {
          const duration = note.endTime - note.time;
          note.currentHits = Math.floor(duration / (1.0 / state.autoRollSpeed));
        }
      }
    } else {
      note.judgeResult = 'pending';
      note.currentHits = 0;
      note.lastAutoHitTime = 0;
    }
  });
  state.currentCombo = initialCombo;
  updateComboDisplay();
  updateMeasureDisplay();
  seekChartState(state.currentElapsedTime);
  updateJiroPreview(state.currentElapsedTime);
  if (wasPlaying) {
    state.chartCoolDownUntil = null;
    state.stopAtTime = null;
    startSimulation();
  }
}

export async function startSimulation() {
  if (state.isPlaying || !state.currentChartData) return;

  // 【堅牢化】再生開始前に古いタイマーの残留を完全に払拭（二重起動防止）
  if (state.logicIntervalId) {
    clearInterval(state.logicIntervalId);
    state.logicIntervalId = null;
  }
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  initializeAudio();
  if (state.audioContext) {
    if (state.audioContext.state === 'suspended' || state.audioContext.state === 'interrupted') {
      try {
        await state.audioContext.resume();
      } catch (e) {
        console.error("Failed to resume AudioContext during startSimulation", e);
        stopSimulation();
        return;
      }
    }
  }
  state.isPlaying = true;
  const requiredWaveName = state.tjaParsed.headers.wave;
  const isFileNameMatch = requiredWaveName && state.uploadedMusicFileName && requiredWaveName.toLowerCase() === state.uploadedMusicFileName.toLowerCase();
  state.simulationStartOffset = state.currentElapsedTime;
  state.simulationStartTime = state.audioContext ? state.audioContext.currentTime : 0;

  // 【要件1: 修正】タイマー競合バグを排除するため、描画用とロジックフォールバック用タイムスタンプを個別にリセット
  state.lastFrameTime = performance.now();
  state.lastLogicTime = performance.now();
  if (state.musicAudioBuffer && isFileNameMatch) {
    state.musicSourceNode = state.audioContext.createBufferSource();
    state.musicSourceNode.buffer = state.musicAudioBuffer;
    state.musicSourceNode.playbackRate.value = state.playbackSpeed;
    if ('preservesPitch' in state.musicSourceNode) {
      state.musicSourceNode.preservesPitch = true;
    }
    state.musicSourceNode.connect(state.musicGainNode);
    const offset = state.tjaParsed.headers.offset || 0;
    const targetTime = state.coolDownTime + Math.max(0, offset);
    if (state.simulationStartOffset < targetTime) {
      let waitTime = targetTime - state.simulationStartOffset;
      let realWaitTime = waitTime / state.playbackSpeed;
      state.musicSourceNode.start(state.audioContext.currentTime + realWaitTime, 0);
    } else {
      let playedRealTime = state.simulationStartOffset - targetTime;
      let musicOffset = playedRealTime;
      state.musicSourceNode.start(state.audioContext.currentTime, musicOffset);
    }
  }
  u('#jiro-btn-play').text('一時停止');
  state.lastAutoEffectTime = 0;
  state.logicIntervalId = setInterval(updateLogic, 1000 / 240);
  state.animationFrameId = requestAnimationFrame(drawLoop);
}

export function stopSimulation() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  if (state.musicSourceNode) {
    try {
      state.musicSourceNode.stop();
    } catch (e) {}
    state.musicSourceNode.disconnect();
    state.musicSourceNode = null;
  }
  state.stopAtTime = null;
  state.chartCoolDownUntil = null;

  // 【堅牢化】タイマーリークの可能性を完全に断つ
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  if (state.logicIntervalId) {
    clearInterval(state.logicIntervalId);
    state.logicIntervalId = null;
  }
  u('#jiro-btn-play').text('再生');
  u('#jiro-judge-display').html('');
  u('#jiro-roll-display').html('');
  clearTaikoEffects();
  updateJiroPreview(state.currentElapsedTime);
}

export function togglePlay() {
  if (state.isPlaying) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

export function resetSimulation() {
  stopSimulation();
  setChartTime(0);
}

export function findMeasureIndex(time) {
  if (!state.currentChartData) return 0;
  let index = 0;
  for (let i = 0; i < state.currentChartData.allMeasureTimes.length; i++) {
    if (state.currentChartData.allMeasureTimes[i] <= time) index = i;else break;
  }
  return index;
}

export function seekToMeasure(direction) {
  if (state.isPlaying || !state.currentChartData) return;
  const newMeasureIndex = Math.max(0, Math.min(state.currentChartData.allMeasureTimes.length - 1, state.currentMeasureIndex + direction));
  setChartTime(state.currentChartData.allMeasureTimes[newMeasureIndex]);
}

export function playSE(type) {
  if (performance.now() - state.lastSEPlayTime[type] < 1000 / state.renderFPS) return;
  if (!state.audioContext || !state.audioBuffers[type] || !state.seGainNode) return;
  const source = state.audioContext.createBufferSource();
  source.buffer = state.audioBuffers[type];
  source.connect(state.seGainNode);
  source.start(0);
  state.lastSEPlayTime[type] = performance.now();
}

export function updateComboDisplay() {}

export function updateMeasureDisplay() {
  if (!state.currentChartData || !state.currentChartData.allMeasureTimes) {
    u('#jiro-measure-display').text('');
    return;
  }
  const currentMeasure = state.currentMeasureIndex + 1;
  const totalMeasures = state.currentChartData.allMeasureTimes.length;
  u('#jiro-measure-display').text(`小節: ${currentMeasure} / ${totalMeasures}`);
}

export function autoHitCheck(elapsedTime) {
  if (!state.currentChartData) return;

  // 【軽量化】無駄なループを徹底的に排除した高速巡回
  for (let i = 0; i < state.currentChartData.notes.length; i++) {
    const note = state.currentChartData.notes[i];
    if (note.judgeResult !== 'pending') continue;

    // 通常ノーツの処理
    if (note.type >= '1' && note.type <= '4') {
      // 【軽量・遅延ゼロ同期】ノーツ到達の120ms前にWeb Audio APIのオーディオ currentTime をベースに先読み予約
      if (state.isPlaying && !note.seScheduled) {
        const playTime = note.time;
        if (elapsedTime >= playTime - 0.12) {
          const targetAudioTime = state.simulationStartTime + (playTime - state.simulationStartOffset) / state.playbackSpeed;
          if (targetAudioTime >= state.audioContext.currentTime) {
            playSEAtTime(note.type === '1' || note.type === '3' ? 'don' : 'ka', targetAudioTime);
          } else {
            playSEAtTime(note.type === '1' || note.type === '3' ? 'don' : 'ka', state.audioContext.currentTime);
          }
          note.seScheduled = true;
        }
      }

      // 映像上の到達瞬間に画面エフェクトとコンボ加算
      if (elapsedTime >= note.time) {
        note.judgeResult = 'hit';
        const timeSinceLastEffect = elapsedTime - state.lastAutoEffectTime;
        if (timeSinceLastEffect >= 1.0 / 60.0) {
          state.lastAutoEffectTime = elapsedTime;
        }
        if (note.type === '1' || note.type === '3') {
          triggerAutoHitSide('don', elapsedTime, note.type === '3');
        } else if (note.type === '2' || note.type === '4') {
          triggerAutoHitSide('ka', elapsedTime, note.type === '4');
        }
        state.currentCombo++;
        state.comboBounceScale = 1.35;
      } else if (elapsedTime > note.time + JUDGE_BAD) {
        note.judgeResult = 'miss';
        state.currentCombo = 0;
      }
    }
    // 連打・風船ノーツの処理
    else if (note.type >= '5' && note.type <= '7') {
      if (elapsedTime >= note.time && elapsedTime <= note.endTime) {
        // 連打速度（秒間打鍵）の算出
        let currentRollSpeed = 30.0;
        if (note.type === '7') {
          const duration = note.endTime - note.time;
          if (duration > 0 && note.hits > 0) {
            currentRollSpeed = note.hits / duration * 1.1;
          }
          currentRollSpeed = Math.min(50.0, currentRollSpeed);
        }
        const hitInterval = 1.0 / currentRollSpeed;

        // 最初の打鍵（始点通過した瞬間に即座に1打目処理を開始。遅延ディレイ＝ゼロ）
        if (note.lastAutoHitTime === 0) {
          note.lastAutoHitTime = note.time;
          note.currentHits = 1;
          state.lastAutoEffectTime = elapsedTime;
          playSEAtTime('don', state.audioContext.currentTime);
          triggerAutoHitSide('don', elapsedTime);
          if (note.type === '7' && note.hits > 0 && note.currentHits >= note.hits) {
            note.judgeResult = 'hit';
            playSEAtTime('balloon', state.audioContext.currentTime);
          }
        }

        // 2打目以降（通常のインターバル時間カウント）
        const timeSinceLastHit = elapsedTime - note.lastAutoHitTime;
        if (timeSinceLastHit >= hitInterval) {
          const hits = Math.floor(timeSinceLastHit / hitInterval);
          note.lastAutoHitTime += hitInterval * hits;
          note.currentHits += hits;
          const timeSinceLastEffect = elapsedTime - state.lastAutoEffectTime;
          if (timeSinceLastEffect >= 1.0 / 60.0) {
            state.lastAutoEffectTime = elapsedTime;
          }
          playSEAtTime('don', state.audioContext.currentTime);
          triggerAutoHitSide('don', elapsedTime);
          if (note.type === '7' && note.hits > 0 && note.currentHits >= note.hits) {
            note.judgeResult = 'hit';
            playSEAtTime('balloon', state.audioContext.currentTime);
          }
        }
      } else if (elapsedTime > note.endTime) {
        if (note.type === '5' || note.type === '6') note.judgeResult = 'hit';
      }
    }
  }
}

export function updateLogic() {
  const now = performance.now();
  if (state.audioContext && state.audioContext.state === 'running' && state.isPlaying) {
    state.currentElapsedTime = state.simulationStartOffset + (state.audioContext.currentTime - state.simulationStartTime) * state.playbackSpeed;
  } else if (state.isPlaying) {
    // 【要件1: 修正】FPS制限タイマーと完全に独立させた、ロジック経過時間専用フォールバックでフリーズを完全防止！
    const delta = (now - state.lastLogicTime) / 1000.0;
    state.currentElapsedTime += delta * state.playbackSpeed;
  }
  state.lastLogicTime = now; // ロジック専用に更新

  if (state.chartCoolDownUntil !== null && state.currentElapsedTime >= state.chartCoolDownUntil) {
    state.chartCoolDownUntil = null;
  }
  let chartEndTime = state.currentChartData ? state.currentChartData.endTime : 0;
  let musicEndTime = state.musicAudioBuffer ? state.musicAudioBuffer.duration : 0;
  let maxPlayTime = Math.max(chartEndTime, musicEndTime);
  if (maxPlayTime > 0 && state.currentElapsedTime >= maxPlayTime) {
    if (state.currentChartData && state.currentChartData.allMeasureTimes.length > 0) {
      state.currentElapsedTime = state.currentChartData.allMeasureTimes[state.currentChartData.allMeasureTimes.length - 1];
      state.currentMeasureIndex = state.currentChartData.allMeasureTimes.length - 1;
    } else {
      state.currentElapsedTime = 0;
      state.currentMeasureIndex = 0;
    }
    stopSimulation();
    return;
  }
  if (state.stopAtTime !== null && state.currentElapsedTime >= state.stopAtTime) {
    stopSimulation();
    state.currentElapsedTime = state.stopAtTime;
    updateJiroPreview(state.currentElapsedTime);
    return;
  }
  updateChartState(state.currentElapsedTime);
  if (state.chartCoolDownUntil === null) {
    autoHitCheck(state.currentElapsedTime);
  }
  updateJiroUIElements();
}

export function updateJiroUIElements() {
  const now = performance.now();
  if (now - state.lastUIUpdateTime < 100) return;
  state.lastUIUpdateTime = now;
  const totalDuration = state.musicAudioBuffer ? Math.max(state.currentChartData ? state.currentChartData.endTime : 0, state.musicAudioBuffer.duration) : state.currentChartData ? state.currentChartData.endTime : 0;
  u('#jiro-time-display').text(`${state.currentElapsedTime.toFixed(2)} / ${totalDuration.toFixed(2)}s`);
  state.currentMeasureIndex = findMeasureIndex(state.currentElapsedTime);
  updateMeasureDisplay();
  const seekbar = u('#jiro-seekbar').first();
  if (seekbar && totalDuration > 0 && document.activeElement !== seekbar) {
    seekbar.value = state.currentElapsedTime / totalDuration * 1000;
  }
}

export function drawLoop(timestamp) {
  if (!state.isPlaying) return;
  state.animationFrameId = requestAnimationFrame(drawLoop);
  const elapsed = timestamp - state.lastFrameTime;
  if (elapsed < 1000 / state.renderFPS) return;
  state.lastFrameTime = timestamp - elapsed % (1000 / state.renderFPS); // 【要件1: 修正】ロジックに影響を与えない完全に独立した描画間隔制御

  updateJiroPreview(state.currentElapsedTime);
}