
import React, { useEffect, useState } from 'react';
import { BotIcon, UserIcon, CameraIcon } from './Icons';
import { feedback } from '../services/feedbackService';
import { DeviceType } from '../types';

interface SplashScreenProps {
  onFinish: (device: DeviceType) => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'drawing' | 'syncing' | 'selecting' | 'completed'>('drawing');

  useEffect(() => {
    feedback.playSound('startup');
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 15);

    const timer1 = setTimeout(() => setPhase('syncing'), 800);
    const timer2 = setTimeout(() => {
      setPhase('selecting');
    }, 2200);

    return () => {
      clearInterval(interval);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleSelect = (device: DeviceType) => {
    feedback.vibrate(20);
    feedback.playSound('click');
    setPhase('completed');
    setTimeout(() => onFinish(device), 600);
  };

  return (
    <div className={`fixed inset-0 z-[200] bg-[#0b0d0e] flex flex-col items-center justify-center transition-all duration-700 ${phase === 'completed' ? 'opacity-0 scale-110' : 'opacity-100'}`}>
      
      {phase !== 'selecting' ? (
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-blue-500/20 blur-[100px] animate-pulse rounded-full" />
            <div className={`absolute -inset-4 border-2 border-blue-500/20 rounded-full animate-[spin_4s_linear_infinite] ${phase === 'syncing' ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
            
            <div className="relative w-32 h-32 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.3)]">
              <BotIcon className={`w-16 h-16 text-white transition-all duration-1000 ${phase === 'syncing' ? 'scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : ''}`} />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase flex items-center justify-center gap-2">
              Gemini <span className="text-blue-500">Ultra</span>
            </h1>
            <div className="flex flex-col items-center gap-4">
              <p className="text-gray-500 text-xs font-bold tracking-[0.3em] uppercase animate-pulse">
                {phase === 'drawing' ? 'Initializing Core' : 'Neural Sync Active'}
              </p>
              <div className="w-48 h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center max-w-4xl w-full px-10 animate-in slide-in-from-bottom-12 duration-1000">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter uppercase text-center">
            Select <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Interface Profile</span>
          </h2>
          <p className="text-gray-500 text-xs font-black tracking-[0.4em] uppercase mb-16 opacity-60">Optimize neural link for current hardware</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <button 
              onClick={() => handleSelect('mobile')}
              className="group relative p-10 bg-white/[0.02] border border-white/5 hover:border-blue-500/40 rounded-[3rem] transition-all duration-500 hover:bg-blue-500/[0.04] text-left overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <BotIcon className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
                  <UserIcon className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Mobile Neural Node</h3>
                <p className="text-gray-500 text-sm font-medium leading-relaxed">Optimized for touch interfaces, portrait vision, and high-portability voice sync.</p>
              </div>
            </button>

            <button 
              onClick={() => handleSelect('laptop')}
              className="group relative p-10 bg-white/[0.02] border border-white/5 hover:border-indigo-500/40 rounded-[3rem] transition-all duration-500 hover:bg-indigo-500/[0.04] text-left overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <CameraIcon className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                  <CameraIcon className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Desktop Command</h3>
                <p className="text-gray-500 text-sm font-medium leading-relaxed">Enhanced landscape viewport, full-bandwidth grounding, and command-center layout.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-blue-500 rounded-full blur-xl animate-pulse"
            style={{
              width: Math.random() * 300 + 'px',
              height: Math.random() * 300 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animationDelay: Math.random() * 5 + 's',
              animationDuration: Math.random() * 10 + 10 + 's'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SplashScreen;
