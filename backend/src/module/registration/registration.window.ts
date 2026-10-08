export type TWindowSetting = {
	registrationStart: Date | null;
	registrationEnd: Date | null;
	lateEnabled: boolean;
	lateStart: Date | null;
	lateEnd: Date | null;
};

export type TWindowState =
	| "NOT_CONFIGURED"
	| "NOT_OPEN"
	| "OPEN"
	| "LATE"
	| "CLOSED";

/** Where "now" falls in the semester's registration timeline. */
export const getWindowState = (
	setting: TWindowSetting | null,
	now: Date = new Date(),
): TWindowState => {
	if (!setting?.registrationStart || !setting.registrationEnd) {
		return "NOT_CONFIGURED";
	}
	const t = now.getTime();
	if (t < setting.registrationStart.getTime()) return "NOT_OPEN";
	if (t <= setting.registrationEnd.getTime()) return "OPEN";
	if (
		setting.lateEnabled &&
		setting.lateStart &&
		setting.lateEnd &&
		t >= setting.lateStart.getTime() &&
		t <= setting.lateEnd.getTime()
	) {
		return "LATE";
	}
	return "CLOSED";
};

/** The reason shown to a student when registration is not possible right now. */
export const windowMessage = (
	state: TWindowState,
	setting: TWindowSetting | null,
): string | null => {
	switch (state) {
		case "OPEN":
		case "LATE":
			return null;
		case "NOT_CONFIGURED":
			return "Registration is not open for this semester.";
		case "NOT_OPEN":
			return "Registration has not opened yet.";
		case "CLOSED":
			return setting?.lateEnabled &&
				setting.lateStart &&
				new Date() < setting.lateStart
				? "Regular registration is over. Late registration has not started yet."
				: "The registration deadline has passed.";
	}
};
