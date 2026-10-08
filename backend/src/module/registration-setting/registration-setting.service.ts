import type { RegistrationSetting } from "@prisma/client";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { getWindowState } from "../registration/registration.window";
import type { IRegistrationSettingPayload } from "./registration-setting.interface";

const SEMESTER_SELECT = {
	id: true,
	code: true,
	year: true,
	status: true,
	startDate: true,
	endDate: true,
} as const;

export const DEFAULT_SETTING = {
	theoryRate: 0,
	practicalRate: 0,
	otherRate: 0,
	registrationFee: 0,
	minCredits: 0,
	maxCredits: 24,
	registrationStart: null,
	registrationEnd: null,
	lateEnabled: false,
	lateStart: null,
	lateEnd: null,
	lateFee: 0,
	invoiceValidityHours: 72,
} satisfies IRegistrationSettingPayload;

const present = (setting: RegistrationSetting | null) => ({
	setting: setting ?? { ...DEFAULT_SETTING, id: null },
	configured: setting !== null,
	windowState: getWindowState(setting),
});

// Every non-deleted semester with its registration settings (or defaults).
const listSettings = async () => {
	const semesters = await prisma.semester.findMany({
		where: { deletedAt: null },
		select: { ...SEMESTER_SELECT, registrationSetting: true },
		orderBy: [{ year: "desc" }, { startDate: "desc" }],
		take: 100,
	});
	return semesters.map(({ registrationSetting, ...semester }) => ({
		semester,
		...present(registrationSetting),
	}));
};

const getSetting = async (semesterId: string) => {
	const semester = await prisma.semester.findFirst({
		where: { id: semesterId, deletedAt: null },
		select: { ...SEMESTER_SELECT, registrationSetting: true },
	});
	if (!semester)
		throw new AppError(httpStatus.NOT_FOUND, "Semester not found.");
	const { registrationSetting, ...rest } = semester;
	return { semester: rest, ...present(registrationSetting) };
};

const upsertSetting = async (
	semesterId: string,
	payload: IRegistrationSettingPayload,
	actor: IActor,
) => {
	const before = await getSetting(semesterId);

	const saved = await prisma.registrationSetting.upsert({
		where: { semesterId },
		create: { semesterId, ...payload },
		update: payload,
	});

	// Existing invoices keep the rates they were created with; only future
	// registrations use the new values.
	await recordAuditLog({
		action: "REGISTRATION_SETTING_UPDATED",
		entityType: "RegistrationSetting",
		entityId: saved.id,
		description: `${before.semester.code} ${before.semester.year}`,
		metadata: {
			before: before.configured ? before.setting : null,
			after: payload,
		},
		actor,
	});

	return { semester: before.semester, ...present(saved) };
};

export const RegistrationSettingService = {
	listSettings,
	getSetting,
	upsertSetting,
};
