import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExcelViewer } from '@/components/ExcelViewer';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, ChevronLeft, ChevronRight, X, Wifi, WifiOff, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Presenter() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('presentation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        navigate('/');
        return;
      }
      setSession(data);
      setCurrentSlide(data.current_slide);
      setCurrentSheet(data.current_sheet || 0);
    };

    fetchSession();

    const channel = supabase
      .channel(`presentation-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'presentation_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new) {
            if (typeof payload.new.current_slide === 'number') {
              setCurrentSlide(payload.new.current_slide);
              setZoomLevel(1);
            }
            if (typeof payload.new.current_sheet === 'number') setCurrentSheet(payload.new.current_sheet);
            setSession((prev: any) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .on('broadcast', { event: 'SCROLL' }, (payload) => {
        const scrollArea = document.getElementById('excel-scroll-area');
        if (scrollArea) {
          const scrollAmount = 300; 
          if (payload.payload.direction === 'down') {
            scrollArea.scrollBy({ top: scrollAmount, behavior: 'smooth' });
          } else {
            scrollArea.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
          }
        }
      })
      .on('broadcast', { event: 'ZOOM' }, (payload) => {
        setZoomLevel(prev => {
          if (payload.payload.direction === 'reset') return 1;
          if (payload.payload.direction === 'in') return Math.min(prev + 0.25, 3);
          return Math.max(prev - 0.25, 1);
        });
      })
      .on('broadcast', { event: 'FULLSCREEN' }, (payload) => {
        if (payload.payload.action === 'enter') {
          document.documentElement.requestFullscreen().catch(e => console.error(e));
        } else {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(e => console.error(e));
          }
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [sessionId, navigate]);

  const updateDB = async (updates: any) => {
    if (!sessionId) return;
    await supabase.from('presentation_sessions').update(updates).eq('id', sessionId);
  };

  const nextSlide = () => {
    if (!session || currentSlide >= session.files.length - 1) return;
    const next = currentSlide + 1;
    setCurrentSlide(next);
    setCurrentSheet(0);
    setZoomLevel(1);
    updateDB({ current_slide: next, current_sheet: 0 });
  };

  const prevSlide = () => {
    if (!session || currentSlide <= 0) return;
    const prev = currentSlide - 1;
    setCurrentSlide(prev);
    setCurrentSheet(0);
    setZoomLevel(1);
    updateDB({ current_slide: prev, current_sheet: 0 });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (!session) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  const currentFile = session.files[currentSlide];
  const remoteUrl = `${window.location.origin}/remote/${sessionId}`;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-8 min-h-0 overflow-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentSlide}-${currentSheet}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center"
          >
            {currentFile?.type === 'image' ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-auto custom-scrollbar">
                <img 
                  src={currentFile.url} 
                  alt={currentFile.name} 
                  style={{ 
                    transform: `scale(${zoomLevel})`,
                    transition: 'transform 0.2s ease-out',
                    transformOrigin: 'center center'
                  }}
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
                />
              </div>
            ) : currentFile ? (
              <div className="w-full h-full overflow-hidden flex flex-col">
                <ExcelViewer data={[currentFile.url]} activeSheetIndex={currentSheet} />
              </div>
            ) : (
              <div className="text-white">Slide tidak ditemukan</div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10">
          <Button variant="ghost" size="icon" onClick={prevSlide} className="text-white bg-black/20 hover:bg-black/40 rounded-full w-12 h-12">
            <ChevronLeft className="w-8 h-8" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10">
          <Button variant="ghost" size="icon" onClick={nextSlide} className="text-white bg-black/20 hover:bg-black/40 rounded-full w-12 h-12">
            <ChevronRight className="w-8 h-8" />
          </Button>
        </div>
      </div>

      {!isFullscreen && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-black/80 backdrop-blur-md border-t border-white/10 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></Button>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-white">Slide {currentSlide + 1} of {session.total_slides}</div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
                {isConnected ? <span className="text-green-400 flex items-center gap-1"><Wifi className="w-3 h-3" /> Live</span> : <span className="text-red-400 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>}
                {zoomLevel > 1 && <span className="text-blue-400 ml-2">Zoom: {zoomLevel}x</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-gray-400 hover:text-white mr-2">
              <Maximize className="w-5 h-5" />
            </Button>
            <div className="group relative">
              <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white gap-2"><Smartphone className="w-4 h-4" /> Remote</Button>
              <div className="absolute bottom-full right-0 mb-4 p-4 bg-white rounded-xl shadow-2xl hidden group-hover:block"><QRCodeSVG value={remoteUrl} size={150} /></div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}