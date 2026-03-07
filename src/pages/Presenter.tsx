import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExcelViewer } from '@/components/ExcelViewer';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize, Minimize, Smartphone, ChevronLeft, ChevronRight, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Presenter() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('presentation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error("Error fetching session:", error);
        navigate('/');
        return;
      }
      setSession(data);
      setCurrentSlide(data.current_slide);
    };

    fetchSession();

    // Subscribe to changes with better error handling
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'presentation_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("Realtime update received:", payload);
          if (payload.new && typeof payload.new.current_slide === 'number') {
            setCurrentSlide(payload.new.current_slide);
            // Update session data in case files or total_slides changed
            setSession((prev: any) => ({ ...prev, ...payload.new }));
          }
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'CHANNEL_ERROR') {
          toast.error("Gagal menghubungkan ke server Realtime");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, navigate]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const updateSlideInDB = async (newIndex: number) => {
    if (!sessionId) return;
    const { error } = await supabase
      .from('presentation_sessions')
      .update({ current_slide: newIndex })
      .eq('id', sessionId);
    
    if (error) {
      toast.error("Gagal memperbarui slide di server");
    }
  };

  const nextSlide = () => {
    if (!session || currentSlide >= session.files.length - 1) return;
    const next = currentSlide + 1;
    setCurrentSlide(next); // Optimistic update
    updateSlideInDB(next);
  };

  const prevSlide = () => {
    if (!session || currentSlide <= 0) return;
    const prev = currentSlide - 1;
    setCurrentSlide(prev); // Optimistic update
    updateSlideInDB(prev);
  };

  if (!session) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  const currentFile = session.files[currentSlide];
  const remoteUrl = `${window.location.origin}/remote/${sessionId}`;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-8 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full flex items-center justify-center overflow-hidden"
          >
            {currentFile?.type === 'image' ? (
              <img
                src={currentFile.url}
                alt={currentFile.name}
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              />
            ) : currentFile ? (
              <div className="w-full h-full overflow-hidden flex flex-col">
                <ExcelViewer data={[currentFile.url]} />
              </div>
            ) : (
              <div className="text-white">Slide tidak ditemukan</div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Overlay */}
        <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={prevSlide} className="text-white bg-black/20 hover:bg-black/40 rounded-full w-12 h-12">
            <ChevronLeft className="w-8 h-8" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={nextSlide} className="text-white bg-black/20 hover:bg-black/40 rounded-full w-12 h-12">
            <ChevronRight className="w-8 h-8" />
          </Button>
        </div>
      </div>

      {/* Controls Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="bg-black/80 backdrop-blur-md border-t border-white/10 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <div className="text-sm font-medium text-white">
                  Slide {currentSlide + 1} of {session.total_slides}
                </div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
                  {isConnected ? (
                    <span className="text-green-400 flex items-center gap-1"><Wifi className="w-3 h-3" /> Live</span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1"><WifiOff className="w-3 h-3" /> Offline</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="group relative">
                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white gap-2">
                  <Smartphone className="w-4 h-4" />
                  Remote
                </Button>
                <div className="absolute bottom-full right-0 mb-4 p-4 bg-white rounded-xl shadow-2xl hidden group-hover:block">
                  <div className="text-black text-center space-y-2">
                    <QRCodeSVG value={remoteUrl} size={150} />
                    <p className="text-xs font-bold">Scan dengan HP</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleFullscreen} className="bg-white/5 border-white/10 text-white gap-2">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isFullscreen ? 'Exit' : 'Full'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="fixed bottom-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-all z-50"
      >
        {showControls ? <ChevronRight className="w-4 h-4 rotate-90" /> : <ChevronLeft className="w-4 h-4 rotate-90" />}
      </button>
    </div>
  );
}