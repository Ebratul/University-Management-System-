"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed on an interval. State changes only inside the timer callback. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Milliseconds the server clock is ahead of this device, measured when the
 * response arrived. The deadline is always judged by the server; this only makes
 * the on-screen countdown agree with it even if the device clock is wrong.
 */
export function serverOffset(serverTime: string | undefined, receivedAt: number): number {
  if (!serverTime || !receivedAt) return 0;
  return Date.parse(serverTime) - receivedAt;
}
