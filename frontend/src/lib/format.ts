const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/**
 * Formats an ISO timestamp as "4 Oct 2026". Pinned to UTC so static pages look
 * the same on the build machine and in the visitor's browser.
 */
export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}
