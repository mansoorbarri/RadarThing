"use client";

import { usePrivacyConsent } from "./PrivacyConsentProvider";

/** Text-style button that reopens the privacy/consent choices. */
export function PrivacySettingsButton({
  className = "",
}: {
  className?: string;
}) {
  const { openPrivacySettings } = usePrivacyConsent();
  return (
    <button type="button" onClick={openPrivacySettings} className={className}>
      Privacy settings
    </button>
  );
}
