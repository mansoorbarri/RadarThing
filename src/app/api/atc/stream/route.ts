import { NextRequest } from 'next/server';
import { activeAircraft } from '~/lib/aircraft-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Global counter for client connections to help identify individual streams
let clientConnectionCounter = 0;

export function GET(req: NextRequest) {
  const connectionId = ++clientConnectionCounter;
  console.log(`[SSE-Stream-${connectionId}] Client connected. Connection ID: ${connectionId}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // --- INITIAL DATA PUSH ---
      const initialData = activeAircraft.getAll().map(
        ({ lastSeen, ...data }) => ({
          ...data,
          lastSeen: new Date(lastSeen).toISOString(),
        })
      );

      const initialMessage = {
        count: initialData.length,
        aircraft: initialData,
        timestamp: new Date().toISOString(),
      };

      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`)
        );
        console.log(`[SSE-Stream-${connectionId}] Sent initial data (${initialData.length} aircraft).`);
      } catch (error) {
        console.error(`[SSE-Stream-${connectionId}] Error sending initial data, closing stream:`, error);
        controller.close();
        return; // Important: exit if initial enqueue fails, no need to set up further listeners
      }

      // --- SUBSCRIBE TO AIRCRAFT UPDATES ---
      const unsubscribe = activeAircraft.subscribe((aircraftMap) => {
        const allAircraft = Array.from(aircraftMap.values()).map(
          ({ lastSeen, ...data }) => ({
            ...data,
            lastSeen: new Date(lastSeen).toISOString(),
          })
        );

        const message = {
          count: allAircraft.length,
          aircraft: allAircraft,
          timestamp: new Date().toISOString(),
        };

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
          // Log only when data is actually sent, not just on callback trigger
          console.log(`[SSE-Stream-${connectionId}] Sent update (${allAircraft.length} aircraft).`);
        } catch (error) {
          // This catch block usually fires when the client has disconnected
          // but the subscription callback was already in flight or the stream
          // wasn't fully closed yet.
          console.error(`[SSE-Stream-${connectionId}] Error sending SSE update, assuming client disconnected and closing stream:`, error);
          unsubscribe(); // Clean up the subscription
          controller.close(); // Explicitly close the stream for this client
        }
      });

      // --- HEARTBEAT INTERVAL ---
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
          console.log(`[SSE-Stream-${connectionId}] Sent heartbeat.`);
        } catch (error) {
          // This catch block usually fires if the client has disconnected
          // and we try to send a heartbeat.
          console.error(`[SSE-Stream-${connectionId}] Error sending heartbeat, assuming client disconnected and closing stream:`, error);
          clearInterval(heartbeatInterval); // Stop sending heartbeats
          unsubscribe(); // Clean up the subscription
          controller.close(); // Explicitly close the stream for this client
        }
      }, 30000); // Send heartbeat every 30 seconds

      // --- CLIENT ABORT/DISCONNECT LISTENER ---
      // This is the primary mechanism to detect when the client closes the connection.
      req.signal.addEventListener('abort', () => {
        console.log(`[SSE-Stream-${connectionId}] Client disconnected (abort signal received).`);
        clearInterval(heartbeatInterval); // Stop heartbeats
        unsubscribe(); // Clean up the subscription
        controller.close(); // Close the stream from the server side
      });

      // No need for controller.oncancel as it doesn't exist on ReadableStreamDefaultController.
      // The other error handling and abort signal listener cover the necessary cleanup.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive', // Essential for long-lived connections
      'X-Accel-Buffering': 'no', // Often recommended for SSE to prevent proxy buffering
      ...CORS_HEADERS,
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}