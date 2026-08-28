import type { Metadata } from "next";
import { LegalPage, LegalSection } from "~/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Copyright and Takedowns",
  description: "Report copyright or other rights concerns to RadarThing.",
  alternates: { canonical: "/copyright" },
};

export default function CopyrightPage() {
  return (
    <LegalPage
      eyebrow="Rights procedure"
      title="Copyright and takedowns"
      summary="RadarThing reviews community uploads before publication and responds to clear reports that hosted material infringes copyright or other rights."
    >
      <LegalSection title="Before uploading">
        <p>
          Upload only images and charts you created, that are in the public
          domain, or that you are licensed or otherwise authorised to share.
          Attribution alone does not replace permission. Airline, airport, and
          government materials may carry separate copyright or usage terms.
        </p>
      </LegalSection>

      <LegalSection title="Send a report">
        <p>
          Email copyright@radarthing.com with your name and contact details, the
          exact RadarThing URL, identification of the protected work, an
          explanation of your rights and why the use is unauthorised, and a
          statement that the report is accurate and made in good faith. Include
          a signature (typed is acceptable).
        </p>
      </LegalSection>

      <LegalSection title="What happens next">
        <p>
          We may temporarily disable material while reviewing a report, contact
          the uploader, request more information, restore material where a
          report is withdrawn or resolved, and restrict repeat infringers. We
          may share the report with the uploader or relevant service providers
          where necessary to investigate it.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
