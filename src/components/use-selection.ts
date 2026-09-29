"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { demo } from "@/lib/demo";

const key = "touchline-selection";
const event = "touchline-selection-change";
const schema = z.object({
  club: z.object({
    id: z.string().regex(/^(demo|\d{1,20})$/),
    name: z.string(),
  }),
  player: z.string(),
});
type Selection = z.infer<typeof schema>;
let memory: string | null = null;
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(event, callback);
  };
}
function read() {
  try {
    return localStorage.getItem(key) ?? memory;
  } catch {
    return memory;
  }
}
function serverSnapshot() {
  return null;
}

export function useSelection() {
  const raw = useSyncExternalStore(subscribe, read, serverSnapshot);
  let selection: Selection = { club: demo.club, player: "andrewszn" };
  try {
    const parsed = schema.safeParse(JSON.parse(raw ?? "null"));
    if (parsed.success) selection = parsed.data;
  } catch {
    /* Ignore invalid saved preferences. */
  }
  function save(next: Selection) {
    memory = JSON.stringify(next);
    try {
      localStorage.setItem(key, memory);
    } catch {
      /* Keep an in-memory fallback. */
    }
    window.dispatchEvent(new Event(event));
  }
  return [selection, save] as const;
}
