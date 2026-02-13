import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PowerBIEmbed } from "powerbi-client-react";
import { models } from "powerbi-client";
import { 
  tvPresentationService, 
  TVPresentation, 
  TVPresentationSlide 
} from "@/services/tvPresentationService";
import { getEmbedToken } from "@/services/powerBiApiService";
import { Button } from "@/components/ui/button";
import { Maximize, Minimize, ArrowLeft, Loader2, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function TVPresentationViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [presentation, setPresentation] = useState<(TVPresentation & { tv_presentation_slides: TVPresentationSlide[] }) | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentEmbedToken, setCurrentEmbedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const loadPresentation = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await tvPresentationService.getPresentation(id);
      if (data.tv_presentation_slides.length === 0) {
        toast.error("Esta apresentação não possui slides.");
        navigate("/tv-presentations");
        return;
      }
      setPresentation(data);
    } catch (error) {
      console.error("Erro ao carregar apresentação:", error);
      toast.error("Erro ao carregar apresentação");
      navigate("/tv-presentations");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPresentation();
  }, [loadPresentation]);

  const loadCurrentSlide = useCallback(async () => {
    if (!presentation || presentation.tv_presentation_slides.length === 0) return;
    
    const slide = presentation.tv_presentation_slides[currentSlideIndex];
    try {
      // Clear token and embed URL before loading new one to prevent cross-report issues
      setCurrentEmbedToken(null);
      
      const token = await getEmbedToken(slide.workspace_id, slide.report_id);
      setCurrentEmbedToken(token);
      setTimeLeft(slide.duration);
    } catch (error) {
      console.error("Erro ao carregar slide:", error);
      toast.error(`Erro ao carregar slide: ${slide.report_name}`);
      // Skip to next slide if error
      setTimeout(nextSlide, 3000);
    }
  }, [presentation, currentSlideIndex]);

  useEffect(() => {
    if (presentation) {
      loadCurrentSlide();
    }
  }, [presentation, currentSlideIndex, loadCurrentSlide]);

  const nextSlide = useCallback(() => {
    if (!presentation) return;
    setCurrentSlideIndex((prev) => (prev + 1) % presentation.tv_presentation_slides.length);
  }, [presentation]);

  const prevSlide = useCallback(() => {
    if (!presentation) return;
    setCurrentSlideIndex((prev) => (prev - 1 + presentation.tv_presentation_slides.length) % presentation.tv_presentation_slides.length);
  }, [presentation]);

  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying && presentation) {
      nextSlide();
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, timeLeft, presentation, nextSlide]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        toast.error(`Erro ao entrar em tela cheia: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-xl font-medium">Carregando apresentação...</p>
      </div>
    );
  }

  const currentSlide = presentation?.tv_presentation_slides[currentSlideIndex];

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black overflow-hidden relative group">
      {/* Controls Overlay - Hidden in fullscreen as per user request */}
      {!isFullscreen && (
        <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tv-published")} className="text-white hover:bg-white/10">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h2 className="text-white font-bold text-lg">{presentation?.name}</h2>
              <p className="text-white/60 text-sm">
                Slide {currentSlideIndex + 1} de {presentation?.tv_presentation_slides.length} - {currentSlide?.report_name} ({currentSlide?.page_display_name})
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-black/50 px-3 py-1 rounded-full text-white text-sm font-mono flex items-center gap-2">
              {timeLeft}s
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={prevSlide} 
                className="text-white hover:bg-white/10"
                title="Slide Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={nextSlide} 
                className="text-white hover:bg-white/10"
                title="Próximo Slide"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:bg-white/10">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10">
              {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      )}

      {/* Navigation arrows - Also hidden in fullscreen for a clean experience */}
       {!isFullscreen && (
         <>
           <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center z-40 opacity-0 group-hover:opacity-100 transition-opacity">
             <Button variant="ghost" size="icon" onClick={prevSlide} className="text-white/50 hover:text-white h-20 w-12 hover:bg-white/5">
               <ChevronLeft className="w-10 h-10" />
             </Button>
           </div>
           <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center z-40 opacity-0 group-hover:opacity-100 transition-opacity">
             <Button variant="ghost" size="icon" onClick={nextSlide} className="text-white/50 hover:text-white h-20 w-12 hover:bg-white/5">
               <ChevronRight className="w-10 h-10" />
             </Button>
           </div>
         </>
       )}

      {/* Embed Container */}
      <div className="h-full w-full">
        {currentEmbedToken && currentSlide && (
          <PowerBIEmbed
            key={`${currentSlide.id}-${currentSlideIndex}`} // Force reload on slide change
            embedConfig={{
              type: "report",
              id: currentSlide.report_id,
              embedUrl: currentSlide.embed_url || `https://app.powerbi.com/reportEmbed?reportId=${currentSlide.report_id}&groupId=${currentSlide.workspace_id}`,
              accessToken: currentEmbedToken,
              tokenType: models.TokenType.Embed,
              pageName: currentSlide.page_name,
              settings: {
                panes: {
                  filters: { visible: false, expanded: false },
                  pageNavigation: { visible: false }
                },
                navContentPaneEnabled: false,
                background: models.BackgroundType.Default,
                layoutType: models.LayoutType.Custom,
                customLayout: {
                  displayOption: models.DisplayOption.FitToPage
                }
              }
            }}
            cssClassName={"h-full w-full border-0"}
          />
        )}
      </div>
      
      {/* Progress Bar at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div 
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{ 
            width: `${((currentSlide?.duration || 1) - timeLeft) / (currentSlide?.duration || 1) * 100}%` 
          }}
        />
      </div>
    </div>
  );
}
