"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { 
  Zap, Power, BarChart3, MessageSquare, Download, 
  ArrowUpRight, BrainCircuit, History, Maximize2,
  TrendingUp, Activity, Smartphone, Hash
} from 'lucide-react';
import { 
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, Cell, Line
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export default function TradingDashboard() {
  const [status, setStatus] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [msgCount, setMsgCount] = useState(0);

  // 1. REAL DATA FETCHING: Message Count & Logs
  useEffect(() => {
    onSnapshot(doc(db, "system", "status"), (d) => setStatus(d.data()));
    
    // Total Messages Count (Real from Firestore)
    const getCounts = async () => {
      const coll = collection(db, "automation_logs");
      const snapshot = await getCountFromServer(coll);
      setMsgCount(snapshot.data().count);
    };
    getCounts();

    const q = query(collection(db, "automation_logs"), orderBy("time", "desc"), limit(10));
    const unsubLogs = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubLogs();
  }, []);

  // 2. TRADING CANDLE DATA (Lalu-Hariyali Logic)
  // val: Current, open: Start, high: Peak, low: Bottom
  const tradingData = [
    { time: '14:00', open: 400, close: 600, high: 700, low: 350 },
    { time: '14:10', open: 600, close: 500, high: 650, low: 450 }, // Lalu (Down)
    { time: '14:20', open: 500, close: 900, high: 950, low: 480 }, // Hariyali (Up)
    { time: '14:30', open: 900, close: 850, high: 920, low: 800 },
    { time: '14:40', open: 850, close: 1200, high: 1300, low: 820 },
    { time: '14:50', open: 1200, close: 1100, high: 1250, low: 1050 },
    { time: '15:00', open: 1100, close: 1500, high: 1600, low: 1000 },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 p-2 font-sans selection:bg-blue-500/30">
      
      {/* --- TOP HUD (TRADING TERMINAL STYLE) --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'INSTAGRAM_TRAFFIC', val: msgCount, icon: <Activity size={14}/>, color: 'text-green-500' },
          { label: 'AI_BOT_STATUS', val: status?.aiActive ? 'RUNNING' : 'PAUSED', icon: <BrainCircuit size={14}/>, color: status?.aiActive ? 'text-blue-500' : 'text-zinc-500' },
          { label: 'SYSTEM_UPTIME', val: '99.9%', icon: <Zap size={14}/>, color: 'text-orange-500' },
          { label: 'CLOUD_STORAGE', val: 'ACTIVE', icon: <Cloud size={14}/>, color: 'text-purple-500' },
        ].map((item, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition-all">
            <div className="flex items-center gap-2 mb-1">
              <span className={item.color}>{item.icon}</span>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">{item.label}</span>
            </div>
            <h2 className={`text-xl font-black italic tracking-tighter ${item.color}`}>{item.val}</h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* --- MAIN TRADING CHART AREA --- */}
        <div className="lg:col-span-9 bg-black border border-zinc-800 rounded-[30px] p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
               <div className="bg-blue-600 w-2 h-8 rounded-full animate-pulse" />
               <div>
                  <h3 className="text-white font-black text-lg italic tracking-tighter uppercase leading-none">Market Terminal</h3>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">BaseKey Meta Streaming v2.0</span>
               </div>
            </div>
            <div className="flex gap-2">
               <span className="text-[10px] bg-zinc-900 px-3 py-1 rounded-full text-zinc-400 font-bold border border-zinc-800">CANDLESTICK_ENABLED</span>
               <span className="text-[10px] bg-green-500/10 px-3 py-1 rounded-full text-green-500 font-bold border border-green-500/20">LIVE_DATA</span>
            </div>
          </div>

          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tradingData}>
                <defs>
                  <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 5" vertical={false} stroke="#18181b" />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={['dataMin - 100', 'dataMax + 100']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #333', borderRadius: '12px' }}
                  cursor={{ stroke: '#555', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="close" stroke="#3b82f6" fill="url(#glow)" strokeWidth={2} />
                
                {/* --- TRADING CANDLE LOGIC --- */}
                <Bar dataKey="close" barSize={12} radius={2}>
                  {tradingData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.close > entry.open ? '#22c55e' : '#ef4444'} // Green if Up, Red if Down
                      className="drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]"
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex justify-between border-t border-zinc-800 pt-4">
             <div className="flex gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Smartphone size={10} /> Mobile Traffic: 84%</span>
                <span className="flex items-center gap-1"><Hash size={10} /> Sessions: 1.2k</span>
             </div>
             <div className="text-[10px] font-black text-blue-500 animate-pulse">● CONNECTION_ESTABLISHED</div>
          </div>
        </div>

        {/* --- LIVE ORDER BOOK (LOGS) --- */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[30px] h-full flex flex-col shadow-2xl">
            <h3 className="text-white font-black italic text-xs uppercase mb-4 flex items-center gap-2">
               <History size={14} className="text-blue-500" /> Transaction Logs
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[450px] pr-2 scrollbar-hide">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-black border border-zinc-800 rounded-xl flex flex-col gap-1 group hover:border-blue-500/50 transition-all">
                  <div className="flex justify-between items-center">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${log.type === 'ai_reply' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {log.type === 'ai_reply' ? 'EXECUTED' : 'INCOMING'}
                    </span>
                    <span className="text-[8px] text-zinc-600 font-mono">{log.time?.toDate().toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-medium truncate">{log.text || "MEDIA_FILE"}</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-3 bg-blue-600 text-white font-black text-[10px] rounded-xl uppercase hover:bg-blue-500 transition-all active:scale-95">
               Download PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
        }
