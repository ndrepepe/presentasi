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

    // Tentukan content type yang tepat untuk Excel jika tidak terdeteksi otomatis
    let contentType = file.type;
    if (!contentType) {
      if (file.name.endsWith('.xlsx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (file.name.endsWith('.xls')) {
        contentType = 'application/vnd.ms-excel';
      } else {
        contentType = 'application/octet-stream';
      }
    }

    console.log('Uploading file:', fileName, 'to bucket: presentasi', 'Type:', contentType);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('presentasi')
      .upload(fileName, file, {
        contentType: contentType,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      // Jika error RLS, berikan pesan yang lebih manusiawi
      if (error.message.includes('row-level security')) {
        throw new Error('Izin penyimpanan ditolak. Pastikan kebijakan RLS untuk bucket "presentasi" sudah diatur di Supabase.');
      }
      throw new Error(`Gagal upload ke storage: ${error.message}`);
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('presentasi')
      .getPublicUrl(fileName);

    return {
      id: fileId,
      name: file.name,
      type: (file.type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension?.toLowerCase() || '')) ? 'image' : 'excel',
      url: publicUrlData.publicUrl,
      size: file.size,
      contentType: contentType,
    };
  } catch (error) {
    console.error('Upload error details:', error);
    throw error;
  }
};

export const deleteFileFromStorage = async (fileName: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('presentasi')
      .remove([fileName]);

    if (error) {
      throw new Error(`Gagal menghapus file: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};