(function exposeFaceRig(global) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const bump = (x, y, cx, cy, rx, ry) => Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) * 1.8);
  const EYE_X = 0.205, EYE_Y = -0.067, MOUTH_Y = 0.285;
  const EYE_HALF = 0.087, EYE_UPPER = 0.024, EYE_LOWER = 0.018;

  function mouthWeights(x, y) {
    const t = clamp(x / 0.183, -1, 1), arch = 1 - t * t;
    const seam = MOUTH_Y + arch * 0.003 + Math.exp(-((t / 0.23) ** 2)) * 0.002;
    const upper = bump(x,y,0,seam-0.015,0.184,0.019);
    const lower = bump(x,y,0,seam+0.017,0.176,0.022);
    return { upper, lower, seam, influence: bump(x,y,0,MOUTH_Y,0.25,0.105) };
  }
  function referenceWarp(x,y) {
    for (const side of [-1,1]) {
      const cx = side * EYE_X, dx = x - cx, dy = y - EYE_Y;
      const weight = 1 - smooth(0.4, 1.5, (dx/0.17)**2 + (dy/0.115)**2);
      if (weight > 0) return { x: cx + dx*(1-weight*0.21), y:EYE_Y+dy*(1-weight*0.16) };
    }
    return {x,y};
  }

  // All anatomy shares the same surface. Luminance never changes depth.
  function depthAt(x, y) {
    const jaw = 1 - smooth(0.12, 0.56, y) * 0.23;
    const ellipse = (x / (0.405 * jaw)) ** 2 + ((y + 0.095) / 0.63) ** 2;
    const cranium = 0.07 + Math.sqrt(Math.max(0, 1 - ellipse)) * 0.38;
    const forehead = bump(x, y, 0, -0.35, 0.34, 0.3) * 0.047;
    const nose = bump(x, y, 0, 0.07, 0.054, 0.185) * 0.155 + bump(x, y, 0, 0.135, 0.083, 0.052) * 0.135;
    const sockets = (bump(x, y, -EYE_X, EYE_Y, 0.118, 0.077) + bump(x, y, EYE_X, EYE_Y, 0.118, 0.077)) * 0.132;
    const cheeks = (bump(x, y, -0.23, 0.09, 0.155, 0.155) + bump(x, y, 0.23, 0.09, 0.155, 0.155)) * 0.10;
    const chin = bump(x, y, 0, 0.432, 0.16, 0.12) * 0.12;
    const muzzle = bump(x, y, 0, MOUTH_Y, 0.205, 0.12) * 0.072;
    const underLip = bump(x, y, 0, 0.365, 0.14, 0.035) * 0.042;
    const lips = mouthWeights(x,y);
    const lipVolume = lips.upper * 0.008 + lips.lower * 0.011;
    const seam = bump(x,y,0,lips.seam,0.156,0.0038) * 0.012;
    const head = cranium + forehead + nose + cheeks + chin + muzzle + lipVolume - seam - sockets - underLip;
    const neck = 0.04 + Math.sqrt(Math.max(0, 1 - (x / 0.24) ** 2)) * 0.125;
    const neckBlend = smooth(0.48, 0.69, y);
    return head * (1 - neckBlend) + neck * neckBlend;
  }

  function normalAt(x, y) {
    const e = 0.004;
    const nx = -(depthAt(x + e, y) - depthAt(x - e, y)) / (2 * e);
    const ny = -(depthAt(x, y + e) - depthAt(x, y - e)) / (2 * e);
    const length = Math.hypot(nx, ny, 1);
    return { x: nx / length, y: ny / length, z: 1 / length };
  }

  // Exact critically damped spring; stable across frame rates and long frames.
  function spring(value, velocity, target, frequency, dt) {
    const delta = value - target;
    const term = velocity + frequency * delta;
    const decay = Math.exp(-frequency * dt);
    return { value: target + (delta + term * dt) * decay, velocity: (velocity - frequency * term * dt) * decay };
  }

  function deform(x, y, z, pose, neck, breath = 0) {
    const weight = 1 - smooth(0.43, 0.78, y);
    // Shorten the upper cranium while leaving the neck attachment in place.
    x *= 1 + 0.045 * weight;
    if (y < -0.12) y = -0.12 + (y + 0.12) * 0.79;
    const yaw = neck.yaw + (pose.yaw - neck.yaw) * weight;
    const pitch = neck.pitch + (pose.pitch - neck.pitch) * weight;
    const roll = pose.roll * weight;
    const pivotY = 0.43, pivotZ = 0.16;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rx = x * cy + (z - pivotZ) * sy;
    const rz = -x * sy + (z - pivotZ) * cy;
    const ry = (y - pivotY) * cp - rz * sp;
    const finalZ = (y - pivotY) * sp + rz * cp + pivotZ;
    return {
      x: rx * Math.cos(roll) - ry * Math.sin(roll),
      y: rx * Math.sin(roll) + ry * Math.cos(roll) + pivotY + breath * (0.25 + weight * 0.75),
      z: finalZ
    };
  }
  global.FaceRig = { EYE_X, EYE_Y, EYE_HALF, EYE_UPPER, EYE_LOWER, MOUTH_Y, clamp, smooth, bump, mouthWeights, referenceWarp, depthAt, normalAt, spring, deform };
})(typeof window === 'undefined' ? globalThis : window);
