import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  askQuestionSchema, 
  type AskQuestionResponse, 
  type DiscoveryKey,
  type Discovery,
  DISCOVERY_KEYS,
  MIN_REQUIRED_TOPICS,
  CRITICAL_TOPICS,
  getDiscoveryTopic,
  getDiscoveryStage
} from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PUZZLE_BACKSTORY = `
The man was on a ship or cruise ship with his wife and children. There was a shipwreck where they were stranded on a desert island. The man survived, but his family did not. With no options for food, the remaining survivors suggested cannibalism, but the man refused to participate, especially when it came to potentially eating the remains of his own family. But the man had skills and talents that made him useful to the rest of the survivors on the island, so they wanted to keep him alive. To convince him to eat the human remains, the other survivors lied to the man and said that the meat was albatross. And this was his primary source of food for many months that he had lived on this island before they were eventually rescued. Later, back in civilization, the man discovered a restaurant that served albatross. After trying the soup, he quickly realized that he had never tasted this before and then realized that he had been unknowingly participating in cannibalism while stranded on the island. He couldn't live with the guilt, so he immediately decided to take his own life.
`;

const SYSTEM_PROMPT = `You are a game master for the classic "Albatross Soup" lateral thinking puzzle. Your role is to answer yes/no questions from players trying to solve the mystery.

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
- STRANDED: "Were they stranded?" "Were they stuck?"
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
    "SUICIDE"
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
  if (normalized === "ONE_QUESTION_AT_A_TIME_PLEASE" || normalized === "MULTIPLE_QUESTIONS") {
    return "ONE_QUESTION_AT_A_TIME_PLEASE";
  }
  
  throw new Error(`Invalid answer format: ${answer}`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/ask", async (req, res) => {
    try {
      const validatedData = askQuestionSchema.parse(req.body);
      const { sessionId, question } = validatedData;

      let session = sessionId ? await storage.getGameSession(sessionId) : null;
      
      if (!session) {
        session = await storage.createGameSession();
      }

      const conversationHistory = session.messages
        .filter(m => m.type === "player" || m.type === "system")
        .slice(-10)
        .map(m => ({
          role: m.type === "player" ? "user" as const : "assistant" as const,
          content: m.type === "player" ? m.content : m.content,
        }));

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationHistory,
          { role: "user", content: question },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) {
        return res.status(500).json({ 
          error: "No response from AI",
          message: "The AI service did not return a response. Please try again."
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
        // Check for stranded keywords
        else if (/stranded|stuck|trapped|marooned|abandoned/i.test(questionLower)) {
          discoveryKey = "STRANDED";
          discoveryLabel = "They were stranded on the island";
        }
        // Check for family death keywords
        else if (/family.*die|family.*dead|family.*killed|family.*perish/i.test(questionLower)) {
          discoveryKey = "FAMILY_DIED";
          discoveryLabel = "His family died";
        }
      }

      const playerMessage = {
        id: session.messages.length,
        type: "player" as const,
        content: question,
        timestamp: Date.now(),
      };

      const systemMessage = {
        id: session.messages.length + 1,
        type: "system" as const,
        content: explanation,
        response: answer,
        timestamp: Date.now(),
      };

      session.messages.push(playerMessage, systemMessage);

      let newDiscovery: Discovery | undefined;
      if (discoveryKey && discoveryLabel) {
        const key = discoveryKey as DiscoveryKey;
        const topic = getDiscoveryTopic(key);
        const stage = getDiscoveryStage(key);
        
        // Check if we already have a discovery for this topic
        const existingDiscoveryIndex = session.discoveries.findIndex(
          d => d.topic === topic
        );
        
        if (existingDiscoveryIndex >= 0) {
          // Topic already exists - check if this is an evolution
          const existingDiscovery = session.discoveries[existingDiscoveryIndex];
          if (stage === "evolved" && existingDiscovery.stage === "base") {
            // Evolve the existing discovery
            existingDiscovery.key = key;
            existingDiscovery.label = discoveryLabel;
            existingDiscovery.stage = stage;
            existingDiscovery.evolutionTimestamp = Date.now();
            newDiscovery = existingDiscovery;
          }
          // If same stage or trying to go backwards, ignore
        } else {
          // New topic - create discovery
          newDiscovery = {
            key,
            topic,
            label: discoveryLabel,
            timestamp: Date.now(),
            stage,
          };
          session.discoveries.push(newDiscovery);
          session.discoveredTopics.add(topic);
        }
        
        // Always track the key for auditing
        session.discoveredKeys.add(key);
      }

      // Check completion based on topics and critical topics
      const topicCount = session.discoveredTopics.size;
      const allCriticalTopicsFound = CRITICAL_TOPICS.every(
        topic => session.discoveredTopics.has(topic)
      );
      
      if (topicCount >= MIN_REQUIRED_TOPICS && allCriticalTopicsFound) {
        session.isComplete = true;
      }

      await storage.updateGameSession(session.id, session);

      const response: AskQuestionResponse = {
        sessionId: session.id,
        response: answer,
        content: explanation,
        discovery: newDiscovery,
        isComplete: session.isComplete,
        discoveries: session.discoveries,
        discoveredKeys: Array.from(session.discoveredKeys),
        progress: {
          total: 8,
          discovered: session.discoveredTopics.size,
        },
      };

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request",
          message: "Your question could not be processed. Please check your input."
        });
      }

      console.error("Error processing question:", error);
      res.status(500).json({ 
        error: "Server error",
        message: "An unexpected error occurred. Please try again."
      });
    }
  });

  app.post("/api/reset", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (sessionId) {
        await storage.deleteGameSession(sessionId);
      }

      const newSession = await storage.createGameSession();
      res.json({ sessionId: newSession.id });
    } catch (error) {
      console.error("Error resetting game:", error);
      res.status(500).json({ 
        error: "Failed to reset game",
        message: "Could not reset the game. Please refresh the page."
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
