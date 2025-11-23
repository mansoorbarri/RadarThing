import { useEffect, useRef, useCallback } from 'react';

interface UseViewerTrackerOptions {
  enabled?: boolean;
  heartbeatInterval?: number;
  apiEndpoint?: string;
}

export function useViewerTracker(options: UseViewerTrackerOptions = {}) {
  const {
    enabled = true,
    heartbeatInterval = 5000,
    apiEndpoint = '/api/atc/viewers',
  } = options;

  const viewerIdRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const registerViewer = useCallback(async () => {
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viewerId: viewerIdRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        viewerIdRef.current = data.viewerId;
        if (typeof window !== 'undefined') {
          localStorage.setItem('radarViewerId', data.viewerId);
        }
      }
    } catch (error) {
      console.warn('Failed to register as viewer:', error);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    viewerIdRef.current = localStorage.getItem('radarViewerId');
    registerViewer();

    intervalRef.current = setInterval(() => {
      if (!document.hidden) {
        registerViewer();
      }
    }, heartbeatInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, heartbeatInterval, registerViewer]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        registerViewer();
        intervalRef.current = setInterval(() => {
          if (!document.hidden) {
            registerViewer();
          }
        }, heartbeatInterval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, heartbeatInterval, registerViewer]);
}