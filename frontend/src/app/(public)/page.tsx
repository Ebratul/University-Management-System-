import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  BookOpenCheck,
  Building2,
  CreditCard,
  FlaskConical,
  GraduationCap,
  Handshake,
  Library,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { NoticeCard } from "@/components/catalog/cards";
import { HomeSection } from "@/components/home/home-section";
import { Hero } from "@/components/home/hero";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllDepartments, getLatestNotices, getWebsiteSettings } from "@/lib/api/public-data";
import { LOGIN_HREF } from "@/lib/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getWebsiteSettings();
  const image = settings.homepageBackgroundUrl ?? settings.logoUrl;

  return {
    title: { absolute: settings.universityName },
    description: settings.tagline,
    openGraph: {
      type: "website",
      siteName: settings.universityName,
      title: settings.universityName,
      description: settings.tagline,
      ...(image ? { images: [{ url: image, alt: settings.universityName }] } : {}),
    },
  };
}

type QuickLink = { label: string; description: string; href: string; icon: LucideIcon };

const quickLinks: QuickLink[] = [
  { label: "Apply now", description: "Create your account", href: "/register", icon: UserPlus },
  { label: "Course catalogue", description: "Browse programs and courses", href: "/courses", icon: BookOpenCheck },
  { label: "Student portal", description: "Enrolment, results, fees", href: "/student", icon: GraduationCap },
  { label: "Faculty portal", description: "Offerings and grading", href: "/faculty", icon: Users },
  { label: "Notices", description: "Latest announcements", href: "/notices", icon: Bell },
];

const studentServices: QuickLink[] = [
  { label: "Enrolment", description: "Enrol in offerings with live seat availability.", href: "/student/courses", icon: BookOpenCheck },
  { label: "Results", description: "Grades and GPA, published when faculty release them.", href: "/student/results", icon: GraduationCap },
  { label: "Fees & payments", description: "Pay semester fees through a secure gateway.", href: "/student/payments", icon: CreditCard },
];

export default async function HomePage() {
  const [settings, notices, departments] = await Promise.all([
    getWebsiteSettings(),
    getLatestNotices(3).catch(() => []),
    getAllDepartments().catch(() => []),
  ]);

  return (
    <>
      <Hero settings={settings} />

      <nav aria-label="Quick links" className="relative z-10 mx-auto -mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <ul className="bg-card grid gap-px overflow-hidden rounded-2xl border shadow-lg sm:grid-cols-2 lg:grid-cols-5">
          {quickLinks.map((item) => (
            <li key={item.label} className="bg-card">
              <Link
                href={item.href}
                className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-16 items-center gap-3 p-4 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-inset"
              >
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="text-muted-foreground block truncate text-xs">{item.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <HomeSection
        id="academic"
        eyebrow="Academic"
        title="Departments and programs"
        description="Explore the departments that make up the university and the courses they offer."
        action={
          <Button asChild variant="ghost">
            <Link href="/departments">All departments</Link>
          </Button>
        }
      >
        {departments.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.slice(0, 6).map((department) => (
              <li key={department.id}>
                <Link
                  href={`/departments/${department.id}`}
                  className="group hover:border-primary/40 focus-visible:ring-ring/50 bg-card flex h-full items-center gap-4 rounded-xl border p-4 outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3"
                >
                  <span className="bg-brand-teal/15 text-brand-teal flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <Building2 className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-balance">{department.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">{department.code}</span>
                  </span>
                  <ArrowUpRight className="text-muted-foreground size-4 shrink-0 transition-colors group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Building2} title="Departments coming soon" description="Departments will be listed here once they are published." />
        )}
      </HomeSection>

      <HomeSection
        id="admission"
        eyebrow="Admission"
        title="Begin your journey"
        description="Create an account, choose your courses and manage everything about your studies in one place."
        muted
      >
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: "Apply", text: "Register an account with your details." },
            { step: "2", title: "Enrol", text: "Pick course offerings with live seat availability." },
            { step: "3", title: "Study", text: "Follow results, notices and fees from your portal." },
          ].map((item) => (
            <li key={item.step} className="bg-card rounded-xl border p-5">
              <span className="bg-brand-gradient mb-3 flex size-8 items-center justify-center rounded-full text-sm font-bold text-white">
                {item.step}
              </span>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{item.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="bg-brand-gradient text-white hover:opacity-90">
            <Link href="/register">Apply now</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/notices">Admission notices</Link>
          </Button>
        </div>
      </HomeSection>

      <HomeSection
        id="students"
        eyebrow="For students"
        title="Student services"
        description="Everything a student needs, available from the student portal."
      >
        <ul className="grid gap-4 md:grid-cols-3">
          {studentServices.map((service) => (
            <li key={service.label}>
              <Card className="hover:border-primary/40 h-full transition-all hover:shadow-md">
                <CardHeader className="gap-3">
                  <span className="bg-brand-indigo/12 text-brand-indigo flex size-11 items-center justify-center rounded-xl">
                    <service.icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="text-base">
                    <Link href={service.href} className="outline-none after:absolute after:inset-0">
                      {service.label}
                    </Link>
                  </CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </HomeSection>

      <HomeSection
        id="faculty"
        eyebrow="For faculty & staff"
        title="Teaching made simple"
        description="Faculty manage their course offerings, enrolled students and results from the faculty portal."
        muted
        action={
          <Button asChild variant="outline">
            <Link href="/faculty">Faculty portal</Link>
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/faculties" className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 rounded-xl border p-5 outline-none transition-all hover:shadow-md focus-visible:ring-3">
            <Users className="text-brand-violet mb-3 size-6" aria-hidden="true" />
            <h3 className="font-semibold">Faculty directory</h3>
            <p className="text-muted-foreground mt-1 text-sm">Find the people who teach each course.</p>
          </Link>
          <Link href="/faculty/offerings" className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 rounded-xl border p-5 outline-none transition-all hover:shadow-md focus-visible:ring-3">
            <BookOpenCheck className="text-brand-teal mb-3 size-6" aria-hidden="true" />
            <h3 className="font-semibold">My offerings</h3>
            <p className="text-muted-foreground mt-1 text-sm">Review enrolled students and publish results.</p>
          </Link>
        </div>
      </HomeSection>

      <HomeSection
        id="research"
        eyebrow="Research"
        title="Research at the university"
        description="Our departments and faculty drive research across disciplines. Browse departments and researchers to learn more."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/departments" className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 flex items-center gap-4 rounded-xl border p-5 outline-none transition-all hover:shadow-md focus-visible:ring-3">
            <FlaskConical className="text-brand-rose size-7 shrink-0" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Research departments</span>
              <span className="text-muted-foreground text-sm">Where research groups are based.</span>
            </span>
          </Link>
          <Link href="/faculties" className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 flex items-center gap-4 rounded-xl border p-5 outline-none transition-all hover:shadow-md focus-visible:ring-3">
            <Users className="text-brand-sky size-7 shrink-0" aria-hidden="true" />
            <span>
              <span className="block font-semibold">Researchers</span>
              <span className="text-muted-foreground text-sm">Meet our faculty members.</span>
            </span>
          </Link>
        </div>
      </HomeSection>

      <HomeSection
        id="news"
        eyebrow="News & announcements"
        title="Latest news"
        muted
        action={
          <Button asChild variant="ghost">
            <Link href="/notices">View all</Link>
          </Button>
        }
      >
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
      </HomeSection>

      <HomeSection
        id="alumni"
        eyebrow="Alumni"
        title="Stay connected"
        description="Graduates remain part of the university community. Sign in to your account to keep your details up to date."
      >
        <Button asChild variant="outline" size="lg">
          <Link href={LOGIN_HREF}>
            <Handshake className="size-4" aria-hidden="true" />
            Sign in
          </Link>
        </Button>
      </HomeSection>

      <HomeSection
        id="resources"
        eyebrow="Resources"
        title="Useful links"
        muted
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Course catalogue", href: "/courses" },
            { label: "Departments", href: "/departments" },
            { label: "Faculty directory", href: "/faculties" },
            { label: "Notices", href: "/notices" },
          ].map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 flex min-h-12 items-center gap-3 rounded-lg border px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-3"
              >
                <Library className="text-primary size-4 shrink-0" aria-hidden="true" />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </HomeSection>
    </>
  );
}
