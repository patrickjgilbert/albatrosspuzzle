import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, HelpCircle as HelpIcon } from "lucide-react";
import PuzzleStatement from "@/components/PuzzleStatement";
import ChatMessage, { type MessageType, type ResponseType } from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import ChatInput from "@/components/ChatInput";
import GameCompletionModal from "@/components/GameCompletionModal";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AskQuestionResponse, Discovery } from "@shared/schema";

interface Message {
  id: number;
  type: MessageType;
  content: string;
  response?: ResponseType;
}

const PUZZLE_STATEMENT =
  "A man walks into a restaurant, orders the albatross soup, takes one bite of it, puts his spoon down, walks out of the restaurant, and shoots himself.";

const SAMPLE_QUESTIONS = [
  "Did the man have a family?",
  "Was there a shipwreck?",
  "Did he eat something on an island?",
  "Was he told the meat was albatross?",
  "Did his family die?",
];

export default function Game() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [progress, setProgress] = useState({ total: 8, discovered: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const { toast } = useToast();

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
        setTimeout(() => {
          const discoveryMessage: Message = {
            id: messageIdCounter.current++,
            type: "discovery",
            content: data.discovery.label,
          };
          setMessages((prev) => [...prev, discoveryMessage]);
          setDiscoveries(data.discoveries);

          if (data.isComplete) {
            setTimeout(() => {
              setGameComplete(true);
            }, 1000);
          }
        }, 500);
      } else if (data.isComplete) {
        setTimeout(() => {
          setGameComplete(true);
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
          sessionId,
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
    } catch (error) {
      console.error("Error resetting game:", error);
      toast({
        title: "Error",
        description: "Failed to reset game. Please refresh the page.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold" data-testid="text-title">
            The Albatross Puzzle
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
                <h3 className="font-semibold">Need a hint?</h3>
                <p className="text-sm text-muted-foreground">
                  Try asking questions like:
                </p>
                <ul className="space-y-1 text-sm">
                  {SAMPLE_QUESTIONS.map((q, i) => (
                    <li key={i} className="text-muted-foreground">
                      • {q}
                    </li>
                  ))}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            data-testid="button-reset"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
          <PuzzleStatement statement={PUZZLE_STATEMENT} />

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
      </main>

      <ChatInput onSubmit={handleSubmitQuestion} disabled={isTyping} />

      <GameCompletionModal
        open={gameComplete}
        onClose={() => setGameComplete(false)}
        onPlayAgain={handleReset}
        discoveries={discoveries}
      />
    </div>
  );
}
