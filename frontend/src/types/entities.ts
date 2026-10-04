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
  course: Pick<Course, "id" | "courseCode" | "title" | "credits">;
  faculty: Pick<Faculty, "id" | "facultyId" | "name">;
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
  student: Pick<StudentRecord, "id" | "studentId" | "name"> & { userId: string };
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
