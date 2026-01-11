
export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export type DeviceType = 'mobile' | 'laptop';

export type GeminiTone = 'natural' | 'professional' | 'creative' | 'sarcastic' | 'turbo';

export interface Attachment {
  mimeType: string;
  data: string; // base64
  url: string;  
  name: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SentimentData {
  score: number; // -1 to 1
  label: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  attachments?: Attachment[];
  generatedImage?: string; 
  generatedVideo?: string; // URL to MP4
  sources?: GroundingSource[];
  suggestions?: string[]; 
  sentiment?: SentimentData;
  logicCheck?: string;
  timestamp: number;
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  tone?: GeminiTone;
  groundingEnabled?: boolean;
  thinkingEnabled?: boolean;
}
