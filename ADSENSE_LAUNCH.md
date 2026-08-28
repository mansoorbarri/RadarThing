# AdSense launch checklist

The repository-side compliance work is implemented. Complete these account and
DNS/email steps before enabling production ads.

## 1. Ad implementation

The code loads Google Auto ads only for free users on `/radar`, aircraft images,
airport charts, leaderboards, and public pilot pages. The approved
`data-overlays="bottom"` option forces dynamic/collapsible anchors to the bottom
edge. The `RadarThing Free Content` display unit is also used between aircraft
telemetry and Enroute Path, and as the first card in the aircraft image gallery.

The landing page, pricing, checkout, account, admin, and legal pages do not load
the tag. The publisher ID is included as a production default; the environment
variable remains available as an override:

```text
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-5174559718233522
NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT=8811855745
```

## 2. Publish Google's certified CMP messages

In **AdSense → Privacy & messaging**:

1. Create and publish a **European regulations** message for `radarthing.com`.
2. Set its privacy-policy URL to `https://radarthing.com/privacy`.
3. Use the three-choice layout: **Do not consent**, **Consent**, and
   **Manage options**.
4. Enable Consent Mode for advertising and analytics purposes where
   appropriate.
5. Confirm the published message is using the current IAB TCF version supported
   by Google (TCF v2.3 as of this implementation).
6. Create and publish the relevant **US state regulations** message and opt-out
   controls for the regions you serve.
7. Test consent and revocation from a UK/EEA location and a covered US state.

## 3. Enable only the anchor format

In **AdSense → Ads → radarthing.com → Edit**:

1. Turn on **Auto ads**.
2. Under **Overlay formats**, enable **Anchor ads**.
3. In Anchor advanced settings, select **Bottom only**.
4. Enable **Allow dynamic anchors** so users receive the expandable/collapsible
   format.
5. Enable anchors on screens wider than 1000px if you want them on desktop.
6. Disable Vignette ads, Side rail ads, Intent-driven formats, Banner ads, and
   Multiplex ads. The code-managed display unit will continue to work.
7. Under **Page exclusions**, add `https://radarthing.com/` and select **This
   page only**. This account-side exclusion also protects the landing page
   during client-side navigation.
8. Apply the settings to the site.

The AdSense tag loaded by the ad components is the top-level tag that lets Google's
certified CMP display. The Privacy control links back into Google's revocation
flow when the tag is present.

## 4. Finish operational details

- Make sure `support@radarthing.com`, `privacy@radarthing.com`, and
  `copyright@radarthing.com` are working inboxes or aliases.
- In AdSense, confirm `radarthing.com` is **Ready** and `ads.txt` is
  **Authorized**.
- Verify the publisher ID in AdSense exactly matches
  `pub-5174559718233522` in `public/ads.txt`.
- Publish transparent seller information in AdSense `sellers.json` settings.
- Review the Ad Review Center and block unsuitable categories if the audience
  includes younger simulator users.
- Never ask users to click ads, refresh ad units automatically, or place ads
  beside radar controls, download buttons, or upload controls.
