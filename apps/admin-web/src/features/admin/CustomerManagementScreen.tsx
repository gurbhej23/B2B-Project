import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { CustomSelect } from '../../components/ui';
import {
  Users,
  Search,
  Building2,
  Phone,
  Mail,
  AlertTriangle,
  X,
  Check,
  RefreshCw,
  Edit,
  Info,
  CheckCircle2,
  XCircle,
  Filter,
  Trash2,
  ShoppingBag,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  AccountStatus,
  CustomerType,
  CreditStatus,
  formatPaiseToINR,
  inrToPaise,
  extractErrorMessage,
} from '@necessity/shared';

export const CustomerManagementScreen: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata: Pricing Groups and Discount Groups
  const [pricingGroups, setPricingGroups] = useState<any[]>([]);
  const [discountGroups, setDiscountGroups] = useState<any[]>([]);

  // Search and status filter
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals & Active Selections
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Customer Details Modal tab & orders
  const [detailsTab, setDetailsTab] = useState<'info' | 'orders'>('info');
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form states for approval & edit
  const [approvalCustomerType, setApprovalCustomerType] = useState<CustomerType>(CustomerType.RETAILER);
  const [approvalPricingGroupId, setApprovalPricingGroupId] = useState('');
  const [approvalDiscountGroupId, setApprovalDiscountGroupId] = useState('');
  const [creditLimitRupees, setCreditLimitRupees] = useState('200000');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(
    null
  );

  // Edit modal form states
  const [editCustomerType, setEditCustomerType] = useState<CustomerType>(CustomerType.RETAILER);
  const [editPricingGroupId, setEditPricingGroupId] = useState('');
  const [editDiscountGroupId, setEditDiscountGroupId] = useState('');
  const [editCreditLimitRupees, setEditCreditLimitRupees] = useState('200000');
  const [editPaymentTermsDays, setEditPaymentTermsDays] = useState('30');
  const [editCreditStatus, setEditCreditStatus] = useState<CreditStatus>(CreditStatus.NORMAL);
  const [editIsActive, setEditIsActive] = useState(true);

  const fetchCustomers = async (
    overrideSearch?: string,
    overrideStatus?: 'all' | 'active' | 'inactive',
    overridePage?: number
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const activeSearch = overrideSearch !== undefined ? overrideSearch : debouncedSearch;
      const activeStatus = overrideStatus !== undefined ? overrideStatus : statusFilter;
      const activePage = overridePage !== undefined ? overridePage : page;

      const params: Record<string, any> = {
        page: activePage,
        limit,
      };

      if (activeSearch && activeSearch.trim()) {
        params.search = activeSearch.trim();
      }

      if (activeStatus === 'active') {
        params.isActive = 'true';
      } else if (activeStatus === 'inactive') {
        params.isActive = 'false';
      }

      const res = await api.get('/customers', { params });
      setCustomers(res.data?.data || []);
      setTotalCount(res.data?.pagination?.total || res.data?.data?.length || 0);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  // Load metadata: Pricing Groups and Discount Groups
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [pgRes, dgRes] = await Promise.all([
          api.get('/pricing/groups').catch(() => ({ data: { data: [] } })),
          api.get('/discounts/groups').catch(() => ({ data: { data: [] } })),
        ]);
        setPricingGroups(pgRes.data?.data || []);
        setDiscountGroups(dgRes.data?.data || []);
      } catch (e) {
        console.warn('Failed to load pricing or discount groups:', e);
      }
    };
    fetchMetadata();
  }, []);

  // Debounced search on input change
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch when debouncedSearch, statusFilter, or page changes
  useEffect(() => {
    fetchCustomers(debouncedSearch, statusFilter, page);
  }, [debouncedSearch, statusFilter, page]);

  // Helper to map customerType to canonical enum
  const mapCustomerType = (ct?: string): CustomerType => {
    const lower = String(ct || '').toLowerCase();
    if (lower === 'wholesaler' || lower === 'old') return CustomerType.WHOLESALER;
    if (lower === 'distributor') return CustomerType.DISTRIBUTOR;
    return CustomerType.RETAILER;
  };

  // Open Details Modal
  const openDetails = async (cust: any) => {
    setSelectedCustomer(cust);
    setIsDetailsOpen(true);
    setActionNotice(null);
    setDetailsTab('info');
    setCustomerOrders([]);
    setLoadingOrders(true);
    const targetId = cust.retailerId || cust.id || cust._id;
    try {
      const res = await api.get('/orders', { params: { retailerId: targetId, limit: 10 } });
      setCustomerOrders(res.data?.data || []);
    } catch (e) {
      console.warn('Failed to fetch customer orders:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Open Edit Modal
  const openEdit = (cust: any) => {
    setSelectedCustomer(cust);
    setEditCustomerType(mapCustomerType(cust.customerType));
    setEditCreditLimitRupees(String((cust.creditLimitPaise || 0) / 100));
    setEditPaymentTermsDays(String(cust.paymentTermsDays || 30));
    setEditCreditStatus(cust.creditStatus || CreditStatus.NORMAL);
    setEditIsActive(cust.isActive ?? true);
    setEditPricingGroupId(cust.pricingGroupId?._id || cust.pricingGroupId || '');
    setEditDiscountGroupId(cust.discountGroupId?._id || cust.discountGroupId || '');
    setActionNotice(null);
    setIsEditOpen(true);
  };

  // Toggle Customer Active/Disabled via Switch Button
  const handleToggleCustomerSwitch = async (cust: any) => {
    const targetId = String(cust.id || cust._id);
    if (!targetId || targetId === 'undefined') return;

    const currentActive = cust.isActive ?? true;

    // 1. If currently enabled, admin wants to DISABLE -> Show pop-up for reason!
    if (currentActive) {
      setSelectedCustomer(cust);
      setStatusChangeReason('');
      setActionNotice(null);
      setIsStatusConfirmOpen(true);
      return;
    }

    // 2. If currently disabled, admin wants to ENABLE -> DO NOT show pop-up, enable immediately!
    setTogglingId(targetId);
    try {
      const res = await api.patch(`/customers/${targetId}/status`, {
        isActive: true,
        reason: 'Re-enabled by administrator',
      });

      const finalActive = res.data?.data?.isActive ?? true;

      // Update strictly the targeted customer in the list
      setCustomers((prev) =>
        prev.map((c) => {
          const cId = String(c.id || c._id);
          return cId === targetId ? { ...c, isActive: finalActive } : c;
        })
      );

      // If selected customer modal is active, update it too
      if (selectedCustomer && String(selectedCustomer.id || selectedCustomer._id) === targetId) {
        setSelectedCustomer((prev: any) => (prev ? { ...prev, isActive: finalActive } : prev));
      }

      const emailInfo = res.data?.data?.emailNotification;
      let enableMsg = `Customer "${cust.businessName}" enabled successfully. Account access restored.`;
      if (emailInfo?.success) {
        enableMsg += ' Notification email sent to customer.';
      } else if (emailInfo?.error) {
        enableMsg += ` (Notice: ${emailInfo.error})`;
      }

      setActionNotice({
        type: 'success',
        message: enableMsg,
      });

      setTimeout(() => {
        setActionNotice((curr) => (curr?.message === enableMsg ? null : curr));
      }, 5000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update customer status');
    } finally {
      setTogglingId(null);
    }
  };

  // Open Approve Modal
  const openApprove = (cust: any) => {
    setSelectedCustomer(cust);
    setApprovalCustomerType(mapCustomerType(cust.requestedCustomerType || cust.customerType));
    setApprovalPricingGroupId(cust.pricingGroupId?._id || cust.pricingGroupId || '');
    setApprovalDiscountGroupId(cust.discountGroupId?._id || cust.discountGroupId || '');
    setCreditLimitRupees('200000');
    setPaymentTermsDays('30');
    setIsApproveOpen(true);
    setActionNotice(null);
  };

  // Open Reject Modal
  const openReject = (cust: any) => {
    setSelectedCustomer(cust);
    setRejectionReason('');
    setIsRejectOpen(true);
    setActionNotice(null);
  };

  // Open Disable/Enable Confirmation
  const openStatusConfirm = (cust: any) => {
    setSelectedCustomer(cust);
    setStatusChangeReason('');
    setIsStatusConfirmOpen(true);
    setActionNotice(null);
  };

  // Open Delete / Archive Confirmation
  const openDeleteConfirm = (cust: any) => {
    setSelectedCustomer(cust);
    setDeleteReason('');
    setIsDeleteOpen(true);
    setActionNotice(null);
  };

  // Submit Delete or Safe Archival
  const handleConfirmDelete = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setActionNotice(null);

    const targetId = String(selectedCustomer.id || selectedCustomer._id || selectedCustomer.retailerId);
    if (!targetId || targetId === 'undefined') {
      setActionNotice({ type: 'error', message: 'Invalid customer identifier' });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.delete(`/customers/${targetId}`, {
        data: { reason: deleteReason.trim() || 'Archived/deleted by administrator' },
      });

      const resultMsg = res.data?.message || 'Customer account updated successfully';
      setActionNotice({
        type: 'success',
        message: resultMsg,
      });

      setIsDeleteOpen(false);
      setIsDetailsOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: extractErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Submit Approval
  const handleApproveSubmit = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setActionNotice(null);

    try {
      const creditPaise = inrToPaise(parseFloat(creditLimitRupees) || 0);
      const terms = parseInt(paymentTermsDays, 10) || 15;

      const res = await api.patch(`/customers/${selectedCustomer.id || selectedCustomer.retailerId}/approve`, {
        customerType: approvalCustomerType,
        pricingGroupId: approvalPricingGroupId || undefined,
        discountGroupId: approvalDiscountGroupId || undefined,
        creditLimitPaise: creditPaise,
        paymentTermsDays: terms,
        creditStatus: CreditStatus.NORMAL,
      });

      const emailInfo = res.data?.data?.emailNotification;
      let noticeMsg = `Customer "${selectedCustomer.businessName}" approved successfully as ${approvalCustomerType.toUpperCase()} customer.`;

      if (emailInfo?.success) {
        noticeMsg += ' Approval notification email sent.';
      } else if (emailInfo?.skipped) {
        noticeMsg += ' (Note: SMTP email delivery skipped as SMTP provider is not configured).';
      } else if (emailInfo?.error) {
        noticeMsg += ` (Email warning: ${emailInfo.error}).`;
      }

      setActionNotice({
        type: emailInfo?.error ? 'warning' : 'success',
        message: noticeMsg,
      });

      setTimeout(() => {
        setIsApproveOpen(false);
        setIsDetailsOpen(false);
        fetchCustomers();
      }, 1500);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to approve customer',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Rejection
  const handleRejectSubmit = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setActionNotice(null);

    try {
      await api.patch(`/customers/${selectedCustomer.id || selectedCustomer.retailerId}/reject`, {
        rejectionReason: rejectionReason.trim() || 'Application criteria not met',
      });

      setActionNotice({
        type: 'success',
        message: `Application for "${selectedCustomer.businessName}" rejected.`,
      });

      setTimeout(() => {
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        fetchCustomers();
      }, 1500);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to reject customer application',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Change Customer Type (New / Old)
  const handleChangeCustomerType = async (newType: CustomerType) => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setActionNotice(null);

    const targetId = String(selectedCustomer.id || selectedCustomer._id);
    if (!targetId || targetId === 'undefined') {
      setActionNotice({ type: 'error', message: 'Invalid customer identifier' });
      setIsSubmitting(false);
      return;
    }

    try {
      await api.patch(`/customers/${targetId}/type`, {
        customerType: newType,
      });

      // Update local state strictly for this customer
      setSelectedCustomer((prev: any) => (prev ? { ...prev, customerType: newType } : prev));
      setCustomers((prev) =>
        prev.map((c) => {
          const cId = String(c.id || c._id);
          return cId === targetId ? { ...c, customerType: newType } : c;
        })
      );

      setActionNotice({
        type: 'success',
        message: `Customer type updated to ${newType.toUpperCase()} (Audit record logged).`,
      });
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to update customer type',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Confirm Disable Customer from Reason Popup
  const handleConfirmDisable = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setActionNotice(null);

    const targetId = String(selectedCustomer.id || selectedCustomer._id);
    if (!targetId || targetId === 'undefined') {
      setActionNotice({ type: 'error', message: 'Invalid customer identifier' });
      setIsSubmitting(false);
      return;
    }

    try {
      const reasonText = statusChangeReason.trim() || 'Disabled by administrator';
      const res = await api.patch(`/customers/${targetId}/status`, {
        isActive: false,
        reason: reasonText,
      });

      const updated = res.data?.data;
      const finalIsActive = updated?.isActive ?? false;

      // Update selected customer view state
      setSelectedCustomer((prev: any) => (prev ? { ...prev, isActive: finalIsActive } : prev));

      // Update ONLY the selected customer in the list by unique ID comparison
      setCustomers((prev) =>
        prev.map((c) => {
          const cId = String(c.id || c._id);
          if (cId === targetId) {
            return {
              ...c,
              isActive: finalIsActive,
            };
          }
          return c;
        })
      );

      const emailInfo = updated?.emailNotification;
      let disableMsg = `Customer account "${selectedCustomer.businessName}" disabled successfully.`;
      if (emailInfo?.success) {
        disableMsg += ' Notification email sent to customer.';
      } else if (emailInfo?.error) {
        disableMsg += ` (Notice: ${emailInfo.error})`;
      }

      setIsStatusConfirmOpen(false);
      setStatusChangeReason('');
      setActionNotice({
        type: 'success',
        message: disableMsg,
      });

      setTimeout(() => {
        setActionNotice((curr) => (curr?.message === disableMsg ? null : curr));
      }, 5000);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to disable customer account',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Customer Edits (Classification, Credit, Terms, Status)
  const handleSaveEdit = async () => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    setActionNotice(null);

    const targetId = String(selectedCustomer.id || selectedCustomer._id);
    try {
      const creditPaise = inrToPaise(parseFloat(editCreditLimitRupees) || 0);
      const terms = parseInt(editPaymentTermsDays, 10) || 15;

      const targetStatus =
        selectedCustomer.accountStatus === AccountStatus.REJECTED ||
          selectedCustomer.accountStatus === AccountStatus.SUSPENDED
          ? selectedCustomer.accountStatus
          : AccountStatus.ACTIVE;

      // 1. Update credit & classification settings
      const assignedPg = pricingGroups.find((g) => g.id === editPricingGroupId || g._id === editPricingGroupId);
      const assignedDg = discountGroups.find((g) => g.id === editDiscountGroupId || g._id === editDiscountGroupId);

      await api.patch(`/customers/${targetId}/approval`, {
        status: targetStatus,
        customerType: editCustomerType,
        pricingGroupId: editPricingGroupId || null,
        discountGroupId: editDiscountGroupId || null,
        creditLimitPaise: creditPaise,
        paymentTermsDays: terms,
        creditStatus: editCreditStatus,
      });

      // 2. If access status was changed in the edit dialog
      const currentActive = selectedCustomer.isActive ?? true;
      if (editIsActive !== currentActive) {
        await api.patch(`/customers/${targetId}/status`, {
          isActive: editIsActive,
          reason: 'Updated in customer edit dialog',
        });
      }

      // Update in local state
      setCustomers((prev) =>
        prev.map((c) => {
          const cId = String(c.id || c._id);
          if (cId === targetId) {
            return {
              ...c,
              customerType: editCustomerType,
              pricingGroupId: assignedPg || (editPricingGroupId ? { _id: editPricingGroupId, name: 'Assigned' } : null),
              discountGroupId: assignedDg || (editDiscountGroupId ? { _id: editDiscountGroupId, name: 'Assigned' } : null),
              creditLimitPaise: creditPaise,
              paymentTermsDays: terms,
              creditStatus: editCreditStatus,
              isActive: editIsActive,
            };
          }
          return c;
        })
      );

      setActionNotice({
        type: 'success',
        message: `Customer "${selectedCustomer.businessName}" updated successfully.`,
      });

      setTimeout(() => {
        setIsEditOpen(false);
        fetchCustomers();
      }, 1200);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err.response?.data?.error?.message || 'Failed to update customer',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-[#292929] tracking-tight flex items-center gap-2">
        <Users className="h-6 w-6 text-[#F47732]" />
        Customer Management
      </h1>

      {/* Search Bar, Filter & Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#737373]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers by name, business, phone, email, or GSTIN..."
            className="w-full pl-10 pr-10 py-2 text-sm border border-[#F0E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] transition-all shadow-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDebouncedSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-2.5 p-1 rounded-full text-[#737373] hover:text-[#292929] hover:bg-[#FFF8F3] transition-colors"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active/Inactive Status Filter */}
          <div className="w-40">
            <CustomSelect
              id="customer-status-filter"
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val as 'all' | 'active' | 'inactive');
                setPage(1);
              }}
              icon={<Filter className="h-3.5 w-3.5" />}
              options={[
                { value: 'all', label: 'All Users' },
                { value: 'active', label: 'Active Users' },
                { value: 'inactive', label: 'Inactive Users' },
              ]}
              title="Filter customers by active/inactive status"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchCustomers(debouncedSearch, statusFilter, page)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#F47732] disabled:opacity-50 flex-shrink-0"
            title="Refresh customer list"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#F47732]' : 'text-[#737373]'}`} />
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Global Success / Action Notification Banner */}
      {actionNotice && !isStatusConfirmOpen && !isApproveOpen && !isRejectOpen && !isEditOpen && !isDetailsOpen ? (
        <div
          className={`!mb-3 px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between shadow-sm transition-all ${actionNotice.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : actionNotice.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2.5">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            ) : actionNotice.type === 'warning' ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-xs border border-[#F0E0D5] overflow-hidden">
        <div className="overflow-x-auto touch-scroll">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-[#FFF8F3] border-b border-[#F0E0D5] text-[#292929] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 text-center">
                  Customer
                </th>
                <th className="py-3 px-4 text-center">
                  Contact
                </th>
                <th className="py-3 px-4 text-center">
                  Business
                </th>
                <th className="py-3 px-4 text-center">
                  Type
                </th>
                <th className="py-3 px-4 text-center">
                  Registered
                </th>
                <th className="py-3 px-4 text-center">
                  Status
                </th>
                <th className="">
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E0D5]/50 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#737373]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#F47732] border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading customer records...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No customers found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or status filter.</p>
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const isApproved = cust.accountStatus === AccountStatus.ACTIVE;
                  const isPending = cust.accountStatus === AccountStatus.PENDING;
                  const isRejected = cust.accountStatus === AccountStatus.REJECTED;
                  const isSuspended = cust.accountStatus === AccountStatus.SUSPENDED;
                  const isActive = cust.isActive ?? true;

                  const normType = String(cust.customerType || '').toLowerCase();
                  const isWholesaler = normType === 'wholesaler' || normType === 'old';
                  const isDistributor = normType === 'distributor';

                  const pgName = cust.pricingGroupId?.name || cust.pricingGroupName || 'Default Matrix';
                  const dgName = cust.discountGroupId?.name || cust.discountGroupName || 'Default Group';

                  return (
                    <tr key={cust.id || cust._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-left gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-[#292929] text-xs truncate">
                              {cust.contactPerson || cust.name || cust.businessName || 'Customer'}
                            </div>
                            <div className="text-xs text-[#737373] truncate">
                              {cust.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="text-xs font-medium text-[#292929]">
                          {cust.phone ? (cust.phone.startsWith('+91') ? cust.phone : `+91 ${cust.phone}`) : '—'}
                        </div>
                      </td>

                      {/* Business */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="min-w-0">
                          <div className="font-bold text-[#292929] text-xs truncate">
                            {cust.businessName || cust.tradeName || '—'}
                          </div>
                          <div className="text-xs text-[#737373] truncate">
                            GST: {cust.gstin || <span className="italic text-slate-400">Unregistered</span>}
                          </div>
                        </div>
                      </td>

                      {/* TYPE */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {(() => {
                          const rawType = String(cust.customerType || '').toLowerCase();
                          let label = 'Regular';
                          let badgeClasses = 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]';
                          if (rawType === 'wholesaler' || rawType === 'old') {
                            label = 'Wholesaler';
                            badgeClasses = 'bg-blue-50 text-blue-700 border border-blue-200';
                          } else if (rawType === 'distributor') {
                            label = 'Distributor';
                            badgeClasses = 'bg-purple-50 text-purple-700 border border-purple-200';
                          } else if (rawType === 'retailer' || !rawType) {
                            label = 'Regular';
                            badgeClasses = 'bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]';
                          }
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${badgeClasses}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Registered */}
                      <td className="py-3.5 px-4 text-xs text-[#292929] whitespace-nowrap text-center">
                        {new Date(cust.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* STATUS (Orange switch when active) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isActive}
                          disabled={togglingId === (cust.id || cust._id)}
                          onClick={() => handleToggleCustomerSwitch(cust)}
                          className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:ring-offset-1 ${isActive ? 'bg-[#F47732]' : 'bg-slate-300'
                            } ${togglingId === (cust.id || cust._id) ? 'opacity-50 cursor-wait' : ''}`}
                          title={isActive ? `Active (Click to Disable ${cust.businessName})` : `Disabled (Click to Enable ${cust.businessName})`}
                        >
                          <span className="sr-only">{isActive ? 'Disable customer' : 'Enable customer'}</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isPending && (
                            <>
                              <button
                                onClick={() => openApprove(cust)}
                                className="bg-[#F47732] hover:bg-[#E95B2A] text-white text-xs font-semibold px-2.5 py-1 rounded shadow-xs transition-colors"
                                title={`Approve ${cust.businessName}`}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => openReject(cust)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1 rounded transition-colors"
                                title={`Reject ${cust.businessName}`}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => openEdit(cust)}
                            className="inline-flex items-center gap-1 text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] text-xs font-semibold px-2.5 py-1 rounded shadow-xs transition-all"
                            title={`Edit ${cust.businessName}`}
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openDetails(cust)}
                            className="inline-flex gap-1 text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] text-xs font-semibold px-2.5 py-1 rounded shadow-xs transition-all"
                            title={`Details ${cust.businessName}`}
                          >
                            <Info className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openDeleteConfirm(cust)}
                            className="inline-flex items-center gap-1 text-[#737373] hover:text-rose-600 bg-white hover:bg-rose-50 border border-[#F0E0D5] hover:border-rose-300 text-xs font-semibold px-2 py-1 rounded shadow-xs transition-all"
                            title={`Archive / Delete ${cust.businessName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#FFF8F3] border-t border-[#F0E0D5] flex items-center justify-between text-xs text-[#737373]">
          <div>
            Showing <span className="font-semibold text-[#292929]">{customers.length}</span> of{' '}
            <span className="font-semibold text-[#292929]">{totalCount}</span> customers
            {statusFilter !== 'all' && (
              <span className="ml-1 text-[#737373] font-normal">
                ({statusFilter === 'active' ? 'active only' : 'inactive only'})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-[#F0E0D5] bg-white hover:bg-[#FFF1E8] text-[#292929] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold px-2 text-[#292929]">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={customers.length < limit}
              className="p-1.5 rounded border border-[#F0E0D5] bg-white hover:bg-[#FFF1E8] text-[#292929] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDIT CUSTOMER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditOpen && !!selectedCustomer}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Customer: ${selectedCustomer?.businessName || ''}`}
      >
        {selectedCustomer && (
          <div className="space-y-4 text-xs">
            {/* Action Notice Alert */}
            {actionNotice ? (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${actionNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
              >
                <span>{actionNotice.message}</span>
              </div>
            ) : null}

            {/* Entity Summary Header */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block font-medium">Business / Customer</span>
                <span className="font-bold text-slate-800 text-sm">{selectedCustomer.businessName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Contact Person</span>
                <span className="font-semibold text-slate-800">{selectedCustomer.contactPerson}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mobile Phone</span>
                <span className="font-semibold text-slate-800">{selectedCustomer.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">GSTIN</span>
                <span className="font-mono font-semibold text-slate-800">{selectedCustomer.gstin || 'Unregistered'}</span>
              </div>
            </div>

            {/* Pricing Group & Discount Group Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Pricing Group
                </label>
                <CustomSelect
                  value={editPricingGroupId}
                  onChange={(val) => setEditPricingGroupId(val)}
                  options={[
                    { value: '', label: `Default (${editCustomerType} base pricing)` },
                    ...pricingGroups.map((pg: any) => ({
                      value: pg.id || pg._id,
                      label: `${pg.name} ${pg.isDefault ? '(Default Group)' : ''}`,
                    })),
                  ]}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Precedence: Customer Override &gt; Pricing Group &gt; Customer-Type Default</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Discount Group
                </label>
                <CustomSelect
                  value={editDiscountGroupId}
                  onChange={(val) => setEditDiscountGroupId(val)}
                  options={[
                    { value: '', label: `Default (${editCustomerType} standard eligibility)` },
                    ...discountGroups.map((dg: any) => ({
                      value: dg.id || dg._id,
                      label: `${dg.name} ${dg.defaultDiscountPercent ? `(${dg.defaultDiscountPercent}% Base)` : ''}`,
                    })),
                  ]}
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Controls coupon and promotional offer access</p>
              </div>
            </div>

            {/* Credit Limit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Approved Credit Limit (₹ INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={editCreditLimitRupees}
                  onChange={(e) => setEditCreditLimitRupees(e.target.value)}
                  placeholder="200000"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Formatted credit limit: {formatPaiseToINR(inrToPaise(parseFloat(editCreditLimitRupees) || 0))}
              </p>
            </div>

            {/* Payment Terms & Credit Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Payment Terms (Days)
                </label>
                <input
                  type="number"
                  value={editPaymentTermsDays}
                  onChange={(e) => setEditPaymentTermsDays(e.target.value)}
                  placeholder="30"
                  className="w-full px-3 py-1.5 text-sm border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Credit Account Status
                </label>
                <CustomSelect
                  value={editCreditStatus}
                  onChange={(val) => setEditCreditStatus(val as CreditStatus)}
                  options={[
                    { value: CreditStatus.NORMAL, label: 'Normal (Active)' },
                    { value: CreditStatus.ON_HOLD, label: 'On Hold' },
                    { value: CreditStatus.RESTRICTED, label: 'Restricted' },
                  ]}
                />
              </div>
            </div>

            {/* Access Status Switch in Modal */}
            <div className="border border-[#F0E0D5] rounded-lg p-3 bg-[#FFF8F3]/50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">Account Ordering Access</span>
                <span className="text-[11px] text-slate-500">
                  {editIsActive ? 'Account is enabled and permitted to order' : 'Account is disabled / suspended from ordering'}
                </span>
              </div>
              <div className="flex items-center">
                <button
                  type="button"
                  role="switch"
                  aria-checked={editIsActive}
                  onClick={() => setEditIsActive((prev) => !prev)}
                  className={`relative inline-block h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${editIsActive
                    ? 'bg-emerald-600 focus:ring-emerald-500'
                    : 'bg-slate-300 focus:ring-slate-400'
                    }`}
                  title={editIsActive ? 'Account is Enabled (Click to Disable)' : 'Account is Disabled (Click to Enable)'}
                >
                  <span className="sr-only">Toggle access</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute top-0.5 left-0.5 inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${editIsActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  >
                    {editIsActive ? (
                      <Check className="h-3 w-3 text-emerald-600 stroke-[3]" />
                    ) : (
                      <X className="h-3 w-3 text-slate-400 stroke-[3]" />
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-lg font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg font-bold shadow-xs text-xs transition-colors"
              >
                {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 1: CUSTOMER DETAILS VIEW & MANAGEMENT DRAWER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailsOpen && !!selectedCustomer}
        onClose={() => setIsDetailsOpen(false)}
        title={`Customer Account: ${selectedCustomer?.businessName || ''}`}
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Action Notice Alert */}
            {actionNotice ? (
              <div
                className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${actionNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : actionNotice.type === 'warning'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
              >
                <span>{actionNotice.message}</span>
              </div>
            ) : null}

            {/* Details Modal Tabs */}
            <div className="flex border-b border-[#F0E0D5] gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDetailsTab('info')}
                className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${detailsTab === 'info'
                  ? 'border-[#F47732] text-[#F47732]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <Building2 className="h-4 w-4" />
                Customer Overview
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab('orders')}
                className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${detailsTab === 'orders'
                  ? 'border-[#F47732] text-[#F47732]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                <ShoppingBag className="h-4 w-4" />
                Order History {customerOrders.length > 0 ? `(${customerOrders.length})` : ''}
              </button>
            </div>

            {detailsTab === 'info' ? (
              <>
                {/* Quick Status Bar */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Customer Type</span>
                    <span className="font-bold text-slate-800 capitalize">
                      {selectedCustomer.customerType || 'Retailer'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Approval Status</span>
                    <span className="font-bold capitalize text-slate-800">
                      {selectedCustomer.accountStatus || 'Pending'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Access Status</span>
                    <span
                      className={`font-bold ${(selectedCustomer.isActive ?? true) ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                    >
                      {(selectedCustomer.isActive ?? true) ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Registered</span>
                    <span className="font-bold text-slate-800">
                      {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Commercial Entity Details */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    Commercial Entity Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Contact Person:</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.contactPerson}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mobile Phone:</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Email Address:</span>
                      <span className="font-semibold text-slate-800">{selectedCustomer.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">GSTIN:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedCustomer.gstin || 'Unregistered'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">PAN:</span>
                      <span className="font-mono font-semibold text-slate-800">{selectedCustomer.pan || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Approved Credit Limit:</span>
                      <span className="font-semibold text-emerald-700">
                        {formatPaiseToINR(selectedCustomer.creditLimitPaise || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Payment Terms:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedCustomer.paymentTermsDays || 30} Days
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Assigned Pricing Group:</span>
                      <span className="font-semibold text-[#F47732]">
                        {selectedCustomer.pricingGroupId?.name || selectedCustomer.pricingGroupName || 'Default Group'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Assigned Discount Group:</span>
                      <span className="font-semibold text-emerald-700">
                        {selectedCustomer.discountGroupId?.name || selectedCustomer.discountGroupName || 'Default Group'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Credit Status:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {selectedCustomer.creditStatus || 'Normal'}
                      </span>
                    </div>
                  </div>

                  {selectedCustomer.billingAddress && (
                    <div className="pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 block mb-1">Billing & Registered Address:</span>
                      <p className="text-slate-700 leading-relaxed font-medium">
                        {selectedCustomer.billingAddress.street}, {selectedCustomer.billingAddress.city},{' '}
                        {selectedCustomer.billingAddress.state} - {selectedCustomer.billingAddress.pincode}
                      </p>
                    </div>
                  )}
                </div>

                {/* Rejection Reason (if any) */}
                {selectedCustomer.rejectionReason && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800">
                    <span className="font-bold block mb-0.5">Application Rejection Reason:</span>
                    <p>{selectedCustomer.rejectionReason}</p>
                  </div>
                )}
              </>
            ) : (
              /* Order History Tab */
              <div className="space-y-3">
                {loadingOrders ? (
                  <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-[#F47732]" />
                    Loading customer order history...
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg p-6">
                    <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No orders placed yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">This customer has not recorded any wholesale orders.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#F0E0D5] rounded-lg">
                    <table className="w-full text-center text-xs">
                      <thead className="bg-[#FFF8F3] text-[#292929] border-b border-[#F0E0D5] font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3 text-center">Order Number</th>
                          <th className="py-2.5 px-3 text-center">Items</th>
                          <th className="py-2.5 px-3 text-center">Total (₹)</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerOrders.map((ord: any) => (
                          <tr key={ord.id || ord._id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-center">
                              {ord.orderNumber}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-center">
                              {ord.items?.length || 0} line items
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                              {formatPaiseToINR(ord.grandTotalPaise || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {ord.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                              {new Date(ord.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: APPROVE CUSTOMER WORKFLOW */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isApproveOpen && !!selectedCustomer}
        onClose={() => setIsApproveOpen(false)}
        title={`Approve Wholesale Account: ${selectedCustomer?.businessName || ''}`}
      >
        <div className="space-y-4 text-xs">
          {actionNotice ? (
            <div
              className={`p-3 rounded-lg text-xs font-semibold ${actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : actionNotice.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
            >
              {actionNotice.message}
            </div>
          ) : null}

          <p className="text-slate-600 text-sm">
            Approving will activate this customer account, set commercial credit terms, and trigger an automated B2B
            approval notification email.
          </p>

          {/* Pricing Group & Discount Group Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assigned Pricing Group
              </label>
              <CustomSelect
                value={approvalPricingGroupId}
                onChange={(val) => setApprovalPricingGroupId(val)}
                options={[
                  { value: '', label: `Default (${approvalCustomerType} base pricing)` },
                  ...pricingGroups.map((pg: any) => ({
                    value: pg.id || pg._id,
                    label: `${pg.name} ${pg.isDefault ? '(Default Group)' : ''}`,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Assigned Discount Group
              </label>
              <CustomSelect
                value={approvalDiscountGroupId}
                onChange={(val) => setApprovalDiscountGroupId(val)}
                options={[
                  { value: '', label: `Default (${approvalCustomerType} standard discounts)` },
                  ...discountGroups.map((dg: any) => ({
                    value: dg.id || dg._id,
                    label: `${dg.name} ${dg.defaultDiscountPercent ? `(${dg.defaultDiscountPercent}% Base)` : ''}`,
                  })),
                ]}
              />
            </div>
          </div>

          {/* Credit Limit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Credit Limit (₹ INR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
              <input
                type="number"
                value={creditLimitRupees}
                onChange={(e) => setCreditLimitRupees(e.target.value)}
                placeholder="200000"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {formatPaiseToINR(inrToPaise(parseFloat(creditLimitRupees) || 0))} credit line granted upon approval.
            </p>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Terms (Days)
            </label>
            <input
              type="number"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              placeholder="30"
              className="w-full px-3 py-1.5 text-sm border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
            />
          </div>

          <div className="pt-3 border-t border-[#F0E0D5] flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsApproveOpen(false)}
              className="px-4 py-2 border border-[#F0E0D5] text-[#292929] hover:bg-[#FFF8F3] rounded-lg font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleApproveSubmit}
              className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg font-bold shadow-xs text-xs flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? 'Approving & Sending Email...' : 'Confirm Approval & Send Notification'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: REJECT APPLICATION */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRejectOpen && !!selectedCustomer}
        onClose={() => setIsRejectOpen(false)}
        title={`Reject Application: ${selectedCustomer?.businessName || ''}`}
      >
        <div className="space-y-4 text-xs">
          {actionNotice ? (
            <div
              className={`p-3 rounded-lg text-xs font-semibold ${actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
            >
              {actionNotice.message}
            </div>
          ) : null}

          <p className="text-slate-600">
            Rejecting this application will prevent the customer from accessing wholesale pricing and ordering. An
            informative notification will be emailed to them if configured.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Rejection Reason (Optional / Sent to Customer)
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Invalid GSTIN registration certificate provided or outside distribution territory."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsRejectOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleRejectSubmit}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm text-xs"
            >
              {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRM REASON TO DISABLE CUSTOMER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isStatusConfirmOpen && !!selectedCustomer}
        onClose={() => {
          setIsStatusConfirmOpen(false);
          setStatusChangeReason('');
          setActionNotice(null);
        }}
        title={`Disable Customer: ${selectedCustomer?.businessName || ''}`}
      >
        <div className="space-y-4 text-xs">
          {actionNotice ? (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
            >
              <span>{actionNotice.message}</span>
            </div>
          ) : null}

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm mb-1">
                Are you sure you want to disable "{selectedCustomer?.businessName}"?
              </span>
              <p className="text-xs leading-relaxed text-amber-700">
                Disabling will immediately revoke all active mobile & web sessions. The customer will be blocked from logging in, viewing wholesale prices, or placing orders.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Disabling Customer
            </label>
            <textarea
              rows={3}
              value={statusChangeReason}
              onChange={(e) => setStatusChangeReason(e.target.value)}
              placeholder="Enter reason for disabling (e.g. Overdue payment balance, account audit, or customer requested suspension)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsStatusConfirmOpen(false);
                setStatusChangeReason('');
                setActionNotice(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmDisable}
              className="px-4 py-2 rounded-lg font-bold shadow-sm text-xs text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Disabling Customer...</span>
                </>
              ) : (
                'Yes, Disable Customer'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIRM ARCHIVE / DELETE CUSTOMER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteOpen && !!selectedCustomer}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteReason('');
          setActionNotice(null);
        }}
        title={`Archive / Delete Customer: ${selectedCustomer?.businessName || ''}`}
      >
        <div className="space-y-4 text-xs">
          {actionNotice ? (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
            >
              <span>{actionNotice.message}</span>
            </div>
          ) : null}

          <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-lg text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm mb-1">
                Archive or Delete "{selectedCustomer?.businessName}"?
              </span>
              <p className="text-xs leading-relaxed text-rose-700">
                To protect audit and tax compliance, accounts with existing orders or financial history will be <strong>safely archived</strong> (all sessions revoked, logins suspended, historical invoices preserved). Accounts with no prior activity will be permanently removed.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Archival / Deletion
            </label>
            <textarea
              rows={3}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Enter audit reason for deleting or archiving this customer..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteReason('');
                setActionNotice(null);
              }}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-lg font-bold shadow-sm text-xs text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                'Confirm Archive / Delete'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
