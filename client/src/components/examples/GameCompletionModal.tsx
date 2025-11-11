import { useState } from 'react';
import GameCompletionModal from '../GameCompletionModal';
import { Button } from '@/components/ui/button';

export default function GameCompletionModalExample() {
  const [open, setOpen] = useState(true);

  const discoveries = [
    "The man was on a ship with his family",
    "There was a shipwreck and they were stranded",
    "His family did not survive",
    "He was fed 'albatross' meat by other survivors",
    "The meat was actually human remains",
    "He realized this when he tasted real albatross"
  ];

  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)} data-testid="button-open-modal">
        Open Completion Modal
      </Button>
      <GameCompletionModal
        open={open}
        onClose={() => setOpen(false)}
        onPlayAgain={() => {
          console.log('Play again clicked');
          setOpen(false);
        }}
        discoveries={discoveries}
      />
    </div>
  );
}
