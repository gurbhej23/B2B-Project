import React, { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-xl',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center !m-0 touch-scroll">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-[#F0E0D5] w-full ${maxWidthClass} max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto`}
      >
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#F0E0D5] flex items-center justify-between bg-[#FFF8F3] flex-shrink-0">
          <h3 className="font-bold text-[#292929] text-base sm:text-lg truncate pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal dialog"
            className="text-[#737373] hover:text-[#F47732] rounded-lg p-1 hover:bg-[#FFF1E8] border border-transparent hover:border-[#F0E0D5] transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 bg-white overflow-y-auto touch-scroll flex-1">{children}</div>
      </div>
    </div>
  );
};
