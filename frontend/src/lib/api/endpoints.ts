import type { LoginInput } from "@/lib/validations/auth";
import type {
  AttendanceRoster,
  AttendanceStatus,
  AttendanceSummary,
  AuthSessionUser,
  CourseMaterial,
  CourseOffering,
  CurrentUser,
  Department,
  GeneratedQuiz,
  MyAttendance,
  MyQuizResult,
  QuizAttemptStart,
  QuizChoice,
  QuizDetail,
  QuizList,
  QuizQuestionDraft,
  QuizResults,
  Semester,
  Registration,
  RegistrationPreview,
  RegistrationReceipt,
  RegistrationSettingRow,
  RegistrationSettingValues,
  RegistrationStats,
  AvailableCourses,
  WebsiteSettings,
} from "@/types/entities";

import { apiListRequest, apiRequest } from "./client";

/** Must stay below next.config.ts experimental.proxyTimeout and the API's RAG_SERVICE_TIMEOUT_MS. */
const AI_REQUEST_TIMEOUT_MS = 150_000;

/** Typed client-side calls. Components import these instead of building URLs. */
/**
 * The API answers `{ user, accessToken, refreshToken }`. The tokens already
 * travel in httpOnly cookies, so callers only get the user.
 */
type AuthResponse = { user: AuthSessionUser };

/** Registration creates the account but does not sign in: the emailed code comes first. */
export type RegisterResult = {
  user: { id: string; email: string };
  verificationRequired: true;
  emailSent: boolean;
};

export const authApi = {
  login: async (body: LoginInput) =>
    (await apiRequest<AuthResponse>("/auth/login", { method: "POST", body })).user,

  /** Google Identity Services credential (an ID token). The API checks the university domain. */
  google: async (idToken: string) =>
    (await apiRequest<AuthResponse>("/auth/google", { method: "POST", body: { idToken } })).user,

  /** Multipart: text fields plus the required `picture` file. */
  register: (body: FormData) =>
    apiRequest<RegisterResult>("/auth/register", { method: "POST", body }),

  /** The right code verifies the address and signs the student in. */
  verifyEmail: async (body: { email: string; code: string }) =>
    (await apiRequest<AuthResponse>("/auth/verify-email", { method: "POST", body })).user,

  /** Always succeeds, whether or not the address has an account. */
  resendVerification: (email: string) =>
    apiRequest<null>("/auth/resend-verification", { method: "POST", body: { email } }),

  forgotPassword: (email: string) =>
    apiRequest<null>("/auth/forgot-password", { method: "POST", body: { email } }),

  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    apiRequest<null>("/auth/reset-password", { method: "POST", body }),

  logout: () => apiRequest<null>("/auth/logout", { method: "POST" }),
};

export const usersApi = {
  me: () => apiRequest<CurrentUser>("/users/me"),
};

export const catalogApi = {
  departments: () =>
    apiListRequest<Department>("/departments", {
      limit: 100,
      sortBy: "name",
      sortOrder: "asc",
    }),

  semesters: () =>
    apiListRequest<Semester>("/semesters", {
      limit: 100,
      sortBy: "year",
      sortOrder: "desc",
    }),
};

export const offeringCatalogApi = {
  /** Offerings for one department + academic semester level (public endpoint). */
  forSemester: (params: { departmentId: string; semesterLevel: number; semesterId?: string }) =>
    apiListRequest<CourseOffering>("/course-offerings", {
      limit: 100,
      sortBy: "createdAt",
      sortOrder: "asc",
      ...params,
    }),
};

export const websiteSettingsApi = {
  get: () => apiRequest<WebsiteSettings>("/website-settings"),

  update: (body: { universityName?: string; tagline?: string }) =>
    apiRequest<WebsiteSettings>("/website-settings", { method: "PATCH", body }),

  uploadLogo: (file: File) => {
    const body = new FormData();
    body.append("logo", file);
    return apiRequest<WebsiteSettings>("/website-settings/logo", { method: "POST", body });
  },
  removeLogo: () => apiRequest<WebsiteSettings>("/website-settings/logo", { method: "DELETE" }),

  uploadBackground: (file: File) => {
    const body = new FormData();
    body.append("background", file);
    return apiRequest<WebsiteSettings>("/website-settings/background", { method: "POST", body });
  },
  removeBackground: () =>
    apiRequest<WebsiteSettings>("/website-settings/background", { method: "DELETE" }),
};

export const offeringApi = {
  get: (id: string) => apiRequest<CourseOffering>(`/course-offerings/${id}`),
};

export const materialApi = {
  list: (offeringId: string) =>
    apiRequest<CourseMaterial[]>(`/course-offerings/${offeringId}/materials`),

  upload: (offeringId: string, file: File, title?: string) => {
    const body = new FormData();
    if (title) body.append("title", title);
    body.append("file", file);
    return apiRequest<CourseMaterial>(`/course-offerings/${offeringId}/materials`, {
      method: "POST",
      body,
    });
  },

  /** A short-lived signed link, issued only after the server checks course membership. */
  link: (offeringId: string, materialId: string) =>
    apiRequest<{ url: string; fileName: string; expiresAt: string }>(
      `/course-offerings/${offeringId}/materials/${materialId}/url`,
    ),

  remove: (offeringId: string, materialId: string) =>
    apiRequest<null>(`/course-offerings/${offeringId}/materials/${materialId}`, {
      method: "DELETE",
    }),
};

export const attendanceApi = {
  roster: (offeringId: string, date?: string) =>
    apiRequest<AttendanceRoster>(`/course-offerings/${offeringId}/attendance`, {
      query: { date },
    }),

  mark: (
    offeringId: string,
    body: { date: string; records: { studentId: string; status: AttendanceStatus }[] },
  ) =>
    apiRequest<AttendanceRoster>(`/course-offerings/${offeringId}/attendance`, {
      method: "POST",
      body,
    }),

  summary: (offeringId: string) =>
    apiRequest<AttendanceSummary>(`/course-offerings/${offeringId}/attendance/summary`),

  mine: (offeringId: string) =>
    apiRequest<MyAttendance>(`/course-offerings/${offeringId}/attendance/me`),
};

export type QuizCreateBody = {
  title: string;
  description?: string;
  durationMinutes: number;
  materialId?: string;
  showAnswersAfterEnd?: boolean;
  questions?: QuizQuestionDraft[];
};

type QuizAnswerBody = { questionId: string; selected: QuizChoice }[];

export const quizApi = {
  list: (offeringId: string) =>
    apiRequest<QuizList>(`/course-offerings/${offeringId}/quizzes`),
  create: (offeringId: string, body: QuizCreateBody) =>
    apiRequest<QuizDetail>(`/course-offerings/${offeringId}/quizzes`, { method: "POST", body }),

  get: (quizId: string) => apiRequest<QuizDetail>(`/quizzes/${quizId}`),
  update: (
    quizId: string,
    body: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      materialId?: string | null;
      showAnswersAfterEnd?: boolean;
    },
  ) => apiRequest<QuizDetail>(`/quizzes/${quizId}`, { method: "PATCH", body }),
  remove: (quizId: string) => apiRequest<null>(`/quizzes/${quizId}`, { method: "DELETE" }),
  saveQuestions: (quizId: string, questions: QuizQuestionDraft[]) =>
    apiRequest<QuizDetail>(`/quizzes/${quizId}/questions`, {
      method: "PUT",
      body: { questions },
    }),

  publish: (quizId: string) =>
    apiRequest<QuizDetail>(`/quizzes/${quizId}/publish`, { method: "POST" }),
  unpublish: (quizId: string) =>
    apiRequest<QuizDetail>(`/quizzes/${quizId}/unpublish`, { method: "POST" }),
  start: (quizId: string) =>
    apiRequest<QuizDetail>(`/quizzes/${quizId}/start`, { method: "POST" }),
  results: (quizId: string, query: { search?: string; sortBy?: string; order?: string }) =>
    apiRequest<QuizResults>(`/quizzes/${quizId}/results`, { query }),

  // Student side.
  begin: (quizId: string) =>
    apiRequest<QuizAttemptStart>(`/quizzes/${quizId}/attempt`, { method: "POST" }),
  saveAnswers: (quizId: string, answers: QuizAnswerBody) =>
    apiRequest<{ saved: number }>(`/quizzes/${quizId}/attempt/answers`, {
      method: "PUT",
      body: { answers },
    }),
  submit: (quizId: string, answers: QuizAnswerBody) =>
    apiRequest<MyQuizResult>(`/quizzes/${quizId}/submit`, { method: "POST", body: { answers } }),
  myResult: (quizId: string) => apiRequest<MyQuizResult>(`/quizzes/${quizId}/my-result`),
};

export const aiApi = {
  generateQuiz: (body: {
    offeringId: string;
    materialId: string;
    numberOfQuestions: number;
    difficulty: "easy" | "medium" | "hard";
  }) =>
    // Generating from a long PDF can take a minute or two, far longer than a normal call.
    apiRequest<GeneratedQuiz>("/ai/quiz/generate", { method: "POST", body, timeout: AI_REQUEST_TIMEOUT_MS }),
};

type RegistrationSelection = { semesterId: string; offeringIds: string[] };

export const registrationApi = {
  available: (semesterId?: string) =>
    apiRequest<AvailableCourses>("/registrations/available", { query: { semesterId } }),

  /** Validates and prices a selection on the server without saving anything. */
  preview: (body: RegistrationSelection) =>
    apiRequest<RegistrationPreview>("/registrations/preview", { method: "POST", body }),

  /** Only WHICH courses are sent. Credits, fees and eligibility are decided by the server. */
  submit: (body: RegistrationSelection) =>
    apiRequest<Registration>("/registrations", { method: "POST", body }),

  get: (id: string) => apiRequest<Registration>(`/registrations/${id}`),

  pay: (id: string) =>
    apiRequest<{ bkashURL: string; reused: boolean }>(`/registrations/${id}/pay`, { method: "POST" }),

  /** Asks the gateway about a payment whose return never reached us. */
  refreshPayment: (id: string) =>
    apiRequest<Registration>(`/registrations/${id}/refresh-payment`, { method: "POST" }),

  cancel: (id: string, body: { reason?: string; reject?: boolean } = {}) =>
    apiRequest<Registration>(`/registrations/${id}/cancel`, { method: "POST", body }),

  receipt: (id: string) => apiRequest<RegistrationReceipt>(`/registrations/${id}/receipt`),
  receiptPdfUrl: (id: string) => `/api/v1/registrations/${id}/receipt.pdf`,
};

export const registrationAdminApi = {
  settings: () => apiRequest<RegistrationSettingRow[]>("/registration-settings"),
  saveSetting: (semesterId: string, body: RegistrationSettingValues) =>
    apiRequest<RegistrationSettingRow>(`/registration-settings/${semesterId}`, { method: "PUT", body }),
  stats: (query: Record<string, string | undefined>) =>
    apiRequest<RegistrationStats>("/registrations/stats", { query }),
};
