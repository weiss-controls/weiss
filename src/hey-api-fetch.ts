// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 André Favoto

import type { CreateClientConfig } from "./services/APIClient/client.gen";

function resolveApiBaseUrl(): string {
  const { protocol, hostname } = window.location;
  if (protocol === "https:") {
    return `${protocol}//${hostname}`;
  }
  // dev
  return `${protocol}//${hostname}:8000`;
}

// define custom fetch to always include credentials and throw on error
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: resolveApiBaseUrl(),

  fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const res = await fetch(input, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Request failed: ${res.status} - ${msg}`);
    }

    return res;
  },
});
