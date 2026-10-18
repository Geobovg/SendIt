import type { ReactNode } from "react";

// Selve stadionet, tegnet isometrisk (2:1) i tre dimensjoner: X går mot høyre og nedover, Y mot venstre og nedover, Z opp.
// Banen ligger i origo. Hver tribunenivå (0–10) legger til noe nytt: flere seterader, nye sider, en øvre etasje, tak,
// lysmaster, videotavle og en ytre fasade. Supporterfeltet (`fans`) fyller plassene. Ren pynt, leser bare nivåene.

const UNIT = 7.6; // piksler per enhet langs bakken
const ZS = 6.4; // piksler per enhet i høyden
const CX = 200;
const CY = 288;
const PL = 16; // banen: lengde langs X
const PW = 10; // banen: bredde langs Y
const APRON = 1.2; // avstand fra banelinjene til tribunene
const MAST_H = 6.4 * ZS; // høyden på lysmastene i piksler

type V = [number, number, number];
const P = ([x, y, z]: V): [number, number] => [CX + (x - PL / 2 - (y - PW / 2)) * UNIT, CY + (x - PL / 2 + (y - PW / 2)) * UNIT * 0.5 - z * ZS];
const f1 = (n: number) => Math.round(n * 10) / 10;
const path = (points: V[]) => points.map((point) => P(point)).map(([x, y]) => `${f1(x)},${f1(y)}`).join(" ");

/** Faste «tilfeldige» tall (bare heltallsregning, så server og nettleser tegner likt). */
const rnd = (n: number) => {
  let x = Math.imul(n + 1, 2654435761) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 15), 2246822519); x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

function Poly({ pts, fill, stroke, w = 0.6, opacity }: { pts: V[]; fill: string; stroke?: string; w?: number; opacity?: number }) {
  return <polygon points={path(pts)} fill={fill} stroke={stroke ?? "none"} strokeWidth={w} strokeLinejoin="round" opacity={opacity} />;
}
function Line({ a, b, stroke, w = 1, opacity, dash, dashOffset, cap, className, glow }: { a: V; b: V; stroke: string; w?: number; opacity?: number; dash?: string; dashOffset?: number; cap?: "round"; className?: string; glow?: string }) {
  const [x1, y1] = P(a); const [x2, y2] = P(b);
  return <line x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} stroke={stroke} strokeWidth={w} opacity={opacity} strokeDasharray={dash} strokeDashoffset={dashOffset} strokeLinecap={cap} className={className} style={glow ? { filter: `drop-shadow(0 0 3px ${glow})` } : undefined} />;
}
function Loop({ pts, stroke, w = 0.9, opacity = 0.85 }: { pts: V[]; stroke: string; w?: number; opacity?: number }) {
  return <polyline points={path(pts)} fill="none" stroke={stroke} strokeWidth={w} opacity={opacity} strokeLinejoin="round" />;
}

// ── Tribunene ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Seg = { o0: number; o1: number; z0: number; z1: number; kind: "wall" | "seat" | "walk"; tier: number; row: number };

/** Tverrsnittet av en tribune, fra banen og utover: reklamemur, nedre etasje med seter, gang, fasade og øvre etasje. */
function profile(lower: number, upper: number) {
  const segs: Seg[] = [{ o0: 0, o1: 0, z0: 0, z1: 0.45, kind: "wall", tier: 0, row: -1 }];
  let o = 0; let z = 0.45;
  for (let i = 0; i < lower; i += 1) { segs.push({ o0: o, o1: o + 0.38, z0: z, z1: z + 0.3, kind: "seat", tier: 0, row: i }); o += 0.38; z += 0.3; }
  if (upper > 0) {
    segs.push({ o0: o, o1: o + 0.6, z0: z, z1: z, kind: "walk", tier: 0, row: -1 }); o += 0.6;
    segs.push({ o0: o, o1: o, z0: z, z1: z + 0.75, kind: "wall", tier: 1, row: -1 }); z += 0.75;
    for (let i = 0; i < upper; i += 1) { segs.push({ o0: o, o1: o + 0.36, z0: z, z1: z + 0.44, kind: "seat", tier: 1, row: i }); o += 0.36; z += 0.44; }
  }
  return { segs, depth: o, top: z };
}
type Profile = ReturnType<typeof profile>;
type Axis = "x" | "y";
/** Punkt i en tribune: `along` er langs tribunen, `out` er avstanden fra banen. Hovedtribunen (x) vender mot −Y, langsiden (y) mot −X. */
const standAt = (axis: Axis) => (along: number, out: number, z: number): V => (axis === "x" ? [along, -APRON - out, z] : [-APRON - out, along, z]);

const adColors = ["#e63946", "#f1f5f9", "#2563eb", "#f1f5f9", "#16a34a", "#f1f5f9"];

function Stand({ axis, from, to, profile: { segs, depth }, fans, level }: { axis: Axis; from: number; to: number; profile: Profile; fans: number; level: number }) {
  const at = standAt(axis);
  const gap = Math.max(3.4, 10.5 - fans * 0.7);
  const out: ReactNode[] = [];
  segs.forEach((s, i) => {
    const quad = [at(from, s.o0, s.z0), at(to, s.o0, s.z0), at(to, s.o1, s.z1), at(from, s.o1, s.z1)];
    if (s.kind === "seat") {
      const palette = s.tier === 0 ? ["#2a5a97", "#3470b5"] : ["#932a44", "#af3a58"];
      out.push(<Poly key={`seat${i}`} pts={quad} fill={palette[s.row % 2]} />);
    } else if (s.kind === "walk") {
      out.push(<Poly key={`walk${i}`} pts={quad} fill="#9aa5b6" />);
    } else if (s.tier === 0) {
      // Reklamemuren mot banen.
      const n = Math.max(1, Math.round((to - from) / 2.2));
      for (let k = 0; k < n; k += 1) {
        const a0 = from + ((to - from) / n) * k; const a1 = from + ((to - from) / n) * (k + 1);
        out.push(<Poly key={`ad${k}`} pts={[at(a0, 0, 0), at(a1, 0, 0), at(a1, 0, s.z1), at(a0, 0, s.z1)]} fill={adColors[k % adColors.length]} stroke="#0b1424" w={0.3} />);
      }
    } else {
      // Fasaden mellom etasjene, med innganger til tribunen og en lysende stripe på de øverste nivåene.
      out.push(<Poly key={`fascia${i}`} pts={quad} fill="#c4ccd8" stroke="#7b8798" w={0.4} />);
      for (let a = from + 1.2; a < to - 1; a += 3.2) out.push(<Poly key={`vom${a}`} pts={[at(a, s.o0, s.z0 + 0.05), at(a + 0.8, s.o0, s.z0 + 0.05), at(a + 0.8, s.o0, s.z0 + 0.5), at(a, s.o0, s.z0 + 0.5)]} fill="#141d2e" />);
      if (level >= 9) out.push(<Line key="led" a={at(from, s.o0, s.z1 - 0.12)} b={at(to, s.o0, s.z1 - 0.12)} stroke="#5cc8ff" w={1.6} className="stadium-pulse" glow="#5cc8ff" />);
    }
  });

  // Gangene mellom setene og de fulle radene.
  for (const tier of [0, 1]) {
    const rows = segs.filter((s) => s.kind === "seat" && s.tier === tier);
    if (!rows.length) continue;
    const first = rows[0]; const last = rows[rows.length - 1];
    for (let a = from + 1.6; a < to - 0.6; a += 3.2) out.push(<Line key={`aisle${tier}-${a}`} a={at(a, first.o0, first.z0)} b={at(a, last.o1, last.z1)} stroke="#0b1424" w={1} opacity={0.5} />);
    rows.forEach((s, i) => {
      const o = (s.o0 + s.o1) / 2; const z = (s.z0 + s.z1) / 2;
      const a = at(from + 0.3, o, z); const b = at(to - 0.3, o, z); const shift = tier * 3 + i * 1.7;
      out.push(<Line key={`fan${tier}-${i}-a`} a={a} b={b} stroke="#f1f5f9" w={1.8} cap="round" dash={`0 ${gap}`} dashOffset={shift} opacity={0.95} />);
      out.push(<Line key={`fan${tier}-${i}-b`} a={a} b={b} stroke="#fb7185" w={1.8} cap="round" dash={`0 ${gap}`} dashOffset={gap / 2 + shift} opacity={0.95} />);
      if (fans >= 6) out.push(<Line key={`fan${tier}-${i}-c`} a={a} b={b} stroke="#7dd3fc" w={1.6} cap="round" dash={`0 ${gap * 2}`} dashOffset={gap / 4 + shift} opacity={0.9} />);
    });
  }

  // Enden av tribunen, som sees fra siden når ingen annen tribune stenger for den.
  const outline: V[] = [at(to, 0, 0)];
  for (const s of segs) outline.push(at(to, s.o1, s.z1));
  outline.push(at(to, depth, 0));
  out.push(<Poly key="end" pts={outline} fill="#aeb8c6" stroke="#5f6b7e" w={0.8} />);
  return <g>{out}</g>;
}

/** Fritt svevende tak over de øverste radene: lys flate med ribber og en tykk kant mot banen. */
function Roof({ axis, from, to, depth, top, glass }: { axis: Axis; from: number; to: number; depth: number; top: number; glass: boolean }) {
  const at = standAt(axis);
  const zf = top + 1.7; const zb = top + 1.1; const of = Math.max(0.7, depth * 0.4); const ob = depth + 0.5;
  const ribs: ReactNode[] = [];
  for (let a = from + 1.2; a < to; a += 2.4) ribs.push(<Line key={a} a={at(a, of, zf)} b={at(a, ob, zb)} stroke={glass ? "#8fc3dd" : "#aab4c4"} w={0.7} />);
  return <g>
    <Poly pts={[at(to, of, zf), at(to, ob, zb), at(to, ob, zb - 0.3), at(to, of, zf - 0.3)]} fill="#5b677a" stroke="#3b4658" w={0.5} />
    <Poly pts={[at(from, of, zf), at(to, of, zf), at(to, ob, zb), at(from, ob, zb)]} fill={glass ? "#cfe7f5" : "#e6ebf2"} stroke="#7f8ba0" w={0.8} />
    {ribs}
    <Poly pts={[at(from, of, zf - 0.3), at(to, of, zf - 0.3), at(to, of, zf), at(from, of, zf)]} fill="#6b778a" />
  </g>;
}

// ── De lave tribunene mot oss: vi ser fasaden og taket, ikke setene ───────────────────────────────────────────────

function Facade({ axis, plane, from, to, height, level, depth }: { axis: Axis; plane: number; from: number; to: number; height: number; level: number; depth: number }) {
  const w = (a: number, z: number): V => (axis === "x" ? [plane, a, z] : [a, plane, z]);
  const roofAt = (a: number, p: number): V => (axis === "x" ? [p, a, height] : [a, p, height]);
  const len = to - from; const n = Math.max(2, Math.round(len / 1.6)); const step = len / n;
  const out: ReactNode[] = [];
  out.push(<Poly key="wall" pts={[w(from, 0), w(to, 0), w(to, height), w(from, height)]} fill="#cdd5e0" stroke="#7b8798" />);
  out.push(<Poly key="plinth" pts={[w(from, 0), w(to, 0), w(to, 0.22), w(from, 0.22)]} fill="#8e99a8" />);
  for (let i = 0; i < n; i += 1) {
    const a0 = from + step * i; const mid = a0 + step / 2; const half = step * 0.27;
    const arch: V[] = [w(mid - half, 0.22), w(mid + half, 0.22)];
    for (let k = 0; k <= 4; k += 1) { const t = (k / 4) * Math.PI; arch.push(w(mid + half * Math.cos(t), 0.8 + half * Math.sin(t))); }
    out.push(<Poly key={`arch${i}`} pts={arch} fill="#141d2e" />);
    if (height >= 2) out.push(<Poly key={`win${i}`} pts={[w(a0 + 0.2, 1.2), w(a0 + step - 0.2, 1.2), w(a0 + step - 0.2, height - 0.35), w(a0 + 0.2, height - 0.35)]} fill="#7dd3fc" opacity={0.6} stroke="#e0f2fe" w={0.4} />);
  }
  for (let i = 0; i <= n; i += 1) {
    const a = from + step * i;
    out.push(<Poly key={`pillar${i}`} pts={[w(a - 0.07, 0.22), w(a + 0.07, 0.22), w(a + 0.07, height), w(a - 0.07, height)]} fill="#eef1f6" stroke="#9aa6b8" w={0.3} />);
  }
  out.push(<Poly key="parapet" pts={[w(from, height - 0.2), w(to, height - 0.2), w(to, height), w(from, height)]} fill={level >= 4 ? "#38bdf8" : "#aab4c3"} />);
  // Hovedinngangen midt på fasaden.
  if (level >= 5) {
    const mid = (from + to) / 2; const half = 0.95; const top = Math.min(height - 0.5, 1.5);
    const gate: V[] = [w(mid - half, 0.22), w(mid + half, 0.22), w(mid + half, top)];
    for (let k = 0; k <= 4; k += 1) { const t = (k / 4) * Math.PI; gate.push(w(mid + half * Math.cos(t), top + half * 0.7 * Math.sin(t))); }
    out.push(<Poly key="gate" pts={gate} fill="#0d1626" stroke="#e5e9f0" w={1.2} />);
    if (level >= 8) out.push(<Line key="gateglow" a={w(mid - half, 0.05)} b={w(mid + half, 0.05)} stroke="#7dd3fc" w={1.4} className="stadium-pulse" glow="#7dd3fc" />);
  }
  if (level >= 9) out.push(<Line key="led" a={w(from, height - 0.4)} b={w(to, height - 0.4)} stroke="#5cc8ff" w={1.8} className="stadium-pulse" glow="#5cc8ff" />);
  // Klubbflagg langs kanten.
  if (level >= 6) for (let i = 1; i < n; i += 3) {
    const a = from + step * i;
    out.push(<Line key={`pole${i}`} a={w(a, height)} b={w(a, height + 1.1)} stroke="#d1d9e4" w={1} />);
    out.push(<Poly key={`flag${i}`} pts={[w(a, height + 1.1), w(a + 0.7, height + 0.95), w(a, height + 0.8)]} fill={i % 2 ? "#ffffff" : "#e11d48"} />);
  }
  // Taket: en flat flate som stikker litt ut, med lysende striper i glass på de høyeste nivåene.
  const po = plane + 0.3; const pi = plane - depth - 0.35;
  out.push(<Poly key="roofedge" pts={[roofAt(from, po), roofAt(to, po), [...roofAt(to, po)].map((v, k) => (k === 2 ? v - 0.25 : v)) as V, [...roofAt(from, po)].map((v, k) => (k === 2 ? v - 0.25 : v)) as V]} fill="#5b677a" />);
  out.push(<Poly key="roof" pts={[roofAt(from, po), roofAt(to, po), roofAt(to, pi), roofAt(from, pi)]} fill={level >= 8 ? "#cfe7f5" : "#e2e8f0"} stroke="#7f8ba0" w={0.8} />);
  for (let a = from + 1.2; a < to; a += 2.4) out.push(<Line key={`rib${a}`} a={roofAt(a, po)} b={roofAt(a, pi)} stroke={level >= 8 ? "#8fc3dd" : "#aab4c4"} w={0.7} />);
  return <g>{out}</g>;
}

// ── Banen ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function Pitch({ level }: { level: number }) {
  const bands = 8; const out: ReactNode[] = [];
  out.push(<Poly key="apron" pts={[[-APRON, -APRON, 0], [PL + APRON, -APRON, 0], [PL + APRON, PW + APRON, 0], [-APRON, PW + APRON, 0]]} fill="#256f35" />);
  for (let i = 0; i < bands; i += 1) {
    const x0 = (PL / bands) * i; const x1 = (PL / bands) * (i + 1);
    if (level >= 6) for (let j = 0; j < 2; j += 1) out.push(<Poly key={`b${i}${j}`} pts={[[x0, (PW / 2) * j, 0], [x1, (PW / 2) * j, 0], [x1, (PW / 2) * (j + 1), 0], [x0, (PW / 2) * (j + 1), 0]]} fill={(i + j) % 2 ? "#2f9e44" : "#3bb552"} />);
    else out.push(<Poly key={`b${i}`} pts={[[x0, 0, 0], [x1, 0, 0], [x1, PW, 0], [x0, PW, 0]]} fill={i % 2 ? "#2f9e44" : "#37b24d"} />);
  }
  const line = "#f8fafc";
  const circle: V[] = Array.from({ length: 29 }, (_, i) => { const t = (i / 28) * Math.PI * 2; return [PL / 2 + 1.4 * Math.cos(t), PW / 2 + 1.4 * Math.sin(t), 0] as V; });
  out.push(<Loop key="outline" pts={[[0, 0, 0], [PL, 0, 0], [PL, PW, 0], [0, PW, 0], [0, 0, 0]]} stroke={line} />);
  out.push(<Loop key="half" pts={[[PL / 2, 0, 0], [PL / 2, PW, 0]]} stroke={line} />);
  out.push(<Loop key="circle" pts={circle} stroke={line} />);
  for (const [side, dir] of [[0, 1], [PL, -1]] as const) {
    out.push(<Loop key={`box${side}`} pts={[[side, PW / 2 - 2.95, 0], [side + dir * 2.5, PW / 2 - 2.95, 0], [side + dir * 2.5, PW / 2 + 2.95, 0], [side, PW / 2 + 2.95, 0]]} stroke={line} />);
    out.push(<Loop key={`six${side}`} pts={[[side, PW / 2 - 1.35, 0], [side + dir * 0.85, PW / 2 - 1.35, 0], [side + dir * 0.85, PW / 2 + 1.35, 0], [side, PW / 2 + 1.35, 0]]} stroke={line} />);
    // Målet med nett.
    const back = side - dir * 0.4; const top = 0.42;
    out.push(<Poly key={`net${side}`} pts={[[side, PW / 2 - 0.55, 0], [back, PW / 2 - 0.55, 0], [back, PW / 2 - 0.55, top], [side, PW / 2 - 0.55, top]]} fill="#fff" opacity={0.28} />);
    out.push(<Poly key={`netb${side}`} pts={[[back, PW / 2 - 0.55, 0], [back, PW / 2 + 0.55, 0], [back, PW / 2 + 0.55, top], [back, PW / 2 - 0.55, top]]} fill="#fff" opacity={0.2} />);
    out.push(<Loop key={`goal${side}`} pts={[[side, PW / 2 - 0.55, 0], [side, PW / 2 - 0.55, top], [side, PW / 2 + 0.55, top], [side, PW / 2 + 0.55, 0]]} stroke="#fff" w={1.4} opacity={1} />);
  }
  for (const [x, y] of [[0, 0], [PL, 0], [PL, PW], [0, PW]] as const) {
    out.push(<Line key={`cf${x}${y}`} a={[x, y, 0]} b={[x, y, 0.5]} stroke="#fff" w={0.9} />);
    out.push(<Poly key={`cff${x}${y}`} pts={[[x, y, 0.5], [x, y + (y === 0 ? 0.45 : -0.45), 0.4], [x, y, 0.3]]} fill="#ef4444" />);
  }
  const [bx, by] = P([PL / 2, PW / 2, 0]);
  out.push(<circle key="ball" cx={f1(bx)} cy={f1(by)} r="1.7" fill="#fff" stroke="#111827" strokeWidth=".5" />);
  return <g>{out}</g>;
}

function Box({ x0, x1, y0, y1, z1, top, front, side }: { x0: number; x1: number; y0: number; y1: number; z1: number; top: string; front: string; side: string }) {
  return <g>
    <Poly pts={[[x0, y1, 0], [x1, y1, 0], [x1, y1, z1], [x0, y1, z1]]} fill={front} stroke="#0b1424" w={0.4} />
    <Poly pts={[[x1, y0, 0], [x1, y1, 0], [x1, y1, z1], [x1, y0, z1]]} fill={side} stroke="#0b1424" w={0.4} />
    <Poly pts={[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]} fill={top} stroke="#0b1424" w={0.4} />
  </g>;
}

/** Lavt gjerde der det ennå ikke står noen tribune. */
function Fence({ axis, plane, from, to }: { axis: Axis; plane: number; from: number; to: number }) {
  const w = (a: number, z: number): V => (axis === "x" ? [plane, a, z] : [a, plane, z]);
  const out: ReactNode[] = [<Line key="rail" a={w(from, 0.5)} b={w(to, 0.5)} stroke="#e2e8f0" w={1.1} />, <Line key="mesh" a={w(from, 0.25)} b={w(to, 0.25)} stroke="#cbd5e1" w={0.6} opacity={0.6} dash="1 2" />];
  for (let a = from; a <= to + 0.01; a += 1.6) out.push(<Line key={a} a={w(a, 0)} b={w(a, 0.5)} stroke="#94a3b8" w={1.1} />);
  return <g>{out}</g>;
}

function Mast({ x, y, glow, level }: { x: number; y: number; glow: boolean; level: number }) {
  const [bx, by] = P([x, y, 0]); const h = MAST_H; const top = by - h;
  const zig = Array.from({ length: 7 }, (_, i) => `${f1(bx + (i % 2 ? 2.2 : -2.2))},${f1(by - (h / 6) * i)}`).join(" ");
  return <g>
    {glow ? <polygon points={`${f1(bx)},${f1(top)} ${f1(P([PL / 2 - 3, PW / 2 - 2.5, 0])[0])},${f1(P([PL / 2 - 3, PW / 2 - 2.5, 0])[1])} ${f1(P([PL / 2 + 3, PW / 2 + 2.5, 0])[0])},${f1(P([PL / 2 + 3, PW / 2 + 2.5, 0])[1])}`} fill="#fff7c2" opacity=".07" /> : null}
    <ellipse cx={f1(bx)} cy={f1(by)} rx="5" ry="2" fill="#000" opacity=".3" />
    <line x1={f1(bx)} y1={f1(by)} x2={f1(bx)} y2={f1(top)} stroke="#7f8ba0" strokeWidth="2" />
    <polyline points={zig} fill="none" stroke="#9aa6b8" strokeWidth=".8" />
    <g className={glow ? "stadium-pulse" : undefined}><circle cx={f1(bx)} cy={f1(top - 4)} r={glow ? 17 : 11} fill="#fff7c2" opacity={glow ? 0.28 : 0.13} /></g>
    <rect x={f1(bx - 12)} y={f1(top - 11)} width="24" height="13" rx="1.5" fill="#364152" stroke="#1f2937" strokeWidth=".8" />
    {[-7, 0, 7].flatMap((dx) => [0, 1].map((row) => <circle key={`${dx}${row}`} cx={f1(bx + dx)} cy={f1(top - 7.5 + row * 5)} r="1.8" fill={level >= 5 ? "#fffbe0" : "#fff3b0"} />))}
  </g>;
}

/** Videotavla på taket av hovedtribunen. */
function Scoreboard({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${f1(x)} ${f1(y)})`}>
    <line x1="-24" y1="0" x2="-24" y2="12" stroke="#64748b" strokeWidth="2" /><line x1="24" y1="0" x2="24" y2="12" stroke="#64748b" strokeWidth="2" />
    <rect x="-34" y="-26" width="68" height="28" rx="2.5" fill="#0b1220" stroke="#94a3b8" strokeWidth="1.2" />
    <rect x="-30" y="-22" width="60" height="20" rx="1.5" fill="#0e7490" opacity=".85" />
    <g className="stadium-pulse"><rect x="-26" y="-18" width="22" height="4" fill="#a7f3d0" /><rect x="-2" y="-18" width="26" height="4" fill="#e0f2fe" /><rect x="-26" y="-11" width="30" height="3" fill="#bae6fd" opacity=".8" /><rect x="8" y="-11" width="16" height="3" fill="#7dd3fc" opacity=".8" /></g>
  </g>;
}

/** Mål og sider som stadionet har på et nivå, og hvor lysmastene står. */
function layout(level: number) {
  const hasMain = level >= 1; const hasSide = level >= 3; const hasEnd = level >= 5; const hasFront = level >= 7;
  const upper = level >= 6 ? level - 4 + (level >= 9 ? 1 : 0) : 0;
  const main = hasMain ? profile(Math.min(6, 2 + level), upper) : null;
  const side = hasSide ? profile(Math.min(6, level + 1), Math.max(0, upper - 1)) : null;
  const dEnd = level >= 8 ? 1.8 : 1.4;
  const d1 = main?.depth ?? 0; const d2 = side?.depth ?? 0;
  const xFrom = -APRON - d2; const xTo = PL + APRON + (hasEnd ? dEnd : 0);
  const yTo = PW + APRON + (hasFront ? dEnd : 0);
  const xMin = hasSide ? xFrom : -APRON; const yMin = hasMain ? -APRON - d1 : -APRON;
  const endH = 1.5 + Math.max(0, level - 5) * 0.32; const frontH = 1.5 + Math.max(0, level - 7) * 0.32;
  // Masta står i hjørnene utenfor tribunene: to fra nivå 3 og fire fra nivå 6.
  const masts: [number, number][] = [];
  if (level >= 3) masts.push([xMin - 1, yTo + 0.8], [xTo + 0.8, yMin - 1]);
  if (level >= 6) masts.push([xMin - 1, yMin - 1], [xTo + 0.8, yTo + 0.8]);
  return { hasMain, hasSide, hasEnd, hasFront, main, side, dEnd, xFrom, xTo, yTo, xMin, yMin, endH, frontH, masts };
}

/** Lyskasterne i tegningens koordinater (til kveldsmodusen) og midten av banen. Flere master gir mer lys. */
export function floodlights(level: number) {
  const { masts } = layout(level);
  return { heads: masts.map(([x, y]) => { const [bx, by] = P([x, y, 0]); return [bx, by - MAST_H - 4] as [number, number]; }), pitch: P([PL / 2, PW / 2, 0]) };
}

export function Stadium({ level, fans }: { level: number; fans: number }) {
  const { hasMain, hasSide, hasEnd, hasFront, main, side, dEnd, xFrom, xTo, yTo, xMin, yMin, endH, frontH, masts } = layout(level);

  const roofMain = main && level >= 4 ? <Roof axis="x" from={xFrom} to={xTo} depth={main.depth} top={main.top} glass={level >= 8} /> : null;
  const roofSide = side && level >= 6 ? <Roof axis="y" from={-APRON} to={yTo} depth={side.depth} top={side.top} glass={level >= 8} /> : null;
  const board = main && level >= 7 ? P([PL / 2, -APRON - main.depth * 0.92, main.top + 1.5]) : null;
  const people = level >= 3 ? Array.from({ length: level * 2 }, (_, i) => {
    const onFront = hasFront && i % 2 === 0; const onEnd = hasEnd && !onFront;
    const point: V = onFront ? [rnd(i + 5) * (PL + 2) - 1, yTo + 0.6 + rnd(i + 9) * 1.4, 0] : onEnd ? [xTo + 0.6 + rnd(i + 9) * 1.4, rnd(i + 5) * (yTo + 2) - 1, 0] : [PL / 2 + (rnd(i + 5) * 8 - 4), yTo + 0.8 + rnd(i + 9) * 1.2, 0];
    return { point, color: ["#f472b6", "#ffffff", "#38bdf8", "#fb7185"][i % 4], i };
  }) : [];

  return <g>
    {level >= 1 ? <polygon points={path([[xMin - 2.4, yMin - 2.4, 0], [xTo + 2.4, yMin - 2.4, 0], [xTo + 2.4, yTo + 2.4, 0], [xMin - 2.4, yTo + 2.4, 0]])} fill="#2a3748" stroke="#475569" strokeOpacity=".7" strokeWidth="1.2" strokeLinejoin="round" /> : null}
    <Pitch level={level} />
    {!hasMain ? <Fence axis="y" plane={-APRON} from={-APRON} to={PL + APRON} /> : null}
    {!hasSide ? <Fence axis="x" plane={-APRON} from={-APRON} to={PW + APRON} /> : null}

    <g key={level} className="stadium-pop">
      {main ? <Stand axis="x" from={xFrom} to={xTo} profile={main} fans={fans} level={level} /> : null}
      {side ? <Stand axis="y" from={-APRON} to={yTo} profile={side} fans={fans} level={level} /> : null}
      {roofMain}{roofSide}
      {main && level >= 2 ? <>
        <Box x0={4.2} x1={6.6} y0={-1.1} y1={-0.55} z1={0.5} top="#93c5fd" front="#1e3a5f" side="#334e75" />
        <Box x0={9.4} x1={11.8} y0={-1.1} y1={-0.55} z1={0.5} top="#93c5fd" front="#1e3a5f" side="#334e75" />
      </> : null}
      {board ? <Scoreboard x={board[0]} y={board[1] - 4} /> : null}

      {!hasEnd ? <Fence axis="x" plane={PL + APRON} from={-APRON} to={PW + APRON} /> : null}
      {!hasFront ? <Fence axis="y" plane={PW + APRON} from={-APRON} to={PL + APRON} /> : null}
      {hasEnd ? <Facade axis="x" plane={xTo} from={-APRON} to={yTo} height={endH} level={level} depth={dEnd} /> : null}
      {hasFront ? <Facade axis="y" plane={yTo} from={-APRON} to={xTo} height={frontH} level={level} depth={dEnd} /> : null}

      {masts.map(([x, y]) => <Mast key={`${x}${y}`} x={x} y={y} glow={level >= 8} level={level} />)}
      {people.map(({ point, color, i }) => { const [px, py] = P(point); return <g key={i}><circle cx={f1(px)} cy={f1(py - 4.6)} r="1.4" fill="#f5d0a9" /><rect x={f1(px - 1.3)} y={f1(py - 3.4)} width="2.6" height="3.4" rx="1" fill={color} /></g>; })}
      {level >= 10 ? (() => { const [px, py] = P([PL / 2, yTo + 2.2, 0]); return <g><rect x={f1(px - 6)} y={f1(py - 4)} width="12" height="4" rx="1" fill="#64748b" /><circle cx={f1(px)} cy={f1(py - 11)} r="6" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" /><path d={`M${f1(px - 3)} ${f1(py - 11)} h6 l-1 4 h-4z`} fill="#f2c94c" /></g>; })() : null}
    </g>
  </g>;
}
