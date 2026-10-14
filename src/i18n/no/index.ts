import type { Dictionary } from "../en";
import { auth } from "./auth";
import { career } from "./career";
import { common } from "./common";
import { dbErrors } from "./db-errors";
import { draft } from "./draft";
import { femmer } from "./femmer";
import { friends } from "./friends";
import { market } from "./market";
import { match } from "./match";
import { profile } from "./profile";
import { quiz } from "./quiz";
import { sbc } from "./sbc";
import { seasons } from "./seasons";
import { tournaments } from "./tournaments";

export const no: Dictionary = { common, auth, profile, friends, tournaments, career, market, match, seasons, draft, sbc, femmer, quiz, dbErrors };
