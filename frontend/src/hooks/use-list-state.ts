"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ListQuery } from "@/types/api";

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

type ListStateValues = {
  page: number;
  limit: PageSize;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  searchTerm?: string;
  filters: Record<string, string | undefined>;
};

/**
 * Pagination, sorting, search and filters for a list, all stored in the URL.
 * A refresh keeps the view, and the view can be shared as a link. Changing any
 * filter or search resets to page 1.
 *
 * Needs a <Suspense> boundary above it (it reads useSearchParams).
 */
export function useListState(filterKeys: readonly string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serialized = searchParams.toString();
  const filterKeyList = filterKeys.join(",");

  const values = useMemo<ListStateValues>(() => {
    const params = new URLSearchParams(serialized);
    const limitValue = Number(params.get("limit"));
    const sortOrderValue = params.get("sortOrder");
    const filters: Record<string, string | undefined> = {};
    for (const key of filterKeyList ? filterKeyList.split(",") : []) {
      filters[key] = params.get(key) || undefined;
    }

    return {
      page: Math.max(1, Number(params.get("page")) || 1),
      limit: (PAGE_SIZES as readonly number[]).includes(limitValue) ? (limitValue as PageSize) : 10,
      sortBy: params.get("sortBy") || undefined,
      sortOrder: sortOrderValue === "asc" || sortOrderValue === "desc" ? sortOrderValue : undefined,
      searchTerm: params.get("searchTerm")?.trim() || undefined,
      filters,
    };
  }, [serialized, filterKeyList]);

  const update = useCallback(
    (changes: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(window.location.search);
      const changesFilter = Object.keys(changes).some((key) => key !== "page" && key !== "limit");

      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      // Narrowing the result set invalidates the current page number.
      if (changesFilter && !("page" in changes)) params.delete("page");

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const query: ListQuery = {
    page: values.page,
    limit: values.limit,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder,
    searchTerm: values.searchTerm,
    ...values.filters,
  };

  return { ...values, query, update };
}
