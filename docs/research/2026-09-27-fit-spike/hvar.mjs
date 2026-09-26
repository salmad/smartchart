/* Fractional advances for a variable-font instance: hmtx + HVAR deltas, not rounded.
   harfbuzzjs 1.6.2 rounds varied advances to whole font units; Chrome (Skia) does not. See README, finding 1. */

const f2dot14 = (v) => Math.round(v * 16384) / 16384;

export function makeAdvances(face) {
  const t = (tag) => { const b = face.referenceTable(tag)?.slice(); return b && new DataView(b.buffer); }; // copy: WASM memory can grow and detach views
  const fvar = t("fvar"), avar = t("avar"), hvar = t("HVAR"), hhea = t("hhea"), hmtx = t("hmtx"), maxp = t("maxp");

  // fvar axes
  const axesOff = fvar.getUint16(4), axisCount = fvar.getUint16(8), axisSize = fvar.getUint16(10);
  const axes = [];
  for (let i = 0; i < axisCount; i++) {
    const o = axesOff + i * axisSize;
    axes.push({ tag: String.fromCharCode(...[0, 1, 2, 3].map((k) => fvar.getUint8(o + k))), min: fvar.getInt32(o + 4) / 65536, def: fvar.getInt32(o + 8) / 65536, max: fvar.getInt32(o + 12) / 65536 });
  }
  // avar segment maps
  const maps = [];
  if (avar) {
    let o = 8;
    for (let i = 0; i < axisCount; i++) {
      const n = avar.getUint16(o); o += 2;
      const pairs = [];
      for (let k = 0; k < n; k++, o += 4) pairs.push([avar.getInt16(o) / 16384, avar.getInt16(o + 2) / 16384]);
      maps.push(pairs);
    }
  }
  const normalize = (coords) => axes.map((a, i) => {
    let v = Math.min(a.max, Math.max(a.min, coords[a.tag] ?? a.def));
    v = v < a.def ? (v - a.def) / (a.def - a.min) : v > a.def ? (v - a.def) / (a.max - a.def) : 0;
    v = f2dot14(v);
    const m = maps[i];
    if (m && m.length) {
      for (let k = 1; k < m.length; k++) {
        if (v <= m[k][0]) { const [x0, y0] = m[k - 1], [x1, y1] = m[k]; v = x1 === x0 ? y1 : y0 + ((v - x0) * (y1 - y0)) / (x1 - x0); break; }
      }
      v = f2dot14(v);
    }
    return v;
  });

  // hmtx
  const numH = hhea.getUint16(34), numGlyphs = maxp.getUint16(4);
  const baseAdv = (g) => hmtx.getUint16(4 * Math.min(g, numH - 1));

  // HVAR: item variation store + advance mapping
  const ivsOff = hvar.getUint32(4), mapOff = hvar.getUint32(8);
  const regOff = ivsOff + hvar.getUint32(ivsOff + 2), dataCount = hvar.getUint16(ivsOff + 6);
  const regAxis = hvar.getUint16(regOff), regCount = hvar.getUint16(regOff + 2);
  const regions = [];
  for (let r = 0; r < regCount; r++) {
    const ax = [];
    for (let a = 0; a < regAxis; a++) { const o = regOff + 4 + (r * regAxis + a) * 6; ax.push([hvar.getInt16(o) / 16384, hvar.getInt16(o + 2) / 16384, hvar.getInt16(o + 4) / 16384]); }
    regions.push(ax);
  }
  const datas = [];
  for (let d = 0; d < dataCount; d++) {
    const o = ivsOff + hvar.getUint32(ivsOff + 8 + 4 * d);
    const itemCount = hvar.getUint16(o), wdc = hvar.getUint16(o + 2), riCount = hvar.getUint16(o + 4);
    const long = !!(wdc & 0x8000), words = wdc & 0x7fff;
    const ri = []; for (let k = 0; k < riCount; k++) ri.push(hvar.getUint16(o + 6 + 2 * k));
    const rowSize = long ? words * 4 + (riCount - words) * 2 : words * 2 + (riCount - words);
    const base = o + 6 + 2 * riCount;
    datas.push({ itemCount, ri, row: (i) => {
      const out = [], p = base + i * rowSize;
      for (let k = 0; k < riCount; k++) {
        if (k < words) out.push(long ? hvar.getInt32(p + 4 * k) : hvar.getInt16(p + 2 * k));
        else { const q = p + (long ? 4 * words + 2 * (k - words) : 2 * words + (k - words)); out.push(long ? hvar.getInt16(q) : hvar.getInt8(q)); }
      }
      return out;
    } });
  }
  const mapEntry = (g) => {
    if (!mapOff) return [0, g];
    const fmt = hvar.getUint8(mapOff), ef = hvar.getUint8(mapOff + 1);
    const count = fmt === 0 ? hvar.getUint16(mapOff + 2) : hvar.getUint32(mapOff + 2);
    const size = ((ef >> 4) & 3) + 1, innerBits = (ef & 0xf) + 1, start = mapOff + (fmt === 0 ? 4 : 6);
    const i = Math.min(g, count - 1);
    let e = 0; for (let k = 0; k < size; k++) e = (e << 8) | hvar.getUint8(start + i * size + k);
    return [e >>> innerBits, e & ((1 << innerBits) - 1)];
  };

  /** Advances in font units (float) for all glyphs at the given axis values. */
  return function advances(coords) {
    const n = normalize(coords);
    const scal = regions.map((ax) => ax.reduce((acc, [s, p, e], a) => {
      if (!acc) return 0;
      const v = n[a];
      if (p === 0 || s > p || p > e || (s < 0 && e > 0)) return acc;
      if (v === p) return acc;
      if (v <= s || v >= e) return 0;
      return acc * (v < p ? (v - s) / (p - s) : (e - v) / (e - p));
    }, 1));
    const out = new Float64Array(numGlyphs);
    for (let g = 0; g < numGlyphs; g++) {
      const [outer, inner] = mapEntry(g), d = datas[outer];
      let delta = 0;
      if (d && inner < d.itemCount) { const row = d.row(inner); for (let k = 0; k < row.length; k++) delta += row[k] * scal[d.ri[k]]; }
      out[g] = baseAdv(g) + delta;
    }
    return out;
  };
}
