import posthog from "posthog-js";

// Type-safe event definitions
type UserRole = "FREE" | "PRO" | "ADMIN";

// Event property types
interface BaseEventProps {
  timestamp?: number;
}

interface AircraftEventProps extends BaseEventProps {
  callsign: string;
  aircraftType?: string;
}

interface SearchEventProps extends BaseEventProps {
  query: string;
  resultCount?: number;
}

interface FeatureAccessProps extends BaseEventProps {
  feature: string;
  hasAccess: boolean;
}

interface WeatherLayerProps extends BaseEventProps {
  layer: "precipitation" | "airmet" | "sigmet" | "notam";
  enabled: boolean;
}

interface FlightEventProps extends BaseEventProps {
  callsign: string;
  aircraftType: string;
  depICAO?: string;
  arrICAO?: string;
}

interface FlightReplayEventProps extends BaseEventProps {
  callsign?: string;
  aircraftType?: string;
  depICAO?: string;
  arrICAO?: string;
  duration?: number;
}

interface FlightReplaySpeedProps extends FlightReplayEventProps {
  speed: number;
}

interface CheckoutEventProps extends BaseEventProps {
  priceId?: string;
  source?: string;
}

interface ImageEventProps extends BaseEventProps {
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
}

interface AirportEventProps extends BaseEventProps {
  icao: string;
}

interface MapEventProps extends BaseEventProps {
  mode?: string;
  zoomLevel?: number;
}

interface ConflictLayerProps extends BaseEventProps {
  enabled: boolean;
}

interface ConflictSnapshotProps extends BaseEventProps {
  total: number;
  high: number;
  medium: number;
  low: number;
}

interface WhatsNewEventProps extends BaseEventProps {
  had_unread?: boolean;
  entry_id?: string;
}

interface ShortcutsEventProps extends BaseEventProps {
  source?: string;
}

// All analytics events
export const Analytics = {
  // Initialize PostHog (only in production)
  init: () => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "development") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false, // Manual tracking for better control
      error_tracking: {
        captureExtensionExceptions: false,
      },
      session_recording: {
        maskAllInputs: true,
      },
    });
  },

  // Identify user with their properties
  identify: (
    userId: string,
    properties: {
      email?: string;
      role: UserRole;
      googleId?: string;
      stripeCustomerId?: string;
    },
  ) => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "development") return;

    posthog.identify(userId, {
      email: properties.email,
      role: properties.role,
      is_pro: properties.role === "PRO" || properties.role === "ADMIN",
      is_admin: properties.role === "ADMIN",
      google_id: properties.googleId,
      stripe_customer_id: properties.stripeCustomerId,
    });
  },

  // Reset on logout
  reset: () => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "development") return;

    posthog.reset();
  },

  // ===== AIRCRAFT EVENTS =====
  aircraftSelected: (props: AircraftEventProps) => {
    track("aircraft_selected", props);
  },

  aircraftSearched: (props: SearchEventProps) => {
    track("aircraft_searched", props);
  },

  aircraftFiltered: (props: { prefix: string }) => {
    track("aircraft_filtered", props);
  },

  // ===== FLIGHT EVENTS =====
  flightStarted: (props: FlightEventProps) => {
    track("flight_started", props);
  },

  flightEnded: (
    props: FlightEventProps & { duration?: number; maxAltitude?: number },
  ) => {
    track("flight_ended", props);
  },

  flightHistoryViewed: (props?: BaseEventProps) => {
    track("flight_history_viewed", props);
  },

  flightReplayStarted: (props: FlightReplayEventProps) => {
    track("flight_replay_started", props);
  },

  flightReplayPaused: (props: FlightReplayEventProps) => {
    track("flight_replay_paused", props);
  },

  flightReplaySpeedChanged: (props: FlightReplaySpeedProps) => {
    track("flight_replay_speed_changed", props);
  },

  flightReplayCompleted: (props: FlightReplayEventProps) => {
    track("flight_replay_completed", props);
  },

  flightReplayClosed: (props: FlightReplayEventProps) => {
    track("flight_replay_closed", props);
  },

  flightReplayShared: (
    props: FlightReplayEventProps & { flightId: string },
  ) => {
    track("flight_replay_shared", props);
  },

  // ===== FEATURE ACCESS EVENTS =====
  featureAccessed: (props: FeatureAccessProps) => {
    track("feature_accessed", props);
  },

  proFeatureBlocked: (props: { feature: string }) => {
    track("pro_feature_blocked", props);
  },

  // ===== WEATHER LAYER EVENTS =====
  weatherLayerToggled: (props: WeatherLayerProps) => {
    track("weather_layer_toggled", props);
  },

  // ===== MAP EVENTS =====
  mapLoaded: (props?: MapEventProps) => {
    track("map_loaded", props);
  },

  mapModeChanged: (props: { mode: string }) => {
    track("map_mode_changed", props);
  },

  headingModeToggled: (props: { enabled: boolean; callsign?: string }) => {
    track("heading_mode_toggled", props);
  },

  conflictLayerToggled: (props: ConflictLayerProps) => {
    track("conflict_layer_toggled", props);
  },

  conflictMonitorViewed: (props?: BaseEventProps) => {
    track("conflict_monitor_viewed", props);
  },

  conflictSnapshotUpdated: (props: ConflictSnapshotProps) => {
    track("conflict_snapshot_updated", props);
  },

  // ===== AIRPORT EVENTS =====
  airportSelected: (props: AirportEventProps) => {
    track("airport_selected", props);
  },

  taxiChartViewed: (props: AirportEventProps & { hasAccess: boolean }) => {
    track("taxi_chart_viewed", props);
  },

  // ===== PRICING & MONETIZATION =====
  pricingPageViewed: (props?: BaseEventProps) => {
    track("pricing_page_viewed", props);
  },

  upgradeButtonClicked: (props: { source: string; feature?: string }) => {
    track("upgrade_button_clicked", props);
  },

  checkoutStarted: (props: CheckoutEventProps) => {
    track("checkout_started", props);
  },

  checkoutCompleted: (props?: CheckoutEventProps) => {
    track("checkout_completed", props);
  },

  subscriptionCancelled: (props?: BaseEventProps) => {
    track("subscription_cancelled", props);
  },

  // ===== LEADERBOARD EVENTS =====
  leaderboardViewed: (props?: BaseEventProps) => {
    track("leaderboard_viewed", props);
  },

  leaderboardIconClicked: (props?: BaseEventProps) => {
    track("leaderboard_icon_clicked", props);
  },

  // ===== DASHBOARD EVENTS =====
  dashboardViewed: (props?: BaseEventProps) => {
    track("dashboard_viewed", props);
  },

  statsCalculated: (props: {
    totalFlights?: number;
    totalDistance?: number;
    totalTime?: number;
  }) => {
    track("stats_calculated", props);
  },

  // ===== AIRCRAFT IMAGE EVENTS =====
  imageGalleryViewed: (props?: BaseEventProps) => {
    track("image_gallery_viewed", props);
  },

  imageUploadStarted: (props: ImageEventProps) => {
    track("image_upload_started", props);
  },

  imageUploadCompleted: (props: ImageEventProps) => {
    track("image_upload_completed", props);
  },

  imageSearched: (props: SearchEventProps) => {
    track("image_searched", props);
  },

  // ===== AUTH EVENTS =====
  signedIn: (props?: { method?: string }) => {
    track("signed_in", props);
  },

  signedOut: (props?: BaseEventProps) => {
    track("signed_out", props);
  },

  // ===== AIRCRAFT CONTROL EVENTS =====
  controlSet: (props: {
    control: string;
    callsign?: string;
    value?: string | number;
  }) => {
    track("control_set", props);
  },

  controlSetAll: (props: { callsign?: string; controls?: string[] }) => {
    track("control_set_all", props);
  },

  identRequested: (props: { callsign?: string; durationSeconds?: number }) => {
    track("ident_requested", props);
  },

  // ===== MOST TRACKED EVENTS =====
  mostTrackedFlightClicked: (props: {
    callsign: string;
    trackerCount: number;
    rank: number;
  }) => {
    track("most_tracked_flight_clicked", props);
  },

  // ===== WHATS NEW EVENTS =====
  whatsNewOpened: (props: WhatsNewEventProps) => {
    track("whats_new_opened", props);
  },

  whatsNewToastShown: (props?: WhatsNewEventProps) => {
    track("whats_new_toast_shown", props);
  },

  whatsNewToastClicked: (props?: WhatsNewEventProps) => {
    track("whats_new_toast_clicked", props);
  },

  shortcutsOpened: (props?: ShortcutsEventProps) => {
    track("shortcuts_opened", props);
  },

  // ===== FLIGHT CARD EVENTS =====
  flightCardOpened: (props: {
    callsign?: string;
    aircraftType?: string;
    depICAO?: string;
    arrICAO?: string;
    hasRoute: boolean;
    source: string;
  }) => {
    track("flight_card_opened", props);
  },

  flightCardDownloaded: (props: {
    callsign?: string;
    aircraftType?: string;
    depICAO?: string;
    arrICAO?: string;
    hasRoute: boolean;
  }) => {
    track("flight_card_downloaded", props);
  },

  flightCardCopied: (props: {
    callsign?: string;
    aircraftType?: string;
    depICAO?: string;
    arrICAO?: string;
    hasRoute: boolean;
  }) => {
    track("flight_card_copied", props);
  },

  // ===== GENERIC EVENT =====
  track: (eventName: string, properties?: Record<string, unknown>) => {
    track(eventName, properties);
  },

  captureException: (
    error: unknown,
    properties?: Record<string, unknown>,
  ) => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "development") return;

    posthog.captureException(error, {
      ...properties,
      timestamp: Date.now(),
    });
  },
};

// Internal tracking function with dev guard
function track(eventName: string, properties?: object) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV === "development") return;

  posthog.capture(eventName, {
    ...properties,
    timestamp: Date.now(),
  });
}
