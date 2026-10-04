"use client";

import type { ReactNode } from "react";

import { SearchField } from "@/components/catalog/search-field";
import { useUrlParam } from "@/hooks/use-url-param";

/** Shared top row for admin lists: search on the left, filters and the primary action on the right. */
const RESET_PAGE = ["page"];

export function useListSearch() {
  return useUrlParam("searchTerm", 300, RESET_PAGE);
}

export function ListToolbar({
  search,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  filters,
  action,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  filters?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField label={searchLabel} placeholder={searchPlaceholder} value={search} onChange={onSearchChange} />
        {filters}
      </div>
      {action ? <div className="flex justify-end">{action}</div> : null}
    </div>
  );
}
