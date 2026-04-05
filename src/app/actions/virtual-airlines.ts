"use server";

import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { convex, api } from "~/server/convex";
import { getCurrentAccessContext } from "~/server/access";
import { getAircraftTypeLookupCandidates } from "~/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

const utapi = new UTApi();

function normalizeCallsignPrefix(prefix: string): string {
  return prefix.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeAircraftTypeInput(aircraftType: string): string {
  const cleaned = aircraftType.trim().toUpperCase();
  const atrMatch = /\bATR?[\s-]?(\d{2})\b/.exec(cleaned);
  if (atrMatch) return `ATR${atrMatch[1]}`;
  return cleaned;
}

export interface VirtualAirline {
  id: string;
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VirtualAirlineAircraftImage {
  id: string;
  virtualAirlineId: string;
  aircraftType: string;
  imageUrl: string;
  imageKey: string | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VirtualAirlineMember {
  id: string;
  virtualAirlineId: string;
  userId: string;
  clerkId: string;
  googleId: string;
  addedBy: string;
  createdAt: Date;
  email: string | null;
  discordUsername: string | null;
}

function toVirtualAirline(item: {
  id: string;
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
  isActive: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}): VirtualAirline {
  return {
    id: item.id,
    name: item.name,
    callsignPrefix: item.callsignPrefix,
    adminClerkId: item.adminClerkId,
    isActive: item.isActive,
    createdBy: item.createdBy,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function toVirtualAirlineAircraftImage(item: {
  id: string;
  virtualAirlineId: string;
  aircraftType: string;
  imageUrl: string;
  imageKey: string | null;
  uploadedBy: string;
  createdAt: number;
  updatedAt: number;
}): VirtualAirlineAircraftImage {
  return {
    id: item.id,
    virtualAirlineId: item.virtualAirlineId,
    aircraftType: item.aircraftType,
    imageUrl: item.imageUrl,
    imageKey: item.imageKey,
    uploadedBy: item.uploadedBy,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function toVirtualAirlineMember(item: {
  id: string;
  virtualAirlineId: string;
  userId: string;
  clerkId: string;
  googleId: string;
  addedBy: string;
  createdAt: number;
  email: string | null;
  discordUsername: string | null;
}): VirtualAirlineMember {
  return {
    id: item.id,
    virtualAirlineId: item.virtualAirlineId,
    userId: item.userId,
    clerkId: item.clerkId,
    googleId: item.googleId,
    addedBy: item.addedBy,
    createdAt: new Date(item.createdAt),
    email: item.email,
    discordUsername: item.discordUsername,
  };
}

async function requireSiteAdmin() {
  const access = await getCurrentAccessContext();

  if (!access.clerkId || !access.isAdmin) {
    return null;
  }

  return access;
}

async function canManageVirtualAirline(virtualAirlineId: string) {
  const access = await getCurrentAccessContext();
  if (!access.clerkId) {
    return { access, virtualAirline: null, allowed: false };
  }

  const virtualAirline = await convex.query(api.virtualAirlines.getById, {
    id: virtualAirlineId as Id<"virtualAirlines">,
  });

  if (!virtualAirline) {
    return { access, virtualAirline: null, allowed: false };
  }

  const allowed =
    access.isAdmin || virtualAirline.adminClerkId === access.clerkId;

  return { access, virtualAirline, allowed };
}

async function validateVirtualAirlineInput(data: {
  id?: string;
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
}) {
  const name = data.name.trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false as const, error: "VA name must be 2-60 characters" };
  }

  const callsignPrefix = normalizeCallsignPrefix(data.callsignPrefix);
  if (!/^[A-Z0-9]{2,8}$/.test(callsignPrefix)) {
    return {
      ok: false as const,
      error: "Callsign prefix must be 2-8 letters or numbers",
    };
  }

  const adminUser = await convex.query(api.users.getByClerkId, {
    clerkId: data.adminClerkId,
  });

  if (!adminUser || adminUser.isDeleted) {
    return {
      ok: false as const,
      error: "Selected VA admin must be an active RadarThing user",
    };
  }

  const existingByPrefix = await convex.query(api.virtualAirlines.getByCallsignPrefix, {
    callsignPrefix,
  });

  if (existingByPrefix && existingByPrefix.id !== data.id) {
    return {
      ok: false as const,
      error: "That callsign prefix is already assigned to another VA",
    };
  }

  return {
    ok: true as const,
    name,
    callsignPrefix,
  };
}

async function ensureVirtualAirlineAdminMembership(data: {
  virtualAirlineId: string;
  adminClerkId: string;
  addedBy: string;
}) {
  const adminUser = await convex.query(api.users.getByClerkId, {
    clerkId: data.adminClerkId,
  });

  if (!adminUser?.googleId) {
    return;
  }

  await convex.mutation(api.virtualAirlineMembers.add, {
    virtualAirlineId: data.virtualAirlineId as Id<"virtualAirlines">,
    userId: adminUser._id,
    clerkId: adminUser.clerkId,
    googleId: adminUser.googleId,
    addedBy: data.addedBy,
  });
}

export async function createVirtualAirline(data: {
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
}): Promise<{ success: boolean; error?: string; virtualAirline?: VirtualAirline }> {
  const access = await requireSiteAdmin();
  if (!access?.clerkId) {
    return { success: false, error: "Only ADMIN users can register VAs" };
  }

  const validated = await validateVirtualAirlineInput(data);
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  const virtualAirline = await convex.mutation(api.virtualAirlines.create, {
    name: validated.name,
    callsignPrefix: validated.callsignPrefix,
    adminClerkId: data.adminClerkId,
    createdBy: access.clerkId,
  });

  revalidatePath("/admin");
  revalidatePath("/va-admin");

  if (virtualAirline) {
    await ensureVirtualAirlineAdminMembership({
      virtualAirlineId: virtualAirline.id,
      adminClerkId: data.adminClerkId,
      addedBy: access.clerkId,
    });
  }

  return {
    success: true,
    virtualAirline: virtualAirline ? toVirtualAirline(virtualAirline) : undefined,
  };
}

export async function updateVirtualAirline(data: {
  id: string;
  name: string;
  callsignPrefix: string;
  adminClerkId: string;
  isActive: boolean;
}): Promise<{ success: boolean; error?: string; virtualAirline?: VirtualAirline }> {
  const access = await requireSiteAdmin();
  if (!access?.clerkId) {
    return { success: false, error: "Only ADMIN users can update VAs" };
  }

  const validated = await validateVirtualAirlineInput(data);
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  const existing = await convex.query(api.virtualAirlines.getById, {
    id: data.id as Id<"virtualAirlines">,
  });

  if (!existing) {
    return { success: false, error: "VA not found" };
  }

  const virtualAirline = await convex.mutation(api.virtualAirlines.update, {
    id: data.id as Id<"virtualAirlines">,
    name: validated.name,
    callsignPrefix: validated.callsignPrefix,
    adminClerkId: data.adminClerkId,
    isActive: data.isActive,
  });

  revalidatePath("/admin");
  revalidatePath("/va-admin");
  revalidatePath("/radar");

  if (virtualAirline) {
    await ensureVirtualAirlineAdminMembership({
      virtualAirlineId: virtualAirline.id,
      adminClerkId: data.adminClerkId,
      addedBy: access.clerkId,
    });
  }

  return {
    success: true,
    virtualAirline: virtualAirline ? toVirtualAirline(virtualAirline) : undefined,
  };
}

export async function deleteVirtualAirline(
  id: string,
): Promise<{
  success: boolean;
  error?: string;
  deletedMemberCount?: number;
  deletedImageCount?: number;
}> {
  const access = await requireSiteAdmin();
  if (!access?.clerkId) {
    return { success: false, error: "Only ADMIN users can delete VAs" };
  }

  const removed = await convex.mutation(api.virtualAirlines.remove, {
    id: id as Id<"virtualAirlines">,
  });

  if (!removed) {
    return { success: false, error: "VA not found" };
  }

  if (removed.imageKeys.length > 0) {
    await utapi.deleteFiles(removed.imageKeys).catch(() => undefined);
  }

  revalidatePath("/admin");
  revalidatePath("/va-admin");
  revalidatePath("/radar");

  return {
    success: true,
    deletedMemberCount: removed.memberCount,
    deletedImageCount: removed.imageCount,
  };
}

export async function getVirtualAirlineFlightContext(
  callsign: string,
  aircraftType: string,
  googleId?: string | null,
): Promise<{
  virtualAirline: VirtualAirline | null;
  image: VirtualAirlineAircraftImage | null;
}> {
  const aircraftTypes = getAircraftTypeLookupCandidates(aircraftType);
  const context = await convex.query(api.virtualAirlines.getFlightContext, {
    callsign,
    aircraftType: normalizeAircraftTypeInput(aircraftType),
    aircraftTypes,
    googleId: googleId ?? undefined,
  });

  return {
    virtualAirline: context.virtualAirline
      ? toVirtualAirline(context.virtualAirline)
      : null,
    image: context.image ? toVirtualAirlineAircraftImage(context.image) : null,
  };
}

export async function getVirtualAirlineMembers(
  virtualAirlineId: string,
): Promise<VirtualAirlineMember[]> {
  const { allowed } = await canManageVirtualAirline(virtualAirlineId);
  if (!allowed) return [];

  const members = await convex.query(api.virtualAirlineMembers.getByVirtualAirlineId, {
    virtualAirlineId: virtualAirlineId as Id<"virtualAirlines">,
  });

  return members.map(toVirtualAirlineMember);
}

export async function addVirtualAirlineMember(data: {
  virtualAirlineId: string;
  userId: string;
}): Promise<{ success: boolean; error?: string; member?: VirtualAirlineMember }> {
  const { access, virtualAirline, allowed } = await canManageVirtualAirline(
    data.virtualAirlineId,
  );
  if (!access.clerkId || !allowed || !virtualAirline) {
    return {
      success: false,
      error: "You can only manage pilots for your assigned VA",
    };
  }

  if (!virtualAirline.isActive) {
    return { success: false, error: "This VA is currently disabled" };
  }

  const user = await convex.query(api.users.getAll, {});
  const selectedUser = user.find((entry) => entry._id === data.userId);

  if (!selectedUser || selectedUser.isDeleted) {
    return { success: false, error: "Pilot not found" };
  }

  if (!selectedUser.googleId) {
    return {
      success: false,
      error: "That pilot does not have a linked Google ID yet",
    };
  }

  const existingMembership = await convex.query(api.virtualAirlineMembers.getByUserId, {
    userId: data.userId as Id<"users">,
  });

  if (
    existingMembership &&
    existingMembership.virtualAirlineId !== data.virtualAirlineId
  ) {
    return {
      success: false,
      error: "That pilot is already assigned to another VA",
    };
  }

  const member = await convex.mutation(api.virtualAirlineMembers.add, {
    virtualAirlineId: data.virtualAirlineId as Id<"virtualAirlines">,
    userId: data.userId as Id<"users">,
    clerkId: selectedUser.clerkId,
    googleId: selectedUser.googleId,
    addedBy: access.clerkId,
  });

  revalidatePath("/admin");
  revalidatePath("/va-admin");
  revalidatePath("/radar");

  if (!member) {
    return { success: false, error: "Failed to add pilot to VA" };
  }

  const refreshedMembers = await convex.query(api.virtualAirlineMembers.getByVirtualAirlineId, {
    virtualAirlineId: data.virtualAirlineId as Id<"virtualAirlines">,
  });
  const refreshedMember =
    refreshedMembers.find((entry) => entry.userId === data.userId) ?? null;

  return {
    success: true,
    member: refreshedMember ? toVirtualAirlineMember(refreshedMember) : undefined,
  };
}

export async function removeVirtualAirlineMember(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const member = await convex.query(api.virtualAirlineMembers.getById, {
    id: id as Id<"virtualAirlineMembers">,
  });

  if (!member) {
    return { success: false, error: "VA pilot not found" };
  }

  const managedAccess = await canManageVirtualAirline(member.virtualAirlineId);
  if (!managedAccess.access.clerkId || !managedAccess.allowed) {
    return {
      success: false,
      error: "You can only manage pilots for your assigned VA",
    };
  }

  const removedMember = await convex.mutation(api.virtualAirlineMembers.remove, {
    id: id as Id<"virtualAirlineMembers">,
  });

  if (!removedMember) {
    return { success: false, error: "VA pilot not found" };
  }

  revalidatePath("/admin");
  revalidatePath("/va-admin");
  revalidatePath("/radar");

  return { success: true };
}

export async function createVirtualAirlineAircraftImage(data: {
  virtualAirlineId: string;
  aircraftType: string;
  imageUrl: string;
  imageKey?: string;
}): Promise<{
  success: boolean;
  error?: string;
  image?: VirtualAirlineAircraftImage;
}> {
  const { access, virtualAirline, allowed } = await canManageVirtualAirline(
    data.virtualAirlineId,
  );

  if (!access.clerkId) {
    return { success: false, error: "You must be signed in" };
  }

  if (!allowed || !virtualAirline) {
    if (data.imageKey) {
      await utapi.deleteFiles(data.imageKey).catch(() => undefined);
    }
    return {
      success: false,
      error: "You can only manage images for your assigned VA",
    };
  }

  if (!virtualAirline.isActive) {
    if (data.imageKey) {
      await utapi.deleteFiles(data.imageKey).catch(() => undefined);
    }
    return {
      success: false,
      error: "This VA is currently disabled",
    };
  }

  const aircraftType = normalizeAircraftTypeInput(data.aircraftType);
  if (!aircraftType) {
    if (data.imageKey) {
      await utapi.deleteFiles(data.imageKey).catch(() => undefined);
    }
    return { success: false, error: "Aircraft type is required" };
  }

  try {
    const result = await convex.mutation(api.virtualAirlineAircraftImages.upsert, {
      virtualAirlineId: data.virtualAirlineId as Id<"virtualAirlines">,
      aircraftType,
      imageUrl: data.imageUrl,
      imageKey: data.imageKey,
      uploadedBy: access.clerkId,
    });

    if (result.replacedImageKey) {
      await utapi.deleteFiles(result.replacedImageKey).catch(() => undefined);
    }

    revalidatePath("/admin");
    revalidatePath("/va-admin");
    revalidatePath("/radar");

    return {
      success: true,
      image: result.image ? toVirtualAirlineAircraftImage(result.image) : undefined,
    };
  } catch (error) {
    console.error("Error creating VA aircraft image:", error);

    if (data.imageKey) {
      await utapi.deleteFiles(data.imageKey).catch(() => undefined);
    }

    return {
      success: false,
      error: "Failed to upload VA aircraft image",
    };
  }
}

export async function deleteVirtualAirlineAircraftImage(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const image = await convex.query(api.virtualAirlineAircraftImages.getById, {
    id: id as Id<"virtualAirlineAircraftImages">,
  });

  if (!image) {
    return { success: false, error: "Image not found" };
  }

  const { allowed } = await canManageVirtualAirline(image.virtualAirlineId);

  if (!allowed) {
    return {
      success: false,
      error: "You can only manage images for your assigned VA",
    };
  }

  if (image.imageKey) {
    await utapi.deleteFiles(image.imageKey).catch(() => undefined);
  }

  await convex.mutation(api.virtualAirlineAircraftImages.remove, {
    id: id as Id<"virtualAirlineAircraftImages">,
  });

  revalidatePath("/admin");
  revalidatePath("/va-admin");
  revalidatePath("/radar");

  return { success: true };
}
