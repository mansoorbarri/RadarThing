import { useCallback, useState } from "react";

const COMMAND_API_URL = "https://sse.radarthing.com/api/command";

export type CommandType =
  | "setSpeed"
  | "setSpeedMode"
  | "setAltitude"
  | "setHeading"
  | "setVS"
  | "setSquawk"
  | "setFlaps"
  | "enableNav"
  | "disableNav"
  | "setWaypoint"
  | "toggleAutopilot"
  | "requestIdent";

interface Command {
  type: CommandType;
  value: number | string | boolean;
}

interface SendCommandParams {
  targetId?: string;
  targetCallsign?: string;
  targetGoogleId?: string;
  command: Command;
}

export function useAircraftCommands() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCommand = useCallback(async (params: SendCommandParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(COMMAND_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send command");
      }

      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSpeed = useCallback(
    (targetId: string, speed: number) =>
      sendCommand({
        targetId,
        command: { type: "setSpeed", value: speed },
      }),
    [sendCommand],
  );

  const setSpeedMode = useCallback(
    (targetId: string, speedMode: "knots" | "mach") =>
      sendCommand({
        targetId,
        command: { type: "setSpeedMode", value: speedMode },
      }),
    [sendCommand],
  );

  const setAltitude = useCallback(
    (targetId: string, altitude: number) =>
      sendCommand({
        targetId,
        command: { type: "setAltitude", value: altitude },
      }),
    [sendCommand],
  );

  const setHeading = useCallback(
    (targetId: string, heading: number) =>
      sendCommand({
        targetId,
        command: { type: "setHeading", value: heading },
      }),
    [sendCommand],
  );

  const setVS = useCallback(
    (targetId: string, vspeed: number) =>
      sendCommand({
        targetId,
        command: { type: "setVS", value: vspeed },
      }),
    [sendCommand],
  );

  const setSquawk = useCallback(
    (targetId: string, squawk: string) =>
      sendCommand({
        targetId,
        command: { type: "setSquawk", value: squawk },
      }),
    [sendCommand],
  );

  const setFlaps = useCallback(
    (targetId: string, flaps: number) =>
      sendCommand({
        targetId,
        command: { type: "setFlaps", value: flaps },
      }),
    [sendCommand],
  );

  const disableNav = useCallback(
    (targetId: string) =>
      sendCommand({
        targetId,
        command: { type: "disableNav", value: true },
      }),
    [sendCommand],
  );

  const enableNav = useCallback(
    (targetId: string) =>
      sendCommand({
        targetId,
        command: { type: "enableNav", value: true },
      }),
    [sendCommand],
  );

  const setWaypoint = useCallback(
    (targetId: string, waypointIdent: string) =>
      sendCommand({
        targetId,
        command: { type: "setWaypoint", value: waypointIdent },
      }),
    [sendCommand],
  );

  const toggleAutopilot = useCallback(
    (targetId: string, enabled: boolean) =>
      sendCommand({
        targetId,
        command: { type: "toggleAutopilot", value: enabled },
      }),
    [sendCommand],
  );

  const requestIdent = useCallback(
    (targetId: string, durationSeconds = 15) =>
      sendCommand({
        targetId,
        command: { type: "requestIdent", value: durationSeconds },
      }),
    [sendCommand],
  );

  return {
    sendCommand,
    setSpeed,
    setSpeedMode,
    setAltitude,
    setHeading,
    setVS,
    setSquawk,
    setFlaps,
    enableNav,
    disableNav,
    setWaypoint,
    toggleAutopilot,
    requestIdent,
    isLoading,
    error,
  };
}
