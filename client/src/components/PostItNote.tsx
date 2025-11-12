import { motion } from "framer-motion";
import type { DiscoveryKey } from "@shared/schema";
import shipwreckImg from "@assets/generated_images/Sinking_ship_sketch_5f52a96b.png";
import familyImg from "@assets/generated_images/Stick_figure_family_sketch_2ef0c722.png";
import islandImg from "@assets/generated_images/Desert_island_sketch_2c55ae9a.png";
import hungerImg from "@assets/generated_images/Empty_plate_sketch_af202242.png";
import deceptionImg from "@assets/generated_images/Deception_mask_sketch_814d4d41.png";
import rescueImg from "@assets/generated_images/Rescue_helicopter_sketch_b383b97a.png";
import albatrossImg from "@assets/generated_images/Albatross_bird_sketch_5d6e82e4.png";
import sadnessImg from "@assets/generated_images/Sad_figure_sketch_6d5d99c5.png";

const DISCOVERY_IMAGES: Record<DiscoveryKey, string> = {
  SHIPWRECK: shipwreckImg,
  FAMILY_DIED: familyImg,
  STRANDED_ISLAND: islandImg,
  CANNIBALISM: hungerImg,
  DECEPTION: deceptionImg,
  RESCUED: rescueImg,
  ALBATROSS_REVEAL: albatrossImg,
  SUICIDE: sadnessImg,
};

interface PostItNoteProps {
  discoveryKey: DiscoveryKey;
  label: string;
  index: number;
}

export function PostItNote({ discoveryKey, label, index }: PostItNoteProps) {
  const rotation = (index * 3.7) % 7 - 3.5;
  
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10, opacity: 0 }}
      animate={{ 
        scale: 1, 
        rotate: rotation,
        opacity: 1 
      }}
      transition={{ 
        type: "spring", 
        stiffness: 200, 
        damping: 15,
        delay: index * 0.2 
      }}
      className="relative w-32 h-32 sm:w-36 sm:h-36"
      data-testid={`postit-${discoveryKey.toLowerCase()}`}
    >
      <div className="absolute inset-0 bg-yellow-200 dark:bg-yellow-300 shadow-md rotate-0 hover-elevate transition-transform duration-200">
        <div className="absolute top-0 left-0 right-0 h-6 bg-yellow-300 dark:bg-yellow-400 opacity-50" />
        
        <div className="p-3 flex flex-col items-center justify-center h-full">
          <img 
            src={DISCOVERY_IMAGES[discoveryKey]} 
            alt={label}
            className="w-20 h-20 object-contain mb-1"
          />
          <p className="text-[10px] text-center text-gray-800 dark:text-gray-900 font-medium line-clamp-2" style={{ fontFamily: 'cursive' }}>
            {label}
          </p>
        </div>
      </div>
      
      <div className="absolute -bottom-1 -right-1 w-full h-full bg-yellow-100 dark:bg-yellow-200 -z-10 opacity-40" />
    </motion.div>
  );
}
