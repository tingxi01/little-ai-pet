
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import "./App.css";

function InteractiveBunnyPlaceholder() {
  const [clicked, setClicked] = useState(false);

  return (
    <mesh
      onClick={() => setClicked(!clicked)}
      scale={clicked ? 1.3 : 1}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#f7c6d9" />
    </mesh>
  );
}

function App() {
  return (
    <div className="app">
      <h1>Little AI Pet 🐰</h1>
      <p>Meet Mochi, your future AI companion!</p>

      <div className="game-container">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={1.5} />
          <directionalLight position={[2, 3, 5]} />
          <InteractiveBunnyPlaceholder />
        </Canvas>
      </div>

      <p>Click the pink ball!</p>
    </div>
  );
}

export default App;
