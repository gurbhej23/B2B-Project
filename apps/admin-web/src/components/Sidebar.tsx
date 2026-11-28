import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  FileText,
  X,
  ShoppingCart,
  LogOut,
  ChevronDown,
  FileSpreadsheet,
  Download,
  Boxes,
  FolderTree,
  Tag,
  BarChart3,
  Package,
} from 'lucide-react';
import { useCart } from '../lib/cart-context';
import { useAuth } from '../lib/auth-context';
import { useSidebar } from '../lib/sidebar-context';
import { UserRole } from '@necessity/shared';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount, openCart } = useCart();
  const { isMobile, isMobileOpen, closeMobileOnly } = useSidebar();
  const location = useLocation();

  const isAdmin = user && [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
  ].includes(user.role);

  // Active path detection for Products, Stock Management, and Categories & Brands
  const isStockActive = location.pathname.startsWith('/admin/products/stock');
  const isCategoriesActive = location.pathname.startsWith('/admin/products/categories');
  const isProductsActive =
    location.pathname.startsWith('/admin/products') &&
    !isStockActive &&
    !isCategoriesActive;
  const [isProductsExpanded, setIsProductsExpanded] = useState<boolean>(isProductsActive);

  useEffect(() => {
    if (isProductsActive) {
      setIsProductsExpanded(true);
    }
  }, [location.pathname, isProductsActive]);

  // Close mobile drawer upon selecting any navigation link
  const handleNavClick = () => {
    if (isMobile) {
      closeMobileOnly();
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 group ${isActive
      ? 'bg-[#F47732] text-white font-semibold shadow-sm'
      : 'text-[#292929] hover:bg-[#FFF8F3] hover:text-[#F47732]'
    }`;

  const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group ${isActive
      ? 'bg-[#F47732] text-white font-semibold shadow-xs'
      : 'text-[#737373] hover:text-[#F47732] hover:bg-[#FFF8F3]'
    }`;

  return (
    <>
      {/* Mobile Semi-Transparent Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-md z-40 lg:hidden transition-opacity duration-300 ease-in-out ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        onClick={closeMobileOnly}
        aria-hidden="true"
      />

      {/* Permanent Fixed Desktop & Mobile Drawer Sidebar */}
      <aside
        id="admin-sidebar"
        aria-label="Main Navigation"
        className={`
          bg-white text-[#292929] border-r border-[#F0E0D5]
          transition-transform duration-300 ease-in-out select-none flex flex-col
          
          /* Mobile Drawer Positioning */
          fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl p-2 h-screen overflow-hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}

          /* Desktop Permanent Fixed-Width Sidebar */
          lg:sticky lg:top-0 lg:bottom-auto lg:left-auto lg:z-20
          lg:w-64 lg:h-screen lg:pl-4 lg:pr-4 lg:shadow-none lg:translate-x-0
          lg:flex-shrink-0 lg:opacity-100 lg:overflow-hidden
        `}
      >
        <div className="flex flex-col h-full bg-white">
          {/* Top Section: Brand Logo (Only Logo, No Text) & Mobile Close Button */}
          <div className="flex-shrink-0 mb-2 border-b border-[#F0E0D5]">
            <div className='flex justify-between items-start'>
              <Link to={isAdmin ? '/admin' : '/retailer'} onClick={handleNavClick} className="block py-0.5">
                <img
                  src="/logo-transparent.png"
                  alt="Necessity India"
                  className="h-14 sm:h-40 w-auto max-w-[200px] object-contain drop-shadow-xs"
                />
              </Link>
              <button
                type="button"
                onClick={closeMobileOnly}
                aria-label="Close sidebar"
                className="lg:hidden p-1.5 rounded-lg text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] focus:outline-none focus:ring-2 focus:ring-[#F47732] transition-colors flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Middle Section: Scrollable Navigation Only */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1 touch-scroll overscroll-contain">
            <div className="px-3 mb-2 text-[10px] font-bold text-[#737373] uppercase tracking-widest">
              {isAdmin ? 'Administration' : 'Retailer Portal'}
            </div>

            <nav className="space-y-1">
              {isAdmin ? (
                <>
                  <NavLink to="/admin" end onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <LayoutDashboard
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Dashboard</span>
                      </>
                    )}
                  </NavLink>

                  <NavLink to="/admin/customers" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <Users
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Customers</span>
                      </>
                    )}
                  </NavLink>

                  {/* Products Section with Submenus */}
                  <div className="space-y-1">
                    <div
                      className={`flex items-center justify-between rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 group ${isProductsActive
                        ? 'bg-[#FFF8F3] text-[#F47732] font-semibold border border-[#F0E0D5]'
                        : 'text-[#292929] hover:bg-[#FFF8F3] hover:text-[#F47732]'
                        }`}
                    >
                      <NavLink
                        to="/admin/products"
                        onClick={() => {
                          setIsProductsExpanded(true);
                          handleNavClick();
                        }}
                        className="flex-1 flex items-center space-x-3 px-3 py-2.5 min-w-0"
                      >
                        <ShoppingBag
                          className={`h-4 w-4 flex-shrink-0 ${isProductsActive ? 'text-[#F47732]' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Products</span>
                      </NavLink>
                      <button
                        type="button"
                        aria-label={isProductsExpanded ? 'Collapse Products menu' : 'Expand Products menu'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsProductsExpanded(!isProductsExpanded);
                        }}
                        className="px-3 py-2.5 text-[#737373] hover:text-[#F47732] focus:outline-none rounded-r-xl transition-colors flex items-center justify-center"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${isProductsExpanded
                            ? 'rotate-180 text-[#F47732]'
                            : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                      </button>
                    </div>

                    {/* Submenu Items */}
                    {isProductsExpanded && (
                      <div className="pl-3 pr-1 py-1 space-y-0.5 border-l-2 border-[#F0E0D5] ml-4 my-1">
                        {/* 1. All Products */}
                        <NavLink to="/admin/products" end onClick={handleNavClick} className={subNavLinkClass}>
                          {({ isActive }) => (
                            <>
                              <Package className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'}`} />
                              <span className="truncate">All Products</span>
                            </>
                          )}
                        </NavLink>

                        {/* 2. Import Products (CSV/Excel) */}
                        {(isAdmin && user?.role !== UserRole.ACCOUNTS_MANAGER) && (
                          <NavLink to="/admin/products/import" onClick={handleNavClick} className={subNavLinkClass}>
                            {({ isActive }) => (
                              <>
                                <FileSpreadsheet className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'}`} />
                                <span className="truncate">Import Products</span>
                              </>
                            )}
                          </NavLink>
                        )}

                        {/* 3. Export Products */}
                        <NavLink to="/admin/products/export" onClick={handleNavClick} className={subNavLinkClass}>
                          {({ isActive }) => (
                            <>
                              <Download className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'}`} />
                              <span className="truncate">Export Products</span>
                            </>
                          )}
                        </NavLink>
                      </div>
                    )}
                  </div>

                  {/* Stock Management - Top-Level Main Item */}
                  {(isAdmin && user?.role !== UserRole.ACCOUNTS_MANAGER) && (
                    <NavLink to="/admin/products/stock" onClick={handleNavClick} className={navLinkClass}>
                      {({ isActive }) => (
                        <>
                          <Boxes
                            className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                              }`}
                          />
                          <span className="truncate">Inventory</span>
                        </>
                      )}
                    </NavLink>
                  )}

                  {/* Categories & Brands - Top-Level Main Item */}
                  {(isAdmin && user?.role !== UserRole.ACCOUNTS_MANAGER) && (
                    <NavLink to="/admin/products/categories" onClick={handleNavClick} className={navLinkClass}>
                      {({ isActive }) => (
                        <>
                          <FolderTree
                            className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                              }`}
                          />
                          <span className="truncate">Categories & Brands</span>
                        </>
                      )}
                    </NavLink>
                  )}

                  <NavLink to="/admin/orders" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <FileText
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Orders & Shipments</span>
                      </>
                    )}
                  </NavLink>

                  <NavLink to="/admin/discounts" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <Tag
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Discounts & Coupons</span>
                      </>
                    )}
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/retailer" end onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <LayoutDashboard
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Dashboard</span>
                      </>
                    )}
                  </NavLink>

                  <NavLink to="/retailer/catalogue" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <ShoppingBag
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Product Catalogue</span>
                      </>
                    )}
                  </NavLink>

                  <NavLink to="/retailer/orders" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <FileText
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">My Orders</span>
                      </>
                    )}
                  </NavLink>
                </>
              )}
            </nav>

            {/* Financial & Integrations Group (Admin Only) */}
            {isAdmin && (
              <div className="mt-5 pt-4 border-t border-[#F0E0D5]">
                <div className="px-3 mb-2 text-[10px] font-bold text-[#737373] uppercase tracking-widest">
                  Financial & Integrations
                </div>
                <div className="space-y-1">
                  <NavLink to="/admin/invoices" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <FileText
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Invoices & Zoho Sync</span>
                      </>
                    )}
                  </NavLink>

                  <NavLink to="/admin/analytics" onClick={handleNavClick} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <BarChart3
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#737373] group-hover:text-[#F47732]'
                            }`}
                        />
                        <span className="truncate">Reports & Analytics</span>
                      </>
                    )}
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section: Quick Cart & Sign Out */}
          <div className="pt-3 mt-2 border-t border-[#F0E0D5] flex-shrink-0">

            {/* Wholesale Cart Drawer trigger if Retailer / Salesman or items in cart */}
            {user && (user.role === UserRole.RETAILER || user.role === UserRole.SALESMAN || itemCount > 0) && (
              <button
                type="button"
                onClick={openCart}
                className="w-full mb-2 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[#292929] hover:text-[#F47732] bg-[#FFF8F3] hover:bg-[#FFF1E8] border border-[#F0E0D5] transition-all group"
                title="Open Wholesale Cart"
              >
                <div className="flex items-center space-x-2.5">
                  <ShoppingCart className="h-4 w-4 text-[#F47732] group-hover:scale-105 transition-transform" />
                  <span>Wholesale Cart</span>
                </div>
                {itemCount > 0 ? (
                  <span className="bg-[#F47732] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-xs">
                    {itemCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#737373]">Empty</span>
                )}
              </button>
            )}

            {/* Clean Full-Width Sign Out Button */}
            <button
              type="button"
              onClick={() => logout()}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-[#737373] hover:text-[#E95B2A] hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all duration-150 group"
              title="Sign out of your account"
            >
              <div className="flex items-center space-x-2.5">
                <LogOut className="h-4 w-4 text-[#737373] group-hover:text-[#E95B2A] transition-colors" />
                <span className="font-semibold">Sign Out</span>
              </div>
              <span className="text-[10px] text-[#737373] group-hover:text-[#E95B2A] font-mono">
                Exit
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
