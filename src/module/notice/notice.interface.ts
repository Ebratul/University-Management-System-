import type { NoticeAudience } from "@prisma/client";

export interface ICreateNoticePayload {
	title: string;
	content: string;
	audience?: NoticeAudience;
}

export interface IUpdateNoticePayload {
	title?: string;
	content?: string;
	audience?: NoticeAudience;
}
