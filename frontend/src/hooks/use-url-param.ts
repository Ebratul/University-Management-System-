"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Two-way binding between a piece of UI state and a URL query parameter.
 *
 * The value updates instantly in local state, so typing is never held up by
 * navigation. The URL follows after `debounceMs`, so filters survive a refresh
 * and can be shared as links. `router.replace` keeps the history clean.
 *
 * Components that use this must sit under a <Suspense> boundary, because
 * useSearchParams opts the route out of static prerendering.
 */
export function useUrlParam(key: string, debounceMs = 250, resetKeys: string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(key) ?? "");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = new URLSearchParams(window.location.search);
      if ((current.get(key) ?? "") === value) return;

      if (value) current.set(key, value);
      else current.delete(key);
      // Changing a filter should start the list again from page 1.
      for (const resetKey of resetKeys) current.delete(resetKey);

      const query = current.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [value, key, pathname, router, debounceMs, resetKeys]);

  return [value, setValue] as const;
}
