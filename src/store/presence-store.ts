import { create } from "zustand";

export type PresenceState =
  | "dormant"
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "processing"
  | "searching"
  | "executing"
  | "alert";

export interface EmotionalModifiers {
  energy: number; // 0.0–1.0 — excitation level within state
  confidence: number; // 0.0–1.0 — certainty (affects visual stability)
  urgency: number; // 0.0–1.0 — tempo of animation
}

interface PresenceStore {
  state: PresenceState;
  previousState: PresenceState;
  stateEnteredAt: number;
  emotional: EmotionalModifiers;
  transitionProgress: number; // 0.0–1.0, driven by render loop

  dispatch: (next: PresenceState) => void;
  setEmotional: (modifiers: Partial<EmotionalModifiers>) => void;
  setTransitionProgress: (p: number) => void;
}

const VALID_TRANSITIONS: Record<PresenceState, PresenceState[]> = {
  dormant: ["idle"],
  idle: ["listening", "alert", "dormant"],
  listening: ["thinking", "idle"],
  thinking: ["speaking", "processing", "searching", "idle"],
  speaking: ["idle", "listening"], // listening = interruption
  processing: ["speaking", "idle"],
  searching: ["thinking", "speaking", "idle"],
  executing: ["idle", "speaking"],
  alert: ["idle", "listening"],
};

const MIN_STATE_DWELL_MS = 120; // prevents visual thrashing

export const usePresenceStore = create<PresenceStore>((set, get) => ({
  state: "idle",
  previousState: "idle",
  stateEnteredAt: Date.now(),
  emotional: { energy: 0.5, confidence: 0.8, urgency: 0.3 },
  transitionProgress: 1.0,

  dispatch: (next) => {
    const current = get();
    const now = Date.now();

    if (current.state === next) return;
    if (now - current.stateEnteredAt < MIN_STATE_DWELL_MS) return;
    if (!VALID_TRANSITIONS[current.state]?.includes(next)) {
      console.warn(
        `[Presence FSM] Invalid transition: ${current.state} → ${next}`,
      );
      return;
    }

    set({
      previousState: current.state,
      state: next,
      stateEnteredAt: now,
      transitionProgress: 0.0,
    });
  },

  setEmotional: (modifiers) =>
    set((s) => ({ emotional: { ...s.emotional, ...modifiers } })),

  setTransitionProgress: (p) => set({ transitionProgress: p }),
}));
