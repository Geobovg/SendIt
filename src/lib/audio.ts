import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

export type Track = { src: string; title: string };

const AUDIO_DIR = path.join(process.cwd(), "public", "audio");
const PLAYABLE = new Set([".mp3", ".m4a", ".ogg", ".wav"]);

function titleFrom(file: string): string {
  return path
    .parse(file)
    .name.replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (/^[a-zæøå]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

// Lydmappen ligger i bygget og endres ikke mens serveren kjører, så den leses én gang. I utvikling leses den på
// nytt hver gang, så nye filer dukker opp uten omstart.
let cachedTracks: Promise<Track[]> | null = null;

async function readTracks(): Promise<Track[]> {
  try {
    const files = await readdir(AUDIO_DIR);
    return files
      .filter((file) => PLAYABLE.has(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "nb"))
      .map((file) => ({
        src: `/audio/${encodeURIComponent(file)}`,
        title: titleFrom(file),
      }));
  } catch {
    return [];
  }
}

export function listTracks(): Promise<Track[]> {
  if (process.env.NODE_ENV !== "production") return readTracks();
  return (cachedTracks ??= readTracks());
}
