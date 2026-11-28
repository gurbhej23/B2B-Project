import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import { apiClient } from '../../lib/api';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Info,
  Check,
  Eye,
  FileText,
} from 'lucide-react';

export const ImportProductsScreen: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Strategy options
  const [updateExisting, setUpdateExisting] = useState(true);
  const [updateStock, setUpdateStock] = useState(false);

  // Result summary
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; sku?: string; reason: string }>;
  } | null>(null);

  // Download official CSV template
  const handleDownloadTemplate = () => {
    const headers = [
      'sku',
      'name',
      'description',
      'category',
      'brand',
      'mrp',
      'dealerPrice',
      'gstRatePercent',
      'uom',
      'packSize',
      'caseQuantity',
      'minOrderQuantity',
      'orderQuantityMultiple',
      'stockOnHand',
      'lowStockThreshold',
      'barcode',
      'warehouseLocation',
    ];

    const sampleRow = [
      'TOWEL-BATH-WHT-01',
      'Premium Cotton Bath Towel 500 GSM',
      'Super absorbent 100% combed cotton bath towels for hotels and hospitals',
      'Towels & Bath Linen',
      'Necessity India',
      '399.00',
      '249.00',
      '18',
      'PCS',
      '1',
      '20',
      '5',
      '1',
      '150',
      '25',
      '8901234567890',
      'Main Central Warehouse',
    ];

    const sampleRow2 = [
      'CHEM-FLOOR-CLEAN-5L',
      'Hospital Grade Floor Cleaner & Disinfectant 5 Liter',
      'Concentrated floral fragrance surface sanitizer solution',
      'Cleaning Chemicals',
      'Necessity Hygiene',
      '550.00',
      '380.00',
      '18',
      'CAN',
      '1',
      '4',
      '2',
      '1',
      '80',
      '15',
      '8901234567891',
      'Chemical Warehouse Bay B',
    ];

    const csvContent = [headers.join(','), sampleRow.join(','), sampleRow2.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wholesale_products_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle file upload & client-side parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.txt')) {
      setParseErrors(['Please upload a valid .csv format file.']);
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setParseErrors(['File size exceeds 5MB limit.']);
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    setParseErrors([]);
    setImportSummary(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsParsing(false);
        if (results.errors.length > 0) {
          setParseErrors(results.errors.map((err) => `Line ${err.row}: ${err.message}`));
        }
        setParsedRows(results.data as any[]);
      },
      error: (err) => {
        setIsParsing(false);
        setParseErrors([err.message]);
      },
    });
  };

  // Perform backend import
  const handleStartImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setParseErrors([]);

    try {
      const res = await apiClient.post('/products/import', {
        items: parsedRows,
        options: {
          updateExisting,
          updateStock,
        },
      });

      setImportSummary(res.data.data);
    } catch (err: any) {
      setParseErrors([err.response?.data?.error?.message || 'Bulk import failed. Please verify CSV data format.']);
    } finally {
      setIsImporting(false);
    }
  };

  // Download error log as CSV
  const handleDownloadErrorReport = () => {
    if (!importSummary?.errors || importSummary.errors.length === 0) return;

    const headers = ['Row Number', 'SKU', 'Error Reason'];
    const rows = importSummary.errors.map((e) => [e.row, `"${e.sku || 'N/A'}"`, `"${e.reason.replace(/"/g, '""')}"`]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]">
        <div className="flex items-start gap-3">
          <Link
            to="/admin/products"
            className="p-2 rounded-lg border border-[#F0E0D5] bg-white text-[#292929] hover:bg-[#FFF8F3] hover:text-[#F47732] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-sm lg:text-xl font-bold text-[#292929] flex items-center gap-2">
              Bulk Import Wholesale Products (CSV / Excel)
            </h1>
            {/* <p className="text-xs text-[#737373] mt-0.5">
              Upload multiple product catalogues, wholesale rates, and opening inventory balances using CSV spreadsheets.
            </p> */}
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#E95B2A] bg-[#FFF1E8] hover:bg-[#F47732] hover:text-white border border-[#F0E0D5] rounded-lg shadow-sm transition-all"
        >
          <Download className="h-4 w-4" />
          <span>Download Sample Template</span>
        </button>
      </div>

      {/* Parse or Network Errors */}
      {parseErrors.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span>Import Errors / Warnings</span>
          </div>
          <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5 pl-1">
            {parseErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP 1: UPLOAD BOX */}
      {!importSummary && (
        <div className="bg-white p-6 rounded-2xl border border-[#F0E0D5] shadow-sm space-y-4 !my-3">
          <h3 className="text-sm font-bold text-[#292929] flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#F47732]" />
            Select CSV File to Upload
          </h3>

          <div className="border-2 border-dashed border-[#F0E0D5] rounded-xl p-8 text-center hover:border-[#F47732] transition-colors bg-[#FFF8F3]/30">
            <Upload className="h-10 w-10 text-[#F47732]/60 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#292929]">
              Drag & Drop your product CSV file here, or click to browse
            </p>
            <p className="text-xs text-[#737373] mt-1">Supports CSV files up to 5MB (UTF-8 encoded)</p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="mt-4 block mx-auto text-xs text-[#737373] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#F47732] file:text-white hover:file:bg-[#E95B2A] cursor-pointer"
            />
          </div>

          {/* Import Strategy Options */}
          <div className="bg-[#FFF8F3]/50 p-4 rounded-xl border border-[#F0E0D5] space-y-3 text-xs">
            <h4 className="font-bold text-[#292929] flex items-center gap-1.5">
              <Info className="h-4 w-4 text-[#F47732]" />
              Import Strategies & Conflict Resolution
            </h4>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="rounded border-[#F0E0D5] text-[#F47732] focus:ring-[#F47732]"
              />
              <span className="text-[#292929] font-medium">
                <strong>Update existing products:</strong> If an existing product matches by SKU, update its specifications, wholesale pricing, and tax details.
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={updateStock}
                onChange={(e) => setUpdateStock(e.target.checked)}
                className="rounded border-[#F0E0D5] text-[#F47732] focus:ring-[#F47732]"
              />
              <span className="text-[#292929] font-medium">
                <strong>Explicit stock override:</strong> Update stock quantities from file for existing products (Warning: Check this only if your CSV contains an authoritative physical count audit).
              </span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW ROWS BEFORE IMPORT */}
      {parsedRows.length > 0 && !importSummary && (
        <div className="bg-white rounded-2xl border border-[#F0E0D5] shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]/60">
            <div>
              <h3 className="font-bold text-[#292929] text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#F47732]" />
                Data Preview ({parsedRows.length} rows parsed)
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">
                Inspect preview of the first 5 records before committing to the database.
              </p>
            </div>

            <button
              type="button"
              disabled={isImporting || parsedRows.length === 0}
              onClick={handleStartImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold text-xs rounded-lg shadow-sm shadow-[#F47732]/20 transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Importing {parsedRows.length} Products...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Execute Bulk Import ({parsedRows.length} Rows)</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] text-[10px] font-bold uppercase">
                  <th className="py-2.5 px-3 text-center">#</th>
                  <th className="py-2.5 px-3 text-center">SKU</th>
                  <th className="py-2.5 px-3 text-center">Product Name</th>
                  <th className="py-2.5 px-3 text-center">Category</th>
                  <th className="py-2.5 px-3 text-center">Brand</th>
                  <th className="py-2.5 px-3 text-center">MRP (₹)</th>
                  <th className="py-2.5 px-3 text-center">Wholesale (₹)</th>
                  <th className="py-2.5 px-3 text-center">GST %</th>
                  <th className="py-2.5 px-3 text-center">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E0D5]/60">
                {parsedRows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#FFF8F3]/50">
                    <td className="py-2.5 px-3 text-[#737373] font-mono text-center">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#292929] text-center">
                      {row.sku || row.SKU || 'MISSING'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#292929] text-center">{row.name || row.Name}</td>
                    <td className="py-2.5 px-3 text-[#737373] text-center">{row.category || row.Category || 'General'}</td>
                    <td className="py-2.5 px-3 text-[#737373] text-center">{row.brand || row.Brand || 'Necessity India'}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#737373]">₹{row.mrp || row.MRP || '0'}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[#E95B2A]">
                      ₹{row.dealerPrice || row['Dealer Price'] || '0'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#737373]">{row.gstRatePercent || '18'}%</td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#292929]">
                      {row.stockOnHand || row.stock || '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 5 && (
            <p className="text-[11px] text-[#737373] italic">
              Showing first 5 preview rows. Remaining {parsedRows.length - 5} rows will be processed in the batch.
            </p>
          )}
        </div>
      )}

      {/* STEP 3: FINAL IMPORT SUMMARY & ERROR REPORT */}
      {importSummary && (
        <div className="bg-white rounded-2xl border border-[#F0E0D5] shadow-sm p-6 space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]/60">
            <div>
              <h3 className="font-bold text-[#292929] text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#F47732]" />
                Import Complete
              </h3>
              <p className="text-xs text-[#737373] mt-0.5">
                Batch processing finished for {importSummary.totalRows} records.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/admin/products"
                className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold text-xs rounded-lg shadow-sm shadow-[#F47732]/20"
              >
                Go to All Products
              </Link>
              <button
                type="button"
                onClick={() => {
                  setImportSummary(null);
                  setParsedRows([]);
                  setFile(null);
                }}
                className="px-3.5 py-2 border border-[#F0E0D5] text-[#292929] font-semibold text-xs rounded-lg hover:bg-[#FFF8F3]"
              >
                Import Another File
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 bg-[#FFF1E8] border border-[#F0E0D5] rounded-xl">
              <span className="text-[11px] font-bold text-[#E95B2A] uppercase block">Created New</span>
              <span className="text-2xl font-black text-[#E95B2A]">{importSummary.created}</span>
            </div>

            <div className="p-3.5 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl">
              <span className="text-[11px] font-bold text-[#F47732] uppercase block">Updated Existing</span>
              <span className="text-2xl font-black text-[#F47732]">{importSummary.updated}</span>
            </div>

            <div className="p-3.5 bg-white border border-[#F0E0D5] rounded-xl">
              <span className="text-[11px] font-bold text-[#737373] uppercase block">Skipped</span>
              <span className="text-2xl font-black text-[#292929]">{importSummary.skipped}</span>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${importSummary.failed > 0
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-white border-[#F0E0D5] text-[#737373]'
                }`}
            >
              <span className="text-[11px] font-bold uppercase block">Failed Rows</span>
              <span className="text-2xl font-black">{importSummary.failed}</span>
            </div>
          </div>

          {/* Failed rows table if any */}
          {importSummary.errors.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-rose-800 text-xs flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  Failed Records ({importSummary.errors.length})
                </h4>
                <button
                  type="button"
                  onClick={handleDownloadErrorReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-bold text-xs"
                >
                  <Download className="h-3 w-3" />
                  <span>Download Error CSV Report</span>
                </button>
              </div>

              <div className="border border-rose-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-center text-xs border-collapse">
                  <thead className="bg-rose-50 text-rose-900 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="py-2 px-3 text-center">CSV Row</th>
                      <th className="py-2 px-3 text-center">SKU</th>
                      <th className="py-2 px-3 text-center">Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 text-rose-800">
                    {importSummary.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-center">Line {err.row}</td>
                        <td className="py-2 px-3 font-mono text-center">{err.sku}</td>
                        <td className="py-2 px-3 text-center">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
