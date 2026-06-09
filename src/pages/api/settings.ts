import type { APIRoute } from "astro";
import { minioListAll, minioSet, newId } from "../../lib/minio-db";
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

const LOCAL_SETTINGS_DIR = join(process.cwd(), ".settings-cache");
const LOCAL_SETTINGS_FILE = join(LOCAL_SETTINGS_DIR, "settings.json");

function readLocalSettings(): Record<string, string> {
  try {
    if (!existsSync(LOCAL_SETTINGS_FILE)) return {};
    return JSON.parse(readFileSync(LOCAL_SETTINGS_FILE, "utf-8"));
  } catch { return {}; }
}

function writeLocalSettings(data: Record<string, string>): void {
  try {
    if (!existsSync(LOCAL_SETTINGS_DIR)) mkdirSync(LOCAL_SETTINGS_DIR, { recursive: true });
    writeFileSync(LOCAL_SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
}

function mergeSettings(...sources: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...sources);
}

export const GET: APIRoute = async () => {
  let minioResult: Record<string, string> = {};
  let localResult: Record<string, string> = {};
  try {
    const settings = await minioListAll<Record<string, string>>("settings/");
    for (const s of settings) {
      if (s.key) minioResult[s.key] = s.value;
    }
  } catch { /* minio unavailable, use local */ }
  localResult = readLocalSettings();
  const merged = mergeSettings(localResult, minioResult);
  return new Response(JSON.stringify({ settings: merged }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const updates: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue;
      updates[key] = String(value).slice(0, 2000);
    }

    // Try MinIO first
    let minioOk = true;
    try {
      for (const [key, value] of Object.entries(updates)) {
        await minioSet(`settings/${key}.json`, { key, value });
      }
    } catch {
      minioOk = false;
    }

    // Always save locally as fallback
    const local = readLocalSettings();
    Object.assign(local, updates);
    writeLocalSettings(local);

    if (!minioOk) {
      console.warn("MinIO unavailable — saved locally to .settings-cache/settings.json");
    }

    return new Response(JSON.stringify({ success: true, storage: minioOk ? "minio" : "local" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST settings error:", err);
    return new Response(JSON.stringify({ error: "Gagal menyimpan pengaturan" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
