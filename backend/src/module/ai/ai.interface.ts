export interface IGenerateQuizPayload {
	offeringId: string;
	materialId: string;
	numberOfQuestions: number;
	difficulty: "easy" | "medium" | "hard";
}
