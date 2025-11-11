import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import type { Discovery } from "@shared/schema";

interface GameCompletionModalProps {
  open: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  discoveries: Discovery[];
}

export default function GameCompletionModal({
  open,
  onClose,
  onPlayAgain,
  discoveries,
}: GameCompletionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="modal-completion">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
            >
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </motion.div>
            Mystery Solved!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Congratulations! You've uncovered the dark truth behind the albatross puzzle.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Key Discoveries
          </h3>
          <div className="space-y-2">
            {discoveries.map((discovery, index) => (
              <motion.div
                key={discovery.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-2"
                data-testid={`discovery-${index}`}
              >
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{discovery.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            data-testid="button-close-modal"
          >
            Close
          </Button>
          <Button
            onClick={onPlayAgain}
            className="flex-1"
            data-testid="button-play-again"
          >
            Play Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
