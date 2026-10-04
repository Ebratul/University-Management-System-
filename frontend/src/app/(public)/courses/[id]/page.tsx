import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, GraduationCap, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getAllCourses, getCourse, getCourseOfferings } from "@/lib/api/public-data";

/** Pre-renders every course. New courses are generated on first visit, then cached. */
export async function generateStaticParams() {
  const courses = await getAllCourses().catch(() => []);
  return courses.map((course) => ({ id: course.id }));
}

export async function generateMetadata({ params }: PageProps<"/courses/[id]">): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) return { title: "Course not found" };

  return {
    title: `${course.courseCode} ${course.title}`,
    description: `${course.title} (${course.credits} credits) in ${course.department.name}.`,
  };
}

export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  const offerings = await getCourseOfferings(id);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/courses" className="hover:text-foreground underline-offset-4 hover:underline">
          Courses
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/departments/${course.departmentId}`} className="hover:text-foreground underline-offset-4 hover:underline">
          {course.department.name}
        </Link>
      </nav>

      <PageHeader
        eyebrow={course.courseCode}
        title={course.title}
        description={`${course.credits} credits · ${course.department.name}`}
      />

      <section aria-labelledby="offerings-heading" className="space-y-4">
        <h2 id="offerings-heading" className="text-xl font-semibold tracking-tight">
          Upcoming offerings
        </h2>

        {offerings.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {offerings.map((offering) => {
              const fillPercent = offering.maxSeats > 0 ? (offering.enrolledCount / offering.maxSeats) * 100 : 0;
              const full = offering.seatsRemaining <= 0;

              return (
                <li key={offering.id}>
                  <Card className="h-full">
                    <CardHeader className="gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">
                          {offering.semester.code} {offering.semester.year}
                        </CardTitle>
                        <Badge variant={full ? "destructive" : "secondary"}>
                          {full ? "Full" : `${offering.seatsRemaining} seats left`}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <GraduationCap className="size-4" aria-hidden="true" />
                        {offering.faculty.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <Users className="size-3.5" aria-hidden="true" />
                            {offering.enrolledCount} of {offering.maxSeats} enrolled
                          </span>
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5" aria-hidden="true" />
                            {offering.semester.status.toLowerCase()}
                          </span>
                        </div>
                        <Progress value={fillPercent} aria-label={`${Math.round(fillPercent)}% of seats taken`} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="Not offered yet" description="This course has no offerings scheduled. Check back once the next semester is planned." />
        )}
      </section>
    </div>
  );
}
