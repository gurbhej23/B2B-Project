import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { mobileApi, extractErrorMessage } from '../../lib/api';
import { Product, ProductVariant, CartItem, CalculatedCartSummary } from '../types/models';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => void;
  totalUnitsCount: number;
  itemCount: number;
  cartSubtotalPaise: number;
  summary: CalculatedCartSummary | null;
  isCalculating: boolean;
  calculationError: string | null;
  appliedCoupon: string | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  recalculateCart: (stateCode?: string, couponOverride?: string | null) => Promise<CalculatedCartSummary | null>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { retailer } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CalculatedCartSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const totalUnitsCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const itemCount = items.length;

  const cartSubtotalPaise = useMemo(() => {
    return items.reduce((sum, item) => {
      const price =
        item.variant?.dealerPricePaise !== undefined
          ? item.variant.dealerPricePaise
          : item.product.dealerPricePaise;
      return sum + price * item.quantity;
    }, 0);
  }, [items]);

  const recalculateCart = useCallback(
    async (
      stateCode = '27',
      couponOverride?: string | null
    ): Promise<CalculatedCartSummary | null> => {
      if (items.length === 0) {
        setSummary(null);
        setCalculationError(null);
        return null;
      }

      setIsCalculating(true);
      setCalculationError(null);

      const effectiveCoupon =
        couponOverride !== undefined ? couponOverride : appliedCoupon;

      try {
        const payload: any = {
          items: items.map((i) => ({
            productId: i.product.id || (i.product as any)._id,
            variantId: i.variant?.id || (i.variant as any)?._id,
            quantity: i.quantity,
          })),
          deliveryStateCode: stateCode,
        };

        if (effectiveCoupon && effectiveCoupon.trim()) {
          payload.couponCode = effectiveCoupon.trim();
        }

        const res = await mobileApi.post('/orders/calculate-cart', payload);
        if (res.success && res.data) {
          setSummary(res.data);
          return res.data;
        } else {
          throw new Error(res.message || 'Failed to calculate cart totals');
        }
      } catch (err: any) {
        const msg = extractErrorMessage(err);
        setCalculationError(msg);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    [items, appliedCoupon]
  );

  // Recalculate whenever items change
  useEffect(() => {
    if (items.length > 0) {
      const stateCode = '27';
      const timer = setTimeout(() => {
        recalculateCart(stateCode);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSummary(null);
      setCalculationError(null);
    }
  }, [items, recalculateCart]);

  const applyCoupon = async (
    code: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a coupon code' };
    }

    if (items.length === 0) {
      return { success: false, message: 'Add items to cart before applying coupon' };
    }

    setIsCalculating(true);
    setCalculationError(null);

    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.product.id || (i.product as any)._id,
          variantId: i.variant?.id || (i.variant as any)?._id,
          quantity: i.quantity,
        })),
        deliveryStateCode: '27',
        couponCode: cleanCode,
      };

      const res = await mobileApi.post('/orders/calculate-cart', payload);
      if (res.success && res.data) {
        setSummary(res.data);
        setAppliedCoupon(cleanCode);
        const discountAmt = res.data.couponDiscountPaise
          ? ` (Saved ${formatINR(res.data.couponDiscountPaise)})`
          : '';
        return {
          success: true,
          message: `Coupon '${cleanCode}' applied successfully!${discountAmt}`,
        };
      } else {
        throw new Error(res.message || 'Invalid coupon code');
      }
    } catch (err: any) {
      const msg = extractErrorMessage(err);
      setCalculationError(msg);
      return { success: false, message: msg };
    } finally {
      setIsCalculating(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    recalculateCart('27', null);
  };

  const addToCart = (product: Product, quantity?: number, variant?: ProductVariant) => {
    const prodId = product.id || (product as any)._id;
    const addQty = quantity || product.minOrderQuantity || 1;

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (i) =>
          (i.product.id === prodId || (i.product as any)._id === prodId) &&
          (variant ? i.variant?.id === variant.id || (i.variant as any)?._id === (variant as any)._id : !i.variant)
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].quantity += addQty;
        return updated;
      }

      return [...prevItems, { product, quantity: addQty, variant }];
    });
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        const matchesProduct = item.product.id === productId || (item.product as any)._id === productId;
        const matchesVariant = variantId
          ? item.variant?.id === variantId || (item.variant as any)?._id === variantId
          : !item.variant;

        if (matchesProduct && matchesVariant) {
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setItems((prevItems) =>
      prevItems.filter((item) => {
        const matchesProduct = item.product.id === productId || (item.product as any)._id === productId;
        const matchesVariant = variantId
          ? item.variant?.id === variantId || (item.variant as any)?._id === variantId
          : !item.variant;
        return !(matchesProduct && matchesVariant);
      })
    );
  };

  const clearCart = () => {
    setItems([]);
    setSummary(null);
    setAppliedCoupon(null);
    setCalculationError(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        totalUnitsCount,
        itemCount,
        cartSubtotalPaise,
        summary,
        isCalculating,
        calculationError,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        recalculateCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

function formatINR(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });
}
