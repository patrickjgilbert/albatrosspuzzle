import { motion } from "framer-motion";
import type { DiscoveryKey, Discovery } from "@shared/schema";

// Albatross Puzzle images
import vesselImg from "@assets/generated_images/Floating_boat_sketch_deda538a.png";
import vesselSankImg from "@assets/generated_images/Sinking_ship_sketch_5f52a96b.png";
import familyImg from "@assets/generated_images/Stick_figure_family_sketch_2ef0c722.png";
import islandImg from "@assets/generated_images/Island_sketch_2fdca28e.png";
import hungerImg from "@assets/generated_images/Empty_plate_sketch_af202242.png";
import cannibalismImg from "@assets/generated_images/Campfire_cooking_sketch_b841f84c.png";
import strandedImg from "@assets/generated_images/Group_of_survivors_sketch_426b6291.png";
import deceptionImg from "@assets/generated_images/Deception_mask_sketch_814d4d41.png";
import rescueImg from "@assets/generated_images/Rescue_helicopter_sketch_b383b97a.png";
import restaurantImg from "@assets/generated_images/Restaurant_soup_sketch_33ca3de3.png";
import albatrossImg from "@assets/generated_images/Albatross_bird_sketch_5d6e82e4.png";
import sadnessImg from "@assets/generated_images/Sad_figure_sketch_6d5d99c5.png";
import suicideImg from "@assets/generated_images/Suicide_weapon_sketch_f06aba84.png";
import redXImg from "@assets/generated_images/Red_X_overlay_270e1ea8.png";

// Lighthouse Keeper Puzzle images
import lighthouseJobImg from "@assets/generated_images/Lighthouse_keeper_at_work_e5c5b2f6.png";
import lampBrokeImg from "@assets/generated_images/Broken_lighthouse_lamp_f7edd190.png";
import shipCrashImg from "@assets/generated_images/Ship_crashing_on_rocks_0c6f160d.png";
import sonDiedImg from "@assets/generated_images/Person_in_mourning_bb335fcd.png";
import guiltImg from "@assets/generated_images/Person_feeling_guilt_889e0c6c.png";
import negligenceImg from "@assets/generated_images/Neglected_maintenance_equipment_28a0f87b.png";
import responsibilityImg from "@assets/generated_images/Burden_of_responsibility_c446a0e9.png";

// Last Phone Call Puzzle images
import daughterImg from "@assets/generated_images/Young_daughter_4126fcb9.png";
import kidnappedImg from "@assets/generated_images/Kidnapping_chains_316facf2.png";
import yearsAgoImg from "@assets/generated_images/Years_passing_calendar_d4861f43.png";
import neverFoundImg from "@assets/generated_images/Missing_person_poster_d4ce1f11.png";
import searchingImg from "@assets/generated_images/Search_investigation_53b10091.png";
import detectiveCallImg from "@assets/generated_images/Detective_phone_call_3f078b7a.png";
import foundAliveImg from "@assets/generated_images/Found_alive_safe_85799ce5.png";
import reunionImg from "@assets/generated_images/Emotional_reunion_hug_5dc9b14e.png";

// Mirror Room Puzzle images
import conArtistImg from "@assets/generated_images/Con_artist_figure_c3d7dc4b.png";
import fakeIdentitiesImg from "@assets/generated_images/Multiple_fake_masks_eefb3d4d.png";
import pretendingImg from "@assets/generated_images/Person_wearing_mask_e34d7c09.png";
import therapyRoomImg from "@assets/generated_images/Mirror_therapy_room_ca8f9d5d.png";
import trueSelfImg from "@assets/generated_images/True_authentic_self_7b73c962.png";
import realFaceImg from "@assets/generated_images/Removing_mask_reveal_40e58208.png";
import confrontationImg from "@assets/generated_images/Mirror_self_confrontation_4e18693e.png";
import redemptionImg from "@assets/generated_images/Redemption_transformation_dacbfb9a.png";

// Empty Restaurant Puzzle images
import nuclearPlantImg from "@assets/generated_images/Nuclear_power_plant_01e6d009.png";
import emergencySirensImg from "@assets/generated_images/Emergency_siren_f14f1001.png";
import reactorMeltdownImg from "@assets/generated_images/Reactor_meltdown_danger_895f59f7.png";
import evacuationImg from "@assets/generated_images/Evacuation_fleeing_2b9402c0.png";
import leftImmediatelyImg from "@assets/generated_images/Abandoned_warm_meal_46f23a4d.png";
import townAbandonedImg from "@assets/generated_images/Ghost_town_abandoned_c02ed3b4.png";
import exclusionZoneImg from "@assets/generated_images/Exclusion_zone_barrier_6e560d68.png";
import frozenTimeImg from "@assets/generated_images/Frozen_time_clock_6e7893a8.png";

// Silent Concert Puzzle images
import memorialImg from "@assets/generated_images/Memorial_tribute_display_e2a91f5a.png";
import musicianDiedImg from "@assets/generated_images/Deceased_musician_867d734d.png";
import tributeImg from "@assets/generated_images/Paying_tribute_respects_348e23cb.png";
import silencePerformanceImg from "@assets/generated_images/Silent_empty_stage_08a4f9f4.png";
import absenceImg from "@assets/generated_images/Absence_empty_chair_cbd230eb.png";
import belovedArtistImg from "@assets/generated_images/Beloved_celebrated_artist_e51ab104.png";
import tragicDeathImg from "@assets/generated_images/Tragic_death_heartbreak_049ce88a.png";
import powerfulTributeImg from "@assets/generated_images/Powerful_moving_tribute_3e27a6a8.png";

const DISCOVERY_IMAGES: Record<DiscoveryKey, string> = {
  // Albatross Puzzle
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
  
  // Lighthouse Keeper Puzzle
  LIGHTHOUSE_JOB: lighthouseJobImg,
  LAMP_BROKE: lampBrokeImg,
  SHIP_CRASH: shipCrashImg,
  SON_DIED: sonDiedImg,
  NEGLIGENCE: negligenceImg,
  RESPONSIBILITY: responsibilityImg,
  
  // Last Phone Call Puzzle
  DAUGHTER: daughterImg,
  KIDNAPPED: kidnappedImg,
  YEARS_AGO: yearsAgoImg,
  NEVER_FOUND: neverFoundImg,
  SEARCHING: searchingImg,
  DETECTIVE_CALL: detectiveCallImg,
  FOUND_ALIVE: foundAliveImg,
  REUNION: reunionImg,
  
  // Mirror Room Puzzle
  CON_ARTIST: conArtistImg,
  FAKE_IDENTITIES: fakeIdentitiesImg,
  PRETENDING: pretendingImg,
  THERAPY_ROOM: therapyRoomImg,
  TRUE_SELF: trueSelfImg,
  REAL_FACE: realFaceImg,
  CONFRONTATION: confrontationImg,
  REDEMPTION: redemptionImg,
  
  // Empty Restaurant Puzzle
  NUCLEAR_PLANT: nuclearPlantImg,
  EMERGENCY_SIRENS: emergencySirensImg,
  REACTOR_MELTDOWN: reactorMeltdownImg,
  EVACUATION: evacuationImg,
  LEFT_IMMEDIATELY: leftImmediatelyImg,
  TOWN_ABANDONED: townAbandonedImg,
  EXCLUSION_ZONE: exclusionZoneImg,
  FROZEN_TIME: frozenTimeImg,
  
  // Silent Concert Puzzle
  MEMORIAL: memorialImg,
  MUSICIAN_DIED: musicianDiedImg,
  TRIBUTE: tributeImg,
  SILENCE_PERFORMANCE: silencePerformanceImg,
  ABSENCE: absenceImg,
  BELOVED_ARTIST: belovedArtistImg,
  TRAGIC_DEATH: tragicDeathImg,
  POWERFUL_TRIBUTE: powerfulTributeImg,
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
