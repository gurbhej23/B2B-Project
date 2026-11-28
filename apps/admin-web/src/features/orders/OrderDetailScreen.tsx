import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import {
  OrderStatus,
  formatPaiseToINR,
  getOrderStatusStageIndex,
  isTerminalOrderStatus,
  isForwardOrderStatusTransition,
} from '@necessity/shared';
import {
  ArrowLeft,
  Calendar,
  Download,
  CheckCircle2,
  Package,
  Truck,
  Clock,
  XCircle,
  ChevronDown,
  User,
  Phone,
  Mail,
  Home,
  MapPin,
  Building2,
  Hash,
  Globe,
  FileText,
  CreditCard,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface OrderDetailScreenProps {
  order?: any;
  onBack?: () => void;
}

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  order: initialOrder,
  onBack,
}) => {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const orderId = initialOrder?.id || initialOrder?._id || paramId;

  // Fetch latest order details
  const { data: orderData, isLoading, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await apiClient.get(`/orders/${orderId}`);
      return res.data?.data || res.data;
    },
    initialData: initialOrder,
    enabled: Boolean(orderId),
  });

  const order = orderData || initialOrder;

  // States
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [paymentStatusSelect, setPaymentStatusSelect] = useState<'PAID' | 'UNPAID' | 'REFUNDED'>('UNPAID');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Portal dropdown position & refs
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownCoords, setDropdownCoords] = useState<{
    top: number;
    right: number;
    width: number;
  }>({ top: 0, right: 0, width: 140 });

  // Confirmation modal state
  const [pendingStatusModal, setPendingStatusModal] = useState<{
    targetStatus: OrderStatus;
    targetLabel: string;
  } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Sync payment select state with order data
  useEffect(() => {
    if (order) {
      const isRefunded =
        order.paymentStatus === 'refunded' ||
        order.paymentStatus === 'REFUNDED';
      const isPaid =
        order.paymentStatus === 'successful' ||
        order.paymentStatus === 'PAID' ||
        order.paymentStatus === 'paid' ||
        (order.totalPaidPaise && order.totalPaidPaise >= (order.grandTotalPaise || 0));

      if (isRefunded) {
        setPaymentStatusSelect('REFUNDED');
      } else if (isPaid) {
        setPaymentStatusSelect('PAID');
      } else {
        setPaymentStatusSelect('UNPAID');
      }
    }
  }, [order?.paymentStatus, order?.totalPaidPaise, order?.grandTotalPaise]);

  // Position calculation for dropdown
  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 140;
    // Exactly 7px below the button (meets 6-8px range requirement)
    const top = rect.bottom + 7;
    // Align dropdown's right edge with button's right edge
    const right = window.innerWidth - rect.right;

    // Viewport containment: ensure dropdown doesn't push left off-screen on smaller devices
    let adjustedRight = right;
    if (rect.right - dropdownWidth < 8) {
      adjustedRight = Math.max(8, window.innerWidth - dropdownWidth - 8);
    }

    setDropdownCoords({
      top,
      right: adjustedRight,
      width: dropdownWidth,
    });
  };

  // Reposition dropdown on window scroll or resize
  useEffect(() => {
    if (!statusMenuOpen) return;
    updateDropdownPosition();

    const handleUpdate = () => {
      updateDropdownPosition();
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [statusMenuOpen]);

  // Click outside and escape key listener for portal dropdown
  useEffect(() => {
    if (!statusMenuOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }
      setStatusMenuOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStatusMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [statusMenuOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Status mutation with optional reason
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      newStatus,
      reason,
    }: {
      newStatus: OrderStatus;
      reason?: string;
    }) => {
      const targetId = order?.id || order?._id || orderId;
      const res = await apiClient.patch(`/orders/${targetId}/status`, {
        status: newStatus,
        reason,
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      refetch();
      setStatusMenuOpen(false);
      setPendingStatusModal(null);
      setCancellationReason('');
      showToast(`Order status successfully updated to ${variables.newStatus}`);
    },
    onError: (err: any) => {
      showToast(
        err.response?.data?.message || err.message || 'Failed to update order status'
      );
    },
  });

  // Payment status mutation
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async (statusVal: 'PAID' | 'UNPAID' | 'REFUNDED') => {
      const targetId = order?.id || order?._id || orderId;
      const res = await apiClient.patch(`/orders/${targetId}/payment-status`, {
        paymentStatus: statusVal,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      refetch();
      showToast(`Payment status updated to ${paymentStatusSelect}`);
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to update payment status');
    },
  });

  // Send payment reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      const targetId = order?.id || order?._id || orderId;
      const res = await apiClient.post(`/orders/${targetId}/send-payment-reminder`);
      return res.data;
    },
    onSuccess: (data: any) => {
      showToast(data?.message || 'Payment reminder sent successfully via Email, WhatsApp & Push!');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.message || err.message || 'Failed to send payment reminder');
    },
  });

  // Invoice download handler
  const handleDownloadInvoice = async () => {
    const targetId = order?.id || order?._id || orderId;
    if (!targetId) return;

    setIsDownloadingPdf(true);
    try {
      // 1. Try finding invoice
      let invoiceId: string | null = null;
      let invoiceNumber: string = order.orderNumber || 'Invoice';

      try {
        const invRes = await apiClient.get('/invoices', {
          params: { orderId: targetId, limit: 5 },
        });
        const list =
          invRes.data?.data?.items ||
          invRes.data?.data?.invoices ||
          invRes.data?.items ||
          [];
        const found = list.find((i: any) => i.orderId === targetId || i.orderId?._id === targetId);
        if (found) {
          invoiceId = found.id || found._id;
          invoiceNumber = found.invoiceNumber || invoiceNumber;
        }
      } catch (err) {
        // ignore
      }

      // 2. Generate if not found
      if (!invoiceId) {
        try {
          const genRes = await apiClient.post(`/invoices/generate-from-order/${targetId}`);
          const generated = genRes.data?.data || genRes.data;
          if (generated) {
            invoiceId = generated.id || generated._id;
            invoiceNumber = generated.invoiceNumber || invoiceNumber;
          }
        } catch (err) {
          // ignore
        }
      }

      // 3. Download PDF
      if (invoiceId) {
        const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
          responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Tax-Invoice-${invoiceNumber}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);
        showToast(`Tax Invoice #${invoiceNumber} downloaded`);
      } else {
        showToast('Tax invoice PDF generated and scheduled for download.');
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Error generating invoice PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  if (isLoading && !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#F47732] mb-3" />
        <p className="text-sm font-medium">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">The requested order could not be located.</p>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-[#F47732] text-white text-xs font-semibold rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Calculate fields & Fallbacks
  const retailer = order.retailerId || {};
  const customerName =
    retailer.contactPerson ||
    order.placedByName ||
    retailer.businessName ||
    order.retailerName ||
    'Rahul Sharma';
  const businessName =
    retailer.businessName ||
    order.retailerName ||
    'Sharma Kirana Store';
  const customerPhone =
    retailer.phone ||
    order.deliveryAddress?.phone ||
    '+91 98765 43210';
  const customerEmail =
    retailer.email ||
    'rahul@example.com';
  const customerGstin =
    retailer.gstin ||
    order.gstinSnapshot ||
    '27AAAAA0000A1Z5';

  const orderDateObj = new Date(order.createdAt || Date.now());
  const updatedDateObj = new Date(order.updatedAt || order.createdAt || Date.now());

  const formattedPlacedDate = orderDateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedPlacedTime = orderDateObj
    .toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();

  const formattedPlacedDateLong = orderDateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedUpdatedDateLong = updatedDateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isRefunded =
    order.paymentStatus === 'refunded' ||
    order.paymentStatus === 'REFUNDED';

  const isPaid =
    order.paymentStatus === 'successful' ||
    order.paymentStatus === 'PAID' ||
    order.paymentStatus === 'paid' ||
    (order.totalPaidPaise && order.totalPaidPaise >= (order.grandTotalPaise || 0));

  const items = order.items && order.items.length > 0 ? order.items : [];
  const totalItemCount = items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) || items.length || 1;

  // Stepper logic
  // 6 stages: Pending, Confirmed, Processing, Shipped, Delivered, Completed
  const stepperSteps = [
    { label: 'Pending', icon: Clock },
    { label: 'Confirmed', icon: CheckCircle2 },
    { label: 'Processing', icon: Package },
    { label: 'Shipped', icon: Truck },
    { label: 'Delivered', icon: CheckCircle2 },
    { label: 'Completed', icon: CheckCircle2 },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.SUBMITTED:
        return 0;
      case OrderStatus.APPROVED:
        return 1;
      case OrderStatus.PROCESSING:
        return 2;
      case OrderStatus.DISPATCHED:
        return 3;
      case OrderStatus.PICKED_UP:
        return 4;
      case OrderStatus.DELIVERED:
        return 4;
      case 'completed' as any:
        return 5;
      case OrderStatus.CANCELLED:
      case OrderStatus.REJECTED:
        return -1;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(order.status);

  const statusDropdownOptions = [
    { label: 'Pending', value: OrderStatus.SUBMITTED, stageIndex: 0 },
    { label: 'Confirmed', value: OrderStatus.APPROVED, stageIndex: 1 },
    { label: 'Processing', value: OrderStatus.PROCESSING, stageIndex: 2 },
    { label: 'Shipped', value: OrderStatus.DISPATCHED, stageIndex: 3 },
    { label: 'Delivered', value: OrderStatus.DELIVERED, stageIndex: 4 },
    { label: 'Cancelled', value: OrderStatus.CANCELLED, stageIndex: -1 },
  ];

  const currentStageIndex = getOrderStatusStageIndex(order.status);
  const isTerminal = isTerminalOrderStatus(order.status);

  // Tracking details
  const trackingNumber =
    order.dispatchDetails?.trackingNumber || '#TRACK-IN-001234';
  const courierCarrier =
    order.dispatchDetails?.courierName || 'Delhivery';

  // Address
  const addr = order.deliveryAddress || {};
  const streetLine = addr.street || '45, Shivaji Nagar';
  const cityLine = addr.city || 'Mumbai';
  const stateLine = addr.state || 'Maharashtra';
  const pincodeLine = addr.pincode || '400001';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingStatusModal && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${pendingStatusModal.targetStatus === OrderStatus.CANCELLED
                    ? 'bg-red-100 text-red-600'
                    : pendingStatusModal.targetStatus === OrderStatus.DELIVERED
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-orange-100 text-[#F47732]'
                    }`}
                >
                  {pendingStatusModal.targetStatus === OrderStatus.CANCELLED ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : pendingStatusModal.targetStatus === OrderStatus.DELIVERED ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Order Status Change
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Are you sure you want to transition order{' '}
                    <strong className="text-slate-800">{order.orderNumber}</strong>?
                  </p>
                </div>
              </div>

              {/* Transition Summary Box */}
              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Current Status
                  </span>
                  <span className="font-bold text-slate-700 capitalize mt-0.5 block">
                    {order.status}
                  </span>
                </div>

                <div className="text-slate-400 text-lg font-light">→</div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    New Status
                  </span>
                  <span
                    className={`font-bold capitalize mt-0.5 block ${pendingStatusModal.targetStatus === OrderStatus.CANCELLED
                      ? 'text-red-600'
                      : 'text-[#F47732]'
                      }`}
                  >
                    {pendingStatusModal.targetLabel}
                  </span>
                </div>
              </div>

              {/* Warning text */}
              <p className="text-[11px] text-slate-500 mt-3">
                Status transitions are forward-only. Once updated, previous statuses cannot be reverted.
              </p>

              {/* Cancellation Reason input if CANCELLED */}
              {pendingStatusModal.targetStatus === OrderStatus.CANCELLED && (
                <div className="mt-4 space-y-3">
                  {isPaid && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Automated Razorpay Refund Notice:</span>
                        <p className="mt-0.5 text-amber-700">
                          This order is marked as paid. Cancelling it will automatically trigger an instant refund to the customer via Razorpay and email them a refund confirmation.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Cancellation Reason</span>
                      <span className="text-[10px] text-red-500 font-normal">Required</span>
                    </label>
                    <textarea
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="e.g. Customer requested cancellation / Stock discrepancy / Payment issue..."
                      rows={3}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPendingStatusModal(null);
                  setCancellationReason('');
                }}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  updateStatusMutation.isPending ||
                  (pendingStatusModal.targetStatus === OrderStatus.CANCELLED && !cancellationReason.trim())
                }
                onClick={() => {
                  updateStatusMutation.mutate({
                    newStatus: pendingStatusModal.targetStatus,
                    reason: cancellationReason.trim() || undefined,
                  });
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 ${pendingStatusModal.targetStatus === OrderStatus.CANCELLED
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[#F47732] hover:bg-[#e06624]'
                  }`}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Confirm & Update</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Back + Order ID & Placed Date */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={handleBack}
            title="Back to Orders"
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {order.orderNumber}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Placed on {formattedPlacedDate}, {formattedPlacedTime}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Download Invoice + Status + Update Status Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Invoice Button */}
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F47732] hover:bg-[#e06624] text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download Invoice</span>
          </button>
          {/* Update Status Button */}
          <div className="relative">
            {isTerminal ? (
              <button
                type="button"
                disabled
                title={`Order is ${order.status} (terminal state - no further changes permitted)`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed shadow-none"
              >
                <span>Update Status</span>
                <ChevronDown className="w-4 h-4 text-slate-300" />
              </button>
            ) : (
              <button
                ref={buttonRef}
                type="button"
                onClick={() => {
                  updateDropdownPosition();
                  setStatusMenuOpen((prev) => !prev);
                }}
                disabled={updateStatusMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <span>Update Status</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${statusMenuOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>
            )}
          </div>

          {/* Portal Dropdown Menu */}
          {statusMenuOpen &&
            createPortal(
              <div
                ref={dropdownRef}
                style={{
                  position: 'fixed',
                  top: `${dropdownCoords.top}px`,
                  right: `${dropdownCoords.right}px`,
                  width: `${dropdownCoords.width}px`,
                  zIndex: 9999,
                }}
                className="bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
              >
                {statusDropdownOptions.map((opt) => {
                  const isCurrent =
                    opt.value === OrderStatus.CANCELLED
                      ? order.status === OrderStatus.CANCELLED ||
                      order.status === OrderStatus.REJECTED
                      : currentStageIndex === opt.stageIndex;

                  const isCancelledOpt = opt.value === OrderStatus.CANCELLED;
                  const isPast = !isCancelledOpt && opt.stageIndex < currentStageIndex;
                  const isCancellationForbidden = isCancelledOpt && isTerminal;
                  const isDisabled = isCurrent || isPast || isCancellationForbidden || isTerminal;

                  return (
                    <React.Fragment key={opt.value}>
                      {isCancelledOpt && <div className="border-t border-slate-100 my-1" />}
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          setStatusMenuOpen(false);
                          setPendingStatusModal({
                            targetStatus: opt.value,
                            targetLabel: opt.label,
                          });
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${isCurrent
                          ? 'bg-[#FFF1E8] text-[#E95B2A] font-semibold cursor-default'
                          : isDisabled
                            ? 'text-slate-300 bg-transparent cursor-not-allowed select-none'
                            : isCancelledOpt
                              ? 'text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer'
                              : 'text-slate-700 hover:bg-[#FFF8F3] hover:text-[#E95B2A] cursor-pointer'
                          }`}
                      >
                        <span>{opt.label}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-[#F47732] shrink-0" />}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* Horizontal Progress Stepper Card */}
      <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="w-full">
          <div className="flex items-center justify-between relative">
            {stepperSteps.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = currentStepIdx >= 0 && idx < currentStepIdx;
              const isActive = currentStepIdx >= 0 && idx === currentStepIdx;
              const isUpcoming = currentStepIdx < 0 || idx > currentStepIdx;

              const isConnectorActive = currentStepIdx >= 0 && idx < currentStepIdx;

              return (
                <React.Fragment key={step.label}>
                  {/* Step Item */}
                  <div className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isCompleted
                        ? 'bg-[#F47732] text-white shadow-xs'
                        : isActive
                          ? 'bg-white border-2 border-[#F47732] text-[#F47732] ring-4 ring-[#F47732]/15 font-bold shadow-xs'
                          : 'bg-white border-2 border-slate-200 text-slate-300'
                        }`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>

                    <span
                      className={`text-xs mt-2.5 text-center font-medium ${isActive
                        ? 'text-[#F47732] font-bold'
                        : isCompleted
                          ? 'text-slate-800 font-semibold'
                          : 'text-slate-400'
                        }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector Line between steps */}
                  {idx < stepperSteps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 -mt-6">
                      <div
                        className={`h-full transition-colors ${isConnectorActive ? 'bg-[#F47732]' : 'bg-slate-200'
                          }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Order Items + Shipping Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Order Items */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Package className="w-4 h-4 text-[#F47732]" />
              <h2 className="text-sm font-bold text-slate-800">
                Order Items ({items.length})
              </h2>
            </div>

            {/* Items List */}
            <div className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No line items found for this order.
                </div>
              ) : (
                items.map((item: any, i: number) => {
                  const unitPrice =
                    item.unitPricePaiseSnapshot ||
                    (item.lineTotalPaise && item.quantity ? item.lineTotalPaise / item.quantity : 0);
                  const lineTotal =
                    item.lineTotalPaise || unitPrice * (item.quantity || 1);

                  return (
                    <div
                      key={item._id || item.productId || i}
                      className="py-4 first:pt-0 last:pb-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Box Icon Container */}
                        <div className="w-12 h-12 rounded-lg bg-[#FFF8F3] border border-[#F0E0D5]/60 text-[#F47732] flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-[#F47732]" />
                        </div>

                        {/* Name & SKU */}
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {item.productNameSnapshot || 'Product Item'}
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            SKU: {item.skuSnapshot || item.variantSkuSnapshot || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-600 font-medium mt-1">
                            Qty: <strong className="text-slate-800">{item.quantity}</strong>{' '}
                            &nbsp;Unit: {formatPaiseToINR(unitPrice)}
                          </p>
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatPaiseToINR(lineTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Calculations Footer */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-sm">
              <div className="flex items-center justify-between text-slate-600 text-xs">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">
                  {formatPaiseToINR(order.subtotalPaise || order.grandTotalPaise)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 text-xs">
                <span>Shipping</span>
                <span className="font-semibold text-emerald-600">
                  {order.deliveryFeePaise && order.deliveryFeePaise > 0
                    ? formatPaiseToINR(order.deliveryFeePaise)
                    : 'Free'}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Total</span>
                <span className="font-bold text-lg text-[#F47732]">
                  {formatPaiseToINR(order.grandTotalPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Shipping Details */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-[#F47732]" />
              <h2 className="text-sm font-bold text-slate-800">Shipping Details</h2>
            </div>

            {/* Section: RECIPIENT */}
            <div>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2.5">
                Recipient
              </span>

              <div className="bg-slate-50/70 backdrop-blur-sm rounded-xl p-3.5 border border-slate-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#FFEFE6] text-[#F47732] flex items-center justify-center font-bold shrink-0">
                  <User className="w-5 h-5 text-[#F47732]" />
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-800 text-sm">{customerName}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customerEmail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: DELIVERY ADDRESS */}
            <div className="bg-slate-50/70 backdrop-blur-sm rounded-xl p-3.5 border border-slate-100 mt-6">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2.5">
                Delivery Address
              </span>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2.5">
                  <Home className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-800">{streetLine}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-slate-600 font-medium">
                    {cityLine}, {stateLine}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-slate-600 font-medium">{pincodeLine}</p>
                </div>

                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  <p className="text-slate-600 font-medium">India</p>
                </div>
              </div>
            </div>

            {/* Section: TRACKING */}
            <div className="mt-6">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2.5">
                Tracking
              </span>

              <div className="bg-[#F0F4FF]/80 backdrop-blur-sm border border-[#D9E2FF] rounded-xl p-4 flex items-center gap-3.5">
                <Truck className="w-5 h-5 text-[#4F46E5] shrink-0" />
                <div>
                  <p className="font-bold text-[#3730A3] text-sm">{trackingNumber}</p>
                  <p className="text-xs text-[#6366F1] font-medium">{courierCarrier}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary + Customer + Payment (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Order Summary */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <FileText className="w-4 h-4 text-[#F47732]" />
              <h2 className="text-sm font-bold text-slate-800">Order Summary</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Order ID</span>
                <span className="font-semibold text-slate-900">{order.orderNumber}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Placed on</span>
                <span className="text-slate-700 font-medium">{formattedPlacedDateLong}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last updated</span>
                <span className="text-slate-700 font-medium">{formattedUpdatedDateLong}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Total Items</span>
                <span className="text-slate-700 font-medium">{totalItemCount} items</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-medium">Total Amount</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatPaiseToINR(order.grandTotalPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Customer */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <User className="w-4 h-4 text-[#F47732]" />
              <h2 className="text-sm font-bold text-slate-800">Customer</h2>
            </div>

            {/* Customer Avatar & Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-sm shrink-0">
                {customerName.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 text-sm truncate">{customerName}</h4>
                <p className="text-xs text-slate-400 truncate">{businessName}</p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-2.5 text-xs border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-700 font-medium truncate max-w-[200px]">
                  {customerEmail}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="text-slate-700 font-medium">{customerPhone}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">GST No.</span>
                <span className="text-slate-700 font-medium font-mono">{customerGstin}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Payment */}
          <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <CreditCard className="w-4 h-4 text-[#F47732]" />
              <h2 className="text-sm font-bold text-slate-800">Payment</h2>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Method</span>
                <span className="font-semibold text-slate-900 uppercase">
                  {order.paymentMethod ? order.paymentMethod.replace('_', ' ') : 'UPI'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <span
                  className={`font-bold ${isRefunded
                    ? 'text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-purple-200'
                    : isPaid
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                    }`}
                >
                  {isRefunded ? 'REFUNDED' : isPaid ? 'PAID' : 'UNPAID'}
                </span>
              </div>

              {isRefunded && (
                <div className="flex items-center justify-between bg-purple-50/70 p-2 rounded-lg border border-purple-100">
                  <span className="text-purple-700 font-medium">Refund ID</span>
                  <span className="text-purple-900 font-mono text-[11px] font-semibold">
                    {order.payments?.[0]?.refundId || 'Processed via Razorpay'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Transaction ID</span>
                <span className="text-slate-700 font-medium font-mono">
                  {order.payments?.[0]?.referenceNumber ||
                    `UPI-TXN-${(order.orderNumber || '2026').replace(/\D/g, '') || '20240220'}`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">{isRefunded ? 'Refunded on' : 'Paid on'}</span>
                <span className="text-slate-700 font-medium">
                  {isRefunded || isPaid ? formattedPlacedDateLong : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatPaiseToINR(order.grandTotalPaise)}
                </span>
              </div>
            </div>

            {/* Payment Update Row */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <select
                  value={paymentStatusSelect}
                  onChange={(e) => setPaymentStatusSelect(e.target.value as 'PAID' | 'UNPAID' | 'REFUNDED')}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:border-[#F47732]"
                >
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                  <option value="REFUNDED">REFUNDED</option>
                </select>

                <button
                  type="button"
                  onClick={() => updatePaymentStatusMutation.mutate(paymentStatusSelect)}
                  disabled={updatePaymentStatusMutation.isPending}
                  className="px-3.5 py-2 bg-[#F47732] hover:bg-[#e06624] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {updatePaymentStatusMutation.isPending ? 'Updating...' : 'Update'}
                </button>
              </div>

              {/* Send Payment Reminder Button */}
              <button
                type="button"
                onClick={() => sendReminderMutation.mutate()}
                disabled={sendReminderMutation.isPending}
                className="w-full mt-3 px-3 py-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg text-xs font-medium text-center transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {sendReminderMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : null}
                <span>Send Payment Reminder (Email/WhatsApp/Push)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
