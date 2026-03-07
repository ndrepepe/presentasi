import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Play, Trash2, FileImage, FileSpreadsheet, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface PresentationFile {
  id: string;
  name: string;
  type: 'image' | 'excel';
  content: string; // Base64
}

export default function Index() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<PresentationFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    setIsUploading(true);
    const newFiles: PresentationFile[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const reader = new FileReader();

      const promise = new Promise<void>((resolve) => {
        reader.onload = (event) => {
          const content = event.target?.result as string;
          
          newFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type.includes('image')? 'image' : 'excel',
            content: content,
          });
          resolve();
        };
      });

      if (file.type.includes('image')) {
        reader.readAsDataURL(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        reader.readAsDataURL(file);
      } else {
        toast.error(`File ${file.name} tidak didukung.`);
        continue;
      }
      
      await promise;
    }

    if (newFiles.length === 0) {
      setIsUploading(false);
      return;
    }

    // Simpan ke Supabase
    const { data, error } = await supabase
     .from('presentation_sessions')
     .insert({
        files: newFiles,
        total_slides: newFiles.length,
        current_slide: 0
      })
     .select()
     .single();

    if (error) {
      console.error('Error saving to Supabase:', error);
      toast.error("Gagal menyimpan file ke database.");
      setIsUploading(false);
      return;
    }

    setSessionId(data.id);
    setFiles(newFiles);
    setIsUploading(false);
    toast.success(`${newFiles.length} file berhasil ditambahkan.`);
  };

  useEffect(() => {
    const fetchLatestSession = async () => {
      const { data, error } = await supabase
       .from('presentation_sessions')
       .select('id, files')
       .order('created_at', { ascending: false }) // <-- Fixed order method placement
       .limit(1)
       .single();

      if (error) {
        console.error('Error fetching session:', error);
        return;
      }
      
      if (data) {
        setSessionId(data.id);
        setFiles(data.files);
      }
    };
    fetchLatestSession();
  }, []);

  const removeFile = async (id: string) => {
    if (!sessionId) {
      toast.error("Tidak ada sesi aktif. Silakan upload file terlebih dahulu.");
      return;
    }

    const { data, error } = await supabase
     .from('presentation_sessions')
     .select('*')
     .eq('id', sessionId)
     .single();

    if (error) {
      console.error('Error fetching session:', error);
      toast.error("Gagal menghapus file.");
      return;
    }

    const filteredFiles = data.files.filter(file => file.id!== id);
    const { error: updateError } = await supabase
     .from('presentation_sessions')
     .update({ 
        files: filteredFiles,
        total_slides: filteredFiles.length
      })
     .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      toast.error("Gagal memperbarui sesi di database.");
      return;
    }

    setFiles(filteredFiles);
    toast.success("File berhasil dihapus.");
  };

  const startPresentation = async () => {
    if (!sessionId) {
      toast.error("Tidak ada sesi aktif. Silakan upload file terlebih dahulu.");
      return;
    }

    if (files.length === 0) {
      toast.error("Tidak ada file untuk dipresentasikan.");
      return;
    }

    try {
      navigate(`/presenter/${sessionId}`);
    } catch (error: any) {
      toast.error("Gagal memulai sesi: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      {/*... (UI elements) */}

      {files.map((file) => (
        <div key={file.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="flex items-center gap-3 overflow-hidden">
            {file.type === 'image'? <FileImage className="w-4 h-4 text-blue-400 shrink-0" /> : <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />}
            <span className="text-sm truncate">{file.name}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)} className="text-gray-500 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}