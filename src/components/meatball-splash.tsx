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
  // Pannekaker i alle størrelser
  ...[[46, 170, -1, 10.5, 160, 6, 0, 12], [88, 250, -6, 6.5, -120, -4, 6, 48], [8, 120, -4, 9, 220, 3, 0, 70], [30, 90, -9, 12, -260, -2, 0, 20], [62, 200, -2, 7.5, 140, 5, 2, 56], [80, 110, -7, 10, -180, -6, 0, 8], [22, 280, -5, 5.8, 100, 4, 7, 36], [54, 140, -10, 9.5, -210, 2, 0, 64]].map(([x, size, delay, duration, rot, drift, blur, y]): Faller => ({ src: "/forside/pancakes.webp", w: 460, h: 352, x, size, delay, duration, rot, drift, blur, y })),
  // Spagetti, med og uten saus
  ...[[0, 18, 130, -2, 9, 120, 4, 0, 18], [1, 70, 100, -6, 11, -150, -3, 0, 44], [2, 38, 170, -4, 8, 200, 5, 1, 66], [3, 84, 220, -8, 6.2, -90, -4, 5, 30], [0, 52, 80, -1, 12, 260, 2, 0, 80], [2, 4, 110, -9, 10.5, -170, 3, 0, 52], [1, 94, 150, -5, 8.5, 110, -5, 2, 10]].map(([n, x, size, delay, duration, rot, drift, blur, y]): Faller => ({ src: `/forside/spag${n}.webp`, w: 300, h: 300, x, size, delay, duration, rot, drift, blur, y })),
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
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 45% at 78% 72%, rgba(255,228,160,.7), rgba(255,170,90,.28) 55%, transparent 78%)" }} />

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
            <stop offset="0" stopColor="#e7a58a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#8d6f9a" />
          </linearGradient>
          <linearGradient id="naer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a4a86" />
            <stop offset="1" stopColor="#2a2350" />
          </linearGradient>
          <linearGradient id="vei" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b3560" />
            <stop offset="1" stopColor="#1e1a3c" />
          </linearGradient>
        </defs>
        <g fill="url(#dis)">{SKYLINE_FAR.map((b, i) => <rect key={i} x={b.x} y={286 - b.h} width={b.w} height={b.h + 40} />)}</g>
        <g fill="url(#naer)">{SKYLINE_NEAR.map((b, i) => <rect key={i} x={b.x} y={296 - b.h} width={b.w} height={b.h + 40} />)}</g>
        <g fill="#ffcf85">{WINDOWS.map((w, i) => <rect key={i} x={w.x} y={w.y} width="3" height="4" opacity={w.o} />)}</g>
        <rect y="296" width="1600" height="60" fill="url(#vei)" />
        <rect y="296" width="1600" height="3" fill="#ffd08a" opacity="0.5" />

        {/* Lebrun Jamie og Mikkel Jorda koser seg med lapskaus */}
        <g transform="translate(1030 320) scale(1.32)">
          <path d="M32 -44 L35 -104 Q56 -113 77 -104 L80 -44 Z" fill="#1fa6a6" />
          <path d="M40 -104 Q56 -96 72 -104" fill="none" stroke="#fff" strokeWidth="3" />
          <text x="56" y="-70" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" fontFamily="Arial Black, Impact, sans-serif">7</text>
          <path d="M37 -100 L26 -68 L36 -52" fill="none" stroke="#e0b08c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M74 -100 L90 -84 L80 -102" fill="none" stroke="#e0b08c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M82 -104 L86 -112" stroke="#c9ccd2" strokeWidth="3" strokeLinecap="round" />
          <circle cx="56" cy="-122" r="12" fill="#e0b08c" />
          <path d="M44 -126 Q56 -140 68 -126 Q56 -131 44 -126 Z" fill="#2a2018" />
          <rect x="44" y="-128" width="24" height="4" fill="#fff" />
          <circle cx="52" cy="-120" r="1.6" fill="#2a2018" /><circle cx="61" cy="-120" r="1.6" fill="#2a2018" />
          <path d="M51 -114 Q56 -111 61 -114" fill="none" stroke="#7a4a30" strokeWidth="1.6" strokeLinecap="round" />
          <text x="56" y="-146" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" stroke="#3a1a10" strokeWidth="2.5" paintOrder="stroke" fontFamily="Arial Black, Impact, sans-serif">Lebrun Jamie</text>

          <path d="M118 -44 L121 -104 Q142 -113 163 -104 L166 -44 Z" fill="#f08a1c" />
          <path d="M126 -104 Q142 -96 158 -104" fill="none" stroke="#1d2b4f" strokeWidth="3" />
          <text x="142" y="-70" textAnchor="middle" fontSize="22" fontWeight="900" fill="#1d2b4f" fontFamily="Arial Black, Impact, sans-serif">9</text>
          <path d="M123 -100 L112 -68 L122 -52" fill="none" stroke="#e0b08c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M160 -100 L176 -84 L166 -102" fill="none" stroke="#e0b08c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M168 -104 L172 -112" stroke="#c9ccd2" strokeWidth="3" strokeLinecap="round" />
          <circle cx="142" cy="-122" r="12" fill="#e0b08c" />
          <path d="M130 -128 Q142 -140 154 -128 Q142 -133 130 -128 Z" fill="#2a2018" />
          <circle cx="138" cy="-120" r="1.6" fill="#2a2018" /><circle cx="147" cy="-120" r="1.6" fill="#2a2018" />
          <path d="M137 -114 Q142 -111 147 -114" fill="none" stroke="#7a4a30" strokeWidth="1.6" strokeLinecap="round" />
          <text x="142" y="-146" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" stroke="#3a1a10" strokeWidth="2.5" paintOrder="stroke" fontFamily="Arial Black, Impact, sans-serif">Mikkel Jorda</text>

          <rect x="-4" y="-44" width="204" height="7" rx="2" fill="#8a5a2b" />
          <rect x="8" y="-37" width="7" height="37" fill="#6b4220" />
          <rect x="185" y="-37" width="7" height="37" fill="#6b4220" />
          {[48, 134].map((x) => (
            <g key={x}>
              <path d={`M${x - 20} -48 Q${x} -26 ${x + 20} -48 Z`} fill="#f4f1ea" stroke="#9aa0aa" strokeWidth="1.5" />
              <ellipse cx={x} cy="-48" rx="20" ry="4" fill="#9a6a45" />
              <circle cx={x - 8} cy="-49" r="2.5" fill="#d9a066" />
              <circle cx={x + 3} cy="-50" r="2.5" fill="#6fa04a" />
              <circle cx={x + 10} cy="-48" r="2" fill="#e08a3c" />
              <path d={`M${x - 6} -56 Q${x - 10} -66 ${x - 4} -74 M${x + 6} -56 Q${x + 10} -66 ${x + 4} -74`} stroke="#fff" strokeOpacity="0.55" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Mannen i gul regnfrakk, med rød paraply og dokumentmappe */}
        <g transform="translate(700 318) scale(1.5)">
          <rect x="-9" y="-48" width="8" height="48" fill="#2a2f4a" />
          <rect x="1" y="-48" width="8" height="48" fill="#2a2f4a" />
          <path d="M-15 -46 L-13 -90 Q0 -98 13 -90 L15 -46 Z" fill="#f2b632" />
          <path d="M0 -94 L0 -46" stroke="#c98d17" strokeWidth="1.5" />
          <circle cx="0" cy="-102" r="8.5" fill="#e9b894" />
          <path d="M-8 -108 Q0 -116 8 -108 Q0 -111 -8 -108 Z" fill="#3a2a1a" />
          <path d="M-13 -86 L-20 -58 L-16 -56 L-9 -80 Z" fill="#f2b632" />
          <rect x="-26" y="-58" width="14" height="11" rx="1.5" fill="#7a4a24" />
          <path d="M12 -86 L24 -104 L27 -101 L16 -80 Z" fill="#f2b632" />
          <rect x="24" y="-134" width="2.4" height="32" fill="#2a2f4a" />
          <path d="M-34 -132 Q 25 -168 84 -132 Q 50 -140 25 -138 Q 0 -140 -34 -132 Z" fill="#d1352b" />
          <path d="M25 -150 L25 -138 M-6 -140 L8 -136 M56 -140 L42 -136" stroke="#8f1d17" strokeWidth="1.5" />
        </g>
        </svg>

      {/* Tittelen */}
      <div className="pointer-events-none relative flex h-full flex-col items-center px-4 pt-[34vh] text-center">
        <h1 className={`${display.className} meatball-title text-[clamp(3.2rem,11.5vw,10rem)] uppercase leading-[0.94]`}>{title}</h1>
        <p className="meatball-sub mt-5 max-w-[34rem] text-balance text-base font-semibold leading-snug sm:text-xl">Ikje gløm da graset e graunt au skjermen e blå. Da e viktig for deg å røra litt au</p>
      </div>

      {/* Filmkorn og vignett */}
      <div className="meatball-vignette pointer-events-none absolute inset-0" />
      <div className="meatball-grain pointer-events-none absolute inset-0" />

      {/* Nyhetsstripe og knapp */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse items-end gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="w-full overflow-hidden rounded-sm text-xs shadow-[0_6px_24px_rgba(40,20,60,.45)] sm:w-auto sm:max-w-[min(66vw,760px)] sm:text-sm">
          <div className={`${display.className} bg-[#c4161c] px-3 py-1 text-sm uppercase tracking-widest text-white`}>Siste nytt</div>
          <ul className="grid gap-0.5 bg-[#1d1838]/90 px-3 py-2 leading-snug text-white">
            <li>Kjøttbollene har falt uavbrutt siden tirsdag.</li>
            <li>Myndighetene anbefaler å holde seg innendørs.</li>
            <li>Ordføreren: «Vi hadde ikke planlagt dette.»</li>
            <li>Forsker: «Det er ikke min avdeling.»</li>
            <li>Paraplyer utsolgt, parmesan på vei.</li>
            <li>Lebrun Jamie og Mikkel Jorda koser seg med lapskaus i det store hav.</li>
            <li>Mannen i gul frakk har ikke kommentert saken.</li>
          </ul>
        </div>
        <Link href={enterHref} className={`${display.className} shrink-0 rounded-sm border border-white/70 bg-[#e8461f] px-6 py-3 text-xl uppercase tracking-[0.12em] text-white shadow-[0_8px_24px_rgba(60,20,10,.45)] transition hover:bg-[#ff5a30] active:scale-95 sm:text-2xl`}>
          {enterLabel} →
        </Link>
      </div>
    </div>
  );
}
