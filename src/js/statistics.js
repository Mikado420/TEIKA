import { CHART_PADDING_TOP, CHART_PADDING_BOTTOM, CHART_BG, ROW_MARGIN_BOTTOM, ROW_HEIGHT_INFO, ROW_HEIGHT_NOTE, ROW_HEIGHT, ROW_OFFSET_NOTE_CENTER, ROW_LEADING, ROW_TRAILING, BEAT_WIDTH, NOTE_RADIUS, formatBpm, getNoteX, getRowY } from './utils.js';

const drawLine = (ctx, sx, sy, ex, ey, w, s) => {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = w;
  ctx.strokeStyle = s;
  ctx.stroke();
};

const drawRect = (ctx, x, y, w, h, f) => {
  ctx.fillStyle = f;
  ctx.fillRect(x, y, w, h);
};

const drawCircle = (ctx, x, y, r, f) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = f;
  ctx.fill();
};

const drawText = (ctx, x, y, t, f, c, b = 'middle', a = 'center') => {
  ctx.font = f;
  ctx.textBaseline = b;
  ctx.textAlign = a;
  ctx.fillStyle = c;
  ctx.fillText(t, x, y);
};

const drawPixelText = (ctx, x, y, t, c, b = 'middle', a = 'center') => {
  drawText(ctx, x, y, t, '7px "Pixel 3x5"', c, b, a);
};

// エディタレーン表示用の描画調整

// エディタレーン表示用の描画調整
function drawNote(ctx, x, y, c, b) {
  const r = b ? NOTE_RADIUS + 3 : NOTE_RADIUS;
  drawCircle(ctx, x, y, r, '#000');
  drawCircle(ctx, x, y, r - 1, '#fff');
  drawCircle(ctx, x, y, r - 2.6, c);
}

function drawBalloon(ctx, ri, nb, eb, count) {
  const x = Math.round(getNoteX(nb));
  const y = Math.round(getRowY(ri) + ROW_OFFSET_NOTE_CENTER);
  const ex = Math.round(getNoteX(eb));
  const size = NOTE_RADIUS;
  const color = '#f97902';
  const strokeColor = '#000000';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = size * 2;
  drawLine(ctx, x, y, ex, y, ctx.lineWidth, strokeColor);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth -= 2;
  drawLine(ctx, x, y, ex, y, ctx.lineWidth, '#fff');
  ctx.strokeStyle = color;
  ctx.lineWidth -= 2;
  drawLine(ctx, x, y, ex, y, ctx.lineWidth, color);
  ctx.lineCap = 'butt';

  // 始点ノーツ
  drawCircle(ctx, x, y, size, strokeColor);
  drawCircle(ctx, x, y, size - 1, '#fff');
  drawCircle(ctx, x, y, size - 2.6, color);

  // 打数テキスト
  drawPixelText(ctx, x, y + 0.5, count.toString(), '#fff');
  ctx.restore();
}

function renderPath(ctx, rs, sR, sB, eR, eB) {
  ctx.beginPath();
  let sx = getNoteX(sB),
    sy = getRowY(sR) + ROW_OFFSET_NOTE_CENTER,
    ex = getNoteX(eB),
    ey = getRowY(eR) + ROW_OFFSET_NOTE_CENTER;
  if (sR === eR) {
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
  } else {
    ctx.moveTo(sx, sy);
    ctx.lineTo(getNoteX(16) + ROW_TRAILING, sy);
    for (let r = sR + 1; r < eR; r++) {
      ctx.moveTo(0, getRowY(r) + ROW_OFFSET_NOTE_CENTER);
      ctx.lineTo(getNoteX(16) + ROW_TRAILING, getRowY(r) + ROW_OFFSET_NOTE_CENTER);
    }
    ctx.moveTo(0, ey);
    ctx.lineTo(ex, ey);
  }
  ctx.stroke();
}

export function drawChart(chart, courseId) {
  const course = chart.courses[courseId];
  if (!course) return document.createElement('canvas');
  const dNames = ['かんたん', 'ふつう', 'むずかしい', 'おに', '裏おに'];
  const rows = [];
  let rTemp = [],
    rBeat = 0;
  course.measures.forEach(m => {
    const mb = m.length[0] / m.length[1] * 4;
    if (16 < rBeat + mb) {
      rows.push({
        beats: rBeat,
        measures: rTemp
      });
      rTemp = [];
      rBeat = 0;
    }
    rTemp.push(m);
    rBeat += mb;
  });
  if (rTemp.length) rows.push({
    beats: rBeat,
    measures: rTemp
  });
  const cW = ROW_LEADING + BEAT_WIDTH * 16 + ROW_TRAILING;
  const cH = CHART_PADDING_TOP + (ROW_HEIGHT + ROW_MARGIN_BOTTOM) * rows.length + CHART_PADDING_BOTTOM;
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = cW * dpr;
  canvas.height = cH * dpr;
  canvas.style.width = cW + 'px';
  canvas.style.height = cH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(dpr, dpr);
  drawRect(ctx, 0, 0, cW, cH, CHART_BG);
  drawText(ctx, 20, 20, chart.headers.title, 'bold 28px sans-serif', '#000', 'top', 'left');
  if (chart.headers.subtitle) drawText(ctx, 20, 52, chart.headers.subtitle, 'bold 18px sans-serif', '#000', 'top', 'left');
  drawText(ctx, 20, 84, `${dNames[course.course]} ${'★'.repeat(course.headers.level)}`, 'bold 16px sans-serif', '#000', 'top', 'left');
  let gActive = false,
    gStart = null;
  rows.forEach((row, ri) => {
    let bAcc = 0;
    row.measures.forEach(m => {
      const mb = m.length[0] / m.length[1] * 4;
      m.events.forEach(e => {
        const eb = bAcc + mb / (m.data.length || 1) * e.pos;
        if (e.name === 'gogostart') {
          gActive = true;
          gStart = [ri, eb, false];
        }
        if (e.name === 'gogoend' && gActive && gStart) {
          const hG = ROW_HEIGHT;
          const isInherited = gStart[2];
          const startX = isInherited ? 0 : getNoteX(gStart[1]);
          drawRect(ctx, startX, getRowY(ri), getNoteX(eb) - startX, hG, '#fbb');
          gStart = null;
          gActive = false;
        }
      });
      bAcc += mb;
    });
    if (gActive && gStart) {
      const hG = ROW_HEIGHT;
      const isInherited = gStart[2];
      const startX = isInherited ? 0 : getNoteX(gStart[1]);
      drawRect(ctx, startX, getRowY(ri), cW - startX, hG, '#fbb');
      gStart = [ri + 1, 0, true];
    }
  });
  rows.forEach((row, ri) => {
    const y = getRowY(ri);
    drawRect(ctx, 0, y + ROW_HEIGHT_INFO, cW, ROW_HEIGHT_NOTE, '#000');
    drawRect(ctx, 0, y + ROW_HEIGHT_INFO + 2, cW, ROW_HEIGHT_NOTE - 4, '#fff');
    drawRect(ctx, 0, y + ROW_HEIGHT_INFO + 4, cW, ROW_HEIGHT_NOTE - 8, '#999');
    let bAcc = 0;
    row.measures.forEach((m, mi) => {
      const mb = m.length[0] / m.length[1] * 4;
      for (let g = 0; g < mb; g += 0.5) {
        const gx = getNoteX(bAcc + g);
        drawLine(ctx, gx, y + ROW_HEIGHT_INFO, gx, y + ROW_HEIGHT, g % 1 === 0 ? 0.8 : 0.4, '#ffffff66');
      }
      drawLine(ctx, getNoteX(bAcc), y, getNoteX(bAcc), y + ROW_HEIGHT, 1.2, '#fff');
      drawPixelText(ctx, getNoteX(bAcc) + 2, y + 17, (mi + 1 + rows.slice(0, ri).reduce((a, b) => a + b.measures.length, 0)).toString(), '#000', 'bottom', 'left');
      if (ri === 0 && mi === 0) drawPixelText(ctx, getNoteX(bAcc) + 2, y + 11, formatBpm(chart.headers.bpm).toString(), '#00f', 'bottom', 'left');
      m.events.forEach(e => {
        if (e.name === 'bpmchange' || e.name === 'scroll') {
          const ex = getNoteX(bAcc + mb / (m.data.length || 1) * e.pos);
          drawLine(ctx, ex, y, ex, y + ROW_HEIGHT, 1, '#444');
          const isBPM = e.name === 'bpmchange';
          drawPixelText(ctx, ex + 2, isBPM ? y + 11 : y + 5, e.value.toString(), isBPM ? '#00f' : '#f00', 'bottom', 'left');
        }
      });
      bAcc += mb;
    });
    drawLine(ctx, getNoteX(bAcc), y, getNoteX(bAcc), y + ROW_HEIGHT, 1.5, '#fff');
  });
  let lEnd = null;
  let totalBalloons = 0;
  rows.forEach(row => {
    row.measures.forEach(m => {
      for (let i = 0; i < m.data.length; i++) {
        if (m.data[i] === '7') totalBalloons++;
      }
    });
  });
  let bIdx = totalBalloons - 1;
  for (let ri = rows.length - 1; ri >= 0; ri--) {
    const row = rows[ri];
    let ab = 0;
    row.measures.forEach(m => {
      m.absB = ab;
      ab += m.length[0] / m.length[1] * 4;
    });
    for (let mi = row.measures.length - 1; mi >= 0; mi--) {
      const m = row.measures[mi];
      const mb = m.length[0] / m.length[1] * 4;
      for (let i = m.data.length - 1; i >= 0; i--) {
        const note = m.data[i],
          nb = m.absB + mb / m.data.length * i;
        const nx = getNoteX(nb),
          ny = getRowY(ri) + ROW_OFFSET_NOTE_CENTER;
        if (note === '8') lEnd = [ri, nb];else if (note === '1') drawNote(ctx, nx, ny, '#f44336', false);else if (note === '2') drawNote(ctx, nx, ny, '#2196f3', false);else if (note === '3') drawNote(ctx, nx, ny, '#f44336', true);else if (note === '4') drawNote(ctx, nx, ny, '#2196f3', true);else if (note === '7' && lEnd) {
          drawBalloon(ctx, ri, nb, lEnd[1], course.headers.balloon[bIdx--] || 5);
          lEnd = null;
        } else if ((note === '5' || note === '6') && lEnd) {
          const isBig = note === '6';
          const size = isBig ? NOTE_RADIUS + 3 : NOTE_RADIUS;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = size * 2;
          renderPath(ctx, rows, ri, nb, lEnd[0], lEnd[1]);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth -= 2;
          renderPath(ctx, rows, ri, nb, lEnd[0], lEnd[1]);
          ctx.strokeStyle = '#ffc107';
          ctx.lineWidth -= 2;
          renderPath(ctx, rows, ri, nb, lEnd[0], lEnd[1]);
          ctx.lineCap = 'butt';
          drawCircle(ctx, nx, ny, size, '#000');
          drawCircle(ctx, nx, ny, size - 1, '#fff');
          drawCircle(ctx, nx, ny, size - 2.6, '#ffc107');
          lEnd = null;
        }
      }
    }
  }
  return canvas;
}

/** 統計ロジック **/

/** 統計ロジック **/
export function getStats(chart, courseId) {
  const course = chart.courses[courseId];
  let combo = 0,
    firstT = null,
    lastT = 0,
    currentBpm = chart.headers.bpm;
  let bpmMap = new Map();
  let bpms = [currentBpm],
    allNoteTimes = [],
    rendaSecs = [],
    rStartT = null;
  let currentTime = 0;
  course.measures.forEach(m => {
    const mb = m.length[0] / m.length[1] * 4;
    const nis = m.data.length || 1;
    const duration = 60 / currentBpm * mb;
    for (let i = 0; i < m.data.length; i++) {
      const char = m.data[i];
      const t = currentTime + duration * i / nis;
      if ("13".includes(char)) {
        allNoteTimes.push({
          time: t,
          type: 'don'
        });
        combo++;
        if (firstT === null) firstT = t;
        lastT = t;
      } else if ("24".includes(char)) {
        allNoteTimes.push({
          time: t,
          type: 'ka'
        });
        combo++;
        if (firstT === null) firstT = t;
        lastT = t;
      } else if (char === "5" || char === "6") rStartT = t;else if (char === "8" && rStartT !== null) {
        rendaSecs.push(t - rStartT);
        rStartT = null;
      }
    }
    bpmMap.set(currentBpm, (bpmMap.get(currentBpm) || 0) + duration);
    m.events.forEach(e => {
      if (e.name === 'bpmchange') {
        currentBpm = parseFloat(e.value);
        bpms.push(currentBpm);
      }
    });
    currentTime += duration;
  });
  const perfTime = lastT - firstT;
  let measureData = [];
  for (let i = 0; i < 100; i++) {
    const start = firstT + i * (perfTime / 100);
    const end = start + perfTime / 100;
    const notesInWindow = allNoteTimes.filter(n => n.time >= start && n.time < end);
    measureData.push({
      don: notesInWindow.filter(n => n.type === 'don').length,
      ka: notesInWindow.filter(n => n.type === 'ka').length,
      nps: notesInWindow.length / (perfTime / 100 || 1)
    });
  }
  const mainBpm = bpmMap.size ? [...bpmMap.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0] : currentBpm;
  return {
    combo,
    perfTime,
    minBpm: Math.min(...bpms),
    maxBpm: Math.max(...bpms),
    mainBpm,
    density: (combo - 1) / (perfTime || 1),
    measures: measureData,
    rendas: rendaSecs
  };
}

export function drawDensityGraph(measureData) {
  const container = u('#density-svg-wrapper').first();
  const width = container.clientWidth;
  const height = 100;
  const margin = {
    left: 25,
    right: 5,
    top: 10,
    bottom: 5
  };
  const svg = d3.select("#density-svg").attr("width", width).attr("height", height + 25).html("");
  const x = d3.scaleBand().domain(d3.range(measureData.length)).range([margin.left, width - margin.right]).padding(0.1);
  const y = d3.scaleLinear().domain([0, d3.max(measureData, d => d.nps) * 1.1 || 10]).range([height, margin.top]);
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right)).attr("color", "#444");
  const layers = d3.stack().keys(["don", "ka"])(measureData.map(d => {
    const total = d.don + d.ka || 1;
    return {
      don: d.don / total * d.nps,
      ka: d.ka / total * d.nps
    };
  }));
  svg.append("g").selectAll("g").data(layers).enter().append("g").attr("fill", (d, i) => i === 0 ? "#f33" : "#5cf").selectAll("rect").data(d => d).enter().append("rect").attr("x", (d, i) => x(i)).attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1])).attr("width", x.bandwidth());
}

/** グラデーション置換ロジック **/