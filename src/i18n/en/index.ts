import { auth } from "./auth";
import { career } from "./career";
import { chemistry } from "./chemistry";
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

// Den engelske ordboken er fasiten: alle andre språk må ha nøyaktig de samme nøklene.
export const en = { common, auth, profile, friends, tournaments, career, chemistry, market, match, seasons, draft, sbc, femmer, quiz, dbErrors };

export type Dictionary = typeof en;
