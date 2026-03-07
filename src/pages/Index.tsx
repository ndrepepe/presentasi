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
import { uploadFileToStorage, deleteFileFromStorage, FileMetadata } from '@/utils/storage';

interface PresentationFile extends FileMetadata {}

export default function Index() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [files, setFiles] = useState<PresentationFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    const newFiles: PresentationFile[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      try {
        // Show progress
        setUploadProgress(Math.round(((i + 1) / uploadedFiles.length) * 100));
        
        console.log('Processing file:', file.name);
        
        // Upload to storage
        const fileMetadata = await uploadFileToStorage(file);
        newFiles.push(fileMetadata);
        
        console.log('File uploaded successfully:', fileMetadata);
        toast.success(`File ${file.name} berhasil diupload`);
      } catch (error: any) {
        console.error('Upload error:', error);
        setUploadError(`Gagal upload file ${file.name}: ${error.message}`);
        toast.error(`Gagal upload file ${file.name}: ${error.message}`);
      }
    }

    if (newFiles.length === 0) {
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }

    // Save to database
    try {
      console.log('Saving to database...');
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
        console.error('Database save error:', error);
        toast.error("Gagal menyimpan data ke database.");
        // Optionally delete uploaded files from storage if database save fails
        for (const file of newFiles) {
          const fileName = file.url.split('/').pop();
          if (fileName) {
            await deleteFileFromStorage(fileName);
          }
        }
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }

      console.log('Database save successful:', data);
      setSessionId(data.id);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      setIsUploading(false);
      setUploadProgress(0);
      toast.success(`${newFiles.length} file berhasil ditambahkan ke presentasi.`);
    } catch (error: any) {
      console.error('Database save error:', error);
      toast.error("Gagal menyimpan data ke database.");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  useEffect(() => {
    const fetchLatestSession = async () => {
      try {
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
      } catch (error) {
        console.error('Error in fetchLatestSession:', error);
      }
    };
    fetchLatestSession();
  }, []);

  const removeFile = async (fileToRemove: PresentationFile) => {
    if (!sessionId) {
      toast.error("Tidak ada sesi aktif. Silakan upload file terlebih dahulu.");
      return;
    }

    try {
      // Remove from database first
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

      const filteredFiles = (data.files || []).filter(file => file.id !== fileToRemove.id);
      
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

      // Delete from storage
      const fileName = fileToRemove.url.split('/').pop();
      if (fileName) {
        await deleteFileFromStorage(fileName);
      }

      setFiles(filteredFiles);
      toast.success("File berhasil dihapus.");
    } catch (error: any) {
      console.error('Remove file error:', error);
      toast.error("Gagal menghapus file: " + error.message);
    }
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
                        {isUploading ? `Uploading... ${uploadProgress}%` : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Images or Excel files (max 10MB each)
                      </p>
                    </div>
                  </Label>
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <p className="text-red-400 text-sm">{uploadError}</p>
                  </div>
                )}

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
                            <span className="text-xs text-gray-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file)}
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
              <li>Files are automatically saved to Supabase Storage bucket 'presentasi'</li>
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