"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { CourseOffering } from "@/types/entities";

/*
 * Chart colours are the brand palette, written as literal colour strings: SVG
 * presentation attributes do not resolve CSS variables reliably.
 */
const roleColours = {
  ADMIN: "oklch(0.51 0.23 277)",
  FACULTY: "oklch(0.6 0.12 185)",
  STUDENT: "oklch(0.8 0.16 80)",
} as const;

export function RolesDonut({ byRole }: { byRole: Record<"ADMIN" | "FACULTY" | "STUDENT", number> }) {
  const data = (Object.keys(roleColours) as (keyof typeof roleColours)[]).map((role) => ({
    name: role.charAt(0) + role.slice(1).toLowerCase(),
    value: byRole[role],
    role,
  }));

  return (
    <div role="img" aria-label={`Accounts by role: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
            {data.map((entry) => (
              <Cell key={entry.role} fill={roleColours[entry.role]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={28} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Enrolled vs. free seats for the eight largest offerings. */
export function SeatBars() {
  const query = { limit: 8, sortBy: "maxSeats", sortOrder: "desc" as const };
  const offerings = useApiQuery({
    queryKey: queryKeys.courseOfferings.list(query),
    queryFn: () => apiListRequest<CourseOffering>("/course-offerings", query),
  });

  const data = (offerings.data?.data ?? []).map((offering) => ({
    name: offering.course.courseCode,
    enrolled: offering.enrolledCount,
    free: Math.max(0, offering.seatsRemaining),
  }));

  if (offerings.isPending) return <div className="bg-muted h-64 w-full animate-pulse rounded-lg" aria-hidden="true" />;
  if (data.length === 0) return <p className="text-muted-foreground py-16 text-center text-sm">No offerings yet.</p>;

  return (
    <div role="img" aria-label={`Seat use for ${data.length} offerings`} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.12} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" />
          <Bar dataKey="enrolled" name="Enrolled" stackId="seats" fill="oklch(0.51 0.23 277)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="free" name="Free seats" stackId="seats" fill="oklch(0.9 0.02 277)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
