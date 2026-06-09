import type { APIRoute } from "astro";
import { minioListAll, minioSet } from "../../lib/minio-db";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

// Local fallback only for development (not on Vercel)
const IS_VERCEL = import.meta.env.VERCEL === "1";
const LOCAL_SETTINGS_FILE = join(process.cwd(), ".settings-cache", "settings.json");

function readLocal(): Record<string, string> {
  try { return existsSync(LOCAL_SETTINGS_FILE) ? JSON.parse(readFileSync(LOCAL_SETTINGS_FILE, "utf-8")) : {}; } catch { return {}; }
}
function writeLocal(data: Record<string, string>): void {
  try { mkdirSync(join(process.cwd(), ".settings-cache"), { recursive: true }); writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(data, null, 2)); } catch {}
}

export const GET: APIRoute = async () => {
  let minioResult: Record<string, string> = {};
  try {
    const settings = await minioListAll<Record<string, string>>("settings/");
    for (const s of settings) if (s.key) minioResult[s.key] = s.value;
  } catch {}
  if (!IS_VERCEL) {
    const local = readLocal();
    Object.assign(minioResult, local);
  }
  return new Response(JSON.stringify({ settings: minioResult }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      updates[key] = String(value).slice(0, 2000);
    }
    // Always try MinIO first
    let minioOk = true;
    try {
      for (const [key, value] of Object.entries(updates)) await minioSet(`settings/${key}.json`, { key, value });
    } catch { minioOk = false; }
    // Local fallback only in dev
    if (!IS_VERCEL) {
      const local = readLocal();
      Object.assign(local, updates);
      writeLocal(local);
    }
    if (!minioOk && IS_VERCEL) throw new Error("MinIO unavailable on Vercel");
    return new Response(JSON.stringify({ success: true, storage: minioOk ? "minio" : "local-dev" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("POST settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
