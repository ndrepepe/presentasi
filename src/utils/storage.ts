import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

export interface FileMetadata {
  id: string;
  name: string;
  type: 'image' | 'excel';
  url: string;
  size: number;
  contentType: string;
  sheetCount?: number; // Tambahkan info jumlah sheet
}

export const uploadFileToStorage = async (file: File): Promise<FileMetadata> => {
  try {
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileExtension = file.name.split('.').pop();
    const fileName = `${fileId}.${fileExtension}`;

    let contentType = file.type;
    let sheetCount = 0;

    // Jika Excel, hitung jumlah sheet-nya
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      sheetCount = workbook.SheetNames.length;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const { error } = await supabase.storage
      .from('presentasi')
      .upload(fileName, file, {
        contentType: contentType,
        upsert: false,
      });

    if (error) throw error;

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
      sheetCount: sheetCount > 0 ? sheetCount : undefined
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

export const deleteFileFromStorage = async (fileName: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('presentasi')
      .remove([fileName]);
    if (error) throw error;
  } catch (error) {
    console.error('Delete error:', error);
    throw error;
  }
};