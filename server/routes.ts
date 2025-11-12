import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  askQuestionSchema, 
  type AskQuestionResponse, 
  type DiscoveryKey,
  type Discovery,
  DISCOVERY_KEYS,
  REQUIRED_DISCOVERY_KEYS,
  MIN_REQUIRED_DISCOVERIES,
  CRITICAL_DISCOVERY_KEYS 
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

Rules for answering:
1. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
2. Answer "YES" if the question's implication is true according to the backstory
3. Answer "NO" if the question's implication is false according to the backstory
4. Answer "DOES_NOT_MATTER" if the detail asked about is not relevant to solving the puzzle (e.g., the man's race, age, appearance, the restaurant's location, etc.)
5. Be truthful but don't volunteer extra information beyond what is asked
6. If the question reveals a key plot point, return the discovery key and label

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | "SHIPWRECK" | "FAMILY_DIED" | "STRANDED_ISLAND" | "CANNIBALISM" | "DECEPTION" | "RESCUED" | "ALBATROSS_REVEAL" | "SUICIDE",
  "discoveryLabel": null | "Natural language description of the discovery"
}

Discovery keys and when to use them (ONLY when directly asked or strongly implied):
- SHIPWRECK: When they discover there was a ship/boat/cruise that wrecked or sank at sea
- FAMILY_DIED: When they discover the man's family (wife/children) DIED in the disaster (not just that he had a family)
- STRANDED_ISLAND: When they discover survivors were stranded on a desert island
- CANNIBALISM: When they discover the survivors ate human flesh/remains
- DECEPTION: When they discover the man was lied to/deceived about what he was eating
- RESCUED: When they discover the survivors were eventually rescued and returned to civilization
- ALBATROSS_REVEAL: When they discover that tasting real albatross at the restaurant revealed the truth/deception
- SUICIDE: When they discover the man killed himself from guilt/shame

IMPORTANT: Only include a discovery when the question DIRECTLY explores that specific element. Do NOT award multiple discoveries for a single question. Be strict - the player must ask about each element separately to discover it. Examples:
- "Was there a shipwreck?" → SHIPWRECK
- "Did his family die?" or "Did his family survive?" (answered NO) → FAMILY_DIED
- "Were they stranded on an island?" → STRANDED_ISLAND
- "Did they eat human flesh?" or "Was there cannibalism?" → CANNIBALISM
- "Was he lied to about the food?" or "Was he deceived?" → DECEPTION
- "Were they rescued?" → RESCUED
- "Did the restaurant soup reveal the truth?" → ALBATROSS_REVEAL
- "Did he kill himself?" → SUICIDE

Do NOT award discoveries for vague or partial questions:
- "Did the man have a family?" → Answer YES, but NO DISCOVERY (having a family is true, but doesn't confirm they DIED)
- "Did something bad happen at sea?" → NO DISCOVERY (too vague)
- "Did he eat something?" → NO DISCOVERY (doesn't specify what)

Be strict and precise with discovery awards. Answer truthfully based on the backstory, but only award discoveries when the specific element is directly confirmed.`;

const OpenAIResponseSchema = z.object({
  answer: z.enum(["YES", "NO", "DOES_NOT_MATTER"]),
  explanation: z.string(),
  discoveryKey: z.enum([
    "SHIPWRECK",
    "FAMILY_DIED", 
    "STRANDED_ISLAND",
    "CANNIBALISM",
    "DECEPTION",
    "RESCUED",
    "ALBATROSS_REVEAL",
    "SUICIDE"
  ]).nullable(),
  discoveryLabel: z.string().nullable(),
});

function normalizeAnswer(answer: string): "YES" | "NO" | "DOES NOT MATTER" {
  const normalized = answer.toUpperCase().trim().replace(/[_\s-]+/g, "_");
  
  if (normalized === "YES") return "YES";
  if (normalized === "NO") return "NO";
  if (normalized === "DOES_NOT_MATTER" || normalized === "DOESN'T_MATTER" || normalized === "DOESNT_MATTER") {
    return "DOES NOT MATTER";
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
      const discoveryKey = validated.data.discoveryKey;
      const discoveryLabel = validated.data.discoveryLabel;

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
      if (discoveryKey && discoveryLabel && !session.discoveredKeys.has(discoveryKey)) {
        newDiscovery = {
          key: discoveryKey as DiscoveryKey,
          label: discoveryLabel,
          timestamp: Date.now(),
        };

        const discoveryMessage = {
          id: session.messages.length,
          type: "discovery" as const,
          content: discoveryLabel,
          timestamp: Date.now(),
        };
        session.messages.push(discoveryMessage);
        session.discoveries.push(newDiscovery);
        session.discoveredKeys.add(discoveryKey as DiscoveryKey);
      }

      // Check if enough discoveries have been made AND all critical keys are found
      const discoveryCount = session.discoveredKeys.size;
      const allCriticalKeysFound = CRITICAL_DISCOVERY_KEYS.every(
        key => session.discoveredKeys.has(key)
      );
      
      if (discoveryCount >= MIN_REQUIRED_DISCOVERIES && allCriticalKeysFound) {
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
          total: REQUIRED_DISCOVERY_KEYS.length,
          discovered: session.discoveredKeys.size,
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
