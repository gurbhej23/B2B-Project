import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { OrderStatus } from '@necessity/shared';
import {
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface PickupOrderModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PickupOrderModal: React.FC<PickupOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [pickupLocation, setPickupLocation] = useState(
    order?.pickupDetails?.pickupLocation || 'Necessity Central Warehouse - Mohali'
  );
  const [collectedBy, setCollectedBy] = useState(order?.pickupDetails?.collectedBy || '');
  const [pickupNotes, setPickupNotes] = useState(order?.pickupDetails?.notes || '');
  const [actionError, setActionError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && order) {
      setPickupLocation(
        order.pickupDetails?.pickupLocation || 'Necessity Central Warehouse - Mohali'
      );
      setCollectedBy(order.pickupDetails?.collectedBy || '');
      setPickupNotes(order.pickupDetails?.notes || '');
      setActionError(null);
    }
  }, [isOpen, order]);

  const pickupMutation = useMutation({
    mutationFn: async () => {
      const targetId = order.id || order._id;
      return apiClient.patch(`/orders/${targetId}/status`, {
        status: OrderStatus.PICKED_UP,
        pickupDetails: {
          pickupLocation: pickupLocation.trim() || 'Necessity Central Warehouse - Mohali',
          collectedBy: collectedBy.trim() || undefined,
          notes: pickupNotes.trim() || undefined,
          pickedUpAt: new Date().toISOString(),
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
          'Failed to record order pickup'
      );
    },
  });

  if (!isOpen || !order) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4 !m-0"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-emerald-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-emerald-200 bg-emerald-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5 text-emerald-950 font-bold">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950 leading-tight">
                Confirm Order Pickup & Handover
              </h3>
              <p className="text-[11px] text-emerald-700 font-mono mt-0.5">
                Order #{order.orderNumber} • {order.retailerBusinessName || order.retailerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pickup modal"
            className="text-emerald-800 hover:text-emerald-950 rounded-lg p-1 hover:bg-emerald-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-white">
          <p className="text-xs text-emerald-900 bg-emerald-50 p-3 rounded-xl border border-emerald-200 leading-relaxed">
            Record customer or representative self-pickup. Confirming will update the order to <strong className="font-bold text-emerald-950">Picked Up</strong>, deduct physical warehouse inventory, and immediately email an automated pickup receipt to the customer.
          </p>

          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Pickup Location *
              </label>
              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g. Necessity Central Warehouse - Mohali"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Collected By / Person Name
              </label>
              <input
                type="text"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                placeholder="e.g. Ramesh Kumar (Store Driver / Representative)"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#292929] mb-1">
                Gate Pass / Identification Notes (Optional)
              </label>
              <input
                type="text"
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder="e.g. Verified Aadhaar / vehicle PB-65-XX-1234"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
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
            onClick={() => pickupMutation.mutate()}
            disabled={pickupMutation.isPending}
            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
          >
            {pickupMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            <span>Confirm Pickup & Send Email</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

