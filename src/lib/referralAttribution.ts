const REFERRAL_STORAGE_KEY = "radarthing.referral_code";

export function persistReferralCode(code: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
}

export function readPersistedReferralCode() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFERRAL_STORAGE_KEY);
}

export function clearPersistedReferralCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
