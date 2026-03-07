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

    console.log('Uploading file:', fileName, 'to bucket: presentasi');

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('presentasi') // Use the correct bucket name
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('presentasi') // Use the correct bucket name
      .getPublicUrl(fileName);

    console.log('Public URL:', publicUrlData.publicUrl);

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
    console.log('Deleting file from storage:', fileName);
    
    const { error } = await supabase.storage
      .from('presentasi') // Use the correct bucket name
      .remove([fileName]);

    if (error) {
      console.error('Storage delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
    
    console.log('File deleted successfully');
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};