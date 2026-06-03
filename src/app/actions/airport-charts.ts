"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UTApi } from "uploadthing/server";
import { Resend } from "resend";
import { convex, api } from "~/server/convex";
import { env } from "~/env";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ChartType, ChartSource } from "~/types/airportCharts";

const utapi = new UTApi();
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function sendChartNotificationEmail(
  uploadedBy: string,
  status: "approved" | "rejected",
  chartDetails: { icao: string; chartType: string; chartName: string },
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
        ? "Your airport chart has been approved!"
        : "Your airport chart was not approved";

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
          <h2 style="color: ${statusColor};">Chart ${statusText}</h2>
          <p>Your airport chart submission has been <strong>${statusText}</strong>.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Airport:</strong> ${chartDetails.icao}</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${chartDetails.chartType}</p>
            <p style="margin: 4px 0;"><strong>Name:</strong> ${chartDetails.chartName}</p>
          </div>
          ${reasonHtml}
          ${
            status === "approved"
              ? "<p>Thank you for contributing to RadarThing!</p>"
              : "<p>Feel free to submit another chart that better meets our guidelines.</p>"
          }
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send notification email:", error);
  }
}

export interface AirportChartRecord {
  id: string;
  icao: string;
  chartType: ChartType;
  chartName: string;
  chartUrl: string;
  imageKey: string | null;
  source: ChartSource;
  isApproved: boolean;
  uploadedBy: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

function toAirportChartRecord(chart: {
  id: string;
  icao: string;
  chartType: string;
  chartName: string;
  chartUrl: string;
  imageKey: string | null;
  source: string;
  isApproved: boolean;
  uploadedBy: string | null;
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
}): AirportChartRecord {
  return {
    id: chart.id,
    icao: chart.icao,
    chartType: chart.chartType as ChartType,
    chartName: chart.chartName,
    chartUrl: chart.chartUrl,
    imageKey: chart.imageKey,
    source: chart.source as ChartSource,
    isApproved: chart.isApproved,
    uploadedBy: chart.uploadedBy,
    approvedBy: chart.approvedBy,
    approvedAt: chart.approvedAt ? new Date(chart.approvedAt) : null,
    createdAt: new Date(chart.createdAt),
  };
}

async function isAdminUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return false;

  if (user.role === "ADMIN") return true;

  const superAdminGoogleId = env.ADMIN_GOOGLE_ID;
  return Boolean(superAdminGoogleId && user.googleId === superAdminGoogleId);
}

async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

// Get approved charts for an airport
export async function getApprovedChartsForAirport(
  icao: string,
  chartType?: ChartType,
): Promise<AirportChartRecord[]> {
  try {
    const charts = await convex.query(api.airportCharts.getChartsForAirport, {
      icao: icao.toUpperCase(),
      chartType,
    });
    return charts.map(toAirportChartRecord);
  } catch (error) {
    console.error("Error fetching airport charts:", error);
    return [];
  }
}

// Get all approved charts
export async function getApprovedAirportCharts(): Promise<
  AirportChartRecord[]
> {
  try {
    const charts = await convex.query(api.airportCharts.getApproved, {});
    return charts.map(toAirportChartRecord);
  } catch (error) {
    console.error("Error fetching approved airport charts:", error);
    return [];
  }
}

// Get pending charts (ADMIN only)
export async function getPendingAirportCharts(): Promise<AirportChartRecord[]> {
  const admin = await isAdminUser();
  if (!admin) return [];

  try {
    const charts = await convex.query(api.airportCharts.getPending, {});
    return charts.map(toAirportChartRecord);
  } catch (error) {
    console.error("Error fetching pending airport charts:", error);
    return [];
  }
}

// Validate upload eligibility
export async function validateChartUploadEligibility(data: {
  icao: string;
  chartType: ChartType;
  chartName: string;
}): Promise<{ canUpload: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      canUpload: false,
      error: "You must be signed in to upload charts",
    };
  }

  if (!data.icao || data.icao.length < 3 || data.icao.length > 4) {
    return {
      canUpload: false,
      error: "Valid ICAO code required (3-4 characters)",
    };
  }

  if (!data.chartType) {
    return { canUpload: false, error: "Chart type is required" };
  }

  if (!data.chartName || data.chartName.length < 3) {
    return {
      canUpload: false,
      error: "Chart name is required (at least 3 characters)",
    };
  }

  try {
    const eligibility = await convex.query(
      api.airportCharts.checkUploadEligibility,
      {
        icao: data.icao.toUpperCase(),
        chartType: data.chartType,
        chartName: data.chartName,
        uploadedBy: userId,
      },
    );

    if (eligibility.pendingByUserExists) {
      return {
        canUpload: false,
        error:
          "You already have a pending chart with this name for this airport",
      };
    }

    return { canUpload: true };
  } catch (error) {
    console.error("Error validating upload eligibility:", error);
    return { canUpload: false, error: "Failed to validate upload eligibility" };
  }
}

// Create airport chart
export async function createAirportChart(data: {
  icao: string;
  chartType: ChartType;
  chartName: string;
  chartUrl: string;
  imageKey?: string;
  discordUsername?: string;
}): Promise<{ success: boolean; error?: string; chart?: AirportChartRecord }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "You must be signed in to upload charts" };
  }

  try {
    const eligibility = await convex.query(
      api.airportCharts.checkUploadEligibility,
      {
        icao: data.icao.toUpperCase(),
        chartType: data.chartType,
        chartName: data.chartName,
        uploadedBy: userId,
      },
    );

    if (eligibility.pendingByUserExists) {
      if (data.imageKey) {
        try {
          await utapi.deleteFiles(data.imageKey);
        } catch (e) {
          console.error("Failed to delete duplicate file from UploadThing:", e);
        }
      }
      return {
        success: false,
        error:
          "You already have a pending chart with this name for this airport",
      };
    }

    const chart = await convex.mutation(api.airportCharts.create, {
      icao: data.icao.toUpperCase(),
      chartType: data.chartType,
      chartName: data.chartName,
      chartUrl: data.chartUrl,
      imageKey: data.imageKey,
      uploadedBy: userId,
      discordUsername: data.discordUsername,
      isApproved: false,
    });

    // Auto-approve if uploaded by admin
    const isAdmin = await isAdminUser();
    if (isAdmin && chart) {
      await convex.mutation(api.airportCharts.approve, {
        id: chart.id as Id<"airportCharts">,
        approvedBy: userId,
      });
      const approvedChart = await convex.query(api.airportCharts.getById, {
        id: chart.id as Id<"airportCharts">,
      });
      revalidatePath("/airport-charts");
      revalidatePath("/admin");
      return {
        success: true,
        chart: approvedChart ? toAirportChartRecord(approvedChart) : undefined,
      };
    }

    revalidatePath("/airport-charts");
    revalidatePath("/admin");
    return {
      success: true,
      chart: chart ? toAirportChartRecord(chart) : undefined,
    };
  } catch (error) {
    console.error("Error creating airport chart:", error);
    return { success: false, error: "Failed to upload chart" };
  }
}

// Approve airport chart (ADMIN only)
export async function approveAirportChart(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can approve charts" };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const chart = await convex.query(api.airportCharts.getById, {
      id: id as Id<"airportCharts">,
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    await convex.mutation(api.airportCharts.approve, {
      id: id as Id<"airportCharts">,
      approvedBy: userId,
    });

    if (chart.uploadedBy) {
      await sendChartNotificationEmail(chart.uploadedBy, "approved", {
        icao: chart.icao,
        chartType: chart.chartType,
        chartName: chart.chartName,
      });
    }

    revalidatePath("/airport-charts");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error approving airport chart:", error);
    return { success: false, error: "Failed to approve chart" };
  }
}

// Reject airport chart (ADMIN only)
export async function rejectAirportChart(
  id: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can reject charts" };
  }

  if (!reason.trim()) {
    return { success: false, error: "Please provide a reason for rejection" };
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const chart = await convex.query(api.airportCharts.getById, {
      id: id as Id<"airportCharts">,
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    if (chart.imageKey) {
      try {
        await utapi.deleteFiles(chart.imageKey);
      } catch (e) {
        console.error("Failed to delete file from UploadThing:", e);
      }
    }

    if (chart.uploadedBy) {
      await sendChartNotificationEmail(
        chart.uploadedBy,
        "rejected",
        {
          icao: chart.icao,
          chartType: chart.chartType,
          chartName: chart.chartName,
        },
        reason,
      );
    }

    await convex.mutation(api.airportCharts.remove, {
      id: id as Id<"airportCharts">,
      actorClerkId: userId,
      action: "reject",
      reason,
    });

    revalidatePath("/airport-charts");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting airport chart:", error);
    return { success: false, error: "Failed to reject chart" };
  }
}

// Delete airport chart (ADMIN only)
export async function deleteAirportChart(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return { success: false, error: "Only ADMIN users can delete charts" };
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const chart = await convex.query(api.airportCharts.getById, {
      id: id as Id<"airportCharts">,
    });

    if (!chart) {
      return { success: false, error: "Chart not found" };
    }

    if (chart.imageKey) {
      try {
        await utapi.deleteFiles(chart.imageKey);
      } catch (e) {
        console.error("Failed to delete file from UploadThing:", e);
      }
    }

    await convex.mutation(api.airportCharts.remove, {
      id: id as Id<"airportCharts">,
      actorClerkId: userId,
      action: "delete",
    });

    revalidatePath("/airport-charts");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error deleting airport chart:", error);
    return { success: false, error: "Failed to delete chart" };
  }
}

// Update airport chart details (ADMIN only)
export async function updateAirportChart(
  id: string,
  newIcao: string,
  newChartType: ChartType,
  newChartName: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await isAdminUser();
  if (!admin) {
    return {
      success: false,
      error: "Only ADMIN users can update chart details",
    };
  }

  // Validate inputs
  const icao = newIcao.trim().toUpperCase();
  const chartName = newChartName.trim();

  if (icao.length < 3 || icao.length > 4) {
    return { success: false, error: "ICAO code must be 3-4 characters" };
  }

  if (chartName.length < 3) {
    return {
      success: false,
      error: "Chart name must be at least 3 characters",
    };
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Update the database
    const result = await convex.mutation(api.airportCharts.update, {
      id: id as Id<"airportCharts">,
      icao,
      chartType: newChartType,
      chartName,
      actorClerkId: userId,
    });

    if (!result) {
      return { success: false, error: "Chart not found" };
    }

    // Rename the file in UploadThing if it has a key
    // File naming format: {ICAO}-{chartType}-{chartName}.{extension}
    if (result.imageKey) {
      try {
        const extension = result.imageKey.split(".").pop() || "png";
        // Sanitize chart name for filename (remove special chars, replace spaces)
        const sanitizedName = chartName
          .replace(/[^a-zA-Z0-9]/g, "-")
          .replace(/-+/g, "-");
        const newFileName = `${icao}-${newChartType}-${sanitizedName}.${extension}`;

        await utapi.renameFiles({
          fileKey: result.imageKey,
          newName: newFileName,
        });
      } catch (e) {
        // Non-critical - file rename failed but DB is updated
        console.error("Failed to rename file in UploadThing:", e);
      }
    }

    revalidatePath("/airport-charts");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error updating airport chart:", error);
    return { success: false, error: "Failed to update chart" };
  }
}

// Bulk approve charts (ADMIN only)
export async function bulkApproveAirportCharts(
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
    const charts = await Promise.all(
      ids.map((id) =>
        convex.query(api.airportCharts.getById, {
          id: id as Id<"airportCharts">,
        }),
      ),
    );

    const results = await convex.mutation(api.airportCharts.bulkApprove, {
      ids: ids as Id<"airportCharts">[],
      approvedBy: userId,
    });

    const emailPromises: Promise<void>[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chart = charts[i];

      if (result?.success && chart?.uploadedBy) {
        emailPromises.push(
          sendChartNotificationEmail(chart.uploadedBy, "approved", {
            icao: chart.icao,
            chartType: chart.chartType,
            chartName: chart.chartName,
          }),
        );
      }
    }

    await Promise.all(emailPromises);

    const approved = results.filter((r) => r?.success).length;
    const failed = results.filter((r) => !r?.success).length;

    revalidatePath("/airport-charts");
    revalidatePath("/admin");

    return { success: failed === 0, approved, failed };
  } catch (error) {
    console.error("Error bulk approving airport charts:", error);
    return { success: false, approved: 0, failed: ids.length };
  }
}

// Bulk reject charts (ADMIN only)
export async function bulkRejectAirportCharts(
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, rejected: 0, failed: ids.length };
    }

    const results = await convex.mutation(api.airportCharts.bulkRemove, {
      ids: ids as Id<"airportCharts">[],
      actorClerkId: userId,
      action: "reject",
      reason,
    });

    const deletePromises: Promise<void>[] = [];
    const emailPromises: Promise<void>[] = [];

    for (const result of results) {
      if (result.success) {
        if (result.imageKey) {
          deletePromises.push(
            utapi.deleteFiles(result.imageKey).catch((e) => {
              console.error("Failed to delete file from UploadThing:", e);
            }) as Promise<void>,
          );
        }

        if (
          result.uploadedBy &&
          result.icao &&
          result.chartType &&
          result.chartName
        ) {
          emailPromises.push(
            sendChartNotificationEmail(
              result.uploadedBy,
              "rejected",
              {
                icao: result.icao,
                chartType: result.chartType,
                chartName: result.chartName,
              },
              reason,
            ),
          );
        }
      }
    }

    await Promise.all([...deletePromises, ...emailPromises]);

    const rejected = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    revalidatePath("/airport-charts");
    revalidatePath("/admin");

    return { success: failed === 0, rejected, failed };
  } catch (error) {
    console.error("Error bulk rejecting airport charts:", error);
    return { success: false, rejected: 0, failed: ids.length };
  }
}

// Get user info by Clerk IDs (ADMIN only)
export async function getChartUserInfoByIds(
  userIds: string[],
): Promise<Record<string, { email: string; name: string | null }>> {
  const admin = await isAdminUser();
  if (!admin) return {};

  const result: Record<string, { email: string; name: string | null }> = {};
  const client = await clerkClient();

  const uniqueIds = [...new Set(userIds.filter(Boolean))];

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
