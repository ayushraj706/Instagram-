"use client";
import React, { useState, useEffect } from 'react';
import { Zap, ShieldCheck, CloudUpload, ArrowLeft, RefreshCw, PlayCircle, User, Image as ImageIcon, Film } from 'lucide-react';
import { db } from '@/lib/firebase'; // Apna firebase config path check kar lena
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const targetUsers = ["_anshu_2101", "_cool_butterfly_.6284", "dee_pu3477", "ritu_singh785903"];

export default function InstaGallery() {
  const [selectedUser, setSelectedUser] = useState(targetUsers[0]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Firebase se Data Fetch karne ka logic
  const fetchMedia = async (username) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "archives"),
        where("owner", "==", username),
        orderBy("time", "desc")
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMedia(items);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia(selectedUser);
  }, [selectedUser]);

  // 2. Bot Trigger Logic
  const triggerBulkSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/trigger-bot', { method: 'POST' });
      if (response.ok) alert("🚀 Ghost Engine Started!");
      else alert("❌ Trigger Fail!");
    } catch (err) { alert("❌ Error: " + err); }
    finally { setIsSyncing(false); }
  };

  return (
    <div className="fixed inset-0 bg-[#09090b] flex flex-col z-[9999] font-mono text-white overflow-hidden">
      {/* Header */}
      <div className="h-16 bg-zinc-900/50 backdrop-blur-xl border-b border-zinc-800/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={20} className={isSyncing ? 'animate-pulse text-yellow-400' : 'text-blue-500'} />
          <h2 className="text-[11px] font-black tracking-widest uppercase italic">BaseKey Vault</h2>
        </div>
        <button onClick={triggerBulkSync} disabled={isSyncing} className="bg-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
          {isSyncing ? <RefreshCw className="animate-spin" size={12}/> : <PlayCircle size={12}/>}
          Sync
        </button>
      </div>

      {/* User Tabs (Horizontal Scroll) */}
      <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar bg-zinc-950/50 border-b border-zinc-900 shrink-0">
        {targetUsers.map((user) => (
          <button
            key={user}
            onClick={() => setSelectedUser(user)}
            className={`px-4 py-2 rounded-full text-[9px] font-bold transition-all whitespace-nowrap border ${
              selectedUser === user 
              ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            @{user.split('_')[1] || user}
          </button>
        ))}
      </div>

      {/* Media Gallery Grid */}
      <div className="flex-1 overflow-y-auto p-2 no-scrollbar bg-[#050505]">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <RefreshCw className="animate-spin mb-2" />
            <span className="text-[10px] uppercase">Loading_Vault...</span>
          </div>
        ) : media.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {media.map((item) => (
              <div key={item.id} className="aspect-square relative bg-zinc-900 group overflow-hidden rounded-sm">
                {item.type === 'videos' ? (
                  <video src={item.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={item.url} alt="Vault" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                )}
                {/* Type Icon */}
                <div className="absolute top-1 right-1 p-1 bg-black/50 backdrop-blur-md rounded">
                  {item.type === 'videos' ? <Film size={10}/> : <ImageIcon size={10}/>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-700">
            <User size={48} strokeWidth={1} className="mb-4" />
            <p className="text-[10px] uppercase font-bold tracking-widest text-center">
              No Data Found <br/> <span className="text-blue-600">Run Sync to fetch @{selectedUser}</span>
            </p>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="h-14 bg-zinc-950 border-t border-zinc-900 flex items-center justify-around shrink-0">
        <button onClick={() => window.history.back()}><ArrowLeft size={20} className="text-zinc-600"/></button>
        <div className="text-[10px] font-bold text-zinc-500">
          {media.length} ITEMS ARCHIVED
        </div>
        <ShieldCheck size={20} className="text-blue-900" />
      </div>
    </div>
  );
}
