"use client";

import { usePresenceStore, PresenceState } from "@/store/presence-store";

const STATES: PresenceState[] = [
  "dormant",
  "idle",
  "listening",
  "thinking",
  "speaking",
  "processing",
  "searching",
  "executing",
  "alert",
];

export function StateControls() {
  const { state, dispatch, emotional, setEmotional } = usePresenceStore();

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: 24,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: "12px 16px",
        backdropFilter: "blur(8px)",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#c4cbd6",
      }}
    >
      <div style={{ marginBottom: 8, opacity: 0.5 }}>FSM — dev only</div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}
      >
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => dispatch(s)}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              background: state === s ? "#a8b8d0" : "rgba(255,255,255,0.08)",
              color: state === s ? "#000" : "#c4cbd6",
              fontSize: 10,
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div>
        <label>
          energy {emotional.energy.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={emotional.energy}
            onChange={(e) =>
              setEmotional({ energy: parseFloat(e.target.value) })
            }
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
      </div>
      <div>
        <label>
          confidence {emotional.confidence.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={emotional.confidence}
            onChange={(e) =>
              setEmotional({ confidence: parseFloat(e.target.value) })
            }
            style={{ width: 80, marginLeft: 8 }}
          />
        </label>
      </div>
    </div>
  );
}
