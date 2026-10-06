"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useApiQuery } from "@/hooks/use-api-query";
import { websiteSettingsApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { DEFAULT_WEBSITE_SETTINGS } from "@/lib/website-settings";
import type { WebsiteSettings } from "@/types/entities";

/**
 * Website settings for client components. Every component shares one cached
 * query; an admin save invalidates it. The server seeds the cache (below), so
 * the first paint needs no request.
 */
export function useWebsiteSettings(): WebsiteSettings {
  const query = useApiQuery({
    queryKey: queryKeys.websiteSettings,
    queryFn: websiteSettingsApi.get,
    staleTime: 5 * 60_000,
  });
  return query.data ?? DEFAULT_WEBSITE_SETTINGS;
}

/** Seeds the query cache once with the settings the server already fetched. */
export function WebsiteSettingsSeed({
  settings,
  children,
}: {
  settings: WebsiteSettings;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  useState(() => {
    if (queryClient.getQueryData(queryKeys.websiteSettings) === undefined) {
      queryClient.setQueryData(queryKeys.websiteSettings, settings);
    }
  });
  return children;
}
