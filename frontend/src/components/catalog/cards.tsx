import Link from "next/link";
import { ArrowUpRight, Building2, Mail, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Course, Department, Faculty, Notice, NoticeAudience } from "@/types/entities";

const audienceLabel: Record<NoticeAudience, string> = {
  ALL: "Everyone",
  STUDENT: "Students",
  FACULTY: "Faculty",
};

const audienceTone: Record<NoticeAudience, string> = {
  ALL: "bg-brand-indigo/12 text-brand-indigo",
  STUDENT: "bg-brand-teal/15 text-brand-teal",
  FACULTY: "bg-brand-violet/12 text-brand-violet",
};

/** Hover and focus lift shared by every linked card. */
const linkedCardClass =
  "group relative h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:ring-3 focus-within:ring-ring/50";

export function DepartmentCard({ department }: { department: Department }) {
  return (
    <Card className={linkedCardClass}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="bg-brand-teal/15 text-brand-teal flex size-11 items-center justify-center rounded-xl">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <Badge variant="outline" className="font-mono">
            {department.code}
          </Badge>
        </div>
        <CardTitle className="text-base">
          <Link href={`/departments/${department.id}`} className="outline-none after:absolute after:inset-0">
            {department.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          View courses <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <Card className={linkedCardClass}>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground font-mono text-xs">{course.courseCode}</span>
          <Badge variant="secondary">{course.credits} credits</Badge>
        </div>
        <CardTitle className="text-base text-balance">
          <Link href={`/courses/${course.id}`} className="outline-none after:absolute after:inset-0">
            {course.title}
          </Link>
        </CardTitle>
        <CardDescription>{course.department.name}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function FacultyCard({ faculty }: { faculty: Faculty }) {
  return (
    <Card className="h-full">
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <span className="bg-brand-violet/12 text-brand-violet flex size-11 shrink-0 items-center justify-center rounded-full">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{faculty.name}</CardTitle>
            <CardDescription>{faculty.designation}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-2 text-sm">
        <p className="flex items-center gap-2">
          <Building2 className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{faculty.department.name}</span>
        </p>
        <p className="flex items-center gap-2 font-mono text-xs">
          <Mail className="size-4 shrink-0" aria-hidden="true" />
          {faculty.facultyId}
        </p>
      </CardContent>
    </Card>
  );
}

export function NoticeCard({ notice, href }: { notice: Notice; href?: string }) {
  return (
    <Card className={href ? linkedCardClass : "h-full"}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={audienceTone[notice.audience]} variant="secondary">
            {audienceLabel[notice.audience]}
          </Badge>
          <time dateTime={notice.createdAt} className="text-muted-foreground text-xs">
            {formatDate(notice.createdAt)}
          </time>
        </div>
        <CardTitle className="text-base text-balance">
          {href ? (
            <Link href={href} className="outline-none after:absolute after:inset-0">
              {notice.title}
            </Link>
          ) : (
            notice.title
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground line-clamp-3 text-sm text-pretty">{notice.content}</p>
      </CardContent>
    </Card>
  );
}
