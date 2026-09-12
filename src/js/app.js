function updateUI() {
  u('.controls-diff .button').addClass('is-hidden');
  if (tjaParsed && tjaParsed.courses) Object.keys(tjaParsed.courses).forEach(d => u(`.btn-diff-${d}`).removeClass('is-hidden'));
  u('.button.is-active').removeClass('is-active');
  u(`.btn-diff-${selectedDifficulty}`).addClass('is-active');
  u(`.btn-page-${selectedPage}`).addClass('is-active');
  u('.page').addClass('is-hidden');
  u(`.page-${selectedPage}`).removeClass('is-hidden');
  if (tjaParsed && selectedDifficulty !== '') {
    if (selectedPage === 'editor') {
      if (isChartCacheDirty || !cachedChartCanvas) {
        cachedChartCanvas = drawChart(tjaParsed, selectedDifficulty);
        isChartCacheDirty = false;
      }
      const viewCanvas = document.createElement('canvas');
      viewCanvas.width = cachedChartCanvas.width;
      viewCanvas.height = cachedChartCanvas.height;
      viewCanvas.style.width = cachedChartCanvas.style.width;
      viewCanvas.style.height = cachedChartCanvas.style.height;
      const viewCtx = viewCanvas.getContext('2d');
      viewCtx.drawImage(cachedChartCanvas, 0, 0);
      u('.page-editor').empty().append(viewCanvas);
      u('.page-editor').first().style.width = zoomLevel + '%';
    } else if (selectedPage === 'preview') {
      updateJiroPreview(currentElapsedTime);
    } else if (selectedPage === 'statistics') {
      const s = getStats(tjaParsed, selectedDifficulty);
      const dNames = ['かんたん', 'ふつう', 'むずかしい', 'おに', '裏おに'];
      const c = tjaParsed.courses[selectedDifficulty];
      u('#st-title').text(tjaParsed.headers.title);
      u('#st-subtitle').text(tjaParsed.headers.subtitle || '');
      u('#st-diff').text(`${dNames[c.course]} ★${c.headers.level}`);
      let bStr = s.minBpm === s.maxBpm ? `${formatBpm(s.minBpm)}` : `${formatBpm(s.minBpm)}-${formatBpm(s.maxBpm)} (${formatBpm(s.mainBpm)})`;
      u('#st-bpm').text(bStr);
      u('#st-notes').text(s.combo);
      u('#st-time').text(s.perfTime.toFixed(2) + "s");
      u('#st-density').text(s.density.toFixed(3) + " /s");
      let rendaHtml = `
        <div style="margin-bottom: 6px;">
          <div style="color: #8c8c9e; font-weight: bold; margin-bottom: 2px;">黄色連打</div>
          <div style="word-break: break-all; color: #e3e3e6;">`;
      if (s.rendas && s.rendas.length > 0) {
        rendaHtml += `${s.rendas.map(r => r.toFixed(2) + "s").join(" + ")}<br>`;
        rendaHtml += `(合計: ${s.rendas.reduce((a, b) => a + b, 0).toFixed(2)}s)`;
      } else {
        rendaHtml += `0.00s<br>(合計: 0.00s)`;
      }
      rendaHtml += `
          </div>
        </div>
        <div>
          <div style="color: #8c8c9e; font-weight: bold; margin-bottom: 2px;">風船連打</div>
          <div style="word-break: break-all; color: #e3e3e6;">`;
      const balloons = c.headers.balloon;
      if (balloons && balloons.length > 0) {
        const balloonSum = balloons.reduce((a, b) => a + b, 0);
        rendaHtml += `${balloons.map(b => b + "打").join(" + ")}<br>`;
        rendaHtml += `(合計: ${balloonSum}打)`;
      } else {
        rendaHtml += `なし<br>(合計: 0打)`;
      }
      rendaHtml += `
          </div>
        </div>
      `;
      u('#st-renda').html(rendaHtml);
      drawDensityGraph(s.measures);
    }
  }
}

/** エディタ文字色分け用のハイライトヘルパー (要件3仕様維持) **/

window.addEventListener('resize', syncLineHeights);

textarea.addEventListener('scroll', syncScroll);

const processFunc = () => {
  const val = u('.input').first().value;
  updateHighlight();
  if (!val) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      tjaParsed = parseTJA(val);
      if (!selectedDifficulty || !tjaParsed.courses[selectedDifficulty]) selectedDifficulty = Object.keys(tjaParsed.courses)[0];
      const parsedForPreview = parseTJAForPreview(val);
      currentChartData = parsedForPreview.courses[selectedDifficulty] || null;
      if (currentChartData) {
        tjaParsed.headers.offset = parsedForPreview.globalConfig.OFFSET;
        setChartTime(currentElapsedTime);
      }
      isChartCacheDirty = true;
      updateUI();
      u('.errors').text('No error');
      if (errorLineNumber !== null) {
        errorLineNumber = null;
        updateHighlight();
      }
      localStorage.setItem('tja_tools_autosave', val);
    } catch (e) {
      u('.errors').text(e.message);
      const match = e.message.match(/(?:行|line)\s*([0-9]+)/i);
      if (match) {
        errorLineNumber = parseInt(match[1], 10);
      } else {
        errorLineNumber = null;
      }
      updateHighlight();
    }
  }, 150);
};

u('.input').on('input', processFunc);

u('#btn-open').on('click', () => u('#file-input').first().click());

u('#file-input').on('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  stopSimulation();
  setChartTime(0);
  const ext = f.name.split('.').pop().toLowerCase();
  const allowed = ["tja", "mc", "txt", "zip", "mcz", "mp3", "m4a", "wav", "ogg"];
  if (!allowed.includes(ext)) {
    u('.errors').text("エラー: 対応していない形式です (.tja, .mc, .zip 等のみ)");
    return;
  }
  try {
    let content = "";
    const ab = await f.arrayBuffer();
    if (f.name.toLowerCase().match(/\.(zip|mcz)$/)) {
      const zip = await JSZip.loadAsync(ab);
      const tjaF = Object.values(zip.files).find(file => file.name.toLowerCase().endsWith('.tja') || file.name.toLowerCase().endsWith('.mc'));
      if (!tjaF) throw new Error("譜面が見つかりません");
      const buf = await tjaF.async("arraybuffer");
      content = tjaF.name.endsWith('.mc') ? convertMCtoTJA(await loadFileWithEncoding(buf)) : await loadFileWithEncoding(buf);
      const tempParsed = parseTJA(content);
      const waveName = tempParsed.headers.wave ? tempParsed.headers.wave.toLowerCase() : "";
      let audioFileInZip = null;
      if (waveName) {
        audioFileInZip = Object.values(zip.files).find(file => {
          const fname = file.name.split('/').pop().toLowerCase();
          return fname === waveName;
        });
      }
      if (!audioFileInZip) {
        const audioExts = [".mp3", ".m4a", ".wav", ".ogg"];
        audioFileInZip = Object.values(zip.files).find(file => {
          const nameLower = file.name.toLowerCase();
          return audioExts.some(ext => nameLower.endsWith(ext));
        });
      }
      if (audioFileInZip) {
        initializeAudio();
        const audioData = await audioFileInZip.async("arraybuffer");
        try {
          musicAudioBuffer = await audioContext.decodeAudioData(audioData);
          uploadedMusicFileName = audioFileInZip.name.split('/').pop();
          if (uploadedMusicObjectURL) URL.revokeObjectURL(uploadedMusicObjectURL);
          uploadedMusicObjectURL = URL.createObjectURL(new Blob([audioData]));
          u('#music-filename-display').text(`音源: ${uploadedMusicFileName}`);
          await saveData('files', {
            id: 'music',
            name: uploadedMusicFileName,
            data: new Blob([audioData])
          });
        } catch (decErr) {
          console.error("音源デコードエラー:", decErr);
          u('.errors').text("音源ファイルのデコードに失敗しました: " + decErr.message);
        }
      } else {
        u('#music-filename-display').text("音源: 未ロード");
      }
    } else if (f.name.toLowerCase().match(/\.(mp3|m4a|wav|ogg)$/)) {
      initializeAudio();
      try {
        musicAudioBuffer = await audioContext.decodeAudioData(ab.slice(0));
        uploadedMusicFileName = f.name;
        if (uploadedMusicObjectURL) URL.revokeObjectURL(uploadedMusicObjectURL);
        uploadedMusicObjectURL = URL.createObjectURL(f);
        u('#music-filename-display').text(`音源: ${uploadedMusicFileName}`);
        await saveData('files', {
          id: 'music',
          name: uploadedMusicFileName,
          data: f
        });
      } catch (decErr) {
        console.error("音源デコードエラー:", decErr);
        u('.errors').text("音源ファイルのデコードに失敗しました: " + decErr.message);
      }
      e.target.value = null;
      return;
    } else {
      content = f.name.endsWith('.mc') ? convertMCtoTJA(await loadFileWithEncoding(ab)) : await loadFileWithEncoding(ab);
    }
    u('.input').first().value = content;
    isChartCacheDirty = true;
    processFunc();
  } catch (err) {
    u('.errors').text(err.message);
  }
  e.target.value = null;
});

u('#zoom-in').on('click', e => {
  e.preventDefault();
  zoomLevel += 20;
  updateUI();
});

u('#zoom-out').on('click', e => {
  e.preventDefault();
  zoomLevel = Math.max(100, zoomLevel - 20);
  updateUI();
});

u('#btn-save').on('click', () => {
  const cv = u('canvas').first();
  if (!cv) return;
  const link = document.createElement('a');
  link.download = (tjaParsed.headers.title || 'chart') + '.png';
  link.href = cv.toDataURL();
  link.click();
});

u('#btn-tja-save').on('click', () => {
  if (!tjaParsed) return;
  const codes = Encoding.convert(Encoding.stringToCode(u('.input').first().value), 'SJIS', 'UNICODE');
  const blob = new Blob([new Uint8Array(codes)], {
    type: 'application/octet-stream'
  });
  const name = (tjaParsed.headers.wave || "chart.tja").split('.')[0] + ".tja";
  const link = document.createElement('a');
  link.download = name;
  link.href = URL.createObjectURL(blob);
  link.click();
});

u('#btn-grad-replace').on('click', () => {
  replaceGradation();
  processFunc();
});

u('.controls-diff .button[data-value]').on('click', e => {
  selectedDifficulty = u(e.target).data('value');
  currentChartData = preparePreviewChart(tjaParsed, selectedDifficulty);
  if (currentChartData) {
    seekChartState(0);
    setChartTime(0);
  }
  isChartCacheDirty = true;
  updateUI();
});

u('.controls-page .button[data-value]').on('click', e => {
  selectedPage = u(e.target).data('value');
  if (selectedPage === 'preview') {
    u('.pane-left').addClass('is-hidden');
  } else {
    u('.pane-left').removeClass('is-hidden');
  }
  updateUI();
});

// 集中モード

// 集中モード
u('.input').on('focus', () => {
  u('body').addClass('focus-mode');
});

u('.input').on('blur', () => {
  u('body').removeClass('focus-mode');
});

u('#jiro-speed').on('change', e => {
  const newSpeed = parseFloat(e.target.value) || 1.0;
  if (isPlaying) {
    const currentElapsedTimeTemp = currentElapsedTime;
    if (musicSourceNode) {
      musicSourceNode.playbackRate.value = newSpeed;
    }
    simulationStartOffset = currentElapsedTimeTemp;
    simulationStartTime = audioContext ? audioContext.currentTime : 0;
  }
  playbackSpeed = newSpeed;
});

u('#jiro-btn-play').on('click', togglePlay);

u('#jiro-btn-stop').on('click', resetSimulation);

u('#jiro-btn-prev').on('click', () => {
  if (!currentChartData) return;
  const curIndex = findMeasureIndex(currentElapsedTime);
  let targetIndex = curIndex;
  if (curIndex > 0 && Math.abs(currentElapsedTime - currentChartData.allMeasureTimes[curIndex]) < 0.5) {
    targetIndex = curIndex - 1;
  }
  const targetTime = currentChartData.allMeasureTimes[targetIndex];
  setChartTime(targetTime);
});

u('#jiro-btn-next').on('click', () => {
  if (!currentChartData) return;
  const curIndex = findMeasureIndex(currentElapsedTime);
  const totalMeasures = currentChartData.allMeasureTimes.length - 1;
  const targetIndex = Math.min(totalMeasures, curIndex + 1);
  const targetTime = currentChartData.allMeasureTimes[targetIndex];
  setChartTime(targetTime);
});

u('#jiro-vol-music').on('input', e => {
  musicVolume = parseFloat(e.target.value) / 100;
  if (musicGainNode) musicGainNode.gain.value = musicVolume;
});

u('#jiro-vol-se').on('input', e => {
  seVolume = parseFloat(e.target.value) / 100;
  if (seGainNode) seGainNode.gain.value = seVolume;
});

// ドラッグ中の経過時間を追従させつつプレビュー

// ドラッグ中の経過時間を追従させつつプレビュー
u('#jiro-seekbar').on('input', e => {
  if (!currentChartData) return;
  const totalDuration = musicAudioBuffer ? Math.max(currentChartData.endTime, musicAudioBuffer.duration) : currentChartData.endTime;
  const ratio = parseFloat(e.target.value) / 1000;
  const time = ratio * totalDuration;
  u('#jiro-time-display').text(`${time.toFixed(2)} / ${totalDuration.toFixed(2)}s`);
  currentElapsedTime = time;
  seekChartState(time);
  updateJiroPreview(time);
});

u('#jiro-seekbar').on('change', e => {
  if (!currentChartData) return;
  const totalDuration = musicAudioBuffer ? Math.max(currentChartData.endTime, musicAudioBuffer.duration) : currentChartData.endTime;
  const ratio = parseFloat(e.target.value) / 1000;
  const targetTime = ratio * totalDuration;
  let closestTime = 0;
  let minDiff = Infinity;
  currentChartData.allMeasureTimes.forEach(t => {
    const diff = Math.abs(t - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestTime = t;
    }
  });
  setChartTime(closestTime);
});

window.addEventListener('keydown', e => {
  if (selectedPage !== 'preview') return;
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) return;
  if (e.key === ' ') {
    e.preventDefault();
    if (e.repeat) return;
    togglePlay();
    return;
  }
  if (!isPlaying && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    if (!currentChartData || currentChartData.barlineTimes.length === 0) return;
    if (e.key === 'ArrowUp') setChartTime(currentChartData.barlineTimes[currentChartData.barlineTimes.length - 1]);else if (e.key === 'ArrowDown') setChartTime(currentChartData.barlineTimes[0]);
    return;
  }
  if (keyState[e.key]) {
    e.preventDefault();
    if (keyState[e.key].pressed) return;
    keyState[e.key].pressed = true;
    keyState[e.key].pressStartTime = performance.now();
    keyState[e.key].currentInterval = KEY_REPEAT_INTERVAL_BASE;
    seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1);
    keyState[e.key].timer = setTimeout(() => {
      if (keyState[e.key].timer) clearInterval(keyState[e.key].timer);
      keyState[e.key].timer = setInterval(() => {
        const elapsedTime = performance.now() - keyState[e.key].pressStartTime;
        const speedUpCount = Math.floor(elapsedTime / KEY_SPEED_UP_TIME);
        const newInterval = KEY_REPEAT_INTERVAL_BASE / Math.pow(2, speedUpCount);
        if (newInterval !== keyState[e.key].currentInterval) {
          clearInterval(keyState[e.key].timer);
          keyState[e.key].currentInterval = newInterval;
          keyState[e.key].timer = setInterval(() => seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1), keyState[e.key].currentInterval);
        }
        seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1);
      }, keyState[e.key].currentInterval);
    }, KEY_REPEAT_DELAY);
  }
});

window.addEventListener('keyup', e => {
  if (keyState[e.key]) {
    e.preventDefault();
    keyState[e.key].pressed = false;
    if (keyState[e.key].timer) {
      clearInterval(keyState[e.key].timer);
      keyState[e.key].timer = null;
    }
  }
});

// 【要件4】画面・タブ切り替え（バックグラウンド移行＆復帰）時のラグキャリブレーション付き復帰イベントリスナー

// 【要件4】画面・タブ切り替え（バックグラウンド移行＆復帰）時のラグキャリブレーション付き復帰イベントリスナー
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    // バックグラウンド移行時：即座に一時停止し、オーディオスレッド・タイマースレッドを完全にクリーンアップして初期化
    if (isPlaying) {
      wasPlayingBeforeHidden = true;
      stopSimulation();
    } else {
      wasPlayingBeforeHidden = false;
    }
  } else {
    // フォアグラウンド復帰時：AudioContextを非同期で確実に復旧
    if (audioContext) {
      if (audioContext.state === 'suspended' || audioContext.state === 'interrupted') {
        try {
          await audioContext.resume();
        } catch (e) {
          console.warn("VisibilityChange: resume failed", e);
        }
      }
    }

    // 以前再生中だった場合、非同期のオーディオ準備を十分に待つため250msの安全ディレイを挟んで安定再開
    if (wasPlayingBeforeHidden) {
      wasPlayingBeforeHidden = false;
      setTimeout(async () => {
        // すでに別スレッドで走っていないことを確認した上で起動 (startSimulation内部で時刻基準をキャリブレーションしてラグを完全相殺)
        if (!isPlaying) {
          await startSimulation();
        }
      }, 250);
    } else {
      // 【ラグ相殺】非表示中の蓄積されたラグを完全にクリーンアップし、復帰直前の正確な時間で演奏位置をリセット・再描画
      seekChartState(currentElapsedTime);
      updateJiroPreview(currentElapsedTime);
    }
  }
});

window.addEventListener('focus', async () => {
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (e) {}
  }
  updateJiroPreview(currentElapsedTime);
});

window.addEventListener('touchstart', async () => {
  if (audioContext && audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (e) {}
  }
}, {
  passive: true
});

window.addEventListener('DOMContentLoaded', async () => {
  jiroCanvas = document.getElementById('jiro-previewCanvas');
  if (jiroCanvas) {
    jiroCtx = jiroCanvas.getContext('2d');
  }
  await initDB();
  const saved = localStorage.getItem('tja_tools_autosave');
  if (saved) {
    u('.input').first().value = saved;
    processFunc();
  }
  try {
    const musicFile = await loadData('files', 'music');
    if (musicFile && musicFile.data) {
      uploadedMusicObjectURL = URL.createObjectURL(musicFile.data);
      uploadedMusicFileName = musicFile.name;
      u('#music-filename-display').text(`音源: ${musicFile.name}`);
      initializeAudio();
      const arrayBuffer = await musicFile.data.arrayBuffer();
      musicAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    }
  } catch (error) {
    console.error("Failed to load music from DB:", error);
  }
});