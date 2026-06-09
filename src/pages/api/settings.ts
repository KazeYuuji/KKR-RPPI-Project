import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../lib/minio-db";

const ALLOWED_SETTING_KEYS = new Set([
  // Location
  "locVenue", "locAddress", "locDate", "locTime", "locMapsLink", "locMaps",
  // Schedule
  "eventDateISO", "eventTimeEnd", "eventYear", "eventName",
  "regDeadline", "regDeadlineISO",
  // Contact
  "contactEmail", "contactPhone", "contactWa", "waGroupLink",
  // Church
  "churchLogo",
  // Section texts
  "sectionLabelSpeakers", "sectionHeadingSpeakers", "sectionLabelStory",
  "btnSpeakerPrev", "btnSpeakerNext",
  "sectionLabelAltar", "sectionHeadingAltar", "sectionDescAltar",
  "sectionLabelSponsors", "sectionHeadingSponsors", "sectionDescSponsors",
  "sectionLabelLocation", "sectionLabelCta",
  "btnHeroPrimary", "btnHeroSecondary", "btnSponsorContact",
  // Hero
  "heroSubtitleLabel", "heroTitle1", "heroTitle2",
  "heroHeading1", "heroHeading2", "heroHeading3",
  "heroSubtitle", "heroVerse", "heroVerseRef",
  // About
  "aboutTitle", "aboutDesc1", "aboutDesc2",
  "aboutCard1Title", "aboutCard1Desc", "aboutCard2Title", "aboutCard2Desc",
  "aboutBlockquote", "eventCardBadge",
  // CTA
  "ctaTitle", "ctaDesc",
  "ctaHeading", "ctaSubtitle", "ctaDescription",
  // Section headings (aliases)
  "sectionSpeakersTitle", "sectionSpeakersSubtitle",
  "sectionAltarTitle", "sectionAltarSubtitle",
  "sectionSponsorsTitle", "sectionSponsorsSubtitle",
  "sectionLocationTitle", "sectionLocationSubtitle",
  // Buttons
  "btnRegister", "btnLearnMore",
  // Form
  "formTitle", "formSubtitle",
  // Countdown
  "countdownSubtitle", "countdownHeading",
  "countdownRegLabel", "countdownRegDesc",
  "countdownEventLabel", "countdownEventDesc",
  // Hero deprecated aliases
  "heroHeading", "heroLine1", "heroLine2", "heroLine3",
  "heroVerseRef",
  "aboutHeading", "aboutSubtitle", "aboutDescription",
]);

export const GET: APIRoute = async () => {
  const settings = await minioListAll<Record<string, string>>("settings/");
  const result: Record<string, string> = {};
  for (const s of settings) {
    if (s.key) result[s.key] = s.value;
  }
  return new Response(JSON.stringify({ settings: result }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      await minioSet(`settings/${key}.json`, { key, value: String(value).slice(0, 2000) });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
