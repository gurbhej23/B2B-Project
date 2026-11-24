import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth-context';
import { SidebarProvider } from './lib/sidebar-context';
import { CartProvider } from './lib/cart-context';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CartDrawer } from './features/cart/CartDrawer';
import { LoginScreen } from './features/auth/LoginScreen';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { PendingRetailersScreen } from './features/admin/PendingRetailersScreen';
import { CustomerManagementScreen } from './features/admin/CustomerManagementScreen';
import { AdminProductsScreen } from './features/products/AdminProductsScreen';
import { AddProductScreen } from './features/products/AddProductScreen';
import { ImportProductsScreen } from './features/products/ImportProductsScreen';
import { ExportProductsScreen } from './features/products/ExportProductsScreen';
import { StockManagementScreen } from './features/products/StockManagementScreen';
import { CategoriesBrandsScreen } from './features/products/CategoriesBrandsScreen';
import { PricingOffersScreen } from './features/products/PricingOffersScreen';
import { ZohoSyncScreen } from './features/products/ZohoSyncScreen';
import { ProductCatalogueScreen } from './features/products/ProductCatalogueScreen';
import { OrdersListScreen } from './features/orders/OrdersListScreen';
import { OrderDetailScreen } from './features/orders/OrderDetailScreen';
import { InvoicesZohoScreen } from './features/invoices/InvoicesZohoScreen';
import { DiscountsCouponsScreen } from './features/discounts/DiscountsCouponsScreen';
import { AnalyticsReportsScreen } from './features/analytics/AnalyticsReportsScreen';
import { RetailerDashboard } from './features/retailer/RetailerDashboard';
import { UserRole } from '@necessity/shared';

const queryClient = new QueryClient();

// Protected Layout for Admin / Staff
const AdminLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-[#292929] text-sm">
        <div className="w-8 h-8 border-3 border-[#F47732] border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>Initializing session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isStaff = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALES_MANAGER,
    UserRole.SALESMAN,
  ].includes(user.role);

  if (!isStaff) {
    return <Navigate to="/retailer" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex flex-1 min-w-0">
        <Sidebar />
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 max-w-8xl mx-auto w-full min-w-0 overflow-x-hidden transition-all duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Protected Layout for Retailers
const RetailerLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-[#292929] text-sm">
        <div className="w-8 h-8 border-3 border-[#F47732] border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>Initializing session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className="flex flex-1 min-w-0">
        <Sidebar />
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Default route redirector based on authenticated role
const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-[#292929] text-sm">
        <div className="w-8 h-8 border-3 border-[#F47732] border-t-transparent rounded-full animate-spin mb-3"></div>
        <span>Connecting to Necessity India Platform...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === UserRole.RETAILER) {
    return <Navigate to="/retailer" replace />;
  }

  return <Navigate to="/admin" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SidebarProvider>
          <CartProvider>
            <BrowserRouter>
              <CartDrawer />
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />

                {/* Admin Portal */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="customers" element={<CustomerManagementScreen />} />
                  <Route path="retailers" element={<CustomerManagementScreen />} />
                  <Route path="pending-retailers" element={<PendingRetailersScreen />} />
                  <Route path="products" element={<AdminProductsScreen />} />
                  <Route path="products/new" element={<AddProductScreen />} />
                  <Route path="products/:id/edit" element={<AddProductScreen />} />
                  <Route path="products/import" element={<ImportProductsScreen />} />
                  <Route path="products/export" element={<ExportProductsScreen />} />
                  <Route path="products/stock" element={<StockManagementScreen />} />
                  <Route path="products/categories" element={<CategoriesBrandsScreen />} />
                  <Route path="products/pricing" element={<PricingOffersScreen />} />
                  <Route path="products/zoho-sync" element={<ZohoSyncScreen />} />
                  <Route path="orders" element={<OrdersListScreen />} />
                  <Route path="orders/:id" element={<OrderDetailScreen />} />
                  <Route path="invoices" element={<InvoicesZohoScreen />} />
                  <Route path="discounts" element={<DiscountsCouponsScreen />} />
                  <Route path="analytics" element={<AnalyticsReportsScreen />} />
                </Route>

                {/* Retailer Portal */}
                <Route path="/retailer" element={<RetailerLayout />}>
                  <Route index element={<RetailerDashboard />} />
                  <Route path="catalogue" element={<ProductCatalogueScreen />} />
                  <Route path="orders" element={<OrdersListScreen />} />
                  <Route path="orders/:id" element={<OrderDetailScreen />} />
                </Route>

                {/* Catch-all root redirect */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
