/**
 * Simple cookie utilities for client-side storage
 */

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() ?? null;
  }
  return null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

export function getBooleanCookie(name: string, defaultValue: boolean): boolean {
  const value = getCookie(name);
  if (value === null) return defaultValue;
  return value === "true";
}

export function setBooleanCookie(
  name: string,
  value: boolean,
  days = 365,
): void {
  setCookie(name, value.toString(), days);
}
