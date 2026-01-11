
import React, { useState, useRef, useEffect } from 'react';
import { SendIcon, PaperclipIcon, TrashIcon, MicIcon, SparklesIcon, SquareIcon } from './Icons';
import { Attachment } from '../types';
import { feedback } from '../services/feedbackService';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onVoiceStart: () => void;
  onRefine: (text: string) => Promise<string>;
  onStop?: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onVoiceStart, onRefine, onStop, isGenerating, disabled }) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  };

  useEffect(() => { adjustHeight(); }, [input]);

  const handleSend = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isGenerating) {
      feedback.vibrate(20);
      feedback.playSound('send');
      onSend(input, attachments);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleRefine = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!input.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const refined = await onRefine(input);
      setInput(refined);
    } catch (err) {
      console.error("Refinement failed", err);
    } finally {
      setIsRefining(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = e.target.files;
    if (!files) return;
    
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const promise = new Promise<Attachment>((resolve) => {
        reader.onload = () => {
          resolve({
            name: file.name,
            mimeType: file.type,
            data: (reader.result as string).split(',')[1],
            url: URL.createObjectURL(file),
          });
        };
      });
      reader.readAsDataURL(file);
      newAttachments.push(await promise);
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto px-4 md:px-10">
      {isGenerating && onStop && (
        <div className="flex justify-center mb-6 animate-in slide-in-from-bottom-2 duration-500">
          <button 
            onClick={onStop}
            className="flex items-center gap-3 px-6 py-2.5 bg-zinc-900 border border-white/10 rounded-2xl text-[12px] font-black uppercase tracking-widest text-gray-300 hover:text-white hover:border-white/20 transition-all shadow-2xl"
          >
            <SquareIcon className="w-4 h-4 text-red-500" />
            Stop generating
          </button>
        </div>
      )}

      <div className="relative bg-zinc-950/70 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden focus-within:border-blue-500/30 transition-all duration-500 ring-1 ring-white/5">
        
        {attachments.length > 0 && (
          <div className="flex gap-4 p-5 bg-black/20 border-b border-white/5 overflow-x-auto scrollbar-hide">
            {attachments.map((f, i) => (
              <div key={i} className="relative group flex-shrink-0 animate-in zoom-in-95 duration-300">
                {f.mimeType.startsWith('image/') ? (
                   <img src={f.url} className="w-20 h-20 object-cover rounded-2xl border border-white/10 shadow-lg" />
                ) : (
                  <div className="w-20 h-20 flex flex-col items-center justify-center bg-white/5 rounded-2xl text-[10px] text-gray-400 p-2 text-center break-all border border-white/5">
                    <span className="font-bold uppercase text-[8px] text-blue-400 mb-1">{f.mimeType.split('/')[1]}</span>
                    {f.name}
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))} 
                  className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-90"
                >
                    <TrashIcon className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 px-6 py-4">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()} 
            className="p-4 text-zinc-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all active:scale-90"
          >
            <PaperclipIcon className="w-7 h-7" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            hidden 
            multiple 
            onChange={handleFileChange} 
            accept="image/*,application/pdf,text/*" 
          />
          
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Neural prompt engine active..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-700 py-4 resize-none max-h-[300px] outline-none text-[17px] font-medium leading-relaxed"
            disabled={isGenerating}
          />

          <div className="flex items-center gap-3 mb-1.5">
            {input.trim() && !isGenerating && (
                <button 
                  type="button"
                  onClick={handleRefine}
                  className={`p-3.5 rounded-2xl transition-all ${isRefining ? 'animate-pulse text-blue-500' : 'text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10'}`}
                  title="Neural Prompt Refiner"
                >
                    <SparklesIcon className={`w-7 h-7 ${isRefining ? 'animate-spin' : ''}`} />
                </button>
            )}
            
            {!input.trim() && attachments.length === 0 ? (
              <button 
                type="button"
                onClick={onVoiceStart} 
                className="p-4 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-full transition-all active:scale-90 border border-blue-500/20 shadow-lg shadow-blue-500/10"
              >
                <MicIcon className="w-7 h-7" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleSend} 
                disabled={disabled || isGenerating} 
                className={`p-4 rounded-full transition-all shadow-xl flex items-center justify-center ${isGenerating ? 'bg-zinc-800 text-zinc-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95'}`}
              >
                <SendIcon className="w-7 h-7" />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-zinc-500/40 mt-4 font-black uppercase tracking-[0.3em]">Advanced Neural Interface v3.2 Immersive Mode</p>
    </div>
  );
};

export default ChatInput;
