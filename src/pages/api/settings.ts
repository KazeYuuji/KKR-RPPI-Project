import type { APIRoute } from "astro";
import { pgSetSetting, pgGetSettings } from "../../lib/pg-db";
import { getAdminFromRequest } from "../../lib/auth";
import { checkRateLimit } from "../../lib/security";

const ALLOWED_SETTING_KEYS = new Set([
  "locVenue", "locAddress", "locDate", "locTime", "locMapsLink", "locMaps",
  "eventDateISO", "eventTimeEnd", "eventTimeUntilFinished", "eventYear", "eventName",
  "regDeadline", "regDeadlineISO", "regOpenDateISO",
  "contactEmail", "contactPhone", "contactWa", "waGroupLink",
  "churchLogo", "ticketBg",
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
  try {
    const settings = await pgGetSettings();
    return new Response(JSON.stringify({ settings }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("GET settings error:", e);
    return new Response(JSON.stringify({ settings: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = getAdminFromRequest(request);
    if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

    const rl = checkRateLimit("settings-post:" + (admin?.id || "unknown"), 20, 60000);
    if (!rl.allowed) return new Response(JSON.stringify({ error: "Terlalu banyak permintaan" }), { status: 429, headers: { "Content-Type": "application/json" } });

    const body = await request.json();
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      updates[key] = String(value).slice(0, 2000);
    }

    // Validate date fields
    if (updates.regDeadlineISO) {
      const d = new Date(updates.regDeadlineISO);
      if (isNaN(d.getTime())) {
        return new Response(JSON.stringify({ error: "Format tanggal regDeadlineISO tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }
    if (updates.regOpenDateISO) {
      const d = new Date(updates.regOpenDateISO);
      if (isNaN(d.getTime())) {
        return new Response(JSON.stringify({ error: "Format tanggal regOpenDateISO tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }
    if (updates.eventDateISO) {
      const d = new Date(updates.eventDateISO);
      if (isNaN(d.getTime())) {
        return new Response(JSON.stringify({ error: "Format tanggal eventDateISO tidak valid" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }

    for (const [key, value] of Object.entries(updates)) {
      await pgSetSetting(key, value as string);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
