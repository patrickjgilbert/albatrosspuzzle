import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, HelpCircle as HelpIcon, LogOut, Trophy, Crown, AlertCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import PuzzleStatement from "@/components/PuzzleStatement";
import ChatMessage, { type MessageType, type ResponseType } from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import ChatInput from "@/components/ChatInput";
import GameCompletionModal from "@/components/GameCompletionModal";
import AccountPromptModal from "@/components/AccountPromptModal";
import ThemeToggle from "@/components/ThemeToggle";
import { DetectiveBoard } from "@/components/DetectiveBoard";
import { AppLogo } from "@/components/AppLogo";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AskQuestionResponse, Discovery, GameMessage as DBGameMessage, GameSession, Puzzle } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface Message {
  id: number;
  type: MessageType;
  content: string;
  response?: ResponseType;
}

export default function Game() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [progress, setProgress] = useState({ total: 8, discovered: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAccountPrompt, setShowAccountPrompt] = useState(false);
  const [accountPromptTrigger, setAccountPromptTrigger] = useState<"first_discovery" | "completion">("first_discovery");
  const hasShownFirstDiscoveryPrompt = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  // Extract slug from URL params, default to "albatross" for backward compatibility
  const [match, params] = useRoute("/game/:slug");
  const puzzleSlug = params?.slug || "albatross";

  // Load puzzle data
  const { data: puzzle, isLoading: puzzleLoading, error: puzzleError } = useQuery<Puzzle>({
    queryKey: ["/api/puzzles", puzzleSlug],
    queryFn: async () => {
      const response = await fetch(`/api/puzzles/${puzzleSlug}`);
      if (!response.ok) {
        const error = await response.json();
        const err = new Error(error.message || "Failed to load puzzle") as Error & { status?: number };
        err.status = response.status;
        throw err;
      }
      return response.json();
    },
  });

  // Load existing game session on mount
  const { data: session, isLoading: sessionLoading } = useQuery<GameSession>({
    queryKey: ["/api/session", puzzleSlug],
    queryFn: async () => {
      const response = await fetch(`/api/session/${puzzleSlug}`);
      if (!response.ok) throw new Error("Failed to load session");
      return response.json();
    },
    enabled: !!puzzle,
  });

  // Hydrate local state from loaded session
  useEffect(() => {
    if (session) {
      setSessionId(session.id);
      
      // Convert DB messages to UI messages
      const dbMessages = session.messages as DBGameMessage[];
      const uiMessages: Message[] = dbMessages.map((msg, idx) => ({
        id: idx,
        type: msg.type as MessageType,
        content: msg.content,
        response: msg.response as ResponseType | undefined,
      }));
      setMessages(uiMessages);
      messageIdCounter.current = uiMessages.length;
      
      // Load discoveries and progress
      const dbDiscoveries = session.discoveries as Discovery[];
      setDiscoveries(dbDiscoveries);
      
      const discoveredTopics = new Set(dbDiscoveries.map(d => d.topic));
      setProgress({ total: 8, discovered: discoveredTopics.size });
      
      // Check if already complete
      if (session.isComplete) {
        setGameComplete(true);
      }
    }
  }, [session]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSubmitQuestion = async (question: string) => {
    const playerMessage: Message = {
      id: messageIdCounter.current++,
      type: "player",
      content: question,
    };

    setMessages((prev) => [...prev, playerMessage]);
    setIsTyping(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          puzzleId: puzzleSlug,
          question,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(JSON.stringify(data));
      }

      if (!sessionId) {
        setSessionId(data.sessionId);
      }

      const systemMessage: Message = {
        id: messageIdCounter.current++,
        type: "system",
        content: data.content,
        response: data.response,
      };

      setMessages((prev) => [...prev, systemMessage]);
      setIsTyping(false);
      setProgress(data.progress);

      if (data.discovery) {
        setDiscoveries(data.discoveries);
        
        // Show account prompt after first discovery (post-it note appears) for guests
        if (!isAuthenticated && data.discoveries.length > 0 && !hasShownFirstDiscoveryPrompt.current) {
          hasShownFirstDiscoveryPrompt.current = true;
          setTimeout(() => {
            setAccountPromptTrigger("first_discovery");
            setShowAccountPrompt(true);
          }, 1500);
        }
      }

      if (data.isComplete) {
        setTimeout(() => {
          setGameComplete(true);
          
          // Show account prompt after completion for guests
          if (!isAuthenticated) {
            setTimeout(() => {
              setAccountPromptTrigger("completion");
              setShowAccountPrompt(true);
            }, 2000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error submitting question:", error);
      setIsTyping(false);
      
      let errorMessage = "Failed to process your question. Please try again.";
      if (error instanceof Error) {
        try {
          const errorData = JSON.parse(error.message);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Use default message
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          puzzleId: puzzleSlug,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset game");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages([]);
      setDiscoveries([]);
      setProgress({ total: 8, discovered: 0 });
      setGameComplete(false);
      messageIdCounter.current = 0;
      
      toast({
        title: "Game Reset",
        description: "Starting fresh! Good luck solving the mystery.",
      });
    } catch (error) {
      console.error("Error resetting game:", error);
      toast({
        title: "Error",
        description: "Failed to reset game. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  const handleAccountCreated = async () => {
    // Migration happens automatically on the server when a guest registers
    // Just refresh the page to get the new user context
    window.location.reload();
  };

  // Show loading while puzzle or session is being loaded
  if (puzzleLoading || sessionLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  // Handle puzzle errors (404 or 403)
  if (puzzleError) {
    const error = puzzleError as Error & { status?: number };
    const is403 = error.status === 403;
    const is404 = error.status === 404;

    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="max-w-md mx-auto px-6 text-center space-y-4">
          <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-semibold">
            {is403 ? "Pro Puzzle" : is404 ? "Puzzle Not Found" : "Error"}
          </h1>
          <p className="text-muted-foreground">
            {is403 
              ? "This puzzle requires a Pro subscription to access."
              : is404 
              ? "The puzzle you're looking for doesn't exist."
              : error.message || "Failed to load puzzle. Please try again later."}
          </p>
          <div className="flex gap-3 justify-center pt-4">
            {is403 && (
              <Button asChild data-testid="button-upgrade">
                <Link href="/subscribe">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild data-testid="button-back">
              <Link href="/puzzles">
                Browse Puzzles
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure puzzle is loaded before rendering
  if (!puzzle) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <AppLogo />
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold" data-testid="text-title">
            {puzzle.title}
          </h1>
          {progress.discovered > 0 && (
            <div className="text-sm text-muted-foreground" data-testid="text-progress">
              Discoveries: {progress.discovered}/{progress.total}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-help">
                <HelpIcon className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" data-testid="popover-help">
              <div className="space-y-3">
                <h3 className="font-semibold">About This Puzzle</h3>
                <p className="text-sm text-muted-foreground">
                  This is a lateral thinking puzzle designed to test your creative problem-solving skills. The story you see is just the surface - there's a hidden backstory that explains this mysterious and shocking event.
                </p>
                <p className="text-sm text-muted-foreground">
                  Your goal is to uncover the complete backstory by asking yes-or-no questions. Think creatively, explore different angles, and piece together the truth behind what happened.
                </p>
                <p className="text-sm text-muted-foreground font-medium">
                  Start asking questions to reveal the mystery!
                </p>
              </div>
            </PopoverContent>
          </Popover>
          {!user?.isPro && (
            <Button
              variant="default"
              size="sm"
              asChild
              data-testid="button-upgrade"
            >
              <Link href="/subscribe">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Link>
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                asChild
                data-testid="button-leaderboard"
              >
                <Link href="/leaderboard">
                  <Trophy className="w-5 h-5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Leaderboard</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReset}
                data-testid="button-reset"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset puzzle</p>
            </TooltipContent>
          </Tooltip>
          <UserAccountDropdown />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="max-w-3xl mx-auto w-full px-4 md:px-6 pt-4 pb-2 space-y-2 flex-shrink-0">
          <PuzzleStatement statement={puzzle.prompt} />
          <DetectiveBoard discoveries={discoveries} />
        </div>

        <div className="flex-1 px-4 md:px-6 py-4 overflow-hidden">
          <div 
            className="max-w-3xl mx-auto h-full border-2 border-border rounded-lg overflow-y-auto p-4 space-y-4 bg-background/50"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--primary)) transparent'
            }}
            data-testid="chat-container"
          >
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">
                  Start asking yes-or-no questions to uncover the mystery...
                </p>
              </div>
            )}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                type={message.type}
                content={message.content}
                response={message.response}
              />
            ))}

            {isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      <ChatInput onSubmit={handleSubmitQuestion} disabled={isTyping} />

      <GameCompletionModal
        open={gameComplete}
        onClose={() => setGameComplete(false)}
        onPlayAgain={handleReset}
        discoveries={discoveries}
      />

      <AccountPromptModal
        open={showAccountPrompt}
        onOpenChange={setShowAccountPrompt}
        onSuccess={handleAccountCreated}
        trigger={accountPromptTrigger}
      />
    </div>
  );
}
