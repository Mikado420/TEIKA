function triggerTaikoEffect(part, time) {
  taikoEffects[part].active = true;
  taikoEffects[part].startTime = time;
}

function clearTaikoEffects() {
  for (const key in taikoEffects) {
    taikoEffects[key].active = false;
  }
  autoLastSide = 'L';
}

function triggerAutoHitSide(hitType, time, isBig = false) {
  const hitQueue = [];
  if (hitType === 'don') {
    if (isBig) {
      hitQueue.push({
        part: 'donR',
        priority: positionPriority.donR
      });
      hitQueue.push({
        part: 'donL',
        priority: positionPriority.donL
      });
      autoLastSide = 'R';
    } else {
      if (autoLastSide === 'L') {
        hitQueue.push({
          part: 'donR',
          priority: positionPriority.donR
        });
        autoLastSide = 'R';
      } else {
        hitQueue.push({
          part: 'donL',
          priority: positionPriority.donL
        });
        autoLastSide = 'L';
      }
    }
  } else if (hitType === 'ka') {
    if (isBig) {
      hitQueue.push({
        part: 'kaR',
        priority: positionPriority.kaR
      });
      hitQueue.push({
        part: 'kaL',
        priority: positionPriority.kaL
      });
      autoLastSide = 'R';
    } else {
      if (autoLastSide === 'L') {
        hitQueue.push({
          part: 'kaR',
          priority: positionPriority.kaR
        });
        autoLastSide = 'R';
      } else {
        hitQueue.push({
          part: 'kaL',
          priority: positionPriority.kaL
        });
        autoLastSide = 'L';
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
  if (!audioContext) return;
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    audioBuffers[key] = await audioContext.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn(`Failed to load online audio, using synthesis fallback instead.`, e);
  }
}

function initializeAudio() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      seGainNode = audioContext.createGain();
      seGainNode.gain.value = seVolume;
      seGainNode.connect(audioContext.destination);
      musicGainNode = audioContext.createGain();
      musicGainNode.gain.value = musicVolume;
      musicGainNode.connect(audioContext.destination);
      audioBuffers['don'] = createSynthesizedAudioBuffer(audioContext, 'don');
      audioBuffers['ka'] = createSynthesizedAudioBuffer(audioContext, 'ka');
      audioBuffers['balloon'] = createSynthesizedAudioBuffer(audioContext, 'balloon');
    } catch (e) {
      console.error("Web Audio API is not supported in this browser");
      return;
    }
  } else {
    if (seGainNode) seGainNode.gain.value = seVolume;
    if (musicGainNode) musicGainNode.gain.value = musicVolume;
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
  if (!audioContext || !audioBuffers[type] || !seGainNode) return;
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffers[type];
  source.connect(seGainNode);
  source.start(audioTime);
}

function updateChartState(timeSec) {
  if (!currentChartData) {
    return;
  }
  while (state_commandIndex < currentChartData.commands.length) {
    const cmd = currentChartData.commands[state_commandIndex];
    if (cmd.time > timeSec) {
      break;
    }
    switch (cmd.type) {
      case 'BPMCHANGE':
        state_currentBPM = cmd.value;
        break;
      case 'GOGOSTART':
        if (!state_isGogo) {
          lastGogoStartTime = cmd.time;
        }
        state_isGogo = true;
        break;
      case 'GOGOEND':
        state_isGogo = false;
        break;
    }
    state_commandIndex++;
  }
  u('#jiro-preview-container').toggleClass('gogo-time-bg', state_isGogo);
}

function seekChartState(timeSec) {
  state_commandIndex = 0;
  state_currentBPM = tjaParsed ? tjaParsed.headers.bpm || 120 : 120;
  state_isGogo = false;
  state_jposStartTime = -Infinity;
  state_jposDuration = 0;
  state_jposStartX = HIT_POSITION_X_DEFAULT;
  state_jposEndX = HIT_POSITION_X_DEFAULT;
  state_jposEasing = 0;
  lastGogoStartTime = -Infinity;
  if (!currentChartData) {
    updateChartState(0);
    return;
  }
  while (state_commandIndex < currentChartData.commands.length) {
    const cmd = currentChartData.commands[state_commandIndex];
    if (cmd.time > timeSec) {
      break;
    }
    switch (cmd.type) {
      case 'BPMCHANGE':
        state_currentBPM = cmd.value;
        break;
      case 'GOGOSTART':
        lastGogoStartTime = cmd.time;
        state_isGogo = true;
        break;
      case 'GOGOEND':
        state_isGogo = false;
        break;
    }
    state_commandIndex++;
  }
  updateChartState(timeSec);
}

function drawJiroPremiumNote(ctx, x, y, type) {
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

function drawJiroBalloonNote(ctx, rx, ry, note) {
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
function updateJiroPreview(time = currentElapsedTime) {
  if (!jiroCanvas || !jiroCtx) {
    jiroCanvas = document.getElementById('jiro-previewCanvas');
    if (jiroCanvas) {
      jiroCtx = jiroCanvas.getContext('2d');
    }
  }
  if (!jiroCanvas || !jiroCtx) return;
  if (!currentChartData) {
    jiroCtx.clearRect(0, 0, jiroCanvas.width, jiroCanvas.height);
    seekChartState(0);
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const container = document.getElementById('jiro-preview-container');
  const rectWidth = container.clientWidth > 0 ? container.clientWidth : 946;
  const rectHeight = container.clientHeight > 0 ? container.clientHeight : 150;

  // 【軽量化】サイズ変更時のみCanvasバッファサイズを設定してガタつきを完全に防止
  if (jiroCanvas.width !== rectWidth * dpr || jiroCanvas.height !== rectHeight * dpr) {
    jiroCanvas.width = rectWidth * dpr;
    jiroCanvas.height = rectHeight * dpr;
  }
  jiroCtx.resetTransform();
  jiroCtx.scale(dpr, dpr);
  const elapsedTime = time;
  const baseCenterY = rectHeight / 2;
  const canvasMargin = 100;

  // ----------------------------------------------------
  // レイヤー 1: レーンの背景・ゴーゴー背景の描画（定位置に完全固定・最背面）
  // ----------------------------------------------------
  jiroCtx.clearRect(0, 0, rectWidth, rectHeight);
  const laneHeight = 76;
  const laneTop = baseCenterY - laneHeight / 2;

  // レーン背景
  jiroCtx.fillStyle = '#1b1b22';
  jiroCtx.fillRect(110, laneTop, rectWidth - 110, laneHeight);

  // ゴーゴー背景色の描画（色の濃さをほんの少し濃く維持）
  if (state_isGogo) {
    const grad = jiroCtx.createLinearGradient(110, 0, rectWidth, 0);
    grad.addColorStop(0, 'rgba(255, 69, 0, 0.45)');
    grad.addColorStop(0.5, 'rgba(255, 140, 0, 0.22)');
    grad.addColorStop(1, 'rgba(255, 140, 0, 0.05)');
    jiroCtx.fillStyle = grad;
    jiroCtx.fillRect(110, laneTop, rectWidth - 110, laneHeight);
  }

  // レーン枠境界線
  jiroCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  jiroCtx.lineWidth = 2;
  jiroCtx.strokeRect(110, laneTop, rectWidth - 110, laneHeight);

  // ----------------------------------------------------
  // レイヤー 2: レーン（小節線）の描画
  // ----------------------------------------------------
  const drawBarlines = currentChartData.drawBarlines || [];
  for (let i = 0; i < drawBarlines.length; i++) {
    const note = drawBarlines[i];
    const {
      bpm,
      scroll
    } = note;
    const pixelsPerSecondX = BASE_SCROLL_FACTOR * bpm * scroll * scrollMultiplier;
    const timeDiff = note.time - elapsedTime;
    const x = HIT_POSITION_X + timeDiff * pixelsPerSecondX;

    // 太鼓マスクの背面に入り込まないようクリップ
    if (x < 110 || x > rectWidth + canvasMargin || pixelsPerSecondX === 0) continue;
    if (!note.barlineVisible) continue;
    jiroCtx.beginPath();
    jiroCtx.moveTo(x, laneTop);
    jiroCtx.lineTo(x, laneTop + laneHeight);
    jiroCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    jiroCtx.lineWidth = 2;
    jiroCtx.stroke();
  }

  // ----------------------------------------------------
  // レイヤー 3: 判定枠（常時タイトオーラ ＆ 突入時高速破裂アニメ）の描画（※流れるノーツの背面に固定！）
  // ----------------------------------------------------
  const radiusNormal = 27.5;
  if (state_isGogo) {
    const gogoElapsed = elapsedTime - lastGogoStartTime;
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
    jiroCtx.save();
    const radGrad = jiroCtx.createRadialGradient(HIT_POSITION_X, baseCenterY, innerRadius, HIT_POSITION_X, baseCenterY, outerRadius);
    radGrad.addColorStop(0, `rgba(255, 90, 0, ${auraAlpha * 0.95})`);
    radGrad.addColorStop(0.4, `rgba(255, 140, 0, ${auraAlpha * 0.6})`);
    radGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');
    jiroCtx.beginPath();
    jiroCtx.arc(HIT_POSITION_X, baseCenterY, outerRadius, 0, Math.PI * 2);
    jiroCtx.fillStyle = radGrad;
    jiroCtx.fill();
    jiroCtx.restore();
  }

  // 判定枠の本体白サークル
  jiroCtx.beginPath();
  jiroCtx.arc(HIT_POSITION_X, baseCenterY, radiusNormal, 0, Math.PI * 2);
  jiroCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  jiroCtx.lineWidth = 2.5;
  jiroCtx.stroke();
  jiroCtx.beginPath();
  jiroCtx.arc(HIT_POSITION_X, baseCenterY, 18.5, 0, Math.PI * 2);
  jiroCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  jiroCtx.lineWidth = 1.5;
  jiroCtx.stroke();

  // ----------------------------------------------------
  // レイヤー 4: 流れるノーツ（音符・連打・風船）の描画（最前面レイヤー！）
  // ----------------------------------------------------
  const drawNormalNotes = currentChartData.drawNormalNotes || [];
  let activeRollNote = null;

  // インデックス降順（右側から順番に）で描画することにより、左側のノーツを最前面にする
  for (let i = drawNormalNotes.length - 1; i >= 0; i--) {
    const note = drawNormalNotes[i];
    if (chartCoolDownUntil !== null && note.time < chartCoolDownUntil) {
      if (note.type >= '5' && note.type <= '7' && note.endTime > elapsedTime) {} else {
        continue;
      }
    }
    const {
      bpm,
      scroll
    } = note;
    const pixelsPerSecondX = BASE_SCROLL_FACTOR * bpm * scroll * scrollMultiplier;
    const timeDiff = note.time - elapsedTime;
    const x = HIT_POSITION_X + timeDiff * pixelsPerSecondX;

    // 【軽量化】画面外の不要ノーツは完全にスキップして描画負荷を排除
    if (x < -canvasMargin || x > rectWidth + canvasMargin) continue;
    if (note.type >= '1' && note.type <= '4') {
      if (note.judgeResult === 'hit') continue;
      drawJiroPremiumNote(jiroCtx, x, baseCenterY, note.type);
    } else if (note.type === '5' || note.type === '6') {
      const pixelsPerSecondX_End = BASE_SCROLL_FACTOR * bpm * scroll * scrollMultiplier;
      const endTimeDiff = note.endTime - elapsedTime;
      const endX = HIT_POSITION_X + endTimeDiff * pixelsPerSecondX_End;
      if (x < -canvasMargin && endX < -canvasMargin || x > rectWidth + canvasMargin && endX > rectWidth + canvasMargin) continue;
      if (elapsedTime >= note.time && elapsedTime <= note.endTime) activeRollNote = note;
      const isBig = note.type === '6';
      const size = isBig ? 26 : 17;
      const color = NOTE_COLORS[note.type];
      jiroCtx.beginPath();
      jiroCtx.moveTo(x, baseCenterY);
      jiroCtx.lineTo(endX, baseCenterY);
      jiroCtx.strokeStyle = '#000000';
      jiroCtx.lineWidth = size * 2;
      jiroCtx.lineCap = 'round';
      jiroCtx.stroke();
      jiroCtx.beginPath();
      jiroCtx.moveTo(x, baseCenterY);
      jiroCtx.lineTo(endX, baseCenterY);
      jiroCtx.strokeStyle = '#FFFFFF';
      jiroCtx.lineWidth = (size - 1.5) * 2;
      jiroCtx.stroke();
      jiroCtx.beginPath();
      jiroCtx.moveTo(x, baseCenterY);
      jiroCtx.lineTo(endX, baseCenterY);
      jiroCtx.strokeStyle = color;
      jiroCtx.lineWidth = (size - 3) * 2;
      jiroCtx.stroke();
      jiroCtx.lineCap = 'butt';
      if (x >= -canvasMargin && x <= rectWidth + canvasMargin) {
        drawJiroPremiumNote(jiroCtx, x, baseCenterY, note.type);
      }
    } else if (note.type === '7') {
      if (note.judgeResult === 'hit' || note.judgeResult === 'miss') continue;
      const pixelsPerSecondX_End = BASE_SCROLL_FACTOR * bpm * scroll * scrollMultiplier;
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
      drawJiroBalloonNote(jiroCtx, displayX, baseCenterY, note);
      const remainingHits = note.hits - note.currentHits;
      jiroCtx.fillStyle = 'white';
      jiroCtx.font = 'bold 20px Inter';
      jiroCtx.textBaseline = 'middle';
      jiroCtx.textAlign = 'center';
      if (note.hits > 0 && note.judgeResult === 'pending') jiroCtx.fillText(remainingHits.toString(), displayX, baseCenterY);
    }
  }

  // ----------------------------------------------------
  // 5. 太鼓本体グラフィックの描画 (定位置に完全固定マスク)
  // ----------------------------------------------------
  jiroCtx.fillStyle = '#111113';
  jiroCtx.fillRect(0, 0, 110, rectHeight);

  // セパレータ境界線
  jiroCtx.strokeStyle = '#222';
  jiroCtx.lineWidth = 3;
  jiroCtx.beginPath();
  jiroCtx.moveTo(110, 0);
  jiroCtx.lineTo(110, rectHeight);
  jiroCtx.stroke();
  const taikoX = 55;
  const taikoY = baseCenterY;
  const taikoR = 43;

  // 太鼓の外輪
  jiroCtx.beginPath();
  jiroCtx.arc(taikoX, taikoY, taikoR, 0, Math.PI * 2);
  jiroCtx.fillStyle = '#1e1e1e';
  jiroCtx.fill();
  jiroCtx.lineWidth = 4;
  jiroCtx.strokeStyle = '#121212';
  jiroCtx.stroke();

  // 太鼓の面
  jiroCtx.beginPath();
  jiroCtx.arc(taikoX, taikoY, taikoR - 11, 0, Math.PI * 2);
  jiroCtx.fillStyle = '#2d2d2d';
  jiroCtx.fill();
  jiroCtx.lineWidth = 3;
  jiroCtx.strokeStyle = '#1d1d1d';
  jiroCtx.stroke();

  // ----------------------------------------------------
  // 6. 太鼓ヒット時の面・縁の発光エフェクト
  // ----------------------------------------------------
  const rInner = taikoR - 11;
  const partsOrder = ['kaR', 'donR', 'donL', 'kaL'];
  partsOrder.forEach(part => {
    const eff = taikoEffects[part];
    if (!eff.active) return;
    const progress = (elapsedTime - eff.startTime) / EFFECT_DURATION;
    if (progress >= 1.0 || progress < 0) {
      eff.active = false;
      return;
    }
    const opacity = 1.0 - progress;
    jiroCtx.save();
    jiroCtx.beginPath();
    if (part === 'donL') {
      jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 0.5, Math.PI * 1.5, false);
      jiroCtx.fillStyle = `rgba(244, 67, 54, ${opacity * 0.75})`;
      jiroCtx.fill();
    } else if (part === 'donR') {
      jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 1.5, Math.PI * 2.5, false);
      jiroCtx.fillStyle = `rgba(244, 67, 54, ${opacity * 0.75})`;
      jiroCtx.fill();
    } else if (part === 'kaL') {
      jiroCtx.arc(taikoX, taikoY, taikoR, Math.PI * 0.5, Math.PI * 1.5, false);
      jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 1.5, Math.PI * 0.5, true);
      jiroCtx.closePath();
      jiroCtx.fillStyle = `rgba(33, 150, 243, ${opacity * 0.75})`;
      jiroCtx.fill();
    } else if (part === 'kaR') {
      jiroCtx.arc(taikoX, taikoY, taikoR, Math.PI * 1.5, Math.PI * 2.5, false);
      jiroCtx.arc(taikoX, taikoY, rInner, Math.PI * 2.5, Math.PI * 1.5, true);
      jiroCtx.closePath();
      jiroCtx.fillStyle = `rgba(33, 150, 243, ${opacity * 0.75})`;
      jiroCtx.fill();
    }
    jiroCtx.restore();
  });

  // ----------------------------------------------------
  // 7. コンボ表示の描画 (最前面)
  // ----------------------------------------------------
  if (currentCombo > 0) {
    jiroCtx.save();
    jiroCtx.fillStyle = '#ffffff';
    jiroCtx.font = `bold ${Math.floor(22 * comboBounceScale)}px "Hiragino Kaku Gothic ProN", Meiryo, sans-serif`;
    jiroCtx.textBaseline = 'middle';
    jiroCtx.textAlign = 'center';
    jiroCtx.strokeStyle = '#000000';
    jiroCtx.lineWidth = 5;
    jiroCtx.strokeText(`${currentCombo}`, taikoX, taikoY);
    jiroCtx.fillText(`${currentCombo}`, taikoX, taikoY);
    jiroCtx.restore();
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

function setChartTime(time) {
  clearTaikoEffects();
  if (!currentChartData) {
    currentElapsedTime = 0;
    currentMeasureIndex = 0;
    currentCombo = 0;
    updateComboDisplay();
    updateMeasureDisplay();
    seekChartState(0);
    updateJiroPreview(0);
    return;
  }
  const wasPlaying = isPlaying;
  if (wasPlaying) stopSimulation();
  currentElapsedTime = time;
  currentMeasureIndex = findMeasureIndex(time);
  let initialCombo = 0;
  currentChartData.notes.forEach(note => {
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
          note.currentHits = Math.floor(duration / (1.0 / autoRollSpeed));
        }
      }
    } else {
      note.judgeResult = 'pending';
      note.currentHits = 0;
      note.lastAutoHitTime = 0;
    }
  });
  currentCombo = initialCombo;
  updateComboDisplay();
  updateMeasureDisplay();
  seekChartState(currentElapsedTime);
  updateJiroPreview(currentElapsedTime);
  if (wasPlaying) {
    chartCoolDownUntil = null;
    stopAtTime = null;
    startSimulation();
  }
}

async function startSimulation() {
  if (isPlaying || !currentChartData) return;

  // 【堅牢化】再生開始前に古いタイマーの残留を完全に払拭（二重起動防止）
  if (logicIntervalId) {
    clearInterval(logicIntervalId);
    logicIntervalId = null;
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  initializeAudio();
  if (audioContext) {
    if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
      try {
        await audioContext.resume();
      } catch (e) {
        console.error("Failed to resume AudioContext during startSimulation", e);
        stopSimulation();
        return;
      }
    }
  }
  isPlaying = true;
  const requiredWaveName = tjaParsed.headers.wave;
  const isFileNameMatch = requiredWaveName && uploadedMusicFileName && requiredWaveName.toLowerCase() === uploadedMusicFileName.toLowerCase();
  simulationStartOffset = currentElapsedTime;
  simulationStartTime = audioContext ? audioContext.currentTime : 0;

  // 【要件1: 修正】タイマー競合バグを排除するため、描画用とロジックフォールバック用タイムスタンプを個別にリセット
  lastFrameTime = performance.now();
  lastLogicTime = performance.now();
  if (musicAudioBuffer && isFileNameMatch) {
    musicSourceNode = audioContext.createBufferSource();
    musicSourceNode.buffer = musicAudioBuffer;
    musicSourceNode.playbackRate.value = playbackSpeed;
    if ('preservesPitch' in musicSourceNode) {
      musicSourceNode.preservesPitch = true;
    }
    musicSourceNode.connect(musicGainNode);
    const offset = tjaParsed.headers.offset || 0;
    const targetTime = coolDownTime + Math.max(0, offset);
    if (simulationStartOffset < targetTime) {
      let waitTime = targetTime - simulationStartOffset;
      let realWaitTime = waitTime / playbackSpeed;
      musicSourceNode.start(audioContext.currentTime + realWaitTime, 0);
    } else {
      let playedRealTime = simulationStartOffset - targetTime;
      let musicOffset = playedRealTime;
      musicSourceNode.start(audioContext.currentTime, musicOffset);
    }
  }
  u('#jiro-btn-play').text('一時停止');
  lastAutoEffectTime = 0;
  logicIntervalId = setInterval(updateLogic, 1000 / 240);
  animationFrameId = requestAnimationFrame(drawLoop);
}

function stopSimulation() {
  if (!isPlaying) return;
  isPlaying = false;
  if (musicSourceNode) {
    try {
      musicSourceNode.stop();
    } catch (e) {}
    musicSourceNode.disconnect();
    musicSourceNode = null;
  }
  stopAtTime = null;
  chartCoolDownUntil = null;

  // 【堅牢化】タイマーリークの可能性を完全に断つ
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (logicIntervalId) {
    clearInterval(logicIntervalId);
    logicIntervalId = null;
  }
  u('#jiro-btn-play').text('再生');
  u('#jiro-judge-display').html('');
  u('#jiro-roll-display').html('');
  clearTaikoEffects();
  updateJiroPreview(currentElapsedTime);
}

function togglePlay() {
  if (isPlaying) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

function resetSimulation() {
  stopSimulation();
  setChartTime(0);
}

function findMeasureIndex(time) {
  if (!currentChartData) return 0;
  let index = 0;
  for (let i = 0; i < currentChartData.allMeasureTimes.length; i++) {
    if (currentChartData.allMeasureTimes[i] <= time) index = i;else break;
  }
  return index;
}

function seekToMeasure(direction) {
  if (isPlaying || !currentChartData) return;
  const newMeasureIndex = Math.max(0, Math.min(currentChartData.allMeasureTimes.length - 1, currentMeasureIndex + direction));
  setChartTime(currentChartData.allMeasureTimes[newMeasureIndex]);
}

function playSE(type) {
  if (performance.now() - lastSEPlayTime[type] < 1000 / renderFPS) return;
  if (!audioContext || !audioBuffers[type] || !seGainNode) return;
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffers[type];
  source.connect(seGainNode);
  source.start(0);
  lastSEPlayTime[type] = performance.now();
}

function updateComboDisplay() {}

function updateMeasureDisplay() {
  if (!currentChartData || !currentChartData.allMeasureTimes) {
    u('#jiro-measure-display').text('');
    return;
  }
  const currentMeasure = currentMeasureIndex + 1;
  const totalMeasures = currentChartData.allMeasureTimes.length;
  u('#jiro-measure-display').text(`小節: ${currentMeasure} / ${totalMeasures}`);
}

function autoHitCheck(elapsedTime) {
  if (!currentChartData) return;

  // 【軽量化】無駄なループを徹底的に排除した高速巡回
  for (let i = 0; i < currentChartData.notes.length; i++) {
    const note = currentChartData.notes[i];
    if (note.judgeResult !== 'pending') continue;

    // 通常ノーツの処理
    if (note.type >= '1' && note.type <= '4') {
      // 【軽量・遅延ゼロ同期】ノーツ到達の120ms前にWeb Audio APIのオーディオ currentTime をベースに先読み予約
      if (isPlaying && !note.seScheduled) {
        const playTime = note.time;
        if (elapsedTime >= playTime - 0.12) {
          const targetAudioTime = simulationStartTime + (playTime - simulationStartOffset) / playbackSpeed;
          if (targetAudioTime >= audioContext.currentTime) {
            playSEAtTime(note.type === '1' || note.type === '3' ? 'don' : 'ka', targetAudioTime);
          } else {
            playSEAtTime(note.type === '1' || note.type === '3' ? 'don' : 'ka', audioContext.currentTime);
          }
          note.seScheduled = true;
        }
      }

      // 映像上の到達瞬間に画面エフェクトとコンボ加算
      if (elapsedTime >= note.time) {
        note.judgeResult = 'hit';
        const timeSinceLastEffect = elapsedTime - lastAutoEffectTime;
        if (timeSinceLastEffect >= 1.0 / 60.0) {
          lastAutoEffectTime = elapsedTime;
        }
        if (note.type === '1' || note.type === '3') {
          triggerAutoHitSide('don', elapsedTime, note.type === '3');
        } else if (note.type === '2' || note.type === '4') {
          triggerAutoHitSide('ka', elapsedTime, note.type === '4');
        }
        currentCombo++;
        comboBounceScale = 1.35;
      } else if (elapsedTime > note.time + JUDGE_BAD) {
        note.judgeResult = 'miss';
        currentCombo = 0;
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
          lastAutoEffectTime = elapsedTime;
          playSEAtTime('don', audioContext.currentTime);
          triggerAutoHitSide('don', elapsedTime);
          if (note.type === '7' && note.hits > 0 && note.currentHits >= note.hits) {
            note.judgeResult = 'hit';
            playSEAtTime('balloon', audioContext.currentTime);
          }
        }

        // 2打目以降（通常のインターバル時間カウント）
        const timeSinceLastHit = elapsedTime - note.lastAutoHitTime;
        if (timeSinceLastHit >= hitInterval) {
          const hits = Math.floor(timeSinceLastHit / hitInterval);
          note.lastAutoHitTime += hitInterval * hits;
          note.currentHits += hits;
          const timeSinceLastEffect = elapsedTime - lastAutoEffectTime;
          if (timeSinceLastEffect >= 1.0 / 60.0) {
            lastAutoEffectTime = elapsedTime;
          }
          playSEAtTime('don', audioContext.currentTime);
          triggerAutoHitSide('don', elapsedTime);
          if (note.type === '7' && note.hits > 0 && note.currentHits >= note.hits) {
            note.judgeResult = 'hit';
            playSEAtTime('balloon', audioContext.currentTime);
          }
        }
      } else if (elapsedTime > note.endTime) {
        if (note.type === '5' || note.type === '6') note.judgeResult = 'hit';
      }
    }
  }
}

function updateLogic() {
  const now = performance.now();
  if (audioContext && audioContext.state === 'running' && isPlaying) {
    currentElapsedTime = simulationStartOffset + (audioContext.currentTime - simulationStartTime) * playbackSpeed;
  } else if (isPlaying) {
    // 【要件1: 修正】FPS制限タイマーと完全に独立させた、ロジック経過時間専用フォールバックでフリーズを完全防止！
    const delta = (now - lastLogicTime) / 1000.0;
    currentElapsedTime += delta * playbackSpeed;
  }
  lastLogicTime = now; // ロジック専用に更新

  if (chartCoolDownUntil !== null && currentElapsedTime >= chartCoolDownUntil) {
    chartCoolDownUntil = null;
  }
  let chartEndTime = currentChartData ? currentChartData.endTime : 0;
  let musicEndTime = musicAudioBuffer ? musicAudioBuffer.duration : 0;
  let maxPlayTime = Math.max(chartEndTime, musicEndTime);
  if (maxPlayTime > 0 && currentElapsedTime >= maxPlayTime) {
    if (currentChartData && currentChartData.allMeasureTimes.length > 0) {
      currentElapsedTime = currentChartData.allMeasureTimes[currentChartData.allMeasureTimes.length - 1];
      currentMeasureIndex = currentChartData.allMeasureTimes.length - 1;
    } else {
      currentElapsedTime = 0;
      currentMeasureIndex = 0;
    }
    stopSimulation();
    return;
  }
  if (stopAtTime !== null && currentElapsedTime >= stopAtTime) {
    stopSimulation();
    currentElapsedTime = stopAtTime;
    updateJiroPreview(currentElapsedTime);
    return;
  }
  updateChartState(currentElapsedTime);
  if (chartCoolDownUntil === null) {
    autoHitCheck(currentElapsedTime);
  }
  updateJiroUIElements();
}

function updateJiroUIElements() {
  const now = performance.now();
  if (now - lastUIUpdateTime < 100) return;
  lastUIUpdateTime = now;
  const totalDuration = musicAudioBuffer ? Math.max(currentChartData ? currentChartData.endTime : 0, musicAudioBuffer.duration) : currentChartData ? currentChartData.endTime : 0;
  u('#jiro-time-display').text(`${currentElapsedTime.toFixed(2)} / ${totalDuration.toFixed(2)}s`);
  currentMeasureIndex = findMeasureIndex(currentElapsedTime);
  updateMeasureDisplay();
  const seekbar = u('#jiro-seekbar').first();
  if (seekbar && totalDuration > 0 && document.activeElement !== seekbar) {
    seekbar.value = currentElapsedTime / totalDuration * 1000;
  }
}

function drawLoop(timestamp) {
  if (!isPlaying) return;
  animationFrameId = requestAnimationFrame(drawLoop);
  const elapsed = timestamp - lastFrameTime;
  if (elapsed < 1000 / renderFPS) return;
  lastFrameTime = timestamp - elapsed % (1000 / renderFPS); // 【要件1: 修正】ロジックに影響を与えない完全に独立した描画間隔制御

  updateJiroPreview(currentElapsedTime);
}