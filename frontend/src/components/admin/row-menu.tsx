"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type RowMenuItem = { label: ReactNode; onSelect: () => void; destructive?: boolean; disabled?: boolean };

/** "More" menu for a table row. Used where a row has several actions. */
export function RowMenu({ label, items, groupLabel }: { label: string; items: RowMenuItem[]; groupLabel?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {groupLabel ? <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel> : null}
        {items.map((item, index) => (
          <span key={index}>
            {item.destructive && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={item.disabled}
              onSelect={item.onSelect}
              className={item.destructive ? "text-destructive focus:text-destructive" : undefined}
            >
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
