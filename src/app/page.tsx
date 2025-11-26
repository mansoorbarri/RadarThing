'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import dynamic from 'next/dynamic';
import { type PositionUpdate } from '~/lib/aircraft-store';
import { TbPlaneInflight, TbPlaneDeparture,TbPlane, TbPlaneArrival } from 'react-icons/tb';

interface Airport {
  name: string;
  lat: number;
  lon: number;
  icao: string;
}

type AirportMap = Record<string, Airport>;

const DynamicMapComponent = dynamic(() => import('~/components/map'), {
  ssr: false,
  loading: () => (
    <div style={{ textAlign: 'center', paddingTop: '50px' }}>
      Loading Map...
    </div>
  ),
});

const getFlightPhase = (
  altAGL: number,
  vspeed: number,
  flightPlan: string | undefined
) => {
  const isOnGround = altAGL < 100;
  const isClimbing = vspeed > 200;
  const isDescending = vspeed < -200;

  if (isOnGround) return 'onGround';
  if (isClimbing) return 'climbing';
  if (isDescending) {
    if (flightPlan && altAGL < 5000) {
      return 'landing';
    }
    return 'descending';
  }
  if (altAGL > 5000) return 'cruising';
  return 'unknown';
};

const Sidebar = React.memo(
  ({
    aircraft,
    onWaypointClick,
    isMobile,
  }: {
    aircraft: PositionUpdate & { altMSL?: number };
    onWaypointClick?: (waypoint: any, index: number) => void;
    isMobile: boolean;
  }) => {
    const [dragStart, setDragStart] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const altMSL = aircraft.altMSL ?? aircraft.alt;
    const altAGL = aircraft.alt;
    const isOnGround = altAGL < 100;

    const currentFlightPhase = useMemo(
      () =>
        getFlightPhase(
          altAGL,
          Number(aircraft.vspeed),
          aircraft.flightPlan
        ),
      [altAGL, aircraft.vspeed, aircraft.flightPlan]
    );

    const getPhaseIconComponent = (phase: string) => {
      const iconProps = { size: 24, strokeWidth: 1.5, color: '#fff' }; // Common props for icons
      switch (phase) {
        case 'onGround':
          return <TbPlane {...iconProps} />;
        case 'climbing':
          return <TbPlaneDeparture {...iconProps} />;
        case 'cruising':
          return <TbPlaneInflight {...iconProps} />;
        case 'descending':
          return <TbPlaneArrival {...iconProps} />; // Can reuse for landing/descending
        case 'landing':
          return <TbPlaneArrival {...iconProps} />;
        default:
          return <TbPlane {...iconProps} />;
      }
    };

    const getPhaseText = (phase: string) => {
      switch (phase) {
        case 'onGround':
          return 'Ground';
        case 'climbing':
          return 'Climbing';
        case 'cruising':
          return 'Cruising';
        case 'descending':
          return 'Descending';
        case 'landing':
          return 'Landing';
        default:
          return 'In Flight';
      }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      if (!isMobile || !e.touches[0]) return;
      setDragStart(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isMobile || dragStart === null || !e.touches[0]) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - dragStart;
      setDragOffset(diff);
    };

    const handleTouchEnd = () => {
      if (!isMobile || dragStart === null) return;

      if (dragOffset > 100) {
        setIsExpanded(false);
      } else if (dragOffset < -100) {
        setIsExpanded(true);
      }

      setDragStart(null);
      setDragOffset(0);
    };

    const renderFlightPlan = useCallback(() => {
      if (!aircraft.flightPlan)
        return (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
            }}
          >
            No flight plan available
          </div>
        );

      try {
        const waypoints = JSON.parse(aircraft.flightPlan);
        return (
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '0 16px 16px 16px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '12px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Flight Plan
            </div>
            {waypoints.map((wp: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: '12px 14px',
                  marginBottom: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                onClick={() => onWaypointClick?.(wp, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor =
                    'rgba(255, 255, 255, 0.08)';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#fff',
                    }}
                  >
                    {wp.ident}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {wp.type}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span>
                    Alt: <strong>{wp.alt ? wp.alt + ' ft' : 'N/A'}</strong>
                  </span>
                  <span>
                    Spd: <strong>{wp.spd ? wp.spd + ' kt' : 'N/A'}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      } catch (e) {
        return (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'rgba(239, 68, 68, 0.8)',
              fontSize: '14px',
            }}
          >
            Error loading flight plan
          </div>
        );
      }
    }, [aircraft.flightPlan, onWaypointClick]);

    const displayAltMSL =
      altMSL >= 18000
        ? `FL${Math.round(altMSL / 100)}`
        : `${altMSL.toFixed(0)} ft`;

    const sidebarStyle: React.CSSProperties = isMobile
      ? {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: isExpanded ? '90vh' : '200px',
          transform: `translateY(${dragOffset}px)`,
          backgroundColor: 'rgba(17, 24, 39, 0.98)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          color: '#fff',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px 16px 0 0',
          transition: dragStart !== null ? 'none' : 'height 0.3s ease',
          touchAction: 'none',
        }
      : {
          position: 'absolute',
          top: 0,
          right: 0,
          width: '380px',
          height: '100%',
          backgroundColor: 'rgba(17, 24, 39, 0.98)',
          backdropFilter: 'blur(12px)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
          color: '#fff',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        };

    return (
      <div ref={containerRef} style={sidebarStyle}>
        {isMobile && (
          <div
            style={{
              padding: '12px 0 8px 0',
              display: 'flex',
              justifyContent: 'center',
              cursor: 'grab',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '2px',
              }}
            />
          </div>
        )}

        <div
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
            padding: isMobile ? '12px 20px' : '20px 20px 16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: '700',
              marginBottom: '4px',
              letterSpacing: '-0.5px',
            }}
          >
            {aircraft.callsign || aircraft.flightNo || 'N/A'}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: '500',
              letterSpacing: '0.5px',
            }}
          >
            {aircraft.type || 'Unknown Type'}
          </div>
        </div>

        <div
          style={{
            padding: '16px 16px 0 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            overflowY: isMobile && !isExpanded ? 'hidden' : 'auto',
          }}
        >
          {/* Flight Number Block (remains at the top) */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600',
              }}
            >
              Flight Number
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>
              {aircraft.flightNo || 'N/A'}
            </div>
          </div>

          {/* New container for From - Icon - To */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            {/* From Airport */}
            <div
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'center',
              }}
            >
              {/* <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                From
              </div> */}
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {aircraft.departure || 'UNK'}
              </div>
            </div>

            {/* Airplane Icon and Status */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                flexShrink: 0,
                width: '60px',
                color: '#fff', // Ensure the icons are white
              }}
            >
              {getPhaseIconComponent(currentFlightPhase)}
              <span
                style={{
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginTop: '4px',
                  textAlign: 'center',
                }}
              >
                {getPhaseText(currentFlightPhase)}
              </span>
            </div>

            {/* To Airport */}
            <div
              style={{
                flex: 1,
                padding: '14px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                textAlign: 'center',
              }}
            >
              {/* <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: '600',
                }}
              >
                To
              </div> */}
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {aircraft.arrival || 'UNK'}
              </div>
            </div>
          </div>

          {(isExpanded || !isMobile) && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  padding: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '600',
                    }}
                  >
                    Altitude MSL
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {displayAltMSL}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '600',
                    }}
                  >
                    Altitude AGL
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {altAGL.toFixed(0)} ft
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '600',
                    }}
                  >
                    V-Speed
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {aircraft.vspeed || '0'} fpm
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '600',
                    }}
                  >
                    Speed
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {aircraft.speed?.toFixed(0)} kt
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '600',
                    }}
                  >
                    Heading
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>
                    {aircraft.heading?.toFixed(0)}°
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.5)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: '600',
                    }}
                  >
                    Squawk
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      fontFamily: 'monospace',
                    }}
                  >
                    {aircraft.squawk || 'N/A'}
                  </div>
                </div>
                {aircraft.nextWaypoint && (
                  <div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.5)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontWeight: '600',
                      }}
                    >
                      Next WPT
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>
                      {aircraft.nextWaypoint}
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  flexGrow: 1,
                  overflowY: 'auto',
                  marginTop: '16px',
                }}
              >
                {renderFlightPlan()}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
);

Sidebar.displayName = 'Sidebar';

export default function ATCPage() {
  const [aircrafts, setAircrafts] = useState<PositionUpdate[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAircraft, setSelectedAircraft] =
    useState<PositionUpdate | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] =
    useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected'
  >('connecting');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    (PositionUpdate | Airport)[]
  >([]);
  const [isMobile, setIsMobile] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const drawFlightPlanOnMapRef = useRef<
    ((aircraft: PositionUpdate, shouldZoom?: boolean) => void) | null
  >(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleAircraftSelect = useCallback(
    (aircraft: PositionUpdate | null) => {
      setSelectedAircraft(aircraft);
      setSelectedWaypointIndex(null);
    },
    []
  );

  const handleWaypointClick = useCallback((waypoint: any, index: number) => {
    setSelectedWaypointIndex(index);
  }, []);

  const fetchAirports = useCallback(async () => {
    try {
      const response = await fetch('/airports.json');
      const airportMap: AirportMap = await response.json();
      const airportArray: Airport[] = Object.values(airportMap);
      setAirports(airportArray);
    } catch (e) {
      console.warn('Could not load airports.json');
    }
  }, []);

  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('Connecting to SSE stream...');
    setConnectionStatus('connecting');

    const eventSource = new EventSource('/api/atc/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✓ SSE connection established');
      setConnectionStatus('connected');
      setError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        const processedAircraft: PositionUpdate[] =
          data.aircraft?.map((ac: any) => ({
            ...ac,
            ts: ac.ts || Date.now(),
          })) || [];

        setAircrafts(processedAircraft);
        setIsLoading(false);
        setError(null);
      } catch (e) {
        console.error('Error parsing SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      setConnectionStatus('disconnected');
      eventSource.close();

      const backoffTime = Math.min(
        1000 * Math.pow(2, reconnectAttempts.current),
        30000
      );
      reconnectAttempts.current++;

      setError(`Connection lost. Reconnecting in ${backoffTime / 1000}s...`);

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Reconnect attempt #${reconnectAttempts.current}`);
        connectToStream();
      }, backoffTime);
    };
  }, []);

  useEffect(() => {
    fetchAirports();
    connectToStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchAirports, connectToStream]);

  useEffect(() => {
    if (selectedAircraft && aircrafts.length > 0) {
      const updatedAircraft = aircrafts.find(
        (ac) =>
          ac.callsign === selectedAircraft.callsign ||
          ac.flightNo === selectedAircraft.flightNo
      );

      if (updatedAircraft) {
        setSelectedAircraft(updatedAircraft);
      } else {
        setSelectedAircraft(null);
      }
    }
  }, [aircrafts, selectedAircraft]);

  const performSearch = useCallback(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const results: (PositionUpdate | Airport)[] = [];

    aircrafts.forEach((ac) => {
      if (
        ac.callsign?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.flightNo?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.departure?.toLowerCase().includes(lowerCaseSearchTerm) ||
        ac.arrival?.toLowerCase().includes(lowerCaseSearchTerm)
      ) {
        results.push(ac);
      }
    });

    airports.forEach((airport) => {
      if (
        airport.icao.toLowerCase().includes(lowerCaseSearchTerm) ||
        airport.name.toLowerCase().includes(lowerCaseSearchTerm)
      ) {
        results.push(airport);
      }
    });

    setSearchResults(results);
  }, [searchTerm, aircrafts, airports]);

  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, performSearch]);

  const setDrawFlightPlanOnMap = useCallback(
    (func: (aircraft: PositionUpdate, shouldZoom?: boolean) => void) => {
      drawFlightPlanOnMapRef.current = func;
    },
    []
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: isMobile ? '50%' : 50,
          transform: isMobile ? 'translateX(-50%)' : 'none',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMobile ? 'center' : 'flex-start',
        }}
      >
        <input
          type="text"
          placeholder="Search callsign, flight, or ICAO..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            width: isMobile ? '90vw' : '280px',
            maxWidth: '320px',
            marginBottom: searchTerm && searchResults.length > 0 ? '10px' : '0',
          }}
        />

        {searchTerm && searchResults.length > 0 && (
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              width: isMobile ? '90vw' : '280px',
              maxWidth: '320px',
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {searchResults.map((result, index) => (
              <div
                key={
                  'callsign' in result
                    ? result.callsign || result.flightNo || index
                    : result.icao
                }
                style={{
                  padding: '10px 14px',
                  borderBottom:
                    index < searchResults.length - 1
                      ? '1px solid rgba(255, 255, 255, 0.08)'
                      : 'none',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    'rgba(59, 130, 246, 0.15)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
                onClick={() => {
                  if ('callsign' in result) {
                    setSelectedAircraft(result);
                    drawFlightPlanOnMapRef.current?.(result, true);
                    setSearchTerm('');
                    setSearchResults([]);
                  } else {
                    console.log('Selected airport:', result);
                    setSearchTerm('');
                    setSearchResults([]);
                  }
                }}
              >
                {'callsign' in result ? (
                  <>
                    <div style={{ fontWeight: 'bold' }}>
                      {result.callsign || result.flightNo || 'N/A'}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {result.type} ({result.departure} to{' '}
                      {result.arrival || 'UNK'})
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 'bold' }}>{result.icao}</div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {result.name} (Airport)
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10000,
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor:
            connectionStatus === 'connected'
              ? 'rgba(16, 185, 129, 0.9)'
              : connectionStatus === 'connecting'
                ? 'rgba(251, 191, 36, 0.9)'
                : 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {connectionStatus === 'connected' && '● Live'}
        {connectionStatus === 'connecting' && '◐ Connecting...'}
        {connectionStatus === 'disconnected' && '○ Disconnected'}
      </div>

      <div
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
      >
        {isLoading && aircrafts.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              paddingTop: '50px',
              color: '#333',
            }}
          >
            Loading initial data...
          </div>
        ) : (
          <DynamicMapComponent
            aircrafts={aircrafts}
            airports={airports}
            onAircraftSelect={handleAircraftSelect}
            selectedWaypointIndex={selectedWaypointIndex}
            selectedAirport={
              searchResults.find(
                (r) =>
                  !('callsign' in r) &&
                  searchTerm &&
                  r.icao.toLowerCase() === searchTerm.toLowerCase()
              ) as Airport | undefined
            }
            setDrawFlightPlanOnMap={setDrawFlightPlanOnMap}
          />
        )}
      </div>

      {selectedAircraft && (
        <div
          style={{
            transform:
              !isMobile && selectedAircraft
                ? 'translateX(0)'
                : !isMobile
                  ? 'translateX(380px)'
                  : 'none',
            transition: isMobile
              ? 'none'
              : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: isMobile ? 'fixed' : 'absolute',
            top: isMobile ? 'auto' : 0,
            bottom: isMobile ? 0 : 'auto',
            right: isMobile ? 'auto' : 0,
            left: isMobile ? 0 : 'auto',
            zIndex: 99997,
            width: isMobile ? '100%' : '380px',
            height: isMobile ? 'auto' : '100%',
          }}
        >
          <Sidebar
            aircraft={selectedAircraft}
            onWaypointClick={handleWaypointClick}
            isMobile={isMobile}
          />
        </div>
      )}
    </div>
  );
}