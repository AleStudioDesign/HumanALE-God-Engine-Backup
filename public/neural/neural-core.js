(function exposeNeuralCore(global) {
  // A deterministic, connected 3D graph. This is an artistic data visualization,
  // not an anatomical scan or a connection to a real dataset.
  function create() {
    const nodes = [], links = [], paths = [], seen = new Set();
    const connect = (a, b) => {
      const key = [a, b].sort((x, y) => x - y).join(':');
      if (a !== b && !seen.has(key)) { links.push({ a, b }); seen.add(key); }
    };
    for (const side of [-1, 1]) {
      for (let i = 0; i < 144; i++) {
        const v = 1 - 2 * (i + 0.5) / 144, r = Math.sqrt(1 - v * v);
        const angle = i * 2.3999632297, layer = i % 4 === 0 ? 0.62 : 1;
        nodes.push({ x: side * 0.145 + Math.cos(angle) * r * 0.167 * layer,
          y: -0.30 + v * 0.205 * layer, z: 0.135 + Math.sin(angle) * r * 0.153 * layer,
          region: 'brain', digit: i % 2 });
      }
    }
    const brainCount = nodes.length;
    for (let i = 0; i < brainCount; i++) {
      const p = nodes[i];
      const nearest = nodes.slice(0, brainCount).map((q, j) => ({ j, d: Math.hypot(p.x-q.x, p.y-q.y, p.z-q.z) }))
        .filter(q => q.j !== i).sort((a, b) => a.d - b.d).slice(0, 3);
      for (const q of nearest) connect(i, q.j);
    }
    // A spanning tree guarantees every node participates in the same network.
    for (let i = 1; i < brainCount; i++) {
      let nearest = 0, distance = Infinity;
      for (let j = 0; j < i; j++) {
        const p = nodes[i], q = nodes[j], d = Math.hypot(p.x-q.x, p.y-q.y, p.z-q.z);
        if (d < distance) { nearest = j; distance = d; }
      }
      connect(i, nearest);
    }
    for (let lane = 0; lane < 9; lane++) {
      const ids = [];
      const target = nodes[(lane * 31 + 19) % brainCount];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, spread = (lane - 4) * 0.028;
        const x = spread * (1 - t) + target.x * t * t + Math.sin(t * Math.PI * 2 + lane) * 0.012 * Math.sin(t * Math.PI);
        const id = nodes.push({ x, y: 0.75 * (1 - t) + target.y * t,
          z: 0.07 * (1 - t) + target.z * t, region: 'stem', digit: (i + lane) % 2 }) - 1;
        ids.push(id);
        if (i) connect(ids[i - 1], id);
      }
      connect(ids.at(-1), (lane * 31 + 19) % brainCount);
      paths.push(ids);
    }
    return { nodes, links, paths, brainCount };
  }
  global.NeuralCore = { create };
})(typeof window === 'undefined' ? globalThis : window);
