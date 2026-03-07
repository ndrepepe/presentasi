import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Smartphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Remote() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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

    // Subscribe to changes
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
          setCurrentSlide(payload.new.current_slide);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const updateSlide = async (newIndex: number) => {
    if (!session || newIndex < 0 || newIndex >= session.total_slides) return;
    
    const { error } = await supabase
      .from('presentation_sessions')
      .update({ current_slide: newIndex })
      .eq('id', sessionId);

    if (error) {
      toast.error("Gagal memindahkan slide");
    } else {
      // Update local state immediately for better UX
      setCurrentSlide(newIndex);
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
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-6">
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-blue-400" />
          <h1 className="font-bold text-xl">Remote Control</h1>
        </div>
        <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
          Slide {currentSlide + 1} / {session.total_slides}
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center gap-8">
        <div className="aspect-video bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden relative">
          {session.files[currentSlide].type === 'image' ? (
            <img
              src={session.files[currentSlide].url}
              alt="Preview"
              className="w-full h-full object-contain opacity-50"
            />
          ) : (
            <div className="text-gray-500 text-sm">Excel Preview</div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold">{currentSlide + 1}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 h-48">
          <Button 
            variant="outline" 
            className="h-full bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-3xl flex flex-col gap-2"
            onClick={() => updateSlide(currentSlide - 1)}
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="w-12 h-12" />
            <span className="font-bold">PREVIOUS</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-full bg-blue-600 border-none hover:bg-blue-500 text-white rounded-3xl flex flex-col gap-2"
            onClick={() => updateSlide(currentSlide + 1)}
            disabled={currentSlide === session.total_slides - 1}
          >
            <ChevronRight className="w-12 h-12" />
            <span className="font-bold">NEXT</span>
          </Button>
        </div>
      </main>

      <footer className="mt-12 text-center">
        <p className="text-gray-500 text-xs uppercase tracking-widest">
          Connected to Session: {sessionId?.slice(0, 8)}
        </p>
      </footer>
    </div>
  );
}