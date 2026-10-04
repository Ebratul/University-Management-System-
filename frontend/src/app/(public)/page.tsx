import Link from "next/link";
import {
  BookOpenCheck,
  Bell,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";

import { NoticeCard } from "@/components/catalog/cards";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestNotices } from "@/lib/api/public-data";
import { LOGIN_HREF } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const features = [
  { title: "Course catalogue", description: "Browse departments, courses and the semester schedule.", icon: BookOpenCheck, tone: "indigo" },
  { title: "Enrolment", description: "Enrol in offerings with live seat availability.", icon: GraduationCap, tone: "teal" },
  { title: "Results", description: "Grades and grade points, published the moment faculty release them.", icon: ShieldCheck, tone: "violet" },
  { title: "Fees & payments", description: "Pay semester fees through a secure, test-mode gateway.", icon: CreditCard, tone: "amber" },
  { title: "Notices", description: "Announcements targeted to students, faculty or everyone.", icon: Bell, tone: "rose" },
  { title: "Faculty directory", description: "Find the people who teach each course.", icon: Users, tone: "sky" },
] as const;

const featureTone = {
  indigo: "bg-brand-indigo/12 text-brand-indigo",
  violet: "bg-brand-violet/12 text-brand-violet",
  teal: "bg-brand-teal/15 text-brand-teal",
  amber: "bg-brand-amber/25 text-amber-700 dark:text-brand-amber",
  rose: "bg-brand-rose/12 text-brand-rose",
  sky: "bg-brand-sky/15 text-brand-sky",
} as const;

/**
 * Statically generated. The notices block is the only dynamic-looking part, and
 * it is refreshed in the background through ISR. If the API is down at build
 * time, the page still builds with an empty notices section.
 */
export default async function HomePage() {
  const notices = await getLatestNotices().catch(() => []);

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="bg-brand-gradient absolute inset-x-0 -top-40 -z-10 h-[28rem] opacity-15 blur-3xl" />
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Academic year 2026
          </span>
          <h1 className="max-w-3xl text-4xl leading-tight font-bold tracking-tight text-balance sm:text-6xl">
            Run your university in{" "}
            <span className="bg-brand-gradient bg-clip-text text-transparent">one place</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Courses, enrolment, results and fees for students, faculty and
            administrators, all in one modern portal.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="bg-brand-gradient w-full text-white hover:opacity-90 sm:w-auto">
              <Link href={LOGIN_HREF}>Log in to the portal</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/courses">Browse courses</Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl space-y-2">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">Everything in one place</p>
          <h2 id="features-heading" className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            Built around the people who use it
          </h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="gap-3">
                  <span className={cn("flex size-11 items-center justify-center rounded-xl", featureTone[feature.tone])}>
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="notices-heading" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">Latest</p>
            <h2 id="notices-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Notices
            </h2>
          </div>
          <Button asChild variant="ghost">
            <Link href="/notices">View all</Link>
          </Button>
        </div>

        {notices.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-3">
            {notices.map((notice) => (
              <li key={notice.id}>
                <NoticeCard notice={notice} href={`/notices/${notice.id}`} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Bell} title="No notices right now" description="Announcements will appear here as soon as they are published." />
        )}
      </section>
    </>
  );
}
