import React, { useState, useRef, useEffect, useId } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string; // YYYY-MM-DD
  defaultValue?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  label?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const padZero = (n: number) => String(n).padStart(2, '0');

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = 'Select date',
  label,
  minDate,
  maxDate,
  disabled = false,
  className = '',
  clearable = true,
  align = 'left',
  size = 'md',
}) => {
  const generatedId = useId();
  const pickerId = id || generatedId;

  const [internalValue, setInternalValue] = useState<string>(
    controlledValue !== undefined ? controlledValue : defaultValue || ''
  );

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse active viewing year and month
  const initialDate = currentValue ? new Date(currentValue) : new Date();
  const [viewYear, setViewYear] = useState<number>(
    isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth()
  );
  const [isMonthSelectOpen, setIsMonthSelectOpen] = useState(false);

  // Sync viewing month with value when opened
  useEffect(() => {
    if (isOpen) {
      if (currentValue) {
        const parts = currentValue.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m)) {
            setViewYear(y);
            setViewMonth(m);
          }
        }
      }
      setIsMonthSelectOpen(false);
    }
  }, [isOpen, currentValue]);

  // Handle outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectDate = (dateStr: string) => {
    if (disabled) return;
    if (controlledValue === undefined) {
      setInternalValue(dateStr);
    }
    onChange?.(dateStr);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (disabled) return;
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    onChange?.('');
  };

  const handleToday = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(
      today.getDate()
    )}`;
    handleSelectDate(todayStr);
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar generation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
  })();

  const calendarDays: Array<{
    dateStr: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isDisabled: boolean;
    isSelected: boolean;
    isToday: boolean;
  }> = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = `${prevYear}-${padZero(prevMonth + 1)}-${padZero(day)}`;
    const isDisabled =
      (Boolean(minDate) && dateStr < minDate!) || (Boolean(maxDate) && dateStr > maxDate!);
    calendarDays.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: false,
      isDisabled,
      isSelected: dateStr === currentValue,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${padZero(viewMonth + 1)}-${padZero(day)}`;
    const isDisabled =
      (Boolean(minDate) && dateStr < minDate!) || (Boolean(maxDate) && dateStr > maxDate!);
    calendarDays.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: true,
      isDisabled,
      isSelected: dateStr === currentValue,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days (to complete 35 or 42 slots)
  const remainingSlots = (7 - (calendarDays.length % 7)) % 7;
  const targetTotal = calendarDays.length + remainingSlots < 35 ? 35 : calendarDays.length + remainingSlots;
  const nextMonthCount = targetTotal - calendarDays.length;

  for (let day = 1; day <= nextMonthCount; day++) {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = `${nextYear}-${padZero(nextMonth + 1)}-${padZero(day)}`;
    const isDisabled =
      (Boolean(minDate) && dateStr < minDate!) || (Boolean(maxDate) && dateStr > maxDate!);
    calendarDays.push({
      dateStr,
      dayNum: day,
      isCurrentMonth: false,
      isDisabled,
      isSelected: dateStr === currentValue,
      isToday: dateStr === todayStr,
    });
  }

  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-xs rounded-lg',
    md: 'py-2 px-3 text-xs sm:text-sm rounded-xl',
  }[size];

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left font-sans ${isOpen ? 'z-50' : 'z-10'} ${className}`}
    >
      {name && <input type="hidden" name={name} value={currentValue} />}

      {/* Trigger Button */}
      <button
        id={pickerId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 border bg-white font-medium text-[#292929] transition-all duration-150 focus:outline-none ${sizeClasses} ${
          disabled
            ? 'cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200 opacity-70'
            : isOpen
              ? 'border-[#F47732] ring-2 ring-[#F47732]/20 shadow-xs'
              : 'border-[#F0E0D5] hover:border-[#F47732] shadow-xs'
        }`}
      >
        <CalendarIcon
          className={`h-4 w-4 shrink-0 transition-colors ${
            currentValue ? 'text-[#F47732]' : 'text-[#737373]'
          }`}
        />

        <span className="flex items-center gap-1.5 min-w-0">
          {label && <span className="text-[#737373] font-medium shrink-0">{label}:</span>}
          <span className="truncate">
            {currentValue ? (
              <span className="font-semibold text-[#292929]">
                {formatDisplayDate(currentValue)}
              </span>
            ) : (
              <span className="text-[#737373]">{placeholder}</span>
            )}
          </span>
        </span>

        {currentValue && clearable ? (
          <span
            onClick={handleClear}
            role="button"
            tabIndex={0}
            title="Clear date"
            className="ml-1 p-0.5 text-[#737373] hover:text-[#E95B2A] hover:bg-[#FFF1E8] rounded-full transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[#737373] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#F47732]' : ''
            }`}
          />
        )}
      </button>

      {/* Floating Professional Calendar Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 z-[100] w-[280px] rounded-2xl border border-[#F0E0D5] bg-white p-3.5 shadow-xl shadow-black/10 focus:outline-none animate-dropdown-in`}
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F0E0D5]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-[#737373] hover:text-[#F47732] hover:bg-[#FFF1E8] transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMonthSelectOpen((prev) => !prev)}
              className="text-xs sm:text-sm font-bold text-[#292929] hover:text-[#F47732] px-2 py-0.5 rounded-md hover:bg-[#FFF1E8] transition-colors flex items-center gap-1"
            >
              <span>{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <ChevronDown className="h-3 w-3 text-[#737373]" />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-[#737373] hover:text-[#F47732] hover:bg-[#FFF1E8] transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Month & Year Picker Overlay */}
          {isMonthSelectOpen ? (
            <div className="py-2 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase text-[#737373]">Select Month</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y - 1)}
                    className="p-0.5 text-xs text-[#737373] hover:text-[#F47732]"
                  >
                    «
                  </button>
                  <span className="text-xs font-bold text-[#292929]">{viewYear}</span>
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    className="p-0.5 text-xs text-[#737373] hover:text-[#F47732]"
                  >
                    »
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTH_NAMES.map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setViewMonth(idx);
                      setIsMonthSelectOpen(false);
                    }}
                    className={`py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      viewMonth === idx
                        ? 'bg-[#F47732] text-white font-bold'
                        : 'text-[#292929] hover:bg-[#FFF1E8] hover:text-[#F47732]'
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="text-[11px] font-semibold text-[#737373]">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarDays.map((cell, idx) => {
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={cell.isDisabled}
                      onClick={() => !cell.isDisabled && handleSelectDate(cell.dateStr)}
                      className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                        cell.isSelected
                          ? 'bg-[#F47732] text-white font-bold shadow-xs hover:bg-[#E95B2A]'
                          : cell.isDisabled
                            ? 'text-slate-300 cursor-not-allowed'
                            : !cell.isCurrentMonth
                              ? 'text-slate-400 hover:bg-slate-100'
                              : cell.isToday
                                ? 'text-[#F47732] font-bold border border-[#F47732] hover:bg-[#FFF1E8]'
                                : 'text-[#292929] hover:bg-[#FFF1E8] hover:text-[#F47732]'
                      }`}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Footer Actions */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#F0E0D5] text-xs">
                <button
                  type="button"
                  onClick={() => handleClear()}
                  className="font-semibold text-[#737373] hover:text-rose-600 px-2 py-1 rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="font-semibold text-[#F47732] hover:text-[#E95B2A] hover:bg-[#FFF1E8] px-2 py-1 rounded transition-colors"
                >
                  Today
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
