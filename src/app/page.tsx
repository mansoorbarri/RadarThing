'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { type PositionUpdate } from '~/lib/aircraft-store';
import { useViewerTracker } from '~/hooks/use-viewer-counter';

interface Airport {
    name: string;
    lat: number;
    lon: number;
    icao: string;
}

type AirportMap = Record<string, Airport>;

const DynamicMapComponent = dynamic(
  () => import('~/components/map'),
  { 
    ssr: false,
    loading: () => <div style={{ textAlign: 'center', paddingTop: '50px' }}>Loading Map...</div>
  }
);

const Sidebar = React.memo(({ aircraft }: { aircraft: PositionUpdate & { altMSL?: number } }) => {
    const altMSL = aircraft.altMSL ?? aircraft.alt;
    const altAGL = aircraft.alt;
    const isOnGround = altAGL < 100;

  const renderFlightPlan = useCallback(() => {
      if (!aircraft.flightPlan) return (
          <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px'
          }}>
              No flight plan available
          </div>
      );

      try {
          const waypoints = JSON.parse(aircraft.flightPlan);
          return (
              <div style={{ 
                  height: '100%',
                  overflowY: 'auto', 
                  padding: '0 16px 16px 16px',
              }}>
                  <div style={{ 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      color: 'rgba(255,255,255,0.9)',
                      marginBottom: '12px',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase'
                  }}>
                      Flight Plan
                  </div>
                  {waypoints.map((wp: any, index: number) => (
                      <div key={index} style={{ 
                          padding: '12px 14px',
                          marginBottom: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      }}
                      >
                          <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              marginBottom: '4px'
                          }}>
                              <span style={{ 
                                  fontWeight: '600', 
                                  fontSize: '14px',
                                  color: '#fff'
                              }}>{wp.ident}</span>
                              <span style={{ 
                                  fontSize: '11px', 
                                  color: 'rgba(255,255,255,0.5)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                              }}>{wp.type}</span>
                          </div>
                          <div style={{ 
                              fontSize: '12px', 
                              color: 'rgba(255,255,255,0.7)',
                              display: 'flex',
                              gap: '12px'
                          }}>
                              <span>Alt: <strong>{wp.alt ? wp.alt + ' ft' : 'N/A'}</strong></span>
                              <span>Spd: <strong>{wp.spd ? wp.spd + ' kt' : 'N/A'}</strong></span>
                          </div>
                      </div>
                  ))}
              </div>
          );
      } catch (e) {
          return (
              <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: 'rgba(239, 68, 68, 0.8)',
                  fontSize: '14px'
              }}>
                  Error loading flight plan
              </div>
          );
      }
  }, [aircraft.flightPlan]);

    const displayAlt = isOnGround ? `${altAGL.toFixed(0)} ft AGL` : 
                       altMSL >= 18000 ? `FL${Math.round(altMSL / 100)}` :
                       `${altAGL.toFixed(0)} ft AGL`;

    return (
        <div style={{ 
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
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
            <div style={{ 
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
                padding: '20px 20px 16px 20px', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <div style={{ 
                    fontSize: '24px', 
                    fontWeight: '700',
                    marginBottom: '4px',
                    letterSpacing: '-0.5px'
                }}>
                    {aircraft.callsign || aircraft.flightNo || 'N/A'}
                </div>
                <div style={{ 
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: '500',
                    letterSpacing: '0.5px'
                }}>
                    {aircraft.type || 'Unknown Type'}
                </div>
            </div>
            
            <div style={{ 
                padding: '16px 16px 0 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
            }}>
                <div style={{
                    padding: '14px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '10px',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                    <div style={{ 
                        fontSize: '11px', 
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontWeight: '600'
                    }}>
                        Flight Number
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>
                        {aircraft.flightNo || 'N/A'}
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                }}>
                    <div style={{
                        padding: '14px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '10px',
                        border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                        <div style={{ 
                            fontSize: '11px', 
                            color: 'rgba(255,255,255,0.6)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            From
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                            {aircraft.departure || 'UNK'}
                        </div>
                    </div>
                    <div style={{
                        padding: '14px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderRadius: '10px',
                        border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}>
                        <div style={{ 
                            fontSize: '11px', 
                            color: 'rgba(255,255,255,0.6)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            To
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                            {aircraft.arrival || 'UNK'}
                        </div>
                    </div>
                </div>

                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '10px', 
                    padding: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <div>
                        <div style={{ 
                            fontSize: '10px', 
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            Altitude
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>
                            {displayAlt}
                        </div>
                    </div>
                    <div>
                        <div style={{ 
                            fontSize: '10px', 
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            V-Speed
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>
                            {aircraft.vspeed || "0"} fpm
                        </div>
                    </div>
                    <div>
                        <div style={{ 
                            fontSize: '10px', 
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            Speed
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>
                            {aircraft.speed?.toFixed(0)} kt
                        </div>
                    </div>
                    <div>
                        <div style={{ 
                            fontSize: '10px', 
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            Heading
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>
                            {aircraft.heading?.toFixed(0)}°
                        </div>
                    </div>
                    <div>
                        <div style={{ 
                            fontSize: '10px', 
                            color: 'rgba(255,255,255,0.5)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontWeight: '600'
                        }}>
                            Squawk
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'monospace' }}>
                            {aircraft.squawk || 'N/A'}
                        </div>
                    </div>
                    {aircraft.nextWaypoint && (
                        <div>
                            <div style={{ 
                                fontSize: '10px', 
                                color: 'rgba(255,255,255,0.5)',
                                marginBottom: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                fontWeight: '600'
                            }}>
                                Next WPT
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600' }}>
                                {aircraft.nextWaypoint}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ 
                flexGrow: 1, 
                overflowY: 'auto',
                marginTop: '16px'
            }}>
                {renderFlightPlan()}
            </div>
        </div>
    );
});

Sidebar.displayName = 'Sidebar';

export default function ATCPage() {
  const [aircrafts, setAircrafts] = useState<PositionUpdate[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<PositionUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  
  useViewerTracker({ enabled: true });

  const handleAircraftSelect = useCallback((aircraft: PositionUpdate | null) => {
    setSelectedAircraft(aircraft);
  }, []);

  const fetchAirports = useCallback(async () => {
    try {
      const response = await fetch('/airports.json');
      const airportMap: AirportMap = await response.json();
      const airportArray: Airport[] = Object.values(airportMap);
      setAirports(airportArray);
    } catch (e) {
      console.warn("Could not load airports.json");
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
        
        const processedAircraft: PositionUpdate[] = data.aircraft?.map((ac: any) => ({
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
        (ac) => ac.callsign === selectedAircraft.callsign || ac.flightNo === selectedAircraft.flightNo
      );

      if (updatedAircraft) {
        setSelectedAircraft(updatedAircraft);
      } else {
        setSelectedAircraft(null);
      }
    }
  }, [aircrafts, selectedAircraft]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 10000,
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: connectionStatus === 'connected' 
          ? 'rgba(16, 185, 129, 0.9)' 
          : connectionStatus === 'connecting'
          ? 'rgba(251, 191, 36, 0.9)'
          : 'rgba(239, 68, 68, 0.9)',
        color: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(8px)'
      }}>
        {connectionStatus === 'connected' && '● Live'}
        {connectionStatus === 'connecting' && '◐ Connecting...'}
        {connectionStatus === 'disconnected' && '○ Disconnected'}
      </div>

      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {isLoading && aircrafts.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '50px', background: '#333', color: '#fff' }}>Loading initial data...</div>
        ) : (
          <DynamicMapComponent 
            aircrafts={aircrafts} 
            airports={airports} 
            onAircraftSelect={handleAircraftSelect}
          />
        )}
      </div>

      <div style={{
        transform: selectedAircraft ? 'translateX(0)' : 'translateX(380px)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 99997,
        width: '380px',
        height: '100%',
      }}>
        {selectedAircraft && <Sidebar aircraft={selectedAircraft} />}
      </div>

    </div>
  );
}