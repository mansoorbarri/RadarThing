"use client";

import {
  openPrivacySettings,
  requestGooglePrivacyOptions,
} from "~/components/privacy/PrivacyConsentProvider";

export function CookieChoices() {
  return (
    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
      <button
        type="button"
        onClick={openPrivacySettings}
        className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-[#021016] hover:bg-cyan-200"
      >
        Analytics preferences
      </button>
      <button
        type="button"
        onClick={requestGooglePrivacyOptions}
        className="rounded-lg border border-white/15 px-4 py-3 text-sm font-medium text-white/75 hover:border-cyan-300/35 hover:text-cyan-200"
      >
        Advertising preferences
      </button>
    </div>
  );
}
