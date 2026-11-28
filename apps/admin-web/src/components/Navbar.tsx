import React from 'react';
import { useAuth } from '../lib/auth-context';
import { useSidebar } from '../lib/sidebar-context';
import { useCart } from '../lib/cart-context';
import {
  Menu,
  ShoppingCart,
  Users,
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  FolderTree,
  FileSpreadsheet,
  Download,
  Tag,
  FileText,
  BarChart3,
  Package,
  Clock,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { UserRole } from '@necessity/shared';

interface PageInfo {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const getPageInfo = (pathname: string): PageInfo => {
  // Admin routes
  if (pathname === '/admin' || pathname === '/admin/') {
    return { title: 'Dashboard', icon: LayoutDashboard };
  }
  if (pathname.startsWith('/admin/customers') || pathname.startsWith('/admin/retailers')) {
    return { title: 'Customer Management', icon: Users };
  }
  if (pathname.startsWith('/admin/pending-retailers')) {
    return { title: 'Retailer Approvals', icon: Clock };
  }
  if (pathname.startsWith('/admin/products/stock')) {
    return { title: 'Inventory Management', icon: Boxes };
  }
  if (pathname.startsWith('/admin/products/categories')) {
    return { title: 'Categories & Brands', icon: FolderTree };
  }
  if (pathname.startsWith('/admin/products/import')) {
    return { title: 'Import Products', icon: FileSpreadsheet };
  }
  if (pathname.startsWith('/admin/products/export')) {
    return { title: 'Export Products', icon: Download };
  }
  if (pathname.startsWith('/admin/products/pricing')) {
    return { title: 'Pricing & Offers', icon: Tag };
  }
  if (pathname.startsWith('/admin/products/zoho-sync')) {
    return { title: 'Zoho Sync', icon: RefreshCw };
  }
  if (pathname.startsWith('/admin/products/new')) {
    return { title: 'Add Product', icon: Plus };
  }
  if (pathname.match(/^\/admin\/products\/[^/]+\/edit/)) {
    return { title: 'Edit Product', icon: Package };
  }
  if (pathname.startsWith('/admin/products')) {
    return { title: 'All Products', icon: Package };
  }
  if (pathname.match(/^\/admin\/orders\/[^/]+/)) {
    return { title: 'Order Details', icon: FileText };
  }
  if (pathname.startsWith('/admin/orders')) {
    return { title: 'Orders & Shipments', icon: FileText };
  }
  if (pathname.startsWith('/admin/invoices')) {
    return { title: 'Invoices & Zoho Sync', icon: FileText };
  }
  if (pathname.startsWith('/admin/discounts')) {
    return { title: 'Discounts & Coupons', icon: Tag };
  }
  if (pathname.startsWith('/admin/analytics')) {
    return { title: 'Reports & Analytics', icon: BarChart3 };
  }

  // Retailer routes
  if (pathname === '/retailer' || pathname === '/retailer/') {
    return { title: 'Dashboard', icon: LayoutDashboard };
  }
  if (pathname.startsWith('/retailer/catalogue')) {
    return { title: 'Product Catalogue', icon: ShoppingBag };
  }
  if (pathname.match(/^\/retailer\/orders\/[^/]+/)) {
    return { title: 'Order Details', icon: FileText };
  }
  if (pathname.startsWith('/retailer/orders')) {
    return { title: 'My Orders', icon: FileText };
  }

  return { title: 'Customer Management', icon: Users };
};

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const { itemCount, openCart } = useCart();
  const location = useLocation();

  if (!user) return null;

  const isRetailer = user.role === UserRole.RETAILER;
  const pageInfo = getPageInfo(location.pathname);
  const PageIcon = pageInfo.icon;

  return (
    <header className="lg:hidden bg-white border-b border-[#F0E0D5] text-[#292929] sticky top-0 z-30 shadow-xs">
      <div className="w-full px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Left Section: Mobile Hamburger Toggle + Current Page Title / Icon */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Open navigation sidebar"
            className="p-2 rounded-xl text-[#292929] hover:text-[#F47732] hover:bg-[#FFF8F3] border border-[#F0E0D5] focus:outline-none focus:ring-2 focus:ring-[#F47732] transition-colors flex-shrink-0"
          >
            <Menu className="h-5 w-5 text-[#292929]" />
          </button>

          {/* Page Title H1 next to hamburger */}
          <div className="flex items-center space-x-2 min-w-0">
            <span className="p-1 rounded-lg bg-[#FFF1E8] text-[#F47732] flex-shrink-0">
              <PageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <h1 className="text-sm sm:text-base font-bold text-[#292929] tracking-tight truncate">
              {pageInfo.title}
            </h1>
          </div>
        </div>

        {/* Right Section: Cart (for Retailers) */}
        {isRetailer && (
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={openCart}
              className="relative p-2 rounded-xl text-[#292929] hover:text-[#F47732] hover:bg-[#FFF8F3] border border-[#F0E0D5] transition-colors"
              title="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#F47732] text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
