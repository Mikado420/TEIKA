import { formatBpm, loadFileWithEncoding } from './utils.js';
import { state, initDB, saveData, loadData } from './state.js';
import { parseTJA, convertMCtoTJA, parseTJAForPreview } from './tja-parser.js';
import { textarea, updateLineNumbers, syncLineHeights, debouncedSyncLineHeights, syncScroll, updateHighlight, replaceGradation } from './editor.js';
import { drawChart, getStats, drawDensityGraph } from './statistics.js';
import { findMeasureIndex, initializeAudio, updateChartState, seekChartState, drawJiroPremiumNote, drawJiroBalloonNote, updateJiroPreview, setChartTime, startSimulation, stopSimulation, togglePlay, resetSimulation, seekToMeasure, playSE, updateComboDisplay, updateMeasureDisplay, autoHitCheck, updateLogic, updateJiroUIElements, drawLoop } from './preview.js';
function updateUI() {
  u('.controls-diff .button').addClass('is-hidden');
  if (state.tjaParsed && state.tjaParsed.courses) Object.keys(state.tjaParsed.courses).forEach(d => u(`.btn-diff-${d}`).removeClass('is-hidden'));
  u('.button.is-active').removeClass('is-active');
  u(`.btn-diff-${state.selectedDifficulty}`).addClass('is-active');
  u(`.btn-page-${state.selectedPage}`).addClass('is-active');
  u('.page').addClass('is-hidden');
  u(`.page-${state.selectedPage}`).removeClass('is-hidden');
  
  
  // Update toggle button text globally
  if (state.isChartImageVisible) {
    u('#btn-toggle-image').text('🖼 譜面画像 ON');
  } else {
    u('#btn-toggle-image').text('🖼 譜面画像 OFF');
  }
  
  // Update zoom label
  if (u('#zoom-label').nodes.length > 0) {
    u('#zoom-label').text(state.zoomLevel + '%');
  }

  // Show toggle button only on editor page
  if (state.selectedPage === 'editor') {
    u('#btn-toggle-image').removeClass('is-hidden');
    if (state.isChartImageVisible) {
      u('.pane-right').removeClass('is-hidden');
    } else {
      u('.pane-right').addClass('is-hidden');
    }
  } else {
    u('#btn-toggle-image').addClass('is-hidden');
    u('.pane-right').removeClass('is-hidden');
  }

  if (state.tjaParsed && state.selectedDifficulty !== '') {
    if (state.selectedPage === 'editor') {
      if (state.isChartCacheDirty || !state.cachedChartCanvas) {
        state.cachedChartCanvas = drawChart(state.tjaParsed, state.selectedDifficulty);
        state.isChartCacheDirty = false;
      }
      const viewCanvas = document.createElement('canvas');
      viewCanvas.width = state.cachedChartCanvas.width;
      viewCanvas.height = state.cachedChartCanvas.height;
      viewCanvas.style.width = state.cachedChartCanvas.style.width;
      viewCanvas.style.height = state.cachedChartCanvas.style.height;
      const viewCtx = viewCanvas.getContext('2d');
      viewCtx.drawImage(state.cachedChartCanvas, 0, 0);
      u('.page-editor').empty().append(viewCanvas);
      u('.page-editor').first().style.width = state.zoomLevel + '%';
    } else if (state.selectedPage === 'preview') {
      updateJiroPreview(state.currentElapsedTime);
    } else if (state.selectedPage === 'statistics') {
      const s = getStats(state.tjaParsed, state.selectedDifficulty);
      const dNames = ['かんたん', 'ふつう', 'むずかしい', 'おに', '裏おに'];
      const c = state.tjaParsed.courses[state.selectedDifficulty];
      u('#st-title').text(state.tjaParsed.headers.title);
      u('#st-subtitle').text(state.tjaParsed.headers.subtitle || '');
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

const handleResize = () => {
  requestAnimationFrame(() => {
    syncLineHeights();
    syncScroll();
    updateHighlight();
  });
  setTimeout(() => {
    syncLineHeights();
    syncScroll();
    updateHighlight();
  }, 100);
};
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

textarea.addEventListener('scroll', syncScroll);

export const processFunc = () => {
  const val = u('.input').first().value;
  updateHighlight();
  if (!val) return;
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => {
    try {
      state.tjaParsed = parseTJA(val);
      if (!state.selectedDifficulty || !state.tjaParsed.courses[state.selectedDifficulty]) state.selectedDifficulty = Object.keys(state.tjaParsed.courses)[0];
      const parsedForPreview = parseTJAForPreview(val);
      state.currentChartData = parsedForPreview.courses[state.selectedDifficulty] || null;
      if (state.currentChartData) {
        state.tjaParsed.headers.offset = parsedForPreview.globalConfig.OFFSET;
        setChartTime(state.currentElapsedTime);
      }
      state.isChartCacheDirty = true;
      updateUI();
      u('.errors').text('✓ No error');
      u('.area-errors').addClass('is-success');
      if (state.errorLineNumber !== null) {
        state.errorLineNumber = null;
        updateHighlight();
      }
      localStorage.setItem('tja_tools_autosave', val);
    } catch (e) {
      u('.errors').text(e.message);
      u('.area-errors').removeClass('is-success');
      const match = e.message.match(/(?:行|line)\s*([0-9]+)/i);
      if (match) {
        state.errorLineNumber = parseInt(match[1], 10);
      } else {
        state.errorLineNumber = null;
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
          state.musicAudioBuffer = await state.audioContext.decodeAudioData(audioData);
          state.uploadedMusicFileName = audioFileInZip.name.split('/').pop();
          if (state.uploadedMusicObjectURL) URL.revokeObjectURL(state.uploadedMusicObjectURL);
          state.uploadedMusicObjectURL = URL.createObjectURL(new Blob([audioData]));
          u('#music-filename-display').text(`音源: ${state.uploadedMusicFileName}`);
          await saveData('files', {
            id: 'music',
            name: state.uploadedMusicFileName,
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
        state.musicAudioBuffer = await state.audioContext.decodeAudioData(ab.slice(0));
        state.uploadedMusicFileName = f.name;
        if (state.uploadedMusicObjectURL) URL.revokeObjectURL(state.uploadedMusicObjectURL);
        state.uploadedMusicObjectURL = URL.createObjectURL(f);
        u('#music-filename-display').text(`音源: ${state.uploadedMusicFileName}`);
        await saveData('files', {
          id: 'music',
          name: state.uploadedMusicFileName,
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
    state.isChartCacheDirty = true;
    processFunc();
  } catch (err) {
    u('.errors').text(err.message);
  }
  e.target.value = null;
});


u('#btn-toggle-image').on('click', () => {
  state.isChartImageVisible = !state.isChartImageVisible;
  localStorage.setItem('teika_chart_image_visible', state.isChartImageVisible);
  updateUI();
  requestAnimationFrame(() => {
    syncLineHeights();
    syncScroll();
    updateHighlight();
  });
});

u('#zoom-in').on('click', e => {
  e.preventDefault();
  state.zoomLevel += 20;
  updateUI();
});

u('#zoom-out').on('click', e => {
  e.preventDefault();
  state.zoomLevel = Math.max(100, state.zoomLevel - 20);
  updateUI();
});

u('#btn-save').on('click', () => {
  const cv = u('canvas').first();
  if (!cv) return;
  const link = document.createElement('a');
  link.download = (state.tjaParsed.headers.title || 'chart') + '.png';
  link.href = cv.toDataURL();
  link.click();
});

u('#btn-tja-save').on('click', () => {
  if (!state.tjaParsed) return;
  const codes = Encoding.convert(Encoding.stringToCode(u('.input').first().value), 'SJIS', 'UNICODE');
  const blob = new Blob([new Uint8Array(codes)], {
    type: 'application/octet-stream'
  });
  const name = (state.tjaParsed.headers.wave || "chart.tja").split('.')[0] + ".tja";
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
  state.selectedDifficulty = u(e.target).data('value');
  state.currentChartData = (parseTJAForPreview(textarea.value) || {courses:{}}).courses[state.selectedDifficulty];
  if (state.currentChartData) {
    seekChartState(0);
    setChartTime(0);
  }
  state.isChartCacheDirty = true;
  updateUI();
});

u('.controls-page .button[data-value]').on('click', e => {
  state.selectedPage = u(e.target).data('value');
  if (state.selectedPage === 'preview') {
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
  if (state.isPlaying) {
    const currentElapsedTimeTemp = state.currentElapsedTime;
    if (state.musicSourceNode) {
      state.musicSourceNode.playbackRate.value = newSpeed;
    }
    state.simulationStartOffset = currentElapsedTimeTemp;
    state.simulationStartTime = state.audioContext ? state.audioContext.currentTime : 0;
  }
  state.playbackSpeed = newSpeed;
});

u('#jiro-btn-play').on('click', togglePlay);

u('#jiro-btn-stop').on('click', resetSimulation);

u('#jiro-btn-prev').on('click', () => {
  if (!state.currentChartData) return;
  const curIndex = findMeasureIndex(state.currentElapsedTime);
  let targetIndex = curIndex;
  if (curIndex > 0 && Math.abs(state.currentElapsedTime - state.currentChartData.allMeasureTimes[curIndex]) < 0.5) {
    targetIndex = curIndex - 1;
  }
  const targetTime = state.currentChartData.allMeasureTimes[targetIndex];
  setChartTime(targetTime);
});

u('#jiro-btn-next').on('click', () => {
  if (!state.currentChartData) return;
  const curIndex = findMeasureIndex(state.currentElapsedTime);
  const totalMeasures = state.currentChartData.allMeasureTimes.length - 1;
  const targetIndex = Math.min(totalMeasures, curIndex + 1);
  const targetTime = state.currentChartData.allMeasureTimes[targetIndex];
  setChartTime(targetTime);
});

u('#jiro-vol-music').on('input', e => {
  state.musicVolume = parseFloat(e.target.value) / 100;
  if (state.musicGainNode) state.musicGainNode.gain.value = state.musicVolume;
});

u('#jiro-vol-se').on('input', e => {
  state.seVolume = parseFloat(e.target.value) / 100;
  if (state.seGainNode) state.seGainNode.gain.value = state.seVolume;
});

// ドラッグ中の経過時間を追従させつつプレビュー

// ドラッグ中の経過時間を追従させつつプレビュー
u('#jiro-seekbar').on('input', e => {
  if (!state.currentChartData) return;
  const totalDuration = state.musicAudioBuffer ? Math.max(state.currentChartData.endTime, state.musicAudioBuffer.duration) : state.currentChartData.endTime;
  const ratio = parseFloat(e.target.value) / 1000;
  const time = ratio * totalDuration;
  u('#jiro-time-display').text(`${time.toFixed(2)} / ${totalDuration.toFixed(2)}s`);
  state.currentElapsedTime = time;
  seekChartState(time);
  updateJiroPreview(time);
});

u('#jiro-seekbar').on('change', e => {
  if (!state.currentChartData) return;
  const totalDuration = state.musicAudioBuffer ? Math.max(state.currentChartData.endTime, state.musicAudioBuffer.duration) : state.currentChartData.endTime;
  const ratio = parseFloat(e.target.value) / 1000;
  const targetTime = ratio * totalDuration;
  let closestTime = 0;
  let minDiff = Infinity;
  state.currentChartData.allMeasureTimes.forEach(t => {
    const diff = Math.abs(t - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestTime = t;
    }
  });
  setChartTime(closestTime);
});

window.addEventListener('keydown', e => {
  if (state.selectedPage !== 'preview') return;
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) return;
  if (e.key === ' ') {
    e.preventDefault();
    if (e.repeat) return;
    togglePlay();
    return;
  }
  if (!state.isPlaying && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    if (!state.currentChartData || state.currentChartData.barlineTimes.length === 0) return;
    if (e.key === 'ArrowUp') setChartTime(state.currentChartData.barlineTimes[state.currentChartData.barlineTimes.length - 1]);else if (e.key === 'ArrowDown') setChartTime(state.currentChartData.barlineTimes[0]);
    return;
  }
  if (state.keyState[e.key]) {
    e.preventDefault();
    if (state.keyState[e.key].pressed) return;
    state.keyState[e.key].pressed = true;
    state.keyState[e.key].pressStartTime = performance.now();
    state.keyState[e.key].currentInterval = state.KEY_REPEAT_INTERVAL_BASE;
    seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1);
    state.keyState[e.key].timer = setTimeout(() => {
      if (state.keyState[e.key].timer) clearInterval(state.keyState[e.key].timer);
      state.keyState[e.key].timer = setInterval(() => {
        const elapsedTime = performance.now() - state.keyState[e.key].pressStartTime;
        const speedUpCount = Math.floor(elapsedTime / state.KEY_SPEED_UP_TIME);
        const newInterval = state.KEY_REPEAT_INTERVAL_BASE / Math.pow(2, speedUpCount);
        if (newInterval !== state.keyState[e.key].currentInterval) {
          clearInterval(state.keyState[e.key].timer);
          state.keyState[e.key].currentInterval = newInterval;
          state.keyState[e.key].timer = setInterval(() => seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1), state.keyState[e.key].currentInterval);
        }
        seekToMeasure(e.key === 'ArrowLeft' ? -1 : 1);
      }, state.keyState[e.key].currentInterval);
    }, state.KEY_REPEAT_DELAY);
  }
});

window.addEventListener('keyup', e => {
  if (state.keyState[e.key]) {
    e.preventDefault();
    state.keyState[e.key].pressed = false;
    if (state.keyState[e.key].timer) {
      clearInterval(state.keyState[e.key].timer);
      state.keyState[e.key].timer = null;
    }
  }
});

// 【要件4】画面・タブ切り替え（バックグラウンド移行＆復帰）時のラグキャリブレーション付き復帰イベントリスナー

// 【要件4】画面・タブ切り替え（バックグラウンド移行＆復帰）時のラグキャリブレーション付き復帰イベントリスナー
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    // バックグラウンド移行時：即座に一時停止し、オーディオスレッド・タイマースレッドを完全にクリーンアップして初期化
    if (state.isPlaying) {
      state.wasPlayingBeforeHidden = true;
      stopSimulation();
    } else {
      state.wasPlayingBeforeHidden = false;
    }
  } else {
    // フォアグラウンド復帰時：AudioContextを非同期で確実に復旧
    if (state.audioContext) {
      if (state.audioContext.state === 'suspended' || state.audioContext.state === 'interrupted') {
        try {
          await state.audioContext.resume();
        } catch (e) {
          console.warn("VisibilityChange: resume failed", e);
        }
      }
    }

    // 以前再生中だった場合、非同期のオーディオ準備を十分に待つため250msの安全ディレイを挟んで安定再開
    if (state.wasPlayingBeforeHidden) {
      state.wasPlayingBeforeHidden = false;
      setTimeout(async () => {
        // すでに別スレッドで走っていないことを確認した上で起動 (startSimulation内部で時刻基準をキャリブレーションしてラグを完全相殺)
        if (!state.isPlaying) {
          await startSimulation();
        }
      }, 250);
    } else {
      // 【ラグ相殺】非表示中の蓄積されたラグを完全にクリーンアップし、復帰直前の正確な時間で演奏位置をリセット・再描画
      seekChartState(state.currentElapsedTime);
      updateJiroPreview(state.currentElapsedTime);
    }
  }
});

window.addEventListener('focus', async () => {
  if (state.audioContext && state.audioContext.state === 'suspended') {
    try {
      await state.audioContext.resume();
    } catch (e) {}
  }
  updateJiroPreview(state.currentElapsedTime);
});

window.addEventListener('touchstart', async () => {
  if (state.audioContext && state.audioContext.state === 'suspended') {
    try {
      await state.audioContext.resume();
    } catch (e) {}
  }
}, {
  passive: true
});

window.addEventListener('DOMContentLoaded', async () => {
  state.jiroCanvas = document.getElementById('jiro-previewCanvas');
  if (state.jiroCanvas) {
    state.jiroCtx = state.jiroCanvas.getContext('2d');
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
      state.uploadedMusicObjectURL = URL.createObjectURL(musicFile.data);
      state.uploadedMusicFileName = musicFile.name;
      u('#music-filename-display').text(`音源: ${musicFile.name}`);
      initializeAudio();
      const arrayBuffer = await musicFile.data.arrayBuffer();
      state.musicAudioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
    }
  } catch (error) {
    console.error("Failed to load music from DB:", error);
  }
});

// --- PWA: Service Worker Registration & Install Handling ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((registration) => {
        console.log('[TEIKA PWA] Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[TEIKA PWA] Service Worker registration failed:', error);
      });
  });
}

// Check if running in standalone PWA mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

let deferredInstallPrompt = null;
const installBtn = document.getElementById('btn-pwa-install');
const iosGuide = document.getElementById('ios-install-guide');
const closeIosGuideBtn = document.getElementById('btn-close-ios-guide');

const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

if (!isStandalone) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) {
      installBtn.classList.remove('is-hidden');
    }
  });

  if (isIOS && installBtn) {
    installBtn.classList.remove('is-hidden');
  }
}

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[TEIKA PWA] User accepted install prompt');
        installBtn.classList.add('is-hidden');
      }
      deferredInstallPrompt = null;
    } else if (isIOS) {
      if (iosGuide) {
        iosGuide.classList.add('is-visible');
      }
    } else {
      alert('ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。');
    }
  });
}

if (closeIosGuideBtn && iosGuide) {
  closeIosGuideBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    iosGuide.classList.remove('is-visible');
  });
  iosGuide.addEventListener('click', (e) => {
    if (e.target === iosGuide) {
      iosGuide.classList.remove('is-visible');
    }
  });
}

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  if (installBtn) {
    installBtn.classList.add('is-hidden');
  }
  console.log('[TEIKA PWA] Application was installed successfully');
});updateUI();
