import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Loader2, 
  User as UserIcon, 
  Bot, 
  Trash2,
  ChevronDown,
  Volume2,
  Image as ImageIcon,
  MessageSquarePlus,
  ArrowLeft,
  HelpCircle,
  Info,
  TrendingUp,
  Target,
  Trophy,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
const AudioPlayer = ({ url, highlight = false }: { url?: string; highlight?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!url) return;
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    if (audio.readyState >= 1) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        if (audioRef.current.ended) audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.error("Error playing audio:", err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate a fake waveform for visual effect
  const bars = [3, 5, 8, 4, 6, 9, 5, 7, 4, 8, 6, 3, 5, 7, 4, 6];

  if (!url) {
    return (
      <div className="flex items-center gap-2 p-2 text-[10px] text-muted-foreground italic">
        <Volume2 size={14} />
        Áudio expirado nesta sessão
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-xl min-w-[220px]",
      highlight 
        ? "bg-white/10 backdrop-blur-sm border border-white/10 shadow-inner" 
        : "bg-black/5"
    )}>
      <button 
        onClick={togglePlay}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full hover:scale-105 transition-transform shrink-0 shadow-sm",
          highlight ? "bg-white text-black" : "bg-black text-white"
        )}
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
                isActive 
                  ? (highlight ? "bg-white" : "bg-black") 
                  : (highlight ? "bg-white/20" : "bg-black/20")
              )}
              style={{ height: `${height * 10}%` }}
            />
          );
        })}
      </div>
      
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      <span className={cn(
        "text-[10px] font-bold min-w-[30px]",
        highlight ? "text-white/60" : "text-black/40"
      )}>
        {formatTime(duration)}
      </span>
    </div>
  );
};

// --- Text Formatter ---
const formatText = (text: string) => {
  // Bold: **text**
  const withBold = text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`bold-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });

  // Italic: _text_ or *text*
  const withItalic = withBold.flatMap((item, i) => {
    if (typeof item !== 'string') return [item];
    
    return item.split(/(_.*?_|\*.*?\*)/g).map((part, j) => {
      if ((part.startsWith('_') && part.endsWith('_')) || (part.startsWith('*') && part.endsWith('*'))) {
        return <em key={`italic-${i}-${j}`}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  });

  // Handle QuickChart/Images: ![alt](url)
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  
  const withImages = withItalic.flatMap((item, idx) => {
    if (typeof item !== 'string') return [item];
    
    const subParts = item.split(imageRegex);
    if (subParts.length === 1) return [item];

    const elements = [];
    for (let i = 0; i < subParts.length; i++) {
      if (i % 3 === 0) {
        if (subParts[i]) elements.push(subParts[i]);
      } else if (i % 3 === 1) {
        // Alt text
      } else {
        // URL
        elements.push(
          <div key={`img-${idx}-${i}`} className="my-2 rounded-lg overflow-hidden border border-border bg-white/5">
            <img src={subParts[i]} alt="Chart" className="max-w-full h-auto" />
          </div>
        );
      }
    }
    return elements;
  });

  // Handle Links: [text](url) or plain URLs
  const linkRegex = /\[(.*?)\]\((.*?)\)/g;
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return withImages.flatMap((item, idx) => {
    if (typeof item !== 'string') return [item];

    // First handle Markdown links [text](url)
    const markdownLinkParts = item.split(linkRegex);
    if (markdownLinkParts.length > 1) {
      const elements = [];
      for (let i = 0; i < markdownLinkParts.length; i++) {
        if (i % 3 === 0) {
          // Recursive check for plain URLs in non-markdown-link text
          if (markdownLinkParts[i]) {
            const plainUrlParts = markdownLinkParts[i].split(urlRegex);
            plainUrlParts.forEach((p, j) => {
              if (p.match(urlRegex)) {
                elements.push(<a key={`link-p-${idx}-${i}-${j}`} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{p}</a>);
              } else if (p) {
                elements.push(p);
              }
            });
          }
        } else if (i % 3 === 1) {
          // Link text
        } else {
          // URL
          const linkText = markdownLinkParts[i-1];
          const url = markdownLinkParts[i];
          elements.push(<a key={`link-m-${idx}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{linkText}</a>);
        }
      }
      return elements;
    }

    // Then handle plain URLs if no markdown links were found
    const plainUrlParts = item.split(urlRegex);
    if (plainUrlParts.length > 1) {
      return plainUrlParts.map((p, i) => {
        if (p.match(urlRegex)) {
          return <a key={`link-plain-${idx}-${i}`} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{p}</a>;
        }
        return p;
      });
    }

    return [item];
  });
};

// --- Main Chat Component ---
export const SmartChat: React.FC<{ fullHeight?: boolean }> = ({ fullHeight }) => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>('');
  const [userCodigo, setUserCodigo] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{ url: string; base64: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestionButtons = [
    { label: "Quanto estou de repasse?", query: `Qual o meu repasse atual?` },
    { label: "Me mande o extrato detalhado do meu repasse.", query: `Me mande o extrato detalhado do meu repasse.` },
    { label: "Qual meu ROA?", query: `Qual o meu ROA.` },
    { label: "Quantos clientes tenho e qual o meu net?", query: `Quantos clientes e qual o meu net?'}` },
  ];

  // Initialize Session and Load History
  useEffect(() => {
    // Load User Profile Name and Avatar
    const loadProfile = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from("projects_profiles")
          .select("first_name, last_name, profile_image_url, codigo")
          .eq("id", user.id)
          .single();
        
        if (data) {
          setUserName(`${data.first_name || ""} ${data.last_name || ""}`.trim());
          setUserAvatar(data.profile_image_url);
          setUserCodigo(data.codigo || "");
        }
      }
    };
    loadProfile();

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
        const parsedMessages: Message[] = JSON.parse(storedHistory);
        // Remove blob URLs that are no longer valid across sessions
        const cleanedMessages = parsedMessages.map(msg => {
          if (msg.type === 'audio' && msg.audioUrl?.startsWith('blob:')) {
            return { ...msg, audioUrl: undefined };
          }
          return msg;
        });
        setMessages(cleanedMessages);
      } catch (e) {
        console.error('Error parsing chat history', e);
      }
    }
  }, [user?.id]);

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

  const handleSendMessage = async (e?: React.FormEvent, customContent?: string, displayContent?: string) => {
    if (e) e.preventDefault();
    
    const contentToSend = customContent || inputValue;
    const contentToDisplay = displayContent || contentToSend;

    if (!contentToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: contentToDisplay,
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
          chatInput: contentToSend,
          session: sessionId,
          base64: null,
          role: userRole,
          codigo: userCodigo
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
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    
    // Generate a new session ID to truly "clear the session"
    const newSessionId = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : `session_${Math.random().toString(36).substring(2, 15)}`;
    
    setSessionId(newSessionId);
    localStorage.setItem(SESSION_KEY, newSessionId);
    setIsDeleteDialogOpen(false);
  };

  const handleSendRecordedAudio = () => {
    if (recordedAudio) {
      handleSendAudio(recordedAudio.url, recordedAudio.base64);
      setRecordedAudio(null);
    }
  };

  const discardRecordedAudio = () => {
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
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
        
        setRecordedAudio({ url: audioUrl, base64: base64Audio });
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
          base64: base64Data,
          role: userRole,
          codigo: userCodigo
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
    <div className={cn(
      "flex flex-col bg-background/20 border-border overflow-hidden glass-card backdrop-blur-sm",
      fullHeight 
        ? "h-screen w-full border-0 rounded-none" 
        : "h-[calc(100vh-120px)] max-w-4xl mx-auto border rounded-xl shadow-xl"
    )}>
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
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsGuideOpen(true)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
            title="Como usar o Agente Eurostock"
          >
            <HelpCircle size={20} />
          </button>
          <button 
            onClick={() => navigate("/")}
            className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
            title="Voltar para o início"
          >
            <ArrowLeft size={20} />
          </button>
          <button 
            onClick={() => setIsDeleteDialogOpen(true)}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
            title="Limpar histórico e nova sessão"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Histórico de Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará todas as mensagens atuais e iniciará uma nova sessão de conversa. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={clearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar e Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="glass-card border-border w-[95vw] sm:max-w-2xl h-[90vh] sm:h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="p-5 sm:p-6 pb-2 shrink-0 border-b border-border/50">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gradient-cyan">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Guia do Agente Eurostock
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Sua Inteligência Comercial na Palma da Mão! 🚀🧉
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 w-full">
            <div className="p-5 sm:p-6 space-y-5 sm:space-y-6">
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                O Agente Eurostock é seu novo assistente de IA pronto para revolucionar a forma como você acessa seus dados. Chega de perder tempo procurando planilhas!
              </p>

              <div className="grid gap-3 sm:gap-4">
                {/* Performance Section */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors">
                  <div className="flex items-center gap-2 mb-3 text-primary">
                    <TrendingUp className="w-5 h-5" />
                    <h3 className="text-sm sm:text-base font-bold">Performance Pessoal e Financeira</h3>
                  </div>
                  <ul className="text-xs sm:text-sm space-y-2 text-muted-foreground ml-7 list-disc">
                    <li><strong className="text-foreground">Resumo Completo:</strong> Receita Total, Repasse 💰, Custódia e Captação Líquida.</li>
                    <li><strong className="text-foreground">Detalhamento:</strong> Bolsa, Renda Fixa, Fundos, Seguros, Consórcios, Previdência e Estruturados.</li>
                    <li><strong className="text-foreground">Banking:</strong> Receitas de Câmbio e Compromissadas.</li>
                    <li><strong className="text-foreground">Base e ROA:</strong> Clientes ativos e Retorno sobre Ativos em %.</li>
                  </ul>
                </div>

                {/* Planning Section */}
                <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10 hover:bg-cyan-500/10 transition-colors">
                  <div className="flex items-center gap-2 mb-3 text-cyan-400">
                    <Target className="w-5 h-5" />
                    <h3 className="text-sm sm:text-base font-bold">Metas e Planejamento (FP)</h3>
                  </div>
                  <ul className="text-xs sm:text-sm space-y-2 text-muted-foreground ml-7 list-disc">
                    <li><strong className="text-foreground">Financial Planning:</strong> Acompanhe em tempo real seu realizado vs. meta.</li>
                    <li><strong className="text-foreground">Status:</strong> O agente calcula quanto falta (%) para bater a meta do mês.</li>
                  </ul>
                </div>

                {/* Ranking Section */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors">
                  <div className="flex items-center gap-2 mb-3 text-primary">
                    <Trophy className="w-5 h-5" />
                    <h3 className="text-sm sm:text-base font-bold">Super Ranking (SR)</h3>
                  </div>
                  <ul className="text-xs sm:text-sm space-y-2 text-muted-foreground ml-7 list-disc">
                    <li><strong className="text-foreground">Posição:</strong> Descubra sua posição exata no mês e no acumulado do ano.</li>
                    <li><strong className="text-foreground">Pontuação:</strong> Captação, ROA, Ativação (300k/1MM) e Líder.</li>
                    <li><strong className="text-foreground">Times e Clusters:</strong> Veja quem está liderando a corrida!</li>
                  </ul>
                </div>

                {/* Privacy Section */}
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
                  <div className="flex items-center gap-2 mb-3 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="text-sm sm:text-base font-bold">Privacidade e Segurança</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground ml-7">
                    Seus dados financeiros são <strong className="text-foreground">confidenciais</strong>. Você só vê seus próprios números. O Super Ranking (SR) é aberto para incentivar a disputa saudável!
                  </p>
                </div>
              </div>

              <div className="space-y-3 pb-6">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Como usar? É só chamar!
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    "Qual meu repasse este mês?",
                    "Como estou no SR?",
                    "Qual minha meta de FP?",
                    "Resumo do meu mês"
                  ].map((q, i) => (
                    <div key={i} className="text-xs p-2.5 rounded-lg bg-muted border border-border italic text-muted-foreground">
                      "{q}"
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-primary/20">
        <div className={cn(
          "space-y-4 mx-auto",
          fullHeight ? "max-w-6xl" : "max-w-4xl"
        )}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-250px)] text-center space-y-6 opacity-90">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
              <Bot size={32} />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-bold text-foreground">
                Olá, {userName || user?.email?.split('@')[0] || 'Assessor'}! 👋
              </h3>
              <p className="text-sm text-muted-foreground">
                Sou seu assistente financeiro. Posso te ajudar com informações sobre seus repasses, ROA, net e clientes.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
              {suggestionButtons.map((btn, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(undefined, btn.query, btn.label)}
                  className="flex items-center gap-3 p-3 text-left text-sm bg-muted/50 hover:bg-primary/10 border border-border rounded-xl transition-all group hover:border-primary/30"
                >
                  <MessageSquarePlus size={18} className="text-primary shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">{btn.label}</span>
                </button>
              ))}
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
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 overflow-hidden",
                msg.sender === 'user' ? "bg-primary" : "bg-muted"
              )}>
                {msg.sender === 'user' ? (
                  userAvatar ? (
                    <img src={userAvatar} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon size={16} className="text-primary-foreground" />
                  )
                ) : (
                  <Bot size={16} className="text-muted-foreground" />
                )}
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
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-background/50 backdrop-blur-sm">
        {recordedAudio ? (
          <div className={cn(
            "flex items-center gap-4 mx-auto animate-in fade-in slide-in-from-bottom-2",
            fullHeight ? "max-w-6xl" : "max-w-4xl"
          )}>
            <div className="flex-1">
              <AudioPlayer url={recordedAudio.url} highlight />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={discardRecordedAudio}
                className="p-3 rounded-2xl bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                title="Descartar áudio"
              >
                <Trash2 size={20} />
              </button>
              <button
                onClick={handleSendRecordedAudio}
                className="p-3 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 shadow-lg transition-all"
                title="Enviar áudio"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        ) : (
          <form 
            onSubmit={handleSendMessage}
            className={cn(
              "relative flex items-center gap-2 mx-auto",
              fullHeight ? "max-w-6xl" : "max-w-4xl"
            )}
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
                className="w-full bg-muted border border-border rounded-2xl px-4 py-3 pr-12 min-h-[52px] flex items-center focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none transition-all group-hover:border-primary/30"
                style={{ maxHeight: '150px' }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                "w-[52px] h-[52px] flex items-center justify-center rounded-2xl transition-all shadow-lg shrink-0",
                inputValue.trim() && !isLoading
                  ? "bg-primary text-primary-foreground hover:opacity-90 scale-100"
                  : "bg-muted text-muted-foreground scale-95 opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>
        )}
        <p className="text-[10px] text-center mt-2 text-muted-foreground opacity-60">
          {recordedAudio ? "Revise seu áudio antes de enviar" : "Pressione Enter para enviar • Shift + Enter para nova linha"}
        </p>
      </div>
    </div>
  );
};

export default SmartChat;
