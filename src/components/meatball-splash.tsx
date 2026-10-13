import Link from "next/link";
import { Luckiest_Guy } from "next/font/google";

const display = Luckiest_Guy({ weight: "400", subsets: ["latin"] });

// Faste «tilfeldige» tall, så bildet er likt hver gang og serveren slipper å regne noe nytt.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const random = seeded(42);
const meatballs = Array.from({ length: 46 }, (_, index) => ({
  x: 20 + random() * 1560,
  r: 10 + random() * 26,
  delay: -random() * 9,
  duration: 4.5 + random() * 4,
  sauce: index % 3 !== 0,
  leaf: index % 5 === 0,
}));
const noodles = Array.from({ length: 9 }, () => ({ x: 60 + random() * 1480, delay: -random() * 9, duration: 6 + random() * 4, flip: random() > 0.5 }));
const ground = Array.from({ length: 22 }, () => ({ x: random() * 1600, y: 800 + random() * 70, r: 14 + random() * 22 }));

function Meatball({ r, sauce, leaf }: { r: number; sauce: boolean; leaf: boolean }) {
  return (
    <g>
      <circle r={r} fill="url(#meatball)" />
      <circle cx={-r * 0.35} cy={-r * 0.1} r={r * 0.12} fill="#3a1a0b" opacity="0.55" />
      <circle cx={r * 0.25} cy={r * 0.35} r={r * 0.1} fill="#3a1a0b" opacity="0.5" />
      <circle cx={r * 0.4} cy={-r * 0.05} r={r * 0.08} fill="#3a1a0b" opacity="0.45" />
      {sauce ? <path d={`M${-r * 0.85} ${-r * 0.35} C ${-r * 0.6} ${-r * 1.15}, ${r * 0.6} ${-r * 1.15}, ${r * 0.85} ${-r * 0.35} C ${r * 0.55} ${-r * 0.2}, ${r * 0.45} ${r * 0.05}, ${r * 0.25} ${-r * 0.2} C ${0} ${r * 0.1}, ${-r * 0.2} ${-r * 0.25}, ${-r * 0.4} ${-r * 0.05} C ${-r * 0.55} ${-r * 0.3}, ${-r * 0.7} ${-r * 0.2}, ${-r * 0.85} ${-r * 0.35} Z`} fill="url(#sauce)" /> : null}
      {leaf ? <ellipse cx={r * 0.1} cy={-r * 0.75} rx={r * 0.32} ry={r * 0.14} transform={`rotate(-25 ${r * 0.1} ${-r * 0.75})`} fill="#3fa34d" /> : null}
      <ellipse cx={-r * 0.35} cy={-r * 0.5} rx={r * 0.22} ry={r * 0.12} fill="#fff" opacity="0.35" />
    </g>
  );
}

/** Forsiden: det regner kjøttboller, med en matmaskin i skyene. Knappen nede til høyre går videre til spillet. */
export function MeatballSplash({ enterHref, enterLabel, title }: { enterHref: string; enterLabel: string; title: string }) {
  return (
    <div className="meatball-splash fixed inset-0 z-[100] overflow-hidden bg-[#7cc6ff]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4fa9f0" />
            <stop offset="0.45" stopColor="#9fd6ff" />
            <stop offset="0.75" stopColor="#ffd98c" />
            <stop offset="1" stopColor="#ff9d5c" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6c9" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff6c9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="meatball" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#b8703f" />
            <stop offset="0.55" stopColor="#7d3f1c" />
            <stop offset="1" stopColor="#3f1c0a" />
          </radialGradient>
          <linearGradient id="sauce" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff4b2b" />
            <stop offset="1" stopColor="#b8160b" />
          </linearGradient>
          <linearGradient id="cloud" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#c9d8ea" />
          </linearGradient>
          <linearGradient id="storm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a97ad" />
            <stop offset="1" stopColor="#5d6a82" />
          </linearGradient>
          <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f7fb" />
            <stop offset="0.45" stopColor="#aab6c6" />
            <stop offset="1" stopColor="#5b6577" />
          </linearGradient>
          <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6fcf5b" />
            <stop offset="1" stopColor="#2f8a3a" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3aa0d8" />
            <stop offset="1" stopColor="#1d5f9a" />
          </linearGradient>
        </defs>

        <rect width="1600" height="900" fill="url(#sky)" />
        <circle cx="1280" cy="560" r="300" fill="url(#glow)" />

        {/* Sjøen og øya nederst */}
        <rect y="760" width="1600" height="140" fill="url(#sea)" />
        <path d="M0 800 C 220 700, 420 720, 620 770 C 820 690, 1080 700, 1260 760 C 1400 720, 1520 730, 1600 760 L1600 900 L0 900 Z" fill="url(#hill)" />

        {/* Små hus */}
        {[{ x: 260, c: "#ff7a59" }, { x: 330, c: "#ffd166" }, { x: 1120, c: "#5ec8f2" }, { x: 1190, c: "#ff9ec7" }, { x: 1260, c: "#ffd166" }].map((house) => (
          <g key={house.x} transform={`translate(${house.x} 742)`}>
            <rect width="54" height="42" fill={house.c} stroke="#2b1a10" strokeWidth="3" />
            <path d="M-6 2 L27 -26 L60 2 Z" fill="#c2412b" stroke="#2b1a10" strokeWidth="3" strokeLinejoin="round" />
            <rect x="20" y="20" width="14" height="22" fill="#2b1a10" />
          </g>
        ))}

        {/* Folk med paraply */}
        {[{ x: 520, c: "#ff3b6b" }, { x: 600, c: "#ffd400" }, { x: 900, c: "#3bd16f" }, { x: 980, c: "#7b5cff" }].map((person) => (
          <g key={person.x} transform={`translate(${person.x} 770)`}>
            <path d="M-34 0 A34 26 0 0 1 34 0 Z" fill={person.c} stroke="#2b1a10" strokeWidth="3" />
            <line x1="0" y1="0" x2="0" y2="34" stroke="#2b1a10" strokeWidth="3" />
            <circle cx="0" cy="40" r="7" fill="#f2c39b" stroke="#2b1a10" strokeWidth="2" />
            <path d="M-9 48 L9 48 L7 74 L-7 74 Z" fill="#2b1a10" />
          </g>
        ))}

        {/* Kjøttboller og spagetti som allerede har landet */}
        <path d="M700 812 C 740 760, 820 760, 860 812 Z" fill="#f7d26a" stroke="#c99a2e" strokeWidth="3" />
        <path d="M712 800 C 740 784, 760 806, 784 790 C 806 806, 828 782, 848 800" fill="none" stroke="#e8b84a" strokeWidth="4" />
        <path d="M740 778 C 760 760, 800 760, 820 778 C 800 790, 760 790, 740 778 Z" fill="url(#sauce)" />
        {ground.map((ball, index) => (
          <g key={index} transform={`translate(${ball.x} ${ball.y})`}>
            <Meatball r={ball.r} sauce={index % 2 === 0} leaf={false} />
          </g>
        ))}

        {/* Uværsskyene øverst */}
        <g fill="url(#storm)">
          <ellipse cx="160" cy="40" rx="260" ry="110" />
          <ellipse cx="520" cy="10" rx="300" ry="120" />
          <ellipse cx="900" cy="30" rx="320" ry="120" />
          <ellipse cx="1300" cy="20" rx="320" ry="130" />
          <ellipse cx="1560" cy="60" rx="200" ry="110" />
        </g>
        <g fill="url(#cloud)">
          <ellipse cx="260" cy="120" rx="170" ry="60" />
          <ellipse cx="640" cy="110" rx="200" ry="62" />
          <ellipse cx="1060" cy="128" rx="210" ry="64" />
          <ellipse cx="1440" cy="118" rx="180" ry="60" />
        </g>

        {/* Spagetti i lufta */}
        {noodles.map((noodle, index) => (
          <g key={index} className="meatball-fall" style={{ animationDelay: `${noodle.delay}s`, animationDuration: `${noodle.duration}s` }}>
            <path transform={`translate(${noodle.x} 0) scale(${noodle.flip ? -1 : 1} 1)`} d="M0 0 C 18 18, -18 36, 0 54 C 18 72, -18 90, 0 108" fill="none" stroke="#f3c94f" strokeWidth="6" strokeLinecap="round" />
          </g>
        ))}

        {/* Kjøttbollene som faller */}
        {meatballs.map((ball, index) => (
          <g key={index} className="meatball-fall" style={{ animationDelay: `${ball.delay}s`, animationDuration: `${ball.duration}s` }}>
            <g transform={`translate(${ball.x} 0)`}>
              <line x1="0" y1={-ball.r * 1.2} x2="0" y2={-ball.r * 3.4} stroke="#ffffff" strokeOpacity="0.55" strokeWidth={ball.r * 0.25} strokeLinecap="round" />
              <Meatball r={ball.r} sauce={ball.sauce} leaf={ball.leaf} />
            </g>
          </g>
        ))}

        {/* Matmaskinen i skyene */}
        <g className="meatball-machine">
          <g transform="translate(800 165)">
            {/* Tuten under maskinen, som spruter ut kjøttboller */}
            <path d="M-30 64 L30 64 L44 118 L-44 118 Z" fill="#5b6577" stroke="#2b1a10" strokeWidth="4" strokeLinejoin="round" />
            <ellipse cx="0" cy="120" rx="46" ry="12" fill="#2b1a10" />
            <path d="M-40 126 L-150 230 M0 128 L0 250 M40 126 L150 230" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="10" strokeLinecap="round" />
            <g transform="translate(-118 196)"><Meatball r={18} sauce leaf={false} /></g>
            <g transform="translate(0 214)"><Meatball r={22} sauce leaf /></g>
            <g transform="translate(118 196)"><Meatball r={18} sauce={false} leaf={false} /></g>
            {/* Rør på siden og en trykkmåler */}
            <path d="M-128 30 C -170 30, -170 -30, -140 -46" fill="none" stroke="#2b1a10" strokeWidth="14" strokeLinecap="round" />
            <path d="M-128 30 C -170 30, -170 -30, -140 -46" fill="none" stroke="#c9d3df" strokeWidth="8" strokeLinecap="round" />
            <path d="M128 30 C 170 30, 170 -30, 140 -46" fill="none" stroke="#2b1a10" strokeWidth="14" strokeLinecap="round" />
            <path d="M128 30 C 170 30, 170 -30, 140 -46" fill="none" stroke="#c9d3df" strokeWidth="8" strokeLinecap="round" />
            <ellipse cx="0" cy="40" rx="150" ry="34" fill="url(#chrome)" stroke="#2b1a10" strokeWidth="5" />
            <path d="M-110 40 C -110 -60, 110 -60, 110 40 Z" fill="url(#chrome)" stroke="#2b1a10" strokeWidth="5" />
            <path d="M-62 4 C -62 -50, 62 -50, 62 4 Z" fill="#9fe7ff" stroke="#2b1a10" strokeWidth="4" opacity="0.9" />
            <ellipse cx="-24" cy="-22" rx="16" ry="8" fill="#ffffff" opacity="0.7" />
            <circle cx="0" cy="-14" r="20" fill="#fff8e1" stroke="#2b1a10" strokeWidth="4" />
            <path d="M0 -14 L12 -26" stroke="#ff4b2b" strokeWidth="4" strokeLinecap="round" />
            <circle cx="0" cy="-14" r="3" fill="#2b1a10" />
            {[-120, -60, 0, 60, 120].map((x) => <circle key={x} cx={x} cy="44" r="8" fill={x === 0 ? "#ff4b2b" : "#ffd400"} stroke="#2b1a10" strokeWidth="3" className="meatball-blink" style={{ animationDelay: `${(x + 120) / 200}s` }} />)}
            <line x1="-60" y1="-34" x2="-90" y2="-86" stroke="#2b1a10" strokeWidth="4" />
            <circle cx="-90" cy="-90" r="9" fill="#ff4b2b" stroke="#2b1a10" strokeWidth="3" />
            <line x1="60" y1="-34" x2="92" y2="-80" stroke="#2b1a10" strokeWidth="4" />
            <circle cx="92" cy="-84" r="9" fill="#3bd16f" stroke="#2b1a10" strokeWidth="3" />
            <path d="M-150 40 L-196 26 L-196 56 Z" fill="#5b6577" stroke="#2b1a10" strokeWidth="4" strokeLinejoin="round" />
            <path d="M150 40 L196 26 L196 56 Z" fill="#5b6577" stroke="#2b1a10" strokeWidth="4" strokeLinejoin="round" />
          </g>
        </g>
      </svg>

      <div className="relative flex h-full flex-col items-center px-4 pt-[34vh] text-center sm:pt-[40vh]">
        <h1 className={`${display.className} meatball-title text-[clamp(3rem,11vw,9.5rem)] leading-[0.95] text-[#ffe066]`}>{title}</h1>
      </div>

      <Link href={enterHref} className={`${display.className} absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 rounded-full border-4 border-[#2b1a10] bg-[#ff4b2b] px-7 py-4 text-2xl tracking-wide text-white shadow-[0_6px_0_#2b1a10] transition hover:-translate-y-0.5 hover:bg-[#ff6a4d] active:translate-y-1 active:shadow-[0_2px_0_#2b1a10] sm:text-3xl`}>
        {enterLabel} →
      </Link>
    </div>
  );
}
