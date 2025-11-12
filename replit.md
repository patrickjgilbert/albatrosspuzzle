# Albatross Riddle Game

## Overview

An interactive web-based lateral thinking puzzle game where players solve the classic "Albatross Soup" mystery through yes/no questions. The application uses AI (OpenAI) to act as a game master, responding to player questions and tracking their progress toward discovering the dark truth behind the puzzle. Players engage in a chat-like interface that progressively reveals key story elements as they ask the right questions.

## Recent Changes (November 2025)

**UX and Discovery Improvements (Latest - November 12, 2025)**
- Fixed chat layout to keep puzzle prompt and detective board always visible while only chat messages scroll
- Optimized space allocation: larger input box (h-14), smaller post-it notes (96-112px), compact puzzle prompt
- Improved conversation visibility: 5+ messages visible in chat area without scrolling
- Enhanced AI prompt with keyword-based intent matching to ensure discoveries are awarded reliably
- Implemented server-side regex safety net to catch missed discoveries when AI doesn't award them
- Generated new distinct images: cannibalism cooking pot, stranded survivor, suicide weapon sketch
- Unified response token format to use underscores throughout system (DOES_NOT_MATTER, ONE_QUESTION_AT_A_TIME_PLEASE)
- Added user-friendly display formatting in ChatMessage component (converts underscores to spaces for display)
- All end-to-end tests passing: layout scrolls correctly, story-relevant questions award discoveries, response badges format properly

**Detective Board with Progressive Post-It Notes**
- Implemented topic-based progressive discovery system where post-it notes evolve as players uncover more details
- Post-it notes update in-place rather than duplicating when discoveries evolve (e.g., boat→sinking ship, family→family with red X)
- Generated sketch images for both base and evolved states (floating boat, sinking ship, family, red X overlay, etc.)
- Created DetectiveBoard component with animated post-it notes using Framer Motion
- PostItNote component dynamically shows appropriate images and overlays based on discovery stage
- Progress counter tracks unique topics (8 total), not individual discovery keys
- Completion requires 6+ unique topics AND all 3 critical topics (DECEPTION, RESTAURANT, FOOD)
- AI prompt guides progressive discovery awards based on specificity of player questions
- Backend handles in-place discovery evolution with topic mapping and stage tracking

**Structured Discovery System**
- Replaced fuzzy keyword matching with canonical 8-key discovery tracking
- Defined 8 story elements: SHIPWRECK, FAMILY_DIED, STRANDED_ISLAND, CANNIBALISM, DECEPTION, RESCUED, ALBATROSS_REVEAL, SUICIDE
- Completion requires 7 of 8 discoveries PLUS 3 critical keys (DECEPTION, ALBATROSS_REVEAL, CANNIBALISM)
- Added progress display showing "Discoveries: X/8" in UI header
- Implemented deduplication via Set to prevent repeat discoveries
- Improved OpenAI prompt with stricter examples to prevent over-awarding
- All features architect-reviewed and tested end-to-end with successful validation

**OpenAI Integration Improvements**
- Added conversation history to OpenAI requests for context-aware responses
- Implemented response normalization to handle format variations
- Enhanced error handling with user-friendly messages
- Structured JSON responses with discovery keys and labels

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tools**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR (Hot Module Replacement)
- Client-side routing handled by Wouter (lightweight alternative to React Router)

**UI Component Strategy**
- shadcn/ui component library with Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling with custom design tokens
- Dark/light theme support with CSS variables for dynamic theming
- Design philosophy inspired by chat applications (Discord, Telegram) with atmospheric puzzle game elements

**State Management**
- TanStack Query (React Query) for server state management and API communication
- Local React state for ephemeral UI state (chat input, typing indicators)
- Session-based game state persisted on the backend

**Key Design Patterns**
- Component composition using Radix UI's slot pattern for flexible component APIs
- Custom hooks for reusable logic (use-toast, use-mobile)
- Framer Motion for declarative animations on message appearance and discovery reveals
- Form validation using react-hook-form with Zod schema validation

### Backend Architecture

**Server Framework**
- Express.js REST API with TypeScript
- In-memory storage implementation (MemStorage) for development/demo purposes
- Session-based game state management without user authentication

**API Design**
- RESTful endpoints for game interactions
- JSON request/response format with Zod schema validation
- Primary endpoint: `POST /api/ask` - handles question answering with session management
- Reset endpoint: `POST /api/reset` - creates new game session

**Game Logic Flow**
1. Client sends question with optional sessionId
2. Server validates question against schema using Zod
3. Server retrieves or creates game session
4. Last 10 conversation exchanges sent to OpenAI for context
5. OpenAI responds with structured JSON (answer, explanation, optional discovery)
6. Response validated and normalized (handles case/format variations)
7. Server updates session state with messages and discoveries
8. Game completion checked based on discovery keywords
9. Response returned to client with session state
10. Client renders response with animations and checks for completion

**AI Integration Strategy**
- OpenAI GPT-4o-mini model acts as game master with detailed system prompt
- Conversation history (last 10 exchanges) sent for context-aware follow-up questions
- Strict response format enforced via JSON schema validation
- Response normalization handles case variations (YES/Yes/yes → YES)
- Structured discovery system with 8 canonical keys (SHIPWRECK, FAMILY_DIED, etc.)
- Discovery objects include key (from canonical set) and label (user-friendly description)
- Complete puzzle backstory embedded in system prompt for consistent responses
- Completion logic requires 7 of 8 discoveries AND all 3 critical keys (DECEPTION, ALBATROSS_REVEAL, CANNIBALISM)
- Differentiated error handling: 400 for validation, 500 for AI/server errors

### Data Storage

**Current Implementation**
- In-memory Map-based storage (MemStorage class)
- No database persistence - sessions lost on server restart
- Suitable for stateless, single-session gameplay

**Schema Definition**
- Drizzle ORM configured for PostgreSQL (via drizzle.config.ts and schema definitions)
- Database schema defined but not actively used with current MemStorage implementation
- User table defined but authentication not implemented
- Infrastructure ready for migration to persistent storage when needed

**Game Session Structure**
```typescript
{
  id: string,
  messages: GameMessage[],
  discoveries: Discovery[],  // Structured objects with key and label
  discoveredKeys: Set<DiscoveryKey>,  // Deduplication tracking
  isComplete: boolean,
  createdAt: number
}
```

### External Dependencies

**Third-Party Services**
- **OpenAI API**: Core game master functionality, GPT model processes questions and generates contextual responses
- **Neon Database**: Serverless PostgreSQL configured via @neondatabase/serverless (infrastructure ready, not actively used)

**Key Libraries**
- **Drizzle ORM**: Type-safe ORM for PostgreSQL with schema-first approach
- **Zod**: Runtime type validation for API requests/responses and form validation
- **shadcn/ui + Radix UI**: Accessible component primitives (Dialog, Popover, Toast, etc.)
- **TanStack Query**: Async state management with intelligent caching
- **Framer Motion**: Animation library for smooth transitions and reveals
- **Tailwind CSS**: Utility-first CSS framework with custom configuration

**Development Tools**
- **Replit-specific plugins**: Vite plugins for error overlay, cartographer, and dev banner
- **TypeScript**: Full type safety across client, server, and shared code
- **ESBuild**: Fast bundler for production server build