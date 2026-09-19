export const SUPER_ADMIN_GOOGLE_ID = "101233162035372298523";

export function moderationReason(value: string) {
  const reason = value.trim();
  if (!reason || reason.length > 2000)
    throw new Error("Enter a reason between 1 and 2,000 characters");
  return reason;
}

export function assertModerationTarget(
  actor: { _id: string; googleId?: string },
  target: {
    _id: string;
    googleId?: string;
    role: string;
    isDeleted: boolean;
  } | null,
) {
  if (!target || target.isDeleted) throw new Error("User not found");
  if (target._id === actor._id)
    throw new Error("You cannot moderate your own account");
  if (target.googleId === SUPER_ADMIN_GOOGLE_ID)
    throw new Error("The super-admin account is protected");
  if (target.role === "ADMIN" && actor.googleId !== SUPER_ADMIN_GOOGLE_ID)
    throw new Error("Only the super-admin can moderate admins");
}

export function moderationLabel(
  user: { _id: string; discordUsername?: string } | null,
  fallbackId: string,
) {
  return user?.discordUsername?.trim() || `RT ID: ${user?._id ?? fallbackId}`;
}
