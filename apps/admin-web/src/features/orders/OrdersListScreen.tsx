import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { OrderDetailScreen } from './OrderDetailScreen';
import { CustomSelect } from '../../components/ui';
import {
  OrderStatus,
  UserRole,
  formatPaiseToINR,
} from '@necessity/shared';
import {
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  Eye,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export const OrdersListScreen: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || '';

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(statusParam);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const statusOptions = [
    { label: 'All Orders', value: '' },
    { label: 'Pending', value: OrderStatus.SUBMITTED },
    { label: 'Confirmed', value: OrderStatus.APPROVED },
    { label: 'Processing', value: OrderStatus.PROCESSING },
    { label: 'Shipped', value: OrderStatus.DISPATCHED },
    { label: 'Delivered', value: OrderStatus.DELIVERED },
    { label: 'Cancelled', value: OrderStatus.CANCELLED },
  ];

  const selectedOption =
    statusOptions.find((opt) => opt.value === selectedStatus) ??
    statusOptions[0];

  useEffect(() => {
    setSelectedStatus(statusParam);
  }, [statusParam]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    if (newStatus) {
      setSearchParams({ status: newStatus });
    } else {
      setSearchParams({});
    }
  };

  const isStaff = user && [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.ACCOUNTS_MANAGER,
  ].includes(user.role);

  const { data: ordersData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['orders', search, selectedStatus],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (selectedStatus) params.status = selectedStatus;

      const res = await apiClient.get('/orders', { params });
      return res.data;
    },
  });

  const orders = ordersData?.data || [];

  // If user selected an order to view, render the dedicated OrderDetailScreen!
  if (selectedOrder) {
    return (
      <OrderDetailScreen
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
      />
    );
  }

  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DELIVERED:
      case 'completed' as any:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EDFDF5] text-[#16A34A] border border-[#BBF7D0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Delivered</span>
          </span>
        );

      case OrderStatus.DISPATCHED:
      case OrderStatus.PICKED_UP:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            <span>Shipped</span>
          </span>
        );

      case OrderStatus.PROCESSING:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Package className="w-3.5 h-3.5 text-purple-600" />
            <span>Processing</span>
          </span>
        );

      case OrderStatus.APPROVED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Confirmed</span>
          </span>
        );

      case OrderStatus.CANCELLED:
      case OrderStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Cancelled</span>
          </span>
        );

      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF8F3] text-[#F47732] border border-[#F0E0D5]">
            <Clock className="w-3.5 h-3.5 text-[#F47732]" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E0D5]">
        <div>
          <h1 className="text-2xl font-black text-[#292929] tracking-tight">
            {isStaff ? 'Enterprise Orders Management' : 'My Wholesale Orders'}
          </h1>

          <p className="text-xs text-[#737373] mt-0.5">
            {isStaff
              ? 'Review dealer orders, track shipments, and manage fulfillment.'
              : 'Track current order fulfillment, shipment statuses, and historical invoices.'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh Orders"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#F0E0D5] text-[#292929] hover:text-[#F47732] hover:border-[#F47732] rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#F47732] ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <span className="text-xs font-semibold px-3 py-1.5 bg-[#FFF8F3] border border-[#F0E0D5] text-[#292929] rounded-xl shadow-sm">
            Total Orders:{' '}
            <strong className="text-[#E95B2A]">{orders.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-[#F0E0D5] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order number or customer..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-[#F0E0D5] rounded-xl bg-white text-[#292929] focus:outline-none focus:border-[#F47732] focus:ring-1 focus:ring-[#F47732]"
            />
          </div>

          {/* Custom Status Dropdown */}
          <div className="relative w-full sm:w-60" ref={statusDropdownRef}>
            <button
              id="order-status-filter"
              type="button"
              onClick={() => setStatusDropdownOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={statusDropdownOpen}
              className={`flex w-full items-center justify-between gap-1 rounded-xl border bg-white px-3 py-2 text-[13px] font-semibold transition-all duration-200 ${statusDropdownOpen
                ? 'border-[#F47732] ring-4 ring-[#F47732]/10 shadow-sm'
                : 'border-[#F0E0D5] shadow-sm hover:border-[#F47732]'
                }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#404040]">
                  <Filter size={14} />
                </span>
                <span className="truncate text-[#404040]">{selectedOption.label}</span>
              </span>

              <ChevronDown
                size={16}
                className={`shrink-0 text-[#F47732] transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {statusDropdownOpen && (
              <div
                role="listbox"
                aria-label="Filter orders by status"
                className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-[#F0E0D5] bg-white p-1.5 shadow-xl shadow-[#6B3415]/10"
              >
                {statusOptions.map((opt) => {
                  const isSelected = selectedStatus === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        handleStatusChange(opt.value);
                        setStatusDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors duration-150 ${isSelected
                        ? 'bg-[#FFF1E7] font-semibold text-[#E96825]'
                        : 'text-[#525252] hover:bg-[#FFF8F3] hover:text-[#E96825]'
                        }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={14} className="shrink-0 text-[#F47732]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orders Table Container matching reference design */}
      <div className="bg-white/80 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-[#FFF8F3] backdrop-blur-sm border-b border-slate-200 text-slate-900 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-6 text-center w-[20%]">ORDER</th>
                <th className="py-3 px-6 text-center">CUSTOMER</th>
                <th className="py-3 px-6 text-center">ITEMS</th>
                <th className="py-3 px-6 text-center">TOTAL</th>
                <th className="py-3 px-6 text-center">DATE</th>
                <th className="py-3 px-6 text-center">STATUS</th>
                <th className="py-3 px-6 text-right"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-7 text-center text-slate-400">
                    Loading order records...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-7 text-center text-slate-400">
                    <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No orders found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedStatus
                        ? `No orders matching status '${selectedStatus}'.`
                        : 'No orders have been submitted yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => {
                  const retailer = order.retailerId || {};
                  const customerName =
                    retailer.contactPerson ||
                    order.placedByName ||
                    retailer.businessName ||
                    order.retailerName ||
                    'Rajesh Kumar';

                  const customerPhone =
                    retailer.phone ||
                    order.deliveryAddress?.phone ||
                    '+91 98765 43210';

                  const customerInitial = customerName.charAt(0).toUpperCase();

                  const orderDate = new Date(order.createdAt || Date.now());
                  const formattedTime = orderDate
                    .toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                    .toLowerCase();

                  const formattedDate = orderDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  const itemCount =
                    order.items?.reduce(
                      (acc: number, item: any) => acc + (item.quantity || 1),
                      0
                    ) || order.items?.length || 1;

                  const paymentMethodDisplay = order.paymentMethod
                    ? order.paymentMethod.replace('_', ' ').toUpperCase()
                    : 'UPI';

                  return (
                    <tr
                      key={order.id || order._id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* ORDER: Number + Time */}
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-sm">
                          {order.orderNumber}
                        </div>
                      </td>

                      {/* CUSTOMER: Circle initial + Name + Phone */}
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">
                              {customerName}
                            </div>
                            <div className="text-xs text-slate-400 font-normal mt-0.5">
                              {customerPhone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ITEMS */}
                      <td className="py-3 px-6 text-center text-slate-600 text-xs whitespace-nowrap">
                        {itemCount} items
                      </td>

                      {/* TOTAL: Amount + Method */}
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">
                          {formatPaiseToINR(order.grandTotalPaise)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal mt-0.5 uppercase">
                          {paymentMethodDisplay}
                        </div>
                      </td>

                      {/* DATE */}
                      <td className="py-3 px-6 text-center text-slate-600 text-xs whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {renderStatusBadge(order.status)}
                        </div>
                      </td>

                      {/* ACTION: View button */}
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#F47732] border border-[#F47732] rounded-md hover:bg-[#FFF8F3] transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#F47732]" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination matching other screens */}
        <div className="p-4 bg-[#FFF8F3] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">1</strong> to{' '}
            <strong className="text-slate-800">{orders.length}</strong> of{' '}
            <strong className="text-slate-800">{orders.length}</strong> orders
          </p>

          <div className="flex items-center space-x-1.5">
            <button
              disabled
              className="p-1 rounded-md border border-slate-200 bg-white text-slate-300 cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold px-2 py-1 text-slate-700 bg-white border border-slate-200 rounded-md">
              Page 1 of 1
            </span>
            <button
              disabled
              className="p-1 rounded-md border border-slate-200 bg-white text-slate-300 cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
