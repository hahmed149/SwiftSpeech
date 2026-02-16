const BAR_COUNT = 12;
const UPDATE_MS = 50; // ~20fps, reliable even when window is unfocused
let timerId: ReturnType<typeof setInterval> | null = null;

export function startWaveform(iconEl: HTMLDivElement, analyser: AnalyserNode): void {
  stopWaveform(iconEl);
  iconEl.className = "waveform";

  const bars: HTMLSpanElement[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement("span");
    bar.className = "bar";
    iconEl.appendChild(bar);
    bars.push(bar);
  }

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const binCount = analyser.frequencyBinCount;

  const maxBin = Math.min(binCount, 80);
  const binsPerBar = maxBin / BAR_COUNT;

  // Use setInterval instead of requestAnimationFrame — rAF stops when window loses focus
  timerId = setInterval(() => {
    analyser.getByteFrequencyData(dataArray);

    for (let i = 0; i < BAR_COUNT; i++) {
      const start = Math.floor(i * binsPerBar);
      const end = Math.floor((i + 1) * binsPerBar);
      let sum = 0;
      for (let j = start; j < end && j < binCount; j++) {
        sum += dataArray[j];
      }
      const avg = sum / Math.max(1, end - start);
      const h = Math.max(2, (avg / 255) * 10);
      bars[i].style.height = `${h}px`;
    }
  }, UPDATE_MS);
}

export function stopWaveform(iconEl: HTMLDivElement): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  iconEl.innerHTML = "";
  iconEl.className = "";
}
