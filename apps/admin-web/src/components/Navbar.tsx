import React from 'react';
import { useAuth } from '../lib/auth-context';
import { useSidebar } from '../lib/sidebar-context';
import { useCart } from '../lib/cart-context';
import { Menu, LogOut, ShoppingCart, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '@necessity/shared';

export const Navbar: React.FC = () => {
  const { user, retailer, logout } = useAuth();
  const { toggleSidebar } = useSidebar();
  const { itemCount, openCart } = useCart();

  if (!user) return null;

  const isRetailer = user.role === UserRole.RETAILER;

  return (
    <header className="lg:hidden bg-white border-b border-[#F0E0D5] text-[#292929] sticky top-0 z-30 shadow-xs">
      <div className="w-full px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Section: Mobile Hamburger Toggle + Brand Identity */}
        <div className="flex items-center space-x-3">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Open navigation sidebar"
            className="lg:hidden p-2 rounded-xl text-[#292929] hover:text-[#F47732] hover:bg-[#FFF8F3] border border-[#F0E0D5] focus:outline-none focus:ring-2 focus:ring-[#F47732] transition-colors flex-shrink-0"
          >
            <Menu className="h-5 w-5 text-[#292929]" />
          </button>

          {/* Brand Logo & Name */}
          <Link to={isRetailer ? '/retailer' : '/admin'} className="flex items-center space-x-2.5 group">
            <img
              src="/img.jpeg"
              alt="Necessity India"
              className="h-9 w-auto max-w-[120px] sm:max-w-[140px] object-contain rounded-md"
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-[#292929] group-hover:text-[#F47732] transition-colors truncate">
                  NECESSITY INDIA
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#FFF1E8] text-[#E95B2A] border border-[#F0E0D5] flex-shrink-0">
                  {isRetailer ? 'Retailer Portal' : 'B2B Admin'}
                </span>
              </div>
              <div className="hidden xs:flex items-center space-x-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <span className="text-[11px] text-[#737373] font-medium tracking-tight truncate max-w-[200px] sm:max-w-xs">
                  {retailer?.businessName ? retailer.businessName : 'Enterprise Distribution Platform'}
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
};
