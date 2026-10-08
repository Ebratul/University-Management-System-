export type Role = "ADMIN" | "FACULTY" | "STUDENT";

export type SemesterStatus = "UPCOMING" | "ONGOING" | "COMPLETED";

export type NoticeAudience = "ALL" | "STUDENT" | "FACULTY";

export type DepartmentRef = {
  id: string;
  name: string;
  code: string;
};

export type Department = DepartmentRef & {
  createdAt: string;
  updatedAt: string;
};

export type Course = {
  id: string;
  courseCode: string;
  title: string;
  credits: number;
  departmentId: string;
  department: DepartmentRef;
  createdAt: string;
  updatedAt: string;
};

export type Faculty = {
  id: string;
  userId: string;
  facultyId: string;
  name: string;
  designation: string;
  phone: string | null;
  departmentId: string;
  department: DepartmentRef;
  createdAt: string;
  updatedAt: string;
};

export type Semester = {
  id: string;
  year: number;
  code: string;
  startDate: string;
  endDate: string;
  status: SemesterStatus;
  feeAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type CourseOffering = {
  id: string;
  maxSeats: number;
  enrolledCount: number;
  seatsRemaining: number;
  course: Pick<Course, "id" | "courseCode" | "title" | "credits"> & {
    description?: string | null;
    department?: DepartmentRef;
  };
  faculty: Pick<Faculty, "id" | "facultyId" | "name"> & { user?: { imageUrl: string } };
  semester: Pick<Semester, "id" | "code" | "year" | "status">;
  createdAt: string;
  updatedAt: string;
};

export type Notice = {
  id: string;
  title: string;
  content: string;
  audience: NoticeAudience;
  postedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

/** Response of GET /users/me. Profile objects are null when the role has no profile. */
export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  imageUrl: string;
  admin: { id: string; name: string; phone: string | null } | null;
  faculty: {
    id: string;
    facultyId: string;
    name: string;
    phone: string | null;
    designation: string;
    departmentId: string;
  } | null;
  student: {
    id: string;
    studentId: string;
    registrationNumber: string;
    name: string;
    phone: string | null;
    dateOfBirth: string | null;
    departmentId: string;
    admissionSemesterId: string;
  } | null;
};

/** Response of POST /auth/login, /register and /google. Tokens travel in httpOnly cookies. */
export type AuthSessionUser = {
  id: string;
  email: string;
  role: Role;
  name?: string;
};

export type EnrollmentStatus = "PENDING" | "ENROLLED" | "COMPLETED" | "DROPPED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

/** Row from GET /users (admin). Profile objects are null when that role has no profile. */
export type AdminUser = {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  imageUrl: string;
  createdAt: string;
  admin: { id: string; name: string } | null;
  faculty: { id: string; name: string; facultyId: string } | null;
  student: { id: string; name: string; studentId: string } | null;
};

/** Full student profile from GET /students and /students/:id. */
export type StudentRecord = {
  id: string;
  userId: string;
  studentId: string;
  registrationNumber: string;
  user?: { imageUrl: string };
  name: string;
  phone: string | null;
  dateOfBirth: string | null;
  departmentId: string;
  admissionSemesterId: string;
  createdAt: string;
  department: DepartmentRef;
  admissionSemester: Pick<Semester, "id" | "code" | "year">;
};

export type Enrollment = {
  id: string;
  status: EnrollmentStatus;
  studentId: string;
  courseOfferingId: string;
  enrolledAt: string;
  student: Pick<StudentRecord, "id" | "studentId" | "name"> & {
    userId: string;
    registrationNumber?: string;
    user?: { imageUrl: string };
  };
  courseOffering: {
    id: string;
    maxSeats: number;
    course: Pick<Course, "id" | "courseCode" | "title" | "credits">;
    semester?: Pick<Semester, "id" | "code" | "year">;
  };
};

export type Payment = {
  id: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId: string | null;
  gatewayPaymentId: string;
  failureReason: string | null;
  studentId: string;
  semesterId: string;
  paidAt: string | null;
  createdAt: string;
  student: Pick<StudentRecord, "id" | "studentId" | "name">;
  semester: Pick<Semester, "id" | "code" | "year">;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  performedByUserId: string | null;
  performedByEmail: string | null;
  performedByRole: Role | null;
  description: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
};

/** Row from GET /results. */
export type Result = {
  id: string;
  grade: string;
  gradePoint: number;
  enrollmentId: string;
  publishedAt: string;
  updatedAt: string;
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    student: Pick<StudentRecord, "id" | "studentId" | "name">;
    courseOffering: {
      id: string;
      course: Pick<Course, "id" | "courseCode" | "title" | "credits">;
    };
  };
};

/** Public website branding. Response of GET /website-settings. */
export type WebsiteSettings = {
  universityName: string;
  tagline: string;
  logoUrl: string | null;
  homepageBackgroundUrl: string | null;
  updatedAt: string;
};

// ----------------------------- Course home -----------------------------

/** A person shown in a course roster: picture, name and registration number. */
export type RosterStudent = {
  id: string;
  studentId: string;
  registrationNumber: string;
  name: string;
  imageUrl: string;
};

export type CourseMaterial = {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  courseOfferingId: string;
};

export type AttendanceStatus = "PRESENT" | "ABSENT";

export type AttendanceRoster = {
  date: string;
  alreadyMarked: boolean;
  students: (RosterStudent & { status: AttendanceStatus | null })[];
};

export type AttendanceTotals = {
  totalClasses: number;
  present: number;
  absent: number;
  percentage: number;
};

export type AttendanceSummary = {
  totalClassDays: number;
  students: (RosterStudent & AttendanceTotals)[];
};

export type MyAttendance = AttendanceTotals & {
  records: { date: string; status: AttendanceStatus }[];
};

// ------------------------------- Quizzes -------------------------------

export type QuizStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "ENDED";
export type QuizChoice = "A" | "B" | "C" | "D";
export type QuizAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";

export type QuizAttemptSummary = {
  id: string;
  status: QuizAttemptStatus;
  score: number | null;
  totalQuestions: number | null;
  percentage: number | null;
  startedAt: string;
  submittedAt: string | null;
};

/** Row of GET /course-offerings/:id/quizzes. `myAttempt` is only sent to students. */
export type QuizListItem = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: QuizStatus;
  startedAt: string | null;
  endsAt: string | null;
  createdAt: string;
  material: { id: string; title: string } | null;
  _count: { questions: number; attempts: number };
  myAttempt?: QuizAttemptSummary | null;
};

export type QuizList = { serverTime: string; quizzes: QuizListItem[] };

/** A question as the teacher sees it (with the answer key). */
export type QuizQuestionDraft = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: QuizChoice;
  explanation?: string | null;
  sourceReference?: string | null;
};

export type QuizQuestionStaff = QuizQuestionDraft & { id: string; order: number };

export type QuizDetail = {
  id: string;
  courseOfferingId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  status: QuizStatus;
  startedAt: string | null;
  endsAt: string | null;
  showAnswersAfterEnd: boolean;
  material: { id: string; title: string } | null;
  questionCount: number;
  attemptCount: number;
  serverTime: string;
  /** Staff only. */
  questions?: QuizQuestionStaff[];
  /** Students only. */
  myAttempt?: QuizAttemptSummary | null;
};

/** A question as a student sees it while taking the quiz: no answer key. */
export type QuizQuestionPublic = {
  id: string;
  order: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

export type QuizAttemptStart = {
  serverTime: string;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    durationMinutes: number;
    startedAt: string;
    endsAt: string;
  };
  attempt: { id: string; status: QuizAttemptStatus; startedAt: string };
  questions: QuizQuestionPublic[];
  answers: Record<string, QuizChoice>;
};

export type QuizResultReview = QuizQuestionPublic & {
  correctAnswer: QuizChoice;
  explanation: string | null;
  sourceReference: string | null;
  selectedAnswer: QuizChoice | null;
  isCorrect: boolean;
};

export type MyQuizResult = {
  quizId: string;
  quizTitle: string;
  status: QuizAttemptStatus;
  score: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  percentage: number;
  submittedAt: string | null;
  quizEnded: boolean;
  review?: QuizResultReview[];
};

export type QuizResults = {
  quiz: { id: string; title: string; status: QuizStatus; endsAt: string | null };
  summary: { enrolled: number; attempted: number; averagePercentage: number };
  results: {
    student: RosterStudent;
    status: QuizAttemptStatus | "NOT_ATTEMPTED";
    score: number | null;
    totalQuestions: number | null;
    percentage: number | null;
    submittedAt: string | null;
  }[];
};

export type GeneratedQuiz = {
  materialId: string;
  requested: number;
  questions: QuizQuestionDraft[];
  warnings: string[];
};
