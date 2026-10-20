import { draft } from "./draft";
import { auth } from "./auth";
import { career } from "./career";
import { chemistry } from "./chemistry";
import { common } from "./common";
import { dbErrors } from "./db-errors";
import { femmer } from "./femmer";
import { friends } from "./friends";
import { market } from "./market";
import { match } from "./match";
import { profile } from "./profile";
import { quiz } from "./quiz";
import { sbc } from "./sbc";
import { seasons } from "./seasons";
import { stadium } from "./stadium";
import { tournaments } from "./tournaments";
// Univers-teksten er foreløpig bare skrevet på norsk og engelsk; de andre språkene bruker den engelske.
import { universe } from "../en/universe";
import type { Dictionary } from "../en";

export const de: Dictionary = { draft, common, auth, profile, friends, tournaments, career, chemistry, market, match, seasons, stadium, sbc, femmer, quiz, dbErrors, universe };
