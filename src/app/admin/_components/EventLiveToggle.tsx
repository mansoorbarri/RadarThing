"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Radio } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Switch } from "~/components/ui/switch";

// Site-wide switch: while an event is live, free pilots can start flights.
// Otherwise only Pro pilots can. Viewing the site, charts and uploads are
// never affected.
export function EventLiveToggle() {
  const setting = useQuery(api.siteSettings.getEventLive);
  const setEventLive = useMutation(api.siteSettings.setEventLive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const eventLive = setting?.eventLive ?? false;

  const onChange = async (next: boolean) => {
    setSaving(true);
    setError("");
    try {
      await setEventLive({ eventLive: next });
    } catch (err) {
      console.error("Failed to update event live setting:", err);
      setError("Couldn't update the event setting. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Radio
          className={`mt-0.5 h-5 w-5 shrink-0 ${eventLive ? "text-emerald-400" : "text-slate-500"}`}
          aria-hidden
        />
        <div>
          <label htmlFor="event-live-switch" className="font-medium text-white">
            Event live
          </label>
          <p className="text-sm text-slate-400">
            {setting === undefined
              ? "Loading…"
              : eventLive
                ? "Anyone can start a flight."
                : "Only Pro pilots can start a flight. Free pilots see a message that no event is live."}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
      <Switch
        id="event-live-switch"
        checked={eventLive}
        disabled={setting === undefined || saving}
        onCheckedChange={(next) => void onChange(next)}
        className="data-[state=checked]:bg-emerald-500"
      />
    </section>
  );
}
