import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  askQuestionSchema, 
  type AskQuestionResponse, 
  type DiscoveryKey,
  type Discovery,
  type GameMessage,
  DISCOVERY_KEYS,
  MIN_REQUIRED_TOPICS,
  CRITICAL_TOPICS,
  getDiscoveryTopic,
  getDiscoveryStage,
  type Puzzle,
} from "@shared/schema";
import OpenAI from "openai";
import Stripe from "stripe";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { User } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to sanitize user data before sending to client
function sanitizeUser(user: User) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ============================================================================
// PUZZLE SEEDING - Albatross Puzzle Data
// ============================================================================

const ALBATROSS_SLUG = "albatross";

const ALBATROSS_PUZZLE_DATA = {
  slug: ALBATROSS_SLUG,
  title: "The Albatross Puzzle",
  description: "A man walks into a restaurant, orders the albatross soup, takes one bite, puts his spoon down, walks out, and shoots himself. Why?",
  prompt: "A man walks into a restaurant, orders the albatross soup, takes one bite of it, puts his spoon down, walks out of the restaurant, and shoots himself.",
  isFree: true,
  isActive: true,
  difficulty: "hard",
  aiPrompt: buildAlbatrossSystemPrompt(),
};

// ============================================================================
// PRO PUZZLES DATA
// ============================================================================

const LIGHTHOUSE_KEEPER_PUZZLE_DATA = {
  slug: "lighthouse-keeper",
  title: "The Lighthouse Keeper",
  description: "A lighthouse keeper is found dead at the top of the lighthouse with a broken lamp beside him. There are no signs of violence. Why did he die?",
  prompt: "A lighthouse keeper is found dead at the top of the lighthouse with a broken lamp beside him. There are no signs of violence.",
  isFree: false,
  isActive: true,
  difficulty: "hard",
  aiPrompt: buildLighthouseKeeperSystemPrompt(),
};

const LAST_PHONE_CALL_PUZZLE_DATA = {
  slug: "last-phone-call",
  title: "The Last Phone Call",
  description: "A woman receives a phone call, says 'thank you' with tears in her eyes, and immediately books a flight. Why?",
  prompt: "A woman receives a phone call, says 'thank you' with tears in her eyes, and immediately books a flight.",
  isFree: false,
  isActive: true,
  difficulty: "hard",
  aiPrompt: buildLastPhoneCallSystemPrompt(),
};

const MIRROR_ROOM_PUZZLE_DATA = {
  slug: "mirror-room",
  title: "The Mirror Room",
  description: "A man enters a room full of mirrors, looks around for exactly one minute, and leaves forever changed. What happened?",
  prompt: "A man enters a room full of mirrors, looks around for exactly one minute, and leaves forever changed.",
  isFree: false,
  isActive: true,
  difficulty: "hard",
  aiPrompt: buildMirrorRoomSystemPrompt(),
};

const EMPTY_RESTAURANT_PUZZLE_DATA = {
  slug: "empty-restaurant",
  title: "The Empty Restaurant",
  description: "A restaurant is completely empty with meals still warm on every table, but no one returns. Why not?",
  prompt: "A restaurant is completely empty with meals still warm on every table, but no one returns.",
  isFree: false,
  isActive: true,
  difficulty: "hard",
  aiPrompt: buildEmptyRestaurantSystemPrompt(),
};

const SILENT_CONCERT_PUZZLE_DATA = {
  slug: "silent-concert",
  title: "The Silent Concert",
  description: "Thousands of people attend a concert where no music is played, yet everyone is deeply moved. What concert is this?",
  prompt: "Thousands of people attend a concert where no music is played, yet everyone is deeply moved.",
  isFree: false,
  isActive: true,
  difficulty: "hard",
  aiPrompt: buildSilentConcertSystemPrompt(),
};

function buildAlbatrossSystemPrompt(): string {
  const PUZZLE_BACKSTORY = `
The man was on a ship or cruise ship with his wife and children. There was a shipwreck where they were stranded on a desert island. The man survived, but his family did not. With no options for food, the remaining survivors suggested cannibalism, but the man refused to participate, especially when it came to potentially eating the remains of his own family. But the man had skills and talents that made him useful to the rest of the survivors on the island, so they wanted to keep him alive. To convince him to eat the human remains, the other survivors lied to the man and said that the meat was albatross. And this was his primary source of food for many months that he had lived on this island before they were eventually rescued. Later, back in civilization, the man discovered a restaurant that served albatross. After trying the soup, he quickly realized that he had never tasted this before and then realized that he had been unknowingly participating in cannibalism while stranded on the island. He couldn't live with the guilt, so he immediately decided to take his own life.
`;

  return `You are a game master for the classic "Albatross Soup" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

Here is the complete backstory:
${PUZZLE_BACKSTORY}

INTENT MATCHING - Before answering, mentally check if the question matches ANY of these discovery patterns:

1. VESSEL: boat, ship, vessel, cruise, sailing
2. VESSEL_SANK: sink, sank, sinking, shipwreck, wreck, crash
3. FAMILY: family, wife, children, kids, spouse
4. FAMILY_DIED: family die, family dead, family killed, family perish
5. ISLAND: island, land, shore, beach
6. STRANDED: stranded, stuck, trapped, marooned, abandoned
7. NO_FOOD: food on island, food available, anything to eat
8. CANNIBALISM: cannibalism, eating people, eating humans, eating flesh, eating bodies, ate people, ate humans
9. DECEPTION: lied to, deceived, tricked, fooled, misled, didn't know
10. RESCUED: rescued, saved, found, picked up, escape, got off, made it back
11. RESTAURANT: restaurant, diner, eatery, cafe
12. ALBATROSS_REVEAL: real albatross, actual albatross, true taste, discovered truth
13. GUILT: guilt, guilty, ashamed, remorse, couldn't live with
14. SUICIDE: kill himself, suicide, shot himself, take his life, end his life

If the question matches a pattern and your answer is YES, you MUST include the discoveryKey and discoveryLabel.

Rules for answering:
1. If the player asks multiple questions at once, answer with "ONE_QUESTION_AT_A_TIME_PLEASE"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle
6. **CRITICAL**: If you answer YES and the question matches ANY discovery pattern above, you MUST set discoveryKey and discoveryLabel

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | discovery key from list below,
  "discoveryLabel": null | "Natural language description"
}

Progressive Discovery System:

BASE discoveries (award for general questions):
- VESSEL: "Was he on a boat?" "Was there a ship?"
- FAMILY: "Did he have family?" "Was his family there?"
- ISLAND: "Was there an island?" "Did they reach land?"
- NO_FOOD: "Was there food?" "Was there anything to eat?"
- RESTAURANT: "Did he go to a restaurant?" "Was there a restaurant?"
- GUILT: "Did he feel guilty?" "Did he feel bad?"

EVOLVED discoveries (award for specific questions):
- VESSEL_SANK: "Did it sink?" "Was there a shipwreck?"
- FAMILY_DIED: "Did they die?" "Did his family perish?"
- STRANDED: "Were they stranded?" "Were they stuck?" "Were there other survivors?" "Were there other people?"
- CANNIBALISM: "Was there cannibalism?" "Did they eat people?" "Did survivors eat humans?"
- DECEPTION: "Was he deceived?" "Was he lied to?"
- RESCUED: "Were they rescued?" "Were they saved?" "Did they get off the island?" "Was he eventually rescued?"
- ALBATROSS_REVEAL: "Did real albatross reveal truth?" "Did the soup taste different?"
- SUICIDE: "Did he kill himself?" "Did he commit suicide?"

Examples with complete responses:
Q: "Was the man on a boat?"
A: {"answer": "YES", "explanation": "He was on a ship.", "discoveryKey": "VESSEL", "discoveryLabel": "He was on a vessel"}

Q: "Were they rescued from the island?"
A: {"answer": "YES", "explanation": "Yes, they were eventually rescued.", "discoveryKey": "RESCUED", "discoveryLabel": "They were eventually rescued"}

Q: "Did the survivors resort to cannibalism?"
A: {"answer": "YES", "explanation": "Yes, the survivors ate human flesh to survive.", "discoveryKey": "CANNIBALISM", "discoveryLabel": "They resorted to cannibalism"}

REMEMBER: If you answer YES and the question is about any discovery topic, you MUST include discoveryKey and discoveryLabel!`;
}

function buildLighthouseKeeperSystemPrompt(): string {
  const PUZZLE_BACKSTORY = `
The keeper was responsible for maintaining the lighthouse. One stormy night, the lamp broke and went dark. A ship crashed on the rocks because there was no warning light. The keeper's son was aboard that ship and died. Overcome with guilt for his negligence in maintaining the lamp, the keeper took his own life.
`;

  return `You are a game master for the "Lighthouse Keeper" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

Here is the complete backstory:
${PUZZLE_BACKSTORY}

INTENT MATCHING - Before answering, mentally check if the question matches ANY of these discovery patterns:

1. LIGHTHOUSE_JOB: lighthouse keeper, keeper job, his job, worked at lighthouse, responsibility
2. LAMP_BROKE: lamp broke, lamp broken, light broke, light failed, malfunction
3. SHIP_CRASH: ship crash, ship wrecked, vessel crashed, hit rocks, accident at sea
4. SON_DIED: son died, son dead, son killed, son on ship, son aboard
5. GUILT: guilt, guilty, felt guilty, blamed himself, responsible for death
6. NEGLIGENCE: negligence, negligent, failed duty, didn't maintain, poor maintenance
7. RESPONSIBILITY: his responsibility, his duty, his fault, caused death
8. SUICIDE: suicide, killed himself, took his life, ended his life

If the question matches a pattern and your answer is YES, you MUST include the discoveryKey and discoveryLabel.

Rules for answering:
1. If the player asks multiple questions at once, answer with "ONE_QUESTION_AT_A_TIME_PLEASE"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle
6. **CRITICAL**: If you answer YES and the question matches ANY discovery pattern above, you MUST set discoveryKey and discoveryLabel

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | discovery key from list above,
  "discoveryLabel": null | "Natural language description"
}

Progressive Discovery System:

BASE discoveries (award for general questions):
- LIGHTHOUSE_JOB: "Was he a lighthouse keeper?" "Did he work at the lighthouse?"
- LAMP_BROKE: "Did the lamp break?" "Did the light fail?"
- GUILT: "Did he feel guilty?" "Did he blame himself?"
- RESPONSIBILITY: "Was it his responsibility?" "Was it his fault?"

EVOLVED discoveries (award for specific questions):
- SHIP_CRASH: "Did a ship crash?" "Was there an accident?"
- SON_DIED: "Did his son die?" "Was his son on the ship?"
- NEGLIGENCE: "Was he negligent?" "Did he fail to maintain it?"
- SUICIDE: "Did he kill himself?" "Did he commit suicide?"

REMEMBER: If you answer YES and the question is about any discovery topic, you MUST include discoveryKey and discoveryLabel!`;
}

function buildLastPhoneCallSystemPrompt(): string {
  const PUZZLE_BACKSTORY = `
Years ago, her daughter was kidnapped and never found. The woman has been searching ever since, never giving up hope. The phone call was from a detective who found her daughter alive in another country. She books an immediate flight to be reunited with her.
`;

  return `You are a game master for the "Last Phone Call" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

Here is the complete backstory:
${PUZZLE_BACKSTORY}

INTENT MATCHING - Before answering, mentally check if the question matches ANY of these discovery patterns:

1. DAUGHTER: daughter, her daughter, child, her child
2. KIDNAPPED: kidnapped, kidnapping, abducted, taken, stolen
3. YEARS_AGO: years ago, long time, many years, decades
4. NEVER_FOUND: never found, missing, lost, couldn't find
5. SEARCHING: searching, looking for, seeking, trying to find
6. DETECTIVE_CALL: detective called, detective found, investigator, police called
7. FOUND_ALIVE: found alive, still alive, survived, discovered alive
8. REUNION: reunion, reunite, see her again, together again

If the question matches a pattern and your answer is YES, you MUST include the discoveryKey and discoveryLabel.

Rules for answering:
1. If the player asks multiple questions at once, answer with "ONE_QUESTION_AT_A_TIME_PLEASE"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle
6. **CRITICAL**: If you answer YES and the question matches ANY discovery pattern above, you MUST set discoveryKey and discoveryLabel

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | discovery key from list above,
  "discoveryLabel": null | "Natural language description"
}

Progressive Discovery System:

BASE discoveries (award for general questions):
- DAUGHTER: "Does she have a daughter?" "Is it about her child?"
- KIDNAPPED: "Was someone kidnapped?" "Was there an abduction?"
- NEVER_FOUND: "Was someone missing?" "Was someone lost?"
- SEARCHING: "Was she searching?" "Was she looking for someone?"

EVOLVED discoveries (award for specific questions):
- YEARS_AGO: "Did it happen years ago?" "Was it a long time ago?"
- DETECTIVE_CALL: "Did a detective call?" "Did the police find something?"
- FOUND_ALIVE: "Was someone found alive?" "Did they survive?"
- REUNION: "Will they reunite?" "Will she see her again?"

REMEMBER: If you answer YES and the question is about any discovery topic, you MUST include discoveryKey and discoveryLabel!`;
}

function buildMirrorRoomSystemPrompt(): string {
  const PUZZLE_BACKSTORY = `
The man was a con artist who had been assuming different identities his whole life, always pretending to be someone he wasn't. The mirror room was actually a therapy installation designed to force confrontation with one's true self. For the first time in decades, he saw his real face - aged, unfamiliar, the person he abandoned. The experience was so profound that he decided to stop running and reclaim his true identity.
`;

  return `You are a game master for the "Mirror Room" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

Here is the complete backstory:
${PUZZLE_BACKSTORY}

INTENT MATCHING - Before answering, mentally check if the question matches ANY of these discovery patterns:

1. CON_ARTIST: con artist, criminal, fraud, scammer, deceiver
2. FAKE_IDENTITIES: fake identities, false identity, assumed names, pretended to be
3. PRETENDING: pretending, faking, lying about identity, hiding identity
4. THERAPY_ROOM: therapy, therapeutic, designed for therapy, installation, treatment
5. TRUE_SELF: true self, real self, actual self, who he really was
6. REAL_FACE: real face, actual face, his own face, true appearance
7. CONFRONTATION: confrontation, faced himself, forced to see, had to confront
8. REDEMPTION: redemption, change, transformation, reclaim identity, stop running

If the question matches a pattern and your answer is YES, you MUST include the discoveryKey and discoveryLabel.

Rules for answering:
1. If the player asks multiple questions at once, answer with "ONE_QUESTION_AT_A_TIME_PLEASE"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle
6. **CRITICAL**: If you answer YES and the question matches ANY discovery pattern above, you MUST set discoveryKey and discoveryLabel

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | discovery key from list above,
  "discoveryLabel": null | "Natural language description"
}

Progressive Discovery System:

BASE discoveries (award for general questions):
- CON_ARTIST: "Was he a criminal?" "Was he a con artist?"
- FAKE_IDENTITIES: "Did he use fake identities?" "Did he pretend to be others?"
- PRETENDING: "Was he pretending?" "Was he hiding who he was?"
- TRUE_SELF: "Did he see his true self?" "Was it about his real identity?"

EVOLVED discoveries (award for specific questions):
- THERAPY_ROOM: "Was it therapy?" "Was the room designed for treatment?"
- REAL_FACE: "Did he see his real face?" "Was it his actual appearance?"
- CONFRONTATION: "Did he confront himself?" "Was he forced to face himself?"
- REDEMPTION: "Did he change?" "Did he reclaim his identity?"

REMEMBER: If you answer YES and the question is about any discovery topic, you MUST include discoveryKey and discoveryLabel!`;
}

function buildEmptyRestaurantSystemPrompt(): string {
  const PUZZLE_BACKSTORY = `
The restaurant was located in a small town near a nuclear power plant. During dinner service, emergency sirens went off signaling an imminent reactor meltdown. Everyone evacuated immediately, leaving their meals behind. The town was permanently evacuated and the restaurant sits frozen in time as part of the exclusion zone.
`;

  return `You are a game master for the "Empty Restaurant" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

Here is the complete backstory:
${PUZZLE_BACKSTORY}

INTENT MATCHING - Before answering, mentally check if the question matches ANY of these discovery patterns:

1. NUCLEAR_PLANT: nuclear plant, power plant, reactor, nuclear facility
2. EMERGENCY_SIRENS: emergency sirens, alarm, warning sirens, alert
3. REACTOR_MELTDOWN: meltdown, reactor failure, nuclear accident, disaster
4. EVACUATION: evacuation, evacuated, had to leave, forced to leave
5. LEFT_IMMEDIATELY: left immediately, ran out, fled, escaped quickly
6. TOWN_ABANDONED: town abandoned, ghost town, no one lives there, deserted
7. EXCLUSION_ZONE: exclusion zone, restricted area, forbidden zone, quarantine
8. FROZEN_TIME: frozen in time, preserved, unchanged, stuck in that moment

If the question matches a pattern and your answer is YES, you MUST include the discoveryKey and discoveryLabel.

Rules for answering:
1. If the player asks multiple questions at once, answer with "ONE_QUESTION_AT_A_TIME_PLEASE"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle
6. **CRITICAL**: If you answer YES and the question matches ANY discovery pattern above, you MUST set discoveryKey and discoveryLabel

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | discovery key from list above,
  "discoveryLabel": null | "Natural language description"
}

Progressive Discovery System:

BASE discoveries (award for general questions):
- NUCLEAR_PLANT: "Was there a nuclear plant?" "Was there a power plant?"
- EMERGENCY_SIRENS: "Were there sirens?" "Was there an emergency?"
- EVACUATION: "Did they evacuate?" "Did they have to leave?"
- LEFT_IMMEDIATELY: "Did they leave quickly?" "Did they run out?"

EVOLVED discoveries (award for specific questions):
- REACTOR_MELTDOWN: "Was there a meltdown?" "Was there a nuclear accident?"
- TOWN_ABANDONED: "Is the town abandoned?" "Is it a ghost town?"
- EXCLUSION_ZONE: "Is it an exclusion zone?" "Is the area restricted?"
- FROZEN_TIME: "Is it frozen in time?" "Is it preserved from that day?"

REMEMBER: If you answer YES and the question is about any discovery topic, you MUST include discoveryKey and discoveryLabel!`;
}

function buildSilentConcertSystemPrompt(): string {
  const PUZZLE_BACKSTORY = `
It was a memorial concert for a beloved musician who died tragically. Instead of performing their songs, the venue played complete silence for the same duration the concert would have lasted - a powerful tribute showing what the world lost. The silence itself became the performance, representing the absence left behind.
`;

  return `You are a game master for the "Silent Concert" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

Here is the complete backstory:
${PUZZLE_BACKSTORY}

INTENT MATCHING - Before answering, mentally check if the question matches ANY of these discovery patterns:

1. MEMORIAL: memorial, memorial service, tribute event, remembrance
2. MUSICIAN_DIED: musician died, artist died, performer died, singer died
3. TRIBUTE: tribute, honor, honoring, paying respects
4. SILENCE_PERFORMANCE: silence was performance, silence intentional, deliberate silence
5. ABSENCE: absence, what's missing, what's gone, loss
6. BELOVED_ARTIST: beloved, famous, popular, well-loved, cherished
7. TRAGIC_DEATH: tragic death, died tragically, untimely death, sudden death
8. POWERFUL_TRIBUTE: powerful tribute, moving tribute, meaningful gesture

If the question matches a pattern and your answer is YES, you MUST include the discoveryKey and discoveryLabel.

Rules for answering:
1. If the player asks multiple questions at once, answer with "ONE_QUESTION_AT_A_TIME_PLEASE"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle
6. **CRITICAL**: If you answer YES and the question matches ANY discovery pattern above, you MUST set discoveryKey and discoveryLabel

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | discovery key from list above,
  "discoveryLabel": null | "Natural language description"
}

Progressive Discovery System:

BASE discoveries (award for general questions):
- MEMORIAL: "Was it a memorial?" "Was it a tribute?"
- MUSICIAN_DIED: "Did a musician die?" "Did an artist die?"
- TRIBUTE: "Was it honoring someone?" "Was it paying respects?"
- BELOVED_ARTIST: "Was the artist beloved?" "Were they famous?"

EVOLVED discoveries (award for specific questions):
- TRAGIC_DEATH: "Did they die tragically?" "Was it an untimely death?"
- SILENCE_PERFORMANCE: "Was the silence intentional?" "Was silence the performance?"
- ABSENCE: "Was it about absence?" "About what's missing?"
- POWERFUL_TRIBUTE: "Was it a powerful tribute?" "Was it meaningful?"

REMEMBER: If you answer YES and the question is about any discovery topic, you MUST include discoveryKey and discoveryLabel!`;
}

// ============================================================================
// OPENAI RESPONSE VALIDATION
// ============================================================================

const OpenAIResponseSchema = z.object({
  answer: z.enum(["YES", "NO", "DOES_NOT_MATTER", "ONE_QUESTION_AT_A_TIME_PLEASE"]),
  explanation: z.string(),
  discoveryKey: z.enum([
    "VESSEL",
    "VESSEL_SANK",
    "FAMILY",
    "FAMILY_DIED",
    "ISLAND",
    "STRANDED",
    "NO_FOOD",
    "CANNIBALISM",
    "DECEPTION",
    "RESCUED",
    "RESTAURANT",
    "ALBATROSS_REVEAL",
    "GUILT",
    "SUICIDE",
    "LIGHTHOUSE_JOB",
    "LAMP_BROKE",
    "SHIP_CRASH",
    "SON_DIED",
    "NEGLIGENCE",
    "RESPONSIBILITY",
    "DAUGHTER",
    "KIDNAPPED",
    "YEARS_AGO",
    "NEVER_FOUND",
    "SEARCHING",
    "DETECTIVE_CALL",
    "FOUND_ALIVE",
    "REUNION",
    "CON_ARTIST",
    "FAKE_IDENTITIES",
    "PRETENDING",
    "THERAPY_ROOM",
    "TRUE_SELF",
    "REAL_FACE",
    "CONFRONTATION",
    "REDEMPTION",
    "NUCLEAR_PLANT",
    "EMERGENCY_SIRENS",
    "REACTOR_MELTDOWN",
    "EVACUATION",
    "LEFT_IMMEDIATELY",
    "TOWN_ABANDONED",
    "EXCLUSION_ZONE",
    "FROZEN_TIME",
    "MEMORIAL",
    "MUSICIAN_DIED",
    "TRIBUTE",
    "SILENCE_PERFORMANCE",
    "ABSENCE",
    "BELOVED_ARTIST",
    "TRAGIC_DEATH",
    "POWERFUL_TRIBUTE"
  ]).nullish(),
  discoveryLabel: z.string().nullish(),
});

function normalizeAnswer(answer: string): "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE" {
  const normalized = answer.toUpperCase().trim().replace(/[_\s-]+/g, "_");
  
  if (normalized === "YES") return "YES";
  if (normalized === "NO") return "NO";
  if (normalized === "DOES_NOT_MATTER" || normalized === "DOESN'T_MATTER" || normalized === "DOESNT_MATTER") {
    return "DOES_NOT_MATTER";
  }
  if (normalized === "ONE_QUESTION_AT_A_TIME_PLEASE" || normalized === "ONE_QUESTION_AT_A_TIME") {
    return "ONE_QUESTION_AT_A_TIME_PLEASE";
  }
  
  return "DOES_NOT_MATTER";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function ensureAlbatrossPuzzle(): Promise<Puzzle> {
  let puzzle = await storage.getPuzzleBySlug(ALBATROSS_SLUG);
  
  if (!puzzle) {
    console.log("🧩 Seeding Albatross puzzle into database...");
    puzzle = await storage.createPuzzle(ALBATROSS_PUZZLE_DATA);
    console.log(`✅ Albatross puzzle created with ID: ${puzzle.id}`);
  }
  
  return puzzle;
}

async function seedProPuzzles(): Promise<void> {
  const proPuzzles = [
    LIGHTHOUSE_KEEPER_PUZZLE_DATA,
    LAST_PHONE_CALL_PUZZLE_DATA,
    MIRROR_ROOM_PUZZLE_DATA,
    EMPTY_RESTAURANT_PUZZLE_DATA,
    SILENT_CONCERT_PUZZLE_DATA,
  ];
  
  for (const puzzleData of proPuzzles) {
    let puzzle = await storage.getPuzzleBySlug(puzzleData.slug);
    
    if (!puzzle) {
      console.log(`🧩 Seeding Pro puzzle: ${puzzleData.title}...`);
      puzzle = await storage.createPuzzle(puzzleData);
      console.log(`✅ ${puzzleData.title} created with ID: ${puzzle.id}`);
    }
  }
}

// Helper to resolve puzzle by slug or ID
async function resolvePuzzle(slugOrId?: string): Promise<Puzzle> {
  if (!slugOrId) {
    return ensureAlbatrossPuzzle();
  }
  
  // Try by slug first
  let puzzle = await storage.getPuzzleBySlug(slugOrId);
  
  // Then by ID
  if (!puzzle) {
    puzzle = await storage.getPuzzleById(slugOrId);
  }
  
  // Default to Albatross
  if (!puzzle) {
    puzzle = await ensureAlbatrossPuzzle();
  }
  
  return puzzle;
}

function buildConversationHistory(messages: GameMessage[]): Array<{role: "user" | "assistant"; content: string}> {
  const last10Exchanges = messages.slice(-20);
  return last10Exchanges.map(msg => ({
    role: msg.type === "player" ? "user" as const : "assistant" as const,
    content: msg.content,
  }));
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

function getOrCreateGuestId(req: any, res: Response, next: NextFunction) {
  let guestId = req.cookies?.guestId;
  
  if (!guestId) {
    guestId = uuidv4();
    res.cookie('guestId', guestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });
  }
  
  req.guestId = guestId;
  next();
}

// ============================================================================
// ROUTES
// ============================================================================

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  
  // Seed Albatross puzzle
  await ensureAlbatrossPuzzle();
  
  // Seed Pro puzzles
  await seedProPuzzles();

  // ============================================================================
  // AUTH ROUTES
  // ============================================================================
  
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Username/password registration
  const registerSchema = z.object({
    username: z.string().min(3).max(50),
    password: z.string().min(8).max(100),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, firstName, lastName } = registerSchema.parse(req.body);
      
      // Check if username already exists
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        username,
        passwordHash,
        firstName,
        lastName,
        role: "USER",
      });

      // Migrate guest sessions if this user was previously a guest
      const guestId = req.cookies.guestId;
      if (guestId) {
        try {
          await storage.migrateGuestSessions(guestId, user.id);
          console.log(`Migrated guest sessions from ${guestId} to user ${user.id}`);
        } catch (migrationError) {
          console.error("Error migrating guest sessions:", migrationError);
          // Don't fail registration if migration fails
        }
      }

      // Log user in by setting session
      req.login({ claims: { sub: user.id } }, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Failed to log in after registration" });
        }
        res.json({ user: sanitizeUser(user), message: "Registration successful" });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  // Username/password login
  const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Log user in
      req.login({ claims: { sub: user.id } }, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Failed to log in" });
        }
        res.json({ user: sanitizeUser(user), message: "Login successful" });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to log in" });
    }
  });

  // ============================================================================
  // PUZZLE ROUTES
  // ============================================================================
  
  app.get('/api/puzzles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // If user is pro, show all puzzles. Otherwise, only free puzzles
      const puzzles = user?.isPro 
        ? await storage.getActivePuzzles()
        : await storage.getFreePuzzles();
      
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      res.status(500).json({ message: "Failed to fetch puzzles" });
    }
  });

  app.get('/api/puzzles/:puzzleId', isAuthenticated, async (req: any, res) => {
    try {
      const puzzle = await storage.getPuzzleById(req.params.puzzleId);
      if (!puzzle) {
        return res.status(404).json({ message: "Puzzle not found" });
      }
      res.json(puzzle);
    } catch (error) {
      console.error("Error fetching puzzle:", error);
      res.status(500).json({ message: "Failed to fetch puzzle" });
    }
  });

  // ============================================================================
  // GAME SESSION ROUTES
  // ============================================================================
  
  app.get('/api/session/:puzzleId', getOrCreateGuestId, async (req: any, res) => {
    try {
      const { puzzleId: slugOrId } = req.params;
      
      // Resolve puzzle from slug or ID
      const puzzle = await resolvePuzzle(slugOrId);
      
      const isAuthenticated = !!req.user;
      const isGuest = !isAuthenticated;
      
      if (isGuest && !puzzle.isFree) {
        return res.status(403).json({
          message: "This puzzle requires a Pro subscription. Please sign in or subscribe."
        });
      }
      
      let session;
      
      if (isAuthenticated) {
        const userId = req.user.claims.sub;
        let userSession = await storage.getUserGameSession(userId, puzzle.id);
        
        if (!userSession) {
          userSession = await storage.createGameSession(userId, puzzle.id);
        }
        
        session = userSession;
      } else {
        const guestId = req.guestId;
        let guestSession = await storage.getGuestSessionByGuestAndPuzzle(guestId, puzzle.id);
        
        if (!guestSession) {
          guestSession = await storage.createGuestSession(guestId, puzzle.id);
        }
        
        session = guestSession;
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error getting session:", error);
      res.status(500).json({ message: "Failed to get game session" });
    }
  });

  // ============================================================================
  // GAMEPLAY ROUTES
  // ============================================================================
  
  app.post("/api/ask", getOrCreateGuestId, async (req: any, res) => {
    try {
      const validation = askQuestionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request",
          message: validation.error.errors.map((e) => e.message).join(", "),
        });
      }

      const { question, puzzleId } = validation.data;
      
      // Resolve puzzle from slug or ID
      const puzzle = await resolvePuzzle(puzzleId);
      
      // Check authentication and puzzle access
      const isAuthenticated = !!req.user;
      const isGuest = !isAuthenticated;
      
      if (isGuest && !puzzle.isFree) {
        return res.status(403).json({
          error: "Authentication required",
          message: "This puzzle requires a Pro subscription. Please sign in or subscribe."
        });
      }

      // Get or create session based on user type
      let session;
      let sessionMessages;
      let sessionDiscoveries;
      let sessionDiscoveredKeys;
      let sessionId;
      
      if (isAuthenticated) {
        const userId = req.user.claims.sub;
        let userSession = await storage.getUserGameSession(userId, puzzle.id);
        if (!userSession) {
          userSession = await storage.createGameSession(userId, puzzle.id);
        }
        session = userSession;
        sessionMessages = session.messages as GameMessage[];
        sessionDiscoveries = session.discoveries as any[];
        sessionDiscoveredKeys = session.discoveredKeys as DiscoveryKey[];
        sessionId = session.id;
      } else {
        const guestId = req.guestId;
        let guestSession = await storage.getGuestSessionByGuestAndPuzzle(guestId, puzzle.id);
        if (!guestSession) {
          guestSession = await storage.createGuestSession(guestId, puzzle.id);
        }
        session = guestSession;
        sessionMessages = session.messages as GameMessage[];
        sessionDiscoveries = session.discoveries as any[];
        sessionDiscoveredKeys = session.discoveredKeys as DiscoveryKey[];
        sessionId = session.id;
      }

      // Build conversation history from stored messages
      const conversationHistory = buildConversationHistory(sessionMessages);

      // Call OpenAI with puzzle-specific prompt
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: puzzle.aiPrompt },
          ...conversationHistory,
          { role: "user", content: question },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        return res.status(500).json({ 
          error: "No response from AI",
          message: "The AI did not return a response. Please try again."
        });
      }

      let parsed;
      try {
        parsed = JSON.parse(responseContent);
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", responseContent);
        return res.status(500).json({ 
          error: "Invalid AI response format",
          message: "The AI returned an invalid response. Please try again."
        });
      }

      const validated = OpenAIResponseSchema.safeParse(parsed);
      if (!validated.success) {
        console.error("OpenAI response validation failed:", validated.error, "Response:", parsed);
        return res.status(500).json({ 
          error: "Invalid AI response structure",
          message: "The AI response was malformed. Please try again."
        });
      }

      const answer = normalizeAnswer(validated.data.answer);
      const explanation = validated.data.explanation;
      let discoveryKey = validated.data.discoveryKey;
      let discoveryLabel = validated.data.discoveryLabel;

      // Server-side safety net: If AI answered YES but missed a discovery, catch it
      if (answer === "YES" && !discoveryKey) {
        const questionLower = question.toLowerCase();
        
        // ALBATROSS PUZZLE PATTERNS
        // Check for rescue keywords
        if (/rescu(ed|e)|saved|found|picked up|escape|got off|made it back/i.test(questionLower)) {
          discoveryKey = "RESCUED";
          discoveryLabel = "They were eventually rescued";
        }
        // Check for cannibalism keywords
        else if (/cannibal(ism|istic)?|eating people|eating humans|eating flesh|eating bodies|ate people|ate humans|resort to eating|eat.*human/i.test(questionLower)) {
          discoveryKey = "CANNIBALISM";
          discoveryLabel = "They resorted to cannibalism";
        }
        // Check for deception keywords
        else if (/lied to|deceived|tricked|fooled|misled|didn'?t know what/i.test(questionLower)) {
          discoveryKey = "DECEPTION";
          discoveryLabel = "He was deceived about what he was eating";
        }
        // Check for suicide keywords
        else if (/kill himself|suicide|shot himself|take.*life|end.*life/i.test(questionLower)) {
          discoveryKey = "SUICIDE";
          discoveryLabel = "He took his own life";
        }
        // Check for shipwreck keywords
        else if (/sink|sank|sinking|shipwreck|wreck|crash/i.test(questionLower)) {
          discoveryKey = "VESSEL_SANK";
          discoveryLabel = "The vessel sank at sea";
        }
        // Check for stranded/survivors keywords
        else if (/stranded|stuck|trapped|marooned|abandoned|other survivors|other people|others.*island|with.*survivor|survivor.*with/i.test(questionLower)) {
          discoveryKey = "STRANDED";
          discoveryLabel = "He was stranded with other survivors";
        }
        // Check for family death keywords
        else if (/family.*die|family.*dead|family.*killed|family.*perish/i.test(questionLower)) {
          discoveryKey = "FAMILY_DIED";
          discoveryLabel = "His family died";
        }
        
        // LIGHTHOUSE KEEPER PATTERNS
        else if (/lighthouse.*keeper|keeper.*job|worked.*lighthouse/i.test(questionLower)) {
          discoveryKey = "LIGHTHOUSE_JOB";
          discoveryLabel = "He was the lighthouse keeper";
        }
        else if (/lamp.*broke|lamp.*broken|light.*broke|light.*failed|malfunction/i.test(questionLower)) {
          discoveryKey = "LAMP_BROKE";
          discoveryLabel = "The lamp broke";
        }
        else if (/ship.*crash|ship.*wreck|vessel.*crash|hit.*rocks|accident.*sea/i.test(questionLower)) {
          discoveryKey = "SHIP_CRASH";
          discoveryLabel = "A ship crashed on the rocks";
        }
        else if (/son.*died|son.*dead|son.*killed|son.*ship|son.*aboard/i.test(questionLower)) {
          discoveryKey = "SON_DIED";
          discoveryLabel = "His son died in the accident";
        }
        else if (/negligence|negligent|failed.*duty|didn'?t maintain|poor maintenance/i.test(questionLower)) {
          discoveryKey = "NEGLIGENCE";
          discoveryLabel = "He was negligent in his duties";
        }
        else if (/his.*responsibility|his.*duty|his.*fault|caused.*death/i.test(questionLower)) {
          discoveryKey = "RESPONSIBILITY";
          discoveryLabel = "It was his responsibility";
        }
        
        // LAST PHONE CALL PATTERNS
        else if (/daughter|her.*daughter|child|her.*child/i.test(questionLower)) {
          discoveryKey = "DAUGHTER";
          discoveryLabel = "It was about her daughter";
        }
        else if (/kidnapped|kidnapping|abducted|taken|stolen/i.test(questionLower)) {
          discoveryKey = "KIDNAPPED";
          discoveryLabel = "Someone was kidnapped";
        }
        else if (/years.*ago|long.*time|many.*years|decades/i.test(questionLower)) {
          discoveryKey = "YEARS_AGO";
          discoveryLabel = "It happened years ago";
        }
        else if (/never.*found|missing|lost|couldn'?t find/i.test(questionLower)) {
          discoveryKey = "NEVER_FOUND";
          discoveryLabel = "She was never found";
        }
        else if (/searching|looking.*for|seeking|trying.*find/i.test(questionLower)) {
          discoveryKey = "SEARCHING";
          discoveryLabel = "She had been searching";
        }
        else if (/detective.*call|detective.*found|investigator|police.*called/i.test(questionLower)) {
          discoveryKey = "DETECTIVE_CALL";
          discoveryLabel = "A detective called with news";
        }
        else if (/found.*alive|still.*alive|survived|discovered.*alive/i.test(questionLower)) {
          discoveryKey = "FOUND_ALIVE";
          discoveryLabel = "She was found alive";
        }
        else if (/reunion|reunite|see.*again|together.*again/i.test(questionLower)) {
          discoveryKey = "REUNION";
          discoveryLabel = "They would reunite";
        }
        
        // MIRROR ROOM PATTERNS
        else if (/con.*artist|criminal|fraud|scammer|deceiver/i.test(questionLower)) {
          discoveryKey = "CON_ARTIST";
          discoveryLabel = "He was a con artist";
        }
        else if (/fake.*identit|false.*identity|assumed.*names|pretended.*to.*be/i.test(questionLower)) {
          discoveryKey = "FAKE_IDENTITIES";
          discoveryLabel = "He used fake identities";
        }
        else if (/pretending|faking|lying.*identity|hiding.*identity/i.test(questionLower)) {
          discoveryKey = "PRETENDING";
          discoveryLabel = "He was pretending to be someone else";
        }
        else if (/therapy|therapeutic|designed.*therapy|installation|treatment/i.test(questionLower)) {
          discoveryKey = "THERAPY_ROOM";
          discoveryLabel = "It was a therapy installation";
        }
        else if (/true.*self|real.*self|actual.*self|who.*really.*was/i.test(questionLower)) {
          discoveryKey = "TRUE_SELF";
          discoveryLabel = "He saw his true self";
        }
        else if (/real.*face|actual.*face|own.*face|true.*appearance/i.test(questionLower)) {
          discoveryKey = "REAL_FACE";
          discoveryLabel = "He saw his real face";
        }
        else if (/confrontation|faced.*himself|forced.*see|had.*confront/i.test(questionLower)) {
          discoveryKey = "CONFRONTATION";
          discoveryLabel = "He confronted himself";
        }
        else if (/redemption|change|transformation|reclaim.*identity|stop.*running/i.test(questionLower)) {
          discoveryKey = "REDEMPTION";
          discoveryLabel = "He chose redemption";
        }
        
        // EMPTY RESTAURANT PATTERNS
        else if (/nuclear.*plant|power.*plant|reactor|nuclear.*facility/i.test(questionLower)) {
          discoveryKey = "NUCLEAR_PLANT";
          discoveryLabel = "There was a nuclear plant nearby";
        }
        else if (/emergency.*siren|alarm|warning.*siren|alert/i.test(questionLower)) {
          discoveryKey = "EMERGENCY_SIRENS";
          discoveryLabel = "Emergency sirens went off";
        }
        else if (/meltdown|reactor.*failure|nuclear.*accident|disaster/i.test(questionLower)) {
          discoveryKey = "REACTOR_MELTDOWN";
          discoveryLabel = "There was a reactor meltdown";
        }
        else if (/evacuation|evacuated|had.*leave|forced.*leave/i.test(questionLower)) {
          discoveryKey = "EVACUATION";
          discoveryLabel = "Everyone was evacuated";
        }
        else if (/left.*immediately|ran.*out|fled|escaped.*quickly/i.test(questionLower)) {
          discoveryKey = "LEFT_IMMEDIATELY";
          discoveryLabel = "They left immediately";
        }
        else if (/town.*abandoned|ghost.*town|no.*one.*lives|deserted/i.test(questionLower)) {
          discoveryKey = "TOWN_ABANDONED";
          discoveryLabel = "The town was abandoned";
        }
        else if (/exclusion.*zone|restricted.*area|forbidden.*zone|quarantine/i.test(questionLower)) {
          discoveryKey = "EXCLUSION_ZONE";
          discoveryLabel = "It's now an exclusion zone";
        }
        else if (/frozen.*time|preserved|unchanged|stuck.*moment/i.test(questionLower)) {
          discoveryKey = "FROZEN_TIME";
          discoveryLabel = "It's frozen in time";
        }
        
        // SILENT CONCERT PATTERNS
        else if (/memorial|memorial.*service|tribute.*event|remembrance/i.test(questionLower)) {
          discoveryKey = "MEMORIAL";
          discoveryLabel = "It was a memorial";
        }
        else if (/musician.*died|artist.*died|performer.*died|singer.*died/i.test(questionLower)) {
          discoveryKey = "MUSICIAN_DIED";
          discoveryLabel = "A musician had died";
        }
        else if (/tribute|honor|honoring|paying.*respects/i.test(questionLower)) {
          discoveryKey = "TRIBUTE";
          discoveryLabel = "It was a tribute";
        }
        else if (/silence.*performance|silence.*intentional|deliberate.*silence/i.test(questionLower)) {
          discoveryKey = "SILENCE_PERFORMANCE";
          discoveryLabel = "The silence was the performance";
        }
        else if (/absence|what'?s.*missing|what'?s.*gone|loss/i.test(questionLower)) {
          discoveryKey = "ABSENCE";
          discoveryLabel = "It represented absence";
        }
        else if (/beloved|famous|popular|well-loved|cherished/i.test(questionLower)) {
          discoveryKey = "BELOVED_ARTIST";
          discoveryLabel = "The artist was beloved";
        }
        else if (/tragic.*death|died.*tragically|untimely.*death|sudden.*death/i.test(questionLower)) {
          discoveryKey = "TRAGIC_DEATH";
          discoveryLabel = "The death was tragic";
        }
        else if (/powerful.*tribute|moving.*tribute|meaningful.*gesture/i.test(questionLower)) {
          discoveryKey = "POWERFUL_TRIBUTE";
          discoveryLabel = "It was a powerful tribute";
        }
      }

      const playerMessage: GameMessage = {
        id: sessionMessages.length,
        type: "player",
        content: question,
        timestamp: Date.now(),
      };

      const systemMessage: GameMessage = {
        id: sessionMessages.length + 1,
        type: "system",
        content: explanation,
        response: answer,
        timestamp: Date.now(),
      };

      const updatedMessages = [...sessionMessages, playerMessage, systemMessage];
      const discoveries = sessionDiscoveries as Discovery[];
      const discoveredKeys = sessionDiscoveredKeys;

      let newDiscovery: Discovery | undefined;
      if (discoveryKey && discoveryLabel) {
        const key = discoveryKey as DiscoveryKey;
        const topic = getDiscoveryTopic(key);
        const stage = getDiscoveryStage(key);
        
        // Check if we already have a discovery for this topic
        const existingDiscoveryIndex = discoveries.findIndex(
          d => d.topic === topic
        );
        
        if (existingDiscoveryIndex >= 0) {
          // Topic already exists - check if this is an evolution
          const existingDiscovery = discoveries[existingDiscoveryIndex];
          if (stage === "evolved" && existingDiscovery.stage === "base") {
            // Evolve the existing discovery
            existingDiscovery.key = key;
            existingDiscovery.label = discoveryLabel;
            existingDiscovery.stage = "evolved";
            existingDiscovery.evolutionTimestamp = Date.now();
            newDiscovery = existingDiscovery;
          }
        } else {
          // New topic discovery
          newDiscovery = {
            key,
            topic,
            label: discoveryLabel,
            timestamp: Date.now(),
            stage,
          };
          discoveries.push(newDiscovery);
        }

        // Update discovered keys set
        if (!discoveredKeys.includes(key)) {
          discoveredKeys.push(key);
        }
      }

      // Check for completion
      const discoveredTopics = new Set(discoveries.map(d => d.topic));
      const hasCriticalTopics = CRITICAL_TOPICS.every(t => discoveredTopics.has(t));
      const isComplete = discoveredTopics.size >= MIN_REQUIRED_TOPICS && hasCriticalTopics;

      const questionCount = Math.floor(updatedMessages.length / 2);

      // Update session in database based on user type
      if (isAuthenticated) {
        if (isComplete) {
          await storage.completeGameSession(sessionId, questionCount);
        } else {
          await storage.updateGameSession(
            sessionId,
            updatedMessages,
            discoveries,
            discoveredKeys,
            questionCount
          );
        }
      } else {
        if (isComplete) {
          await storage.completeGuestSession(sessionId, questionCount);
        } else {
          await storage.updateGuestSession(
            sessionId,
            updatedMessages,
            discoveries,
            discoveredKeys,
            questionCount
          );
        }
      }

      const response: AskQuestionResponse = {
        sessionId: session.id,
        response: answer,
        content: explanation,
        discovery: newDiscovery,
        isComplete,
        discoveries,
        discoveredKeys,
        progress: {
          total: 8,
          discovered: discoveredTopics.size,
        },
      };

      res.json(response);
    } catch (error: any) {
      console.error("Error in /api/ask:", error);
      res.status(500).json({ 
        error: "Internal server error",
        message: error.message || "An unexpected error occurred"
      });
    }
  });

  app.post("/api/reset", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { puzzleId } = req.body;
      
      // Resolve puzzle from slug or ID
      const puzzle = await resolvePuzzle(puzzleId);
      
      // Create new session (old ones remain in DB for history)
      const session = await storage.createGameSession(userId, puzzle.id);
      
      res.json({ 
        sessionId: session.id,
        message: "Game reset successfully" 
      });
    } catch (error: any) {
      console.error("Error in /api/reset:", error);
      res.status(500).json({ 
        error: "Failed to reset game",
        message: error.message 
      });
    }
  });

  // ============================================================================
  // LEADERBOARD ROUTES
  // ============================================================================
  
  app.get('/api/leaderboard/:puzzleId', async (req, res) => {
    try {
      const { puzzleId: slugOrId } = req.params;
      
      // Resolve puzzle from slug or ID
      const puzzle = await resolvePuzzle(slugOrId);
      
      const leaderboard = await storage.getPuzzleLeaderboard(puzzle.id, 100);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // ============================================================================
  // STRIPE ONE-TIME PAYMENT ROUTES (Lifetime Pro Access)
  // ============================================================================
  
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user is already Pro
      if (user.isPro) {
        return res.json({
          message: "User already has Pro access",
          clientSecret: null,
        });
      }
      
      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(userId, customerId, '');
      }

      // Create one-time payment intent ($1.00 for lifetime Pro access)
      // Using Price ID: price_1SThzsLCLO3DdTe4UNIU6kg0
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 100, // $1.00 in cents
        currency: 'usd',
        customer: customerId,
        metadata: {
          userId: user.id,
          priceId: 'price_1SThzsLCLO3DdTe4UNIU6kg0',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error: any) {
      console.error("Error creating payment:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Note: No cancellation needed for one-time payments
  // Keeping this endpoint for API compatibility but it's not applicable
  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res) => {
    try {
      res.status(400).json({ 
        error: "This is a lifetime access purchase, not a subscription. Cancellation is not applicable." 
      });
    } catch (error: any) {
      console.error("Error in cancel endpoint:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Stripe webhook for one-time payment events (lifetime Pro access)
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).send('Missing stripe-signature header');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle payment events for lifetime Pro access
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const customerId = paymentIntent.customer as string;
          const userId = paymentIntent.metadata.userId;
          
          if (userId) {
            // Grant lifetime Pro access
            await storage.updateUserProStatus(userId, true);
            console.log(`✅ Granted lifetime Pro access to user ${userId}`);
          }
          break;
        }
        
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.error(`❌ Payment failed for user ${paymentIntent.metadata.userId}`);
          break;
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // ============================================================================
  // ADMIN ROUTES
  // ============================================================================

  // Admin authentication middleware
  function isAdminAuthenticated(req: Request, res: Response, next: NextFunction) {
    const session = (req as any).session;
    if (session?.isAdmin) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Admin login
  const adminLoginSchema = z.object({
    username: z.string(),
    password: z.string(),
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
      const { username, password } = adminLoginSchema.parse(req.body);
      
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminUsername || !adminPassword) {
        console.error("Admin credentials not configured");
        return res.status(500).json({ message: "Admin access not configured" });
      }

      if (username === adminUsername && password === adminPassword) {
        // Regenerate session ID to prevent session fixation
        (req as any).session.regenerate((err: any) => {
          if (err) {
            console.error("Session regeneration error:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          (req as any).session.isAdmin = true;
          return res.json({ message: "Login successful" });
        });
      } else {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Admin logout
  app.post('/api/admin/logout', isAdminAuthenticated, async (req, res) => {
    try {
      // Destroy the session completely to invalidate the cookie
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error("Session destruction error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        // Clear the session cookie
        res.clearCookie('connect.sid');
        res.json({ message: "Logout successful" });
      });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Admin stats
  app.get('/api/admin/stats', isAdminAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin users list
  app.get('/api/admin/users', isAdminAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Sanitize all users before sending
      const sanitizedUsers = users.map(sanitizeUser);
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin sessions list
  app.get('/api/admin/sessions', isAdminAuthenticated, async (req, res) => {
    try {
      const sessions = await storage.getAllSessionsWithDetails();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  // Admin puzzles list
  app.get('/api/admin/puzzles', isAdminAuthenticated, async (req, res) => {
    try {
      const puzzles = await storage.getAllPuzzles();
      res.json(puzzles);
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      res.status(500).json({ message: "Failed to fetch puzzles" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
