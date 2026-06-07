import { useState, useRef, useEffect, Component, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal as TerminalIcon, 
  Zap, 
  Database, 
  Code, 
  Send, 
  Cpu, 
  Lock, 
  Activity,
  Copy,
  Check,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square
} from 'lucide-react';
import Markdown from 'react-markdown';
import { generateCyberLabResponse, transcribeAudio, generateSpeech, type AttachedFile } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const COMMON_PAYLOADS = [
  { name: 'XSS: Basic Alert', payload: '<script>alert(1)</script>' },
  { name: 'XSS: Image Error', payload: '<img src=x onerror=alert(1)>' },
  { name: 'SQLi: Auth Bypass', payload: "' OR '1'='1" },
  { name: 'SQLi: Union Select', payload: "' UNION SELECT NULL,NULL,NULL--" },
  { name: 'LFI: etc/passwd', payload: '../../../../../../etc/passwd' },
  { name: 'RCE: Simple Bash', payload: '; id; whoami' },
];

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-pitch-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-aegis-red/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <Lock size={48} className="text-aegis-red" />
          </div>
          <h1 className="text-2xl font-bold matrix-text tracking-[0.2em] mb-4">CRITICAL SYSTEM FAILURE</h1>
          <div className="max-w-md bg-black/60 border border-aegis-red/30 p-4 rounded font-mono text-xs text-aegis-red/80 mb-6 break-all">
            {this.state.error?.message || "UNKNOWN_KERNEL_PANIC"}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-aegis-red/20 border border-aegis-red/50 text-aegis-red rounded hover:bg-aegis-red/30 transition-all uppercase tracking-widest text-xs"
          >
            Reboot System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <CyberLabApp />
    </ErrorBoundary>
  );
}

function CyberLabApp() {
  console.log('Cyber-Lab App initializing...');
  const [activeTab, setActiveTab] = useState<'terminal' | 'payloads'>('terminal');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [voiceSupport, setVoiceSupport] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('SYSTEM IDLE');
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiDiagnostic, setApiDiagnostic] = useState<any>(null);
  const [attachedFiles, setAttachedFiles] = useState<(AttachedFile & { name: string, id: string })[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const startMediaRecorderRef = useRef<() => Promise<void>>(null);

  const [useFallbackVoice, setUseFallbackVoice] = useState(false);
  const fallingBackRef = useRef(false);

  const [deckStats, setDeckStats] = useState({
    coreTemp: 42,
    ramFree: 6.8,
    voltage: 1.25,
    uplinkStrength: 98,
    frequency: '2.44 GHz',
    activeScans: 12
  });

  const [rollingLogs, setRollingLogs] = useState<string[]>([
    "DECK_BOOT_STAGE_01 // SECURE_KERNEL_INITED",
    "DECRYPT_KEY_ROTATED // SHIELDING_UPLINK",
    "UPLINK_VERIFIED // ACTIVE_TUNNEL_PORT:0x3A0B"
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDeckStats(prev => ({
        coreTemp: Math.min(85, Math.max(35, Math.round(prev.coreTemp + (Math.random() - 0.5) * 4))),
        ramFree: parseFloat((6.2 + Math.random() * 0.8).toFixed(1)),
        voltage: parseFloat((1.22 + Math.random() * 0.06).toFixed(2)),
        uplinkStrength: Math.min(100, Math.max(85, Math.round(prev.uplinkStrength + (Math.random() - 0.5) * 6))),
        frequency: (2.42 + Math.random() * 0.08).toFixed(2) + ' GHz',
        activeScans: Math.round(10 + Math.random() * 5)
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const logs = [
      "PACKET_HOOK // SRC: 192.168.1.13 // RECV",
      "CORE_CLOCK // FREQ_ROTATION_STABLE",
      "MEMORY_CHECK // MAP_DUMP: 0x4F8B0A",
      "TUNNEL_STREAM // DECRYPTING_VOICE_FEEDS",
      "TTS_CHANNEL_INITIALIZING // PORT: 24000",
      "VOICE_DEC_ENGINE // SYNC_BURST: OK",
      "AI_DECK_ORACLE // LINKING_COGNITIVE_CORES",
      "DEEP_SCANNER // IP_RESOLVE_SUCCESS",
      "LOG_AUDIT // ROTATED_SESSION_RECORDS"
    ];
    const logInterval = setInterval(() => {
      setRollingLogs(prev => {
        const next = [...prev, logs[Math.floor(Math.random() * logs.length)]];
        if (next.length > 5) next.shift();
        return next;
      });
    }, 3000);
    return () => clearInterval(logInterval);
  }, []);

  useEffect(() => {
    console.log('Setting up SpeechRecognition...');
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        console.log('Native SpeechRecognition detected.');
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          console.log('SpeechRecognition result:', transcript);
          setInput(transcript);
          setIsListening(false);
          setStatusText('VOICE CAPTURED');
          // Auto-send as voice request
          handleSend(transcript, true);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          
          if (event.error === 'network') {
            setStatusText('NETWORK ERROR - FALLING BACK');
            fallingBackRef.current = true;
            setUseFallbackVoice(true); // Remember to use fallback next time
            // We don't call startMediaRecorder here anymore, we wait for onend
            // to ensure the microphone is released by the native API.
          } else {
            setIsListening(false);
            setStatusText('VOICE ERROR');
          }
        };

        recognition.onend = () => {
          console.log('SpeechRecognition ended. Falling back:', fallingBackRef.current);
          if (fallingBackRef.current) {
            console.log('Triggering MediaRecorder fallback from onend...');
            if (startMediaRecorderRef.current) {
              startMediaRecorderRef.current();
            }
          } else {
            setIsListening(false);
          }
          fallingBackRef.current = false;
        };

        recognitionRef.current = recognition;
      } else {
        console.log('Native SpeechRecognition NOT detected. Checking MediaRecorder...');
        // If SpeechRecognition is not supported, we'll use MediaRecorder which is more widely available
        const hasMediaRecorder = typeof window !== 'undefined' && !!window.MediaRecorder;
        console.log('MediaRecorder support:', hasMediaRecorder);
        setVoiceSupport(hasMediaRecorder);
      }
    }
  }, []);

  const startMediaRecorder = async () => {
    console.log('Starting MediaRecorder fallback...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      const getSupportedMimeType = () => {
        const types = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return '';
      };

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Silence detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let silenceStart = Date.now();
      const SILENCE_THRESHOLD = 10; // Lower threshold to capture quiet speech
      const SILENCE_DURATION = 4000; // Increased to 4.0 seconds to allow for natural pauses

      const checkSilence = () => {
        if (mediaRecorder.state !== 'recording') return;

        analyser.getByteTimeDomainData(dataArray);
        
        let maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = Math.abs(dataArray[i] - 128);
          if (val > maxVal) maxVal = val;
        }

        if (maxVal < SILENCE_THRESHOLD) {
          if (Date.now() - silenceStart > SILENCE_DURATION) {
            console.log('Silence detected. Stopping MediaRecorder...');
            mediaRecorder.stop();
            return;
          }
        } else {
          silenceStart = Date.now();
        }

        requestAnimationFrame(checkSilence);
      };

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder onstart event fired.');
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received. Size:', event.data.size);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onpause = () => {
        console.log('MediaRecorder onpause event fired.');
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error event:', event.error);
        setStatusText('MIC ERROR');
        setIsListening(false);
      };

      mediaRecorder.onresume = () => {
        console.log('MediaRecorder onresume event fired.');
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped. Processing audio...');
        setIsListening(false);
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        console.log('Recording mimeType:', actualMimeType);
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        console.log('Audio blob size:', audioBlob.size);
        setStatusText('TRANSCRIBING...');
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64Audio = (reader.result as string).split(',')[1];
            const transcript = await transcribeAudio(base64Audio, actualMimeType);
            if (transcript) {
              setInput(transcript);
              setStatusText('VOICE CAPTURED');
              // Auto-send as voice request
              handleSend(transcript, true);
            } else {
              setStatusText('COULD NOT TRANSCRIBE');
            }
          } catch (error: any) {
            console.error('Transcription error:', error);
            const errorMessage = error.message || String(error);
            
            if (errorMessage.includes("leaked") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
              setApiError("API_KEY_ERROR: Your Gemini API key is invalid or leaked. Please update it in the Settings menu.");
            }
            
            setStatusText('TRANSCRIPTION FAILED');
          }
        };
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };

      mediaRecorder.start();
      console.log('MediaRecorder started.');
      setIsListening(true);
      setStatusText('LISTENING (UNIVERSAL)...');
      requestAnimationFrame(checkSilence);
    } catch (error) {
      console.error('MediaRecorder error:', error);
      setStatusText('MIC ACCESS DENIED');
      setIsListening(false);
    }
  };

  // Assign the ref so the useEffect can access it
  (startMediaRecorderRef as any).current = startMediaRecorder;

  const toggleListening = () => {
    console.log('Toggling listening. Current state:', isListening, 'Use fallback:', useFallbackVoice);
    if (isGenerating) {
      setStatusText('SYSTEM BUSY...');
      return;
    }

    if (isListening) {
      // Stop whatever is active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      } else if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Failed to stop recognition:', e);
        }
      }
      setIsListening(false);
      return;
    }

    // Start listening
    // Prefer native SpeechRecognition if available and not failing
    if (recognitionRef.current && !useFallbackVoice) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setStatusText('LISTENING...');
      } catch (e) {
        // Fallback to MediaRecorder if recognition fails to start
        startMediaRecorder();
      }
    } else {
      // Fallback to MediaRecorder + Gemini Transcription
      startMediaRecorder();
    }
  };

  const speak = async (text: string) => {
    if (!isTtsEnabled || typeof window === 'undefined' || !text || text.trim().length === 0) return;
    
    // Split text into smaller chunks to avoid API limits and ensure full playback
    // Increased chunk size to 1800 to reduce API calls and avoid quota limits
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
    
    let currentChunk = "";
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > 1800) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    try {
      setStatusText('GENERATING VOICE...');
      
      // Pre-fetch the first chunk
      let nextChunkPromise = chunks.length > 0 ? generateSpeech(chunks[0]) : null;

      for (let i = 0; i < chunks.length; i++) {
        const base64Audio = await nextChunkPromise;
        if (!base64Audio) continue;

        // Start pre-fetching the next chunk immediately
        if (i + 1 < chunks.length) {
          nextChunkPromise = generateSpeech(chunks[i + 1]);
        }
        
        setStatusText('SPEAKING...');
        
        let audioCtx = audioCtxRef.current;
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = audioCtx;
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }
        
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let j = 0; j < pcmData.length; j++) {
          floatData[j] = pcmData[j] / 32768.0;
        }
        
        const buffer = audioCtx.createBuffer(1, floatData.length, 24000);
        buffer.getChannelData(0).set(floatData);
        
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        
        await new Promise<void>((resolve) => {
          source.onended = () => {
            audioCtx.close();
            if (audioCtxRef.current === audioCtx) audioCtxRef.current = null;
            resolve();
          };
          source.start();
        });
      }
      
      setStatusText('SYSTEM IDLE');
    } catch (error: any) {
      console.error("TTS Error:", error);
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes("leaked") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
        setApiError("API_KEY_ERROR: Your Gemini API key is invalid or leaked. Please update it in the Settings menu.");
      }

      const isCooldown = error?.message === "TTS_QUOTA_COOLDOWN";
      
      const isQuotaError = error?.status === "RESOURCE_EXHAUSTED" || 
                          error?.message?.includes("429") || 
                          error?.code === 429 ||
                          isCooldown ||
                          JSON.stringify(error).includes("429");

      if (isQuotaError) {
        setStatusText('QUOTA COOLDOWN - FALLBACK TO BROWSER');
      } else {
        setStatusText('TTS FAILED');
      }
      
      // Fallback to browser TTS if Gemini TTS fails
      const utterance = new SpeechSynthesisUtterance(text);
      if (/[\u0980-\u09FF]/.test(text)) {
        utterance.lang = 'bn-BD';
      } else {
        utterance.lang = 'en-US';
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkKeyStatus = () => {
      const geminiKey = process.env.GEMINI_API_KEY;
      const apiKey = process.env.API_KEY;
      const lKey = process.env.L_key;
      
      let keyToUse = geminiKey || apiKey || lKey;
      
      if (!keyToUse) {
        setApiError("API_KEY_ERROR: No API key found. Please set GEMINI_API_KEY in the Settings menu.");
        return;
      }
      
      const cleanedKey = keyToUse.replace(/^["']|["']$/g, '').replace(/[^\x20-\x7E]/g, '').trim();
      const isPlaceholder = cleanedKey.includes("TODO") || cleanedKey.includes("YOUR_API_KEY") || cleanedKey.length < 10;
      
      if (isPlaceholder) {
        setApiError("API_KEY_ERROR: Your API key appears to be a placeholder or invalid.");
      } else {
        setApiError(null);
      }
    };
    checkKeyStatus();
  }, []);

  const handleReverify = async () => {
    setStatusText('RE-VERIFYING UPLINK...');
    const geminiKey = process.env.GEMINI_API_KEY;
    const apiKey = process.env.API_KEY;
    const lKey = process.env.L_key;
    
    let keyToUse = geminiKey || apiKey || lKey;
    
    if (keyToUse) {
      const cleanedKey = keyToUse.replace(/^["']|["']$/g, '').replace(/[^\x20-\x7E]/g, '').trim();
      const isPlaceholder = cleanedKey.includes("TODO") || cleanedKey.includes("YOUR_API_KEY") || cleanedKey.length < 10;
      
      if (!isPlaceholder) {
        setApiError(null);
        setStatusText('UPLINK RESTORED');
        setTimeout(() => setStatusText('SYSTEM IDLE'), 2000);
        return;
      }
    }
    
    setApiError("API_KEY_ERROR: API key is still invalid or missing.");
    setStatusText('UPLINK FAILED');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: (AttachedFile & { name: string, id: string })[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      const filePromise = new Promise<(AttachedFile & { name: string, id: string })>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            data: base64,
            mimeType: file.type
          });
        };
      });
      
      reader.readAsDataURL(file);
      newFiles.push(await filePromise);
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSend = async (overrideInput?: string, isVoiceRequest: boolean = false) => {
    const textToSend = overrideInput !== undefined ? overrideInput : input;
    console.log('Handling send. Text:', textToSend.slice(0, 50) + '...', 'Voice:', isVoiceRequest);
    if ((!textToSend.trim() && attachedFiles.length === 0) || isGenerating) return;

    const userMessage: Message = { 
      role: 'user', 
      content: textToSend + (attachedFiles.length > 0 ? `\n\n[Attached Files: ${attachedFiles.map(f => f.name).join(', ')}]` : '')
    };
    setMessages(prev => [...prev, userMessage]);
    
    const currentFiles = [...attachedFiles];
    setInput('');
    setAttachedFiles([]);
    setIsGenerating(true);
    setProgress(0);
    setStatusText('INITIALIZING PACKET INJECTION...');

    // Fake progress bar logic
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      let assistantContent = '';
      const responseStream = generateCyberLabResponse(textToSend, currentFiles.map(({ data, mimeType }) => ({ data, mimeType })));
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setStatusText('DECRYPTING RESPONSE...');

      for await (const chunk of responseStream) {
        assistantContent += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantContent;
          return newMessages;
        });
      }
      
      if (isTtsEnabled && isVoiceRequest) {
        speak(assistantContent);
      }
      
      setProgress(100);
      setStatusText('TRANSMISSION COMPLETE');
      setTimeout(() => {
        setProgress(0);
        setStatusText('SYSTEM IDLE');
      }, 2000);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes("leaked") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) {
        setApiError("API_KEY_ERROR: Your Gemini API key is invalid or leaked. Please update it in the Settings menu.");
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `ERROR: UPLINK FAILED. ${(errorMessage.includes("leaked") || errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid")) ? "API KEY ERROR. PLEASE UPDATE IN SETTINGS." : "CHECK SYSTEM LOGS."}` 
      }]);
      setStatusText('CRITICAL ERROR');
    } finally {
      setIsGenerating(false);
      clearInterval(progressInterval);
    }
  };

  return (
    <div className="crt-container h-screen max-h-screen w-screen flex flex-col bg-[#020202] text-matrix-green font-mono selection:bg-matrix-green selection:text-black relative overflow-hidden">
      {/* Background Watermark */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-center bg-no-repeat grayscale"
        style={{ backgroundImage: "url('https://i.ibb.co.com/jvQPkL2Y/at.png')", backgroundSize: '35%' }}
      />
      
      {/* Sci-fi Overlay Lines & Grids */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] pointer-events-none z-40 opacity-40"></div>
      
      {/* Header */}
      <header className="border-b-2 border-matrix-green/30 px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src="https://i.ibb.co.com/jvQPkL2Y/at.png" 
              alt="Devil Hunter Cyber Corps" 
              className="w-14 h-14 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,255,102,0.8)] grayscale brightness-125"
              referrerPolicy="no-referrer"
            />
            <motion.div 
              animate={{ 
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.15, 1]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-matrix-green/30 blur-xl rounded-full -z-10"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-matrix-green animate-ping" />
              <h1 className="text-xl font-bold font-heading tracking-[0.25em] text-matrix-green drop-shadow-[0_0_8px_rgba(0,255,102,0.6)]">
                CYBER-LAB // COGNITIVE_DECK
              </h1>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-[#a0a0a0]">Hardware Version: x9 // Secure Cybernetic Shell</p>
          </div>
        </div>

        {/* Tab Controls to resemble deck consoles */}
        <div className="flex items-center gap-3 bg-neutral-900/80 p-1 border border-matrix-green/20 rounded">
          <button 
            onClick={() => setActiveTab('terminal')}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded transition-all text-xs font-heading font-semibold uppercase tracking-wider relative overflow-hidden",
              activeTab === 'terminal' 
                ? "bg-matrix-green/20 text-matrix-green border border-matrix-green shadow-[0_0_12px_rgba(0,255,102,0.3)]" 
                : "text-neutral-500 hover:text-matrix-green/70"
            )}
          >
            <TerminalIcon size={12} />
            Terminal Console
            {activeTab === 'terminal' && (
              <span className="absolute bottom-0 left-0 w-full h-[2px] bg-matrix-green" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('payloads')}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded transition-all text-xs font-heading font-semibold uppercase tracking-wider relative overflow-hidden",
              activeTab === 'payloads' 
                ? "bg-cyber-blue/20 text-cyber-blue border border-cyber-blue shadow-[0_0_12px_rgba(0,243,255,0.3)]" 
                : "text-neutral-500 hover:text-cyber-blue/70"
            )}
          >
            <Zap size={12} />
            Payload Modules
            {activeTab === 'payloads' && (
              <span className="absolute bottom-0 left-0 w-full h-[2px] bg-cyber-blue" />
            )}
          </button>
        </div>
      </header>

      {/* API Error Banner in Retro Critical Red */}
      <AnimatePresence>
        {apiError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-950/90 border-b border-red-500/50 p-4 flex items-center justify-between gap-4 z-40 relative"
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-red-500 text-xs font-mono font-bold tracking-wider">
                  <Lock size={16} className="shrink-0 animate-bounce" />
                  <span>[K-FAILURE] {apiError}</span>
                </div>
                {apiDiagnostic?.maskedKey && apiDiagnostic.maskedKey !== "none" && (
                  <div className="text-[10px] text-red-400/60 font-mono ml-7 uppercase tracking-tighter">
                    TARGET RECON ACCESS LIMIT STATE // KEY: {apiDiagnostic.maskedKey}
                  </div>
                )}
              </div>
              <button 
                onClick={handleReverify}
                className="px-3 py-1 bg-red-900/40 border border-red-500 text-red-400 rounded hover:bg-red-500 hover:text-black transition-all text-[10px] uppercase font-bold tracking-widest"
              >
                Re-Verify Link
              </button>
            </div>
            <button 
              onClick={() => setApiError(null)}
              className="text-red-400/60 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Dashboard Frame */}
      <main className="flex-1 overflow-hidden flex flex-col p-4 w-full max-w-7xl mx-auto gap-4 z-10">
        
        {/* Hollywood Deck diagnostics panel overlay */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-black/90 p-3 border-x-2 border-t border-b-2 border-matrix-green/30 rounded shadow-[inset_0_0_15px_rgba(0,255,102,0.05)] text-xs font-mono text-[#E0E0E0]">
          
          <div className="flex flex-col gap-1 p-2 bg-neutral-950/60 border border-matrix-green/10 rounded">
            <span className="text-[8px] uppercase tracking-wider text-matrix-green/60">System State</span>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-matrix-green animate-pulse" />
              <span className="font-bold text-matrix-green drop-shadow-[0_0_4px_rgba(0,255,102,0.4)] truncate">{statusText}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 bg-neutral-950/60 border border-matrix-green/10 rounded">
            <span className="text-[8px] uppercase tracking-wider text-cyber-blue/60">Decryption Index</span>
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-cyber-blue" />
              <span className="font-bold text-cyber-blue">{deckStats.frequency}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 bg-neutral-950/60 border border-matrix-green/10 rounded">
            <span className="text-[8px] uppercase tracking-wider text-red-500/60">Core Temperature</span>
            <div className="flex items-center justify-between">
              <span className={cn(
                "font-bold",
                deckStats.coreTemp > 70 ? "text-red-500 animate-pulse" : "text-cyber-yellow"
              )}>{deckStats.coreTemp}°C</span>
              <span className="text-[8px] text-[#808080]">MAX: 85C</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2 bg-neutral-950/60 border border-matrix-green/10 rounded">
            <span className="text-[8px] uppercase tracking-wider text-matrix-green/60">Signal Strength</span>
            <div className="flex items-center gap-1.5 w-full">
              <span className="font-bold text-matrix-green">{deckStats.uplinkStrength}%</span>
              <div className="flex-1 h-1.5 bg-neutral-900 border border-matrix-green/10 rounded overflow-hidden">
                <div className="h-full bg-matrix-green" style={{ width: `${deckStats.uplinkStrength}%` }} />
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-col gap-1 p-2 bg-neutral-950/60 border border-matrix-green/10 rounded">
            <span className="text-[8px] uppercase tracking-wider text-cyber-blue/60">RAM Allocation</span>
            <span className="font-bold text-cyber-blue">{deckStats.ramFree} GB / 8.0 GB</span>
          </div>

          <div className="hidden lg:flex flex-col gap-1 p-2 bg-neutral-950/60 border border-matrix-green/10 rounded">
            <span className="text-[8px] uppercase tracking-wider text-cyber-yellow/60">Core Voltage</span>
            <span className="font-bold text-cyber-yellow">{deckStats.voltage}v [STABLE]</span>
          </div>

        </div>

        {/* Global Progress Bar for scanning actions */}
        <div className="relative h-5 bg-neutral-950 border border-matrix-green/20 rounded overflow-hidden px-1 flex items-center">
          <div className="absolute left-2 text-[8px] text-matrix-green/50 tracking-widest uppercase font-bold z-10 pointer-events-none">
            INJECTING DATA MATRIX PACKS ... {Math.round(progress)}%
          </div>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-[60%] bg-matrix-green shadow-[0_0_10px_#00ff66] rounded"
          />
        </div>

        {/* Outer Split Deck Body Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden relative min-h-0">
          
          {/* Cyber Sidebar - Diagnostics HUD */}
          <div className="hidden lg:flex lg:col-span-1 flex-col gap-4 overflow-y-auto bg-black/85 border border-matrix-green/20 p-4 rounded shadow-[inset_0_0_15px_rgba(0,255,102,0.05)] text-[#d4d4d4]">
            
            {/* Holographic Radar visualizer emulation using pure CSS/SVG */}
            <div className="flex flex-col items-center justify-center p-3 border border-matrix-green/20 rounded bg-neutral-950/70 relative overflow-hidden group">
              <div className="absolute top-2 left-2 text-[8px] text-matrix-green font-bold uppercase tracking-widest select-none">
                Uplink Scanner
              </div>
              <div className="w-24 h-24 rounded-full border-2 border-matrix-green/20 flex items-center justify-center relative my-2 overflow-hidden">
                {/* Rotating scanner sweep line */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute w-1/2 h-[2px] bg-gradient-to-r from-matrix-green to-transparent origin-left left-1/2"
                />
                {/* Concentric diagnostic rings */}
                <div className="w-16 h-16 rounded-full border border-matrix-green/10 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border border-matrix-green/30 flex items-center justify-center animate-pulse">
                    <span className="w-1.5 h-1.5 bg-matrix-green rounded-full shadow-[0_0_6px_#00ff66]" />
                  </div>
                </div>
                {/* Simulated radar blips */}
                <div className="absolute top-4 right-6 w-1 h-1 bg-cyber-blue rounded-full animate-ping" style={{ animationDelay: "1s" }} />
                <div className="absolute bottom-6 left-5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" style={{ animationDelay: "2.5s" }} />
              </div>
              <span className="text-[9px] text-[#A0A0A0] text-center uppercase tracking-wide">Frequency mapping optimized</span>
            </div>

            {/* Rolling system audits */}
            <div className="border border-matrix-green/20 p-3 rounded bg-neutral-950/70 py-4">
              <h3 className="text-[10px] text-matrix-green font-bold uppercase tracking-widest mb-2 border-b border-matrix-green/10 pb-1">
                SYSTEM AUDITSTREAM // ACTIVE
              </h3>
              <div className="space-y-2 text-[9px] font-mono leading-tight">
                {rollingLogs.map((log, index) => (
                  <div key={index} className="flex gap-1.5 items-start text-matrix-green/70">
                    <span className="text-matrix-green font-bold select-none">&gt;&gt;</span>
                    <span className="break-all">{log}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Voice stream audio meter emulator */}
            <div className="border border-matrix-green/20 p-3 rounded bg-neutral-950/70">
              <h3 className="text-[10px] text-[#E0E0E0] font-bold uppercase tracking-widest mb-1.5 border-b border-matrix-green/10 pb-1">
                CODELOCK MODULES LOADING
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="flex flex-col">
                  <span className="text-neutral-500">VOICE_SYNC</span>
                  <span className="text-[#a0a0a0]">{isListening ? 'STREAM_LISTEN' : 'PORT_IDLE'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-neutral-500">GENERATOR</span>
                  <span className="text-[#a0a0a0]">{isGenerating ? 'DECRYPT' : 'STANDBY'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-neutral-500">VOICE_DEC</span>
                  <span className="text-[#a0a0a0]">{isTtsEnabled ? 'SPEE_ON_x9' : 'SPEE_REST'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-neutral-500">SEC_LEVEL</span>
                  <span className="text-[#00ff66]">AES_256_GCM</span>
                </div>
              </div>
            </div>

            {/* Simulated hex memory dump */}
            <div className="border border-matrix-green/10 p-2 rounded bg-neutral-950/40 text-[8px] font-mono leading-none uppercase tracking-tighter opacity-50 space-y-1 mt-auto">
              <div>0x4F0B: 53 45 43 55 52 45 5f 53 48 45 4c 4c 39 35</div>
              <div>0x4F1C: 54 52 41 4e 53 4d 49 53 53 49 4f 4e 5f 4f</div>
              <div>0x4F2D: 43 4f 47 4e 49 54 49 56 45 5f 43 4f 52 45</div>
            </div>

          </div>

          {/* Main Workspace Frame (lg:col-span-3) */}
          <div className="lg:col-span-3 flex flex-col overflow-hidden bg-black/90 border-2 border-matrix-green/20 rounded-lg relative shadow-[0_0_15px_rgba(0,255,102,0.05)]">
            
            {/* CRT Screen scanline effect overlay */}
            <div className="absolute inset-0 z-0 pointer-events-none border border-matrix-green/10" />

            <AnimatePresence mode="wait">
              {activeTab === 'terminal' ? (
                <motion.div 
                  key="terminal"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full flex flex-col relative z-10"
                >
                  {/* Console Header */}
                  <div className="px-4 py-2 bg-neutral-950 border-b border-matrix-green/10 flex justify-between items-center text-[10px] uppercase font-bold tracking-wider select-none text-matrix-green/80">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-matrix-green animate-pulse" />
                      <span>DECK_SHELL@COGNITIVE_CORE: /dev/tty0</span>
                    </div>
                    <div>SECURE LINK: ESTABLISHED</div>
                  </div>

                  {/* Message Container Stream */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-matrix-green/20 font-mono text-sm">
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-75 py-12">
                        <motion.div 
                          animate={{ 
                            scale: [1, 1.05, 1],
                            rotate: [0, 5, -5, 0]
                          }}
                          transition={{ duration: 6, repeat: Infinity }}
                          className="w-16 h-16 rounded border border-matrix-green/30 flex items-center justify-center bg-matrix-green/5 text-matrix-green shadow-[0_0_15px_rgba(0,255,102,0.1)] mb-2 animate-pulse"
                        >
                          <Lock size={32} className="text-matrix-green" />
                        </motion.div>
                        <div className="space-y-1">
                          <p className="text-base font-bold font-heading text-matrix-green tracking-widest uppercase [text-shadow:0_0_5px_#00ff66]">
                            CYBER-LAB ONLINE
                          </p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest leading-6">
                            AWAITING OPERATOR PROMPTS OR SYSTEM ENQUIRIES...
                          </p>
                        </div>
                        <div className="max-w-md border border-matrix-green/20 p-4 rounded text-[11px] leading-5 text-neutral-400 bg-neutral-950/60 font-mono text-left tracking-wide mx-auto">
                          <div className="text-matrix-green font-bold font-heading mb-1 uppercase tracking-wider border-b border-matrix-green/10 pb-1">COGNITIVE SYSTEM DECK READY:</div>
                          <div>&gt; Describe a system architecture to evaluate security weaknesses.</div>
                          <div>&gt; Ask for complex payload generation or reverse engineering logic.</div>
                          <div>&gt; Press the microphone icon for quick, low-latency voice command response.</div>
                        </div>
                      </div>
                    )}
                    
                    {messages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex flex-col gap-1 w-full",
                          msg.role === 'user' ? "items-end" : "items-start"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest select-none",
                          msg.role === 'user' ? "text-matrix-green/50" : "text-cyber-blue"
                        )}>
                          <span>[{msg.role === 'user' ? 'OPERATOR_SHELL' : 'LAB_ORACLE'}]</span>
                          <span className="text-neutral-500 font-normal">TIMESTAMP: {new Date().toLocaleTimeString()}</span>
                        </div>
                        
                        <div className={cn(
                          "max-w-[95%] md:max-w-[85%] p-4 rounded border text-xs shadow-md leading-relaxed",
                          msg.role === 'user' 
                            ? "bg-matrix-green/5 border-matrix-green/30 text-[#E0E0E0] font-mono [text-shadow:0_0_2px_rgba(0,255,102,0.1)]" 
                            : "bg-neutral-950/80 border-cyber-blue/30 text-[#E0E0E0] markdown-body"
                        )}>
                          {msg.role === 'assistant' ? (
                            <>
                              <Markdown>{msg.content}</Markdown>
                              {isGenerating && i === messages.length - 1 && <span className="cursor-blink" />}
                            </>
                          ) : (
                            <p className="font-mono whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input & Control Area */}
                  <div className="p-4 border-t-2 border-matrix-green/20 bg-neutral-950">
                    
                    {/* File Attachment shelf */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {attachedFiles.map(file => (
                          <div key={file.id} className="flex items-center gap-2 bg-matrix-green/10 border border-matrix-green/30 rounded px-2.5 py-1 text-[10px] text-matrix-green font-mono">
                            {file.mimeType.startsWith('image/') ? <ImageIcon size={10} /> : <FileText size={10} />}
                            <span className="max-w-[120px] truncate">{file.name}</span>
                            <button onClick={() => removeFile(file.id)} className="hover:text-red-500 text-neutral-400">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="relative neon-glow rounded border border-matrix-green/30 flex flex-wrap lg:flex-nowrap items-center bg-black/80 shadow-[inset_0_0_10px_rgba(0,255,102,0.05)]">
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-4 text-matrix-green/60 hover:text-matrix-green transition-colors"
                        title="Upload target binaries/images"
                      >
                        <Paperclip size={18} />
                      </button>

                      {/* Voice assistance buttons layout inside shell prompt */}
                      <div className="flex items-center gap-1.5 px-3 border-r border-matrix-green/20">
                        <button 
                          onClick={toggleListening}
                          className={cn(
                            "p-2 rounded transition-all relative",
                            isListening ? "text-matrix-green animate-pulse bg-matrix-green/15 border border-matrix-green" : "text-matrix-green/45 hover:text-matrix-green hover:bg-matrix-green/5 border border-transparent",
                            !voiceSupport && "opacity-30"
                          )}
                          title={!voiceSupport ? "Mic Access Disabled" : (isListening ? "Stop Audio Streaming" : "Initiate Vocoder")}
                        >
                          {!voiceSupport ? <MicOff size={16} /> : (isListening ? <Square size={16} /> : <Mic size={16} />)}
                          {useFallbackVoice && !isListening && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-matrix-green rounded-full animate-pulse" />
                          )}
                        </button>
                        {useFallbackVoice && (
                          <button 
                            onClick={() => {
                              setUseFallbackVoice(false);
                              setStatusText('NATIVE VOICE COREGROUP');
                              setTimeout(() => setStatusText('SYSTEM IDLE'), 2000);
                            }}
                            className="p-2 text-matrix-green/40 hover:text-matrix-green"
                            title="Reset Vocoders"
                          >
                            <Activity size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setIsTtsEnabled(!isTtsEnabled);
                            if (isTtsEnabled) {
                              window.speechSynthesis.cancel();
                              if (audioCtxRef.current) {
                                audioCtxRef.current.close();
                                audioCtxRef.current = null;
                              }
                            }
                          }}
                          className={cn(
                            "p-2 rounded transition-all border border-transparent",
                            isTtsEnabled ? "text-matrix-green hover:bg-matrix-green/5" : "text-matrix-green/20 hover:text-matrix-green/40"
                          )}
                          title={isTtsEnabled ? "Mute Vocoder Speech Output" : "Enable Vocoder Speech Output"}
                        >
                          {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                        </button>
                      </div>

                      <div className="flex-1 flex items-center min-w-[200px]">
                        <span className="pl-3 text-matrix-green font-bold font-mono text-sm opacity-80 select-none hidden sm:inline">operator@cyberdeck:~$</span>
                        <input 
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                          placeholder="ENTER CODES, QUERIES OR TARGET IP..."
                          className="w-full bg-transparent p-4 pl-1 text-matrix-green placeholder:text-matrix-green/25 outline-none font-mono text-sm"
                        />
                      </div>
                      <button 
                        onClick={() => handleSend()}
                        disabled={isGenerating || (!input.trim() && attachedFiles.length === 0)}
                        className="p-4 text-matrix-green hover:bg-matrix-green/10 disabled:opacity-20 transition-all font-mono uppercase font-bold text-xs flex items-center gap-1.5"
                      >
                        <span>Inject</span>
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="payloads"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full p-6 overflow-y-auto z-10 relative"
                >
                  <div className="flex items-center gap-3 mb-6 border-b border-cyber-blue/20 pb-3">
                    <Zap className="text-cyber-blue drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]" />
                    <h2 className="text-xl font-bold font-heading text-cyber-blue tracking-widest [text-shadow:0_0_5px_#00f3ff]">
                      PAYLOAD_REPOSITORY // LOGIC
                    </h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {COMMON_PAYLOADS.map((p, i) => (
                      <PayloadCard key={i} name={p.name} payload={p.payload} />
                    ))}
                  </div>

                  <div className="mt-8 p-6 border-2 border-dashed border-cyber-blue/30 rounded-lg bg-cyber-blue/5 shadow-[inset_0_0_15px_rgba(0,243,255,0.02)]">
                    <h3 className="text-cyber-blue font-bold font-heading mb-2 flex items-center gap-2 tracking-wider">
                      <Code size={16} />
                      ON-DEMAND REVERSE INJECTORS
                    </h3>
                    <p className="text-xs text-[#a0a0a0] leading-relaxed font-mono">
                      Cyber-Lab system is preloaded with adaptive obfuscated injection decoders designed to bypass firewalls, AV software, and security defenses. 
                      Navigate to the <span className="text-matrix-green font-bold cursor-pointer" onClick={() => setActiveTab('terminal')}>Terminal Console</span> and ask for specialized code (e.g. "Generate a reverse shell wrapper structured code in C++").
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </main>

      {/* Futuristic Cyber Deck Base Grid Frame Footer */}
      <footer className="px-6 py-2 border-t-2 border-matrix-green/20 bg-neutral-950 flex justify-between items-center text-[9px] font-mono tracking-[0.25em] text-[#a0a0a0] z-10 relative">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-matrix-green" />
          <span>DECK_LINK: ESTABLISHED (SEC_PORT)</span>
        </div>
        <div className="hidden md:flex gap-6">
          <div>ALGO: AES-256-GCM</div>
          <div>NODE_ADDR: 0x7F000001</div>
          <div>SYS_SECURE: ACTIVE</div>
        </div>
        <div className="text-matrix-green font-bold font-heading uppercase tracking-[0.2em]">OPERATOR_UNIT_x99</div>
      </footer>
    </div>
  );
}

function PayloadCard({ name, payload }: { name: string, payload: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-neutral-950/90 border border-cyber-blue/20 hover:border-cyber-blue/50 rounded-lg p-4 flex flex-col gap-3 transition-colors group relative overflow-hidden shadow-md">
      <div className="absolute top-0 right-0 w-8 h-8 opacity-[0.03] pointer-events-none text-cyber-blue font-mono font-bold text-3xl select-none">H</div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-cyber-blue uppercase font-heading tracking-widest">{name}</span>
        <button 
          onClick={handleCopy}
          className="text-cyber-blue/50 hover:text-cyber-blue p-1 rounded hover:bg-cyber-blue/10 transition-colors"
          title="Extract Payload Code"
        >
          {copied ? <Check size={14} className="text-matrix-green" /> : <Copy size={14} />}
        </button>
      </div>
      <div className="bg-black p-2.5 rounded border border-cyber-blue/10 font-mono text-xs text-cyber-blue break-all selection:bg-cyber-blue selection:text-black">
        {payload}
      </div>
    </div>
  );
}
