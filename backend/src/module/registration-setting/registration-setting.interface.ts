// All money fields are integer paisa (100 paisa = 1 BDT).
export interface IRegistrationSettingPayload {
	theoryRate: number;
	practicalRate: number;
	otherRate: number;
	registrationFee: number;
	minCredits: number;
	maxCredits: number;
	registrationStart: Date | null;
	registrationEnd: Date | null;
	lateEnabled: boolean;
	lateStart: Date | null;
	lateEnd: Date | null;
	lateFee: number;
	invoiceValidityHours: number;
}
