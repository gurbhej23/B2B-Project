import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { DispatchOrderModal } from './DispatchOrderModal';
import { PickupOrderModal } from './PickupOrderModal';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  UserRole,
  formatPaiseToINR,
} from '@necessity/shared';
import {
  X,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Building,
  MapPin,
  FileText,
  Loader2,
  AlertTriangle,
  Download,
  Eye,
  Mail,
  RefreshCw,
  CreditCard,
  History,
  PlusCircle,
  Banknote,
  DollarSign,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: any;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [cancelReason, setCancelReason] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dispatch details state
  const [showDispatchPrompt, setShowDispatchPrompt] = useState(false);
  const [courierName, setCourierName] = useState(order.dispatchDetails?.courierName || '');
  const [trackingNumber, setTrackingNumber] = useState(order.dispatchDetails?.trackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(order.dispatchDetails?.trackingUrl || '');
  const [transportDetails, setTransportDetails] = useState(order.dispatchDetails?.transportDetails || '');

  // Pickup details state
  const [showPickupPrompt, setShowPickupPrompt] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(
    order.pickupDetails?.pickupLocation || 'Necessity Central Warehouse - Mohali'
  );
  const [collectedBy, setCollectedBy] = useState(order.pickupDetails?.collectedBy || '');
  const [pickupNotes, setPickupNotes] = useState(order.pickupDetails?.notes || '');

  // Retry notification state
  const [retryingStatus, setRetryingStatus] = useState<string | null>(null);

  const isStaff = user && [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.ACCOUNTS_MANAGER,
  ].includes(user.role);

  const canRecordPayment = user && [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
  ].includes(user.role);

  // Financial calculations
  const totalPaidPaise = order.totalPaidPaise || 0;
  const remainingBalancePaise = order.remainingBalancePaise !== undefined
    ? order.remainingBalancePaise
    : Math.max(0, order.grandTotalPaise - totalPaidPaise);

  // Offline Payment Recording State
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState<string>(
    remainingBalancePaise > 0 ? (remainingBalancePaise / 100).toFixed(2) : '0'
  );
  const [paymentMethodSelected, setPaymentMethodSelected] = useState<string>(
    order.paymentMethod || PaymentMethod.UPI
  );
  const [paymentRefNumber, setPaymentRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Check if invoice exists for this order
  const { data: invoiceDoc, refetch: refetchInvoice } = useQuery({
    queryKey: ['order-invoice', order.id || order._id],
    queryFn: async () => {
      try {
        const orderId = (order.id || order._id)?.toString();
        const res = await apiClient.get('/invoices', {
          params: { orderId, search: order.orderNumber, limit: 50 },
        });
        const list =
          res.data?.data?.items ||
          res.data?.data?.invoices ||
          res.data?.items ||
          res.data?.invoices ||
          [];
        return (
          list.find(
            (inv: any) =>
              inv.orderId === orderId ||
              inv.orderId?.toString?.() === orderId ||
              inv.orderNumber === order.orderNumber
          ) || null
        );
      } catch {
        return null;
      }
    },
    enabled: Boolean(order?.orderNumber || order?.id || order?._id),
  });

  const handleDownloadInvoice = async (
    invoiceId: string,
    invoiceNumber: string,
    openInNewTab = false
  ) => {
    setIsDownloadingPdf(true);
    setActionError(null);
    const newTab = openInNewTab ? window.open('', '_blank') : null;
    try {
      const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });

      if (response.data instanceof Blob && response.data.type?.includes('json')) {
        const text = await response.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.message || parsed.error?.message || 'Invoice PDF generation error');
      }

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      if (newTab) {
        newTab.location.href = url;
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Tax-Invoice-${invoiceNumber}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 30000);
    } catch (err: any) {
      if (newTab) newTab.close();
      let msg = err?.message || 'Network error';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || parsed.error?.message || msg;
        } catch {}
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      const fullMsg = `Could not download invoice PDF: ${msg}`;
      setActionError(fullMsg);
      alert(fullMsg);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const generateInvoiceMutation = useMutation({
    mutationFn: async () => {
      const targetId = order.id || order._id;
      const res = await apiClient.post(`/invoices/generate-from-order/${targetId}`);
      return res.data?.data;
    },
    onSuccess: (newInvoice: any) => {
      const targetId = order.id || order._id;
      if (newInvoice) {
        queryClient.setQueryData(['order-invoice', targetId], newInvoice);
      }
      queryClient.invalidateQueries({ queryKey: ['order-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      refetchInvoice();
      const inv = newInvoice || {};
      const invId = inv.id || inv._id;
      const invNumber = inv.invoiceNumber || order.orderNumber;
      if (invId) {
        handleDownloadInvoice(invId, invNumber, false);
      }
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to generate tax invoice';
      setActionError(msg);
      alert(msg);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      reason,
      dispatchDetails,
      pickupDetails,
    }: {
      status: OrderStatus;
      reason?: string;
      dispatchDetails?: any;
      pickupDetails?: any;
    }) => {
      const targetId = order.id || order._id;
      return apiClient.patch(`/orders/${targetId}/status`, {
        status,
        reason,
        dispatchDetails,
        pickupDetails,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowDispatchPrompt(false);
      setShowPickupPrompt(false);
      onClose();
    },
    onError: (err: any) => {
      setActionError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Failed to update order status'
      );
    },
  });

  const retryNotificationMutation = useMutation({
    mutationFn: async (status: string) => {
      const targetId = order.id || order._id;
      setRetryingStatus(status);
      return apiClient.post(`/orders/${targetId}/retry-notification`, { status });
    },
    onSuccess: () => {
      setRetryingStatus(null);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      setRetryingStatus(null);
      setActionError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Failed to resend customer notification'
      );
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: {
      paymentMethod: string;
      referenceNumber: string;
      amountPaise?: number;
      notes?: string;
    }) => {
      const targetId = order.id || order._id;
      return apiClient.post(`/orders/${targetId}/record-payment`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowRecordPaymentModal(false);
      setPaymentRefNumber('');
      setPaymentNotes('');
      setPaymentError(null);
    },
    onError: (err: any) => {
      setPaymentError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Failed to record offline payment'
      );
    },
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
      case OrderStatus.SUBMITTED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Pending Review</span>
          </span>
        );
      case OrderStatus.APPROVED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Approved</span>
          </span>
        );
      case OrderStatus.PROCESSING:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center space-x-1">
            <Package className="h-3 w-3" />
            <span>Picking & Packing</span>
          </span>
        );
      case OrderStatus.DISPATCHED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center space-x-1">
            <Truck className="h-3 w-3" />
            <span>Dispatched</span>
          </span>
        );
      case OrderStatus.PICKED_UP:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Picked Up</span>
          </span>
        );
      case OrderStatus.DELIVERED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Delivered & Invoiced</span>
          </span>
        );
      case OrderStatus.CANCELLED:
      case OrderStatus.REJECTED:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center space-x-1">
            <XCircle className="h-3 w-3" />
            <span>{status === OrderStatus.CANCELLED ? 'Cancelled' : 'Rejected'}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'successful':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center space-x-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>PAID</span>
          </span>
        );
      case 'partially_paid':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center space-x-1">
            <Clock className="h-3 w-3 text-amber-600" />
            <span>PARTIALLY PAID</span>
          </span>
        );
      case 'refunded':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center space-x-1">
            <span>REFUNDED</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center space-x-1">
            <Clock className="h-3 w-3 text-rose-600" />
            <span>UNPAID</span>
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center !m-0 p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-[#F0E0D5] max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-[#FFF1E8] border border-[#F0E0D5] rounded-xl flex items-center justify-center text-[#F47732]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-base font-bold text-[#292929]">{order.orderNumber}</h2>
                {getStatusBadge(order.status)}
                {getPaymentStatusBadge(order.paymentStatus)}
              </div>
              <p className="text-xs text-[#737373] mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleString()} by{' '}
                {order.placedByName || 'Retailer'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['orders'] });
                queryClient.invalidateQueries({ queryKey: ['order-invoice'] });
              }}
              title="Refresh order details"
              className="text-[#737373] hover:text-[#F47732] p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#F0E0D5] transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="text-[#737373] hover:text-[#292929] p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-[#F0E0D5] transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto touch-scroll space-y-6 flex-1 text-xs bg-white">
          {/* Action Error */}
          {actionError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              {actionError}
            </div>
          )}

          {/* Customer & Delivery Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FFF8F3]/40 p-4 rounded-xl border border-[#F0E0D5]">
            <div>
              <span className="font-bold text-[#737373] uppercase tracking-wider text-[10px] block mb-1">
                Customer & Account Info
              </span>
              <p className="font-bold text-sm text-[#292929]">{order.retailerName}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                  Code: {order.retailerCode || (order.retailerId ? String(order.retailerId).slice(-6).toUpperCase() : 'N/A')}
                </span>
                <span className="bg-[#FFF1E7] text-[#E0620E] font-semibold px-2 py-0.5 rounded border border-[#FDE4D2]">
                  Type: {order.retailerType || order.customerType || 'Wholesale Retailer'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[#737373] text-[11px]">Payment Mode:</span>
                <span className="font-semibold text-[#292929] text-[11px] uppercase">
                  {order.paymentMethod?.replace(/_/g, ' ')}
                </span>
                {getPaymentStatusBadge(order.paymentStatus)}
              </div>
              {order.internalNotes && (
                <p className="text-[10px] text-slate-600 bg-slate-100 p-1.5 rounded border border-slate-200 mt-2 font-mono whitespace-pre-line">
                  {order.internalNotes}
                </p>
              )}
            </div>

            <div>
              <span className="font-bold text-[#737373] uppercase tracking-wider text-[10px] block mb-1">
                Delivery Address
              </span>
              <div className="flex items-start space-x-1.5 text-[#737373]">
                <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-[#F47732]" />
                <span>
                  {order.deliveryAddress?.street}, {order.deliveryAddress?.city},{' '}
                  {order.deliveryAddress?.state} - {order.deliveryAddress?.pincode}
                </span>
              </div>
              {order.customerNotes && (
                <div className="mt-2 text-[11px] text-[#737373] bg-white p-2 rounded-lg border border-[#F0E0D5]">
                  <span className="font-semibold text-[#292929]">Notes:</span>{' '}
                  {order.customerNotes}
                </div>
              )}
            </div>
          </div>

          {/* Dispatch / Consignment Info if Dispatched */}
          {order.dispatchDetails && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-blue-900 uppercase tracking-wider text-[10px] block">
                  Consignment & Dispatch Details
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#292929]">
                  {order.dispatchDetails.courierName && (
                    <span>Courier: <strong>{order.dispatchDetails.courierName}</strong></span>
                  )}
                  {order.dispatchDetails.trackingNumber && (
                    <span>Docket: <strong className="font-mono text-[#F47732]">{order.dispatchDetails.trackingNumber}</strong></span>
                  )}
                  {order.dispatchDetails.dispatchedAt && (
                    <span className="text-[#737373]">Dispatched: {new Date(order.dispatchDetails.dispatchedAt).toLocaleString()}</span>
                  )}
                </div>
                {order.dispatchDetails.transportDetails && (
                  <p className="text-[11px] text-[#737373] mt-0.5">{order.dispatchDetails.transportDetails}</p>
                )}
              </div>
              {order.dispatchDetails.trackingUrl && (
                <a
                  href={order.dispatchDetails.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 self-start sm:self-center"
                >
                  <span>Track Consignment</span>
                  <Truck className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Pickup Details if Picked Up */}
          {order.pickupDetails && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-1">
              <span className="font-bold text-emerald-900 uppercase tracking-wider text-[10px] block">
                Pickup & Collection Record
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#292929]">
                {order.pickupDetails.pickedUpAt && (
                  <span>Time: <strong>{new Date(order.pickupDetails.pickedUpAt).toLocaleString()}</strong></span>
                )}
                {order.pickupDetails.pickupLocation && (
                  <span>Location: <strong>{order.pickupDetails.pickupLocation}</strong></span>
                )}
                {order.pickupDetails.collectedBy && (
                  <span>Collected By: <strong>{order.pickupDetails.collectedBy}</strong></span>
                )}
              </div>
              {order.pickupDetails.notes && (
                <p className="text-[11px] text-[#737373] mt-0.5 font-mono">{order.pickupDetails.notes}</p>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <span>Itemized Line Items Snapshot</span>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full normal-case tracking-normal">
                  {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
                </span>
              </h3>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto touch-scroll">
                <table className="min-w-[680px] w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 pl-4 pr-3 text-left">Item Details</th>
                      <th className="py-3 px-3 text-right">Unit Price</th>
                      <th className="py-3 px-3 text-center">Qty</th>
                      <th className="py-3 px-3 text-right">Taxable</th>
                      <th className="py-3 px-3 text-right">GST</th>
                      <th className="py-3 pl-3 pr-4 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {order.items?.map((item: any, idx: number) => {
                      const gstTotal = (item.cgstPaise || 0) + (item.sgstPaise || 0) + (item.igstPaise || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 pl-4 pr-3 text-left align-top max-w-[280px]">
                            <p className="font-semibold text-slate-900 text-[13px] leading-snug">
                              {item.productNameSnapshot}
                            </p>
                            {item.variantNameSnapshot && (
                              <div className="mt-1">
                                <span className="text-[10px] font-semibold text-[#E0620E] bg-[#FFF1E7] px-2 py-0.5 rounded-md inline-block border border-[#FDE4D2]">
                                  Variant: {item.variantNameSnapshot}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                SKU: {item.variantSkuSnapshot || item.skuSnapshot}
                              </span>
                              {item.tierAppliedSnapshot && (
                                <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                  Qty Tier (Min {item.tierMinQuantitySnapshot}+)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right align-top font-medium text-slate-800 text-[13px] whitespace-nowrap">
                            {formatPaiseToINR(item.unitPricePaiseSnapshot)}
                          </td>
                          <td className="py-3.5 px-3 text-center align-top whitespace-nowrap">
                            <span className="inline-flex items-center justify-center font-bold text-slate-900 text-[13px] min-w-[32px] h-7 bg-slate-100 rounded-md border border-slate-200/70 px-2">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right align-top font-medium text-slate-800 text-[13px] whitespace-nowrap">
                            {formatPaiseToINR(item.taxableAmountPaise)}
                          </td>
                          <td className="py-3.5 px-3 text-right align-top text-slate-700 whitespace-nowrap">
                            <div className="font-medium text-slate-800 text-[13px]">
                              {formatPaiseToINR(gstTotal)}
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                              ({item.gstRatePercentSnapshot}%)
                            </span>
                          </td>
                          <td className="py-3.5 pl-3 pr-4 text-right align-top font-bold text-slate-900 text-[13px] whitespace-nowrap">
                            {formatPaiseToINR(item.lineTotalPaise)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-sm">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-semibold text-slate-900 text-[13px]">
                  {formatPaiseToINR(order.taxableAmountPaise)}
                </span>
              </div>
              {order.totalCgstPaise > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>CGST:</span>
                  <span className="font-semibold text-slate-900 text-[13px]">
                    {formatPaiseToINR(order.totalCgstPaise)}
                  </span>
                </div>
              )}
              {order.totalSgstPaise > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>SGST:</span>
                  <span className="font-semibold text-slate-900 text-[13px]">
                    {formatPaiseToINR(order.totalSgstPaise)}
                  </span>
                </div>
              )}
              {order.totalIgstPaise > 0 && (
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>IGST:</span>
                  <span className="font-semibold text-slate-900 text-[13px]">
                    {formatPaiseToINR(order.totalIgstPaise)}
                  </span>
                </div>
              )}
              <div className="pt-2.5 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-700">Grand Total:</span>
                <span className="text-base font-extrabold text-[#F47721]">
                  {formatPaiseToINR(order.grandTotalPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: B2B Payment & Offline Settlement Management */}
          <div className="border border-[#F0E0D5] rounded-xl p-4 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Banknote className="h-4 w-4 text-[#F47732]" />
                <h3 className="font-bold text-[#292929] uppercase tracking-wider text-[11px]">
                  B2B Payment Settlement & Offline Recording
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {getPaymentStatusBadge(order.paymentStatus)}
                {canRecordPayment && remainingBalancePaise > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentAmountRupees((remainingBalancePaise / 100).toFixed(2));
                      setPaymentError(null);
                      setShowRecordPaymentModal(true);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#F47721] hover:bg-[#E0620E] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Record Offline Payment</span>
                  </button>
                )}
              </div>
            </div>

            {/* Financial Balances Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Total Order Value
                </span>
                <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatPaiseToINR(order.grandTotalPaise)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Commercial Invoice Total</span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
                <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">
                  Amount Verified Paid
                </span>
                <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">
                  {formatPaiseToINR(totalPaidPaise)}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  {order.payments?.length || 0} transaction{order.payments?.length === 1 ? '' : 's'} recorded
                </span>
              </div>

              <div className={`rounded-lg p-3 border ${
                remainingBalancePaise > 0
                  ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                  : 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  Remaining Balance Due
                </span>
                <span className="text-base font-extrabold mt-0.5 block">
                  {formatPaiseToINR(remainingBalancePaise)}
                </span>
                <span className="text-[10px] opacity-80 block mt-0.5">
                  {remainingBalancePaise > 0 ? 'Awaiting verification/receipt' : 'Fully Settled'}
                </span>
              </div>
            </div>

            {/* Payment Transactions Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[#737373] uppercase tracking-wider text-[10px]">
                  Payment Transactions Ledger ({order.payments?.length || 0})
                </span>
              </div>

              {order.payments && order.payments.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                        <th className="py-2 px-3">Date & Time</th>
                        <th className="py-2 px-3">Method</th>
                        <th className="py-2 px-3">Reference / UTR</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Verified By</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {order.payments.map((pm: any, pIdx: number) => (
                        <tr key={pIdx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                            {pm.verifiedAt ? new Date(pm.verifiedAt).toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 uppercase px-1.5 py-0.5 bg-slate-100 rounded text-[10px] border border-slate-200">
                              {pm.paymentMethod?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-900 font-bold whitespace-nowrap">
                            {pm.referenceNumber}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 whitespace-nowrap">
                            {formatPaiseToINR(pm.amountPaise)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                            <span className="font-medium text-slate-800">{pm.verifiedByName || 'Staff'}</span>
                            {pm.verifiedByRole && (
                              <span className="text-[10px] text-slate-400 block font-mono">({pm.verifiedByRole})</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={pm.notes}>
                            {pm.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-500">
                  No payment transactions recorded yet. Balance outstanding: <span className="font-bold text-slate-800">{formatPaiseToINR(remainingBalancePaise)}</span>.
                </div>
              )}
            </div>
          </div>

          {/* Section 8: Order Status Audit History Timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="border border-[#F0E0D5] rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4 text-[#F47732]" />
                <h3 className="font-bold text-[#292929] uppercase tracking-wider text-[11px]">
                  Order Status Audit History ({order.statusHistory.length})
                </h3>
              </div>
              <div className="space-y-2">
                {order.statusHistory.map((item: any, hIdx: number) => (
                  <div
                    key={hIdx}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold uppercase text-slate-600">
                        {item.previousStatus}
                      </span>
                      <span className="text-slate-400 font-bold">→</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 font-bold uppercase text-[#F47721]">
                        {item.newStatus}
                      </span>
                      {item.reason && (
                        <span className="text-slate-600 text-[11px] italic">
                          "{item.reason}"
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 self-end sm:self-auto">
                      <span>By: <strong className="text-slate-700">{item.changedByName || 'Admin'}</strong> ({item.changedByRole || 'STAFF'})</span>
                      <span>•</span>
                      <span>{item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Email Notifications Audit Log */}
          <div className="border border-[#F0E0D5] rounded-xl p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-[#F47732]" />
                <h3 className="font-bold text-[#292929] uppercase tracking-wider text-[11px]">
                  Customer Email Notifications
                </h3>
              </div>
              <span className="text-[10px] text-[#737373]">
                Automated status notifications sent to retailer
              </span>
            </div>

            {order.notifications && order.notifications.length > 0 ? (
              <div className="space-y-2">
                {order.notifications.map((notif: any, idx: number) => {
                  const isRetrying = retryingStatus === notif.status;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border text-xs gap-2 ${
                        notif.success
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-rose-50/50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start sm:items-center space-x-2.5">
                        {notif.success ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[#292929]">
                              {notif.status?.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] font-medium text-[#292929]">
                              {notif.recipientEmail}
                            </span>
                          </div>
                          {!notif.success && notif.errorMessage && (
                            <p className="text-[10px] text-rose-700 mt-0.5 font-mono">
                              Error: {notif.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-auto">
                        <span className="text-[10px] text-[#737373]">
                          {notif.sentAt ? new Date(notif.sentAt).toLocaleString() : 'Pending'}
                        </span>
                        {!notif.success && isStaff && (
                          <button
                            type="button"
                            onClick={() => retryNotificationMutation.mutate(notif.status)}
                            disabled={isRetrying || retryNotificationMutation.isPending}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded shadow-xs transition-colors"
                          >
                            <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                            <span>{isRetrying ? 'Retrying...' : 'Retry Email'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#737373] text-center">
                No notification records logged yet for this order. Status emails trigger automatically upon order approval, dispatch, or pickup.
              </div>
            )}
          </div>

          {/* Cancellation Reason if Cancelled */}
          {order.cancellationReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800">
              <span className="font-bold block text-[11px]">Cancellation Reason:</span>
              <p className="mt-0.5">{order.cancellationReason}</p>
            </div>
          )}

          {/* Cancel Prompt Input */}
          {showCancelPrompt && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-amber-900 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Confirm Order Cancellation</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Cancelling this order will release and restore reserved stock back to active inventory in the warehouse catalogue.
              </p>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (required)..."
                className="w-full p-2 text-xs border border-amber-300 rounded-lg bg-white"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowCancelPrompt(false)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#F0E0D5] text-[#292929] rounded-lg hover:bg-[#FFF8F3]"
                >
                  Dismiss
                </button>
                <button
                  onClick={() =>
                    updateStatusMutation.mutate({
                      status: OrderStatus.CANCELLED,
                      reason: cancelReason || 'Cancelled by staff/retailer',
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                  className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Confirm & Release Reservation
                </button>
              </div>
            </div>
          )}

          {/* Reject Prompt Input */}
          {showRejectPrompt && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-rose-900 font-bold">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>Confirm Order Rejection</span>
              </div>
              <p className="text-[11px] text-rose-800">
                Rejecting Order #{order.orderNumber} will cancel the booking, release any catalogue inventory reservations, and notify the customer.
              </p>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                className="w-full p-2 text-xs border border-rose-300 rounded-lg bg-white text-slate-800"
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectPrompt(false);
                    setRejectReason('');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#F0E0D5] text-[#292929] rounded-lg hover:bg-[#FFF8F3]"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rejectReason.trim()) {
                      setActionError('Please provide a reason for order rejection');
                      return;
                    }
                    updateStatusMutation.mutate({
                      status: OrderStatus.REJECTED,
                      reason: rejectReason.trim(),
                    });
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors flex items-center space-x-1"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <span>Confirm Rejection</span>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-5 bg-[#FFF8F3]/30 border-t border-[#F0E0D5] flex flex-wrap items-center justify-between gap-3">
          <div>
            {![OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(
              order.status
            ) && (
              <button
                type="button"
                onClick={() => {
                  setShowCancelPrompt((prev) => !prev);
                  setShowRejectPrompt(false);
                }}
                className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
              >
                Cancel Order
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* PENDING / SUBMITTED: Approve or Reject */}
            {isStaff && (order.status === OrderStatus.SUBMITTED || order.status === OrderStatus.PENDING) && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    updateStatusMutation.mutate({ status: OrderStatus.APPROVED })
                  }
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 bg-[#F47721] hover:bg-[#E0620E] text-white text-xs font-bold rounded-lg shadow-sm shadow-[#F47721]/20 transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Approving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Approve Order</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRejectPrompt((prev) => !prev);
                    setShowCancelPrompt(false);
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-bold rounded-lg transition-colors flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Reject Order</span>
                </button>
              </>
            )}

            {/* APPROVED: Start Processing */}
            {isStaff && order.status === OrderStatus.APPROVED && (
              <button
                type="button"
                onClick={() =>
                  updateStatusMutation.mutate({ status: OrderStatus.PROCESSING })
                }
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Package className="h-3.5 w-3.5" />
                    <span>Start Picking & Packing</span>
                  </>
                )}
              </button>
            )}

            {/* PROCESSING: Dispatch Consignment or Mark Picked Up */}
            {isStaff && order.status === OrderStatus.PROCESSING && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowDispatchPrompt(true);
                    setShowPickupPrompt(false);
                    setShowCancelPrompt(false);
                    setShowRejectPrompt(false);
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Dispatch Consignment</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPickupPrompt(true);
                    setShowDispatchPrompt(false);
                    setShowCancelPrompt(false);
                    setShowRejectPrompt(false);
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Picked Up</span>
                </button>
              </>
            )}

            {/* DISPATCHED: Mark Delivered or Picked Up */}
            {isStaff && order.status === OrderStatus.DISPATCHED && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    updateStatusMutation.mutate({ status: OrderStatus.DELIVERED })
                  }
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Marking Delivered...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Delivered</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPickupPrompt(true);
                    setShowDispatchPrompt(false);
                    setShowCancelPrompt(false);
                    setShowRejectPrompt(false);
                  }}
                  disabled={updateStatusMutation.isPending}
                  className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark Picked Up</span>
                </button>
              </>
            )}

            {/* PICKED_UP: Mark Delivered */}
            {isStaff && order.status === OrderStatus.PICKED_UP && (
              <button
                type="button"
                onClick={() =>
                  updateStatusMutation.mutate({ status: OrderStatus.DELIVERED })
                }
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Marking Delivered...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Mark Delivered</span>
                  </>
                )}
              </button>
            )}

            {/* Direct Tax Invoice Actions */}
            {invoiceDoc ? (
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadInvoice(
                      invoiceDoc.id || invoiceDoc._id,
                      invoiceDoc.invoiceNumber,
                      false
                    )
                  }
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center space-x-1 px-3 py-2 bg-[#FFF8F3] hover:bg-[#FFF1E8] border border-[#F47732] text-[#F47732] text-xs font-bold rounded-lg shadow-xs transition-colors"
                  title={`Tax Invoice #${invoiceDoc.invoiceNumber}`}
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1 text-[#F47732]" />
                  )}
                  <span>Download Tax Invoice PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownloadInvoice(
                      invoiceDoc.id || invoiceDoc._id,
                      invoiceDoc.invoiceNumber,
                      true
                    )
                  }
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center space-x-1 px-2.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                  title="View / Print Tax Invoice in new window"
                >
                  <Eye className="h-3.5 w-3.5 mr-1 text-slate-600" />
                  <span>View PDF</span>
                </button>
              </div>
            ) : (
              isStaff &&
              order.status !== OrderStatus.CANCELLED &&
              order.status !== OrderStatus.REJECTED && (
                <button
                  type="button"
                  onClick={() => generateInvoiceMutation.mutate()}
                  disabled={generateInvoiceMutation.isPending || isDownloadingPdf}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-[#FFF8F3] border border-[#F47732]/40 hover:border-[#F47732] text-[#292929] hover:text-[#F47732] text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  {generateInvoiceMutation.isPending || isDownloadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-[#F47732]" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 mr-1 text-[#F47732]" />
                  )}
                  <span>Generate Invoice PDF</span>
                </button>
              )
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#F0E0D5] hover:bg-[#FFF8F3] text-[#292929] text-xs font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Record Offline Payment Modal Dialog */}
      {showRecordPaymentModal && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#F0E0D5] max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-[#FFF8F3] border-b border-[#F0E0D5] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="h-8 w-8 bg-[#FFF1E8] border border-[#F0E0D5] rounded-lg flex items-center justify-center text-[#F47721]">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#292929]">Record Offline Payment</h3>
                  <p className="text-[10px] text-[#737373]">Order #{order.orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {paymentError}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Remaining Due</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatPaiseToINR(remainingBalancePaise)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Order Grand Total</span>
                  <span className="text-xs font-bold text-slate-700">
                    {formatPaiseToINR(order.grandTotalPaise)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Amount to Record (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={(remainingBalancePaise / 100).toFixed(2)}
                  value={paymentAmountRupees}
                  onChange={(e) => setPaymentAmountRupees(e.target.value)}
                  placeholder="Enter payment amount in Rupees"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-[#F47721]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Cannot exceed remaining balance of {formatPaiseToINR(remainingBalancePaise)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethodSelected}
                  onChange={(e) => setPaymentMethodSelected(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-[#F47721]"
                >
                  <option value={PaymentMethod.UPI}>UPI Transfer (PhonePe / GPay / BHIM)</option>
                  <option value={PaymentMethod.NEFT_RTGS_IMPS}>NEFT / RTGS / IMPS Bank Transfer</option>
                  <option value={PaymentMethod.CASH}>Cash on Hand / Counter Deposit</option>
                  <option value={PaymentMethod.CHEQUE}>Cheque Deposit / Clearance</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Transaction / UTR / Cheque Ref No. <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  placeholder="e.g. UTR123456789 or CHQ-002341"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Verification Notes (Optional)
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Verified with Bank statement at 11:30 AM"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#F47721]"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const amtNumber = parseFloat(paymentAmountRupees);
                  if (isNaN(amtNumber) || amtNumber <= 0) {
                    setPaymentError('Please enter a valid payment amount');
                    return;
                  }
                  const amountPaise = Math.round(amtNumber * 100);
                  if (amountPaise > remainingBalancePaise) {
                    setPaymentError(`Amount cannot exceed remaining balance of ${formatPaiseToINR(remainingBalancePaise)}`);
                    return;
                  }
                  if (!paymentRefNumber.trim()) {
                    setPaymentError('Reference number / UTR / Cheque number is required');
                    return;
                  }
                  recordPaymentMutation.mutate({
                    paymentMethod: paymentMethodSelected,
                    referenceNumber: paymentRefNumber.trim(),
                    amountPaise,
                    notes: paymentNotes.trim() || undefined,
                  });
                }}
                disabled={recordPaymentMutation.isPending}
                className="px-4 py-2 text-xs font-bold bg-[#F47721] hover:bg-[#E0620E] text-white rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
              >
                {recordPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying & Recording...</span>
                  </>
                ) : (
                  <span>Confirm & Save Payment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Dispatch Order Consignment Modal Dialog */}
      <DispatchOrderModal
        order={order}
        isOpen={showDispatchPrompt}
        onClose={() => setShowDispatchPrompt(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          onClose();
        }}
      />

      {/* Standalone Order Pickup Modal Dialog */}
      <PickupOrderModal
        order={order}
        isOpen={showPickupPrompt}
        onClose={() => setShowPickupPrompt(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          onClose();
        }}
      />
    </>
  );
};
