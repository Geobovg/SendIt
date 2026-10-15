/**
 * Walkout-klipp for de beste kortene.
 *
 * Klippene ligger i public/walkouts som <slug>.webm (VP9 med gjennomsiktig bakgrunn, for Chrome og Firefox)
 * og helst <slug>.mov (HEVC med gjennomsiktig bakgrunn, for Safari). Spillere som ikke står her, får
 * sprite-walkouten. Listen under skrives av `npm run walkout:klipp`, så ikke rediger den for hånd.
 * Se docs/walkout-klipp.md for hvordan klippene lages.
 */
export type WalkoutClip = { ms: number; mov: boolean };

// walkout-klipp:start
export const walkoutClips: Record<string, WalkoutClip> = {};
// walkout-klipp:slutt
