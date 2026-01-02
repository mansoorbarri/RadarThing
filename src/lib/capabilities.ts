export type UserRole = "FREE" | "PREMIUM" | "ADMIN";

export function hasPremium(role?: UserRole | null) {
  return role === "PREMIUM";
}