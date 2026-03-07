import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Smartphone, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Remote() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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
        console.error(error);
        toast.error("Sesi tidak ditemukan");
        return;
      }
      setSession(data);
      setCurrentSlide(data.current_slide);
      setIsLoading(false);
    };

    fetchSession();

    // Subscribe to changes so remote stays in sync if changed from computer
    const channel = supabase
      .channel(`remote-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'presentation_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new.current_slide === 'number') {
            setCurrentSlide(payload.new.current_slide);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const updateSlide = async (newIndex: number) => {
    if (!session || newIndex < 0 || newIndex >= session.total_slides) return;
    
    // Optimistic update for better feel
    setCurrentSlide(newIndex);

    const { error } = await supabase
      .from('presentation_sessions')
      .update({ current_slide: newIndex })
      .eq('id', sessionId);

    if (error) {
      toast.error("Gagal memindahkan slide");
      // Revert on error
      setCurrentSlide(session.current_slide);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white p-6">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p>Menghubungkan ke presentasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-6 select-none">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-xl">Remote</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? 'CONNECTED' : 'OFFLINE'}
          </div>
          <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
            {currentSlide + 1} / {session.total_slides}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center gap-8">
        {/* Slide Preview Area */}
        <div className="aspect-video bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden relative shadow-2xl">
          {session.files[currentSlide]?.type === 'image' ? (
            <img
              src={session.files[currentSlide].url}
              alt="Preview"
              className="w-full h-full object-contain opacity-40 blur-[1px]"
            />
          ) : (
            <div className="text-gray-500 text-sm">Excel Slide</div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
            <span className="text-6xl font-black text-white/90">{currentSlide + 1}</span>
            <span className="text-xs text-white/40 mt-2 uppercase tracking-widest">Current Slide</span>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="grid grid-cols-2 gap-4 h-56">
          <Button 
            variant="outline" 
            className="h-full bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-3xl flex flex-col gap-4 active:scale-95 transition-all disabled:opacity-20"
            onClick={() => updateSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="w-16 h-16" />
            <span className="font-bold tracking-tighter">PREV</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-full bg-blue-600 border-none hover:bg-blue-500 text-white rounded-3xl flex flex-col gap-4 active:scale-95 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-20"
            onClick={() => updateSlide(currentSlide + 1)}
            disabled={currentSlide === session.total_slides - 1}
          >
            <ChevronRight className="w-16 h-16" />
            <span className="font-bold tracking-tighter">NEXT</span>
          </Button>
        </div>
      </main>

      <footer className="mt-8 text-center">
        <p className="text-gray-600 text-[10px] uppercase tracking-[0.2em]">
          Session ID: {sessionId?.slice(0, 8)}
        </p>
      </footer>
    </div>
  );
}