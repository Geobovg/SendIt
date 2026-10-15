"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { preload } from "react-dom";
import { useT } from "@/i18n/client";
import type { PackPull } from "@/lib/manager-actions";
import { clubCrest } from "@/lib/club-crests";
import { playerFlag } from "@/lib/player-nationalities";
import { playerPhoto } from "@/lib/player-photos";
import { walkoutClips } from "@/lib/walkout-clips";

const spriteSrc = "/walkouts/sprite-walk.png";

// Safari spiller bare HEVC med gjennomsiktig bakgrunn, de andre bare WebM.
function isSafari() {
  return /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(navigator.userAgent);
}

// Klippet som kan spilles i denne nettleseren, eller null: da brukes sprite-walkouten.
function clipFor(slug: string) {
  const clip = walkoutClips[slug];
  if (!clip || typeof navigator === "undefined") return null;
  const mov = isSafari();
  if (mov && !clip.mov) return null;
  return { ms: clip.ms, src: `/walkouts/${slug}.${mov ? "mov" : "webm"}` };
}

// Grensa for det store trekket. Alt herfra og opp får walkout slik som i FIFA.
export const walkoutFrom = 86;

// Et spesialkort får alltid walkout, uansett rating.
export function qualifiesForWalkout(pull: PackPull) {
  return pull.overall >= walkoutFrom || Boolean(pull.special);
}

// 90+ og ikoner får en lengre og mørkere walkout enn de vanlige 86–89.
export function isEpicWalkout(pull: PackPull) {
  return pull.overall >= 90 || pull.special === "icon";
}

// Walkouten har en intro (nasjon, posisjon og klubb mens lysene slås på), så går spilleren mot kameraet,
// og så feirer han. Kortet vises når feiringen er over. Et klipp har ingen intro og bestemmer selv
// hvor lenge det varer: gåingen er de første 80 prosentene.
export function walkTiming(pull: PackPull) {
  const clip = clipFor(pull.slug);
  if (clip) return { intro: 0, approach: clip.ms * 0.8, celebrate: clip.ms * 0.2, total: clip.ms + 300 };
  const epic = isEpicWalkout(pull);
  const intro = 3000;
  const approach = epic ? 4400 : 3300;
  const celebrate = epic ? 2200 : 1800;
  return { intro, approach, celebrate, total: intro + approach + celebrate };
}

// Tidene som CSS-animasjonene til walkouten regnes ut fra.
function walkVars(pull: PackPull, glow: string) {
  const { intro, approach, celebrate, total } = walkTiming(pull);
  return {
    "--pack-glow": glow, "--walk-ms": `${total}ms`, "--intro-ms": `${intro}ms`, "--approach-ms": `${approach}ms`,
    "--end-ms": `${intro + approach}ms`, "--celebrate-ms": `${celebrate}ms`,
  } as CSSProperties;
}

export function walkMs(pull: PackPull) {
  return walkTiming(pull).total;
}

// Vi har bare ett stillbilde per spiller, så feiringen er en bevegelse av hele kroppen, ofte med en
// effekt rundt. Ingen av dem krymper spilleren. Signaturfeiringene ligger her; alle andre får en knyttneve.
//   siu: hopp med snurr (Ronaldo)       zen: senker seg i meditasjon, med ringer (Haaland)
//   sky: ser opp i en lysstråle (Messi)  wide: strekker seg ut med armene ut
//   bounce: danser                       pose: stirrer rett fram og vokser
export type Celebration = "siu" | "zen" | "sky" | "wide" | "bounce" | "pose" | "pump";

const celebrations: Record<string, Celebration> = {
  "cristiano-ronaldo": "siu",
  haaland: "zen",
  messi: "sky",
  salah: "wide",
  bellingham: "wide",
  "jobe-bellingham": "wide",
  "antoine-griezmann": "bounce",
  neymar: "bounce",
  "lamine-yamal": "bounce",
  vinicius: "bounce",
  mbappe: "pose",
  kane: "pose",
};

// Tekst som slår inn under feiringen.
const callouts: Record<string, string> = { "cristiano-ronaldo": "SIUUU!" };

export function celebrationFor(slug: string): Celebration {
  return celebrations[slug] ?? "pump";
}

// Flagget til spillerens nasjon, stort på hver sin side av skjermen mens kortet åpnes.
// Uten flagg (f.eks. personlige kort) brukes bare lysfargen.
export function WalkoutFlags({ slug, glow, leaving }: { slug: string; glow: string; leaving: boolean }) {
  const flag = playerFlag(slug);
  const style = { "--pack-glow": glow, ...(flag ? { "--flag": `url(${flag})` } : {}) } as CSSProperties;
  return <div aria-hidden className={`walkout-flags ${leaving ? "walkout-flags-out" : ""}`} style={style}>
    <div className="walkout-flag walkout-flag-left" />
    <div className="walkout-flag walkout-flag-right" />
  </div>;
}

// Laster klippene og sprite-arket mens pakka ryker opp, så walkouten ikke hakker.
// Et klipp som ikke er lastet ned i tide, spilles bare av der det er kommet.
export function WalkoutPreload({ pulls }: { pulls: PackPull[] }) {
  preload(spriteSrc, { as: "image" });
  return <>{pulls.filter(qualifiesForWalkout).map((pull) => {
    const clip = clipFor(pull.slug);
    return clip ? <video key={pull.card_id} src={clip.src} preload="auto" muted playsInline /> : null;
  })}</>;
}

// Spilleren går mot kameraet. Har han et klipp, spilles det. Ellers kommer han opp av tåka som en skygge
// av kortbildet sitt (så silhuetten er hans egen), lyses opp, og blir til kortbildet i samme størrelse
// og posisjon, som feirer.
export function WalkoutFigure({ pull, glow }: { pull: PackPull; glow: string }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const clip = failed ? null : clipFor(pull.slug);
  const photo = playerPhoto(pull.slug);
  const epic = isEpicWalkout(pull);
  const celebration = celebrationFor(pull.slug);
  const callout = callouts[pull.slug];
  return <div className={`walkout-scene ${epic ? "walkout-epic" : ""}`} style={walkVars(pull, glow)}>
    {clip ? null : <WalkoutIntro pull={pull} />}
    <div className="walkout-door" />
    {epic ? <div className="walkout-pulse" /> : null}
    <div className={`walkout-stage ${clip ? "walkout-stage-clip" : ""}`}>
      <div className="walkout-shadow" />
      {clip
        ? <video className="walkout-clip" src={clip.src} autoPlay muted playsInline preload="auto" onError={() => setFailed(true)} />
        : <>
          {photo
            ? <div className="walkout-shade">
              <Image src={photo} alt="" width={256} height={256} priority className="walkout-bust" />
              <div className="walkout-fog" />
            </div>
            : <div className="walkout-sprite" />}
          <div className="walkout-burst" />
          {celebration === "zen" ? <><div className="walkout-aura" /><div className="walkout-aura walkout-aura-2" /></> : null}
          {celebration === "sky" ? <div className="walkout-beam" /> : null}
          <div className={`walkout-celebrate walkout-c-${celebration}`}>
            {photo
              ? <Image src={photo} alt="" width={256} height={256} priority className="walkout-figure" />
              : <div className="walkout-figure grid place-items-center text-8xl font-black text-white">{pull.position}</div>}
          </div>
          {callout ? <p className="walkout-callout">{callout}</p> : null}
        </>}
    </div>
    <div className="walkout-label text-center text-white">
      <p className="text-2xl font-black uppercase tracking-wide">{pull.name}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[.2em] text-white/70">{t.career.clubName(pull.club)}</p>
    </div>
  </div>;
}

// Introen: først flagget, så posisjonen, så klubbmerket, hver med en ring som sprer seg.
function WalkoutIntro({ pull }: { pull: PackPull }) {
  const t = useT();
  const flag = playerFlag(pull.slug);
  const crest = clubCrest(pull.club);
  return <div aria-hidden className="walkout-intro">
    <div className="walkout-intro-item" style={{ "--at": "0.3s" } as CSSProperties}>
      {flag ? <Image src={flag} alt="" width={176} height={117} unoptimized className="h-[7.5rem] w-44 rounded-xl object-cover shadow-2xl ring-2 ring-white/70" /> : null}
    </div>
    <div className="walkout-intro-item" style={{ "--at": "1.1s" } as CSSProperties}>
      <span className="walkout-intro-position">{pull.position}</span>
    </div>
    <div className="walkout-intro-item" style={{ "--at": "1.9s" } as CSSProperties}>
      {crest
        ? <span className="grid h-36 w-36 place-items-center rounded-full bg-white/95 shadow-2xl ring-4 ring-white/40"><Image src={crest} alt="" width={96} height={96} className="h-24 w-24 object-contain" /></span>
        : <span className="max-w-[16rem] text-center text-3xl font-black uppercase text-white">{t.career.clubName(pull.club)}</span>}
    </div>
  </div>;
}

// Stadionen rundt: lysene slås på ett og ett, lyskastere sveiper, publikum blitzer med kamera og
// flammesøyler skyter opp i det spilleren lyses opp. Ligger over hele skjermen bak kortet.
export function WalkoutBackdrop({ pull, glow }: { pull: PackPull; glow: string }) {
  if (clipFor(pull.slug)) return null;
  const range = (count: number) => Array.from({ length: count }, (_, i) => i);
  return <div aria-hidden className="walkout-backdrop" style={walkVars(pull, glow)}>
    {range(5).map((i) => <div key={i} className="walkout-lamp" style={{ "--i": i } as CSSProperties} />)}
    <div className="walkout-sweep walkout-sweep-1" />
    <div className="walkout-sweep walkout-sweep-2" />
    <div className="walkout-crowd">
      {range(18).map((i) => <span key={i} className="walkout-camera" style={{
        left: `${(i * 47 + 13) % 100}%`, top: `${45 + (i * 29 + 7) % 55}%`,
        "--p": `${(1.1 + (i * 13 % 17) / 10).toFixed(2)}s`, "--d": `${((i * 0.37) % 2).toFixed(2)}s`,
      } as CSSProperties} />)}
    </div>
    {(["left", "right"] as const).map((side, k) => <div key={side} className={`walkout-pyro walkout-pyro-${side}`}>
      <div className="walkout-flame" style={{ animationDelay: `calc(var(--end-ms) + ${k * 60}ms), calc(var(--end-ms) + ${k * 60}ms), calc(var(--end-ms) + var(--celebrate-ms) - 0.7s)` }} />
      {range(14).map((j) => <span key={j} className="walkout-spark" style={{
        "--x": `${((j * 23 + k * 11) % 80) - 40}px`, "--y": `${160 + (j * 57 + k * 31) % 360}px`,
        "--delay": `${(j * 0.12).toFixed(2)}s`, "--dur": `${(0.9 + (j % 5) * 0.25).toFixed(2)}s`,
      } as CSSProperties} />)}
    </div>)}
  </div>;
}

// Når kortet vises: konfetti i kortets farger, en trykkbølge og en lysstripe.
export function WalkoutConfetti({ glow }: { glow: string }) {
  const colors = [glow, "#ffffff", "#f2c94c", "#ff5a5f", "#4cc9f0"];
  return <div aria-hidden className="walkout-confetti" style={{ "--pack-glow": glow } as CSSProperties}>
    <div className="walkout-shock" />
    <div className="walkout-streak" />
    {Array.from({ length: 34 }, (_, i) => <span key={i} className="walkout-piece" style={{
      left: `${(i * 29 + 11) % 100}%`, "--c": colors[i % colors.length],
      "--delay": `${((i * 0.07) % 1.2).toFixed(2)}s`, "--dur": `${(2.2 + (i % 7) * 0.35).toFixed(2)}s`,
      "--dx": `${((i * 37) % 120) - 60}px`, "--spin": `${((i % 2) * 2 - 1) * (360 + (i % 5) * 120)}deg`,
    } as CSSProperties} />)}
  </div>;
}
