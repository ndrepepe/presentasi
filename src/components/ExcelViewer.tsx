import React from 'react';
import * as XLSX from 'xlsx';

interface ExcelViewerProps {
  data: string[]; 
  activeSheetIndex?: number; // Terima index sheet dari props
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ data, activeSheetIndex = 0 }) => {
  const [sheets, setSheets] = React.useState<{ name: string; data: any[][] }[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const loadExcelFile = async (url: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch Excel file');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetData = workbook.SheetNames.map((name) => ({
        name,
        data: XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }) as any[][],
      }));
      setSheets(sheetData);
    } catch (error) {
      console.error("Error reading Excel file:", error);
      setSheets([]);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (data && data.length > 0) {
      loadExcelFile(data[0]);
    }
  }, [data]);

  if (isLoading) return <div className="p-4 text-white">Loading Excel data...</div>;
  if (sheets.length === 0) return <div className="p-4 text-white">No Excel data available</div>;

  const safeIndex = Math.min(Math.max(0, activeSheetIndex), sheets.length - 1);

  const formatCellValue = (value: any) => {
    if (typeof value === 'number') {
      return new Intl.NumberFormat('id-ID').format(value);
    }
    return value?.toString() || '';
  };

  return (
    <div className="flex flex-col h-full w-full bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-white/10">
      <div className="flex shrink-0 border-b border-white/10 bg-black/20 overflow-x-auto">
        {sheets.map((sheet, idx) => (
          <div
            key={idx}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              safeIndex === idx
                ? 'bg-blue-600 text-white'
                : 'text-gray-400'
            }`}
          >
            {sheet.name}
          </div>
        ))}
      </div>
      {/* Tambahkan ID excel-scroll-area di sini */}
      <div id="excel-scroll-area" className="flex-1 overflow-auto p-4 custom-scrollbar scroll-smooth">
        <table className="w-full border-collapse text-sm text-white">
          <tbody>
            {sheets[safeIndex].data.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/5">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-2 border-r border-white/5 min-w-[100px]">
                    {formatCellValue(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};