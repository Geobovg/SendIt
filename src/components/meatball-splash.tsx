import Image from "next/image";
import Link from "next/link";
import { Anton } from "next/font/google";
import type { CSSProperties } from "react";

const display = Anton({ weight: "400", subsets: ["latin"] });

// Faste «tilfeldige» tall, så bildet er likt hver gang og serveren slipper å regne noe nytt.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

type Faller = { src: string; w: number; h: number; x: number; size: number; delay: number; duration: number; rot: number; drift: number; blur: number; y: number };

const random = seeded(2026);
const BALLS = ["ball0", "ball1", "ball2", "ball3", "ball4", "ball5"];

// Kjøttboller i tre dybder: små langt unna, mellomstore, og noen få store og uskarpe helt foran kamera.
const fallers: Faller[] = [
  ...Array.from({ length: 34 }, (_, index): Faller => {
    const depth = index % 6 === 0 ? 2 : index % 3 === 0 ? 1 : 0;
    const size = [34, 66, 150][depth] + random() * [18, 26, 60][depth];
    return { src: `/forside/${BALLS[index % BALLS.length]}.webp`, w: 260, h: 260, x: random() * 100, size, delay: -random() * 12, duration: [11, 7.5, 5][depth] + random() * 3, rot: (random() - 0.5) * 900, drift: (random() - 0.5) * 8, blur: [0, 0, 5][depth], y: random() * 90 };
  }),
  { src: "/forside/burger.webp", w: 560, h: 373, x: 14, size: 210, delay: -3, duration: 9, rot: -140, drift: 4, blur: 0, y: 28 },
  { src: "/forside/burger.webp", w: 560, h: 373, x: 74, size: 130, delay: -8, duration: 12, rot: 200, drift: -5, blur: 1, y: 60 },
  { src: "/forside/pancakes.webp", w: 460, h: 352, x: 46, size: 170, delay: -1, duration: 10.5, rot: 160, drift: 6, blur: 0, y: 12 },
  { src: "/forside/pancakes.webp", w: 460, h: 352, x: 88, size: 250, delay: -6, duration: 6.5, rot: -120, drift: -4, blur: 6, y: 48 },
];

/** Det regner kjøttboller over en fjord. Knappen nede til høyre går videre til spillet. */
export function MeatballSplash({ enterHref, enterLabel, title }: { enterHref: string; enterLabel: string; title: string }) {
  return (
    <div className="meatball-splash fixed inset-0 z-[100] overflow-hidden bg-[#1c2230]" style={{ backgroundImage: "url(/forside/himmel.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
      {/* Solgløden bak skyene */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 45% at 78% 72%, rgba(255,214,140,.55), rgba(255,160,70,.18) 55%, transparent 75%)" }} />

      {/* Matmaskinen, langt oppe i uværet */}
      <svg className="meatball-machine absolute left-1/2 top-[3vh] w-[min(46vw,560px)] -translate-x-1/2 opacity-95 drop-shadow-[0_18px_30px_rgba(0,0,0,.45)]" viewBox="0 0 560 230" aria-hidden="true">
        <defs>
          <linearGradient id="mm-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9eef4" />
            <stop offset="0.35" stopColor="#9aa6b5" />
            <stop offset="0.7" stopColor="#5b6575" />
            <stop offset="1" stopColor="#2c333f" />
          </linearGradient>
          <radialGradient id="mm-glass" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#d8f1ff" />
            <stop offset="0.6" stopColor="#6a9cc4" />
            <stop offset="1" stopColor="#25405c" />
          </radialGradient>
        </defs>
        <ellipse cx="280" cy="120" rx="260" ry="50" fill="url(#mm-metal)" stroke="#161a21" strokeWidth="3" />
        <path d="M130 110 C 140 20, 420 20, 430 110 Z" fill="url(#mm-metal)" stroke="#161a21" strokeWidth="3" />
        <path d="M190 100 C 200 48, 360 48, 370 100 Z" fill="url(#mm-glass)" stroke="#161a21" strokeWidth="3" />
        <ellipse cx="240" cy="70" rx="22" ry="9" fill="#fff" opacity="0.55" />
        <path d="M232 160 L328 160 L350 214 L210 214 Z" fill="url(#mm-metal)" stroke="#161a21" strokeWidth="3" />
        <ellipse cx="280" cy="216" rx="70" ry="12" fill="#10131a" />
        {[70, 140, 210, 280, 350, 420, 490].map((x, index) => <circle key={x} cx={x} cy={122 + Math.abs(index - 3) * -1 + 8} r="7" fill={index % 2 ? "#ffd27a" : "#ff6a4d"} className="meatball-blink" style={{ animationDelay: `${index * 0.17}s` }} />)}
        <rect x="205" y="132" width="150" height="22" rx="3" fill="#10131a" opacity="0.85" />
        <text x="280" y="148" textAnchor="middle" fontSize="14" fontWeight="700" letterSpacing="1.5" fill="#f4e3a1" fontFamily="Arial Black, Impact, sans-serif">MATSPRUTOMATEN 3000</text>
        <path d="M120 96 C 70 90, 60 40, 96 22" fill="none" stroke="#10131a" strokeWidth="11" strokeLinecap="round" />
        <path d="M120 96 C 70 90, 60 40, 96 22" fill="none" stroke="#aab4c2" strokeWidth="6" strokeLinecap="round" />
        <path d="M440 96 C 490 90, 500 40, 464 22" fill="none" stroke="#10131a" strokeWidth="11" strokeLinecap="round" />
        <path d="M440 96 C 490 90, 500 40, 464 22" fill="none" stroke="#aab4c2" strokeWidth="6" strokeLinecap="round" />
      </svg>

      {/* Kua som aldri fikk beskjed */}
      <svg className="meatball-cow absolute left-[7%] top-[13vh] w-[clamp(110px,15vw,210px)]" viewBox="0 0 220 230" aria-hidden="true">
        <path d="M18 78 C 40 -6, 180 -6, 202 78 Z" fill="#f4efe2" stroke="#2b2620" strokeWidth="3" />
        <path d="M18 78 C 40 38, 66 36, 76 78 Z M76 78 C 84 14, 136 14, 144 78 Z" fill="#d14a3a" opacity="0.85" />
        <path d="M18 78 L96 168 M202 78 L124 168 M110 78 L110 168" stroke="#2b2620" strokeWidth="2" opacity="0.7" />
        <g transform="translate(66 164)">
          <ellipse cx="44" cy="30" rx="48" ry="26" fill="#f6f3ec" stroke="#2b2620" strokeWidth="3" />
          <path d="M20 22 C 30 10, 44 14, 46 26 C 40 38, 26 38, 20 22 Z M58 38 C 68 28, 80 34, 82 44 C 74 52, 62 50, 58 38 Z" fill="#2b2620" />
          <ellipse cx="94" cy="28" rx="19" ry="17" fill="#f6f3ec" stroke="#2b2620" strokeWidth="3" />
          <path d="M82 14 L88 0 M106 14 L100 0" stroke="#2b2620" strokeWidth="4" strokeLinecap="round" />
          <circle cx="98" cy="25" r="3" fill="#2b2620" />
          <ellipse cx="102" cy="36" rx="8" ry="5" fill="#f1b8b8" stroke="#2b2620" strokeWidth="2" />
          <path d="M20 50 L18 70 M36 54 L36 72 M62 54 L62 72 M78 50 L80 70" stroke="#2b2620" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>

      {/* Alt som faller */}
      {fallers.map((item, index) => (
        <div
          key={index}
          className="meatball-fall absolute top-0"
          style={{ left: `${item.x}%`, width: item.size, "--drift": `${item.drift}vw`, "--rot": `${item.rot}deg`, "--y": `${item.y}vh`, animationDelay: `${item.delay}s`, animationDuration: `${item.duration}s`, filter: `${item.blur ? `blur(${item.blur}px) ` : ""}drop-shadow(0 ${Math.max(2, item.size / 14)}px ${Math.max(3, item.size / 9)}px rgba(0,0,0,.45))` } as CSSProperties}
        >
          <Image src={item.src} alt="" width={item.w} height={item.h} priority={index < 6} draggable={false} className="h-auto w-full select-none" />
        </div>
      ))}

      {/* Landskapet nederst, i silhuett mot solnedgangen */}
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] w-full" viewBox="0 0 1600 340" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="fj" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2a65a" />
            <stop offset="1" stopColor="#33405a" />
          </linearGradient>
          <linearGradient id="berg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b3f52" />
            <stop offset="1" stopColor="#14161f" />
          </linearGradient>
          <linearGradient id="coat" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8e98a8" />
            <stop offset="0.55" stopColor="#f2f5f8" />
            <stop offset="1" stopColor="#ffd9a3" />
          </linearGradient>
        </defs>
        <path d="M0 170 L220 120 L380 168 L560 100 L760 176 L980 130 L1180 170 L1400 112 L1600 160 L1600 340 L0 340 Z" fill="#454a60" opacity="0.7" />
        <rect y="206" width="1600" height="134" fill="url(#fj)" />
        <path d="M0 250 C 200 200, 360 214, 560 244 C 760 214, 980 206, 1180 240 C 1360 214, 1500 220, 1600 244 L1600 340 L0 340 Z" fill="url(#berg)" />
        {/* Småhus */}
        {[{ x: 1010, c: "#8a3b30" }, { x: 1074, c: "#c59a3c" }, { x: 1138, c: "#8a3b30" }, { x: 1202, c: "#a9b4c4" }].map((house) => (
          <g key={house.x} transform={`translate(${house.x} 214)`}>
            <rect width="46" height="34" fill={house.c} />
            <path d="M-5 2 L23 -20 L51 2 Z" fill="#1b1d27" />
            <rect x="17" y="14" width="12" height="20" fill="#ffe3a6" opacity="0.9" />
          </g>
        ))}
        <path d="M0 292 C 220 262, 420 270, 640 292 C 860 270, 1180 262, 1600 290 L1600 340 L0 340 Z" fill="#0d0f15" />

        {/* Oppfinneren, lyst lysende i laboratoriefrakk, med paraply full av spagetti */}
        <g transform="translate(300 108) scale(0.62)">
          <path d="M-60 118 C -50 52, 62 52, 72 118 Z" fill="#14161f" opacity="0.0" />
          <path d="M34 12 L112 -64" stroke="#14161f" strokeWidth="5" strokeLinecap="round" />
          <path d="M60 -46 C 70 -130, 220 -130, 232 -46 Z" fill="#c1392b" stroke="#14161f" strokeWidth="3" />
          <path d="M96 -48 C 100 -100, 140 -108, 146 -48 M146 -48 C 152 -108, 190 -100, 196 -48" fill="none" stroke="#7d1f16" strokeWidth="3" />
          <path d="M90 -92 C 100 -110, 110 -88, 122 -104 C 132 -118, 140 -96, 152 -110" fill="none" stroke="#f1d27a" strokeWidth="5" strokeLinecap="round" />
          <path d="M156 -112 C 164 -124, 170 -104, 182 -116 C 192 -126, 198 -108, 208 -118" fill="none" stroke="#f1d27a" strokeWidth="5" strokeLinecap="round" />
          <circle cx="132" cy="-122" r="12" fill="#6f3517" />
          <circle cx="188" cy="-124" r="10" fill="#6f3517" />
          <path d="M-18 40 C -30 120, -34 190, -28 214 L 46 214 C 52 190, 46 120, 38 40 Z" fill="url(#coat)" stroke="#14161f" strokeWidth="2.5" />
          <path d="M8 40 L10 214" stroke="#9aa4b4" strokeWidth="2" />
          <rect x="-4" y="214" width="16" height="48" fill="#14161f" />
          <rect x="22" y="214" width="16" height="48" fill="#14161f" />
          <path d="M-18 46 C -40 70, -52 100, -58 128" fill="none" stroke="url(#coat)" strokeWidth="16" strokeLinecap="round" />
          <circle cx="-58" cy="132" r="9" fill="#e7b896" />
          <circle cx="10" cy="12" r="26" fill="#e7b896" stroke="#14161f" strokeWidth="2.5" />
          <path d="M-18 8 C -26 -22, -2 -34, 8 -28 C 14 -42, 38 -34, 38 -12 C 44 -10, 40 6, 36 8 C 30 -8, 8 -14, -18 8 Z" fill="#2a1a10" />
          <rect x="-10" y="6" width="42" height="15" rx="7" fill="#1b2230" stroke="#9fb4cc" strokeWidth="2" />
          <ellipse cx="2" cy="13" rx="9" ry="5" fill="#cfeaff" opacity="0.9" />
          <ellipse cx="22" cy="13" rx="9" ry="5" fill="#cfeaff" opacity="0.9" />
          <path d="M0 32 C 8 38, 14 38, 20 32" fill="none" stroke="#14161f" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Skilt */}
        <g transform="translate(700 252)">
          <rect x="-3" y="0" width="6" height="40" fill="#2a1d12" />
          <rect x="-90" y="-44" width="180" height="44" rx="3" fill="#e9dcc2" stroke="#2a1d12" strokeWidth="3" />
          <text x="0" y="-26" textAnchor="middle" fontSize="12" fontWeight="700" fill="#7a1d14" fontFamily="Arial Black, Impact, sans-serif">IKKE TRYKK PÅ</text>
          <text x="0" y="-9" textAnchor="middle" fontSize="12" fontWeight="700" fill="#7a1d14" fontFamily="Arial Black, Impact, sans-serif">DEN RØDE KNAPPEN</text>
        </g>
      </svg>

      {/* Tittelen */}
      <div className="pointer-events-none relative flex h-full flex-col items-center px-4 pt-[38vh] text-center">
        <h1 className={`${display.className} meatball-title -rotate-2 text-[clamp(3.4rem,12.5vw,11rem)] uppercase leading-[0.92] tracking-wide`}>{title}</h1>
      </div>

      {/* Værmelding og knapp */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="meatball-ticker max-w-[min(62vw,720px)] overflow-hidden rounded-md border border-white/25 bg-black/60 px-3 py-2 text-xs text-white backdrop-blur-sm sm:text-sm">
          <div className="meatball-ticker-track whitespace-nowrap">
            <span className="font-bold text-amber-300">VÆRMELDING:</span> 100 % sjanse for kjøttboller · lokale byger av parmesan · spagettitåke langs kysten · vind fra kjøkkenet · en ku rapportert i fallskjerm · ingen grunn til panikk, men ta med paraply &nbsp;&nbsp;&nbsp;&nbsp;
            <span className="font-bold text-amber-300">VÆRMELDING:</span> 100 % sjanse for kjøttboller · lokale byger av parmesan · spagettitåke langs kysten · vind fra kjøkkenet · en ku rapportert i fallskjerm · ingen grunn til panikk, men ta med paraply
          </div>
        </div>
        <Link href={enterHref} className={`${display.className} meatball-enter shrink-0 rounded-full border-2 border-white/80 bg-[#d6361e] px-7 py-3 text-2xl uppercase tracking-wide text-white shadow-[0_8px_26px_rgba(0,0,0,.55)] transition hover:bg-[#ef4a30] active:scale-95 sm:text-3xl`}>
          {enterLabel} →
        </Link>
      </div>
    </div>
  );
}
