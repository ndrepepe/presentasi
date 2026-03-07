import { supabase } from '@/integrations/supabase/client';

export interface FileMetadata {
  id: string;
  name: string;
  type: 'image' | 'excel';
  url: string;
  size: number;
  contentType: string;
}

export const uploadFileToStorage = async (file: File): Promise<FileMetadata> => {
  try {
    // Generate unique filename
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileExtension = file.name.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('presentation-files')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('presentation-files')
      .getPublicUrl(fileName);

    return {
      id: fileId,
      name: file.name,
      type: file.type.includes('image') ? 'image' : 'excel',
      url: publicUrlData.publicUrl,
      size: file.size,
      contentType: file.type,
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const deleteFileFromStorage = async (fileName: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('presentation-files')
      .remove([fileName]);

    if (error) {
      console.error('Storage delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};