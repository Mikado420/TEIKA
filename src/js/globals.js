/** UI Logic **/
let tjaParsed = null,
  selectedDifficulty = '',
  selectedPage = 'editor',
  zoomLevel = 100;

/** 次郎風プレビュー用 **/

/** 次郎風プレビュー用 **/
let audioContext = null;

let musicAudioBuffer = null;

let musicSourceNode = null;

let seGainNode = null;

let musicGainNode = null;

const audioBuffers = {};

let isPlaying = false;

let wasPlayingBeforeHidden = false;

let currentElapsedTime = 0.0;

let simulationStartOffset = 0.0;

let simulationStartTime = 0.0;

let lastFrameTime = 0; // 【要件1: 修正】描画ループのFPSリミッター判定用

// 【要件1: 修正】描画ループのFPSリミッター判定用
let lastLogicTime = 0; // 【要件1: 修正】updateLogicの経過時間（フォールバック用）計測専用

// 【要件1: 修正】updateLogicの経過時間（フォールバック用）計測専用
let animationFrameId = null;

let logicIntervalId = null;

const isAutoPlay = true;

let currentCombo = 0;

let currentMeasureIndex = 0;

let currentChartData = null;

let autoRollSpeed = 30.0;

let renderFPS = 60;

let scrollMultiplier = 1.0;

let seVolume = 0.8;

let musicVolume = 0.8;

let playbackSpeed = 1.0;

let lastAutoEffectTime = 0;

let stopAtTime = null;

let chartCoolDownUntil = null;

let lastGogoStartTime = -Infinity; // ゴーゴー突入時のトリガーアニメーション基準時間

// ゴーゴー突入時のトリガーアニメーション基準時間
const coolDownTime = 1.0;

let playerKeys = {
  donL: ['F'],
  donR: ['J'],
  kaL: ['D'],
  kaR: ['K']
};

let lastSEPlayTime = {
  don: 0,
  ka: 0,
  balloon: 0
};

let hitEffectTimeout = {
  donLeft: null,
  donRight: null,
  kaLeft: null,
  kaRight: null
};

// 【要件1】判定円座標は175固定

// 【要件1】判定円座標は175固定
const HIT_POSITION_X_DEFAULT = 175;

const HIT_POSITION_X = 175;

const BASE_SCROLL_FACTOR = 2.0;

const JPOS_INPUT_STANDARD_WIDTH = 946;

const JPOS_ACTUAL_MEASURE_WIDTH = 480;

const NOTE_COLORS = {
  '1': '#F44336',
  '2': '#2196F3',
  '3': '#F44336',
  '4': '#2196F3',
  '5': '#FFC107',
  '6': '#FFC107',
  '7': '#f97902'
};

const NOTE_SIZE = {
  '1': 15,
  '2': 15,
  '3': 22.5,
  '4': 22.5,
  '5': 15,
  '6': 22.5,
  '7': 22.5
};

const JUDGE_PERFECT = 0.025,
  JUDGE_GOOD = 0.075,
  JUDGE_BAD = 0.107;

let state_commandIndex = 0;

let state_currentBPM = 120;

let state_isGogo = false;

let state_jposStartTime = -Infinity;

let state_jposDuration = 0;

let state_jposStartX = HIT_POSITION_X_DEFAULT;

let state_jposEndX = HIT_POSITION_X_DEFAULT;

let state_jposEasing = 0;

const taikoEffects = {
  donL: {
    active: false,
    startTime: 0
  },
  donR: {
    active: false,
    startTime: 0
  },
  kaL: {
    active: false,
    startTime: 0
  },
  kaR: {
    active: false,
    startTime: 0
  }
};

const EFFECT_DURATION = 0.15;

let autoLastSide = 'L';

const positionPriority = {
  kaR: 4,
  donR: 3,
  donL: 2,
  kaL: 1
};

let jiroCanvas = null;

let jiroCtx = null;

let cachedChartCanvas = null;

let isChartCacheDirty = true;

let comboBounceScale = 1.0;

let uploadedMusicFileName = "";

let uploadedMusicObjectURL = null;

// IndexedDB 設定

// IndexedDB 設定
let db = null;

function initDB() {
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
      db = event.target.result;
      resolve(db);
    };
    request.onerror = event => {
      console.error('IndexedDB error:', event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

function saveData(storeName, data) {
  if (!db) return Promise.reject("DB not initialized");
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = event => reject(event.target.error);
  });
}

function loadData(storeName, id) {
  if (!db) return Promise.reject("DB not initialized");
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = event => reject(event.target.error);
  });
}

/** エディタ文字色分け用のハイライトヘルパー (要件3仕様維持) **/
let errorLineNumber = null;

const textarea = u('.input').first();

const backdrop = u('.backdrop').first();

const highlightDiv = u('.highlight').first();

let syncHeightTimeout = null;

let pendingHighlightUpdate = false;

let debounceTimer = null;

let lastUIUpdateTime = 0;

const keyState = {
  ArrowLeft: {
    pressed: false,
    timer: null,
    pressStartTime: 0,
    currentInterval: 100
  },
  ArrowRight: {
    pressed: false,
    timer: null,
    pressStartTime: 0,
    currentInterval: 100
  }
};

const KEY_REPEAT_DELAY = 250,
  KEY_REPEAT_INTERVAL_BASE = 100,
  KEY_SPEED_UP_TIME = 2000;