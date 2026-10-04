"use client";

import { useMemo } from "react";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useUrlParam } from "@/hooks/use-url-param";
import type { Faculty } from "@/types/entities";

import { FacultyCard } from "./cards";
import { SearchField } from "./search-field";

export function FacultyDirectory({ faculties }: { faculties: Faculty[] }) {
  const [query, setQuery] = useUrlParam("q");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return faculties;

    return faculties.filter((faculty) =>
      [faculty.name, faculty.designation, faculty.facultyId, faculty.department.name]
        .some((field) => field.toLowerCase().includes(needle)),
    );
  }, [faculties, query]);

  return (
    <div className="space-y-6">
      <SearchField
        label="Search faculty"
        placeholder="Search by name, designation or department"
        value={query}
        onChange={setQuery}
      />

      <p aria-live="polite" className="text-muted-foreground text-sm">
        Showing {filtered.length} of {faculties.length} faculty members
      </p>

      {filtered.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((faculty) => (
            <li key={faculty.id}>
              <FacultyCard faculty={faculty} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={SearchX}
          title="No one matches that search"
          action={
            query ? (
              <Button variant="outline" onClick={() => setQuery("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
