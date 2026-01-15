// types/qa.ts - 问答类型定义

export interface QARequest {
  question: string;
}

export interface QAResponse {
  answer: string;
  references: CommentReference[];
  hasRelevantData: boolean;
}

export interface CommentReference {
  _id: string;
  comment: string;
  score: number;
  publish_date: string;
  room_type: string;
  relevanceScore: number;
}
