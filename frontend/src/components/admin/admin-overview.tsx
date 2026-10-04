"use client";

import Link from "next/link";
import { BadgeDollarSign, BookOpen, Building2, Bell, CalendarClock, CreditCard, GraduationCap, Users, type LucideIcon } from "lucide-react";

import { StatCard, type StatTone } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import dynamic from "next/dynamic";

import { apiRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { ADMIN_NAV } from "@/lib/auth/nav";

type AdminStats = {
  users: { total: number; byRole: Record<"ADMIN" | "FACULTY" | "STUDENT", number> };
  totalDepartments: number;
  totalCourses: number;
  totalFaculties: number;
  totalStudents: number;
  totalNotices: number;
  activeEnrollments: number;
  pendingPayments: number;
  totalRevenueCollected: number;
  generatedAt: string;
};

// Charts are heavy and below the fold, so they load after the page shell.
const RolesDonut = dynamic(() => import("@/components/admin/admin-charts").then((m) => m.RolesDonut), { ssr: false, loading: () => <div className="bg-muted h-64 w-full animate-pulse rounded-lg" aria-hidden="true" /> });
const SeatBars = dynamic(() => import("@/components/admin/admin-charts").then((m) => m.SeatBars), { ssr: false });

const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });

export function AdminOverview() {
  const stats = useApiQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => apiRequest<AdminStats>("/admin/dashboard/stats"),
  });

  const cards: { label: string; value: string; hint: string; icon: LucideIcon; tone: StatTone }[] = stats.data
    ? [
        { label: "Students", value: stats.data.totalStudents.toLocaleString(), hint: `${stats.data.users.byRole.STUDENT} student accounts`, icon: GraduationCap, tone: "teal" },
        { label: "Faculty", value: stats.data.totalFaculties.toLocaleString(), hint: `${stats.data.users.byRole.FACULTY} faculty accounts`, icon: Users, tone: "violet" },
        { label: "Departments", value: stats.data.totalDepartments.toLocaleString(), hint: "Academic units", icon: Building2, tone: "indigo" },
        { label: "Courses", value: stats.data.totalCourses.toLocaleString(), hint: "In the catalogue", icon: BookOpen, tone: "sky" },
        { label: "Active enrolments", value: stats.data.activeEnrollments.toLocaleString(), hint: "Currently enrolled", icon: CalendarClock, tone: "amber" },
        { label: "Pending payments", value: stats.data.pendingPayments.toLocaleString(), hint: "Awaiting confirmation", icon: CreditCard, tone: "rose" },
        { label: "Revenue collected", value: money.format(stats.data.totalRevenueCollected), hint: "Paid fees, all semesters", icon: BadgeDollarSign, tone: "teal" },
        { label: "Notices", value: stats.data.totalNotices.toLocaleString(), hint: "Published announcements", icon: Bell, tone: "indigo" },
      ]
    : [];

  const shortcuts = ADMIN_NAV.filter((item) => item.href !== "/admin");

  return (
    <div className="space-y-10">
      <section aria-labelledby="stats-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="stats-heading" className="text-lg font-semibold tracking-tight">
            At a glance
          </h2>
          {stats.data ? (
            <p className="text-muted-foreground text-xs">Updated {new Date(stats.data.generatedAt).toLocaleTimeString()}</p>
          ) : null}
        </div>

        {stats.isError ? (
          <div role="alert" className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm">
            {stats.error.message}{" "}
            <button type="button" className="font-medium underline underline-offset-4" onClick={() => void stats.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.isPending
              ? Array.from({ length: 8 }, (_, index) => (
                  <Card key={index}>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-7 w-20" />
                    </CardContent>
                  </Card>
                ))
              : cards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="areas-heading" className="space-y-4">
        <h2 id="areas-heading" className="text-lg font-semibold tracking-tight">
          Manage
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shortcuts.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="bg-card hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 block rounded-xl border p-4 font-medium transition-all outline-none">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="insights-heading" className="grid gap-4 lg:grid-cols-2">
        <h2 id="insights-heading" className="sr-only">Insights</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts by role</CardTitle>
          </CardHeader>
          <CardContent>{stats.data ? <RolesDonut byRole={stats.data.users.byRole} /> : <Skeleton className="h-64 w-full" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Seat use, largest offerings</CardTitle>
          </CardHeader>
          <CardContent>
            <SeatBars />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
