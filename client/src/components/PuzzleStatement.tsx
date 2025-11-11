import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PuzzleStatementProps {
  statement: string;
}

export default function PuzzleStatement({ statement }: PuzzleStatementProps) {
  return (
    <Card className="p-6 border-l-4 border-l-primary bg-card">
      <div className="flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            The Puzzle
          </h2>
          <p className="font-mono text-base md:text-lg leading-relaxed text-foreground">
            {statement}
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Ask yes-or-no questions to uncover the mystery behind this story.
          </p>
        </div>
      </div>
    </Card>
  );
}
