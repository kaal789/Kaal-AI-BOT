
import React, { useState } from 'react';
import { Message, Role } from '../types';
import { 
  UserIcon, BotIcon, ExternalLinkIcon, SparklesIcon, 
  BrainIcon, Volume2Icon, CopyIcon, CheckIcon, RotateCwIcon, GlobeIcon,
  DownloadIcon
} from './Icons';
import MarkdownRenderer from './MarkdownRenderer';
import { synthesizeSpeech, decodePCM } from '../services/geminiService';
import { feedback } from '../services/feedbackService';

interface ChatMessageProps {
  message: Message;
  isLast?: boolean;
  onSelectSuggestion?: (text: string) => void;
  onRegenerate?: (id: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLast, onSelectSuggestion, onRegenerate }) => {
  const isUser = message.role === Role.USER;
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    feedback.vibrate(10);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = async () => {
    if (isSynthesizing || isUser) return;
    feedback.vibrate(10);
    setIsSynthesizing(true);
    try {
      const audioData = await synthesizeSpeech(message.text);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodePCM(audioData, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsSynthesizing(false);
      source.start();
    } catch (err) {
      setIsSynthesizing(false);
    }
  };

  const handleDownloadImage = () => {
    if (!message.generatedImage) return;
    feedback.vibrate(20);
    feedback.playSound('click');
    const link = document.createElement('a');
    link.href = message.generatedImage;
    link.download = `neural-synthesis-${message.id.slice(0, 8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`flex w-full mb-10 group animate-in slide-in-from-bottom-8 duration-700 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center mt-1 shadow-2xl transition-all duration-500
          ${isUser ? 'ml-6 bg-blue-600' : 'mr-6 bg-zinc-900 border border-white/5'}`}>
          {isUser ? <UserIcon className="w-5 h-5 text-white" /> : <BotIcon className="w-5 h-5 text-blue-500" />}
        </div>
        
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-8 py-6 rounded-[2rem] border transition-all duration-500 relative ${
            isUser ? 'bg-blue-600/10 border-blue-500/20 rounded-tr-none' : 'bg-zinc-950/60 border-white/5 glass-blur rounded-tl-none'
          }`}>
            <MarkdownRenderer content={message.text} />
            
            {message.generatedImage && (
              <div className="mt-6 relative group/image rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-black">
                <img src={message.generatedImage} alt="Neural Output" className="w-full h-auto object-contain" />
                <button 
                  onClick={handleDownloadImage}
                  className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white opacity-0 group-hover/image:opacity-100 transition-all hover:bg-blue-600 hover:border-blue-500 active:scale-95 shadow-2xl"
                  title="Download Image"
                >
                  <DownloadIcon className="w-5 h-5" />
                </button>
              </div>
            )}

            {message.generatedVideo && (
              <div className="mt-6 rounded-2xl overflow-hidden border border-white/5 shadow-2xl bg-black">
                <video controls className="w-full aspect-video"><source src={message.generatedVideo} type="video/mp4" /></video>
              </div>
            )}

            {message.sources && message.sources.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
                <div className="flex items-center gap-2 mb-2 text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                  <GlobeIcon className="w-3.5 h-3.5" />
                  Neural Verification Sources
                </div>
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((src, i) => (
                    <a key={i} href={src.uri} target="_blank" rel="noreferrer" 
                       className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-bold hover:bg-blue-500/20 transition-all">
                       <span className="max-w-[180px] truncate">{src.title}</span>
                       <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isUser && (
            <div className="flex items-center gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button onClick={handleSpeak} className={`p-2 rounded-xl border transition-all ${isSynthesizing ? 'bg-blue-600 text-white' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-white'}`}>
                <Volume2Icon className="w-4 h-4" />
              </button>
              <button onClick={handleCopy} className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white">
                {copied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
              </button>
              {isLast && onRegenerate && (
                <button onClick={() => onRegenerate(message.id)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white">
                  <RotateCwIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
