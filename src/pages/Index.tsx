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
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching session:', error);
        return;
      }
      
      if (data) {
        setSessionId(data.id);
        setFiles(data.files || []);
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
      .select('files')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      toast.error("Gagal menghapus file.");
      return;
    }

    const filteredFiles = data.files.filter(file => file.id !== id);
    
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
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Quick Kiwi Flip
          </h1>
          <p className="text-gray-400 text-lg">
            Upload your presentation files and control them remotely
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Upload Section */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Files
              </CardTitle>
              <CardDescription>
                Support for images and Excel files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors">
                  <Input
                    type="file"
                    id="file-upload"
                    multiple
                    accept="image/*,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Images or Excel files (max 10MB each)
                      </p>
                    </div>
                  </Label>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h3 className="text-sm font-medium text-gray-400">
                      Uploaded Files ({files.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            {file.type === 'image' ? (
                              <FileImage className="w-4 h-4 text-blue-400 shrink-0" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                            )}
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Remote Control Section */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Remote Control
              </CardTitle>
              <CardDescription>
                Control your presentation from any device
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
                  {sessionId ? (
                    <>
                      <div className="mb-4 flex justify-center">
                        <QRCodeSVG
                          value={`${window.location.origin}/remote/${sessionId}`}
                          size={150}
                          className="rounded-lg"
                        />
                      </div>
                      <p className="text-sm text-gray-400">
                        Scan with your phone to control
                      </p>
                      <p className="text-xs text-gray-500 mt-2 font-mono">
                        {sessionId.slice(0, 8)}...
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500">
                      Upload files first to generate a remote control link
                    </p>
                  )}
                </div>

                <Button
                  onClick={startPresentation}
                  disabled={!sessionId || files.length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 text-lg font-semibold rounded-xl"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Presentation
                </Button>

                {sessionId && (
                  <div className="text-center text-sm text-gray-400">
                    <p>Session ID: {sessionId.slice(0, 8)}...</p>
                    <p className="text-xs mt-1">
                      Share this ID with others to collaborate
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 list-decimal list-inside text-gray-300">
              <li>Upload your presentation files (images or Excel sheets)</li>
              <li>Scan the QR code with your phone to open the remote control</li>
              <li>Click "Start Presentation" to begin</li>
              <li>Use the remote control to navigate slides</li>
              <li>Share the session ID with collaborators</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}