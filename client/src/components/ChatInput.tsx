import { useState, FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim() && !disabled) {
      onSubmit(question.trim());
      setQuestion("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      data-testid="form-chat-input"
    >
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Ask a yes/no question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={disabled}
            className="flex-1 h-12 px-6 rounded-full text-base"
            data-testid="input-question"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!question.trim() || disabled}
            className="w-12 h-12 rounded-full flex-shrink-0"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </form>
  );
}
