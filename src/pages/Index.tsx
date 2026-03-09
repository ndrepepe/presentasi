import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Play, Trash2, FileImage, FileSpreadsheet, Smartphone, Loader2, GripVertical, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { uploadFileToStorage, deleteFileFromStorage, FileMetadata } from '@/utils/storage';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface PresentationFile extends FileMetadata {}

export default function Index() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<PresentationFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLatestSession = async () => {
      try {
        const { data, error } = await supabase
          .from('presentation_sessions')
          .select('id, files')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching session:', error);
          return;
        }
        
        if (data) {
          setSessionId(data.id);
          setFiles(data.files || []);
        }
      } catch (error) {
        console.error('Error in fetchLatestSession:', error);
      }
    };
    fetchLatestSession();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    const newFiles: PresentationFile[] = [];

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        setUploadProgress(Math.round(((i + 1) / uploadedFiles.length) * 100));
        
        const fileMetadata = await uploadFileToStorage(file);
        newFiles.push(fileMetadata);
        toast.success(`File ${file.name} berhasil diunggah`);
      }

      const updatedFiles = [...files, ...newFiles];
      
      if (sessionId) {
        const { error } = await supabase
          .from('presentation_sessions')
          .update({
            files: updatedFiles,
            total_slides: updatedFiles.length
          })
          .eq('id', sessionId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('presentation_sessions')
          .insert({
            files: newFiles,
            total_slides: newFiles.length,
            current_slide: 0,
            current_sheet: 0
          })
          .select()
          .single();

        if (error) throw error;
        setSessionId(data.id);
      }

      setFiles(updatedFiles);
      toast.success("Sesi presentasi diperbarui");
    } catch (error: any) {
      console.error('Upload/Save error:', error);
      toast.error(error.message || "Terjadi kesalahan saat memproses file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const removeFile = async (fileToRemove: PresentationFile) => {
    if (!sessionId) return;

    try {
      const filteredFiles = files.filter(file => file.id !== fileToRemove.id);
      
      const { error: updateError } = await supabase
        .from('presentation_sessions')
        .update({ 
          files: filteredFiles,
          total_slides: filteredFiles.length
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      const fileName = fileToRemove.url.split('/').pop();
      if (fileName) {
        await deleteFileFromStorage(fileName);
      }

      setFiles(filteredFiles);
      toast.success("File dihapus");
    } catch (error: any) {
      toast.error("Gagal menghapus file: " + error.message);
    }
  };

  const startPresentation = async () => {
    if (!sessionId || files.length === 0) {
      toast.error("Unggah file terlebih dahulu");
      return;
    }
    await resetSessionState();
    navigate(`/presenter/${sessionId}`);
  };

  const resetSessionState = async () => {
    if (!sessionId) return;
    try {
      // Reset slide ke 0 dan sheet ke 0
      await supabase
        .from('presentation_sessions')
        .update({ 
          current_slide: 0,
          current_sheet: 0 
        })
        .eq('id', sessionId);
    } catch (error: any) {
      console.error("Error resetting session state:", error.message);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !sessionId) return;
    
    const items = Array.from(files);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setFiles(items);
    
    try {
      const { error } = await supabase
        .from('presentation_sessions')
        .update({ files: items })
        .eq('id', sessionId);
      
      if (error) throw error;
      toast.success("Urutan file diperbarui");
    } catch (error: any) {
      toast.error("Gagal memperbarui urutan: " + error.message);
      setFiles(files);
    }
  };

  const remoteUrl = sessionId ? `${window.location.origin}/remote/${sessionId}` : '';

  const copyToClipboard = () => {
    if (!remoteUrl) return;
    navigator.clipboard.writeText(remoteUrl);
    setCopied(true);
    toast.success("Link disalin ke clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Pepenio Presentation App
          </h1>
          <p className="text-gray-400 text-lg">
            Presentasi instan dengan kendali jarak jauh
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-blue-400" />
                Unggah File
              </CardTitle>
              <CardDescription className="text-gray-400">
                Mendukung Gambar dan Excel (.xlsx)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors relative">
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
                    className={`cursor-pointer flex flex-col items-center gap-3 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {isUploading ? `Mengunggah... ${uploadProgress}%` : 'Klik untuk unggah file'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Maksimal 10MB per file
                      </p>
                    </div>
                  </Label>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h3 className="text-sm font-medium text-gray-400">
                      File Terunggah ({files.length})
                    </h3>
                    <DragDropContext onDragEnd={onDragEnd}>
                      <Droppable droppableId="files">
                        {(provided) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2"
                          >
                            {files.map((file, index) => (
                              <Draggable key={file.id} draggableId={file.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 ${
                                      snapshot.isDragging ? 'shadow-lg bg-white/10' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div 
                                        {...provided.dragHandleProps}
                                        className="cursor-grab active:cursor-grabbing"
                                      >
                                        <GripVertical className="w-4 h-4 text-gray-500" />
                                      </div>
                                      <span className="text-xs font-bold text-gray-400 bg-gray-800 rounded-full w-6 h-6 flex items-center justify-center">
                                        {index + 1}
                                      </span>
                                      {file.type === 'image' ? (
                                        <FileImage className="w-4 h-4 text-blue-400 shrink-0" />
                                      ) : (
                                        <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
                                      )}
                                      <span className="text-sm truncate text-gray-200">{file.name}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeFile(file)}
                                      className="text-gray-500 hover:text-red-400 hover:bg-red-400/10"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Smartphone className="w-5 h-5 text-purple-400" />
                Remote Control
              </CardTitle>
              <CardDescription className="text-gray-400">
                Kendalikan slide dari HP Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center">
                  {sessionId ? (
                    <>
                      <div className="mb-4 p-2 bg-white rounded-lg">
                        <QRCodeSVG
                          value={remoteUrl}
                          size={140}
                        />
                      </div>
                      <div className="space-y-2 w-full">
                        <p className="text-xs text-gray-400 break-all bg-black/30 p-2 rounded border border-white/5">
                          {remoteUrl}
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2 text-xs h-8 bg-white/5 border-white/10 text-gray-300"
                          onClick={copyToClipboard}
                        >
                          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'Tersalin' : 'Salin Link Remote'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8">
                      <Smartphone className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        Unggah file untuk membuat remote
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={startPresentation}
                  disabled={!sessionId || files.length === 0 || isUploading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 text-lg font-semibold rounded-xl transition-all active:scale-95"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Mulai Presentasi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg">Cara Penggunaan</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
                Unggah gambar atau file Excel (.xlsx).
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">2</span>
                Scan QR Code menggunakan kamera HP Anda.
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">3</span>
                Klik "Mulai Presentasi" di laptop/PC ini.
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">4</span>
                Gunakan tombol di HP untuk pindah slide secara real-time.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}