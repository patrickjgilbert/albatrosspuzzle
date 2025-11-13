import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft, Medal } from "lucide-react";
import { Link } from "wouter";

interface LeaderboardEntry {
  displayName: string;
  questionCount: number;
  completedAt: Date;
}

const ALBATROSS_PUZZLE_ID = "albatross";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", ALBATROSS_PUZZLE_ID],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboard/${ALBATROSS_PUZZLE_ID}`);
      if (!response.ok) throw new Error("Failed to load leaderboard");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-orange-600" />;
    return <span className="text-lg font-semibold text-muted-foreground">{rank}</span>;
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Leaderboard</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              The Albatross Puzzle - All Time Best
            </CardTitle>
            <CardDescription>
              Players who solved the mystery in the fewest questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No one has solved this puzzle yet.</p>
                <p className="mt-2">Be the first to crack the mystery!</p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="leaderboard-list">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  return (
                    <div
                      key={`${entry.displayName}-${index}`}
                      className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                      data-testid={`leaderboard-entry-${rank}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 flex items-center justify-center">
                          {getRankIcon(rank)}
                        </div>
                        <div>
                          <div className="font-semibold" data-testid={`text-username-${rank}`}>
                            {entry.displayName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Completed {formatDate(entry.completedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary" data-testid={`text-questions-${rank}`}>
                          {entry.questionCount}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.questionCount === 1 ? "question" : "questions"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button asChild size="lg" data-testid="button-play-now">
            <Link href="/">Play Now</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
