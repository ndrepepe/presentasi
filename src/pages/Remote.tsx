import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Smartphone, RefreshCw, Wifi, WifiOff, Layers, FileSpreadsheet, ChevronUp, ChevronDown, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Remote() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentSheet, setCurrentSheet] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('presentation_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        toast.error("Sesi tidak ditemukan");
        return;
      }
      setSession(data);
      setCurrentSlide(data.current_slide);
      setCurrentSheet(data.current_sheet || 0);
      setIsLoading(false);
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
            if (typeof payload.new.current_slide === 'number') setCurrentSlide(payload.new.current_slide);
            if (typeof payload.new.current_sheet === 'number') setCurrentSheet(payload.new.current_sheet);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const updateSlide = async (newIndex: number) => {
    if (!session || newIndex < 0 || newIndex >= session.total_slides) return;
    setCurrentSlide(newIndex);
    setCurrentSheet(0);
    await supabase.from('presentation_sessions').update({ current_slide: newIndex, current_sheet: 0 }).eq('id', sessionId);
  };

  const updateSheet = async (newSheetIndex: number) => {
    const currentFile = session.files[currentSlide];
    if (!currentFile || !currentFile.sheetCount || newSheetIndex < 0 || newSheetIndex >= currentFile.sheetCount) return;
    setCurrentSheet(newSheetIndex);
    await supabase.from('presentation_sessions').update({ current_sheet: newSheetIndex }).eq('id', sessionId);
  };

  const sendScroll = (direction: 'up' | 'down') => {
    if (channelRef.current && isConnected) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'SCROLL',
        payload: { direction }
      });
    } else {
      toast.error("Tidak terhubung ke presenter");
    }
  };

  const sendZoom = (direction: 'in' | 'out') => {
    if (channelRef.current && isConnected) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'ZOOM',
        payload: { direction }
      });
    } else {
      toast.error("Tidak terhubung ke presenter");
    }
  };

  const sendFullscreen = (action: 'enter' | 'exit') => {
    if (channelRef.current && isConnected) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'FULLSCREEN',
        payload: { action }
      });
      toast.success(action === 'enter' ? "Masuk Layar Penuh" : "Keluar Layar Penuh");
    } else {
      toast.error("Tidak terhubung ke presenter");
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white p-6"><RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" /><p>Menghubungkan...</p></div>;

  const currentFile = session.files[currentSlide];
  const isExcel = currentFile?.type === 'excel';
  const isImage = currentFile?.type === 'image';
  const hasMultipleSheets = isExcel && (currentFile.sheetCount || 0) > 1;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-6 select-none">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2"><Smartphone className="w-6 h-6 text-blue-400" /><h1 className="font-bold text-xl">Remote</h1></div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />} {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium">{currentSlide + 1} / {session.total_slides}</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center gap-6">
        {/* Fullscreen Controls */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="bg-white/5 border-white/10 h-12 rounded-xl text-xs gap-2 active:scale-95 transition-transform"
            onClick={() => sendFullscreen('exit')}
          >
            <Minimize className="w-4 h-4" /> Close FS
          </Button>
          <Button 
            variant="outline" 
            className="bg-purple-600/20 border-purple-500/30 hover:bg-purple-600/30 h-12 rounded-xl text-xs gap-2 text-purple-400 active:scale-95 transition-transform"
            onClick={() => sendFullscreen('enter')}
          >
            <Maximize className="w-4 h-4" /> Full Screen
          </Button>
        </div>

        <div className="aspect-video bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center overflow-hidden relative shadow-2xl">
          {isExcel ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-300 truncate max-w-[200px]">{currentFile.name}</p>
                <p className="text-[10px] text-green-400 uppercase tracking-widest mt-1">
                  Sheet {currentSheet + 1} of {currentFile.sheetCount}
                </p>
              </div>
            </div>
          ) : (
            <>
              <img src={currentFile?.url} className="w-full h-full object-contain opacity-30 blur-[2px]" alt="Preview" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl font-black text-white/80">{currentSlide + 1}</span>
              </div>
            </>
          )}
        </div>

        {isImage && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <ZoomIn className="w-3 h-3" />
              <p className="text-[10px] uppercase tracking-widest font-bold">Zoom Gambar</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="bg-white/5 border-white/10 h-14 rounded-2xl text-xs gap-2 active:scale-95 transition-transform"
                onClick={() => sendZoom('out')}
              >
                <ZoomOut className="w-5 h-5" /> Zoom Out
              </Button>
              <Button 
                variant="outline" 
                className="bg-blue-600/20 border-blue-500/30 hover:bg-blue-600/30 h-14 rounded-2xl text-xs gap-2 text-blue-400 active:scale-95 transition-transform"
                onClick={() => sendZoom('in')}
              >
                <ZoomIn className="w-5 h-5" /> Zoom In
              </Button>
            </div>
          </div>
        )}

        {isExcel && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <ChevronDown className="w-3 h-3" />
              <p className="text-[10px] uppercase tracking-widest font-bold">Scroll Halaman</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="bg-white/5 border-white/10 h-14 rounded-2xl text-xs gap-2 active:scale-95 transition-transform"
                onClick={() => sendScroll('up')}
              >
                <ChevronUp className="w-5 h-5" /> Scroll Up
              </Button>
              <Button 
                variant="outline" 
                className="bg-white/5 border-white/10 h-14 rounded-2xl text-xs gap-2 active:scale-95 transition-transform"
                onClick={() => sendScroll('down')}
              >
                <ChevronDown className="w-5 h-5" /> Scroll Down
              </Button>
            </div>
          </div>
        )}

        {hasMultipleSheets && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Layers className="w-3 h-3" />
              <p className="text-[10px] uppercase tracking-widest font-bold">Navigasi Sheet</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="bg-white/5 border-white/10 h-14 rounded-2xl text-xs gap-2 active:scale-95 transition-transform"
                onClick={() => updateSheet(currentSheet - 1)}
                disabled={currentSheet === 0}
              >
                <ChevronLeft className="w-4 h-4" /> Prev Sheet
              </Button>
              <Button 
                variant="outline" 
                className="bg-green-600/20 border-green-500/30 hover:bg-green-600/30 h-14 rounded-2xl text-xs gap-2 text-green-400 active:scale-95 transition-transform"
                onClick={() => updateSheet(currentSheet + 1)}
                disabled={currentSheet === (currentFile.sheetCount || 1) - 1}
              >
                Next Sheet <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Smartphone className="w-3 h-3" />
            <p className="text-[10px] uppercase tracking-widest font-bold">Navigasi Slide</p>
          </div>
          <div className="grid grid-cols-2 gap-4 h-40">
            <Button 
              variant="outline" 
              className="h-full bg-white/5 border-white/10 rounded-[2rem] flex flex-col gap-3 active:scale-95 transition-transform" 
              onClick={() => updateSlide(currentSlide - 1)} 
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="w-12 h-12 text-gray-400" />
              <span className="font-bold text-xs tracking-widest">PREV</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-full bg-blue-600 hover:bg-blue-500 border-none rounded-[2rem] flex flex-col gap-3 shadow-lg shadow-blue-600/20 active:scale-95 transition-transform" 
              onClick={() => updateSlide(currentSlide + 1)} 
              disabled={currentSlide === session.total_slides - 1}
            >
              <ChevronRight className="w-12 h-12 text-white" />
              <span className="font-bold text-xs tracking-widest">NEXT</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}