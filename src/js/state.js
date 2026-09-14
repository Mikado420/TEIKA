export const state = {
  tjaParsed: null,
  selectedDifficulty: '',
  selectedPage: 'editor',
  zoomLevel: 100,
  isChartImageVisible: localStorage.getItem("teika_chart_image_visible") !== "false",
  audioContext: null,
  musicAudioBuffer: null,
  musicSourceNode: null,
  seGainNode: null,
  musicGainNode: null,
  audioBuffers: {},
  isPlaying: false,
  wasPlayingBeforeHidden: false,
  currentElapsedTime: 0,
  simulationStartOffset: 0,
  simulationStartTime: 0,
  lastFrameTime: 0,
  lastLogicTime: 0,
  animationFrameId: null,
  logicIntervalId: null,
  isAutoPlay: true,
  currentCombo: 0,
  currentMeasureIndex: 0,
  currentChartData: null,
  autoRollSpeed: 30.0,
  renderFPS: 60,
  scrollMultiplier: 1.0,
  seVolume: 0.8,
  musicVolume: 0.8,
  playbackSpeed: 1.0,
  lastAutoEffectTime: null,
  stopAtTime: null,
  chartCoolDownUntil: null,
  lastGogoStartTime: -Infinity,
  coolDownTime: 1.0,
  playerKeys: { donL: ['F'], donR: ['J'], kaL: ['D'], kaR: ['K'] },
  lastSEPlayTime: { don: 0, ka: 0, balloon: 0 },
  hitEffectTimeout: { donLeft: null, donRight: null, kaLeft: null, kaRight: null },
  state_commandIndex: 0,
  state_currentBPM: 120,
  state_isGogo: false,
  state_jposStartTime: -Infinity,
  state_jposDuration: 0,
  state_jposStartX: 175,
  state_jposEndX: 175,
  state_jposEasing: 0,
  taikoEffects: { donL: { active: false, startTime: 0 }, donR: { active: false, startTime: 0 }, kaL: { active: false, startTime: 0 }, kaR: { active: false, startTime: 0 } },
  EFFECT_DURATION: 0.15,
  autoLastSide: 'L',
  positionPriority: { kaR: 4, donR: 3, donL: 2, kaL: 1 },
  jiroCanvas: null,
  jiroCtx: null,
  cachedChartCanvas: null,
  isChartCacheDirty: false,
  comboBounceScale: 1.0,
  uploadedMusicFileName: "",
  uploadedMusicObjectURL: null,
  db: null,
  errorLineNumber: null,
  syncHeightTimeout: null,
  pendingHighlightUpdate: false,
  debounceTimer: null,
  lastUIUpdateTime: 0,
  keyState: { ArrowLeft: { pressed: false, timer: null, pressStartTime: 0, currentInterval: 100 }, ArrowRight: { pressed: false, timer: null, pressStartTime: 0, currentInterval: 100 } },
  KEY_REPEAT_DELAY: 250,
  KEY_REPEAT_INTERVAL_BASE: 100,
  KEY_SPEED_UP_TIME: 2000,
};

export const BASE_SCROLL_FACTOR = 2.0;
export const JPOS_INPUT_STANDARD_WIDTH = 946;
export const JPOS_ACTUAL_MEASURE_WIDTH = 480;
export const NOTE_COLORS = { '1': '#F44336', '2': '#2196F3', '3': '#F44336', '4': '#2196F3', '5': '#FFC107', '6': '#FFC107', '7': '#f97902' };
export const NOTE_SIZE = { '1': 15, '2': 15, '3': 22.5, '4': 22.5, '5': 15, '6': 22.5, '7': 22.5 };
export const JUDGE_PERFECT = 0.025;
export const JUDGE_GOOD = 0.075;
export const JUDGE_BAD = 0.107;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TJAEditorDB', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', {
          keyPath: 'id'
        });
      }
    };
    request.onsuccess = event => {
      state.db = event.target.result;
      resolve(state.db);
    };
    request.onerror = event => {
      console.error('IndexedDB error:', event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}
export function saveData(storeName, data) {
  if (!state.db) return Promise.reject("DB not initialized");
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = event => reject(event.target.error);
  });
}
export function loadData(storeName, id) {
  if (!state.db) return Promise.reject("DB not initialized");
  return new Promise((resolve, reject) => {
    const transaction = state.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject(event.target.error);
  });
}
export const HIT_POSITION_X_DEFAULT = 175;
export const HIT_POSITION_X = 175;
