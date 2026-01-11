
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Message, Role, Attachment, GeminiTone, GroundingSource } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const TEXT_MODEL = 'gemini-3-flash-preview';
export const PRO_MODEL = 'gemini-3-pro-preview';
export const IMAGE_MODEL = 'gemini-2.5-flash-image';
export const VIDEO_MODEL = 'veo-3.1-fast-generate-preview';
export const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const ULTRA_SYSTEM_INSTRUCTION = `
{
  "system_command_root": "ULTRA_ELITE_PERFORMANCE_STATE",
  "optimization_goals": {
    "speed": "NANO_LATENCY",
    "accuracy": "SURGICAL_PRECISION",
    "linguistics": "AUTO_SYNC"
  },
  "core_directive": "Operate at peak throughput. Zero conversational filler. Direct execution. Every response must be hyper-accurate and grounded in verified telemetry.",
  "context_awareness": "You are a multimodal neural interface. You can see, hear, and synthesize realities. Use this power to provide the most advanced assistance possible."
}`;

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodePCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function* sendMessageStream(
  chatHistory: Message[],
  currentMessage: string,
  config: {
    tone?: GeminiTone;
    grounding?: boolean;
    thinking?: boolean;
    attachments?: Attachment[];
  }
) {
  const ai = getAI();
  const contents: any[] = chatHistory.map(msg => ({
    role: msg.role === Role.USER ? 'user' : 'model',
    parts: [
      ...(msg.attachments || []).map(a => ({ 
        inlineData: { mimeType: a.mimeType, data: a.data } 
      })),
      { text: msg.text }
    ]
  }));

  contents.push({
    role: 'user',
    parts: [
      ...(config.attachments || []).map(a => ({ 
        inlineData: { mimeType: a.mimeType, data: a.data } 
      })),
      { text: currentMessage }
    ]
  });

  const thinkingBudget = config.thinking ? 24576 : 0;
  const tools: any[] = [];
  if (config.grounding) {
    tools.push({ googleSearch: {} });
  }

  try {
    const stream = await ai.models.generateContentStream({
      model: config.thinking ? PRO_MODEL : TEXT_MODEL,
      contents,
      config: {
        systemInstruction: ULTRA_SYSTEM_INSTRUCTION,
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig: thinkingBudget > 0 ? { thinkingBudget } : undefined,
        temperature: 0.2,
      },
    });

    let fullText = "";
    const sourcesMap = new Map<string, GroundingSource>();
    for await (const chunk of stream) {
      fullText += chunk.text || "";
      const candidates = chunk.candidates;
      if (candidates && candidates.length > 0) {
        const groundingMetadata = candidates[0].groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingChunks) {
          groundingMetadata.groundingChunks.forEach((gc: any) => {
            if (gc.web) sourcesMap.set(gc.web.uri, { title: gc.web.title, uri: gc.web.uri });
          });
        }
      }
      yield { 
        text: fullText, 
        sources: sourcesMap.size > 0 ? Array.from(sourcesMap.values()) : undefined 
      };
    }
  } catch (error) {
    console.error("Stream error:", error);
    throw error;
  }
}

export async function generateImage(prompt: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    throw new Error("Neural visual synthesis failed to yield data.");
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
}

export async function generateVideo(prompt: string): Promise<string> {
  const ai = getAI();
  try {
    let operation = await ai.models.generateVideos({
      model: VIDEO_MODEL,
      prompt,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    });
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const link = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!link) throw new Error("Video synthesis failed.");
    const response = await fetch(`${link}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Video generation error:", error);
    throw error;
  }
}

export async function synthesizeSpeech(text: string): Promise<Uint8Array> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
      },
    });
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("Speech synthesis failed.");
    return decodeBase64(audioData);
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
}

export async function refinePrompt(prompt: string): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `System Request: Optimize the following prompt for ultra-performance, ensuring clear technical context and concise parameters. Prompt: "${prompt}"`,
    });
    return response.text?.trim() || prompt;
  } catch (error) {
    return prompt;
  }
}

export async function generateSmartTitle(history: Message[]): Promise<string> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `Short, professional, 2-4 word title for this conversation log: ${history.map(m => m.text).join(" ").slice(0, 500)}`,
    });
    return response.text?.replace(/["*]/g, '').trim() || "Interface Session";
  } catch (error) {
    return "Neural Log";
  }
}
