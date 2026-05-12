import dynamic from "next/dynamic";
import { LoadingVeil } from "@/components/presence/LoadingVeil";
import { StateControls } from "@/components/dev/StateControls";

// Dynamic import — Three.js must not run on server
const PresenceScene = dynamic(
  () =>
    import("@/components/presence/PresenceScene").then((m) => m.PresenceScene),
  { ssr: false },
);

export default function Home() {
  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <LoadingVeil />
      <PresenceScene />
      <StateControls />
    </main>
  );
}
