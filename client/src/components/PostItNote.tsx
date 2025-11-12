import { motion } from "framer-motion";
import type { DiscoveryKey, Discovery } from "@shared/schema";

// Base state images
import vesselImg from "@assets/generated_images/Floating_boat_sketch_deda538a.png";
import vesselSankImg from "@assets/generated_images/Sinking_ship_sketch_5f52a96b.png";
import familyImg from "@assets/generated_images/Stick_figure_family_sketch_2ef0c722.png";
import islandImg from "@assets/generated_images/Island_sketch_2fdca28e.png";
import hungerImg from "@assets/generated_images/Empty_plate_sketch_af202242.png";
import cannibalismImg from "@assets/generated_images/Cannibalism_scene_sketch_drawing_67469b53.png";
import strandedImg from "@assets/generated_images/Stranded_survivor_sketch_81329318.png";
import deceptionImg from "@assets/generated_images/Deception_mask_sketch_814d4d41.png";
import rescueImg from "@assets/generated_images/Rescue_helicopter_sketch_b383b97a.png";
import restaurantImg from "@assets/generated_images/Restaurant_soup_sketch_33ca3de3.png";
import albatrossImg from "@assets/generated_images/Albatross_bird_sketch_5d6e82e4.png";
import sadnessImg from "@assets/generated_images/Sad_figure_sketch_6d5d99c5.png";
import suicideImg from "@assets/generated_images/Suicide_weapon_sketch_f06aba84.png";
import redXImg from "@assets/generated_images/Red_X_overlay_270e1ea8.png";

const DISCOVERY_IMAGES: Record<DiscoveryKey, string> = {
  VESSEL: vesselImg,
  VESSEL_SANK: vesselSankImg,
  FAMILY: familyImg,
  FAMILY_DIED: familyImg,
  ISLAND: islandImg,
  STRANDED: strandedImg,
  NO_FOOD: hungerImg,
  CANNIBALISM: cannibalismImg,
  DECEPTION: deceptionImg,
  RESCUED: rescueImg,
  RESTAURANT: restaurantImg,
  ALBATROSS_REVEAL: albatrossImg,
  GUILT: sadnessImg,
  SUICIDE: suicideImg,
};

interface PostItNoteProps {
  discovery: Discovery;
  allDiscoveries: Discovery[];
  index: number;
}

export function PostItNote({ discovery, allDiscoveries, index }: PostItNoteProps) {
  const rotation = (index * 3.7) % 7 - 3.5;
  
  const isEvolved = discovery.stage === "evolved";
  const showRedX = discovery.key === "FAMILY_DIED";
  
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
      className="relative w-24 h-24 sm:w-28 sm:h-28"
      data-testid={`postit-${discovery.key.toLowerCase()}`}
    >
      <div className="absolute inset-0 bg-yellow-200 dark:bg-yellow-300 shadow-md rotate-0 hover-elevate transition-transform duration-200">
        <div className="absolute top-0 left-0 right-0 h-4 bg-yellow-300 dark:bg-yellow-400 opacity-50" />
        
        <div className="p-2 flex flex-col items-center justify-center h-full relative">
          <img 
            src={DISCOVERY_IMAGES[discovery.key]} 
            alt={discovery.label}
            className="w-14 h-14 object-contain mb-1"
          />
          
          {showRedX && (
            <motion.img
              src={redXImg}
              alt="Deceased"
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 object-contain"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.3
              }}
            />
          )}
          
          <p className="text-[9px] text-center text-gray-800 dark:text-gray-900 font-medium line-clamp-2 relative z-10" style={{ fontFamily: 'cursive' }}>
            {discovery.label}
          </p>
        </div>
      </div>
      
      <div className="absolute -bottom-1 -right-1 w-full h-full bg-yellow-100 dark:bg-yellow-200 -z-10 opacity-40" />
    </motion.div>
  );
}
