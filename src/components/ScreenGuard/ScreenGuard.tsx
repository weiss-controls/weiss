// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useState, useEffect } from "react";

/**
 * WEISS restricts operation on screens below a minimum size. Small displays reduce the operator's
 * ability to interpret process values, increase the likelihood of accidental interaction, and may
 * compromise layout consistency. Based on that, layouts smaller than 768×600 are intentionally
 * blocked.
 */

export const MIN_WIDTH = 768;
export const MIN_HEIGHT = 600;

export function ScreenGuard() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const mqW = window.matchMedia(`(max-width: ${MIN_WIDTH}px)`);
    const mqH = window.matchMedia(`(max-height: ${MIN_HEIGHT}px)`);

    const evaluate = () => {
      setBlocked(mqW.matches || mqH.matches);
    };

    evaluate();
    mqW.addEventListener("change", evaluate);
    mqH.addEventListener("change", evaluate);

    return () => {
      mqW.removeEventListener("change", evaluate);
      mqH.removeEventListener("change", evaluate);
    };
  }, []);

  if (!blocked) return null;
  return (
    <div
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.2rem",
        padding: "32px",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "600px", lineHeight: 1.4 }}>
        Limited space reduces clarity and increases the chance of mistakes when dealing with control
        systems. To keep interactions reliable, the minimum viewport allowed is {MIN_WIDTH}×
        {MIN_HEIGHT}. Please, switch to a desktop browser.
      </div>
    </div>
  );
}
