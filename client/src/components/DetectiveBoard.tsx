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
      className="w-full py-3 px-4"
      data-testid="detective-board"
    >
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xs font-semibold text-muted-foreground mb-3 text-center">
          Evidence Board
        </h3>
        <div className="flex flex-wrap gap-3 justify-center items-start">
          {discoveries.map((discovery, index) => (
            <PostItNote
              key={discovery.key}
              discovery={discovery}
              allDiscoveries={discoveries}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
