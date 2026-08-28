# AdSense launch checklist

The repository-side compliance work is implemented. Complete these account and
DNS/email steps before enabling production ads.

## 1. Create the ad unit

1. The responsive display unit `RadarThing Free Content` has been created.
2. The code includes these values as production defaults; the environment
   variables remain available as overrides:

   ```text
   NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-5174559718233522
   NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT=8811855745
   ```

3. Keep Auto ads disabled. RadarThing uses explicit, separated placements on
   the homepage, aircraft gallery, and airport-chart library. The interactive
   radar, checkout, account, pricing, admin, and legal pages are intentionally
   excluded.

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

The AdSense tag loaded by `AdSenseUnit` is the top-level tag that lets Google's
certified CMP display. The Privacy control links back into Google's revocation
flow when the tag is present.

## 3. Finish operational details

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
