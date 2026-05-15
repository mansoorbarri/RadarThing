import ReferralPageClient from "./ReferralPageClient";

export default async function ReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawRef =
    typeof params.ref === "string"
      ? params.ref
      : Array.isArray(params.ref)
        ? params.ref[0]
        : undefined;

  return <ReferralPageClient referralCodeParam={rawRef ?? null} />;
}
