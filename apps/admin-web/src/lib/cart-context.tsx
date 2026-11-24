import React, { createContext, useContext, useState, useEffect } from 'react';
import { IProduct } from '@necessity/shared';
import { apiClient } from './api';
import { useAuth } from './auth-context';

export interface CartItem {
  product: IProduct;
  quantity: number;
}

export interface CalculatedCartSummary {
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  deliveryFeePaise: number;
  grandTotalPaise: number;
  items: any[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: IProduct, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  itemCount: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  summary: CalculatedCartSummary | null;
  isCalculating: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('necessity_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [summary, setSummary] = useState<CalculatedCartSummary | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { retailer } = useAuth();

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('necessity_cart', JSON.stringify(items));
    } catch (e) {
      console.error('Failed to persist cart:', e);
    }
  }, [items]);

  // Recalculate cart authoritatively with backend on items change
  useEffect(() => {
    if (items.length === 0) {
      setSummary(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const calculate = async () => {
      setIsCalculating(true);
      setError(null);
      try {
        const payload = {
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          deliveryStateCode: retailer?.billingAddress?.stateCode || '27',
        };
        const res = await apiClient.post('/orders/calculate-cart', payload);
        if (isMounted) {
          setSummary(res.data.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.error?.message || 'Error calculating order totals');
        }
      } finally {
        if (isMounted) {
          setIsCalculating(false);
        }
      }
    };

    const timer = setTimeout(calculate, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [items, retailer]);

  const addItem = (product: IProduct, quantity?: number) => {
    const qty = quantity || product.minOrderQuantity || 1;
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setSummary(null);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        itemCount,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        summary,
        isCalculating,
        error,
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
