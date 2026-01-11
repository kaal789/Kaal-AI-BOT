
import React from 'react';
import { ChatSession } from '../types';
import { PlusIcon, TrashIcon, BotIcon, CheckIcon, GlobeIcon } from './Icons';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentSessionId, 
  onNewChat, 
  onSelectChat, 
  onDeleteChat 
}) => {
  return (
    <div className="flex flex-col h-full bg-zinc-950/80 backdrop-blur-3xl border-r border-white/5 w-80">
      <div className="p-8">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl shadow-2xl shadow-blue-900/40 transition-all font-black uppercase tracking-widest text-[11px] active:scale-95 group"
        >
          <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
          Neural Link
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 scrollbar-hide">
        <h4 className="px-4 mb-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Temporal Logs</h4>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-700 opacity-50">
            <BotIcon className="w-10 h-10 mb-4 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest">Interface Ready</p>
          </div>
        ) : (
          sessions.sort((a, b) => b.updatedAt - a.updatedAt).map((session) => (
            <div 
              key={session.id}
              className={`group flex items-center gap-3 px-5 py-4 rounded-3xl cursor-pointer transition-all border ${
                currentSessionId === session.id 
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/20 shadow-inner' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-white border-transparent'
              }`}
              onClick={() => onSelectChat(session.id)}
            >
              <div className="flex-1 truncate text-[13px] font-bold tracking-tight">
                {session.title}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteChat(session.id); }}
                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-500 rounded-xl transition-all"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-8 space-y-4">
        <div className="p-5 rounded-[2rem] bg-zinc-900/50 border border-white/5 shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-sm text-white shadow-xl">
              GU
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-white uppercase tracking-widest">Ultra Node</span>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]" />
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Neural Link v3.2</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-black/40 rounded-xl border border-white/5">
             <div className="flex items-center gap-2">
                <GlobeIcon className="w-3 h-3 text-blue-500" />
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Cloud Sync</span>
             </div>
             <CheckIcon className="w-3 h-3 text-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
