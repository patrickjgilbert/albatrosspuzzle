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

Rules for answering:
1. If the player asks multiple questions at once (using "and", "or", or multiple question marks), answer with "MULTIPLE_QUESTIONS"
2. Answer with ONLY "YES", "NO", or "DOES_NOT_MATTER" (use underscores, all caps)
3. Answer "YES" if the question's implication is true according to the backstory
4. Answer "NO" if the question's implication is false according to the backstory
5. Answer "DOES_NOT_MATTER" ONLY if the detail is completely irrelevant to the puzzle (e.g., the man's race, age, appearance, the restaurant's location, the weather, etc.)
6. Be truthful but don't volunteer extra information beyond what is asked
7. If the question reveals a key plot point, return the discovery key and label

Important clarifications:
- "Was there food on the island?" → NO (there was no food, which is why they resorted to cannibalism)
- "Is albatross a bird?" → YES (this is factually true and relevant to understanding the puzzle)
- Questions about what an albatross is are relevant and should be answered truthfully
- Questions about survival circumstances (food, water, shelter) are relevant and should be answered YES or NO based on the backstory
- Only answer "DOES_NOT_MATTER" for details that have absolutely no bearing on the puzzle's solution (e.g., man's appearance, weather, restaurant location)

Respond ONLY with valid JSON in this exact format:
{
  "answer": "YES" | "NO" | "DOES_NOT_MATTER" | "MULTIPLE_QUESTIONS",
  "explanation": "Brief explanation (1-2 sentences max)",
  "discoveryKey": null | one of the discovery keys listed below,
  "discoveryLabel": null | "Natural language description of the discovery"
}

Progressive Discovery System - Award based on what the player SPECIFICALLY asked about:

BASE discoveries (general information):
- VESSEL: "Was he on a boat/ship?" → VESSEL ("He was on a vessel")
- FAMILY: "Did he have a family?" → FAMILY ("He had a family")
- ISLAND: "Was there an island?" → ISLAND ("There was an island")
- NO_FOOD: "Was there food on the island?" (answer NO) → NO_FOOD ("There was no food on the island")
- RESTAURANT: "Did he go to a restaurant?" → RESTAURANT ("He went to a restaurant")
- GUILT: "Did he feel guilty/bad?" → GUILT ("He felt overwhelming guilt")

EVOLVED discoveries (more specific details):
- VESSEL_SANK: "Did the ship/boat sink?" or "Was there a shipwreck?" → VESSEL_SANK ("The vessel sank at sea")
- FAMILY_DIED: "Did his family die?" → FAMILY_DIED ("His family died")
- STRANDED: "Were they stranded on the island?" → STRANDED ("They were stranded on the island")
- CANNIBALISM: "Did they eat human flesh?" or "Was there cannibalism?" → CANNIBALISM ("They resorted to cannibalism")
- DECEPTION: "Was he lied to?" or "Was he deceived about what he ate?" → DECEPTION ("He was deceived about what he was eating")
- RESCUED: "Were they rescued?" → RESCUED ("They were eventually rescued")
- ALBATROSS_REVEAL: "Did the real albatross soup reveal the truth?" → ALBATROSS_REVEAL ("Tasting real albatross revealed the deception")
- SUICIDE: "Did he kill himself?" → SUICIDE ("He took his own life")

IMPORTANT RULES:
1. Award the BASE version first if player only asks general questions
2. Award the EVOLVED version if player asks specific details OR if they already have the base version
3. Only award ONE discovery per question - the most specific one that matches what was asked
4. Be strict - don't jump ahead to evolved discoveries unless directly asked

Examples:
- "Was the man on a boat?" → VESSEL (base)
- Later: "Did the boat sink?" → VESSEL_SANK (evolved)
- "Did he have a family?" → FAMILY (base)
- Later: "Did his family die?" → FAMILY_DIED (evolved)
- "Was there cannibalism?" → CANNIBALISM (evolved, directly asked about it)

Be strict and precise. Only award what was specifically asked about.`;

const OpenAIResponseSchema = z.object({
  answer: z.enum(["YES", "NO", "DOES_NOT_MATTER", "MULTIPLE_QUESTIONS"]),
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
  ]).nullable(),
  discoveryLabel: z.string().nullable(),
});

function normalizeAnswer(answer: string): "YES" | "NO" | "DOES NOT MATTER" | "ONE QUESTION AT A TIME, PLEASE" {
  const normalized = answer.toUpperCase().trim().replace(/[_\s-]+/g, "_");
  
  if (normalized === "YES") return "YES";
  if (normalized === "NO") return "NO";
  if (normalized === "DOES_NOT_MATTER" || normalized === "DOESN'T_MATTER" || normalized === "DOESNT_MATTER") {
    return "DOES NOT MATTER";
  }
  if (normalized === "MULTIPLE_QUESTIONS") {
    return "ONE QUESTION AT A TIME, PLEASE";
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
