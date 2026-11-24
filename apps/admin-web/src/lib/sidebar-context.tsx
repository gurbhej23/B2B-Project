import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isMobile: boolean;
  isMobileOpen: boolean;
  isDesktopOpen: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  closeMobileOnly: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const DESKTOP_STORAGE_KEY = 'necessity_sidebar_desktop_open';

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [isDesktopOpen, setIsDesktopOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DESKTOP_STORAGE_KEY);
        if (saved !== null) {
          return saved === 'true';
        }
      } catch {
        // Fallback gracefully if localStorage is unavailable
      }
      return true; // Default expanded on desktop
    }
    return true;
  });

  // Track window resizing and breakpoint
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && isMobileOpen) {
        // If resized to desktop while mobile drawer was open, close mobile drawer
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileOpen]);

  // Persist desktop toggle preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_STORAGE_KEY, String(isDesktopOpen));
    } catch {
      // Ignore storage errors
    }
  }, [isDesktopOpen]);

  // Prevent background scrolling on mobile when drawer is open
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobile, isMobileOpen]);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobile && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isMobileOpen]);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsDesktopOpen((prev) => !prev);
    }
  }, [isMobile]);

  const openSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(true);
    } else {
      setIsDesktopOpen(true);
    }
  }, [isMobile]);

  const closeSidebar = useCallback(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    } else {
      setIsDesktopOpen(false);
    }
  }, [isMobile]);

  const closeMobileOnly = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const isOpen = isMobile ? isMobileOpen : isDesktopOpen;

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isMobile,
        isMobileOpen,
        isDesktopOpen,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        closeMobileOnly,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
