import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { CustomSelect } from '../../components/ui';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { AccountStatus, CreditStatus, CustomerType, formatPaiseToINR } from '@necessity/shared';

export const PendingRetailersScreen: React.FC = () => {
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata: Pricing and Discount Groups
  const [pricingGroups, setPricingGroups] = useState<any[]>([]);
  const [discountGroups, setDiscountGroups] = useState<any[]>([]);

  // Review modal state
  const [selectedRetailer, setSelectedRetailer] = useState<any | null>(null);
  const [customerType, setCustomerType] = useState<CustomerType>(CustomerType.RETAILER);
  const [pricingGroupId, setPricingGroupId] = useState('');
  const [discountGroupId, setDiscountGroupId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/retailers/pending');
      setPendingList(res.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load pending retailers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    const fetchMetadata = async () => {
      try {
        const [pgRes, dgRes] = await Promise.all([
          api.get('/pricing/groups').catch(() => ({ data: { data: [] } })),
          api.get('/discounts/groups').catch(() => ({ data: { data: [] } })),
        ]);
        setPricingGroups(pgRes.data?.data || []);
        setDiscountGroups(dgRes.data?.data || []);
      } catch (e) {
        console.warn('Failed to load metadata in pending retailers:', e);
      }
    };
    fetchMetadata();
  }, []);

  const handleOpenReview = (retailer: any) => {
    setSelectedRetailer(retailer);
    const ct = String(retailer.requestedCustomerType || retailer.customerType || '').toLowerCase();
    if (ct === 'wholesaler' || ct === 'old') setCustomerType(CustomerType.WHOLESALER);
    else if (ct === 'distributor') setCustomerType(CustomerType.DISTRIBUTOR);
    else setCustomerType(CustomerType.RETAILER);
    setPricingGroupId(retailer.pricingGroupId?._id || retailer.pricingGroupId || '');
    setDiscountGroupId(retailer.discountGroupId?._id || retailer.discountGroupId || '');
    setActionSuccess(null);
  };

  const handleApprovalAction = async (newStatus: AccountStatus) => {
    if (!selectedRetailer) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.patch(`/retailers/${selectedRetailer.retailerId}/approval`, {
        status: newStatus,
        customerType: newStatus === AccountStatus.ACTIVE ? customerType : undefined,
        pricingGroupId: newStatus === AccountStatus.ACTIVE && pricingGroupId ? pricingGroupId : undefined,
        discountGroupId: newStatus === AccountStatus.ACTIVE && discountGroupId ? discountGroupId : undefined,
        creditLimitPaise: 0,
        paymentTermsDays: 0,
        creditStatus: CreditStatus.NORMAL,
      });

      const emailInfo = res.data?.data?.emailNotification;
      let actionMsg = `Retailer "${selectedRetailer.businessName}" has been successfully ${newStatus === AccountStatus.ACTIVE ? 'APPROVED as ' + customerType.toUpperCase() : 'REJECTED'
        }.`;

      if (emailInfo?.success) {
        actionMsg += ' Approval confirmation email sent successfully.';
      } else if (emailInfo?.error) {
        actionMsg += ` (Email note: ${emailInfo.error})`;
      }

      setActionSuccess(actionMsg);

      setTimeout(() => {
        setSelectedRetailer(null);
        fetchPending();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update approval status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Retailer Account Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review submitted KYC details, verify GSTINs, and assign customer tiers & pricing groups.
          </p>
        </div>

        <button
          onClick={fetchPending}
          className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
        >
          Refresh List
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-3 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center space-x-3 text-sm">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm text-slate-800">Pending Review Queue</span>
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingList.length}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading pending applications...</div>
        ) : pendingList.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Queue is Clear!</h3>
            <p className="text-sm text-slate-500 mt-1">There are no pending retailer registrations awaiting approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full text-center text-sm min-w-[700px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3 text-left">Business / Firm</th>
                  <th className="px-6 py-3 text-center">Contact Person</th>
                  <th className="px-6 py-3 text-center">GSTIN & PAN</th>
                  <th className="px-6 py-3 text-center">City & State</th>
                  <th className="px-6 py-3 text-center">Submitted On</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingList.map((item) => (
                  <tr key={item.retailerId || item.userId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-left">
                      <div className="font-semibold text-slate-900">{item.businessName}</div>
                      {item.tradeName && <div className="text-xs text-slate-500">{item.tradeName}</div>}
                      {item.requestedCustomerType && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-[#E95B2A] rounded border border-orange-200">
                          Requested: {item.requestedCustomerType}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="text-slate-800">{item.contactPerson}</div>
                      <div className="text-xs text-slate-500 font-mono">{item.phone}</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      {item.gstin ? (
                        <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {item.gstin}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unregistered / Non-GST</span>
                      )}
                      {item.pan && <div className="text-[11px] text-slate-500 font-mono mt-0.5">PAN: {item.pan}</div>}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="text-slate-700">{item.billingAddress?.city || 'N/A'}, {item.billingAddress?.state}</div>
                      <div className="text-xs text-slate-400">{item.billingAddress?.pincode}</div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500 text-center">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end">
                        <button
                          onClick={() => handleOpenReview(item)}
                          className="inline-flex items-center justify-center px-3 py-1.5 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                          Review & Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Approval Modal */}
      <Modal
        isOpen={!!selectedRetailer}
        onClose={() => setSelectedRetailer(null)}
        title="Review & Approve Retailer Account"
      >
        {selectedRetailer && (
          <div className="space-y-5">
            {/* Business summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Business Name:</span>
                <span className="font-bold text-slate-900">{selectedRetailer.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact Person:</span>
                <span className="text-slate-800">{selectedRetailer.contactPerson} ({selectedRetailer.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GSTIN:</span>
                <span className="font-mono text-slate-800">{selectedRetailer.gstin || 'None (Non-GST)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registered Address:</span>
                <span className="text-slate-700 text-right max-w-xs">
                  {selectedRetailer.billingAddress?.street}, {selectedRetailer.billingAddress?.city}, {selectedRetailer.billingAddress?.state} - {selectedRetailer.billingAddress?.pincode}
                </span>
              </div>
            </div>

            {/* Customer Type & Classification */}
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                Customer Classification & Commercial Group Assignment
              </h4>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Assigned Customer Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${customerType === CustomerType.RETAILER
                      ? 'border-[#F47732] bg-[#FFF8F3] text-[#292929] font-bold ring-1 ring-[#F47732]'
                      : 'border-slate-200 bg-white text-slate-700'
                      }`}
                  >
                    <input
                      type="radio"
                      name="pendingCustType"
                      value={CustomerType.RETAILER}
                      checked={customerType === CustomerType.RETAILER}
                      onChange={() => setCustomerType(CustomerType.RETAILER)}
                      className="mt-0.5 text-[#F47732] focus:ring-[#F47732]"
                    />
                    <div>
                      <span className="font-bold block">Retailer</span>
                      <span className="text-[10px] text-[#737373] leading-tight">Standard B2B store dealer</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${customerType === CustomerType.WHOLESALER
                      ? 'border-[#F47732] bg-[#FFF8F3] text-[#292929] font-bold ring-1 ring-[#F47732]'
                      : 'border-slate-200 bg-white text-slate-700'
                      }`}
                  >
                    <input
                      type="radio"
                      name="pendingCustType"
                      value={CustomerType.WHOLESALER}
                      checked={customerType === CustomerType.WHOLESALER}
                      onChange={() => setCustomerType(CustomerType.WHOLESALER)}
                      className="mt-0.5 text-[#F47732] focus:ring-[#F47732]"
                    />
                    <div>
                      <span className="font-bold block">Wholesaler</span>
                      <span className="text-[10px] text-[#737373] leading-tight">Bulk volume tiers & breaks</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-all ${customerType === CustomerType.DISTRIBUTOR
                      ? 'border-[#F47732] bg-[#FFF8F3] text-[#292929] font-bold ring-1 ring-[#F47732]'
                      : 'border-slate-200 bg-white text-slate-700'
                      }`}
                  >
                    <input
                      type="radio"
                      name="pendingCustType"
                      value={CustomerType.DISTRIBUTOR}
                      checked={customerType === CustomerType.DISTRIBUTOR}
                      onChange={() => setCustomerType(CustomerType.DISTRIBUTOR)}
                      className="mt-0.5 text-[#F47732] focus:ring-[#F47732]"
                    />
                    <div>
                      <span className="font-bold block">Distributor</span>
                      <span className="text-[10px] text-[#737373] leading-tight">Enterprise & custom terms</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assigned Pricing Group
                  </label>
                  <CustomSelect
                    value={pricingGroupId}
                    onChange={(val) => setPricingGroupId(val)}
                    options={[
                      { value: '', label: `Default (${customerType} base pricing)` },
                      ...pricingGroups.map((pg: any) => ({
                        value: pg.id || pg._id,
                        label: `${pg.name} ${pg.isDefault ? '(Default Group)' : ''}`,
                      })),
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Assigned Discount Group
                  </label>
                  <CustomSelect
                    value={discountGroupId}
                    onChange={(val) => setDiscountGroupId(val)}
                    options={[
                      { value: '', label: `Default (${customerType} standard eligibility)` },
                      ...discountGroups.map((dg: any) => ({
                        value: dg.id || dg._id,
                        label: `${dg.name} ${dg.defaultDiscountPercent ? `(${dg.defaultDiscountPercent}% Base)` : ''}`,
                      })),
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApprovalAction(AccountStatus.REJECTED)}
                className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition"
              >
                Reject Application
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApprovalAction(AccountStatus.ACTIVE)}
                className="inline-flex items-center px-5 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Approving...' : 'Approve & Activate Account'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
