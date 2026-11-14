"use client";

import { useSyncExternalStore } from "react";
import { CUSTOM_CHANGED, loadCustomExercises } from "@/lib/data/custom-store";
import type { CustomExercise } from "@/lib/exercises/custom";

const NONE: CustomExercise[] = [];

function subscribe(onChange: () => void) {
  window.addEventListener(CUSTOM_CHANGED, onChange);
  window.addEventListener("storage", onChange); // another tab taught or removed one
  return () => {
    window.removeEventListener(CUSTOM_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Every taught exercise on this device (archived included), kept up to date. */
export function useCustomExercises(): CustomExercise[] {
  return useSyncExternalStore(subscribe, loadCustomExercises, () => NONE);
}
