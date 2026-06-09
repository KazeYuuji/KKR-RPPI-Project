import type { APIRoute } from "astro";
import { minioListAll, minioSet } from "../../lib/minio-db";
import { getAdminFromRequest } from "../../lib/auth";
import { isValidOrigin, checkRateLimit } from "../../lib/security";

const ALLOWED_SETTING_KEYS = new Set([
  "locVenue", "locAddress", "locDate", "locTime", "locMapsLink", "locMaps",
  "eventDateISO", "eventTimeEnd", "eventYear", "eventName",
  "regDeadline", "regDeadlineISO",
  "contactEmail", "contactPhone", "contactWa", "waGroupLink",
  "churchLogo",
  "sectionLabelSpeakers", "sectionHeadingSpeakers", "sectionLabelStory",
  "btnSpeakerPrev", "btnSpeakerNext",
  "sectionLabelAltar", "sectionHeadingAltar", "sectionDescAltar",
  "sectionLabelSponsors", "sectionHeadingSponsors", "sectionDescSponsors",
  "sectionLabelLocation", "sectionLabelCta",
  "btnHeroPrimary", "btnHeroSecondary", "btnSponsorContact",
  "heroSubtitleLabel", "heroTitle1", "heroTitle2",
  "heroHeading1", "heroHeading2", "heroHeading3",
  "heroSubtitle", "heroVerse", "heroVerseRef",
  "aboutTitle", "aboutDesc1", "aboutDesc2",
  "aboutCard1Title", "aboutCard1Desc", "aboutCard2Title", "aboutCard2Desc",
  "aboutBlockquote", "eventCardBadge", "aboutSectionLabel",
  "ctaTitle", "ctaDesc",
  "ctaHeading", "ctaSubtitle", "ctaDescription",
  "sectionSpeakersTitle", "sectionSpeakersSubtitle",
  "sectionAltarTitle", "sectionAltarSubtitle",
  "sectionSponsorsTitle", "sectionSponsorsSubtitle",
  "sectionLocationTitle", "sectionLocationSubtitle",
  "btnRegister", "btnLearnMore",
  "formTitle", "formSubtitle",
  "countdownSubtitle", "countdownHeading",
  "countdownRegLabel", "countdownRegDesc",
  "countdownEventLabel", "countdownEventDesc",
  "heroHeading", "heroLine1", "heroLine2", "heroLine3",
  "heroVerseRef",
  "aboutHeading", "aboutSubtitle", "aboutDescription",
  "navLabelHome", "navLabelInfo", "navLabelSpeakers", "navLabelAltar", "navLabelSponsors", "navLabelLocation",
  "btnNavRegister", "btnNavRegisterMobile",
  "eventCardLabelPada", "eventCardLabelPukul", "eventCardLabelTempat", "eventCardBrand",
  "locSubLabelAlamat", "locSubLabelTanggal", "locSubLabelWaktu", "locSubLabelBatasDaftar", "locSubLabelKontak", "locBtnMaps",
  "ctaContactLabel",
  "countdownUnitDays", "countdownUnitHours", "countdownUnitMinutes", "countdownUnitSeconds",
  "regSectionLabel", "regHeading", "regDescription",
  "regSidebarBadge", "regSidebarTitle", "regSidebarDesc",
  "regLocationLabel", "regMapsBtnText",
]);

export const GET: APIRoute = async () => {
  let minioResult: Record<string, string> = {};
  try {
    const settings = await minioListAll<Record<string, string>>("settings/");
    for (const s of settings) if (s.key) minioResult[s.key] = s.value;
  } catch (e) {
    console.error("GET settings minio error:", e);
  }
  return new Response(JSON.stringify({ settings: minioResult }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    if (!isValidOrigin(request)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("settings-post:" + (admin?.id || "unknown"), 20, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      updates[key] = String(value).slice(0, 2000);
    }

    // Use MinIO directly as the only storage
    for (const [key, value] of Object.entries(updates)) {
      await minioSet(`settings/${key}.json`, { key, value });
    }

    return new Response(JSON.stringify({ success: true, storage: "minio" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
