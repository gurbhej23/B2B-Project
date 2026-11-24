import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { CustomSelect, DatePicker } from '../../components/ui';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  ExternalLink,
  Download,
  CreditCard,
  Plus,
  ArrowRight,
  Eye,
  Calendar,
  Layers,
  MapPin,
  Check,
  X,
  TrendingUp,
  Receipt,
  Sparkles,
} from 'lucide-react';
import {
  InvoiceStatus,
  PaymentMethod,
  formatPaiseToINR,
} from '@necessity/shared';

export const InvoicesZohoScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'invoices' | 'zoho'>('invoices');

  // Invoices list state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalInvoicedPaise: 0,
    totalPaidPaise: 0,
    totalOutstandingPaise: 0,
    overdueCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Invoice Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Record Offline Payment Modal
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [paymentRefUtr, setPaymentRefUtr] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Issuing Draft Invoice
  const [isIssuingTaxInvoice, setIsIssuingTaxInvoice] = useState(false);

  // Zoho Status state
  const [zohoStatus, setZohoStatus] = useState<any | null>(null);
  const [isZohoLoading, setIsZohoLoading] = useState(false);
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Fetch Invoices
  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = { limit: 100 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/invoices', { params });
      if (res.data?.success) {
        setInvoices(res.data.data.items || []);
        setSummary(res.data.data.summary || {});
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch invoices');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Zoho Status
  const fetchZohoStatus = async () => {
    setIsZohoLoading(true);
    try {
      const res = await api.get('/integrations/zoho/status');
      if (res.data?.success) {
        setZohoStatus(res.data.data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch Zoho status:', err);
    } finally {
      setIsZohoLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [searchTerm, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchZohoStatus();
  }, []);

  // Fetch full invoice details and open modal
  const handleOpenDetails = async (invoiceId: string) => {
    setIsLoadingDetails(true);
    setIsDetailsOpen(true);
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      if (res.data?.success) {
        setSelectedInvoice(res.data.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load invoice details');
      setIsDetailsOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Open Record Payment Modal
  const handleOpenRecordPayment = (inv: any) => {
    const balanceDueRupees = ((inv.outstandingAmountPaise || 0) / 100).toFixed(2);
    setPaymentAmountRupees(balanceDueRupees);
    setPaymentMethod(PaymentMethod.BANK_TRANSFER);
    setPaymentRefUtr('');
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes('');
    setPaymentError(null);
    setIsRecordPaymentOpen(true);
  };

  // Submit Offline Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amtRupees = parseFloat(paymentAmountRupees);
    if (isNaN(amtRupees) || amtRupees <= 0) {
      setPaymentError('Please enter a valid payment amount greater than zero');
      return;
    }

    const amountPaise = Math.round(amtRupees * 100);
    if (amountPaise > selectedInvoice.outstandingAmountPaise) {
      setPaymentError(
        `Amount cannot exceed balance due of ${formatPaiseToINR(selectedInvoice.outstandingAmountPaise)}`
      );
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentError(null);

    try {
      const res = await api.post(`/invoices/${selectedInvoice.id}/payments`, {
        amountPaise,
        paymentMethod,
        bankReferenceUtr: paymentRefUtr.trim() || undefined,
        paymentDate,
        notes: paymentNotes.trim() || undefined,
        isVerified: true,
      });

      if (res.data?.success) {
        setActionSuccessNotice(
          `Payment of ${formatPaiseToINR(amountPaise)} successfully recorded for Invoice #${selectedInvoice.invoiceNumber}`
        );
        setTimeout(() => setActionSuccessNotice(null), 5000);

        setIsRecordPaymentOpen(false);
        // Refresh details
        setSelectedInvoice(res.data.data.invoice);
        // Refresh list
        fetchInvoices();
      }
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Issue Draft / Proforma invoice as final Tax Invoice
  const handleIssueTaxInvoice = async (invoiceId: string) => {
    if (!window.confirm('Are you sure you want to officially issue this Tax Invoice? This will post the debit to customer accounts.')) {
      return;
    }

    setIsIssuingTaxInvoice(true);
    try {
      const res = await api.post(`/invoices/${invoiceId}/issue`);
      if (res.data?.success) {
        setActionSuccessNotice(`Invoice #${res.data.data.invoiceNumber} has been officially issued as a Tax Invoice.`);
        setTimeout(() => setActionSuccessNotice(null), 5000);
        // Reload details
        const fullRes = await api.get(`/invoices/${invoiceId}`);
        if (fullRes.data?.success) {
          setSelectedInvoice(fullRes.data.data);
        }
        fetchInvoices();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to issue tax invoice');
    } finally {
      setIsIssuingTaxInvoice(false);
    }
  };

  // Sync Invoice to Zoho
  const handleSyncInvoice = async (invoiceId: string) => {
    setSyncingInvoiceId(invoiceId);
    setSyncFeedback(null);
    try {
      const res = await api.post(`/invoices/${invoiceId}/sync-zoho`);
      if (res.data?.success) {
        setSyncFeedback({
          id: invoiceId,
          success: true,
          message: `Invoice synced to Zoho Books! ID: ${res.data.data.zohoInvoiceId}`,
        });
        fetchInvoices();
        if (selectedInvoice && selectedInvoice.id === invoiceId) {
          setSelectedInvoice({
            ...selectedInvoice,
            zohoSyncStatus: 'synced',
            zohoInvoiceId: res.data.data.zohoInvoiceId,
          });
        }
      }
    } catch (err: any) {
      setSyncFeedback({
        id: invoiceId,
        success: false,
        message: err.response?.data?.message || err.message || 'Zoho sync failed',
      });
      fetchInvoices();
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  // Download official Tax Invoice PDF
  const handleDownloadPdf = async (invId: string, invNum: string) => {
    try {
      const res = await api.get(`/invoices/${invId}/pdf`, { responseType: 'blob' });

      if (res.data instanceof Blob && res.data.type?.includes('json')) {
        const text = await res.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.message || parsed.error?.message || 'Invoice PDF generation error');
      }

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tax-Invoice-${invNum}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 30000);
    } catch (err: any) {
      let msg = err?.message || 'Network error';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || parsed.error?.message || msg;
        } catch { }
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      alert(`Failed to download invoice PDF: ${msg}`);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
  };

  // Status badge styling helper
  const renderStatusBadge = (status: InvoiceStatus | string) => {
    switch (status) {
      case InvoiceStatus.DRAFT:
      case 'draft':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
      case InvoiceStatus.ISSUED:
      case 'issued':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Issued
          </span>
        );
      case InvoiceStatus.PARTIALLY_PAID:
      case 'partially_paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Partially Paid
          </span>
        );
      case InvoiceStatus.PAID:
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Paid
          </span>
        );
      case InvoiceStatus.OVERDUE:
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Overdue
          </span>
        );
      case InvoiceStatus.CANCELLED:
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const isZohoActive = Boolean(zohoStatus?.isConfigured);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#FFF1E8] border border-[#F0E0D5] rounded-xl text-[#F47732] shadow-xs">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#292929]">
              Invoice Management
            </h1>
            <p className="text-xs sm:text-sm text-[#737373] mt-0.5">
              Review B2B commercial invoices, balance settlements, offline payment entries, and tax documentation.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'invoices') fetchInvoices();
            else fetchZohoStatus();
          }}
          disabled={isLoading}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-[#292929] bg-white border border-[#F0E0D5] rounded-xl hover:bg-[#FFF8F3] hover:text-[#F47732] shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#F47732]' : 'text-[#737373]'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionSuccessNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#F0E0D5] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
              Total Invoiced
            </span>
            <span className="p-2 bg-[#FFF1E8] text-[#F47732] rounded-lg">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-[#292929]">
            {formatPaiseToINR(summary.totalInvoicedPaise || 0)}
          </div>
          <p className="mt-1 text-[11px] text-[#737373]">All generated trade invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-[#F0E0D5] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
              Paid / Collected
            </span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">
            {formatPaiseToINR(summary.totalPaidPaise || 0)}
          </div>
          <p className="mt-1 text-[11px] text-[#737373]">Total verified collections</p>
        </div>

        <div className="bg-white rounded-xl border border-[#F0E0D5] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
              Balance Due
            </span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-rose-600">
            {formatPaiseToINR(summary.totalOutstandingPaise || 0)}
          </div>
          <p className="mt-1 text-[11px] text-[#737373]">Outstanding trade balance</p>
        </div>

        <div className="bg-white rounded-xl border border-[#F0E0D5] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
              Overdue Invoices
            </span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {summary.overdueCount || 0}
          </div>
          <p className="mt-1 text-[11px] text-[#737373]">Past agreed credit due date</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#F0E0D5]">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'invoices'
              ? 'border-[#F47732] text-[#F47732]'
              : 'border-transparent text-[#737373] hover:text-[#292929] hover:border-[#F0E0D5]'
              }`}
          >
            Invoices Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zoho')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${activeTab === 'zoho'
              ? 'border-[#F47732] text-[#F47732]'
              : 'border-transparent text-[#737373] hover:text-[#292929] hover:border-[#F0E0D5]'
              }`}
          >
            Zoho Books Integration
            {isZohoActive ? (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Active
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                Inactive
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* TAB 1: Invoices Directory */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Global sync alert if any */}
          {syncFeedback && (
            <div
              className={`p-3 rounded-xl text-xs sm:text-sm flex items-center justify-between border ${syncFeedback.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
            >
              <div className="flex items-center space-x-2">
                {syncFeedback.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                )}
                <span>{syncFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncFeedback(null)}
                className="text-[#737373] hover:text-[#292929] p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between relative z-30">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737373]" />
              <input
                type="text"
                placeholder="Search by invoice # or customer business name / GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-[#F0E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F47732] text-[#292929] placeholder-[#737373]"
              />
            </div>

            {/* Date Filters & Status Dropdown */}
            <div className="flex flex-wrap items-center gap-2.5 relative z-40">
              <DatePicker
                label="From"
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
                maxDate={endDate || undefined}
                size="sm"
              />

              <DatePicker
                label="To"
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                minDate={startDate || undefined}
                size="sm"
              />

              <div className="w-44 relative z-50">
                <CustomSelect
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  icon={<Filter className="h-3.5 w-3.5" />}
                  size="sm"
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: InvoiceStatus.DRAFT, label: 'Draft / Proforma' },
                    { value: InvoiceStatus.ISSUED, label: 'Issued' },
                    { value: InvoiceStatus.PARTIALLY_PAID, label: 'Partially Paid' },
                    { value: InvoiceStatus.PAID, label: 'Paid' },
                    { value: InvoiceStatus.OVERDUE, label: 'Overdue' },
                    { value: InvoiceStatus.CANCELLED, label: 'Cancelled' },
                  ]}
                />
              </div>

              {(searchTerm || statusFilter !== 'all' || startDate || endDate) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-semibold text-[#F47732] hover:underline px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* MAIN INVOICE TABLE matching OrdersListScreen styling */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden relative z-10">
            {isLoading ? (
              <div className="py-20 text-center text-[#737373] text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-[#F47732] mx-auto mb-2" />
                <p className="font-semibold text-[#292929]">Loading invoices directory...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-600 bg-rose-50 rounded-xl m-4 border border-rose-200">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-rose-500" />
                <p className="font-semibold text-sm">{error}</p>
                <button
                  type="button"
                  onClick={fetchInvoices}
                  className="mt-3 px-4 py-1.5 bg-[#F47732] text-white rounded-lg text-xs font-semibold hover:bg-[#E95B2A] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-16 text-center text-[#737373]">
                <FileText className="h-10 w-10 mx-auto text-[#F0E0D5] mb-2" />
                <p className="font-bold text-[#292929]">No invoices found</p>
                <p className="text-xs text-[#737373] mt-1 max-w-sm mx-auto">
                  No invoices matched your current search criteria. Try adjusting your query or date range filters.
                </p>
                {(searchTerm || statusFilter !== 'all' || startDate || endDate) && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-3 inline-flex items-center text-xs font-bold text-[#F47732] hover:underline"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs min-w-[850px]">
                    <thead>
                      <tr className="bg-[#FFF8F3] backdrop-blur-sm border-b border-slate-200 text-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-3.5 px-6 text-left whitespace-nowrap">INVOICE NUMBER</th>
                        <th className="py-3.5 px-6 text-left whitespace-nowrap">CUSTOMER</th>
                        <th className="py-3.5 px-6 text-center whitespace-nowrap">INVOICE DATE</th>
                        <th className="py-3.5 px-6 text-center whitespace-nowrap">TOTAL AMOUNT</th>
                        <th className="py-3.5 px-6 text-center whitespace-nowrap">BALANCE DUE</th>
                        <th className="py-3.5 px-6 text-center whitespace-nowrap">STATUS</th>
                        <th className="py-3.5 px-6 text-center whitespace-nowrap">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {invoices.map((inv) => {
                        const isOverdue =
                          inv.status === InvoiceStatus.OVERDUE ||
                          (inv.outstandingAmountPaise > 0 && new Date(inv.dueDate) < new Date());

                        return (
                          <tr
                            key={inv.id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* 1. INVOICE NUMBER */}
                            <td className="py-3.5 px-6 text-left whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm font-mono">
                                  {inv.invoiceNumber}
                                </span>
                                {inv.status === InvoiceStatus.DRAFT && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-sans font-semibold shrink-0 border border-slate-200">
                                    Proforma
                                  </span>
                                )}
                              </div>
                              {inv.orderNumber && (
                                <div className="text-xs text-slate-400 font-normal mt-0.5">
                                  Order #{inv.orderNumber}
                                </div>
                              )}
                            </td>

                            {/* 2. CUSTOMER */}
                            <td className="py-3.5 px-6 text-left whitespace-nowrap">
                              <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                                {inv.retailerBusinessName}
                              </div>
                              {inv.retailerGstin ? (
                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                  GST: {inv.retailerGstin}
                                </div>
                              ) : inv.retailerPhone ? (
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {inv.retailerPhone}
                                </div>
                              ) : null}
                            </td>

                            {/* 3. INVOICE DATE */}
                            <td className="py-3.5 px-6 text-center whitespace-nowrap">
                              <div className="font-medium text-slate-800 text-xs">
                                {new Date(inv.issueDate).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <div className={`text-[11px] mt-0.5 ${isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                                Due: {new Date(inv.dueDate).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                            </td>

                            {/* 4. TOTAL AMOUNT */}
                            <td className="py-3.5 px-6 text-center whitespace-nowrap">
                              <div className="font-bold text-slate-900 text-xs font-mono">
                                {formatPaiseToINR(inv.totalPaise)}
                              </div>
                            </td>

                            {/* 5. BALANCE DUE */}
                            <td className="py-3.5 px-6 text-center whitespace-nowrap">
                              <div
                                className={`font-bold text-xs font-mono ${inv.outstandingAmountPaise === 0
                                    ? 'text-emerald-600'
                                    : isOverdue
                                      ? 'text-rose-600'
                                      : 'text-[#E95B2A]'
                                  }`}
                              >
                                {formatPaiseToINR(inv.outstandingAmountPaise)}
                              </div>
                            </td>

                            {/* 6. STATUS */}
                            <td className="py-3.5 px-6 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                {renderStatusBadge(isOverdue && inv.outstandingAmountPaise > 0 ? InvoiceStatus.OVERDUE : inv.status)}
                              </div>
                            </td>

                            {/* 7. ACTIONS */}
                            <td className="py-3.5 px-6 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                                  className="p-1.5 text-slate-500 hover:text-[#F47732] hover:bg-[#FFF8F3] rounded-md border border-slate-200 transition-colors"
                                  title="Download Tax Invoice PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetails(inv.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#F47732] border border-[#F47732] rounded-md hover:bg-[#FFF8F3] transition-colors cursor-pointer"
                                  title="View Invoice Details"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#F47732]" />
                                  <span>View</span>
                                </button>
                                {isZohoActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleSyncInvoice(inv.id)}
                                    disabled={syncingInvoiceId === inv.id}
                                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-[#E95B2A] border border-[#E95B2A] rounded-md hover:bg-[#FFF8F3] transition-colors disabled:opacity-50"
                                    title="Sync to Zoho Books"
                                  >
                                    {syncingInvoiceId === inv.id ? 'Syncing...' : 'Zoho'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer / Pagination matching Orders table */}
                <div className="p-4 bg-[#FFF8F3] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-slate-500 font-medium">
                    Showing <strong className="text-slate-800">1</strong> to{' '}
                    <strong className="text-slate-800">{invoices.length}</strong> of{' '}
                    <strong className="text-slate-800">{invoices.length}</strong> invoices
                  </p>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs text-slate-500 font-medium">Page 1 of 1</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Zoho Integration & Setup Status */}
      {activeTab === 'zoho' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#F0E0D5] p-6 shadow-xs">
            <h3 className="text-lg font-bold text-[#292929] mb-2">
              Zoho Books ERP Connectivity
            </h3>
            <p className="text-sm text-[#737373] mb-6">
              Official two-way sync for customer directories, commercial tax invoices, and accounting ledgers.
            </p>

            {isZohoLoading ? (
              <div className="py-12 text-center text-[#737373] text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-[#F47732] mx-auto mb-2" />
                <p>Verifying server credentials with Zoho Accounts API...</p>
              </div>
            ) : zohoStatus?.isConfigured ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Configured & Connected to Zoho Books</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Environment: <span className="font-mono font-semibold">{zohoStatus.environment}</span>. All necessary OAuth2 credentials and Organization ID are active on the server.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-800 font-semibold">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <span>Not Configured — Live Sync Inactive</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    The platform protects financial integrity and does NOT fabricate live synchronization. Missing server configuration keys:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {zohoStatus?.missingKeys?.map((k: string) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5] rounded font-mono text-xs font-semibold"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl p-5 space-y-4">
                  <h4 className="font-semibold text-[#292929] text-sm flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-[#F47732]" />
                    <span>Safe Setup Instructions for Administrator</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-xs text-[#737373] leading-relaxed">
                    <li>
                      Log into your Zoho Developer account at{' '}
                      <a
                        href="https://api-console.zoho.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#F47732] underline font-medium hover:text-[#E95B2A]"
                      >
                        api-console.zoho.com <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </li>
                    <li>
                      Create a <strong>Server-based Application</strong> with your domain or local redirect URI.
                    </li>
                    <li>
                      Authorize scopes:{' '}
                      <code className="bg-white px-1.5 py-0.5 border border-[#F0E0D5] rounded text-[#292929]">
                        ZohoBooks.contacts.ALL, ZohoBooks.invoices.CREATE, ZohoBooks.invoices.ALL
                      </code>
                    </li>
                    <li>
                      Add credentials to <code className="font-mono font-semibold text-[#292929]">server/.env</code>:
                      <div className="bg-white border border-[#F0E0D5] text-[#292929] p-3 rounded-lg font-mono text-[11px] mt-2 space-y-1 shadow-xs">
                        <div>ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXX</div>
                        <div>ZOHO_CLIENT_SECRET=YYYYYYYYYYYYYY</div>
                        <div>ZOHO_ORGANIZATION_ID=60000000000</div>
                        <div>ZOHO_REFRESH_TOKEN=1000.ZZZZZZZZZZZZ</div>
                        <div>ZOHO_API_BASE_URL=https://www.zohoapis.in/books/v3</div>
                      </div>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVOICE DETAILS MODAL */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedInvoice ? `Invoice Details — ${selectedInvoice.invoiceNumber}` : 'Invoice Details'}
        maxWidthClass="max-w-4xl"
      >
        {isLoadingDetails ? (
          <div className="py-20 text-center text-[#737373]">
            <RefreshCw className="h-6 w-6 animate-spin text-[#F47732] mx-auto mb-2" />
            <p className="font-semibold text-sm">Loading invoice and payment data...</p>
          </div>
        ) : selectedInvoice ? (
          <div className="space-y-6 text-sm">
            {/* Header Status & Dates Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-lg font-mono text-[#292929]">
                    {selectedInvoice.invoiceNumber}
                  </span>
                  {renderStatusBadge(selectedInvoice.status)}
                </div>
                {selectedInvoice.orderNumber && (
                  <p className="text-xs text-[#737373] mt-1 font-mono">
                    Linked Wholesale Order: <span className="font-semibold text-[#292929]">#{selectedInvoice.orderNumber}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-[#737373] block">Invoice Date</span>
                  <span className="font-semibold text-[#292929]">
                    {new Date(selectedInvoice.issueDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[#737373] block">Payment Due Date</span>
                  <span className="font-semibold text-[#292929]">
                    {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Information and Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer & Business Profile */}
              <div className="p-4 border border-[#F0E0D5] rounded-xl bg-white space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#F47732]">
                  <Building2 className="h-4 w-4" />
                  <span>Customer & Business Information</span>
                </div>
                <div className="pt-1 text-xs space-y-1">
                  <div className="font-bold text-sm text-[#292929]">
                    {selectedInvoice.retailerBusinessName}
                  </div>
                  {selectedInvoice.retailer?.contactPerson && (
                    <div className="text-[#737373]">
                      Contact Person: <span className="text-[#292929]">{selectedInvoice.retailer.contactPerson}</span>
                    </div>
                  )}
                  {selectedInvoice.retailer?.phone && (
                    <div className="text-[#737373]">
                      Phone: <span className="text-[#292929]">{selectedInvoice.retailer.phone}</span>
                    </div>
                  )}
                  {selectedInvoice.retailer?.email && (
                    <div className="text-[#737373]">
                      Email: <span className="text-[#292929]">{selectedInvoice.retailer.email}</span>
                    </div>
                  )}
                  <div className="font-mono text-[11px] pt-1">
                    <span className="text-[#737373]">GSTIN: </span>
                    <span className="font-semibold text-[#292929]">
                      {selectedInvoice.retailerGstin || selectedInvoice.retailer?.gstin || 'Unregistered / Non-GST'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billing and Shipping Addresses */}
              <div className="p-4 border border-[#F0E0D5] rounded-xl bg-white space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#F47732]">
                  <MapPin className="h-4 w-4" />
                  <span>Billing & Delivery Addresses</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-[#737373] text-[11px] uppercase block">
                      Billing Address
                    </span>
                    <p className="text-[#292929] mt-0.5 leading-relaxed text-[11px]">
                      {selectedInvoice.retailer?.billingAddress?.street || 'Commercial Market'}<br />
                      {[selectedInvoice.retailer?.billingAddress?.city, selectedInvoice.retailer?.billingAddress?.state, selectedInvoice.retailer?.billingAddress?.pincode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-[#737373] text-[11px] uppercase block">
                      Shipping / Delivery
                    </span>
                    <p className="text-[#292929] mt-0.5 leading-relaxed text-[11px]">
                      {selectedInvoice.order?.deliveryAddress?.street || selectedInvoice.retailer?.shippingAddress?.street || 'Delivery Site'}<br />
                      {[selectedInvoice.order?.deliveryAddress?.city || selectedInvoice.retailer?.shippingAddress?.city, selectedInvoice.order?.deliveryAddress?.state || selectedInvoice.retailer?.shippingAddress?.state, selectedInvoice.order?.deliveryAddress?.pincode || selectedInvoice.retailer?.shippingAddress?.pincode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Details Table */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#292929] mb-2 flex items-center justify-between">
                <span>Product Items Breakdown</span>
                <span className="text-[#737373] text-[11px] font-normal">
                  {selectedInvoice.items?.length || 0} line items
                </span>
              </div>
              <div className="border border-[#F0E0D5] rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-xs">
                  <thead className="bg-[#FFF8F3] text-[#292929] font-bold uppercase text-[10px] tracking-wider border-b border-[#F0E0D5]">
                    <tr className="h-9">
                      <th className="py-2 px-3 text-left">SKU / Item</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Taxable</th>
                      <th className="py-2 px-3 text-center">GST%</th>
                      <th className="py-2 px-3 text-right">GST Amount</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E0D5] bg-white">
                    {selectedInvoice.items?.map((item: any, idx: number) => {
                      const taxTotal = (item.cgstPaise || 0) + (item.sgstPaise || 0) + (item.igstPaise || 0);
                      return (
                        <tr key={idx} className="hover:bg-[#FFF8F3]/40 transition-colors">
                          <td className="py-2.5 px-3 text-left">
                            <div className="font-semibold text-[#292929]">{item.name}</div>
                            <div className="font-mono text-[10px] text-[#737373]">{item.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#292929]">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatPaiseToINR(item.unitPricePaise)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatPaiseToINR(item.taxableAmountPaise)}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#737373]">{item.gstRatePercent}%</td>
                          <td className="py-2.5 px-3 text-right font-mono text-[#737373]">{formatPaiseToINR(taxTotal)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#292929]">
                            {formatPaiseToINR(item.totalPaise)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary & Balance Due Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: GST Splits */}
              <div className="p-4 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl text-xs space-y-1.5">
                <span className="font-bold text-[11px] uppercase tracking-wider text-[#292929] block mb-1">
                  Tax Calculation Breakdown
                </span>
                <div className="flex justify-between text-[#737373]">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono text-[#292929] font-medium">{formatPaiseToINR(selectedInvoice.subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-[#737373]">
                  <span>Total Applicable GST:</span>
                  <span className="font-mono text-[#292929] font-medium">{formatPaiseToINR(selectedInvoice.taxPaise)}</span>
                </div>
                {selectedInvoice.order?.discountAmountPaise > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount Applied:</span>
                    <span className="font-mono font-medium">-{formatPaiseToINR(selectedInvoice.order.discountAmountPaise)}</span>
                  </div>
                )}
              </div>

              {/* Right: Grand Total & Settlements */}
              <div className="p-4 bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl text-xs space-y-2">
                <div className="flex justify-between items-center text-sm font-bold text-[#292929] pb-1.5 border-b border-[#F0E0D5]">
                  <span>Grand Total:</span>
                  <span className="text-base text-[#E95B2A] font-mono">{formatPaiseToINR(selectedInvoice.totalPaise)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono">{formatPaiseToINR(selectedInvoice.paidAmountPaise)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold text-sm pt-1 border-t border-[#F0E0D5]">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatPaiseToINR(selectedInvoice.outstandingAmountPaise)}</span>
                </div>
              </div>
            </div>

            {/* Payment History Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#292929]">
                  Payment History & Transactions
                </span>
                {selectedInvoice.outstandingAmountPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenRecordPayment(selectedInvoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Record Offline Payment</span>
                  </button>
                )}
              </div>

              {(!selectedInvoice.payments || selectedInvoice.payments.length === 0) ? (
                <div className="p-4 bg-white border border-[#F0E0D5] rounded-xl text-center text-xs text-[#737373]">
                  No payment transactions recorded yet for this invoice.
                </div>
              ) : (
                <div className="border border-[#F0E0D5] rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs">
                    <thead className="bg-[#FFF8F3] text-[#292929] font-bold uppercase text-[10px] tracking-wider border-b border-[#F0E0D5]">
                      <tr className="h-8">
                        <th className="py-2 px-3 text-left">Date</th>
                        <th className="py-2 px-3 text-left">Method</th>
                        <th className="py-2 px-3 text-left">Reference / UTR</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0E0D5] bg-white">
                      {selectedInvoice.payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-[#FFF8F3]/40">
                          <td className="py-2.5 px-3 text-left text-[#292929]">
                            {new Date(p.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-left font-medium capitalize text-[#292929]">
                            {String(p.paymentMethod || 'bank_transfer').replace(/_/g, ' ')}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-[#737373]">
                            {p.bankReferenceUtr || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                            {formatPaiseToINR(p.amountPaise)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Verified
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-3 border-t border-[#F0E0D5] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoiceNumber)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#FFF8F3] hover:bg-[#FFF1E8] text-[#F47732] border border-[#F0E0D5] rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Tax Invoice PDF</span>
                </button>

                {selectedInvoice.status === InvoiceStatus.DRAFT && (
                  <button
                    type="button"
                    onClick={() => handleIssueTaxInvoice(selectedInvoice.id)}
                    disabled={isIssuingTaxInvoice}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>{isIssuingTaxInvoice ? 'Issuing...' : 'Issue Final Tax Invoice'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {selectedInvoice.outstandingAmountPaise > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenRecordPayment(selectedInvoice)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Record Payment</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* RECORD OFFLINE PAYMENT MODAL */}
      <Modal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        title="Record Offline Payment"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs sm:text-sm">
          {paymentError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{paymentError}</span>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#292929] mb-1.5">
              Payment Amount (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={paymentAmountRupees}
              onChange={(e) => setPaymentAmountRupees(e.target.value)}
              placeholder="e.g. 5000.00"
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#F0E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F47732] font-mono font-bold text-[#292929]"
            />
            {selectedInvoice && (
              <p className="text-[11px] text-[#737373] mt-1">
                Balance Due:{' '}
                <span className="font-semibold text-rose-600 font-mono">
                  {formatPaiseToINR(selectedInvoice.outstandingAmountPaise)}
                </span>
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#292929] mb-1.5">
              Payment Mode *
            </label>
            <CustomSelect
              value={paymentMethod}
              onChange={(val) => setPaymentMethod(val as PaymentMethod)}
              options={[
                { value: PaymentMethod.BANK_TRANSFER, label: 'Bank Transfer / NEFT / RTGS' },
                { value: PaymentMethod.UPI, label: 'UPI QR / Virtual Payment' },
                { value: PaymentMethod.CHEQUE, label: 'Cheque / Demand Draft' },
                { value: PaymentMethod.CASH, label: 'Cash Settlement' },
              ]}
            />
          </div>

          {/* Bank Reference / UTR Number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#292929] mb-1.5">
              Bank Reference / UTR / Cheque Number
            </label>
            <input
              type="text"
              value={paymentRefUtr}
              onChange={(e) => setPaymentRefUtr(e.target.value)}
              placeholder="e.g. UTR123456789012"
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#F0E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F47732] font-mono text-[#292929]"
            />
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#292929] mb-1.5">
              Payment Date *
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#F0E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F47732] text-[#292929]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#292929] mb-1.5">
              Payment Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g. Received via HDFC current account..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#F0E0D5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F47732] text-[#292929]"
            />
          </div>

          <div className="pt-3 border-t border-[#F0E0D5] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsRecordPaymentOpen(false)}
              className="px-4 py-2 border border-[#F0E0D5] hover:bg-[#FFF8F3] text-[#737373] hover:text-[#292929] rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingPayment}
              className="px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isSubmittingPayment ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Confirm Payment</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
