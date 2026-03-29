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
        
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        audioCtxRef.current = audioCtx;
        
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
    <div className="min-h-screen flex flex-col bg-pitch-black selection:bg-aegis-red selection:text-pitch-black">
      {/* Header */}
      <header className="border-b border-aegis-red/30 p-4 flex items-center justify-between bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src="/logo.png" 
              alt="Devil Hunter Cyber Corps" 
              className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(255,49,49,0.9)]"
              referrerPolicy="no-referrer"
            />
            <motion.div 
              animate={{ 
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-aegis-red/40 blur-xl rounded-full -z-0"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-[0.2em] matrix-text">Cyber-LAB</h1>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('terminal')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded transition-all text-xs uppercase tracking-wider",
              activeTab === 'terminal' ? "bg-aegis-red/20 text-aegis-red border border-aegis-red/50" : "text-aegis-red/40 hover:text-aegis-red/70"
            )}
          >
            <TerminalIcon size={14} />
            Terminal
          </button>
          <button 
            onClick={() => setActiveTab('payloads')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded transition-all text-xs uppercase tracking-wider",
              activeTab === 'payloads' ? "bg-aegis-red/20 text-aegis-red border border-aegis-red/50" : "text-aegis-red/40 hover:text-aegis-red/70"
            )}
          >
            <Zap size={14} />
            Payloads
          </button>
        </div>
      </header>

      {/* API Error Banner */}
      <AnimatePresence>
        {apiError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-aegis-red/20 border-b border-aegis-red/50 p-3 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-aegis-red text-xs font-mono">
                  <Lock size={16} className="shrink-0" />
                  <span>{apiError}</span>
                </div>
                {apiDiagnostic?.maskedKey && apiDiagnostic.maskedKey !== "none" && (
                  <div className="text-[9px] text-aegis-red/60 font-mono ml-7 uppercase tracking-tighter">
                    CURRENT KEY: {apiDiagnostic.maskedKey}
                  </div>
                )}
              </div>
              <button 
                onClick={handleReverify}
                className="px-3 py-1 bg-aegis-red/20 border border-aegis-red/50 text-aegis-red rounded hover:bg-aegis-red/30 transition-all text-[10px] uppercase tracking-widest"
              >
                Re-Verify
              </button>
            </div>
            <button 
              onClick={() => setApiError(null)}
              className="text-aegis-red/60 hover:text-aegis-red transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full p-4 gap-4">
        
        {/* Status Tracker */}
        <div className="bg-black/40 border border-aegis-red/20 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-aegis-red/80">
            <div className="flex items-center gap-2">
              <Activity size={12} className="animate-pulse" />
              <span>{statusText}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Cpu size={12} />
                <span>CPU: 42%</span>
              </div>
              <div className="flex items-center gap-1">
                <Database size={12} />
                <span>MEM: 1.2GB</span>
              </div>
            </div>
          </div>
          <div className="h-1 bg-aegis-red/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-aegis-red shadow-[0_0_10px_#FF3131]"
            />
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden bg-black/20 border border-aegis-red/10 rounded-xl">
          <AnimatePresence mode="wait">
            {activeTab === 'terminal' ? (
              <motion.div 
                key="terminal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-aegis-red/20">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                      <Lock size={48} className="text-aegis-red" />
                      <div className="space-y-1">
                        <p className="text-lg font-bold matrix-text tracking-widest">SYSTEM SECURE</p>
                        <p className="text-xs">AWAITING COMMAND INPUT...</p>
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex flex-col gap-2",
                        msg.role === 'user' ? "items-end" : "items-start"
                      )}
                    >
                      <div className={cn(
                        "flex items-center gap-2 text-[10px] uppercase tracking-widest",
                        msg.role === 'user' ? "text-aegis-red/60" : "text-aegis-red"
                      )}>
                        {msg.role === 'user' ? 'OPERATOR' : 'CYBER-LAB'}
                      </div>
                      <div className={cn(
                        "max-w-[90%] p-4 rounded-lg border",
                        msg.role === 'user' 
                          ? "bg-aegis-red/5 border-aegis-red/20 text-[#E0E0E0]" 
                          : "bg-black/40 border-aegis-red/10 text-[#E0E0E0] markdown-body"
                      )}>
                        {msg.role === 'assistant' ? (
                          <>
                            <Markdown>{msg.content}</Markdown>
                            {isGenerating && i === messages.length - 1 && <span className="cursor-blink" />}
                          </>
                        ) : (
                          <p className="font-mono">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-aegis-red/20 bg-black/40">
                  {/* File Previews */}
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {attachedFiles.map(file => (
                        <div key={file.id} className="flex items-center gap-2 bg-aegis-red/10 border border-aegis-red/30 rounded px-2 py-1 text-[10px] text-aegis-red">
                          {file.mimeType.startsWith('image/') ? <ImageIcon size={10} /> : <FileText size={10} />}
                          <span className="max-w-[100px] truncate">{file.name}</span>
                          <button onClick={() => removeFile(file.id)} className="hover:text-white">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative neon-glow rounded-lg overflow-hidden border border-aegis-red/30 flex items-center bg-black/60">
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      multiple
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 text-aegis-red/60 hover:text-aegis-red transition-colors"
                      title="Attach Files"
                    >
                      <Paperclip size={18} />
                    </button>

                    <div className="flex items-center gap-1 px-2 border-r border-aegis-red/20">
                      <button 
                        onClick={toggleListening}
                        className={cn(
                          "p-2 rounded transition-all relative",
                          isListening ? "text-aegis-red animate-pulse bg-aegis-red/10" : "text-aegis-red/40 hover:text-aegis-red",
                          !voiceSupport && "opacity-30"
                        )}
                        title={!voiceSupport ? "Voice Input Not Supported" : (isListening ? "Stop Listening" : (useFallbackVoice ? "Universal Voice Input" : "Voice Input"))}
                      >
                        {!voiceSupport ? <MicOff size={16} /> : (isListening ? <Square size={16} /> : <Mic size={16} />)}
                        {useFallbackVoice && !isListening && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-aegis-red rounded-full animate-pulse" />
                        )}
                      </button>
                      {useFallbackVoice && (
                        <button 
                          onClick={() => {
                            setUseFallbackVoice(false);
                            setStatusText('NATIVE VOICE RESTORED');
                            setTimeout(() => setStatusText('SYSTEM IDLE'), 2000);
                          }}
                          className="p-2 text-aegis-red/40 hover:text-aegis-red transition-all"
                          title="Reset to Native Voice Input"
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
                          "p-2 rounded transition-all",
                          isTtsEnabled ? "text-aegis-red" : "text-aegis-red/20"
                        )}
                        title={isTtsEnabled ? "Disable Voice Output" : "Enable Voice Output"}
                      >
                        {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      </button>
                    </div>

                    <input 
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="ENTER COMMAND OR VULNERABILITY QUERY..."
                      className="flex-1 bg-transparent p-4 pl-0 text-aegis-red placeholder:text-aegis-red/30 outline-none font-mono text-sm"
                    />
                    <button 
                      onClick={() => handleSend()}
                      disabled={isGenerating || (!input.trim() && attachedFiles.length === 0)}
                      className="p-4 text-aegis-red hover:bg-aegis-red/10 rounded transition-colors disabled:opacity-30"
                    >
                      <Send size={18} />
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
                className="h-full p-6 overflow-y-auto"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="text-aegis-red" />
                  <h2 className="text-xl font-bold matrix-text tracking-widest">PAYLOAD GENERATOR</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {COMMON_PAYLOADS.map((p, i) => (
                    <PayloadCard key={i} name={p.name} payload={p.payload} />
                  ))}
                </div>

                <div className="mt-8 p-6 border border-aegis-red/20 rounded-lg bg-aegis-red/5">
                  <h3 className="text-aegis-red font-bold mb-2 flex items-center gap-2">
                    <Code size={16} />
                    CUSTOM PAYLOAD LOGIC
                  </h3>
                  <p className="text-xs text-aegis-red/60 leading-relaxed">
                    Cyber-Lab can generate advanced, obfuscated payloads for specific targets. 
                    Switch back to the Terminal and describe the target environment (e.g., "Generate a WAF-bypass XSS payload for a React-based application").
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-2 border-t border-aegis-red/10 flex justify-between items-center text-[8px] uppercase tracking-[0.2em] text-aegis-red/40">
        <div>SECURE UPLINK: ESTABLISHED</div>
        <div>ENCRYPTION: AES-256-GCM</div>
        <div>NODE: 0x7F000001</div>
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
    <div className="bg-black/60 border border-aegis-red/20 rounded-lg p-4 flex flex-col gap-3 hover:border-aegis-red/40 transition-colors group">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-aegis-red/80 uppercase tracking-widest">{name}</span>
        <button 
          onClick={handleCopy}
          className="text-aegis-red/40 hover:text-aegis-red transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="bg-black p-2 rounded border border-aegis-red/10 font-mono text-xs text-aegis-red break-all">
        {payload}
      </div>
    </div>
  );
}
