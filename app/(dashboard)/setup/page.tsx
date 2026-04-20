"use client";
import React, { useState, useEffect } from 'react';
import { Save, ShieldCheck, Globe, Copy, CheckCircle, RefreshCw } from 'lucide-react';

export default function SetupPage() {
  const [baseUrl, setBaseUrl] = useState('');
  const [isVerified, setIsVerified] = useState(false); // Ye Firebase se aayega baad mein
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    // Automatic tumhari Vercel URL nikal lega
    setBaseUrl(window.location.origin);
  }, []);

  const webhookUrl = `${baseUrl}/api/webhook`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meta Integration</h1>
          <p className="text-zinc-500 mt-1">Instagram Graph API aur Webhook configuration manage karein.</p>
        </div>
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all ${isVerified ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
          {isVerified ? <CheckCircle size={16} /> : <RefreshCw size={16} className="animate-spin" />}
          {isVerified ? 'Meta Verified' : 'Pending Verification'}
        </div>
      </div>

      {/* Webhook URL Section */}
      <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-blue-600 font-bold uppercase text-xs tracking-widest">
          <Globe size={14} /> <span>Your Webhook Endpoint</span>
        </div>
        <p className="text-sm text-zinc-500">Ise Meta Developer Portal mein "Callback URL" ki jagah paste karein.</p>
        
        <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <code className="flex-1 px-4 text-xs font-mono text-blue-600 dark:text-blue-400 truncate">
            {webhookUrl}
          </code>
          <button 
            onClick={copyToClipboard}
            className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-90 shadow-sm"
          >
            {copySuccess ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* API Settings Form */}
        <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-6 shadow-sm">
          <h3 className="font-bold flex items-center gap-2">
            <ShieldCheck className="text-pink-500" /> API Configuration
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Access Token</label>
              <input type="password" placeholder="EAAb..." className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Verify Token (Custom)</label>
              <input type="text" placeholder="basekey_secret_123" className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              <p className="text-[10px] text-zinc-400">Ye token wahi hona chahiye jo tumne Meta Dashboard mein dala hai.</p>
            </div>
          </div>

          <button className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-zinc-500/10">
            <Save size={20} /> Save Configuration
          </button>
        </div>

        {/* Documentation / Help */}
        <div className="p-8 bg-blue-600/5 border border-blue-600/10 rounded-3xl space-y-4">
          <h3 className="font-bold text-blue-600">Verification Steps:</h3>
          <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex gap-2">
              <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">1</span>
              <span>Apne <b>Meta Developer App</b> mein "Instagram Graph API" add karein.</span>
            </li>
            <li className="flex gap-2">
              <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">2</span>
              <span>"Webhooks" section mein jayein aur "Instagram" select karein.</span>
            </li>
            <li className="flex gap-2">
              <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">3</span>
              <span>Upar diya gaya <b>Webhook Endpoint</b> aur <b>Verify Token</b> wahan paste karein.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
