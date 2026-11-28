import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
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
  UserCheck,
  MapPin,
  ShieldCheck,
  FileText,
  CreditCard,
  Calendar,
  Sliders,
} from 'lucide-react';
import {
  AccountStatus,
  CustomerType,
  CreditStatus,
  UserRole,
  formatPaiseToINR,
  inrToPaise,
  extractErrorMessage,
} from '@necessity/shared';

export const CustomerManagementScreen: React.FC = () => {
  const { user } = useAuth();
  const isAdmin =
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.ADMIN ||
    (user?.role as any) === 'super_admin' ||
    (user?.role as any) === 'admin';

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
  const [approvalCreditLimit, setApprovalCreditLimit] = useState<string>('0');
  const [approvalPaymentTerms, setApprovalPaymentTerms] = useState<number>(15);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(
    null
  );

  // Edit modal form states (Customer details only)
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editTradeName, setEditTradeName] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editPan, setEditPan] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
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

  // Open Edit Modal (Customer details only)
  const openEdit = (cust: any) => {
    setSelectedCustomer(cust);
    setEditBusinessName(cust.businessName || '');
    setEditTradeName(cust.tradeName || '');
    setEditContactPerson(cust.contactPerson || '');
    setEditPhone(cust.phone || '');
    setEditEmail(cust.email || '');
    setEditGstin(cust.gstin || '');
    setEditPan(cust.pan || '');
    setEditStreet(cust.billingAddress?.street || '');
    setEditCity(cust.billingAddress?.city || '');
    setEditState(cust.billingAddress?.state || '');
    setEditPincode(cust.billingAddress?.pincode || '');
    setEditIsActive(cust.isActive ?? true);
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
  const openApprove = async (cust: any) => {
    setSelectedCustomer(cust);
    setApprovalCustomerType(mapCustomerType(cust.requestedCustomerType || cust.customerType));
    setApprovalPricingGroupId(cust.pricingGroupId?._id || cust.pricingGroupId || '');
    setApprovalDiscountGroupId(cust.discountGroupId?._id || cust.discountGroupId || '');
    setApprovalCreditLimit(cust.creditLimitPaise ? String(cust.creditLimitPaise / 100) : '0');
    setApprovalPaymentTerms(cust.paymentTermsDays !== undefined ? cust.paymentTermsDays : 15);
    setIsApproveOpen(true);
    setActionNotice(null);

    // Fetch full single customer record in background to ensure all nested address/business details are loaded
    const targetId = cust.id || cust._id || cust.retailerId;
    if (targetId) {
      try {
        const res = await api.get(`/customers/${targetId}`);
        if (res.data?.data) {
          const freshData = res.data.data;
          setSelectedCustomer((prev: any) => ({ ...prev, ...freshData }));
          if (freshData.creditLimitPaise !== undefined) {
            setApprovalCreditLimit(String(freshData.creditLimitPaise / 100));
          }
          if (freshData.paymentTermsDays !== undefined) {
            setApprovalPaymentTerms(freshData.paymentTermsDays);
          }
        }
      } catch (e) {
        // Fallback to table data
      }
    }
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

    const limitRupees = parseFloat(approvalCreditLimit) || 0;
    const creditLimitPaise = Math.max(0, Math.round(limitRupees * 100));

    try {
      const res = await api.patch(`/customers/${selectedCustomer.id || selectedCustomer._id || selectedCustomer.retailerId}/approve`, {
        customerType: approvalCustomerType,
        pricingGroupId: approvalPricingGroupId || undefined,
        discountGroupId: approvalDiscountGroupId || undefined,
        creditLimitPaise,
        paymentTermsDays: approvalPaymentTerms || 15,
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

  // Save Customer Edits (Customer Profile Details)
  const handleSaveEdit = async () => {
    if (!selectedCustomer) return;
    if (!isAdmin) {
      setActionNotice({ type: 'error', message: 'Only administrators are authorized to update customer details.' });
      return;
    }
    if (!editBusinessName.trim()) {
      setActionNotice({ type: 'error', message: 'Business name is required' });
      return;
    }
    if (!editContactPerson.trim()) {
      setActionNotice({ type: 'error', message: 'Contact person name is required' });
      return;
    }
    if (!editPhone.trim() || editPhone.trim().length < 10) {
      setActionNotice({ type: 'error', message: 'Valid 10-digit mobile phone number is required' });
      return;
    }

    setIsSubmitting(true);
    setActionNotice(null);

    const targetId = String(selectedCustomer.id || selectedCustomer._id);
    try {
      const payload: any = {
        businessName: editBusinessName.trim(),
        tradeName: editTradeName.trim() || undefined,
        contactPerson: editContactPerson.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        gstin: editGstin.trim().toUpperCase() || undefined,
        pan: editPan.trim().toUpperCase() || undefined,
        isActive: editIsActive,
      };

      if (editStreet.trim() || editCity.trim() || editState.trim() || editPincode.trim()) {
        payload.billingAddress = {
          street: editStreet.trim(),
          city: editCity.trim(),
          state: editState.trim() || 'Maharashtra',
          pincode: editPincode.trim(),
          stateCode: selectedCustomer.billingAddress?.stateCode || '27',
        };
      }

      const res = await api.patch(`/customers/${targetId}`, payload);
      const updatedData = res.data?.data || payload;

      // Update in local state
      setCustomers((prev) =>
        prev.map((c) => {
          const cId = String(c.id || c._id);
          if (cId === targetId) {
            return {
              ...c,
              ...updatedData,
              businessName: editBusinessName.trim(),
              tradeName: editTradeName.trim() || undefined,
              contactPerson: editContactPerson.trim(),
              phone: editPhone.trim(),
              email: editEmail.trim() || undefined,
              gstin: editGstin.trim().toUpperCase() || undefined,
              pan: editPan.trim().toUpperCase() || undefined,
              isActive: editIsActive,
              billingAddress: payload.billingAddress || c.billingAddress,
            };
          }
          return c;
        })
      );

      setSelectedCustomer((prev: any) =>
        prev
          ? {
            ...prev,
            ...updatedData,
            businessName: editBusinessName.trim(),
            tradeName: editTradeName.trim() || undefined,
            contactPerson: editContactPerson.trim(),
            phone: editPhone.trim(),
            email: editEmail.trim() || undefined,
            gstin: editGstin.trim().toUpperCase() || undefined,
            pan: editPan.trim().toUpperCase() || undefined,
            isActive: editIsActive,
            billingAddress: payload.billingAddress || prev.billingAddress,
          }
          : prev
      );

      setActionNotice({
        type: 'success',
        message: `Customer "${editBusinessName.trim()}" details updated successfully.`,
      });

      setTimeout(() => {
        setIsEditOpen(false);
        fetchCustomers();
      }, 1200);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: extractErrorMessage(err) || 'Failed to update customer details',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title (Desktop only, mobile shows in Navbar) */}
      <div className="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div>
          <h1 className="text-2xl font-bold text-[#292929] tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-[#F47732]" />
            Customer Management
          </h1>
          <p className="text-xs sm:text-sm text-[#737373] mt-1">
            Manage customer profiles, approvals, and account activities from one place.
          </p>
        </div>
        {/* Refresh Button (Desktop) */}
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

        <div className="flex items-center gap-2.5">
          {/* Active/Inactive Status Filter */}
          <div className="w-40 flex-1 sm:flex-none">
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

          {/* Refresh Button (Mobile) */}
          <button
            type="button"
            onClick={() => fetchCustomers(debouncedSearch, statusFilter, page)}
            disabled={isLoading}
            className="lg:hidden inline-flex items-center justify-center p-2 text-xs font-semibold text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#F47732] disabled:opacity-50 flex-shrink-0"
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

                          {isAdmin && (
                            <button
                              onClick={() => openEdit(cust)}
                              className="inline-flex items-center gap-1 text-[#292929] hover:text-[#F47732] bg-white hover:bg-[#FFF8F3] border border-[#F0E0D5] hover:border-[#F47732] text-xs font-semibold px-2.5 py-1 rounded shadow-xs transition-all"
                              title={`Edit ${cust.businessName}`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}

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

            {!isAdmin ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <span>Only administrators have permission to modify customer profile details.</span>
              </div>
            ) : (
              <>
                {/* Business Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#292929] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#F0E0D5] pb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#F47732]" />
                    Customer & Business Information
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Business / Store Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editBusinessName}
                        onChange={(e) => setEditBusinessName(e.target.value)}
                        placeholder="e.g. Acme Wholesale"
                        required
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Trade / Display Name
                      </label>
                      <input
                        type="text"
                        value={editTradeName}
                        onChange={(e) => setEditTradeName(e.target.value)}
                        placeholder="e.g. Acme Traders"
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact Person Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editContactPerson}
                        onChange={(e) => setEditContactPerson(e.target.value)}
                        placeholder="e.g. Rajesh Kumar"
                        required
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mobile Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        required
                        maxLength={10}
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="e.g. contact@business.com"
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        GSTIN
                      </label>
                      <input
                        type="text"
                        value={editGstin}
                        onChange={(e) => setEditGstin(e.target.value.toUpperCase())}
                        placeholder="15-character GSTIN"
                        maxLength={15}
                        className="w-full px-3 py-1.5 text-xs font-mono uppercase border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        PAN
                      </label>
                      <input
                        type="text"
                        value={editPan}
                        onChange={(e) => setEditPan(e.target.value.toUpperCase())}
                        placeholder="10-character PAN"
                        maxLength={10}
                        className="w-full px-3 py-1.5 text-xs font-mono uppercase border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Address */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-[#292929] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#F0E0D5] pb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#F47732]" />
                    Billing & Registered Address
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Street Address
                      </label>
                      <input
                        type="text"
                        value={editStreet}
                        onChange={(e) => setEditStreet(e.target.value)}
                        placeholder="Shop/Office No, Street, Landmark"
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                        placeholder="State"
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        PIN Code
                      </label>
                      <input
                        type="text"
                        value={editPincode}
                        onChange={(e) => setEditPincode(e.target.value)}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        className="w-full px-3 py-1.5 text-xs border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                      />
                    </div>
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
              </>
            )}

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
                disabled={isSubmitting || !isAdmin}
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-[#F47732] hover:bg-[#E95B2A] text-white rounded-lg font-bold shadow-xs text-xs transition-colors disabled:opacity-50"
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
        title={`Review & Approve Customer: ${selectedCustomer?.businessName || ''}`}
        maxWidthClass="max-w-4xl"
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

          {/* Subtitle / Context Banner */}
          <div className="bg-[#FFF8F3] border border-[#F0E0D5] p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <p className="text-slate-800 font-semibold text-xs">
                Wholesale Customer Onboarding Application Review
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Review all submitted registration credentials before activating wholesale catalog access and trade pricing.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">Ref:</span>
              <span className="font-mono text-[11px] font-bold text-[#F47732] bg-white px-2 py-0.5 rounded border border-[#F0E0D5]">
                {selectedCustomer?.retailerId || selectedCustomer?.id || selectedCustomer?._id || 'N/A'}
              </span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* COMPLETE READ-ONLY CUSTOMER REGISTRATION DETAILS (STEPS 1 TO 4) */}
          {/* =================================================================== */}
          <div className="border border-[#F0E0D5] rounded-xl overflow-hidden bg-white shadow-xs divide-y divide-[#F0E0D5]">
            {/* STEP 1: ACCOUNT DETAILS */}
            <div className="p-3.5 sm:p-4 bg-white">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
                <UserCheck className="h-4 w-4 text-[#F47732]" />
                <span>Step 1 – Account & Primary Contact</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Full Name (Authorized Person)</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                    {selectedCustomer?.contactPerson || selectedCustomer?.name || 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Business Email Address</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block break-all">
                    {selectedCustomer?.email || selectedCustomer?.userId?.email || 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Mobile Number</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                    +91 {selectedCustomer?.phone || selectedCustomer?.userId?.phone || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Password credentials securely hashed with bcrypt (never exposed or rendered).</span>
              </div>
            </div>

            {/* STEP 2: BUSINESS & TAX DETAILS */}
            <div className="p-3.5 sm:p-4 bg-white">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
                <Building2 className="h-4 w-4 text-[#F47732]" />
                <span>Step 2 – Business Verification & Tax Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Registered Business Name</span>
                  <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                    {selectedCustomer?.businessName || 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Trade / Operating Name</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                    {selectedCustomer?.tradeName || selectedCustomer?.businessName || 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Business / Entity Type</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                    {selectedCustomer?.businessType || 'Retailer'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">GSTIN Registration</span>
                  {selectedCustomer?.gstin ? (
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5 text-xs">
                      {selectedCustomer.gstin}
                    </span>
                  ) : (
                    <span className="font-medium text-slate-500 italic text-xs mt-0.5 block">
                      Unregistered / Non-GST Entity
                    </span>
                  )}
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Business / Proprietor PAN</span>
                  {selectedCustomer?.pan ? (
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block mt-0.5 text-xs">
                      {selectedCustomer.pan}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs mt-0.5 block">Not Provided</span>
                  )}
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Requested Customer Tier</span>
                  <span className="font-bold text-[#F47732] capitalize text-xs mt-0.5 block">
                    {selectedCustomer?.requestedCustomerType || selectedCustomer?.customerType || 'Retailer'}
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 3: REGISTERED PREMISES & DELIVERY ADDRESSES */}
            <div className="p-3.5 sm:p-4 bg-white">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
                <MapPin className="h-4 w-4 text-[#F47732]" />
                <span>Step 3 – Registered Premises & Delivery Addresses</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Billing & Registered Trade Office:
                  </span>
                  {selectedCustomer?.billingAddress ? (
                    <p className="text-slate-800 text-xs leading-relaxed">
                      <span className="font-medium block">{selectedCustomer.billingAddress.street}</span>
                      <span>
                        {selectedCustomer.billingAddress.city}, {selectedCustomer.billingAddress.state} -{' '}
                        {selectedCustomer.billingAddress.pincode}
                      </span>
                      <span className="block text-slate-500 text-[11px] mt-0.5">
                        State Code: {selectedCustomer.billingAddress.stateCode || '27'} (India)
                      </span>
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs italic">No billing address recorded.</p>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Delivery / Warehouse Destination:
                  </span>
                  {Array.isArray(selectedCustomer?.deliveryAddresses) && selectedCustomer.deliveryAddresses.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedCustomer.deliveryAddresses.map((addr: any, idx: number) => (
                        <p key={idx} className="text-slate-800 text-xs leading-relaxed">
                          <span className="font-medium block">{addr.street}</span>
                          <span>
                            {addr.city}, {addr.state} - {addr.pincode}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs leading-relaxed">
                      <span>(Same as Registered Billing Address above)</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* STEP 4: ONBOARDING REVIEW & COMPLIANCE SUMMARY */}
            <div className="p-3.5 sm:p-4 bg-white">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs uppercase tracking-wider mb-2.5">
                <ShieldCheck className="h-4 w-4 text-[#F47732]" />
                <span>Step 4 – Review, Compliance & Submission Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Application Date</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                    {selectedCustomer?.createdAt ? new Date(selectedCustomer.createdAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Terms & Wholesale Policy</span>
                  <span className="font-bold text-emerald-700 text-xs mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Accepted on Submission
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px] font-medium">Current Account Status</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mt-0.5 text-xs capitalize">
                    {selectedCustomer?.accountStatus || 'Pending Approval'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================== */}
          {/* APPROVAL & TIER / PRICING / CREDIT ASSIGNMENT SECTION */}
          {/* =================================================================== */}
          <div className="bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-1.5 border-b border-[#F0E0D5] pb-2">
              <Sliders className="h-4 w-4 text-[#F47732]" />
              <h4 className="text-xs font-bold text-[#292929] uppercase tracking-wider">
                Wholesale Account Configuration & Tier Assignment
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Customer Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Type <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  value={approvalCustomerType}
                  onChange={(val) => setApprovalCustomerType(val as CustomerType)}
                  options={[
                    { value: CustomerType.RETAILER, label: 'Retailer (Store / Shop)' },
                    { value: CustomerType.WHOLESALER, label: 'Wholesaler (Bulk Buyer)' },
                    { value: CustomerType.DISTRIBUTOR, label: 'Distributor (Regional)' },
                  ]}
                />
              </div>

              {/* 2. Assigned Pricing Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pricing Group
                </label>
                <CustomSelect
                  value={approvalPricingGroupId}
                  onChange={(val) => setApprovalPricingGroupId(val)}
                  options={[
                    { value: '', label: `Default (${approvalCustomerType} base pricing)` },
                    ...pricingGroups.map((pg: any) => ({
                      value: pg.id || pg._id,
                      label: `${pg.name} ${pg.isDefault ? '(Default)' : ''}`,
                    })),
                  ]}
                />
              </div>

              {/* 3. Assigned Discount Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Discount Group
                </label>
                <CustomSelect
                  value={approvalDiscountGroupId}
                  onChange={(val) => setApprovalDiscountGroupId(val)}
                  options={[
                    { value: '', label: `Default (${approvalCustomerType} discounts)` },
                    ...discountGroups.map((dg: any) => ({
                      value: dg.id || dg._id,
                      label: `${dg.name} ${dg.defaultDiscountPercent ? `(${dg.defaultDiscountPercent}%)` : ''}`,
                    })),
                  ]}
                />
              </div>

              {/* 4. Credit Limit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Credit Limit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={approvalCreditLimit}
                    onChange={(e) => setApprovalCreditLimit(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-1.5 text-xs font-bold border border-[#F0E0D5] rounded-lg focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] bg-white"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">0 = Prepaid / Advance orders only</span>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-3 border-t border-[#F0E0D5] flex items-center justify-between">
            <p className="text-[11px] text-slate-500 hidden sm:block">
              An automated approval notification email will be dispatched to{' '}
              <span className="font-semibold text-slate-700">{selectedCustomer?.email || 'the customer'}</span>.
            </p>
            <div className="flex items-center gap-2 ml-auto">
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
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Approving & Sending Email...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm Approval & Send Notification</span>
                  </>
                )}
              </button>
            </div>
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
