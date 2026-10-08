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

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** "4 Oct 2026, 10:20" in the viewer's own time zone. Only for client-rendered data. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** "2.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "19:42" (or "1:05:09" past an hour) from a number of milliseconds. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Today as YYYY-MM-DD in the viewer's local time (what a teacher means by "today"). */
export function todayLocalIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

// A fixed "৳" and en-US digit grouping: the same text in every browser, unlike
// Intl's currency style, whose symbol depends on the viewer's locale data.
const taka = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Integer paisa -> "৳1,320.00". The API sends money as whole paisa, never floats. */
export function formatPaisa(paisa: number): string {
  return `৳${taka.format(paisa / 100)}`;
}

/** "120.50" (what an admin types) -> 12050 paisa, without floating-point arithmetic. */
export function bdtToPaisa(value: string): number {
  const [whole = "0", fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

/** 12050 -> "120.50". */
export function paisaToBdt(paisa: number): string {
  return `${Math.floor(paisa / 100)}.${String(paisa % 100).padStart(2, "0")}`;
}
