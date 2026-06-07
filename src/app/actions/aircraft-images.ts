"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { Resend } from "resend";
import { api, convex, getAuthenticatedConvex } from "~/server/convex";
import { env } from "~/env";
import type { Id } from "../../../convex/_generated/dataModel";
import { hasEffectiveProAccess } from "~/lib/proAccess";

const utapi = new UTApi();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function sendImageNotificationEmail(
  uploadedBy: string,
  status: "approved" | "rejected",
  imageDetails: {
    airlineIata: string;
    airlineIcao: string;
    aircraftType: string;
  },
  reason?: string,
) {
  if (!resend) return;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(uploadedBy);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return;

    const subject =
      status === "approved"
        ? "Your aircraft image has been approved!"
        : "Your aircraft image was not approved";

    const statusText = status === "approved" ? "approved" : "rejected";
    const statusColor = status === "approved" ? "#10b981" : "#ef4444";

    const reasonHtml =
      status === "rejected" && reason
        ? `<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; color: #991b1b;"><strong>Reason:</strong> ${reason}</p>
        </div>`
        : "";

    await resend.emails.send({
      from: "RadarThing <noreply@radarthing.com>",
      to: email,
      subject,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">Image ${statusText}</h2>
          <p>Your aircraft image submission has been <strong>${statusText}</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Airline:</strong> ${imageDetails.airlineIata} / ${imageDetails.airlineIcao}</p>
            <p style="margin: 4px 0;"><strong>Aircraft:</strong> ${imageDetails.aircraftType}</p>
          </div>
          ${reasonHtml}
          ${
            status === "approved"
              ? "<p>Thank you for contributing to RadarThing!</p>"
              : "<p>Feel free to submit another image that better meets our guidelines.</p>"
          }
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}

export interface AircraftImage {
  id: string;
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  imageUrl: string;
  imageKey: string | null;
  discordUsername: string | null;
  isMilitary: boolean;
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
  discordUsername: string | null;
  isMilitary?: boolean;
  isApproved: boolean;
  uploadedBy: string;
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
  updatedAt: number;
}): AircraftImage {
  const isMilitary = (img.isMilitary ?? false) || img.airlineIata === "MIL";

  return {
    id: img.id,
    airlineIata: img.airlineIata,
    airlineIcao: img.airlineIcao,
    aircraftType: img.aircraftType,
    imageUrl: img.imageUrl,
    imageKey: img.imageKey,
    discordUsername: img.discordUsername,
    isMilitary,
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

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return false;

  // Admin or PRO role
  if (hasEffectiveProAccess(user)) return true;

  // Fallback: env-based super admin
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  return Boolean(superAdminGoogleId && user.googleId === superAdminGoogleId);
}

async function isAdminUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return false;

  // Role-based admin
  if (user.role === "ADMIN") return true;

  // Fallback: env-based super admin
  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  return Boolean(superAdminGoogleId && user.googleId === superAdminGoogleId);
}

async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

function normalizeAircraftTypeInput(aircraftType: string): string {
  const cleaned = aircraftType.trim().toUpperCase();
  const atrMatch = /\bATR?[\s-]?(\d{2})\b/.exec(cleaned);
  if (atrMatch) return `ATR${atrMatch[1]}`;
  const poseidonMatch = /\bP-?8(?:I)?\b/.exec(cleaned);
  if (poseidonMatch) return "P8";
  const ilyushinMatch = /\bIL-?76(?:[A-Z0-9-]*)/.exec(cleaned);
  if (ilyushinMatch) return "IL76";
  const antonovMatch = /\bAN-?(\d{2,3})\b/.exec(cleaned);
  if (antonovMatch) return `AN${antonovMatch[1]}`;
  return cleaned;
}

// Get approved image for display (used by the hook)
// airlineCode can be either IATA (2-letter) or ICAO (3-letter)
export async function getAircraftImage(
  airlineCode: string,
  aircraftType: string,
): Promise<AircraftImage | null> {
  try {
    const image = await convex.query(api.aircraftImages.getApprovedImage, {
      airlineCode,
      aircraftType: normalizeAircraftTypeInput(aircraftType),
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
    const authedConvex = await getAuthenticatedConvex();
    const images = await authedConvex.query(api.aircraftImages.getPending, {});
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
    const authedConvex = await getAuthenticatedConvex();
    const images = await authedConvex.query(api.aircraftImages.getAll, {});
    return images.map(toAircraftImage);
  } catch (error) {
    console.error("Error fetching aircraft images:", error);
    return [];
  }
}

// Check upload eligibility before uploading to UploadThing (anyone signed in)
// Returns validation errors if any, otherwise indicates upload can proceed
export async function validateUploadEligibility(data: {
  airlineIata: string;
  airlineIcao: string;
  aircraftType: string;
  isMilitary?: boolean;
}): Promise<{ canUpload: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      canUpload: false,
      error: "You must be signed in to upload images",
    };
  }

  // Validate aircraft type
  if (!data.aircraftType) {
    return { canUpload: false, error: "Aircraft type is required" };
  }

  const aircraftType = normalizeAircraftTypeInput(data.aircraftType);

  let iata: string;
  let icao: string;

  if (data.isMilitary) {
    // Military: only AF name (stored as ICAO) is required
    if (!data.airlineIcao) {
      return {
        canUpload: false,
        error: "Air force name is required (e.g., USAF, PAF)",
      };
    }
    iata = "MIL";
    icao = data.airlineIcao.trim().toUpperCase();
  } else {
    // Commercial: both IATA and ICAO are required
    if (!data.airlineIata || !data.airlineIcao) {
      return {
        canUpload: false,
        error: "Both IATA and ICAO airline codes are required",
      };
    }

    iata = data.airlineIata.trim().toUpperCase();
    icao = data.airlineIcao.trim().toUpperCase();

    if (iata.length < 1 || iata.length > 2) {
      return { canUpload: false, error: "IATA code must be 1-2 characters" };
    }
    if (icao.length < 3 || icao.length > 4) {
      return {
        canUpload: false,
        error: "ICAO code must be 3-4 characters",
      };
    }
  }

  try {
    // Check eligibility
    const eligibility = await convex.query(
      api.aircraftImages.checkUploadEligibility,
      {
        airlineIata: iata,
        airlineIcao: icao,
        aircraftType,
        uploadedBy: userId,
      },
    );

    if (eligibility.approvedExists) {
      return {
        canUpload: false,
        error:
          "An approved image already exists for this airline + aircraft combination",
      };
    }

    if (eligibility.pendingByUserExists) {
      return {
        canUpload: false,
        error: "You already have a pending image for this combination",
      };
    }

    return { canUpload: true };
  } catch (error) {
    console.error("Error validating upload eligibility:", error);
    return { canUpload: false, error: "Failed to validate upload eligibility" };
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
  discordUsername?: string;
  isMilitary?: boolean;
}): Promise<{ success: boolean; error?: string; image?: AircraftImage }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in to upload images" };
  }

  // Validate codes based on military flag
  if (data.isMilitary) {
    if (!data.airlineIcao) {
      return { success: false, error: "Air force name is required" };
    }
  } else {
    if (!data.airlineIata || !data.airlineIcao) {
      return {
        success: false,
        error: "Both IATA and ICAO airline codes are required",
      };
    }
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    const aircraftType = normalizeAircraftTypeInput(data.aircraftType);
    const airlineIata = data.isMilitary ? "MIL" : data.airlineIata;
    const airlineIcao = data.airlineIcao;

    // Check eligibility in a single query (combines checkApprovedExists and checkPendingByUser)
    const eligibility = await convex.query(
      api.aircraftImages.checkUploadEligibility,
      {
        airlineIata,
        airlineIcao,
        aircraftType,
        uploadedBy: userId,
      },
    );

    if (eligibility.approvedExists) {
      // Delete the uploaded image from UploadThing to prevent duplicates
      if (data.imageKey) {
        try {
          await utapi.deleteFiles(data.imageKey);
        } catch (e) {
          console.error(
            "Failed to delete duplicate image from UploadThing:",
            e,
          );
        }
      }
      return {
        success: false,
        error:
          "An approved image already exists for this airline + aircraft combination",
      };
    }

    if (eligibility.pendingByUserExists) {
      // Delete the uploaded image from UploadThing to prevent duplicates
      if (data.imageKey) {
        try {
          await utapi.deleteFiles(data.imageKey);
        } catch (e) {
          console.error(
            "Failed to delete duplicate image from UploadThing:",
            e,
          );
        }
      }
      return {
        success: false,
        error: "You already have a pending image for this combination",
      };
    }

    const image = await authedConvex.mutation(api.aircraftImages.create, {
      airlineIata,
      airlineIcao,
      aircraftType,
      imageUrl: data.imageUrl,
      imageKey: data.imageKey,
      discordUsername: data.discordUsername,
      isMilitary: data.isMilitary || undefined,
      uploadedBy: userId,
    });

    // Auto-approve if uploaded by admin
    const isAdmin = await isAdminUser();
    if (isAdmin && image) {
      await authedConvex.mutation(api.aircraftImages.approve, {
        id: image.id as Id<"aircraftImages">,
        approvedBy: userId,
      });
      // Refetch the approved image
      const approvedImage = await convex.query(api.aircraftImages.getById, {
        id: image.id as Id<"aircraftImages">,
      });
      revalidatePath("/aircraft-images");
      revalidatePath("/admin");
      return {
        success: true,
        image: approvedImage ? toAircraftImage(approvedImage) : undefined,
      };
    }

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");
    return {
      success: true,
      image: image ? toAircraftImage(image) : undefined,
    };
  } catch (error) {
    console.error("Error creating aircraft image:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

// Check if approving an image would cause a conflict with existing approved image
export async function checkApprovalConflict(id: string): Promise<{
  hasConflict: boolean;
  pendingImage?: AircraftImage;
  existingImage?: AircraftImage;
  error?: string;
}> {
  const admin = await isAdminUser();
  if (!admin) {
    return {
      hasConflict: false,
      error: "Only ADMIN users can check conflicts",
    };
  }

  try {
    // Get the pending image
    const pendingImage = await convex.query(api.aircraftImages.getById, {
      id: id as Id<"aircraftImages">,
    });

    if (!pendingImage) {
      return { hasConflict: false, error: "Image not found" };
    }

    // Check if there's already an approved image for this combination
    const existingApproved = await convex.query(
      api.aircraftImages.findExistingApprovedFull,
      {
        airlineIata: pendingImage.airlineIata,
        airlineIcao: pendingImage.airlineIcao,
        aircraftType: pendingImage.aircraftType,
        excludeId: id as Id<"aircraftImages">,
      },
    );

    if (existingApproved) {
      return {
        hasConflict: true,
        pendingImage: toAircraftImage(pendingImage),
        existingImage: toAircraftImage(existingApproved),
      };
    }

    return { hasConflict: false, pendingImage: toAircraftImage(pendingImage) };
  } catch (error) {
    console.error("Error checking approval conflict:", error);
    return { hasConflict: false, error: "Failed to check for conflicts" };
  }
}

// Resolve image conflict - admin chooses which image to keep
export async function resolveImageConflict(
  keepImageId: string,
  removeImageId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can resolve conflicts" };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    // Get both images
    const keepImage = await convex.query(api.aircraftImages.getById, {
      id: keepImageId as Id<"aircraftImages">,
    });

    const removeImage = await convex.query(api.aircraftImages.getById, {
      id: removeImageId as Id<"aircraftImages">,
    });

    if (!keepImage || !removeImage) {
      return { success: false, error: "One or both images not found" };
    }

    // Delete the image to remove from UploadThing
    if (removeImage.imageKey) {
      try {
        await utapi.deleteFiles(removeImage.imageKey);
      } catch (e) {
        console.error("Failed to delete image from UploadThing:", e);
      }
    }

    // Send rejection email to the uploader of the removed image (only if it was pending)
    if (!removeImage.isApproved) {
      await sendImageNotificationEmail(
        removeImage.uploadedBy,
        "rejected",
        {
          airlineIata: removeImage.airlineIata,
          airlineIcao: removeImage.airlineIcao,
          aircraftType: removeImage.aircraftType,
        },
        "Another image was chosen for this airline + aircraft combination",
      );
    }

    // Delete the image to remove from DB
    await authedConvex.mutation(api.aircraftImages.remove, {
      id: removeImageId as Id<"aircraftImages">,
      actorClerkId: userId,
      action: "delete",
      reason: "Conflict resolved with another image",
    });

    // If keeping the pending image, approve it
    if (!keepImage.isApproved) {
      await authedConvex.mutation(api.aircraftImages.approve, {
        id: keepImageId as Id<"aircraftImages">,
        approvedBy: userId,
      });

      // Send approval email
      await sendImageNotificationEmail(keepImage.uploadedBy, "approved", {
        airlineIata: keepImage.airlineIata,
        airlineIcao: keepImage.airlineIcao,
        aircraftType: keepImage.aircraftType,
      });
    }

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error resolving image conflict:", error);
    return { success: false, error: "Failed to resolve conflict" };
  }
}

// Approve image (ADMIN only) - returns hasConflict if there's an existing approved image
export async function approveAircraftImage(
  id: string,
): Promise<{ success: boolean; error?: string; hasConflict?: boolean }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can approve images" };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
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
      },
    );

    // If there's an existing approved image, return conflict flag
    if (existingApproved) {
      return { success: false, hasConflict: true };
    }

    // Approve the new image (no conflict)
    await authedConvex.mutation(api.aircraftImages.approve, {
      id: id as Id<"aircraftImages">,
      approvedBy: userId,
    });

    // Send approval notification email
    await sendImageNotificationEmail(imageToApprove.uploadedBy, "approved", {
      airlineIata: imageToApprove.airlineIata,
      airlineIcao: imageToApprove.airlineIcao,
      aircraftType: imageToApprove.aircraftType,
    });

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error approving aircraft image:", error);
    return { success: false, error: "Failed to approve image" };
  }
}

// Reject/delete pending image (ADMIN only)
export async function rejectAircraftImage(
  id: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can reject images" };
  }

  if (!reason.trim()) {
    return { success: false, error: "Please provide a reason for rejection" };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

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

    // Send rejection notification email before deleting
    await sendImageNotificationEmail(
      image.uploadedBy,
      "rejected",
      {
        airlineIata: image.airlineIata,
        airlineIcao: image.airlineIcao,
        aircraftType: image.aircraftType,
      },
      reason,
    );

    await authedConvex.mutation(api.aircraftImages.remove, {
      id: id as Id<"aircraftImages">,
      actorClerkId: userId,
      action: "reject",
      reason,
    });

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting aircraft image:", error);
    return { success: false, error: "Failed to reject image" };
  }
}

// Delete approved image (ADMIN only)
export async function deleteAircraftImage(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can delete images" };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

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

    await authedConvex.mutation(api.aircraftImages.remove, {
      id: id as Id<"aircraftImages">,
      actorClerkId: userId,
      action: "delete",
    });

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error deleting aircraft image:", error);
    return { success: false, error: "Failed to delete image" };
  }
}

// Get user info by Clerk IDs (ADMIN only)
export async function getUserInfoByIds(
  userIds: string[],
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
        name: user.firstName
          ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
          : null,
      };
    } catch {
      result[userId] = { email: "Unknown", name: null };
    }
  }

  return result;
}

// Bulk approve images (ADMIN only) - uses batch mutation for efficiency
export async function bulkApproveAircraftImages(
  ids: string[],
): Promise<{ success: boolean; approved: number; failed: number }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, approved: 0, failed: ids.length };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, approved: 0, failed: ids.length };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    // Get image details before approval (for notifications)
    const images = await Promise.all(
      ids.map((id) =>
        convex.query(api.aircraftImages.getById, {
          id: id as Id<"aircraftImages">,
        }),
      ),
    );

    // Single batch mutation for all approvals
    const results = await authedConvex.mutation(
      api.aircraftImages.bulkApprove,
      {
        ids: ids as Id<"aircraftImages">[],
        approvedBy: userId,
      },
    );

    // Delete old images from UploadThing and send emails
    const deletePromises: Promise<void>[] = [];
    const emailPromises: Promise<void>[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const image = images[i];

      if (result?.success) {
        // Delete old image from UploadThing if replaced
        if (result.existingImageKey) {
          deletePromises.push(
            utapi.deleteFiles(result.existingImageKey).catch((e) => {
              console.error("Failed to delete old image from UploadThing:", e);
            }) as Promise<void>,
          );
        }

        // Send approval email
        if (image) {
          emailPromises.push(
            sendImageNotificationEmail(image.uploadedBy, "approved", {
              airlineIata: image.airlineIata,
              airlineIcao: image.airlineIcao,
              aircraftType: image.aircraftType,
            }),
          );
        }
      }
    }

    // Execute all side effects in parallel
    await Promise.all([...deletePromises, ...emailPromises]);

    const approved = results.filter((r) => r?.success).length;
    const failed = results.filter((r) => !r?.success).length;

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");

    return { success: failed === 0, approved, failed };
  } catch (error) {
    console.error("Error bulk approving aircraft images:", error);
    return { success: false, approved: 0, failed: ids.length };
  }
}

// Update IATA/ICAO/aircraft type for an image (ADMIN only)
export async function updateAircraftImageCodes(
  id: string,
  newIata: string,
  newIcao: string,
  newAircraftType: string,
  isMilitary?: boolean,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return {
      success: false,
      error: "Only ADMIN users can update image details",
    };
  }

  // Validate details
  const effectiveIsMilitary =
    Boolean(isMilitary) || newIata.trim().toUpperCase() === "MIL";
  const iata = effectiveIsMilitary ? "MIL" : newIata.trim().toUpperCase();
  const icao = newIcao.trim().toUpperCase();
  const aircraftType = normalizeAircraftTypeInput(newAircraftType);

  if (!effectiveIsMilitary && (iata.length < 1 || iata.length > 2)) {
    return { success: false, error: "IATA code must be 1-2 characters" };
  }
  if (effectiveIsMilitary && !icao) {
    return { success: false, error: "Air force name is required" };
  }
  if (!effectiveIsMilitary && (icao.length < 3 || icao.length > 4)) {
    return { success: false, error: "ICAO code must be 3-4 characters" };
  }
  if (!aircraftType) {
    return { success: false, error: "Aircraft type is required" };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Update the database
    const result = await authedConvex.mutation(api.aircraftImages.updateCodes, {
      id: id as Id<"aircraftImages">,
      airlineIata: iata,
      airlineIcao: icao,
      aircraftType,
      isMilitary: effectiveIsMilitary || undefined,
      actorClerkId: userId,
    });

    if (!result) {
      return { success: false, error: "Image not found" };
    }

    // Rename the file in UploadThing if it has a key
    // File naming format: {IATA}-{ICAO}-{aircraftType}.{extension}
    if (result.imageKey) {
      try {
        // Extract the extension from the current filename
        const keyParts = result.imageKey.split("_");
        const filename =
          keyParts.length > 1 ? keyParts.slice(1).join("_") : result.imageKey;
        const extension = filename.split(".").pop() || "jpg";

        const newFileName = `${iata}-${icao}-${result.aircraftType}.${extension}`;

        await utapi.renameFiles({
          fileKey: result.imageKey,
          newName: newFileName,
        });
      } catch (e) {
        // Non-critical - file rename failed but DB is updated
        console.error("Failed to rename file in UploadThing:", e);
      }
    }

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error updating aircraft image codes:", error);
    return { success: false, error: "Failed to update image details" };
  }
}

// Bulk reject images (ADMIN only) - uses batch mutation for efficiency
export async function bulkRejectAircraftImages(
  ids: string[],
  reason: string,
): Promise<{ success: boolean; rejected: number; failed: number }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, rejected: 0, failed: ids.length };
  }

  if (!reason.trim()) {
    return { success: false, rejected: 0, failed: ids.length };
  }

  try {
    const authedConvex = await getAuthenticatedConvex();
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, rejected: 0, failed: ids.length };
    }

    // Single batch mutation to delete all images and get their details
    const results = await authedConvex.mutation(api.aircraftImages.bulkRemove, {
      ids: ids as Id<"aircraftImages">[],
      actorClerkId: userId,
      action: "reject",
      reason,
    });

    // Delete from UploadThing and send rejection emails
    const deletePromises: Promise<void>[] = [];
    const emailPromises: Promise<void>[] = [];

    for (const result of results) {
      if (result.success) {
        // Delete from UploadThing
        if (result.imageKey) {
          deletePromises.push(
            utapi.deleteFiles(result.imageKey).catch((e) => {
              console.error("Failed to delete image from UploadThing:", e);
            }) as Promise<void>,
          );
        }

        // Send rejection email
        if (
          result.uploadedBy &&
          result.airlineIata &&
          result.airlineIcao &&
          result.aircraftType
        ) {
          emailPromises.push(
            sendImageNotificationEmail(
              result.uploadedBy,
              "rejected",
              {
                airlineIata: result.airlineIata,
                airlineIcao: result.airlineIcao,
                aircraftType: result.aircraftType,
              },
              reason,
            ),
          );
        }
      }
    }

    // Execute all side effects in parallel
    await Promise.all([...deletePromises, ...emailPromises]);

    const rejected = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");

    return { success: failed === 0, rejected, failed };
  } catch (error) {
    console.error("Error bulk rejecting aircraft images:", error);
    return { success: false, rejected: 0, failed: ids.length };
  }
}
