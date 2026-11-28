import React, { useState } from 'react';
import { useCart } from '../../lib/cart-context';
import { useAuth } from '../../lib/auth-context';
import { apiClient } from '../../lib/api';
import {
  X,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Building,
  QrCode,
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  PaymentMethod,
  formatPaiseToINR,
} from '@necessity/shared';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeItem,
    clearCart,
    summary,
    isCalculating,
    error,
  } = useCart();

  const { user, retailer, refreshProfile } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.PAYMENT_GATEWAY
  );
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (items.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const payload = {
        retailerId: retailer?.id,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        paymentMethod,
        deliveryAddress: retailer?.deliveryAddresses?.[0] ||
          retailer?.billingAddress || {
            street: 'Main Warehouse Dock',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001',
            stateCode: '27',
          },
        customerNotes,
        idempotencyKey,
      };

      const res = await apiClient.post('/orders/checkout', payload);
      setPlacedOrder(res.data.data);
      clearCart();
      await refreshProfile();
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.error?.message ||
          'Failed to place order. Please review your cart.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold">Wholesale Cart</h2>
              <span className="text-xs bg-[#FFF1E8] text-[#F47732] border border-[#F0E0D5] font-semibold px-2.5 py-0.5 rounded-full">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <button
              onClick={closeCart}
              className="text-[#737373] hover:text-[#292929] p-1.5 rounded-lg hover:bg-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Success State */}
          {placedOrder ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-[#292929] mb-1">
                Order Placed Successfully!
              </h3>
              <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full mb-4">
                Order #: {placedOrder.orderNumber}
              </p>
              <p className="text-xs text-[#737373] max-w-xs mb-6">
                Your order of{' '}
                <span className="font-semibold text-[#292929]">
                  {formatPaiseToINR(placedOrder.grandTotalPaise)}
                </span>{' '}
                has been recorded and routed to dispatch warehouse. Inventory stock
                has been reserved.
              </p>
              <button
                onClick={() => {
                  setPlacedOrder(null);
                  closeCart();
                }}
                className="w-full py-2.5 px-4 bg-[#F47732] hover:bg-[#E95B2A] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-[#FFF1E8] rounded-full flex items-center justify-center text-[#F47732] mb-4">
                <Truck className="h-8 w-8" />
              </div>
              <h3 className="text-base font-semibold text-[#292929] mb-1">
                Your wholesale cart is empty
              </h3>
              <p className="text-xs text-[#737373] max-w-xs mb-6">
                Browse our product catalogue of luxury towels, paper napkins, and
                commercial sanitation supplies to add items.
              </p>
              <button
                onClick={closeCart}
                className="py-2.5 px-5 bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Browse Catalogue
              </button>
            </div>
          ) : (
            /* Cart Content */
            <>
              <div className="flex-1 overflow-y-auto touch-scroll p-4 sm:p-6 space-y-4">
                {/* Items List */}
                <div className="divide-y divide-[#F0E0D5]">
                  {items.map(({ product, quantity }) => {
                    const step = product.orderQuantityMultiple || 1;
                    return (
                      <div key={product.id} className="py-3 flex space-x-3">
                        <img
                          src={
                            product.images?.[0]?.url ||
                            'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=200&auto=format&fit=crop'
                          }
                          alt={product.name}
                          className="w-16 h-16 rounded-lg object-cover bg-white border border-[#F0E0D5] flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-[#292929] truncate">
                                {product.name}
                              </p>
                              <p className="text-[11px] text-[#737373]">
                                SKU: {product.sku} | Pack: {product.packSize} {product.uom}
                              </p>
                            </div>
                            <button
                              onClick={() => removeItem(product.id)}
                              className="text-[#737373] hover:text-red-500 p-1 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center border border-[#F0E0D5] rounded-lg overflow-hidden">
                              <button
                                onClick={() =>
                                  updateQuantity(
                                    product.id,
                                    Math.max(
                                      product.minOrderQuantity,
                                      quantity - step
                                    )
                                  )
                                }
                                className="p-1 hover:bg-[#FFF8F3] text-[#737373] hover:text-[#292929] transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="px-2.5 text-xs font-bold text-[#292929]">
                                {quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(product.id, quantity + step)
                                }
                                className="p-1 hover:bg-[#FFF8F3] text-[#737373] hover:text-[#292929] transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-bold text-[#292929]">
                                {formatPaiseToINR(product.dealerPricePaise * quantity)}
                              </p>
                              <p className="text-[10px] text-[#737373]">
                                @ {formatPaiseToINR(product.dealerPricePaise)} / {product.uom}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Error Alert */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Financial Summary */}
                {summary && (
                  <div className="bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-[#737373]">
                      <span>Taxable Value:</span>
                      <span className="font-semibold text-[#292929]">
                        {formatPaiseToINR(summary.taxableAmountPaise)}
                      </span>
                    </div>

                    {summary.totalCgstPaise > 0 && (
                      <div className="flex justify-between text-[#737373]">
                        <span>CGST:</span>
                        <span className="font-semibold text-[#292929]">
                          {formatPaiseToINR(summary.totalCgstPaise)}
                        </span>
                      </div>
                    )}

                    {summary.totalSgstPaise > 0 && (
                      <div className="flex justify-between text-[#737373]">
                        <span>SGST:</span>
                        <span className="font-semibold text-[#292929]">
                          {formatPaiseToINR(summary.totalSgstPaise)}
                        </span>
                      </div>
                    )}

                    {summary.totalIgstPaise > 0 && (
                      <div className="flex justify-between text-[#737373]">
                        <span>IGST (Inter-State):</span>
                        <span className="font-semibold text-[#292929]">
                          {formatPaiseToINR(summary.totalIgstPaise)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-[#F0E0D5] flex justify-between text-sm font-bold text-[#292929]">
                      <span>Grand Total:</span>
                      <span className="text-[#E95B2A]">
                        {formatPaiseToINR(summary.grandTotalPaise)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#292929] uppercase tracking-wider block">
                    Select Payment Method
                  </label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        paymentMethod === PaymentMethod.PAYMENT_GATEWAY
                          ? 'border-[#F47732] bg-[#FFF8F3]'
                          : 'border-[#F0E0D5] hover:bg-[#FFF8F3]/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PaymentMethod.PAYMENT_GATEWAY}
                          checked={paymentMethod === PaymentMethod.PAYMENT_GATEWAY}
                          onChange={() =>
                            setPaymentMethod(PaymentMethod.PAYMENT_GATEWAY)
                          }
                          className="accent-[#F47732] text-[#F47732] focus:ring-[#F47732]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#292929]">
                            Online Payment (Razorpay / Cards / Netbanking)
                          </p>
                          <p className="text-[10px] text-[#737373]">
                            Instant settlement with digital receipt
                          </p>
                        </div>
                      </div>
                      <CreditCard className="h-4 w-4 text-[#737373]" />
                    </label>

                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        paymentMethod === PaymentMethod.BANK_TRANSFER
                          ? 'border-[#F47732] bg-[#FFF8F3]'
                          : 'border-[#F0E0D5] hover:bg-[#FFF8F3]/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PaymentMethod.BANK_TRANSFER}
                          checked={paymentMethod === PaymentMethod.BANK_TRANSFER}
                          onChange={() =>
                            setPaymentMethod(PaymentMethod.BANK_TRANSFER)
                          }
                          className="accent-[#F47732] text-[#F47732] focus:ring-[#F47732]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#292929]">
                            Bank Transfer (NEFT / RTGS / IMPS)
                          </p>
                          <p className="text-[10px] text-[#737373]">
                            Direct transfer to HDFC Current Account
                          </p>
                        </div>
                      </div>
                      <Building className="h-4 w-4 text-[#737373]" />
                    </label>

                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        paymentMethod === PaymentMethod.UPI
                          ? 'border-[#F47732] bg-[#FFF8F3]'
                          : 'border-[#F0E0D5] hover:bg-[#FFF8F3]/40'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={PaymentMethod.UPI}
                          checked={paymentMethod === PaymentMethod.UPI}
                          onChange={() => setPaymentMethod(PaymentMethod.UPI)}
                          className="accent-[#F47732] text-[#F47732] focus:ring-[#F47732]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#292929]">
                            Instant UPI QR
                          </p>
                          <p className="text-[10px] text-[#737373]">
                            Scan with GPay, PhonePe, or BHIM
                          </p>
                        </div>
                      </div>
                      <QrCode className="h-4 w-4 text-[#737373]" />
                    </label>
                  </div>
                </div>

                {/* Customer Notes */}
                <div>
                  <label className="text-xs font-bold text-[#292929] block mb-1">
                    Delivery Instructions / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="e.g. Unload at Gate 2, between 10am - 4pm"
                    className="w-full text-xs p-2.5 bg-white border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:outline-none text-[#292929] placeholder-[#737373]"
                  />
                </div>

                {/* Submission Error */}
                {submitError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {submitError}
                  </div>
                )}
              </div>

              {/* Checkout Footer */}
              <div className="p-4 sm:p-6 bg-white border-t border-[#F0E0D5] space-y-3">
                <button
                  onClick={handleCheckout}
                  disabled={
                    isSubmitting ||
                    isCalculating ||
                    items.length === 0
                  }
                  className="w-full py-3 px-4 bg-[#F47732] hover:bg-[#E95B2A] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validating & Placing Order...</span>
                    </>
                  ) : (
                    <span>
                      Place Wholesale Order •{' '}
                      {summary ? formatPaiseToINR(summary.grandTotalPaise) : '...'}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
