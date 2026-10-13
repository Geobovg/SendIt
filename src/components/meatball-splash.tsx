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

const sky = seeded(77);
const skyline = (count: number, min: number, max: number) => {
  let x = -20;
  return Array.from({ length: count }, () => {
    const w = 26 + sky() * 46; const item = { x, w, h: min + sky() * (max - min) };
    x += w - 2 + sky() * 6; return item;
  });
};
const SKYLINE_FAR = skyline(34, 40, 150);
const SKYLINE_NEAR = skyline(28, 18, 96);
const WINDOWS = Array.from({ length: 120 }, () => ({ x: sky() * 1600, y: 190 + sky() * 100, o: 0.25 + sky() * 0.6 }));

/** Det regner kjøttboller over en by i tåke. Knappen nede til høyre går videre til spillet. */
export function MeatballSplash({ enterHref, enterLabel, title }: { enterHref: string; enterLabel: string; title: string }) {
  return (
    <div className="meatball-splash fixed inset-0 z-[100] overflow-hidden bg-[#1c2230]" style={{ backgroundImage: "url(/forside/himmel.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
      {/* Solgløden bak skyene */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 45% at 78% 72%, rgba(255,214,140,.55), rgba(255,160,70,.18) 55%, transparent 75%)" }} />

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

      {/* Skyline i tåke, og en mann i frakk som går rolig gjennom det hele */}
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[36vh] w-full" viewBox="0 0 1600 340" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="dis" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b5f66" stopOpacity="0.85" />
            <stop offset="1" stopColor="#2c2f3b" />
          </linearGradient>
          <linearGradient id="naer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b1e29" />
            <stop offset="1" stopColor="#07080c" />
          </linearGradient>
          <linearGradient id="vei" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1a22" />
            <stop offset="1" stopColor="#050509" />
          </linearGradient>
        </defs>
        <g fill="url(#dis)">{SKYLINE_FAR.map((b, i) => <rect key={i} x={b.x} y={286 - b.h} width={b.w} height={b.h + 40} />)}</g>
        <g fill="url(#naer)">{SKYLINE_NEAR.map((b, i) => <rect key={i} x={b.x} y={296 - b.h} width={b.w} height={b.h + 40} />)}</g>
        <g fill="#ffcf85">{WINDOWS.map((w, i) => <rect key={i} x={w.x} y={w.y} width="3" height="4" opacity={w.o} />)}</g>
        <rect y="296" width="1600" height="60" fill="url(#vei)" />
        <rect y="296" width="1600" height="3" fill="#ff9a4a" opacity="0.28" />

        {/* Mannen med paraply og dokumentmappe */}
        <g transform="translate(470 318) scale(1.5)" fill="#050509">
          <rect x="-9" y="-48" width="8" height="48" />
          <rect x="1" y="-48" width="8" height="48" />
          <path d="M-15 -46 L-13 -90 Q0 -98 13 -90 L15 -46 Z" />
          <circle cx="0" cy="-102" r="8.5" />
          <path d="M-13 -86 L-20 -58 L-16 -56 L-9 -80 Z" />
          <rect x="-26" y="-58" width="14" height="11" rx="1.5" />
          <path d="M12 -86 L24 -104 L27 -101 L16 -80 Z" />
          <rect x="24" y="-134" width="2.4" height="32" />
          <path d="M-34 -132 Q 25 -168 84 -132 Q 50 -140 25 -138 Q 0 -140 -34 -132 Z" />
        </g>
        <path d="M486 296 L492 290 L498 296 Z" fill="#ff9a4a" opacity="0" />
      </svg>

      {/* Tittelen */}
      <div className="pointer-events-none relative flex h-full flex-col items-center px-4 pt-[34vh] text-center">
        <h1 className={`${display.className} meatball-title text-[clamp(3.2rem,11.5vw,10rem)] uppercase leading-[0.94]`}>{title}</h1>
      </div>

      {/* Filmkorn og vignett */}
      <div className="meatball-vignette pointer-events-none absolute inset-0" />
      <div className="meatball-grain pointer-events-none absolute inset-0" />

      {/* Nyhetsstripe og knapp */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse items-end gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="flex w-full items-stretch sm:w-auto sm:max-w-[min(66vw,780px)] overflow-hidden rounded-sm text-xs shadow-[0_6px_24px_rgba(0,0,0,.55)] sm:text-sm">
          <span className={`${display.className} shrink-0 bg-[#c4161c] px-3 py-2 uppercase tracking-widest text-white`}>Siste nytt</span>
          <div className="meatball-ticker min-w-0 flex-1 overflow-hidden bg-[#0c0e14]/90 px-3 py-2 text-white/90">
            <div className="meatball-ticker-track whitespace-nowrap">
              Kjøttbollene har falt uavbrutt siden tirsdag · Myndighetene anbefaler å holde seg innendørs · Ordføreren: «Vi hadde ikke planlagt dette» · Forsker: «Det er ikke min avdeling» · Paraplyer utsolgt, parmesan på vei · Mannen i frakken har ikke kommentert saken &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              Kjøttbollene har falt uavbrutt siden tirsdag · Myndighetene anbefaler å holde seg innendørs · Ordføreren: «Vi hadde ikke planlagt dette» · Forsker: «Det er ikke min avdeling» · Paraplyer utsolgt, parmesan på vei · Mannen i frakken har ikke kommentert saken
            </div>
          </div>
        </div>
        <Link href={enterHref} className={`${display.className} shrink-0 rounded-sm border border-white/60 bg-black/55 px-6 py-3 text-xl uppercase tracking-[0.12em] text-white shadow-[0_8px_26px_rgba(0,0,0,.6)] backdrop-blur-sm transition hover:bg-white hover:text-black active:scale-95 sm:text-2xl`}>
          {enterLabel} →
        </Link>
      </div>
    </div>
  );
}
