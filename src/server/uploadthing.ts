import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";

import { assertCurrentAccountActive } from "~/server/moderation";

const f = createUploadthing();

export const ourFileRouter = {
  aircraftImageUploader: f({ image: { maxFileSize: "512KB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId } = await auth();

      if (!userId) throw new Error("Unauthorized");
      await assertCurrentAccountActive(userId);

      return { userId };
    })
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key };
    }),

  airportChartUploader: f({
    "image/png": { maxFileSize: "4MB", maxFileCount: 20 },
  })
    .middleware(async () => {
      const { userId } = await auth();

      if (!userId) throw new Error("Unauthorized");
      await assertCurrentAccountActive(userId);

      return { userId };
    })
    .onUploadComplete(({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
