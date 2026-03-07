import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ExcelViewer } from '@/components/ExcelViewer';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize, Minimize, Smartphone, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Presenter() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showControls, setShowControls] = useState(true);
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
        console.error(error);
        navigate('/');
        return;
      }
      setSession(data);
      setCurrentSlide(data.current_slide);
    };

    fetchSession();

    // Subscribe to changes
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
          setCurrentSlide(payload.new.current_slide);
        }
      )
      .subscribe();

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

  const nextSlide = async () => {
    if (!session || currentSlide >= session.files.length - 1) return;
    const next = currentSlide + 1;
    await supabase
      .from('presentation_sessions')
      .update({ current_slide: next })
      .eq('id', sessionId);
  };

  const prevSlide = async () => {
    if (!session || currentSlide <= 0) return;
    const prev = currentSlide - 1;
    await supabase
      .from('presentation_sessions')
      .update({ current_slide: prev })
      .eq('id', sessionId);
  };

  if (!session) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  const currentFile = session.files[currentSlide];
  const remoteUrl = `${window.location.origin}/remote/${sessionId}`;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex flex-col">
      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full flex items-center justify-center"
          >
            {currentFile.type === 'image' ? (
              <img
                src={currentFile.content}
                alt={currentFile.name}
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              />
            ) : (
              <ExcelViewer data={currentFile.content} />
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
              <div className="text-sm font-medium text-gray-400">
                Slide {currentSlide + 1} of {session.total_slides}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="group relative">
                <Button variant="outline" size="sm" className="bg-white/5 border-white/10 text-white gap-2">
                  <Smartphone className="w-4 h-4" />
                  Remote Control
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
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
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
