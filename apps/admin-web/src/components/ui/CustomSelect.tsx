import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
}

export interface CustomSelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  itemClassName?: string;
  icon?: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options: directOptions,
  children,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  itemClassName = '',
  icon,
  title,
  size = 'md',
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  // Parse direct options or children (<option value="...">...</option>)
  const parsedOptions: SelectOption[] = React.useMemo(() => {
    if (directOptions && directOptions.length > 0) {
      return directOptions;
    }
    if (children) {
      const extracted: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          extracted.push({
            value: child.props.value ?? '',
            label: child.props.children ? String(child.props.children) : String(child.props.value ?? ''),
            disabled: Boolean(child.props.disabled),
          });
        }
      });
      return extracted;
    }
    return [];
  }, [directOptions, children]);

  // Support both controlled and uncontrolled usage
  const [internalValue, setInternalValue] = useState<string | number>(
    controlledValue !== undefined
      ? controlledValue
      : defaultValue !== undefined
        ? defaultValue
        : parsedOptions[0]?.value ?? ''
  );

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDownOutside);
      document.addEventListener('touchstart', handlePointerDownOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isOpen]);

  // Keyboard navigation (Escape to close, Arrow keys, Enter/Space)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = parsedOptions.findIndex((opt) => String(opt.value) === String(currentValue));
        const nextIndex = currentIndex < parsedOptions.length - 1 ? currentIndex + 1 : 0;
        const nextOption = parsedOptions[nextIndex];
        if (nextOption && !nextOption.disabled) {
          handleSelect(String(nextOption.value));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = parsedOptions.findIndex((opt) => String(opt.value) === String(currentValue));
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : parsedOptions.length - 1;
        const prevOption = parsedOptions[prevIndex];
        if (prevOption && !prevOption.disabled) {
          handleSelect(String(prevOption.value));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, parsedOptions, currentValue]);

  const handleSelect = useCallback(
    (val: string) => {
      if (disabled) return;
      if (controlledValue === undefined) {
        setInternalValue(val);
      }
      onChange?.(val);
      setIsOpen(false);
    },
    [disabled, controlledValue, onChange]
  );

  const selectedOption = parsedOptions.find((opt) => String(opt.value) === String(currentValue));

  // Size styling tokens
  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-xs rounded-lg',
    md: 'py-2 px-3 text-xs sm:text-sm rounded-xl',
    lg: 'py-2.5 px-3.5 text-sm rounded-xl',
  }[size];

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans ${isOpen ? 'z-50' : 'z-10'} ${className}`}
      title={title}
    >
      {/* Hidden input for standard form submission / form validation */}
      {name && <input type="hidden" name={name} value={String(currentValue)} />}

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${selectId}-listbox`}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`flex w-full items-center justify-between gap-2 border bg-white font-medium text-[#374151] transition-all duration-150 focus:outline-none ${sizeClasses} ${
          disabled
            ? 'cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200 opacity-70'
            : isOpen
              ? 'border-[#F47732] ring-2 ring-[#F47732]/20 shadow-xs'
              : 'border-[#E5E7EB] hover:border-[#F47732] shadow-xs'
        } ${buttonClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-[#737373]">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="text-slate-400">{placeholder}</span>}
          </span>
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-[#F47732] transition-transform duration-200 ease-out ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div
          id={`${selectId}-listbox`}
          role="listbox"
          ref={listboxRef}
          aria-labelledby={selectId}
          className={`animate-dropdown-in absolute left-0 right-0 z-[100] mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-xl shadow-black/[0.08] focus:outline-none ${menuClassName}`}
          style={{
            minWidth: '100%',
          }}
        >
          {parsedOptions.length === 0 ? (
            <div className="py-2.5 px-3 text-center text-xs text-[#737373] italic">
              No options available
            </div>
          ) : (
            parsedOptions.map((option) => {
              const isSelected = String(option.value) === String(currentValue);

              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => handleSelect(String(option.value))}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-xs sm:text-sm font-medium transition-colors duration-150 ${
                    option.disabled
                      ? 'cursor-not-allowed opacity-40 text-slate-400'
                      : isSelected
                        ? 'bg-[#FFF7ED] font-semibold text-[#E95B2A]'
                        : 'text-[#374151] hover:bg-[#FFF7ED] hover:text-[#E95B2A]'
                  } ${itemClassName}`}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <span className="truncate">{option.label}</span>
                  </span>

                  {isSelected && (
                    <Check
                      size={15}
                      className="shrink-0 text-[#F47732] stroke-[2.5]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

