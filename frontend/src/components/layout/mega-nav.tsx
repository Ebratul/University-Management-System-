"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MenuGroup } from "@/lib/navigation";

/**
 * Desktop dropdown navigation. Opens on hover, click, Enter/Space or ArrowDown;
 * Escape closes and returns focus to the trigger. Panels are real links, so
 * keyboard users tab straight through them.
 */
export function MegaNav({ groups, className }: { groups: MenuGroup[]; className?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLUListElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenIndex(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openIndex]);

  return (
    <nav aria-label="Main" className={className}>
      <ul ref={rootRef} className="flex items-center gap-0.5" onMouseLeave={() => setOpenIndex(null)}>
        {groups.map((group, index) => {
          const open = openIndex === index;
          const panelId = `${baseId}-panel-${index}`;
          const wide = group.links.length > 4;

          return (
            <li
              key={group.label}
              className="relative"
              onMouseEnter={() => setOpenIndex(index)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOpenIndex((current) => (current === index ? null : current));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && open) {
                  setOpenIndex(null);
                  event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
                }
              }}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  open ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {group.label}
                <ChevronDown
                  aria-hidden="true"
                  className={cn("size-3.5 transition-transform", open && "rotate-180")}
                />
              </button>

              <div
                id={panelId}
                hidden={!open}
                className={cn(
                  "bg-popover text-popover-foreground absolute top-full left-0 z-50 pt-2",
                  wide ? "w-[34rem]" : "w-72",
                )}
              >
                <div className="rounded-xl border p-2 shadow-lg ring-1 ring-foreground/5">
                  <ul className={cn("grid gap-1", wide && "grid-cols-2")}>
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          onClick={() => setOpenIndex(null)}
                          className="hover:bg-muted focus-visible:ring-ring/50 block rounded-lg px-3 py-2.5 outline-none focus-visible:ring-3"
                        >
                          <span className="block text-sm font-medium">{link.label}</span>
                          {link.description ? (
                            <span className="text-muted-foreground block text-xs">{link.description}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
