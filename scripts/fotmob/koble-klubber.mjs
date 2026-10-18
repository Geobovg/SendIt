// Kobler klubbnavnene i katalogen til FotMob-lag (data/klubber.json). Skriver ut de som ikke fant treff.
// Bruk: node scripts/fotmob/koble-klubber.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { normaliser } from "./fotmob.mjs";

const les = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), "utf8"));
const katalog = les("katalog.json");
const lag = les("lag.json");

// Katalogens navn som ikke er likt FotMobs
const alias = {
  "Inter": "inter", "Roma": "roma", "Brighton & Hove Albion": "brighton",
  "Paris Saint-Germain": "paris saint germain", "Athletic Club": "athletic club", "Beşiktaş": "besiktas",
  "Crvena Zvezda": "crvena zvezda", "Monaco": "monaco", "Bodø/Glimt": "bodo glimt", "Hamburger SV": "hamburger sv",
  "Mainz 05": "mainz 05", "1. FC Köln": "koln", "Red Bull Salzburg": "salzburg", "AC Milan": "milan", "SC Braga": "braga", "Lommel SK": "lommel", "İstanbul Başakşehir": "basaksehir",
  "Deportivo La Coruña": "deportivo a coruna", "Racing de Santander": "racing santander", "Aris": "aris thessaloniki",
  "Wolverhampton Wanderers": "wolverhampton wanderers", "Borussia Mönchengladbach": "borussia monchengladbach",
};
const tillegg = (t) => [t.name, t.shortName].filter(Boolean).map(normaliser);

const tellere = new Map();
for (const s of katalog) if (s.club) tellere.set(s.club, (tellere.get(s.club) ?? 0) + 1);

const kobling = {};
const uten = [];
for (const [klubb, antall] of tellere) {
  const mal = alias[klubb] ?? normaliser(klubb);
  let treff = lag.filter((t) => normaliser(t.name) === mal);
  if (!treff.length) treff = lag.filter((t) => tillegg(t).includes(mal));
  // Ellers en delvis likhet, men bare der FotMobs navn er lengre (Inter Miami CF), aldri omvendt (Inter != Inter Miami)
  if (!treff.length) treff = lag.filter((t) => tillegg(t).some((n) => ` ${n} `.includes(` ${mal} `)));
  // Flere treff (samme navn i flere ligaer, f.eks. ungdoms-/B-lag): ta det i høyeste liga, dvs. første i listen
  if (treff.length) kobling[klubb] = treff[0].id;
  if (treff.length !== 1) uten.push(`${klubb} (${antall} spillere): ${treff.length ? treff.map((t) => `${t.name}/${t.league}`).join(", ") : "INGEN"}`);
}
writeFileSync(new URL("./data/klubber.json", import.meta.url), JSON.stringify(kobling, null, 1));
console.log(`${Object.keys(kobling).length} av ${tellere.size} klubber koblet`);
console.log(uten.join("\n"));
