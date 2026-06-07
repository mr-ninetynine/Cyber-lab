import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, RefreshCw, AlertTriangle, ExternalLink, Shield, Radio, Flame, Server } from 'lucide-react';

interface NewsItem {
  id: string | number;
  title: string;
  url?: string;
  by?: string;
  time?: number;
  type: 'real' | 'cybernet';
  category?: 'INTEL' | 'THREAT' | 'SYSTEM' | 'CORE';
  severity?: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
}

const CYBERNET_MOCK_ALERTS: NewsItem[] = [
  {
    id: 'cyber-1',
    title: 'MAINFRAME CORECTOMY: Kernel version x9 hot patch deployed globally to suppress neural entropy cascading.',
    type: 'cybernet',
    category: 'SYSTEM',
    severity: 'LOW',
    time: Math.floor(Date.now() / 1000) - 300,
  },
  {
    id: 'cyber-2',
    title: '[CRITICAL ALERT] Rogue subnetwork traffic detected in quadrant nine. Adaptive decryptors activated.',
    type: 'cybernet',
    category: 'THREAT',
    severity: 'CRITICAL',
    time: Math.floor(Date.now() / 1000) - 1200,
  },
  {
    id: 'cyber-3',
    title: 'Cognitive payload injection successfully contained in lab testbed. Threat vector verified.',
    type: 'cybernet',
    category: 'INTEL',
    severity: 'MED',
    time: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    id: 'cyber-4',
    title: 'Quantum alignment matrix rotated to baseline 42. Active scans indicate 100% telemetry accuracy.',
    type: 'cybernet',
    category: 'CORE',
    severity: 'HIGH',
    time: Math.floor(Date.now() / 1000) - 7200,
  }
];

export function NewsWidget() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'REAL_WORLD' | 'CYBER_SEC'>('ALL');
  const [decryptionSuccessRate, setDecryptionSuccessRate] = useState(99.4);
  const [scanPulse, setScanPulse] = useState(false);

  const fetchHackerNews = async () => {
    setLoading(true);
    setScanPulse(true);
    try {
      // 1. Fetch top technology stories from Hacker News
      const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      if (!topStoriesRes.ok) throw new Error('Query error');
      const topStoryIds = await topStoriesRes.json();
      
      // Take top 6 items
      const selectedIds = topStoryIds.slice(0, 6);
      const itemsPromise = selectedIds.map(async (id: number) => {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!itemRes.ok) return null;
          return await itemRes.json();
        } catch {
          return null;
        }
      });
      
      const rawStories = await Promise.all(itemsPromise);
      const hnStories: NewsItem[] = rawStories
        .filter(item => item && item.title)
        .map((item, index) => ({
          id: `hn-${item.id}`,
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          by: item.by || 'ANON_AGENT',
          time: item.time,
          type: 'real',
          category: index % 2 === 0 ? 'INTEL' : 'CORE'
        }));

      // Combine with some cyber deck alerts
      const combined = [...hnStories, ...CYBERNET_MOCK_ALERTS].sort((a, b) => (b.time || 0) - (a.time || 0));
      setNews(combined);
      
      // Randomize decryption success rate for hacker immersion
      setDecryptionSuccessRate(parseFloat((98 + Math.random() * 1.9).toFixed(2)));
    } catch (err) {
      console.error('Failed to query latest news uplink:', err);
      // Fallback solely to mockup cybernet alerts so UI compiles and works flawlessly
      setNews(CYBERNET_MOCK_ALERTS);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setScanPulse(false);
      }, 800);
    }
  };

  useEffect(() => {
    fetchHackerNews();
    
    // Auto sync feed every 60 seconds
    const interval = setInterval(() => {
      fetchHackerNews();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredNews = news.filter(item => {
    if (filter === 'REAL_WORLD') return item.type === 'real';
    if (filter === 'CYBER_SEC') return item.type === 'cybernet';
    return true;
  });

  const getSeverityStyle = (severity?: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL') => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-950/80 border-red-500 text-red-400 [text-shadow:0_0_5px_#ef4444]';
      case 'HIGH':
        return 'bg-amber-950/60 border-amber-500 text-amber-400';
      case 'MED':
        return 'bg-blue-950/60 border-cyber-blue text-cyber-blue';
      default:
        return 'bg-zinc-950/80 border-matrix-green/30 text-[#e0e0e0]';
    }
  };

  const getCategoryIcon = (category?: 'INTEL' | 'THREAT' | 'SYSTEM' | 'CORE') => {
    switch (category) {
      case 'THREAT':
        return <AlertTriangle size={10} className="text-red-500 shrink-0" />;
      case 'SYSTEM':
        return <Server size={10} className="text-matrix-green shrink-0 animate-pulse" />;
      case 'CORE':
        return <Globe size={10} className="text-cyber-blue shrink-0" />;
      default:
        return <Shield size={10} className="text-cyber-yellow shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/85 border border-matrix-green/20 p-4 rounded shadow-[inset_0_0_15px_rgba(0,255,102,0.05)] text-xs font-mono">
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-matrix-green/20 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${scanPulse ? 'bg-cyber-blue' : 'bg-matrix-green'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${scanPulse ? 'bg-cyber-blue' : 'bg-matrix-green'}`} />
          </span>
          <h2 className="text-[10px] font-heading font-bold tracking-widest text-[#E0E0E0] uppercase flex items-center gap-1.5">
            <Radio size={12} className={scanPulse ? 'animate-spin' : ''} />
            NEWS_INTEL // GLOBAL
          </h2>
        </div>
        <button 
          onClick={fetchHackerNews} 
          disabled={loading}
          className="p-1 hover:bg-matrix-green/10 text-matrix-green/70 hover:text-matrix-green rounded border border-transparent hover:border-matrix-green/20 transition-all cursor-pointer"
          title="Rescan uplinks"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 mb-3 bg-neutral-950/60 p-2 border border-matrix-green/10 rounded select-none text-[9px] text-[#A0A0A0]">
        <div className="flex flex-col">
          <span className="uppercase text-[8px] text-matrix-green/50">Uplink Status</span>
          <span className="text-matrix-green font-bold">[SYNCED_OK]</span>
        </div>
        <div className="flex flex-col">
          <span className="uppercase text-[8px] text-cyber-blue/50">DR_SUCCESS</span>
          <span className="text-cyber-blue font-bold">{decryptionSuccessRate}%</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-3 border-b border-matrix-green/10 pb-2">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-2 py-0.5 rounded text-[8px] tracking-widest uppercase border transition-all ${filter === 'ALL' ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/40' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          ALL
        </button>
        <button 
          onClick={() => setFilter('REAL_WORLD')}
          className={`px-2 py-0.5 rounded text-[8px] tracking-widest uppercase border transition-all ${filter === 'REAL_WORLD' ? 'bg-cyber-blue/10 text-cyber-blue border-cyber-blue/40' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          REAL_WORLD
        </button>
        <button 
          onClick={() => setFilter('CYBER_SEC')}
          className={`px-2 py-0.5 rounded text-[8px] tracking-widest uppercase border transition-all ${filter === 'CYBER_SEC' ? 'bg-cyber-yellow/10 text-cyber-yellow border-cyber-yellow/40' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          CYBER_SEC
        </button>
      </div>

      {/* Feed Container */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-matrix-green/20 scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="space-y-3 py-6">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="animate-pulse space-y-2 border border-matrix-green/10 p-2.5 rounded bg-neutral-950/40">
                  <div className="h-2 bg-matrix-green/20 rounded w-1/4" />
                  <div className="h-3 bg-matrix-green/15 rounded w-full" />
                  <div className="h-2 bg-matrix-green/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <p className="tracking-widest uppercase text-[10px]">NO_MATCHING_FEEDS</p>
              <p className="text-[9px] mt-1">UPLINK FILTER CLEAR</p>
            </div>
          ) : (
            filteredNews.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className={`p-2.5 border-l-2 rounded-r transition-all duration-300 relative group/card bg-neutral-950/40 hover:bg-neutral-900/60 ${
                  item.type === 'cybernet' 
                    ? getSeverityStyle(item.severity) 
                    : 'border-matrix-green/30 hover:border-matrix-green text-[#e0e0e0]'
                }`}
              >
                {/* Visual hover glitch side accent */}
                <div className="absolute top-0 right-0 w-[1px] h-0 bg-matrix-green group-hover/card:h-full transition-all duration-300" />

                <div className="flex items-center gap-1.5 text-[8px] uppercase font-bold tracking-wider mb-1.5 text-neutral-400 select-none">
                  {getCategoryIcon(item.category)}
                  <span>{item.category || 'FEED'}</span>
                  <span>//</span>
                  <span className="text-[8px] font-normal font-mono opacity-80 uppercase tracking-widest">
                    {item.time ? new Date(item.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'UPLINK'}
                  </span>
                </div>

                <p className="leading-relaxed font-mono tracking-wide text-[11px] mb-1 text-[#eaeaea] group-hover/card:text-white transition-colors">
                  {item.title}
                </p>

                <div className="flex items-center justify-between mt-2 select-none">
                  <span className="text-[8px] text-[#808080] font-mono uppercase tracking-widest">
                    BY: {item.by || 'SYS_INTEL'}
                  </span>
                  
                  {item.url && (
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-matrix-green hover:text-white flex items-center gap-1 text-[9px] transition-colors hover:[text-shadow:0_0_6px_rgba(0,255,102,0.8)] pb-0.5 border-b border-transparent hover:border-matrix-green/40 mt-1"
                    >
                      <span>RESOLVE</span>
                      <ExternalLink size={8} />
                    </a>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Bottom ticker banner */}
      <div className="mt-3 border-t border-matrix-green/10 pt-2 text-[8px] text-matrix-green/40 uppercase tracking-[0.25em] flex justify-between select-none">
        <span className="animate-pulse">FEED_MATRIX_UPLINK</span>
        <span>SYSVERS_x9.04</span>
      </div>
    </div>
  );
}
