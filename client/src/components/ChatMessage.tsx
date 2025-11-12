import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

export type MessageType = "player" | "system" | "discovery";
export type ResponseType = "YES" | "NO" | "DOES NOT MATTER" | "HINT";

interface ChatMessageProps {
  type: MessageType;
  content: string;
  response?: ResponseType;
  isDiscovery?: boolean;
}

export default function ChatMessage({ type, content, response, isDiscovery }: ChatMessageProps) {
  const isPlayer = type === "player";
  const isDiscoveryMessage = type === "discovery";

  const getResponseBadgeVariant = (resp: ResponseType) => {
    switch (resp) {
      case "YES":
        return "default";
      case "NO":
        return "secondary";
      case "DOES NOT MATTER":
        return "outline";
      case "HINT":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (isDiscoveryMessage) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full"
        data-testid="message-discovery"
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border border-primary/20 rounded-md">
          <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm text-foreground font-medium">{content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: isPlayer ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isPlayer ? "justify-end" : "justify-start"}`}
      data-testid={`message-${type}`}
    >
      <div className={`max-w-md ${isPlayer ? "ml-auto" : "mr-auto"}`}>
        <div
          className={`px-4 py-3 ${
            isPlayer
              ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
              : "bg-card text-card-foreground rounded-2xl rounded-bl-sm border border-card-border"
          }`}
        >
          {response && !isPlayer ? (
            <Badge
              variant={getResponseBadgeVariant(response)}
              className="text-xs font-bold px-2 py-0.5"
              data-testid={`badge-response-${response.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {response.toLowerCase()}
            </Badge>
          ) : (
            <p className="text-base leading-relaxed" data-testid="text-message-content">
              {content}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
