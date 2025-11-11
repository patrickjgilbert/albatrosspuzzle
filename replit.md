# Albatross Riddle Game

## Overview

An interactive web-based lateral thinking puzzle game where players solve the classic "Albatross Soup" mystery through yes/no questions. The application uses AI (OpenAI) to act as a game master, responding to player questions and tracking their progress toward discovering the dark truth behind the puzzle. Players engage in a chat-like interface that progressively reveals key story elements as they ask the right questions.

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
- Single main endpoint for asking questions (`POST /api/ask`) that handles session creation and updates

**Game Logic Flow**
1. Client sends question with optional sessionId
2. Server validates question against schema
3. Question forwarded to OpenAI API with system prompt containing full puzzle backstory
4. AI responds with structured JSON (answer, explanation, optional discovery)
5. Server updates session state and returns response to client
6. Client renders response and any discoveries, scrolls to bottom

**AI Integration Strategy**
- OpenAI GPT model acts as game master with detailed system prompt
- Strict response format enforced: YES/NO/DOES_NOT_MATTER with explanation
- Discovery detection logic identifies when players uncover key plot points
- Complete puzzle backstory embedded in system prompt for consistent responses

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
  discoveries: string[],
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