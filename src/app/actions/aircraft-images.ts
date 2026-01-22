"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { convex, api } from "~/server/convex";
import type { Id } from "../../../convex/_generated/dataModel";

const utapi = new UTApi();

export interface AircraftImage {
  id: string;
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  imageUrl: string;
  imageKey: string | null;
  photographer: string | null;
  isApproved: boolean;
  uploadedBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to convert Convex response (timestamps) to AircraftImage (Dates)
function toAircraftImage(img: {
  id: string;
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  imageUrl: string;
  imageKey: string | null;
  photographer: string | null;
  isApproved: boolean;
  uploadedBy: string;
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): AircraftImage {
  return {
    id: img.id,
    airlineIata: img.airlineIata,
    airlineIcao: img.airlineIcao,
    aircraftType: img.aircraftType,
    imageUrl: img.imageUrl,
    imageKey: img.imageKey,
    photographer: img.photographer,
    isApproved: img.isApproved,
    uploadedBy: img.uploadedBy,
    approvedBy: img.approvedBy,
    approvedAt: img.approvedAt ? new Date(img.approvedAt) : null,
    createdAt: new Date(img.createdAt),
    updatedAt: new Date(img.updatedAt),
  };
}

async function isProUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  return await convex.query(api.users.isPro, { clerkId: userId });
}

async function isAdminUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  return await convex.query(api.users.isAdmin, { clerkId: userId });
}

async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

// Get approved image for display (used by the hook)
// airlineCode can be either IATA (2-letter) or ICAO (3-letter)
export async function getAircraftImage(
  airlineCode: string,
  aircraftType: string
): Promise<AircraftImage | null> {
  try {
    const image = await convex.query(api.aircraftImages.getApprovedImage, {
      airlineCode,
      aircraftType,
    });
    if (!image) return null;
    return toAircraftImage(image);
  } catch (error) {
    console.error("Error fetching aircraft image:", error);
    return null;
  }
}

// Get all approved images (public)
export async function getApprovedAircraftImages(): Promise<AircraftImage[]> {
  try {
    const images = await convex.query(api.aircraftImages.getApproved, {});
    return images.map(toAircraftImage);
  } catch (error) {
    console.error("Error fetching approved aircraft images:", error);
    return [];
  }
}

// Get pending images for approval (ADMIN only)
export async function getPendingAircraftImages(): Promise<AircraftImage[]> {
  const admin = await isAdminUser();
  if (!admin) return [];

  try {
    const images = await convex.query(api.aircraftImages.getPending, {});
    return images.map(toAircraftImage);
  } catch (error) {
    console.error("Error fetching pending aircraft images:", error);
    return [];
  }
}

// Get all images (ADMIN only - for admin view)
export async function getAllAircraftImages(): Promise<AircraftImage[]> {
  const admin = await isAdminUser();
  if (!admin) return [];

  try {
    const images = await convex.query(api.aircraftImages.getAll, {});
    return images.map(toAircraftImage);
  } catch (error) {
    console.error("Error fetching aircraft images:", error);
    return [];
  }
}

// Upload/create image (anyone signed in)
// Both airlineIata and airlineIcao are required
export async function createAircraftImage(data: {
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  imageUrl: string;
  imageKey?: string;
  photographer?: string;
}): Promise<{ success: boolean; error?: string; image?: AircraftImage }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in to upload images" };
  }

  // Validate both airline codes are provided
  if (!data.airlineIata || !data.airlineIcao) {
    return {
      success: false,
      error: "Both IATA and ICAO airline codes are required",
    };
  }

  try {
    // Check if an approved image already exists for this combination
    const existingApproved = await convex.query(
      api.aircraftImages.checkApprovedExists,
      {
        airlineIata: data.airlineIata,
        airlineIcao: data.airlineIcao,
        aircraftType: data.aircraftType,
      }
    );

    if (existingApproved) {
      // Delete the uploaded image from UploadThing to prevent duplicates
      if (data.imageKey) {
        try {
          await utapi.deleteFiles(data.imageKey);
        } catch (e) {
          console.error("Failed to delete duplicate image from UploadThing:", e);
        }
      }
      return {
        success: false,
        error:
          "An approved image already exists for this airline + aircraft combination",
      };
    }

    // Check if user already has a pending image for this combination
    const existingPending = await convex.query(
      api.aircraftImages.checkPendingByUser,
      {
        airlineIata: data.airlineIata,
        airlineIcao: data.airlineIcao,
        aircraftType: data.aircraftType,
        uploadedBy: userId,
      }
    );

    if (existingPending) {
      // Delete the uploaded image from UploadThing to prevent duplicates
      if (data.imageKey) {
        try {
          await utapi.deleteFiles(data.imageKey);
        } catch (e) {
          console.error("Failed to delete duplicate image from UploadThing:", e);
        }
      }
      return {
        success: false,
        error: "You already have a pending image for this combination",
      };
    }

    const image = await convex.mutation(api.aircraftImages.create, {
      airlineIata: data.airlineIata,
      airlineIcao: data.airlineIcao,
      aircraftType: data.aircraftType,
      imageUrl: data.imageUrl,
      imageKey: data.imageKey,
      photographer: data.photographer,
      uploadedBy: userId,
    });

    // Auto-approve if uploaded by admin
    const isAdmin = await isAdminUser();
    if (isAdmin && image) {
      await convex.mutation(api.aircraftImages.approve, {
        id: image.id as Id<"aircraftImages">,
        approvedBy: userId,
      });
      // Refetch the approved image
      const approvedImage = await convex.query(api.aircraftImages.getById, {
        id: image.id as Id<"aircraftImages">,
      });
      revalidatePath("/aircraft-images");
      revalidatePath("/admin/aircraft-images");
      return {
        success: true,
        image: approvedImage ? toAircraftImage(approvedImage) : undefined,
      };
    }

    revalidatePath("/aircraft-images");
    revalidatePath("/admin/aircraft-images");
    return {
      success: true,
      image: image ? toAircraftImage(image) : undefined,
    };
  } catch (error) {
    console.error("Error creating aircraft image:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

// Approve image (ADMIN only)
export async function approveAircraftImage(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can approve images" };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get the image to approve
    const imageToApprove = await convex.query(api.aircraftImages.getById, {
      id: id as Id<"aircraftImages">,
    });

    if (!imageToApprove) {
      return { success: false, error: "Image not found" };
    }

    // Check if there's already an approved image for this combination
    const existingApproved = await convex.query(
      api.aircraftImages.findExistingApproved,
      {
        airlineIata: imageToApprove.airlineIata,
        airlineIcao: imageToApprove.airlineIcao,
        aircraftType: imageToApprove.aircraftType,
        excludeId: id as Id<"aircraftImages">,
      }
    );

    // If there's an existing approved image, delete it first
    if (existingApproved) {
      if (existingApproved.imageKey) {
        try {
          await utapi.deleteFiles(existingApproved.imageKey);
        } catch (e) {
          console.error("Failed to delete old image from UploadThing:", e);
        }
      }
      await convex.mutation(api.aircraftImages.remove, {
        id: existingApproved.id as Id<"aircraftImages">,
      });
    }

    // Approve the new image
    await convex.mutation(api.aircraftImages.approve, {
      id: id as Id<"aircraftImages">,
      approvedBy: userId,
    });

    revalidatePath("/aircraft-images");
    revalidatePath("/admin/aircraft-images");
    return { success: true };
  } catch (error) {
    console.error("Error approving aircraft image:", error);
    return { success: false, error: "Failed to approve image" };
  }
}

// Reject/delete pending image (ADMIN only)
export async function rejectAircraftImage(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can reject images" };
  }

  try {
    const image = await convex.query(api.aircraftImages.getById, {
      id: id as Id<"aircraftImages">,
    });

    if (!image) {
      return { success: false, error: "Image not found" };
    }

    // Delete from UploadThing if it has a key
    if (image.imageKey) {
      try {
        await utapi.deleteFiles(image.imageKey);
      } catch (e) {
        console.error("Failed to delete image from UploadThing:", e);
      }
    }

    await convex.mutation(api.aircraftImages.remove, {
      id: id as Id<"aircraftImages">,
    });

    revalidatePath("/aircraft-images");
    revalidatePath("/admin/aircraft-images");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting aircraft image:", error);
    return { success: false, error: "Failed to reject image" };
  }
}

// Delete approved image (ADMIN only)
export async function deleteAircraftImage(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can delete images" };
  }

  try {
    const image = await convex.query(api.aircraftImages.getById, {
      id: id as Id<"aircraftImages">,
    });

    if (!image) {
      return { success: false, error: "Image not found" };
    }

    // Delete from UploadThing if it has a key
    if (image.imageKey) {
      try {
        await utapi.deleteFiles(image.imageKey);
      } catch (e) {
        console.error("Failed to delete image from UploadThing:", e);
      }
    }

    await convex.mutation(api.aircraftImages.remove, {
      id: id as Id<"aircraftImages">,
    });

    revalidatePath("/aircraft-images");
    revalidatePath("/admin/aircraft-images");
    return { success: true };
  } catch (error) {
    console.error("Error deleting aircraft image:", error);
    return { success: false, error: "Failed to delete image" };
  }
}

// Get user info by Clerk IDs (ADMIN only)
export async function getUserInfoByIds(
  userIds: string[]
): Promise<Record<string, { email: string; name: string | null }>> {
  const admin = await isAdminUser();
  if (!admin) return {};

  const result: Record<string, { email: string; name: string | null }> = {};
  const client = await clerkClient();

  // Fetch users in batches to avoid rate limits
  const uniqueIds = [...new Set(userIds)];

  for (const userId of uniqueIds) {
    try {
      const user = await client.users.getUser(userId);
      result[userId] = {
        email: user.emailAddresses[0]?.emailAddress ?? "Unknown",
        name: user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : null,
      };
    } catch {
      result[userId] = { email: "Unknown", name: null };
    }
  }

  return result;
}
