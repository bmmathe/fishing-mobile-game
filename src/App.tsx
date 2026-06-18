import { Suspense } from "react";
import { FishingGame } from "./fishing/FishingGame";

export default function App() {
  return (
    <Suspense fallback={null}>
      <FishingGame />
    </Suspense>
  );
}
