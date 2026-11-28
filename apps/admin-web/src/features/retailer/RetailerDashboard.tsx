import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import {
  Building2,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  ShoppingBag,
  FileText,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { formatPaiseToINR, AccountStatus } from '@necessity/shared';

export const RetailerDashboard: React.FC = () => {
  const { user, retailer } = useAuth();

  const isPending = user?.accountStatus === AccountStatus.PENDING;

  return (
    <div className="space-y-8">
      {/* Retailer Header Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#F0E0D5]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#292929] tracking-tight">
                {retailer?.businessName || user?.name || 'Retail Partner Portal'}
              </h1>
              {isPending ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <Clock className="h-3 w-3 mr-1" /> Pending Approval
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active Account
                </span>
              )}
            </div>
            <p className="text-sm text-[#737373] mt-1">
              Contact: {user?.name} • Phone: {user?.phone} {retailer?.gstin ? `• GSTIN: ${retailer.gstin}` : ''}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/retailer/catalogue"
              className="inline-flex items-center px-4 py-2.5 rounded-lg bg-[#F47732] hover:bg-[#E95B2A] text-white font-medium text-sm shadow-sm transition"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Place New Order
            </Link>
          </div>
        </div>

        {isPending && (
          <div className="mt-6 p-4 rounded-xl bg-[#FFF8F3] border border-[#F0E0D5] flex items-start space-x-3 text-[#292929] text-sm">
            <Clock className="h-5 w-5 text-[#F47732] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Your business account is awaiting distributor approval.</p>
              <p className="text-xs text-[#737373] mt-0.5">
                Necessity India administrators are reviewing your registration details. Your wholesale dealer pricing and catalog access will be activated upon approval.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link
          to="/retailer/catalogue"
          className="bg-white p-6 rounded-xl border border-[#F0E0D5] hover:border-[#F47732] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="h-10 w-10 bg-[#FFF1E8] text-[#F47732] rounded-lg flex items-center justify-center mb-3 group-hover:bg-[#F47732] group-hover:text-white transition-colors">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[#292929] text-base group-hover:text-[#F47732] transition-colors">
              Product Catalogue
            </h3>
            <p className="text-xs text-[#737373] mt-1">
              Browse towels, napkins, dispenser rolls, bed linen, and cleaning consumables.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0E0D5] flex items-center justify-between text-xs font-bold text-[#F47732]">
            <span>Browse Products & Order</span>
            <span>&rarr;</span>
          </div>
        </Link>

        <Link
          to="/retailer/orders"
          className="bg-white p-6 rounded-xl border border-[#F0E0D5] hover:border-[#F47732] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
        >
          <div>
            <div className="h-10 w-10 bg-[#FFF1E8] text-[#F47732] rounded-lg flex items-center justify-center mb-3 group-hover:bg-[#F47732] group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-[#292929] text-base group-hover:text-[#F47732] transition-colors">
              Orders & Invoices
            </h3>
            <p className="text-xs text-[#737373] mt-1">
              View current dispatch status, itemized line items, and tax invoice breakdowns.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0E0D5] flex items-center justify-between text-xs font-bold text-[#F47732]">
            <span>Track Orders</span>
            <span>&rarr;</span>
          </div>
        </Link>

        <div className="bg-white p-6 rounded-xl border border-[#F0E0D5] shadow-sm flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 bg-[#FFF1E8] text-[#F47732] rounded-lg flex items-center justify-center mb-3">
              <Phone className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-[#292929] text-base">Assigned Salesman</h3>
            <p className="text-xs text-[#737373] mt-1">
              Connect directly with your territory account representative for custom rates and orders.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#F0E0D5]">
            <span className="text-xs font-semibold text-[#F47732]">Necessity Field Support: 1800-XXX-XXXX</span>
          </div>
        </div>
      </div>
    </div>
  );
};
