export function scanTJAInfo(tja) {
  const lines = tja.split(/\r?\n/);
  let charCount = tja.length;
  let lineCount = lines.length;
  let measureCount = 0;
  let notesCount = 0;
  
  let currentBpm = 120;
  let currentMeasure = [4, 4];
  let duration = 0; // seconds
  let hasValidDuration = true;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].split('//')[0].trim();
    if (!raw) continue;
    
    if (raw.startsWith('BPM:')) {
      const val = parseFloat(raw.substring(4));
      if (!isNaN(val) && val > 0) currentBpm = val;
    } else if (raw.startsWith('#BPMCHANGE')) {
      const val = parseFloat(raw.substring(10).trim());
      if (!isNaN(val) && val > 0) currentBpm = val;
    } else if (raw.startsWith('#MEASURE')) {
      const m = raw.substring(8).trim().split('/');
      if (m.length === 2) {
        const num = parseFloat(m[0]);
        const den = parseFloat(m[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0 && num >= 0) {
          currentMeasure = [num, den];
        } else {
          hasValidDuration = false;
        }
      }
    } else if (raw === ',') {
      // End of measure
      measureCount++;
      // Duration of this measure in seconds = (beats / currentBpm) * 60
      // Beats in this measure = (currentMeasure[0] / currentMeasure[1]) * 4
      const beats = (currentMeasure[0] / currentMeasure[1]) * 4;
      if (!isNaN(beats) && isFinite(beats) && beats >= 0 && currentBpm > 0) {
        duration += (beats / currentBpm) * 60;
      } else {
        hasValidDuration = false;
      }
    } else if (raw.match(/^[0-9A-G,]+$/)) {
      for (let char of raw) {
        if (char === ',') {
          measureCount++;
          const beats = (currentMeasure[0] / currentMeasure[1]) * 4;
          if (!isNaN(beats) && isFinite(beats) && beats >= 0 && currentBpm > 0) {
            duration += (beats / currentBpm) * 60;
          } else {
            hasValidDuration = false;
          }
        } else if (['1', '2', '3', '4', 'A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(char)) {
           // Not all are strictly notes (some are rolls/balloons/ends), but '1','2','3','4' are dons/kas
           // For simple notes count we can just count 1,2,3,4.
           if (['1', '2', '3', '4'].includes(char)) {
             notesCount++;
           }
        }
      }
    }
  }

  return {
    charCount,
    lineCount,
    measureCount,
    notesCount,
    duration: hasValidDuration ? duration : null
  };
}
