import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { OrderStatus } from '@necessity/shared';
import {
  Truck,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface DispatchOrderModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DispatchOrderModal: React.FC<DispatchOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [courierName, setCourierName] = useState(order?.dispatchDetails?.courierName || 'DTDC Express');
  const [trackingNumber, setTrackingNumber] = useState(order?.dispatchDetails?.trackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(order?.dispatchDetails?.trackingUrl || '');
  const [transportDetails, setTransportDetails] = useState(order?.dispatchDetails?.transportDetails || '');
  const [actionError, setActionError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && order) {
      setCourierName(order.dispatchDetails?.courierName || 'DTDC Express');
      setTrackingNumber(order.dispatchDetails?.trackingNumber || '');
      setTrackingUrl(order.dispatchDetails?.trackingUrl || '');
      setTransportDetails(order.dispatchDetails?.transportDetails || '');
      setActionError(null);
    }
  }, [isOpen, order]);

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const targetId = order.id || order._id;
      return apiClient.patch(`/orders/${targetId}/status`, {
        status: OrderStatus.DISPATCHED,
        dispatchDetails: {
          courierName: courierName.trim() || 'Standard Surface Transport',
          trackingNumber: trackingNumber.trim() || undefined,
          trackingUrl: trackingUrl.trim() || undefined,
          transportDetails: transportDetails.trim() || undefined,
          dispatchedAt: new Date().toISOString(),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setActionError(
        err.response?.data?.message ||
          err.response?.data?.error?.message ||
          'Failed to dispatch order consignment'
      );
    },
  });

  if (!isOpen || !order) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4 !m-0"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-blue-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-blue-200 bg-blue-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5 text-blue-950 font-bold">
            <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-blue-950 leading-tight">
                Dispatch Consignment & Notify Customer
              </h3>
              <p className="text-[11px] text-blue-700 font-mono mt-0.5">
                Order #{order.orderNumber} • {order.retailerBusinessName || order.retailerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dispatch modal"
            className="text-blue-800 hover:text-blue-950 rounded-lg p-1 hover:bg-blue-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-white">
          <p className="text-xs text-blue-900 bg-blue-50 p-3 rounded-xl border border-blue-200 leading-relaxed">
            Provide courier and consignment tracking details. Confirming dispatch will transition the order to <strong className="font-bold text-blue-950">Dispatched</strong> and instantly email an automated dispatch notice with live tracking to the customer.
          </p>

          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Courier / Carrier *
              </label>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="e.g. DTDC / Delhivery / Transport"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Docket / Waybill No.
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. DTDC-88491823"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Tracking Web URL (Optional)
              </label>
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://track.dtdc.com/..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Transport & Gate Notes (Optional)
              </label>
              <input
                type="text"
                value={transportDetails}
                onChange={(e) => setTransportDetails(e.target.value)}
                placeholder="e.g. 2 cartons strapped securely, driver contact details..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => dispatchMutation.mutate()}
            disabled={dispatchMutation.isPending}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
          >
            {dispatchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Truck className="h-4 w-4 mr-1" />
            )}
            <span>Confirm Dispatch & Send Email</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

