import type { ReactNode } from "react";
import type { BuildingKey, StadiumLevels } from "@/lib/stadium";

// Selve stadionet slik managerens egen base ser ut. Tegningen leser bare nivåene, så den er ren pynt: ingenting her
// påvirker spillet. Hver bygning og stadionet blir større og finere for hvert nivå (se ADR 0004).

export const SCENE_W = 400;
export const SCENE_H = 520;

/** Midten og størrelsen på trykkflaten til hver bygning, i tegningens egne enheter. Tribunen er selve stadionet. */
export const sceneSpots: Record<BuildingKey, { x: number; y: number; w: number; h: number }> = {
  klubbhus: { x: 200, y: 78, w: 132, h: 104 },
  kasse: { x: 58, y: 86, w: 84, h: 72 },
  speiderhytte: { x: 342, y: 86, w: 84, h: 72 },
  tribune: { x: 200, y: 272, w: 340, h: 172 },
  billettluke: { x: 66, y: 436, w: 100, h: 84 },
  supporterfelt: { x: 200, y: 446, w: 132, h: 88 },
  treningsfelt: { x: 334, y: 436, w: 110, h: 84 },
};

/** Faste «tilfeldige» tall mellom 0 og 1, så tegningen blir lik hver gang og på server og klient. Bare heltallsregning, siden Math.sin kan gi litt ulike desimaler i Node og nettleseren, og det gir hydreringsfeil. */
const rnd = (n: number) => {
  let x = Math.imul(n + 1, 2654435761) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 15), 2246822519); x = Math.imul(x ^ (x >>> 13), 3266489917);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const pts = (points: [number, number][]) => points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(" ");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Shadow({ rx }: { rx: number }) {
  return <ellipse cx="0" cy="0" rx={rx} ry={rx * 0.26} fill="#000" opacity=".3" />;
}

/** Tomt byggested: en bygning på nivå 0 er bare en tomt med pinner. */
function Plot({ color, w = 74 }: { color: string; w?: number }) {
  return <g>
    <rect x={-w / 2} y={-34} width={w} height={34} rx="9" fill="#3b2f23" opacity=".6" stroke={color} strokeWidth="1.6" strokeDasharray="5 4" />
    {[-1, 1].flatMap((sx) => [-1, 1].map((sy) => <rect key={`${sx}${sy}`} x={sx * (w / 2 - 6) - 1.5} y={sy < 0 ? -31 : -9} width="3" height="8" rx="1" fill="#d6b27a" />))}
  </g>;
}

// ── Klubbhuset (nivå 1–5): fra et lite hus med saltak til en klubbhusborg med glassatrium og gullkuppel.
function Clubhouse({ level }: { level: number }) {
  const floors = [1, 2, 2, 3, 4][level - 1] ?? 1;
  const w = 48 + level * 9; const fh = 15; const h = floors * fh + 8;
  const cols = Math.max(2, Math.floor(w / 17));
  const wall = level >= 3 ? "#f3efe2" : "#e2d8bf"; const edge = "#8a7f66";
  const dome = w * 0.19; const roofY = -h - 4;
  return <g>
    <Shadow rx={w / 2 + 10} />
    {level >= 3 ? [-1, 1].map((s) => <rect key={s} x={s < 0 ? -w / 2 - 18 : w / 2 - 2} y={-h * 0.55} width="20" height={h * 0.55} rx="2" fill="#d9d2bd" stroke={edge} strokeWidth=".6" />) : null}
    <rect x={-w / 2} y={-h} width={w} height={h} rx="2" fill={wall} stroke={edge} strokeWidth=".8" />
    {Array.from({ length: floors }, (_, f) => Array.from({ length: cols }, (_, c) => <rect key={`${f}-${c}`} x={-w / 2 + (w / cols) * (c + 0.5) - 4} y={-h + 5 + f * fh} width="8" height="7" rx="1" fill="#ffe9a3" stroke={edge} strokeWidth=".5" />))}
    <rect x="-6" y="-15" width="12" height="15" rx="2" fill={level >= 4 ? "#7dd3fc" : "#6b4f2a"} stroke={edge} strokeWidth=".6" />
    {level < 3 ? <polygon points={`${-w / 2 - 4},${-h} ${w / 2 + 4},${-h} 0,${-h - 17}`} fill="#b4443c" stroke="#7f2d28" strokeWidth=".8" />
      : <rect x={-w / 2 - 2} y={-h - 4} width={w + 4} height="4" rx="1" fill="#b9ad8e" />}
    {level === 4 ? <polygon points={`${-w * 0.24},${roofY} ${w * 0.24},${roofY} ${w * 0.17},${roofY - 15} ${-w * 0.17},${roofY - 15}`} fill="#7dd3fc" opacity=".7" stroke="#e0f2fe" strokeWidth="1" /> : null}
    {level >= 5 ? <g>
      <path d={`M${-dome} ${roofY} A${dome} ${dome} 0 0 1 ${dome} ${roofY} Z`} fill="#f2c94c" stroke="#b8860b" strokeWidth=".8" />
      <rect x="-1" y={roofY - dome - 8} width="2" height="8" fill="#b8860b" />
      <path d={`M-5 ${roofY - dome - 17} h10 v3 a5 5 0 0 1 -10 0 z`} fill="#fff1a8" stroke="#b8860b" strokeWidth=".7" />
    </g> : null}
    {[...(level >= 5 ? [-1, 1] : [1])].map((s) => <g key={s} transform={`translate(${s * (w / 2 - 6)} ${level < 3 ? -h - 8 : -h - 4})`}><line x1="0" y1="0" x2="0" y2="-22" stroke="#6b7280" strokeWidth="1.4" /><polygon points="0,-22 13,-18 0,-14" fill={level >= 2 ? "#f2c94c" : "#e5e7eb"} /></g>)}
  </g>;
}

// ── Kassa (nivå 1–10): fra et lite pengeskap-skur til en søyleprydet bank med gullbarrer.
function CashRoom({ level }: { level: number }) {
  const w = 34 + level * 3; const h = 24 + level * 2.2;
  const columns = level < 3 ? 0 : Math.min(5, 2 + Math.floor((level - 3) / 2));
  const stone = level >= 7 ? "#c9c2e6" : "#a89fd0";
  return <g>
    <Shadow rx={w / 2 + 12} />
    <rect x={-w / 2} y={-h} width={w} height={h} rx="2" fill={stone} stroke="#4c3f7a" strokeWidth=".9" />
    {Array.from({ length: columns }, (_, i) => <rect key={i} x={-w / 2 + 4 + ((w - 12) / Math.max(1, columns - 1)) * i} y={-h + 7} width="4" height={h - 12} rx="1" fill="#ece8fb" stroke="#4c3f7a" strokeWidth=".4" />)}
    {level >= 3 ? <polygon points={`${-w / 2 - 3},${-h} ${w / 2 + 3},${-h} 0,${-h - 11}`} fill={level >= 10 ? "#f2c94c" : "#6d5bb0"} stroke="#4c3f7a" strokeWidth=".8" /> : <rect x={-w / 2 - 2} y={-h - 3} width={w + 4} height="3" rx="1" fill="#6d5bb0" />}
    <circle cx="0" cy={-h / 2 + 2} r={Math.min(9, 6 + level * 0.3)} fill="#3b3560" stroke="#f2c94c" strokeWidth="1.6" />
    <circle cx="0" cy={-h / 2 + 2} r="2" fill="#f2c94c" />
    {level >= 5 ? Array.from({ length: Math.min(6, level - 3) }, (_, i) => <g key={i} transform={`translate(${w / 2 + 6 + (i % 3) * 7} ${-(Math.floor(i / 3)) * 5})`}><rect x="0" y="-5" width="9" height="5" rx="1" fill="#f2c94c" stroke="#b8860b" strokeWidth=".5" /></g>) : null}
    {level >= 8 ? [-1, 0, 1].map((i) => <circle key={i} cx={-w / 2 - 8 + i * 4} cy={-3 - (i === 0 ? 3 : 0)} r="3" fill="#fde68a" stroke="#b8860b" strokeWidth=".5" />) : null}
    {level >= 10 ? <path d="M-3 -62 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#fff7c2" className="stadium-pulse" transform={`translate(${w / 2 - 8} ${-h + 6})`} /> : null}
  </g>;
}

// ── Speiderhytta (nivå 0–10): fra en trehytte til en hytte med speidertårn, radar og søkelys.
function ScoutHut({ level }: { level: number }) {
  if (level < 1) return <g><Shadow rx={46} /><Plot color="#2dd4bf" /></g>;
  const w = 34 + level * 2; const h = 18 + level;
  const tower = level >= 3 ? 22 + level * 4 : 0;
  return <g>
    <Shadow rx={w / 2 + 16} />
    {level >= 8 ? <g><rect x={-w / 2 - 20} y="-17" width="22" height="17" fill="#8a5a33" stroke="#4a2f1a" strokeWidth=".7" /><polygon points={`${-w / 2 - 22},-17 ${-w / 2 + 4},-17 ${-w / 2 - 9},-27`} fill="#3f2a1c" /></g> : null}
    <rect x={-w / 2} y={-h} width={w} height={h} fill="#a06a3c" stroke="#4a2f1a" strokeWidth=".8" />
    {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={-w / 2} x2={w / 2} y1={-h * t} y2={-h * t} stroke="#4a2f1a" strokeWidth=".4" opacity=".6" />)}
    <polygon points={`${-w / 2 - 4},${-h} ${w / 2 + 4},${-h} 0,${-h - 14}`} fill="#3f2a1c" stroke="#26180f" strokeWidth=".8" />
    <rect x={-w / 2 + 5} y={-h + 6} width="9" height="8" rx="1" fill="#ffe9a3" stroke="#4a2f1a" strokeWidth=".6" />
    <rect x={w / 2 - 14} y={-14} width="9" height="14" rx="1.5" fill="#5b3a1e" />
    {tower ? <g transform={`translate(${w / 2 + 16} 0)`}>
      <line x1="-8" y1="0" x2="-4" y2={-tower} stroke="#5b3a1e" strokeWidth="2" /><line x1="8" y1="0" x2="4" y2={-tower} stroke="#5b3a1e" strokeWidth="2" />
      <line x1="-8" y1="0" x2="4" y2={-tower * 0.55} stroke="#5b3a1e" strokeWidth="1" /><line x1="8" y1="0" x2="-4" y2={-tower * 0.55} stroke="#5b3a1e" strokeWidth="1" />
      <rect x="-9" y={-tower - 12} width="18" height="12" rx="1.5" fill="#a06a3c" stroke="#4a2f1a" strokeWidth=".8" />
      <rect x="-6" y={-tower - 9} width="12" height="5" fill="#7dd3fc" opacity=".8" />
      <polygon points={`-11,${-tower - 12} 11,${-tower - 12} 0,${-tower - 22}`} fill="#2dd4bf" stroke="#0f766e" strokeWidth=".8" />
      {level >= 6 ? <g transform={`translate(0 ${-tower - 22})`}><path d="M-8 -2 q8 -10 16 0" fill="none" stroke="#e2e8f0" strokeWidth="1.6" /><line x1="0" y1="-2" x2="0" y2="-5" stroke="#e2e8f0" strokeWidth="1.2" /></g> : null}
      {level >= 10 ? <g className="stadium-pulse"><polygon points={`0,${-tower - 6} -34,${-tower - 60} 34,${-tower - 60}`} fill="#fff7c2" opacity=".16" /></g> : null}
    </g> : null}
  </g>;
}

// ── Billettluka (nivå 1–10): fra én luke til en portal med flere luker, kø og lysestolper.
function TicketOffice({ level }: { level: number }) {
  const booths = level < 4 ? 1 : level < 7 ? 2 : 3;
  const total = booths * 28; const queue = Math.min(10, level + 1);
  return <g>
    <Shadow rx={total / 2 + 22} />
    {level >= 8 ? <path d={`M${-total / 2 - 8} 0 V-30 A${total / 2 + 8} 22 0 0 1 ${total / 2 + 8} -30 V0`} fill="none" stroke="#f2c94c" strokeWidth="3.5" opacity=".95" /> : null}
    {Array.from({ length: booths }, (_, i) => <g key={i} transform={`translate(${-total / 2 + 14 + i * 28} 0)`}>
      <rect x="-11" y="-30" width="22" height="30" rx="2" fill="#e5efe6" stroke="#2f6f46" strokeWidth=".9" />
      <rect x="-8" y="-24" width="16" height="10" rx="1" fill="#7dd3fc" stroke="#2f6f46" strokeWidth=".6" />
      <path d="M-13 -30 h26 l-3 -8 h-20 z" fill="#4ade80" stroke="#2f6f46" strokeWidth=".7" />
      {[-9, -3, 3].map((x) => <rect key={x} x={x} y="-38" width="3" height="8" fill="#fff" opacity=".7" />)}
    </g>)}
    {Array.from({ length: booths + 1 }, (_, i) => <rect key={i} x={-total / 2 + i * 28 - 1.5} y="2" width="3" height="9" rx="1" fill="#94a3b8" />)}
    {Array.from({ length: queue }, (_, i) => { const x = -total / 2 + 6 + rnd(i + 3) * (total - 12); const y = 12 + (i % 3) * 5; const color = ["#4ade80", "#ffffff", "#fbbf24", "#f472b6"][i % 4]; return <g key={i}><circle cx={x} cy={y} r="2.3" fill="#f5d0a9" /><rect x={x - 2} y={y + 2} width="4" height="5" rx="1.5" fill={color} /></g>; })}
    {level >= 10 ? [-1, 1].map((s) => <g key={s} transform={`translate(${s * (total / 2 + 18)} 0)`}><line x1="0" y1="0" x2="0" y2="-34" stroke="#64748b" strokeWidth="1.6" /><circle cx="0" cy="-36" r="4" fill="#fff7c2" className="stadium-pulse" /></g>) : null}
  </g>;
}

// ── Treningsfeltet (nivå 0–10): fra en liten bane med ett mål til et anlegg med gjerde, lys, garderobe og tavle.
function TrainingGround({ level }: { level: number }) {
  if (level < 1) return <g><Shadow rx={50} /><Plot color="#fb923c" w={80} /></g>;
  const bottom = 56 + level * 4; const top = bottom * 0.78; const h = 26 + level * 1.6;
  const corners: [number, number][] = [[-bottom / 2, 0], [bottom / 2, 0], [top / 2, -h], [-top / 2, -h]];
  const at = (t: number): [number, number, number] => [lerp(-bottom / 2, -top / 2, t), lerp(bottom / 2, top / 2, t), -h * t];
  const cones = level < 2 ? 2 : Math.min(7, level);
  const players = level < 2 ? 0 : Math.min(6, level);
  return <g>
    <Shadow rx={bottom / 2 + 14} />
    {level >= 3 ? <polygon points={pts(corners.map(([x, y]) => [x * 1.1, y * 1.18 - (y === 0 ? -4 : 4)] as [number, number]))} fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="1.5 3" /> : null}
    {Array.from({ length: 4 }, (_, i) => { const [a0, b0, y0] = at(i / 4); const [a1, b1, y1] = at((i + 1) / 4); return <polygon key={i} points={pts([[a0, y0], [b0, y0], [b1, y1], [a1, y1]])} fill={i % 2 ? "#37b24d" : "#2f9e44"} />; })}
    <polygon points={pts(corners)} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    <line x1={at(0.5)[0]} x2={at(0.5)[1]} y1={at(0.5)[2]} y2={at(0.5)[2]} stroke="#fff" strokeOpacity=".6" strokeWidth=".8" />
    <rect x={-bottom / 2 + 1} y={-h * 0.5 - 6} width="4" height="12" fill="none" stroke="#fff" strokeWidth="1.2" />
    {level >= 4 ? <rect x={bottom / 2 - 5} y={-h * 0.5 - 6} width="4" height="12" fill="none" stroke="#fff" strokeWidth="1.2" /> : null}
    {Array.from({ length: cones }, (_, i) => { const t = 0.2 + rnd(i + 11) * 0.6; const [a, b, y] = at(t); return <polygon key={i} points={`${lerp(a, b, rnd(i + 5)) - 2},${y} ${lerp(a, b, rnd(i + 5)) + 2},${y} ${lerp(a, b, rnd(i + 5))},${y - 5}`} fill="#fb923c" />; })}
    {Array.from({ length: players }, (_, i) => { const [a, b, y] = at(0.15 + rnd(i + 21) * 0.7); const x = lerp(a + 4, b - 4, rnd(i + 31)); return <g key={i}><circle cx={x} cy={y - 7} r="2" fill="#f5d0a9" /><rect x={x - 2} y={y - 5} width="4" height="5" rx="1.5" fill={i % 2 ? "#ffffff" : "#fb923c"} /></g>; })}
    {level >= 5 ? <g transform={`translate(${top / 2 - 24} ${-h})`}><rect x="0" y="-16" width="20" height="16" fill="#9a6b3f" stroke="#4a2f1a" strokeWidth=".7" /><polygon points="-2,-16 22,-16 10,-23" fill="#3f2a1c" /><rect x="12" y="-10" width="5" height="10" fill="#5b3a1e" /></g> : null}
    {level >= 6 ? [-1, ...(level >= 8 ? [1] : [])].map((s) => <g key={s} transform={`translate(${s * (top / 2 + 8)} ${-h})`}><line x1="0" y1="0" x2="0" y2="-34" stroke="#8d99ae" strokeWidth="1.6" /><rect x="-7" y="-41" width="14" height="7" rx="1" fill="#3a4658" /><circle cx="-3" cy="-37.5" r="1.4" fill="#fff6c9" /><circle cx="0" cy="-37.5" r="1.4" fill="#fff6c9" /><circle cx="3" cy="-37.5" r="1.4" fill="#fff6c9" /></g>) : null}
    {level >= 10 ? <g transform={`translate(-10 ${-h - 4})`}><rect x="-16" y="-14" width="32" height="12" rx="1.5" fill="#0f172a" stroke="#94a3b8" strokeWidth=".8" /><rect x="-12" y="-11" width="24" height="3" fill="#fb923c" className="stadium-pulse" /><rect x="-12" y="-6" width="14" height="2" fill="#fde68a" opacity=".8" /></g> : null}
  </g>;
}

// ── Supporterfeltet (nivå 0–10): fra et flagg og noen fans til en tifo-scene med trommer, bannere og røykbomber.
function SupporterZone({ level }: { level: number }) {
  if (level < 1) return <g><Shadow rx={56} /><Plot color="#f472b6" w={88} /></g>;
  const rx = 44 + level * 3.2; const ry = 13 + level * 0.9;
  const fans = Array.from({ length: level * 4 + 2 }, (_, i) => ({ x: (rnd(i + 41) * 2 - 1) * (rx - 8), y: -4 - rnd(i + 51) * (ry * 1.5), color: ["#f472b6", "#ffffff", "#fbbf24", "#fb7185"][i % 4] })).sort((a, b) => a.y - b.y);
  const poleX = 30 + level * 2.4;
  return <g>
    <ellipse cx="0" cy="-6" rx={rx} ry={ry} fill="#4a2b43" stroke="#f472b6" strokeOpacity=".5" strokeWidth="1.2" />
    {level >= 7 ? <g>
      <line x1="-24" y1="-34" x2="-24" y2="-54" stroke="#94a3b8" strokeWidth="1.6" /><line x1="24" y1="-34" x2="24" y2="-54" stroke="#94a3b8" strokeWidth="1.6" />
      <rect x="-28" y="-80" width="56" height="30" rx="2" fill="#f472b6" stroke="#9d174d" strokeWidth="1" />
      {[-21, -7, 7, 21].map((x) => <rect key={x} x={x - 3.5} y="-80" width="7" height="30" fill="#fff" opacity=".5" />)}
      <path d="M0 -76 l3.4 7 l7.6 1 l-5.5 5.3 l1.4 7.6 l-6.9 -3.7 l-6.9 3.7 l1.4 -7.6 l-5.5 -5.3 l7.6 -1z" fill="#fde68a" stroke="#9d174d" strokeWidth=".6" />
    </g> : null}
    {level >= 3 ? <g>
      <line x1={-poleX} y1="-8" x2={-poleX} y2="-40" stroke="#94a3b8" strokeWidth="1.6" /><line x1={poleX} y1="-8" x2={poleX} y2="-40" stroke="#94a3b8" strokeWidth="1.6" />
      <path d={`M${-poleX} -40 Q0 -26 ${poleX} -40`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      {Array.from({ length: 7 }, (_, i) => { const t = (i + 1) / 8; const x = lerp(-poleX, poleX, t); const y = -40 + 28 * t * (1 - t); return <polygon key={i} points={`${x - 3},${y} ${x + 3},${y} ${x},${y + 7}`} fill={i % 2 ? "#ffffff" : "#f472b6"} />; })}
    </g> : <g><line x1={-poleX} y1="-8" x2={-poleX} y2="-36" stroke="#94a3b8" strokeWidth="1.6" /><polygon points={`${-poleX},-36 ${-poleX + 14},-32 ${-poleX},-28`} fill="#f472b6" /></g>}
    {fans.map((fan, i) => <g key={i}><circle cx={fan.x} cy={fan.y - 6} r="2.3" fill="#f5d0a9" /><rect x={fan.x - 2.2} y={fan.y - 4} width="4.4" height="5.5" rx="1.6" fill={fan.color} />{level >= 6 && i % 5 === 0 ? <line x1={fan.x + 2} y1={fan.y - 4} x2={fan.x + 4} y2={fan.y - 12} stroke="#fff" strokeWidth="1" /> : null}</g>)}
    {level >= 5 ? <g transform={`translate(${rx * 0.45} -2)`}><ellipse cx="0" cy="0" rx="7" ry="2.5" fill="#000" opacity=".25" /><rect x="-6" y="-11" width="12" height="11" rx="2" fill="#e11d48" stroke="#881337" strokeWidth=".7" /><ellipse cx="0" cy="-11" rx="6" ry="2" fill="#fff1f2" /></g> : null}
    {level >= 9 ? [[-20, -34], [16, -38], [-2, -42]].map(([x, y], i) => <g key={i} className="stadium-pulse"><circle cx={x} cy={y} r="7" fill="#fb7185" opacity=".35" /><circle cx={x} cy={y} r="2.4" fill="#fecdd3" /></g>) : null}
    {level >= 10 ? Array.from({ length: 12 }, (_, i) => <rect key={i} x={(rnd(i + 61) * 2 - 1) * rx} y={-30 - rnd(i + 71) * 40} width="2.4" height="2.4" fill={["#f472b6", "#fde68a", "#7dd3fc", "#fff"][i % 4]} transform={`rotate(${rnd(i + 81) * 90} 0 0)`} opacity=".9" />) : null}
  </g>;
}

// ── Stadionet (tribune nivå 0–10): ei bar bane med benker, og så en rad med seter for hvert nivå, nye ringer, tak,
// lysmaster, videotavle og en inngangsfasade. Supporterfeltet fyller plassene.
const PITCH = { tl: [138, 222], tr: [262, 222], br: [292, 300], bl: [108, 300] } as const;

/** Rad `o` i tribunen som en åpen U rundt banen: fremre venstre, bakre venstre, bakre høyre, fremre høyre. */
function ring(o: number): [number, number][] {
  const dx = 5 * o + 7; const up = 4 * o + 4;
  return [[PITCH.bl[0] - dx, 306 - 1.5 * o], [PITCH.tl[0] - dx, PITCH.tl[1] - up], [PITCH.tr[0] + dx, PITCH.tr[1] - up], [PITCH.br[0] + dx, 306 - 1.5 * o]];
}
/** Øvre ring står litt høyere, med en gang mellom ringene. */
const rowOffset = (i: number) => i + (i >= 5 ? 0.6 : 0);

function Pitch() {
  const bands = 7;
  const edge = (t: number): [number, number] => [lerp(PITCH.tl[0], PITCH.bl[0], t), lerp(PITCH.tr[0], PITCH.br[0], t)];
  const y = (t: number) => lerp(PITCH.tl[1], PITCH.bl[1], t);
  return <g>
    {Array.from({ length: bands }, (_, i) => { const [a0, b0] = edge(i / bands); const [a1, b1] = edge((i + 1) / bands); return <polygon key={i} points={pts([[a0, y(i / bands)], [b0, y(i / bands)], [b1, y((i + 1) / bands)], [a1, y((i + 1) / bands)]])} fill={i % 2 ? "#2f9e44" : "#37b24d"} />; })}
    <polygon points={pts([[...PITCH.tl], [...PITCH.tr], [...PITCH.br], [...PITCH.bl]])} fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
    <line x1={edge(0.5)[0]} x2={edge(0.5)[1]} y1={y(0.5)} y2={y(0.5)} stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    <ellipse cx="200" cy={y(0.5)} rx="17" ry="8" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    <polygon points="170,222 230,222 236,238 164,238" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    <polygon points="164,284 236,284 242,300 158,300" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
    <path d="M186 222 v-5 h28 v5" fill="none" stroke="#fff" strokeWidth="1.3" /><path d="M184 300 v7 h32 v-7" fill="none" stroke="#fff" strokeWidth="1.3" />
    {([PITCH.tl, PITCH.tr, PITCH.br, PITCH.bl] as const).map(([x, y0], i) => <g key={i}><line x1={x} y1={y0} x2={x} y2={y0 - 8} stroke="#fff" strokeWidth="1" /><polygon points={`${x},${y0 - 8} ${x + (i % 3 === 0 ? -5 : 5)},${y0 - 6} ${x},${y0 - 4}`} fill="#f2c94c" /></g>)}
  </g>;
}

function Mast({ x, y, height, big, glow }: { x: number; y: number; height: number; big: boolean; glow: boolean }) {
  const top = y - height; const s = big ? 1.15 : 1;
  return <g>
    <line x1={x} y1={y} x2={x} y2={top} stroke="#8d99ae" strokeWidth={2.4 * s} />
    {glow ? <polygon points={`${x},${top} ${200 - (x < 200 ? 56 : -56)},262 ${200 + (x < 200 ? 56 : -56) * 0.2},288`} fill="#fff7c2" opacity=".09" /> : null}
    <g className={glow ? "stadium-pulse" : undefined}><circle cx={x} cy={top - 3} r={glow ? 16 : 10} fill="#fff7c2" opacity={glow ? 0.28 : 0.14} /></g>
    <rect x={x - 11 * s} y={top - 9 * s} width={22 * s} height={11 * s} rx="1.5" fill="#3a4658" stroke="#1f2937" strokeWidth=".8" />
    {[-6, 0, 6].flatMap((dx) => [0, 1].map((row) => <circle key={`${dx}${row}`} cx={x + dx * s} cy={top - 6.5 * s + row * 4.4 * s} r={1.6 * s} fill="#fff6c9" />))}
  </g>;
}

function Stadium({ level, fans }: { level: number; fans: number }) {
  const rows = Array.from({ length: level }, (_, i) => i);
  const outer = ring(level ? rowOffset(level - 1) + 0.6 : 0); const inner = ring(-0.2);
  const topRing = ring(level ? rowOffset(level - 1) : 0);
  const gap = Math.max(3.4, 11 - fans * 0.75);
  const facadeLeft = Math.min(101, topRing[0][0] - 4); const facadeW = 400 - facadeLeft * 2; const facadeH = 12 + level * 1.8;
  const arches = 2 + Math.floor(level / 2);
  return <g>
    {level >= 1 ? <ellipse cx="200" cy="268" rx={118 + level * 6} ry={74 + level * 3.2} fill="#243244" opacity=".7" stroke="#475569" strokeOpacity=".6" strokeWidth="1.5" /> : null}
    <Pitch />
    {/* Reklamebanner rundt banen, og på nivå 0 bare to benker. */}
    <polyline points={pts(ring(-0.6))} fill="none" stroke="#e63946" strokeWidth="2.2" strokeLinejoin="round" />
    <polyline points={pts(ring(-0.6))} fill="none" stroke="#fff" strokeWidth="1.2" strokeDasharray="6 8" strokeLinejoin="round" />
    {level < 2 ? <g><rect x="92" y="262" width="12" height="7" rx="1" fill="#475569" /><rect x="92" y="272" width="12" height="7" rx="1" fill="#475569" /><rect x="296" y="262" width="12" height="7" rx="1" fill="#475569" /></g> : null}

    {level >= 1 ? <g key={level} className="stadium-pop">
      <polygon points={pts([...outer, ...[...inner].reverse()])} fill="#16233a" stroke="#0b1424" strokeWidth="1" strokeLinejoin="round" />
      {rows.map((i) => <g key={i}>
        {i === 5 ? <polyline points={pts(ring(4.8))} fill="none" stroke="#9aa7b8" strokeWidth="3.2" strokeLinejoin="round" /> : null}
        <polyline points={pts(ring(rowOffset(i)))} fill="none" stroke={i < 5 ? (i % 2 ? "#33699f" : "#2b5b96") : (i % 2 ? "#a23550" : "#8f2f45")} strokeWidth="4.7" strokeLinejoin="round" />
        <polyline points={pts(ring(rowOffset(i)))} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`0 ${gap}`} strokeDashoffset={i * 1.7} />
        <polyline points={pts(ring(rowOffset(i)))} fill="none" stroke="#ff5a5f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`0 ${gap}`} strokeDashoffset={gap / 2 + i * 1.7} />
        {fans >= 6 ? <polyline points={pts(ring(rowOffset(i)))} fill="none" stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`0 ${gap * 2}`} strokeDashoffset={gap / 4 + i * 0.9} /> : null}
      </g>)}
      {/* Tak: bak tribunen fra nivå 6, hele veien rundt fra nivå 9, og en lysende LED-stripe på nivå 10. */}
      {level >= 6 ? (() => {
        const roof = ring(rowOffset(level - 1) + 0.2).map(([x, y]) => [x, y - 4] as [number, number]);
        const part = level >= 9 ? roof : [roof[1], roof[2]];
        return <g>
          <polyline points={pts(part)} fill="none" stroke="#5b6b82" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts(part)} fill="none" stroke="#e2e8f0" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
          {level >= 10 ? <polyline points={pts(part.map(([x, y]) => [x, y + 3.2] as [number, number]))} fill="none" stroke="#5cc8ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stadium-pulse" style={{ filter: "drop-shadow(0 0 3px #5cc8ff)" }} /> : null}
        </g>;
      })() : null}
      {level >= 8 ? <g transform={`translate(200 ${topRing[1][1] - 24})`}><rect x="-24" y="-9" width="48" height="18" rx="2" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.2" /><rect x="-20" y="-5" width="40" height="10" rx="1" fill="#0e7490" opacity=".8" /><rect x="-17" y="-2.5" width="14" height="2.4" fill="#a7f3d0" className="stadium-pulse" /><rect x="-1" y="-2.5" width="18" height="2.4" fill="#fde68a" className="stadium-pulse" /></g> : null}
      {/* Lysmaster: bak banen fra nivå 3, foran også fra nivå 6, og med lysstråler fra nivå 8. */}
      {level >= 3 ? <><Mast x={topRing[1][0] - 9} y={topRing[1][1] + 6} height={54} big={false} glow={level >= 8} /><Mast x={topRing[2][0] + 9} y={topRing[2][1] + 6} height={54} big={false} glow={level >= 8} /></> : null}
      {level >= 6 ? <><Mast x={topRing[0][0] - 9} y={topRing[0][1] + 8} height={68} big glow={level >= 8} /><Mast x={topRing[3][0] + 9} y={topRing[3][1] + 8} height={68} big glow={level >= 8} /></> : null}
      {/* Fasaden mot veien: lav mur med porter, glassbånd fra nivå 7 og en gullport på nivå 10. */}
      <g>
        <rect x={facadeLeft} y="314" width={facadeW} height={facadeH} rx="2" fill="#c8d0dc" stroke="#7b8798" strokeWidth=".9" />
        {level >= 2 ? <rect x={facadeLeft} y="314" width={facadeW} height="2.6" fill="#5cc8ff" /> : null}
        {level >= 7 ? <rect x={facadeLeft + 6} y="319" width={facadeW - 12} height="5" fill="#7dd3fc" opacity=".5" /> : null}
        {Array.from({ length: arches }, (_, i) => { const x = facadeLeft + (facadeW / (arches + 1)) * (i + 1); const center = i === (arches - 1) / 2; return <rect key={i} x={x - (center && level >= 10 ? 9 : 5)} y={314 + facadeH - facadeH * 0.55} width={center && level >= 10 ? 18 : 10} height={facadeH * 0.55} rx="4" fill="#1e293b" stroke={center && level >= 10 ? "#f2c94c" : "none"} strokeWidth="1.6" />; })}
        {level >= 10 ? <rect x={facadeLeft + 30} y={314 + facadeH + 1} width={facadeW - 60} height="2.4" rx="1" fill="#f2c94c" className="stadium-pulse" style={{ filter: "drop-shadow(0 0 3px #f2c94c)" }} /> : null}
      </g>
    </g> : null}
  </g>;
}

function Crane({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="-5" y="-3" width="10" height="3" rx="1" fill="#475569" />
    <line x1="0" y1="-3" x2="0" y2="-36" stroke="#facc15" strokeWidth="2.4" />
    <line x1="-14" y1="-36" x2="20" y2="-36" stroke="#facc15" strokeWidth="2" />
    <rect x="-16" y="-39" width="5" height="5" fill="#475569" /><rect x="-3" y="-41" width="6" height="5" rx="1" fill="#f59e0b" />
    <g className="stadium-sway"><line x1="14" y1="-36" x2="14" y2="-20" stroke="#e2e8f0" strokeWidth=".9" /><path d="M11 -20 h6 v3 a3 3 0 0 1 -6 0z" fill="#ef4444" /></g>
  </g>;
}

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}><ellipse cx="0" cy="0" rx="11" ry="3" fill="#000" opacity=".25" /><rect x="-1.6" y="-9" width="3.2" height="9" fill="#5b3a1e" /><circle cx="0" cy="-16" r="10" fill="#166534" /><circle cx="-3" cy="-19" r="6.5" fill="#22803f" /></g>;
}

function Art({ children, level, at }: { children: ReactNode; level: number; at: BuildingKey }) {
  const { x, y, h } = sceneSpots[at];
  // `key` på nivået starter en liten «pop» når bygningen vokser.
  return <g transform={`translate(${x} ${y + h / 2 - 10})`}><g key={level} className="stadium-pop">{children}</g></g>;
}

/** Hele scenen. `building` er bygningene som oppgraderes nå: de får en byggekran, men vises som før til de er ferdige. */
export function StadiumScene({ levels, building }: { levels: StadiumLevels; building: BuildingKey[] }) {
  return <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
    <defs>
      <pattern id="ss-stripes" width="56" height="10" patternUnits="userSpaceOnUse"><rect width="28" height="10" fill="#14532d" /><rect x="28" width="28" height="10" fill="#166534" /></pattern>
      <radialGradient id="ss-vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stopColor="#030a06" stopOpacity="0" /><stop offset="1" stopColor="#030a06" stopOpacity=".7" /></radialGradient>
    </defs>
    <rect width={SCENE_W} height={SCENE_H} fill="url(#ss-stripes)" />
    <polygon points="170,350 230,350 270,520 130,520" fill="#334155" /><line x1="200" y1="356" x2="200" y2="520" stroke="#fff" strokeOpacity=".5" strokeWidth="2.2" strokeDasharray="10 10" />
    <rect x="18" y="418" width="364" height="76" rx="30" fill="#475569" opacity=".4" />
    {[[22, 192, 1], [378, 196, 1], [24, 338, 1.1], [376, 344, 1.1], [20, 508, 1.2], [380, 510, 1.2], [96, 212, 0.8], [304, 214, 0.8]].map(([x, y, s]) => <Tree key={`${x}-${y}`} x={x} y={y} s={s} />)}

    <Art at="klubbhus" level={levels.klubbhus}><Clubhouse level={levels.klubbhus} /></Art>
    <Art at="kasse" level={levels.kasse}><CashRoom level={levels.kasse} /></Art>
    <Art at="speiderhytte" level={levels.speiderhytte}><ScoutHut level={levels.speiderhytte} /></Art>
    <g transform="translate(0 16)"><Stadium level={levels.tribune} fans={levels.supporterfelt} /></g>
    <Art at="billettluke" level={levels.billettluke}><TicketOffice level={levels.billettluke} /></Art>
    <Art at="supporterfelt" level={levels.supporterfelt}><SupporterZone level={levels.supporterfelt} /></Art>
    <Art at="treningsfelt" level={levels.treningsfelt}><TrainingGround level={levels.treningsfelt} /></Art>

    {building.map((key) => { const { x, y, w, h } = sceneSpots[key]; return <Crane key={key} x={x + w / 2 - 14} y={y - h / 2 + 52} />; })}
    <rect width={SCENE_W} height={SCENE_H} fill="url(#ss-vignette)" pointerEvents="none" />
  </svg>;
}
