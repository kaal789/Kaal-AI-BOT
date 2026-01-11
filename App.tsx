
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import VoiceOverlay from './components/VoiceOverlay';
import SplashScreen from './components/SplashScreen';
import { ChatSession, Message, Role, Attachment, GeminiTone, DeviceType } from './types';
import { 
  sendMessageStream, 
  generateSmartTitle, 
  generateImage,
  generateVideo,
  refinePrompt
} from './services/geminiService';
import { MenuIcon, BotIcon, GlobeIcon, BrainIcon, SparklesIcon, XIcon, MicIcon, CheckIcon } from './components/Icons';
import { feedback } from './services/feedbackService';

const App: React.FC = () => {
  const [isAppReady, setIsAppReady] = useState(false);
  const [deviceType, setDeviceType] = useState<DeviceType>('laptop');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeLiveMode, setActiveLiveMode] = useState<'voice' | 'vision' | null>(null);
  const [tone, setTone] = useState<GeminiTone>('turbo'); 
  const [isGrounding, setIsGrounding] = useState(true);
  const [isThinking, setIsThinking] = useState(false); 
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'verified'>('verified');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ultra_chat_sessions_v3.2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ultra_chat_sessions_v3.2', JSON.stringify(sessions));
  }, [sessions]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [sessions, isGenerating, scrollToBottom]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSend = async (text: string, attachments: Attachment[]) => {
    setCloudStatus('syncing');
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newSession: ChatSession = { id: crypto.randomUUID(), title: 'Temporal Node', messages: [], updatedAt: Date.now() };
      setSessions(prev => [newSession, ...prev]);
      activeSessionId = newSession.id;
      setCurrentSessionId(newSession.id);
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: Role.USER, text, attachments, timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() } : s));
    setIsGenerating(true);

    const aiMsgId = crypto.randomUUID();
    const aiMsg: Message = { id: aiMsgId, role: Role.MODEL, text: 'Scanning Neural Pathways...', timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg] } : s));

    try {
      const isVideo = /video/i.test(text);
      const isImage = /draw|image|picture/i.test(text) && attachments.length === 0;

      if (isVideo) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: "Initiating VEO-3.1 Synthesis Engine..." } : m) } : s));
        const videoUrl = await generateVideo(text);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: "Synthesis Complete.", generatedVideo: videoUrl } : m) } : s));
      } else if (isImage) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: "Synthesizing Neural Visual..." } : m) } : s));
        const imageUrl = await generateImage(text);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: "Visual Link Established.", generatedImage: imageUrl } : m) } : s));
      } else {
        const stream = sendMessageStream(currentSession?.messages || [], text, { tone, grounding: isGrounding, thinking: isThinking, attachments });
        for await (const chunk of stream) {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: chunk.text, sources: chunk.sources } : m) } : s));
        }
      }

      if (currentSession?.messages.length === 1) {
        generateSmartTitle(sessions.find(s => s.id === activeSessionId)?.messages || []).then(title => {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title } : s));
        });
      }
      setCloudStatus('verified');
    } catch (err: any) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, text: `Neural Exception: ${err.message}`, isError: true } : m) } : s));
      setCloudStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isAppReady) return <SplashScreen onFinish={(type) => { setDeviceType(type); setIsAppReady(true); }} />;

  return (
    <div className="flex h-screen w-screen bg-[#050607] overflow-hidden relative text-gray-100 selection:bg-blue-500/30">
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-blue-600/20 blur-[200px] rounded-full animate-aurora" />
      </div>

      {activeLiveMode && (
        <VoiceOverlay 
          apiKey={process.env.API_KEY || ''} 
          initialMode={activeLiveMode} 
          deviceType={deviceType}
          onClose={() => setActiveLiveMode(null)} 
          onConfirmText={(text) => handleSend(text, [])}
        />
      )}
      
      <aside className={`fixed inset-y-0 left-0 z-50 transition-all duration-700 ${isSidebarOpen ? 'translate-x-0 shadow-[0_0_100px_rgba(0,0,0,1)]' : '-translate-x-full'}`}>
        <Sidebar 
          sessions={sessions} 
          currentSessionId={currentSessionId} 
          onNewChat={() => {
            const id = crypto.randomUUID();
            setSessions(p => [{id, title: 'Temporal Node', messages: [], updatedAt: Date.now()}, ...p]);
            setCurrentSessionId(id);
            setIsSidebarOpen(false);
          }} 
          onSelectChat={(id) => { setCurrentSessionId(id); setIsSidebarOpen(false); }} 
          onDeleteChat={(id) => { setSessions(p => p.filter(s => s.id !== id)); if (currentSessionId === id) setCurrentSessionId(null); }}
        />
      </aside>

      <main className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
        <header className="flex items-center justify-between px-10 py-6 border-b border-white/5 bg-black/40 backdrop-blur-3xl sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 hover:bg-white/5 rounded-2xl transition-all"><MenuIcon className="w-6 h-6 text-zinc-400" /></button>
            <div className="flex flex-col">
              <h2 className="font-black text-[10px] uppercase tracking-[0.4em] text-zinc-500">{currentSession?.title || 'Neural Idle'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'}`} />
                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600">Google Workspace Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden lg:flex bg-zinc-950/80 rounded-2xl p-1 border border-white/5 shadow-2xl">
              {(['turbo', 'creative', 'professional'] as GeminiTone[]).map(t => (
                <button key={t} onClick={() => setTone(t)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tone === t ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 translate-y-[-1px]' : 'text-zinc-600 hover:text-white'}`}>{t}</button>
              ))}
            </div>
            
            <div className="h-6 w-[1px] bg-white/5 hidden sm:block" />

            <div className="flex items-center gap-3">
              <button onClick={() => setIsGrounding(!isGrounding)} className={`p-3 rounded-2xl border transition-all ${isGrounding ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-lg' : 'bg-white/5 border-white/5 text-zinc-600'}`} title="Neural Grounding"><GlobeIcon className="w-5 h-5" /></button>
              <button onClick={() => setIsThinking(!isThinking)} className={`p-3 rounded-2xl border transition-all ${isThinking ? 'bg-purple-600/20 border-purple-500/50 text-purple-400 shadow-lg' : 'bg-white/5 border-white/5 text-zinc-600'}`} title="Reasoning Protocol"><BrainIcon className="w-5 h-5" /></button>
            </div>

            <button onClick={() => setActiveLiveMode('voice')} className="px-7 py-3 bg-blue-600 text-white rounded-[1.25rem] shadow-2xl shadow-blue-900/40 flex items-center gap-4 transition-all hover:scale-105 active:scale-95 group">
              <MicIcon className="w-5 h-5 group-hover:animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest">Live Mode</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-10 pt-16 scrollbar-hide">
          <div className="max-w-4xl mx-auto w-full space-y-4 pb-48">
            {!currentSession || currentSession.messages.length === 0 ? (
              <div className="h-[65vh] flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-1000">
                <div className="w-32 h-32 bg-gradient-to-tr from-blue-700 to-blue-900 rounded-[3rem] flex items-center justify-center shadow-3xl mb-14 shadow-blue-600/20 ring-4 ring-blue-500/10">
                  <BotIcon className="w-16 h-16 text-white drop-shadow-lg" />
                </div>
                <h1 className="text-7xl font-black text-white mb-6 tracking-tighter uppercase leading-none">GEMINI <span className="text-blue-600">ULTRA</span></h1>
                <p className="text-zinc-500 max-w-sm text-[10px] font-black uppercase tracking-[0.5em] mb-16 opacity-60">Neural Infrastructure Link v3.2</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl px-6">
                   <button onClick={() => handleSend("Draw a cinematic cyberpunk metropolis at night", [])} className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-blue-500/40 text-left transition-all group hover:bg-blue-500/[0.03] shadow-2xl">
                      <div className="flex items-center gap-3 mb-5"><SparklesIcon className="w-6 h-6 text-blue-500" /><span className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em]">Synthesis Engine</span></div>
                      <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">Generate high-fidelity visual context...</span>
                   </button>
                   <button onClick={() => handleSend("Analyze current market trends in AI hardware", [])} className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-blue-500/40 text-left transition-all group hover:bg-blue-500/[0.03] shadow-2xl">
                      <div className="flex items-center gap-3 mb-5"><GlobeIcon className="w-6 h-6 text-zinc-500" /><span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">Live Grounding</span></div>
                      <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors">Access verified real-time data streams...</span>
                   </button>
                </div>
              </div>
            ) : (
              currentSession.messages.map((m, idx) => (
                <ChatMessage 
                  key={m.id} 
                  message={m} 
                  isLast={idx === currentSession.messages.length - 1} 
                  onRegenerate={() => handleSend("Re-evaluate that previous response with higher precision.", [])} 
                />
              ))
            )}
            {isGenerating && (
                <div className="flex gap-10 items-start py-12 opacity-50 animate-pulse">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-xl"><BotIcon className="w-6 h-6 text-blue-500" /></div>
                    <div className="space-y-5 mt-5 flex-1">
                      <div className="h-2.5 w-full bg-white/5 rounded-full" />
                      <div className="h-2.5 w-3/4 bg-white/5 rounded-full" />
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-[#050607] via-[#050607]/90 to-transparent z-40">
          <ChatInput 
            onSend={handleSend} 
            onVoiceStart={() => setActiveLiveMode('voice')} 
            onRefine={async (t) => await refinePrompt(t)} 
            onStop={() => setIsGenerating(false)} 
            isGenerating={isGenerating} 
            disabled={isGenerating} 
          />
        </div>
      </main>
    </div>
  );
};

export default App;
