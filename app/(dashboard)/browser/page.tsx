"use client";
import React, { useState } from 'react';
import { Zap, ShieldCheck, CloudUpload, ArrowLeft } from 'lucide-react';

export default function InstaBrowser() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[9999]">
      {/* Premium Glass Header */}
      <div className="h-14 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap size={18} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-xs font-black text-white tracking-widest uppercase">BaseKey Ghost_View</h2>
            <p className="text-[8px] text-green-500 font-bold">AUTOMATION_ACTIVE</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded-full">
            <CloudUpload size={10} className="text-zinc-400" />
            <span className="text-[8px] text-zinc-400 font-bold uppercase">Cloudinary_Sync</span>
          </div>
        </div>
      </div>

      {/* The Browser Engine */}
      <div className="flex-1 relative bg-white">
        {loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[10px] text-zinc-500 font-bold animate-pulse">INITIATING_SECURE_SESSION...</p>
          </div>
        )}
        
        {/* Instagram Interface */}
        <iframe 
          src="https://www.instagram.com/" 
          className="w-full h-full border-none"
          onLoad={() => setLoading(false)}
          title="InstaView"
        />
      </div>

      {/* Control Bar */}
      <div className="h-12 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-6">
        <button className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="h-1 w-20 bg-zinc-800 rounded-full" />
        <ShieldCheck size={20} className="text-blue-500" />
      </div>
    </div>
  );
}

