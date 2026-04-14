// Fixed Hanning window function
function applyHanningWindow(frame) {
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)));
    windowed[i] = frame[i] * windowValue;
  }
  return windowed;
}
