export const REFERRAL_CODE_LENGTH = 5;
export const REFERRAL_MIN_ACCOUNT_AGE_DAYS = 30;
export const REFERRAL_MIN_QUALIFYING_FLIGHTS = 3;
export const REFERRAL_REWARD_THRESHOLD = 20;
export const REFERRAL_PRO_REWARD_DURATION_DAYS = 30;

export const REFERRAL_MIN_ACCOUNT_AGE_MS =
  REFERRAL_MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
export const REFERRAL_PRO_REWARD_DURATION_MS =
  REFERRAL_PRO_REWARD_DURATION_DAYS * 24 * 60 * 60 * 1000;

const REFERRAL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeReferralCode(value?: string | null) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, REFERRAL_CODE_LENGTH);
}

export function isReferralCode(value?: string | null) {
  return normalizeReferralCode(value).length === REFERRAL_CODE_LENGTH;
}

export function generateReferralCode() {
  const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);

  return Array.from(
    bytes,
    (byte) => REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length],
  ).join("");
}

export function getReferralQualificationDeadline(createdAt: number) {
  return createdAt + REFERRAL_MIN_ACCOUNT_AGE_MS;
}

export function maskReferralEmail(email: string) {
  const [localPart = "", domainPart = ""] = email.split("@");
  const maskedLocal =
    localPart.length <= 2
      ? `${localPart.slice(0, 1)}*`
      : `${localPart.slice(0, 2)}${"*".repeat(
          Math.max(1, localPart.length - 2),
        )}`;

  const [domainName = "", tld = ""] = domainPart.split(".");
  const maskedDomain =
    domainName.length <= 1
      ? "*"
      : `${domainName.slice(0, 1)}${"*".repeat(Math.max(1, domainName.length - 1))}`;

  return `${maskedLocal}@${maskedDomain}${tld ? `.${tld}` : ""}`;
}
