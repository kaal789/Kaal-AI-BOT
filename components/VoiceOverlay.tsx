
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { 
  XIcon, MicIcon, BotIcon, EyeIcon, GlobeIcon
} from './Icons';
import { DeviceType } from '../types';
import { feedback } from '../services/feedbackService';
import { decodeBase64, decodePCM, encodeBase64, ULTRA_SYSTEM_INSTRUCTION } from '../services/geminiService';

interface VoiceOverlayProps {
  onClose: () => void;
  onConfirmText?: (text: string) => void;
  apiKey: string;
  initialMode: 'voice' | 'vision';
  deviceType: DeviceType;
}

const VoiceOverlay: React.FC<VoiceOverlayProps> = ({ onClose, apiKey, initialMode, deviceType }) => {
  const [status, setStatus] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [mode, setMode] = useState<'voice' | 'vision'>(initialMode);
  const [isConnected, setIsConnected] = useState(false);
  const [inputLevel, setInputLevel] = useState(0); 
  const [inputTranscript, setInputTranscript] = useState('');
  const [outputTranscript, setOutputTranscript] = useState('');
  const [detectedLang, setDetectedLang] = useState('AUTO');
  
  const audioContextsRef = useRef<{ input?: AudioContext, output?: AudioContext }>({});
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const activeSessionIdRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const parseLang = (text: string) => {
    const match = text.match(/^\[([A-Z]{2})\]/);
    if (match) {
      setDetectedLang(match[1]);
      return text.replace(/^\[[A-Z]{2}\]\s*/, '');
    }
    return text;
  };

  const cleanup = useCallback(async () => {
    activeSessionIdRef.current = null;
    if (frameIntervalRef.current) window.clearInterval(frameIntervalRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    for (const s of sourcesRef.current) { try { s.stop(); } catch(e) {} }
    sourcesRef.current.clear();
    if (audioContextsRef.current.input) await audioContextsRef.current.input.close();
    if (audioContextsRef.current.output) await audioContextsRef.current.output.close();
    audioContextsRef.current = {};
    setIsConnected(false);
  }, []);

  const connect = useCallback(async () => {
    await cleanup();
    const sessionId = crypto.randomUUID();
    activeSessionIdRef.current = sessionId;
    
    try {
      setStatus('connecting');
      const ai = new GoogleGenAI({ apiKey });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();
      
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      const gainNode = outputCtx.createGain();
      gainNode.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true }, 
        video: mode === 'vision' ? { 
          facingMode: 'user', 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 }
        } : false 
      });
      
      if (activeSessionIdRef.current !== sessionId) return stream.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = stream;

      if (mode === 'vision' && videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: ULTRA_SYSTEM_INSTRUCTION
        },
        callbacks: {
          onopen: () => {
            if (activeSessionIdRef.current !== sessionId) return;
            setIsConnected(true);
            setStatus('listening');
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(1024, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (activeSessionIdRef.current !== sessionId) return;
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
              setInputLevel(Math.sqrt(sum/inputData.length));

              const pcmBlob = {
                data: encodeBase64(new Uint8Array(new Int16Array(inputData.map(v => v * 32767)).buffer)),
                mimeType: 'audio/pcm;rate=16000'
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            if (mode === 'vision') {
              frameIntervalRef.current = window.setInterval(() => {
                if (activeSessionIdRef.current !== sessionId || !videoRef.current || !canvasRef.current) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && videoRef.current.readyState >= 2) {
                  canvas.width = 320; 
                  canvas.height = 240;
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob(async (blob) => {
                    if (blob) {
                      const data = await new Promise<string>(r => {
                        const reader = new FileReader();
                        reader.onloadend = () => r((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(blob);
                      });
                      sessionPromise.then(s => s.sendRealtimeInput({ media: { data, mimeType: 'image/jpeg' } }));
                    }
                  }, 'image/jpeg', 0.5);
                }
              }, 500); 
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (activeSessionIdRef.current !== sessionId) return;
            
            if (msg.serverContent?.inputTranscription) {
              const cleaned = parseLang(msg.serverContent.inputTranscription.text);
              setInputTranscript(t => t + cleaned);
            }
            if (msg.serverContent?.outputTranscription) {
              const cleaned = parseLang(msg.serverContent.outputTranscription.text);
              setOutputTranscript(t => t + cleaned);
            }
            if (msg.serverContent?.turnComplete) { setInputTranscript(''); setOutputTranscript(''); }

            const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64) {
              setStatus('speaking');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodePCM(decodeBase64(audioBase64), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(gainNodeRef.current!);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setStatus('listening');
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.interrupted) {
              for (const s of sourcesRef.current) try { s.stop(); } catch(e) {}
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setStatus('listening');
            }
          },
          onerror: () => setStatus('error'),
          onclose: () => setIsConnected(false)
        }
      });
    } catch (err) { setStatus('error'); }
  }, [apiKey, mode, cleanup]);

  useEffect(() => {
    connect();
    return () => { cleanup(); };
  }, [connect, cleanup]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden font-sans animate-in fade-in duration-700">
      
      {mode === 'vision' && (
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover scale-x-[-1] opacity-70 transition-opacity duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-80"></div>
          {/* Subtle scan line without flash */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)] animate-[scan_8s_linear_infinite]" />
          <div className="absolute inset-0 pointer-events-none border-[2vw] md:border-[40px] border-black/20 backdrop-brightness-110"></div>
          
          <style>{`
            @keyframes scan { 0% { transform: translateY(-5vh); } 100% { transform: translateY(105vh); } }
            @keyframes neural-pulse {
              0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 10px rgba(59,130,246,0.2)); }
              50% { transform: scale(1.1); filter: brightness(1.3) drop-shadow(0 0 25px rgba(59,130,246,0.5)); }
            }
            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <header className="absolute top-0 left-0 right-0 p-8 z-[110] flex items-center justify-between pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full backdrop-blur-2xl">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <h3 className="text-blue-400 font-black uppercase tracking-[0.2em] text-[11px]">Neural Stream v3</h3>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 border border-white/5 rounded-full backdrop-blur-2xl shadow-2xl">
                <GlobeIcon className="w-4 h-4 text-zinc-400" />
                <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">{detectedLang} SYNC</span>
             </div>
          </div>
        </div>

        <div className="flex gap-4 pointer-events-auto">
          <button 
            onClick={() => {
              feedback.vibrate(10);
              setMode(m => m === 'voice' ? 'vision' : 'voice');
            }} 
            className="group p-5 bg-zinc-950/80 backdrop-blur-3xl rounded-[2rem] border border-white/10 text-white hover:bg-white/10 transition-all shadow-2xl active:scale-90"
          >
            {mode === 'voice' ? <EyeIcon className="w-7 h-7 group-hover:scale-110 transition-transform" /> : <MicIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />}
          </button>
          <button 
            onClick={onClose} 
            className="p-5 bg-red-600/10 backdrop-blur-3xl text-red-500 rounded-[2rem] border border-red-500/20 hover:bg-red-600 hover:text-white transition-all shadow-2xl active:scale-90"
          >
            <XIcon className="w-7 h-7" />
          </button>
        </div>
      </header>

      <div className={`flex-1 flex flex-col items-center justify-center z-10 transition-all duration-1000 ${mode === 'vision' ? 'opacity-30 scale-90 translate-y-20' : 'opacity-100'}`}>
        {!mode && (
          <style>{`
            @keyframes neural-pulse {
              0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 10px rgba(59,130,246,0.2)); }
              50% { transform: scale(1.1); filter: brightness(1.3) drop-shadow(0 0 25px rgba(59,130,246,0.5)); }
            }
            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        )}
        <div className="relative w-80 h-80 flex items-center justify-center">
           {/* Rotating Neural Ring */}
           <div className={`absolute inset-0 rounded-full border-2 border-dashed border-blue-500/20 ${status === 'speaking' ? 'animate-[spin-slow_15s_linear_infinite]' : 'animate-[spin-slow_40s_linear_infinite]'}`} />
           <div className={`absolute -inset-16 bg-blue-600/10 blur-[120px] rounded-full transition-opacity duration-1000 ${status === 'speaking' ? 'opacity-100' : 'opacity-0'}`} />
           
           <div 
             className="w-64 h-64 bg-zinc-950/80 backdrop-blur-[80px] rounded-full flex items-center justify-center border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out"
             style={{ transform: `scale(${1 + inputLevel * 15})` }}
           >
             {status === 'speaking' ? (
               <BotIcon className="w-32 h-32 text-blue-400 animate-[neural-pulse_2s_ease-in-out_infinite] drop-shadow-[0_0_20px_rgba(96,165,250,0.5)]" />
             ) : (
               <MicIcon className="w-32 h-32 text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
             )}
           </div>
        </div>
      </div>

      <div className="absolute bottom-40 left-0 right-0 px-12 z-[120] text-center pointer-events-none flex flex-col items-center gap-8">
        {inputTranscript && (
          <p className="text-2xl md:text-4xl font-bold text-zinc-500/60 tracking-tight leading-tight animate-in slide-in-from-bottom-8 duration-500 max-w-2xl px-6 py-2 bg-black/20 rounded-2xl backdrop-blur-md">
            {inputTranscript}
          </p>
        )}
        {outputTranscript && (
          <p className="text-4xl md:text-6xl font-black text-white tracking-tighter drop-shadow-[0_15px_40px_rgba(0,0,0,1)] leading-tight animate-in slide-in-from-bottom-12 duration-700 max-w-5xl">
            {outputTranscript}
          </p>
        )}
      </div>

      <footer className="absolute bottom-12 left-0 right-0 flex justify-center z-[130] animate-in slide-in-from-bottom-4 duration-1000">
        <div className="px-10 py-4 bg-zinc-950/95 backdrop-blur-[40px] border border-white/5 rounded-full flex items-center gap-10 shadow-3xl ring-1 ring-white/10">
            <div className="flex items-center gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,1)]" />
              <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em]">Quantum Interface v3.2</span>
            </div>
            <div className="h-5 w-[1px] bg-white/10" />
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em]">{status}</span>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default VoiceOverlay;
