
import type { PetAction, TimeOfDay } from "../lib/pet";
import TimeLighting from "./TimeLighting";

import Carpet from "./Carpet";
import Lamp from "./Lamp";
import WoodenTable from "./WoodenTable";
import Plant from "./Plant";
import Plushie from "./Plushie";
import BathBasket from "./BathBasket";
import Bowl from "./Bowl";
import Mug from "./Mug";
import Shelf from "./Shelf";
import Cushions from "./Cushions";
import Sofa from "./Sofa";
import Window from "./Window";
import Bookshelve from "./Bookshelve";
import WallDecor from "./WallDecor";
import CozyShelf from "./CozyShelf";
import PlantBooks from "./PlantBooks";
import PlantStool from "./PlantStool";
import FloralWallArt from "./FloralWallArt";

// IMPORTANT: Use animated Mochi!
import MochiAnimated from "./MochiAnimated";

type RoomProps = {
  timeOfDay: TimeOfDay;
  onPet: () => void;
  lastAction: PetAction | null;
  actionId: number;
  lampOn: boolean;
  onLamp: () => void;
  stoolLampOn: boolean;
  onStoolLamp: () => void;
  blindsOpen: boolean;
  onBlinds: () => void;
};

export default function Room({
  timeOfDay,
  onPet,
  lastAction,
  actionId,
  lampOn,
  onLamp,
  stoolLampOn,
  onStoolLamp,
  blindsOpen,
  onBlinds,
}: RoomProps) {
  return (
    <group>
      {/* Wooden floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.4, 0]}
        receiveShadow
      >
        <planeGeometry args={[12, 10]} />
        <meshStandardMaterial
          color="#d9b99b"
          roughness={1}
        />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 1.5, -3]} receiveShadow>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial
          color="#f7dfcb"
          roughness={1}
        />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-5, 1.5, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial
          color="#efd4c0"
          roughness={1}
        />
      </mesh>

      {/* Lighting */}
      <TimeLighting timeOfDay={timeOfDay} />

      {/* Window */}
      <Window
        timeOfDay={timeOfDay}
        blindsOpen={blindsOpen}
        onBlinds={onBlinds}
      />

      {/* Furniture */}
      <Carpet />
      <Sofa />
      <Cushions />

      {/* Animated Mochi */}
      <MochiAnimated
        onPet={onPet}
        lastAction={lastAction}
        actionId={actionId}
      />

      <Lamp />
      <Plant />
      <WoodenTable />
      <Plushie />
      <BathBasket />
      <Bowl />
      <Mug />
      <Shelf />
      <Bookshelve />
      <WallDecor />
      <CozyShelf />
      <PlantBooks />
      <PlantStool />
      <FloralWallArt />
    </group>
  );
}
