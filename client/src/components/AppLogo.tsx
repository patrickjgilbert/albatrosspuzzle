import { Link } from "wouter";
import { Puzzle } from "lucide-react";

export function AppLogo() {
  return (
    <Link href="/" data-testid="logo-home">
      <div className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-md px-3 py-2 cursor-pointer">
        <Puzzle className="w-6 h-6 text-primary" />
        <span className="font-bold text-lg">Albatross Riddles</span>
      </div>
    </Link>
  );
}
