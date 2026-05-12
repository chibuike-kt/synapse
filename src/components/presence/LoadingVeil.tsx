"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function LoadingVeil() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate shader compilation + asset load
    // Replace with real progress events in Phase 2
    const start = Date.now();
    const duration = 2200;

    const frame = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p < 1) requestAnimationFrame(frame);
      else setTimeout(() => setVisible(false), 400);
    };
    requestAnimationFrame(frame);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "#03040a",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Pulsing entity placeholder */}
          <motion.div
            animate={{ scale: [1, 1.04, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(168,184,208,0.4) 0%, transparent 70%)",
              border: "1px solid rgba(168,184,208,0.2)",
              marginBottom: 32,
            }}
          />

          {/* Progress bar */}
          <div
            style={{
              width: 120,
              height: 1,
              background: "rgba(168,184,208,0.12)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                background: "rgba(200,212,230,0.6)",
                width: `${progress * 100}%`,
              }}
              transition={{ ease: "linear" }}
            />
          </div>

          <div
            style={{
              marginTop: 16,
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "rgba(168,184,208,0.35)",
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            initializing
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
