// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import { useEffect, useRef } from "react";

/**
 * Runs `commit` when the calling component unmounts, so a pending local edit is
 * still submitted even if no blur/Enter event fires first (e.g. the row unmounts
 * because the user switched to another widget while a field was mid-edit).
 * `commit` is re-captured on every render so the unmount call always sees fresh data.
 */
export default function useCommitOnUnmount(commit: () => void) {
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    return () => commitRef.current();
  }, []);
}
