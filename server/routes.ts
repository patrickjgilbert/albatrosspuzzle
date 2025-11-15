import type { Express } from "express";
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
// ROUTES
// ============================================================================

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  
  // Seed Albatross puzzle
  await ensureAlbatrossPuzzle();

  // ============================================================================
  // AUTH ROUTES
  // ============================================================================
  
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
  
  app.get('/api/session/:puzzleId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { puzzleId: slugOrId } = req.params;
      
      // Resolve puzzle from slug or ID
      const puzzle = await resolvePuzzle(slugOrId);
      
      // Get or create game session using the actual puzzle ID
      let session = await storage.getUserGameSession(userId, puzzle.id);
      
      if (!session) {
        session = await storage.createGameSession(userId, puzzle.id);
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
  
  app.post("/api/ask", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      // Get or create game session
      let session = await storage.getUserGameSession(userId, puzzle.id);
      if (!session) {
        session = await storage.createGameSession(userId, puzzle.id);
      }

      // Build conversation history from stored messages
      const messages = session.messages as GameMessage[];
      const conversationHistory = buildConversationHistory(messages);

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
      }

      const playerMessage: GameMessage = {
        id: messages.length,
        type: "player",
        content: question,
        timestamp: Date.now(),
      };

      const systemMessage: GameMessage = {
        id: messages.length + 1,
        type: "system",
        content: explanation,
        response: answer,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, playerMessage, systemMessage];
      const discoveries = session.discoveries as Discovery[];
      const discoveredKeys = session.discoveredKeys as DiscoveryKey[];

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

      // Update session in database
      if (isComplete) {
        await storage.completeGameSession(session.id, questionCount);
      } else {
        await storage.updateGameSession(
          session.id,
          updatedMessages,
          discoveries,
          discoveredKeys,
          questionCount
        );
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
  // STRIPE SUBSCRIPTION ROUTES
  // ============================================================================
  
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user already has an active subscription
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        });
        
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          const invoice = subscription.latest_invoice as any;
          const paymentIntent = invoice?.payment_intent as any;
          
          return res.json({
            subscriptionId: subscription.id,
            clientSecret: paymentIntent?.client_secret || null,
          });
        }
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

      // Create subscription ($1/month = 100 cents)
      // Using the product ID from Stripe: prod_TQZ8Ei9K6Y46XJ
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price_data: {
            currency: 'usd',
            product: 'prod_TQZ8Ei9K6Y46XJ', // Your Stripe Product ID
            recurring: {
              interval: 'month',
            },
            unit_amount: 100, // $1.00 in cents
          },
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      // Save subscription ID
      await storage.updateUserStripeInfo(userId, customerId, subscription.id);
  
      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent as any;
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret || null,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/cancel-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      await storage.updateUserProStatus(userId, false);
      
      res.json({ message: "Subscription cancelled successfully" });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Stripe webhook for subscription status updates
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

    // Handle subscription events
    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          // Find user by Stripe customer ID
          const customer = await stripe.customers.retrieve(customerId);
          const userId = (customer as Stripe.Customer).metadata.userId;
          
          if (userId) {
            const isActive = subscription.status === 'active' || subscription.status === 'trialing';
            const periodEnd = (subscription as any).current_period_end;
            const expiresAt = periodEnd ? new Date(periodEnd * 1000) : undefined;
            
            await storage.updateUserProStatus(userId, isActive, expiresAt);
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const customer = await stripe.customers.retrieve(customerId);
          const userId = (customer as Stripe.Customer).metadata.userId;
          
          if (userId) {
            await storage.updateUserProStatus(userId, false);
          }
          break;
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
