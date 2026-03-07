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
            type: file.type.includes('image') ? 'image' : 'excel',
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
    toast.success(`${newFiles.length} file berhasil ditambahkan dan disimpan.`);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const startPresentation = async () => {
    if (files.length === 0) {
      toast.error("Silakan upload bahan presentasi terlebih dahulu.");
      return;
    }

    if (!sessionId) {
      toast.error("Tidak ada sesi aktif. Silakan upload file terlebih dahulu.");
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
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Smart Presentation
          </h1>
          <p className="text-gray-400 text-lg">
            Presentasi gambar & Excel dengan kendali jarak jauh via HP.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-400" />
                Upload Bahan
              </CardTitle>
              <CardDescription className="text-gray-400">
                Pilih file gambar (JPG/PNG) atau Excel (XLSX).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="files" className="cursor-pointer">
                  <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors bg-white/5">
                    <Upload className="w-10 h-10 mx-auto mb-4 text-gray-500" />
                    <span className="text-sm text-gray-400">Klik untuk memilih file</span>
                  </div>
                </Label>
                <Input 
                  id="files" 
                  type="file" 
                  multiple 
                  accept="image/*,.xlsx,.xls" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {file.type === 'image' ? <FileImage className="w-4 h-4 text-blue-400 shrink-0" /> : <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />}
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeFile(file.id)} className="text-gray-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 text-white flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-purple-400" />
                Mulai Presentasi
              </CardTitle>
              <CardDescription className="text-gray-400">
                Klik tombol di bawah untuk masuk ke mode full-screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center space-y-6">
              <Button 
                size="lg" 
                className="w-full h-16 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                onClick={startPresentation}
                disabled={files.length === 0}
              >
                <Play className="w-6 h-6 mr-2 fill-current" />
                Mulai Sekarang
              </Button>
              
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
                  <Smartphone className="w-4 h-4" />
                  <span>Kendali via HP akan tersedia setelah mulai</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
