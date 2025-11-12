import { PostItNote } from "./PostItNote";
import type { Discovery } from "@shared/schema";

interface DetectiveBoardProps {
  discoveries: Discovery[];
}

export function DetectiveBoard({ discoveries }: DetectiveBoardProps) {
  if (discoveries.length === 0) {
    return null;
  }

  return (
    <div 
      className="w-full py-6 px-4"
      data-testid="detective-board"
    >
      <div className="max-w-4xl mx-auto">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 text-center">
          Evidence Board
        </h3>
        <div className="flex flex-wrap gap-4 justify-center items-start">
          {discoveries.map((discovery, index) => (
            <PostItNote
              key={discovery.key}
              discoveryKey={discovery.key}
              label={discovery.label}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
