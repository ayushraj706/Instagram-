"use client";
import React, { useState } from 'react';
import { Zap, ShieldCheck, CloudUpload, ArrowLeft, RefreshCw, PlayCircle } from 'lucide-react';

export default function InstaBrowser() {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // GitHub Action ko trigger karne ka function
  const triggerBulkSync = async () => {
    setIsSyncing(true);
    try {
      // Humne jo bot.js banaya hai, ye use signal bhejega
      const response = await fetch('/api/trigger-bot', {
        method: 'POST',
      });

      if (response.ok) {
        alert("🚀 Ghost Engine Started! Followers mirror hona shuru ho gaye hain.");
      } else {
        alert("❌ Trigger Fail: Check if GitHub Token is added to Vercel.");
      }
    } catch (error) {
      console.error("Error triggering bot:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[9999] font-mono">
      {/* Premium Glass Header */}
      <div className="h-14 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap size={18} className={`${isSyncing ? 'animate-pulse text-yellow-400' : 'text-blue-500'}`} />
          </div>
          <div>
            <h2 className="text-[10px] font-black text-white tracking-widest uppercase">BaseKey Ghost_Browser_V2</h2>
            <p className={`text-[7px] font-bold ${isSyncing ? 'text-yellow-500' : 'text-green-500'}`}>
              {isSyncing ? 'BULK_SYNC_RUNNING' : 'SYSTEM_READY'}
            </p>
          </div>
        </div>
        
        {/* Mirror Action Button */}
        <button 
          onClick={triggerBulkSync}
          disabled={isSyncing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
            isSyncing ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
          }`}
        >
          {isSyncing ? <RefreshCw size={12} className="animate-spin" /> : <PlayCircle size={12} />}
          <span className="text-[9px] font-black uppercase">Start_Bulk_Mirror</span>
        </button>
      </div>

      {/* The Browser Engine */}
      <div className="flex-1 relative bg-white">
        {loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] text-zinc-500 font-bold animate-pulse uppercase tracking-widest">Bypassing_Login_Wall...</p>
          </div>
        )}
        
        <iframe 
          src="https://www.instagram.com/accounts/login/" 
          className="w-full h-full border-none"
          onLoad={() => setLoading(false)}
          title="InstaView"
        />
      </div>

      {/* Control Bar */}
      <div className="h-12 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-6">
        <button onClick={() => window.history.back()} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-4">
           <div className="h-1 w-12 bg-zinc-800 rounded-full" />
           <div className="p-1 bg-green-500/20 rounded">
             <CloudUpload size={14} className="text-green-500" />
           </div>
           <div className="h-1 w-12 bg-zinc-800 rounded-full" />
        </div>
        <ShieldCheck size={20} className="text-blue-500" />
      </div>
    </div>
  );
    }

