import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import LayoutStore from '../stores/LayoutStore';

const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [sidebarVisible, setSidebarVisible] = useState(
    LayoutStore.get('visible-sidebar')
  );
  const resizeSubscribersRef = useRef([]);
  const sidebarSubscribersRef = useRef([]);

  // Debounced resize handler
  useEffect(() => {
    let timeoutId;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const newSize = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        setWindowSize(newSize);

        // Notify all subscribers (snapshot to prevent mutation during iteration)
        const subscribers = resizeSubscribersRef.current.slice();
        subscribers.forEach(callback => callback(newSize));
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty deps - only run once

  // Sidebar visibility listener
  useEffect(() => {
    const handleSidebarChange = () => {
      const visible = LayoutStore.get('visible-sidebar');
      setSidebarVisible(visible);

      // Notify all subscribers (snapshot to prevent mutation during iteration)
      const subscribers = sidebarSubscribersRef.current.slice();
      subscribers.forEach(callback => callback(visible));
    };

    LayoutStore.on('sidebar-visibility-change', handleSidebarChange);
    return () => {
      LayoutStore.removeListener('sidebar-visibility-change', handleSidebarChange);
    };
  }, []); // Empty deps - only run once

  const subscribeToResize = useCallback((callback) => {
    resizeSubscribersRef.current.push(callback);
    return () => {
      resizeSubscribersRef.current = resizeSubscribersRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const subscribeToSidebar = useCallback((callback) => {
    sidebarSubscribersRef.current.push(callback);
    return () => {
      sidebarSubscribersRef.current = sidebarSubscribersRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const value = React.useMemo(() => ({
    windowSize,
    sidebarVisible,
    subscribeToResize,
    subscribeToSidebar,
  }), [windowSize, sidebarVisible, subscribeToResize, subscribeToSidebar]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
}

/**
 * Custom hook to subscribe to window resize events
 * @param {Function} callback - Function to call on window resize
 */
export function useWindowResize(callback) {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useWindowResize must be used within LayoutProvider');
  }

  const { subscribeToResize } = context;
  const callbackRef = useRef(callback);

  // Keep ref updated with latest callback
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    // Stable wrapper that always calls the latest callback
    const stableCallback = (size) => {
      if (callbackRef.current && typeof callbackRef.current === 'function') {
        callbackRef.current(size);
      }
    };
    return subscribeToResize(stableCallback);
  }, [subscribeToResize]);
}

/**
 * Custom hook to subscribe to sidebar visibility changes
 * @param {Function} callback - Function to call on sidebar visibility change
 */
export function useSidebarVisibility(callback) {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useSidebarVisibility must be used within LayoutProvider');
  }

  const { subscribeToSidebar } = context;
  const callbackRef = useRef(callback);

  // Keep ref updated with latest callback
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    // Stable wrapper that always calls the latest callback
    const stableCallback = (visible) => {
      if (callbackRef.current && typeof callbackRef.current === 'function') {
        callbackRef.current(visible);
      }
    };
    return subscribeToSidebar(stableCallback);
  }, [subscribeToSidebar]);
}

/**
 * Custom hook to get current layout state
 * @returns {Object} Current window size and sidebar visibility
 */
export function useLayoutState() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutState must be used within LayoutProvider');
  }
  return {
    windowSize: context.windowSize,
    sidebarVisible: context.sidebarVisible,
  };
}
