"use client";

import "@/lib/suppress-three-warnings";
import dynamic from "next/dynamic";
import { LoadingVeil } from "@/components/presence/LoadingVeil";
import { StateControls } from "@/components/dev/StateControls";

const PresenceScene = dynamic(
  () =>
    import("@/components/presence/PresenceScene").then((m) => m.PresenceScene),
  { ssr: false },
);

export function ClientShell() {
  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <LoadingVeil />
      <PresenceScene />
      <StateControls />
    </main>
  );
}
