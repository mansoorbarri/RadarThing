import { NextRequest } from "next/server";
import { activeAircraft } from "~/lib/aircraft-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const initialData = activeAircraft
        .getAll()
        .map(({ lastSeen, ...data }) => ({
          ...data,
          lastSeen: new Date(lastSeen).toISOString(),
        }));

      const initialMessage = {
        count: initialData.length,
        aircraft: initialData,
        timestamp: new Date().toISOString(),
      };

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`),
      );

      const unsubscribe = activeAircraft.subscribe((aircraftMap) => {
        const allAircraft = Array.from(aircraftMap.values()).map(
          ({ lastSeen, ...data }) => ({
            ...data,
            lastSeen: new Date(lastSeen).toISOString(),
          }),
        );

        const message = {
          count: allAircraft.length,
          aircraft: allAircraft,
          timestamp: new Date().toISOString(),
        };

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
          );
        } catch (error) {
          console.error("Error sending SSE update:", error);
          unsubscribe();
          controller.close();
        }
      });

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (error) {
          clearInterval(heartbeatInterval);
          unsubscribe();
        }
      }, 3500);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
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
