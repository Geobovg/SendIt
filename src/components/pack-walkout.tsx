"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { preload } from "react-dom";
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
// og så står han i lyset mens ratingen teller opp. Kortet vises når det er over. Et klipp har ingen intro og bestemmer selv
// hvor lenge det varer: gåingen er de første 80 prosentene.
export function walkTiming(pull: PackPull) {
  const clip = clipFor(pull.slug);
  if (clip) return { intro: 0, approach: clip.ms * 0.8, hold: clip.ms * 0.2, total: clip.ms + 300 };
  const epic = isEpicWalkout(pull);
  const intro = 4000;
  const approach = epic ? 4800 : 3800;
  // Tiden han står i lyset mens ratingen teller opp, etter at kortbildet har tatt over fra skyggen.
  const hold = epic ? 3000 : 2400;
  return { intro, approach, hold, total: intro + approach + hold };
}

// Tidene som CSS-animasjonene til walkouten regnes ut fra.
function walkVars(pull: PackPull, glow: string) {
  const { intro, approach, hold, total } = walkTiming(pull);
  return {
    "--pack-glow": glow, "--walk-ms": `${total}ms`, "--intro-ms": `${intro}ms`, "--approach-ms": `${approach}ms`,
    "--end-ms": `${intro + approach}ms`, "--hold-ms": `${hold}ms`,
  } as CSSProperties;
}

export function walkMs(pull: PackPull) {
  return walkTiming(pull).total;
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
  // Sprite-arket brukes bare av spillere uten kortbilde.
  if (pulls.some((pull) => qualifiesForWalkout(pull) && !playerPhoto(pull.slug))) preload(spriteSrc, { as: "image" });
  return <>{pulls.filter(qualifiesForWalkout).map((pull) => {
    const clip = clipFor(pull.slug);
    return clip ? <video key={pull.card_id} src={clip.src} preload="auto" muted playsInline /> : null;
  })}</>;
}

// Spilleren går mot kameraet. Har han et klipp, spilles det. Ellers kommer han opp av tåka som en skygge
// av kortbildet sitt (så silhuetten er hans egen), lyses opp, og blir til kortbildet i samme størrelse
// og posisjon, som feirer.
export function WalkoutFigure({ pull, glow }: { pull: PackPull; glow: string }) {
  const [failed, setFailed] = useState(false);
  const clip = failed ? null : clipFor(pull.slug);
  const photo = playerPhoto(pull.slug);
  const epic = isEpicWalkout(pull);
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
          <div className="walkout-final">
            {photo
              ? <Image src={photo} alt="" width={256} height={256} priority className="walkout-figure" />
              : <div className="walkout-figure grid place-items-center text-8xl font-black text-white">{pull.position}</div>}
          </div>
        </>}
    </div>
    <WalkoutLabel pull={pull} />
  </div>;
}

// Navnet med klubbmerket og ratingen under. Ratingen teller jevnt opp mens han feirer.
function WalkoutLabel({ pull, final = false }: { pull: PackPull; final?: boolean }) {
  const { intro, approach, hold } = walkTiming(pull);
  return <div className="walkout-label grid justify-items-center gap-2 text-center text-white">
    <p className="text-2xl font-black uppercase tracking-wide">{pull.name}</p>
    <ClubBadge club={pull.club} className="h-11 w-11 text-sm" imgClass="h-8 w-8" />
    <p className="walkout-rating">
      {final ? pull.overall : <CountUp to={pull.overall} delay={intro + approach + 600} duration={Math.max(1200, hold - 400)} />}
      <small>{pull.position}</small>
    </p>
  </div>;
}

// Tallet teller jevnt opp fra 0 med en rolig utbremsing mot slutten.
function CountUp({ to, delay, duration }: { to: number; delay: number; duration: number }) {
  const [value, setValue] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? to : 0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start - delay) / duration));
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, duration]);
  return <>{value}</>;
}

// Klubbmerket i en hvit sirkel. Klubber uten merke får forbokstavene i stedet.
function ClubBadge({ club, className, imgClass }: { club: string; className: string; imgClass: string }) {
  const crest = clubCrest(club);
  if (crest) return <span className={`grid place-items-center rounded-full bg-white/95 shadow-lg ring-2 ring-white/40 ${className}`}><Image src={crest} alt="" width={96} height={96} className={`object-contain ${imgClass}`} /></span>;
  const initials = club.split(/[\s-]+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return <span className={`grid place-items-center rounded-full bg-black/60 font-black text-white ring-2 ring-white/60 ${className}`}>{initials}</span>;
}

// Introen: først flagget, så posisjonen, så klubbmerket, hver med en ring som sprer seg.
function WalkoutIntro({ pull }: { pull: PackPull }) {
  const flag = playerFlag(pull.slug);
  return <div aria-hidden className="walkout-intro">
    <div className="walkout-intro-item" style={{ "--at": "0.4s" } as CSSProperties}>
      {flag ? <Image src={flag} alt="" width={176} height={120} unoptimized className="h-[7.5rem] w-44 rounded-xl object-cover shadow-2xl ring-2 ring-white/70" /> : null}
    </div>
    <div className="walkout-intro-item" style={{ "--at": "1.7s" } as CSSProperties}>
      <span className="walkout-intro-position">{pull.position}</span>
    </div>
    <div className="walkout-intro-item" style={{ "--at": "3s" } as CSSProperties}>
      <ClubBadge club={pull.club} className="h-40 w-40 text-5xl ring-4" imgClass="h-28 w-28" />
    </div>
  </div>;
}

// Stadionen rundt: lysene slås på ett og ett, lyskastere sveiper, publikum blitzer med kamera og
// flammesøyler skyter opp i det spilleren lyses opp. Ligger over hele skjermen bak kortet.
export function WalkoutBackdrop({ pull, glow, leaving }: { pull: PackPull; glow: string; leaving: boolean }) {
  if (clipFor(pull.slug)) return null;
  const range = (count: number) => Array.from({ length: count }, (_, i) => i);
  return <div aria-hidden className={`walkout-backdrop ${leaving ? "walkout-backdrop-out" : ""}`} style={walkVars(pull, glow)}>
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
      <div className="walkout-flame" style={{ animationDelay: `calc(var(--end-ms) + ${k * 60}ms), calc(var(--end-ms) + ${k * 60}ms), calc(var(--end-ms) + var(--hold-ms) - 0.7s)` }} />
      {range(14).map((j) => <span key={j} className="walkout-spark" style={{
        "--x": `${((j * 23 + k * 11) % 80) - 40}px`, "--y": `${160 + (j * 57 + k * 31) % 360}px`,
        "--delay": `${(j * 0.12).toFixed(2)}s`, "--dur": `${(0.9 + (j % 5) * 0.25).toFixed(2)}s`,
      } as CSSProperties} />)}
    </div>)}
  </div>;
}

// Etter walkouten: rolige gnister som stiger sakte opp mens kortet toner inn.
export function WalkoutEmbers({ glow }: { glow: string }) {
  return <div aria-hidden className="walkout-embers" style={{ "--pack-glow": glow } as CSSProperties}>
    {Array.from({ length: 26 }, (_, i) => <span key={i} className="walkout-ember" style={{
      left: `${(i * 37 + 9) % 100}%`, "--s": `${(0.25 + (i % 4) * 0.12).toFixed(2)}rem`,
      "--dx": `${((i * 29) % 90) - 45}px`, "--delay": `${((i * 0.19) % 2.4).toFixed(2)}s`, "--dur": `${(4.5 + (i % 6) * 0.6).toFixed(1)}s`,
    } as CSSProperties} />)}
  </div>;
}

// Kortbildet står igjen og toner langsomt ut mens kortet toner inn,
// så overgangen blir en myk kryssoning i stedet for et brått bytte.
export function WalkoutHandoff({ pull, glow }: { pull: PackPull; glow: string }) {
  const photo = playerPhoto(pull.slug);
  if (!photo || clipFor(pull.slug)) return null;
  return <div aria-hidden className="walkout-handoff" style={walkVars(pull, glow)}>
    <div className="walkout-stage">
      <div className="walkout-final">
        <Image src={photo} alt="" width={256} height={256} className="walkout-handoff-photo" />
      </div>
    </div>
    <WalkoutLabel pull={pull} final />
  </div>;
}
