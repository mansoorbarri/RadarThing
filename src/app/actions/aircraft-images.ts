"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { Resend } from "resend";
import { convex, api } from "~/server/convex";
import { env } from "~/env";
import type { Id } from "../../../convex/_generated/dataModel";

const utapi = new UTApi();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Notify SSE server to delete Discord notification when image is uploaded
async function notifyImageUploaded(airlineIata: string, airlineIcao: string, aircraftType: string) {
  try {
    // Try both IATA and ICAO codes since flight numbers use either
    await Promise.all([
      fetch("https://sse.radarthing.com/api/image-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airlineCode: airlineIata, aircraftType }),
      }),
      fetch("https://sse.radarthing.com/api/image-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airlineCode: airlineIcao, aircraftType }),
      }),
    ]);
  } catch (error) {
    // Non-critical, don't fail the approval
    console.error("Failed to notify SSE server:", error);
  }
}

async function sendImageNotificationEmail(
  uploadedBy: string,
  status: "approved" | "rejected",
  imageDetails: { airlineIata: string; airlineIcao: string; aircraftType: string },
  reason?: string
) {
  if (!resend) return;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(uploadedBy);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return;

    const subject = status === "approved"
      ? "Your aircraft image has been approved!"
      : "Your aircraft image was not approved";

    const statusText = status === "approved" ? "approved" : "rejected";
    const statusColor = status === "approved" ? "#10b981" : "#ef4444";

    const reasonHtml = status === "rejected" && reason
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
          ${status === "approved"
            ? "<p>Thank you for contributing to RadarThing!</p>"
            : "<p>Feel free to submit another image that better meets our guidelines.</p>"}
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
    discordUsername: img.discordUsername,
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
  if (user.role === "ADMIN" || user.role === "PRO") return true;

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
  discordUsername?: string;
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
    // Check eligibility in a single query (combines checkApprovedExists and checkPendingByUser)
    const eligibility = await convex.query(
      api.aircraftImages.checkUploadEligibility,
      {
        airlineIata: data.airlineIata,
        airlineIcao: data.airlineIcao,
        aircraftType: data.aircraftType,
        uploadedBy: userId,
      }
    );

    if (eligibility.approvedExists) {
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

    if (eligibility.pendingByUserExists) {
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
      discordUsername: data.discordUsername,
      uploadedBy: userId,
    });

    // Auto-approve if uploaded by admin
    const isAdmin = await isAdminUser();
    if (isAdmin && image) {
      await convex.mutation(api.aircraftImages.approve, {
        id: image.id as Id<"aircraftImages">,
        approvedBy: userId,
      });
      // Notify SSE server to delete Discord "missing image" notification
      await notifyImageUploaded(data.airlineIata, data.airlineIcao, data.aircraftType);
      // Remove from missingImageNotifications table (try both IATA and ICAO)
      await Promise.all([
        convex.mutation(api.missingImageNotifications.remove, {
          airlineCode: data.airlineIata,
          aircraftType: data.aircraftType,
        }),
        convex.mutation(api.missingImageNotifications.remove, {
          airlineCode: data.airlineIcao,
          aircraftType: data.aircraftType,
        }),
      ]);
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

    // Notify SSE server to delete Discord "missing image" notification
    await notifyImageUploaded(imageToApprove.airlineIata, imageToApprove.airlineIcao, imageToApprove.aircraftType);

    // Remove from missingImageNotifications table (try both IATA and ICAO)
    await Promise.all([
      convex.mutation(api.missingImageNotifications.remove, {
        airlineCode: imageToApprove.airlineIata,
        aircraftType: imageToApprove.aircraftType,
      }),
      convex.mutation(api.missingImageNotifications.remove, {
        airlineCode: imageToApprove.airlineIcao,
        aircraftType: imageToApprove.aircraftType,
      }),
    ]);

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
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can reject images" };
  }

  if (!reason.trim()) {
    return { success: false, error: "Please provide a reason for rejection" };
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

    // Send rejection notification email before deleting
    await sendImageNotificationEmail(image.uploadedBy, "rejected", {
      airlineIata: image.airlineIata,
      airlineIcao: image.airlineIcao,
      aircraftType: image.aircraftType,
    }, reason);

    await convex.mutation(api.aircraftImages.remove, {
      id: id as Id<"aircraftImages">,
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
    revalidatePath("/admin");
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

// Bulk approve images (ADMIN only) - uses batch mutation for efficiency
export async function bulkApproveAircraftImages(
  ids: string[]
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
    // Get image details before approval (for notifications)
    const images = await Promise.all(
      ids.map(id => convex.query(api.aircraftImages.getById, { id: id as Id<"aircraftImages"> }))
    );

    // Single batch mutation for all approvals
    const results = await convex.mutation(api.aircraftImages.bulkApprove, {
      ids: ids as Id<"aircraftImages">[],
      approvedBy: userId,
    });

    // Delete old images from UploadThing and send notifications
    const deletePromises: Promise<void>[] = [];
    const notifyPromises: Promise<void>[] = [];
    const emailPromises: Promise<void>[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const image = images[i];

      if (result?.success) {
        // Delete old image from UploadThing if replaced
        if (result.existingImageKey) {
          deletePromises.push(
            utapi.deleteFiles(result.existingImageKey).catch(e => {
              console.error("Failed to delete old image from UploadThing:", e);
            }) as Promise<void>
          );
        }

        // Notify SSE server, clean up notifications, and send email
        if (image) {
          notifyPromises.push(
            notifyImageUploaded(image.airlineIata, image.airlineIcao, image.aircraftType)
          );
          // Remove from missingImageNotifications table (try both IATA and ICAO)
          notifyPromises.push(
            convex.mutation(api.missingImageNotifications.remove, {
              airlineCode: image.airlineIata,
              aircraftType: image.aircraftType,
            }).then(() => undefined)
          );
          notifyPromises.push(
            convex.mutation(api.missingImageNotifications.remove, {
              airlineCode: image.airlineIcao,
              aircraftType: image.aircraftType,
            }).then(() => undefined)
          );
          emailPromises.push(
            sendImageNotificationEmail(image.uploadedBy, "approved", {
              airlineIata: image.airlineIata,
              airlineIcao: image.airlineIcao,
              aircraftType: image.aircraftType,
            })
          );
        }
      }
    }

    // Execute all side effects in parallel
    await Promise.all([...deletePromises, ...notifyPromises, ...emailPromises]);

    const approved = results.filter(r => r?.success).length;
    const failed = results.filter(r => !r?.success).length;

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");

    return { success: failed === 0, approved, failed };
  } catch (error) {
    console.error("Error bulk approving aircraft images:", error);
    return { success: false, approved: 0, failed: ids.length };
  }
}

// Bulk reject images (ADMIN only) - uses batch mutation for efficiency
export async function bulkRejectAircraftImages(
  ids: string[],
  reason: string
): Promise<{ success: boolean; rejected: number; failed: number }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, rejected: 0, failed: ids.length };
  }

  if (!reason.trim()) {
    return { success: false, rejected: 0, failed: ids.length };
  }

  try {
    // Single batch mutation to delete all images and get their details
    const results = await convex.mutation(api.aircraftImages.bulkRemove, {
      ids: ids as Id<"aircraftImages">[],
    });

    // Delete from UploadThing and send rejection emails
    const deletePromises: Promise<void>[] = [];
    const emailPromises: Promise<void>[] = [];

    for (const result of results) {
      if (result.success) {
        // Delete from UploadThing
        if (result.imageKey) {
          deletePromises.push(
            utapi.deleteFiles(result.imageKey).catch(e => {
              console.error("Failed to delete image from UploadThing:", e);
            }) as Promise<void>
          );
        }

        // Send rejection email
        if (result.uploadedBy && result.airlineIata && result.airlineIcao && result.aircraftType) {
          emailPromises.push(
            sendImageNotificationEmail(result.uploadedBy, "rejected", {
              airlineIata: result.airlineIata,
              airlineIcao: result.airlineIcao,
              aircraftType: result.aircraftType,
            }, reason)
          );
        }
      }
    }

    // Execute all side effects in parallel
    await Promise.all([...deletePromises, ...emailPromises]);

    const rejected = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    revalidatePath("/aircraft-images");
    revalidatePath("/admin");

    return { success: failed === 0, rejected, failed };
  } catch (error) {
    console.error("Error bulk rejecting aircraft images:", error);
    return { success: false, rejected: 0, failed: ids.length };
  }
}
