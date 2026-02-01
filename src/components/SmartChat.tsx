import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Loader2, 
  User, 
  Bot, 
  Trash2,
  ChevronDown,
  Volume2,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: number;
  type: 'text' | 'audio';
  audioUrl?: string;
}

interface WebhookResponse {
  output?: string;
  text?: string;
  message?: string;
  [key: string]: string | number | boolean | undefined | null | object;
}

// --- Constants ---
const WEBHOOK_URL = 'https://n8n-n8n.j6kpgx.easypanel.host/webhook/euro';
const STORAGE_KEY = 'euro_chat_history';
const SESSION_KEY = 'euro_chat_session_id';

// --- Audio Player Component ---
const AudioPlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Reset if ended
        if (audioRef.current.ended) audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.error("Error playing audio:", err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Generate a fake waveform for visual effect
  const bars = [3, 5, 8, 4, 6, 9, 5, 7, 4, 8, 6, 3, 5, 7, 4, 6];

  return (
    <div className="flex items-center gap-3 bg-black/5 p-2 rounded-xl min-w-[220px]">
      <button 
        onClick={togglePlay}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white hover:scale-105 transition-transform shrink-0"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex items-center gap-0.5 h-8">
        {bars.map((height, i) => {
          const barProgress = (i / bars.length) * 100;
          const isActive = progress > barProgress;
          return (
            <div 
              key={i}
              className={cn(
                "flex-1 rounded-full transition-all duration-300",
                isActive ? "bg-black" : "bg-black/20"
              )}
              style={{ height: `${height * 10}%` }}
            />
          );
        })}
      </div>
      
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <span className="text-[10px] font-bold text-black/40 min-w-[30px]">
        {audioRef.current?.duration ? 
          `${Math.floor(audioRef.current.duration / 60)}:${Math.floor(audioRef.current.duration % 60).toString().padStart(2, '0')}` 
          : '0:00'
        }
      </span>
    </div>
  );
};

// --- Text Formatter ---
const formatText = (text: string) => {
  // Bold: **text**
  const formatted = text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });

  // Handle QuickChart/Images: ![alt](url)
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  const parts: (string | JSX.Element)[] = [];
  
  // This is a simplified version, for a more robust one we could use a library
  // or a more complex mapping.
  return formatted.map((item, idx) => {
    if (typeof item !== 'string') return item;
    
    const subParts = item.split(imageRegex);
    if (subParts.length === 1) return item;

    const elements = [];
    for (let i = 0; i < subParts.length; i++) {
      if (i % 3 === 0) {
        elements.push(subParts[i]);
      } else if (i % 3 === 1) {
        // Alt text, skip for now or use in img
      } else {
        // URL
        elements.push(
          <div key={`${idx}-${i}`} className="my-2 rounded-lg overflow-hidden border border-border">
            <img src={subParts[i]} alt="Chart" className="max-w-full h-auto" />
          </div>
        );
      }
    }
    return <span key={idx}>{elements}</span>;
  });
};

// --- Main Chat Component ---
export const SmartChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Session and Load History
  useEffect(() => {
    // Session ID
    let storedSessionId = localStorage.getItem(SESSION_KEY);
    if (!storedSessionId) {
      storedSessionId = typeof crypto.randomUUID === 'function' 
        ? crypto.randomUUID() 
        : `session_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(SESSION_KEY, storedSessionId);
    }
    setSessionId(storedSessionId);

    // History
    const storedHistory = localStorage.getItem(STORAGE_KEY);
    if (storedHistory) {
      try {
        setMessages(JSON.parse(storedHistory));
      } catch (e) {
        console.error('Error parsing chat history', e);
      }
    }
  }, []);

  // Sync History to LocalStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to Bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // --- Handlers ---

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: Date.now(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          tipo: 'text',
          chatInput: userMessage.content,
          session: sessionId,
          base64: null
        }])
      });

      const data = await response.json();
      processBotResponse(data);
    } catch (error) {
      console.error('Error sending message:', error);
      addBotMessage('Desculpe, ocorreu um erro ao processar sua mensagem. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  const processBotResponse = (data: WebhookResponse | WebhookResponse[]) => {
    let content = '';
    
    // Support for different response formats from n8n
    if (Array.isArray(data)) {
      const first = data[0];
      content = first?.output || first?.text || first?.message || (first ? JSON.stringify(first) : '');
    } else if (typeof data === 'object' && data !== null) {
      content = data.output || data.text || data.message || JSON.stringify(data);
    } else if (typeof data === 'string') {
      content = data;
    }

    addBotMessage(content || 'Não recebi uma resposta válida do servidor.');
  };

  const addBotMessage = (content: string) => {
    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      content,
      sender: 'bot',
      timestamp: Date.now(),
      type: 'text'
    };
    setMessages(prev => [...prev, botMessage]);
  };

  const clearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar o histórico de conversas?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // --- Audio Logic ---

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const base64Audio = await blobToBase64(audioBlob);
        
        handleSendAudio(audioUrl, base64Audio);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSendAudio = async (audioUrl: string, base64Data: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content: 'Mensagem de áudio',
      sender: 'user',
      timestamp: Date.now(),
      type: 'audio',
      audioUrl
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          tipo: 'audio',
          chatInput: '',
          session: sessionId,
          base64: base64Data
        }])
      });

      const data = await response.json();
      processBotResponse(data);
    } catch (error) {
      console.error('Error sending audio:', error);
      addBotMessage('Erro ao enviar o áudio. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto bg-background border border-border rounded-xl shadow-xl overflow-hidden glass-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Euro Inteligente</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online • Converse com seus dados</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearHistory}
          className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
          title="Limpar histórico"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-primary/20">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Bot size={32} />
            </div>
            <div className="max-w-xs">
              <p className="font-medium">Como posso ajudar você hoje?</p>
              <p className="text-sm">Tente perguntar sobre projetos, atividades ou status de investimentos.</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex w-full gap-3",
                msg.sender === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                msg.sender === 'user' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              
              <div className={cn(
                "max-w-[80%] space-y-1",
                msg.sender === 'user' ? "items-end" : "items-start"
              )}>
                <div className={cn(
                  "p-3 rounded-2xl shadow-sm",
                  msg.sender === 'user' 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-muted text-foreground rounded-tl-none border border-border"
                )}>
                  {msg.type === 'audio' && msg.audioUrl ? (
                    <AudioPlayer url={msg.audioUrl} />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {formatText(msg.content)}
                    </div>
                  )}
                </div>
                <span className="text-[10px] opacity-50 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
              <Bot size={16} />
            </div>
            <div className="bg-muted p-3 rounded-2xl rounded-tl-none border border-border shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-background/50 backdrop-blur-sm">
        <form 
          onSubmit={handleSendMessage}
          className="relative flex items-end gap-2 max-w-4xl mx-auto"
        >
          <div className="relative flex-1 group">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Digite sua mensagem..."
              className="w-full bg-muted border border-border rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all group-hover:border-primary/30"
              style={{ maxHeight: '150px' }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  "p-2 rounded-full transition-all",
                  isRecording 
                    ? "bg-red-500 text-white animate-pulse scale-110" 
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
                title={isRecording ? "Parar gravação" : "Clique para gravar"}
              >
                {isRecording ? <Square size={20} /> : <Mic size={20} />}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              "p-3 rounded-2xl transition-all shadow-lg",
              inputValue.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:opacity-90 scale-100"
                : "bg-muted text-muted-foreground scale-95 opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
        <p className="text-[10px] text-center mt-2 text-muted-foreground opacity-60">
          Pressione Enter para enviar • Shift + Enter para nova linha
        </p>
      </div>
    </div>
  );
};

export default SmartChat;
