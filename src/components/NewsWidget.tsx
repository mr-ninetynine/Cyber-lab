import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, RefreshCw, AlertTriangle, ExternalLink, Shield, Radio, Flame, Server, Cpu, Layers } from 'lucide-react';

interface NewsItem {
  id: string | number;
  title: string;
  url?: string;
  by?: string;
  time?: number;
  type: 'real' | 'cybernet';
  category?: 'WORLD' | 'BUSINESS' | 'TECHNOLOGY' | 'ENTERTAINMENT' | 'SCIENCE' | 'BANGLADESH' | 'THREAT' | 'SYSTEM' | 'CORE';
  severity?: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  description?: string;
}

const BANGLADESH_NEWS_DATA: NewsItem[] = [
  {
    id: 'bd-1',
    title: 'METRO RAIL EXPANSION: Dhaka Mass Rapid Transit Line-6 records highest ridership of 350,000 daily passengers; planning new route tracks.',
    type: 'cybernet',
    category: 'BANGLADESH',
    severity: 'HIGH',
    description: 'Rapid mass transit expansion eases central business district travel times significantly.',
    by: 'DHAKA TRIBUNE',
    url: 'https://www.dhakatribune.com/bangladesh/dhaka/341908/dhaka-metro-rail-now'
  },
  {
    id: 'bd-2',
    title: 'SMART DIGITAL REVOLUTION: Mobile financial gateway system hits landmark transaction speed with secure biometric verification.',
    type: 'cybernet',
    category: 'BANGLADESH',
    severity: 'MED',
    description: 'Fintech ecosystems flourish as digital payment services push deep into rural marketplaces.',
    by: 'DAILY STAR',
    url: 'https://www.thedailystar.net/business/news/digital-payments'
  },
  {
    id: 'bd-3',
    title: 'INFO-TECH CORRIDOR: Bangladesh High-Tech Park Authority welcomes 15 new international technology venture partnerships.',
    type: 'cybernet',
    category: 'BANGLADESH',
    severity: 'HIGH',
    description: 'Billion-dollar tech hubs ready to employ 50,000 neural network and soft architecture graduates.',
    by: 'THE DAILY STAR',
    url: 'https://www.thedailystar.net/tech-startup/news'
  },
  {
    id: 'bd-4',
    title: 'GREEN POWER INTEGRATION: Rooppur Nuclear Power Station executes trial unit connectivity checks with zero emissions.',
    type: 'cybernet',
    category: 'BANGLADESH',
    severity: 'CRITICAL',
    description: 'Nuclear energy experts verify initial power synchronization loop across central grid pathways.',
    by: 'DHAKA TRIBUNE',
    url: 'https://www.dhakatribune.com/business'
  },
  {
    id: 'bd-5',
    title: 'EXPORT RESILIENCE: Industrial garments manufacturing leverages AI-optimized routing to streamline world deliveries.',
    type: 'cybernet',
    category: 'BANGLADESH',
    severity: 'MED',
    description: 'Automated logistics networks boost dispatch speeds for European and North American retail shipments.',
    by: 'DAILY STAR',
    url: 'https://www.thedailystar.net/business'
  },
  {
    id: 'bd-6',
    title: 'PADDY AGRITECH DISCOVERY: Climate-resilient salinity-tolerant crop strains successfully harvested in southern coastal bands.',
    type: 'cybernet',
    category: 'BANGLADESH',
    severity: 'HIGH',
    description: 'Breakthrough seeds enable round-the-clock cultivation despite hostile high-tide environments.',
    by: 'DHAKA TRIBUNE',
    url: 'https://www.dhakatribune.com/bangladesh/environment/338902'
  }
];

export function NewsWidget() {
  const [newsPool, setNewsPool] = useState<NewsItem[]>([]);
  const [visibleNews, setVisibleNews] = useState<NewsItem[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'WORLD' | 'TECH_SCIENCE' | 'BANGLADESH'>('ALL');
  
  const [decryptionRate, setDecryptionRate] = useState(99.6);
  const [scanPulse, setScanPulse] = useState(false);
  const [latestIntercept, setLatestIntercept] = useState<NewsItem | null>(null);
  const [interceptTimer, setInterceptTimer] = useState<number>(8); // countdown till next incoming intercept

  // 1. Fetch World & Bangladesh news from server backend
  const fetchGlobalFeeds = async () => {
    setLoading(true);
    setScanPulse(true);
    try {
      const response = await fetch('/api/news');
      let data = [];
      if (response.ok) {
        data = await response.json();
      } else {
        console.error('API server returned error status:', response.status);
      }
      
      // Map Bangladesh data with dynamic timestamps so they list chronologically with RSS news
      const baseTime = Math.floor(Date.now() / 1000);
      const freshBD = BANGLADESH_NEWS_DATA.map((item, index) => ({
        ...item,
        time: baseTime - (index * 600) // spread out 10 mins apart
      }));

      let combined: NewsItem[] = [];
      if (Array.isArray(data) && data.length > 0) {
        combined = [...data, ...freshBD].sort((a, b) => (b.time || 0) - (a.time || 0));
      } else {
        combined = freshBD;
      }

      // De-duplicate news entries by ID to prevent any key duplication
      const seenIds = new Set<string | number>();
      const uniqueCombined = combined.filter(item => {
        if (!item.id || seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      setNewsPool(uniqueCombined);
      
      // Set initial buffer items matching the active filter
      const matchingPool = uniqueCombined.filter(item => {
        if (filter === 'WORLD') return item.category === 'WORLD';
        if (filter === 'TECH_SCIENCE') return item.category === 'TECHNOLOGY' || item.category === 'SCIENCE';
        if (filter === 'BANGLADESH') return item.category === 'BANGLADESH' || item.type === 'cybernet';
        return true;
      });

      const count = Math.min(5, matchingPool.length);
      setVisibleNews(matchingPool.slice(0, count));
      setPoolIndex(count);
      
      setDecryptionRate(parseFloat((98 + Math.random() * 1.95).toFixed(2)));
    } catch (err) {
      console.error('Failed to parse remote global RSS news stream:', err);
      // Fallback solely to mockup Bangladesh alerts so UI compiles and works flawlessly
      const baseTime = Math.floor(Date.now() / 1000);
      const freshBD = BANGLADESH_NEWS_DATA.map((item, index) => ({
        ...item,
        time: baseTime - (index * 600)
      }));
      
      const fallbackSeen = new Set<string | number>();
      const uniqueBD = freshBD.filter(item => {
        if (!item.id || fallbackSeen.has(item.id)) return false;
        fallbackSeen.add(item.id);
        return true;
      });

      setNewsPool(uniqueBD);
      setVisibleNews(uniqueBD.slice(0, 5));
      setPoolIndex(5);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setScanPulse(false);
      }, 700);
    }
  };

  useEffect(() => {
    fetchGlobalFeeds();
    // Re-check RSS servers every 90 seconds
    const interval = setInterval(() => {
      fetchGlobalFeeds();
    }, 90000);
    return () => clearInterval(interval);
  }, []);

  // When filter changes, pre-populate visibleNews with matching stories from the pool
  useEffect(() => {
    if (newsPool.length === 0) return;
    
    const matchingPool = newsPool.filter(item => {
      if (filter === 'WORLD') return item.category === 'WORLD';
      if (filter === 'TECH_SCIENCE') return item.category === 'TECHNOLOGY' || item.category === 'SCIENCE';
      if (filter === 'BANGLADESH') return item.category === 'BANGLADESH' || item.type === 'cybernet';
      return true;
    });

    const count = Math.min(5, matchingPool.length);
    setVisibleNews(matchingPool.slice(0, count));
    setPoolIndex(count);
  }, [filter, newsPool]);

  // 2. "One By One All Time" real-time news intercept injector
  useEffect(() => {
    if (newsPool.length === 0) return;

    // Countdown clock for intercept
    const ticker = setInterval(() => {
      setInterceptTimer(prev => {
        if (prev <= 1) {
          // Trigger dynamic injection of single new story!
          injectNextStory();
          return 8; // Reset to 8s
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [newsPool, poolIndex, filter]);

  const injectNextStory = () => {
    if (newsPool.length === 0) return;

    // Filter newsPool to find eligible items based on the active filter
    const matchingPool = newsPool.filter(item => {
      if (filter === 'WORLD') return item.category === 'WORLD';
      if (filter === 'TECH_SCIENCE') return item.category === 'TECHNOLOGY' || item.category === 'SCIENCE';
      if (filter === 'BANGLADESH') return item.category === 'BANGLADESH' || item.type === 'cybernet';
      return true;
    });

    if (matchingPool.length === 0) return;

    // Retrieve next item from matchingPool list
    const nextItem = matchingPool[poolIndex % matchingPool.length];
    setPoolIndex(prev => prev + 1);

    // Briefly flash the intercept banner to mimic real-time satellite decryption
    setLatestIntercept(nextItem);
    setScanPulse(true);
    
    setTimeout(() => {
      setScanPulse(false);
    }, 500);

    setTimeout(() => {
      setLatestIntercept(null);
    }, 2800);

    // Prepend to visible screen, shifting items and removing any existing duplicate of the injected story
    setVisibleNews(prev => {
      const filtered = prev.filter(item => item.id !== nextItem.id && item.title !== nextItem.title);
      return [nextItem, ...filtered].slice(0, 5);
    });
  };

  const getCategoryStyles = (category?: string) => {
    switch (category) {
      case 'WORLD':
        return {
          bg: 'bg-red-950/40 border-red-500/40 hover:border-red-500 text-[#e0e0e0]',
          label: 'INTEL // WAR & POLITICS',
          labelColor: 'text-red-400 [text-shadow:0_0_3px_#ef4444]',
          icon: <Flame size={10} className="text-red-500 animate-pulse" />
        };
      case 'BUSINESS':
        return {
          bg: 'bg-[#1e1302]/30 border-amber-500/30 hover:border-amber-500 text-[#e0e0e0]',
          label: 'RECON // FINANCIALS',
          labelColor: 'text-amber-500',
          icon: <Shield size={10} className="text-amber-500" />
        };
      case 'TECHNOLOGY':
        return {
          bg: 'bg-cyan-950/30 border-cyan-500/30 hover:border-cyan-500 text-[#e0e0e0]',
          label: 'DATA_MOD // SYSTEMS',
          labelColor: 'text-cyber-blue [text-shadow:0_0_3px_#00f3ff]',
          icon: <Cpu size={10} className="text-cyber-blue animate-pulse" />
        };
      case 'ENTERTAINMENT':
        return {
          bg: 'bg-fuchsia-950/30 border-fuchsia-500/30 hover:border-fuchsia-500 text-[#e0e0e0]',
          label: 'MEDIA_BURST // CULTURE',
          labelColor: 'text-fuchsia-400',
          icon: <Layers size={10} className="text-fuchsia-500" />
        };
      case 'SCIENCE':
        return {
          bg: 'bg-emerald-950/30 border-emerald-500/30 hover:border-emerald-500 text-[#e0e0e0]',
          label: 'CORE_LABS // ECO',
          labelColor: 'text-matrix-green [text-shadow:0_0_3px_#00ff66]',
          icon: <Globe size={10} className="text-matrix-green" />
        };
      case 'BANGLADESH':
        return {
          bg: 'bg-emerald-950/20 border-emerald-500/20 hover:border-red-500/80 text-[#e0e0e0]',
          label: 'DISPATCH // BANGLADESH NEWS',
          labelColor: 'text-emerald-400 [text-shadow:0_0_3px_#10b981]',
          icon: <Globe size={10} className="text-[#00ff66] animate-pulse" />
        };
      default:
        return {
          bg: 'bg-neutral-950/40 border-matrix-green/20 hover:border-matrix-green text-[#e0e0e0]',
          label: 'SATELLITE // BURST',
          labelColor: 'text-matrix-green/80',
          icon: <Server size={10} className="text-matrix-green" />
        };
    }
  };

  // Filter items in the screen slice based on the visual categories
  const filteredList = visibleNews.filter(item => {
    if (filter === 'WORLD') return item.category === 'WORLD';
    if (filter === 'TECH_SCIENCE') return item.category === 'TECHNOLOGY' || item.category === 'SCIENCE';
    if (filter === 'BANGLADESH') return item.category === 'BANGLADESH' || item.type === 'cybernet';
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/90 border border-matrix-green/20 p-4 rounded shadow-[0_0_15px_rgba(0,255,102,0.03)] text-xs font-mono relative">
      
      {/* Visual cyber scanning indicators */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-matrix-green/30 to-transparent animate-pulse" />

      {/* Widget Header */}
      <div className="flex items-center justify-between border-b-2 border-matrix-green/20 pb-2 mb-3 select-none">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${scanPulse ? 'bg-emerald-500' : 'bg-matrix-green'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${scanPulse ? 'bg-emerald-500' : 'bg-matrix-green'}`} />
          </span>
          <h2 className="text-[10px] font-heading font-extrabold tracking-widest text-matrix-green uppercase flex items-center gap-1.5 [text-shadow:0_0_5px_rgba(0,255,102,0.4)]">
            <Radio size={12} className={scanPulse ? 'animate-bounce' : ''} />
            LIVE_WORLD_NEWS // INTERCEPT
          </h2>
        </div>
        
        {/* Countdown to next feed insert */}
        <div className="text-[8px] text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-matrix-green/10 flex items-center gap-1.5">
          <span className="text-[#606060] uppercase font-bold text-[7px]">DECRYPT IN:</span>
          <span className="text-matrix-green font-bold w-3 text-center">{interceptTimer}s</span>
        </div>
      </div>

      {/* Decryption Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 bg-neutral-950 p-2 border border-matrix-green/15 rounded select-none text-[8.5px] text-[#A0A0A0]">
        <div className="flex flex-col">
          <span className="uppercase text-[7.5px] text-matrix-green/40 font-bold">Uplink Gateway</span>
          <span className="text-matrix-green font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-matrix-green animate-pulse" />
            BBC_BD_LIVE
          </span>
        </div>
        <div className="flex flex-col">
          <span className="uppercase text-[7.5px] text-cyber-blue/40 font-bold">Signal Accuracy</span>
          <span className="text-cyber-blue font-bold">{decryptionRate}% [OK]</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-2.5 border-b border-matrix-green/10 pb-2 select-none">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase border transition-all cursor-pointer ${filter === 'ALL' ? 'bg-matrix-green/20 text-matrix-green border-matrix-green' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          ALL
        </button>
        <button 
          onClick={() => setFilter('WORLD')}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase border transition-all cursor-pointer ${filter === 'WORLD' ? 'bg-red-950/40 text-red-400 border-red-500/40' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          POLITICS/WAR
        </button>
        <button 
          onClick={() => setFilter('TECH_SCIENCE')}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase border transition-all cursor-pointer ${filter === 'TECH_SCIENCE' ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/40' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          TECH/SCI
        </button>
        <button 
          onClick={() => setFilter('BANGLADESH')}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-widest uppercase border transition-all cursor-pointer ${filter === 'BANGLADESH' ? 'bg-emerald-950/40 text-[#00ff66] border-emerald-500/40' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
        >
          BANGLADESH
        </button>
      </div>

      {/* Flash live popup on new packet arrival to mimic high-end hollywood deck terminal */}
      <AnimatePresence>
        {latestIntercept && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            className="absolute top-24 left-4 right-4 z-20 bg-red-950/95 border-2 border-red-500 p-3 rounded shadow-[0_0_20px_rgba(239,68,68,0.4)] flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-1.5 text-[8px] font-extrabold text-red-400 tracking-widest uppercase">
              <AlertTriangle size={10} className="animate-bounce" />
              <span>LIVE WIRE TRANSCEIVER DECRYPTING ...</span>
            </div>
            <p className="text-[10px] text-white leading-relaxed font-bold tracking-normal uppercase line-clamp-2">
              {latestIntercept.title}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed Container (Limited to 5 items to guarantee no scrollbar is visible) */}
      <div className="flex-1 flex flex-col justify-between overflow-hidden gap-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {loading ? (
            <div className="flex-1 flex flex-col justify-around py-3">
              {[1, 2, 3, 4, 5].map(num => (
                <div key={num} className="animate-pulse space-y-1.5 border border-matrix-green/10 p-2 rounded bg-neutral-950/40">
                  <div className="h-2 bg-matrix-green/15 rounded w-1/4" />
                  <div className="h-3 bg-matrix-green/10 rounded w-full" />
                </div>
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-[#505050]">
              <AlertTriangle size={24} className="mb-2" />
              <p className="tracking-widest uppercase text-[10px]">NO_MATCHING_STREAM</p>
              <p className="text-[8px] mt-1">UPLINK FILTER UNMATCHED</p>
            </div>
          ) : (
            filteredList.map((item, index) => {
              const styles = getCategoryStyles(item.category);
              return (
                <motion.a
                  key={item.id}
                  layout="position"
                  initial={{ opacity: 0, x: -15, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 15, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-2.5 border-l-2 rounded-r transition-all duration-300 relative group/card bg-neutral-950/55 block cursor-pointer select-none no-underline border-b-transparent hover:border-b-transparent ${styles.bg}`}
                >
                  {/* Glowing light edge on hover */}
                  <div className="absolute top-0 right-0 w-[1.5px] h-0 bg-matrix-green group-hover/card:h-full transition-all duration-300" />

                  <div className="flex items-center justify-between text-[8px] uppercase font-extrabold tracking-wider mb-1 text-neutral-400 select-none">
                    <div className="flex items-center gap-1.5">
                      {styles.icon}
                      <span className={styles.labelColor}>{styles.label}</span>
                    </div>
                    <span className="text-[7.5px] font-normal text-neutral-500 uppercase tracking-widest">
                      {item.time ? new Date(item.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'UPLINK'}
                    </span>
                  </div>

                  {/* Title */}
                  <p className="leading-snug tracking-normal text-[10px] sm:text-[11px] mb-1 font-bold text-[#e6e6e6] group-hover/card:text-white transition-colors">
                    {item.title}
                  </p>

                  <p className="text-[9px] text-neutral-400 font-normal leading-normal line-clamp-1 mb-1 font-mono">
                    {item.description || 'Secure encrypted transmission successfully filtered.'}
                  </p>

                  <div className="flex items-center justify-between mt-1 select-none">
                    <span className="text-[7px] text-[#707070] font-mono font-bold uppercase tracking-widest">
                      SOURCE: {item.by || 'WORLD INTEL'}
                    </span>
                    
                    {item.url && (
                      <div 
                        className="text-matrix-green group-hover/card:text-white flex items-center gap-0.5 text-[8.5px] font-bold transition-all group-hover/card:[text-shadow:0_0_6px_rgba(0,255,102,0.8)] border-b border-transparent group-hover/card:border-matrix-green/40"
                      >
                        <span>RESOLVE</span>
                        <ExternalLink size={7} />
                      </div>
                    )}
                  </div>
                </motion.a>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Ticker System Info */}
      <div className="mt-3 border-t border-matrix-green/10 pt-2 text-[8px] text-matrix-green/30 uppercase tracking-[0.2em] flex justify-between select-none">
        <span className="animate-pulse">AUTOSTREAM_READY</span>
        <span>SYS_SECLEVEL_AES</span>
      </div>
    </div>
  );
}

