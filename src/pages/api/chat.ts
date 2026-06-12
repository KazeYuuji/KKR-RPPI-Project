import type { APIRoute } from "astro";
import { minioListAll } from "../../lib/minio-db";
import { checkRateLimit } from "../../lib/security";

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 20;

interface HistoryItem {
  role: string;
  content: string;
  ts?: number;
}

interface Conversation {
  history: HistoryItem[];
  lock: boolean;
}

const conversations = new Map<string, Conversation>();
const CONV_TTL = 30 * 60_000;
const MAX_CONVERSATIONS = 5000;
const MAX_HISTORY = 20;

setInterval(() => {
  const now = Date.now();
  for (const [key, conv] of conversations) {
    const last = conv.history[conv.history.length - 1];
    if (conv.history.length && last && last.ts && now - last.ts > CONV_TTL) {
      conversations.delete(key);
    }
  }
}, 60_000);

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit("chat:" + ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Terlalu banyak permintaan. Silakan coba lagi nanti." }), {
        status: 429, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const userMessage = body.message?.toString().trim();
    if (!userMessage) {
      return new Response(JSON.stringify({ reply: "Silakan ketik pesan terlebih dahulu." }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Use IP-based session ID to prevent session hijacking via client-controlled sessionId
    const sessionId = "sess_" + ip.replace(/[^0-9a-fA-F:.]/g, "") + "_" + (body.sessionId || "").slice(0, 10);

    const settings = await loadAllSettings();

    // Limit total conversations to prevent memory exhaustion
    if (conversations.size >= MAX_CONVERSATIONS) {
      const firstKey = conversations.keys().next().value;
      if (firstKey) conversations.delete(firstKey);
    }

    // Get or create conversation with lock guard
    let conv = conversations.get(sessionId);
    if (!conv) {
      conv = { history: [], lock: false };
      conversations.set(sessionId, conv);
    }

    // Try Gemini AI if API key is available
    if (GEMINI_API_KEY) {
      const systemPrompt = buildSystemPrompt(settings);
      const messages = conv.history.slice(-6);
      messages.push({ role: "user", content: userMessage, ts: Date.now() });

      try {
        const geminiRes = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: messages.map(m => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: typeof m.content === "string" ? m.content : "" }],
            })),
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        });
        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            conv.history.push({ role: "user", content: userMessage, ts: Date.now() });
            conv.history.push({ role: "assistant", content: reply, ts: Date.now() });
            if (conv.history.length > MAX_HISTORY) conv.history = conv.history.slice(-MAX_HISTORY);
            return new Response(JSON.stringify({ reply }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
        }
        console.warn("Gemini API returned non-OK or empty response:", geminiRes.status);
      } catch (geminiErr) {
        console.error("Gemini API error:", geminiErr);
      }
    }

    // Smart fallback with conversation memory (no lock needed since single-threaded)
    const lastTopic = conv.history.filter(m => m.role === "user").pop()?.content || "";

    const reply = await handleSmartReply(settings, userMessage, lastTopic);

    conv.history.push({ role: "user", content: userMessage, ts: Date.now() });
    conv.history.push({ role: "assistant", content: reply, ts: Date.now() });
    if (conv.history.length > MAX_HISTORY) conv.history = conv.history.slice(-MAX_HISTORY);

    return new Response(JSON.stringify({ reply }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ reply: "Maaf, terjadi gangguan. Silakan coba lagi nanti." }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
};

async function loadAllSettings(): Promise<Record<string, string>> {
  try {
    const settings = await minioListAll<Record<string, string>>("settings/");
    const result: Record<string, string> = {};
    for (const s of settings) if (s.key) result[s.key] = s.value;
    return result;
  } catch {
    return {};
  }
}

function buildSystemPrompt(s: Record<string, string>): string {
  const venue = s.locVenue || "GPI IMANUEL Kediri";
  const address = s.locAddress || "Jl. Himalaya No.06, Kediri";
  const date = s.locDate || "Sabtu, 10 Januari 2026";
  const time = s.locTime || "08.00 - 12.30 WIB";
  return `Kamu adalah Elias, asisten KKR RPPI. Info acara: ${date}, ${time}, ${venue} (${address}). Tiket GRATIS. Kontak: ${s.contactWa || "6285800753804"}, ${s.contactEmail || "kkrrppi@gmail.com"}. Jawab ramah dan natural dalam Bahasa Indonesia.`;
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "pagi";
  if (h < 15) return "siang";
  if (h < 18) return "sore";
  return "malam";
}

function score(msg: string, ...keywords: string[]): number {
  const m = msg.toLowerCase();
  let total = 0;
  for (const k of keywords) {
    if (m.includes(k.toLowerCase())) total += k.length;
  }
  return total;
}

async function handleSmartReply(s: Record<string, string>, msg: string, lastTopic: string): Promise<string> {
  const m = msg.toLowerCase().trim();

  const venue = s.locVenue || "GPI IMANUEL Kediri";
  const address = s.locAddress || "Jl. Himalaya No.06, Kediri";
  const date = s.locDate || "Sabtu, 10 Januari 2026";
  const time = s.locTime || "08.00 - 12.30 WIB";
  const year = s.eventYear || "2026";
  const wa = s.contactWa || "6285800753804";
  const waDisplay = wa.replace(/^0+/, "+62 ");
  const email = s.contactEmail || "kkrrppi@gmail.com";
  const waGroup = s.waGroupLink || "";
  const deadline = s.regDeadline || "belum ditentukan";
  const endTime = s.eventTimeEnd || "12.30 WIB";

  // Follow-up detection
  const isFollowUp = /(tell me more|ceritakan|lanjut|lagi|lebih|jelaskan|terus|trus|trs|lebih detail)/i.test(m) && m.length < 30;
  if (isFollowUp && lastTopic) {
    if (/(tiket|daftar|registrasi)/i.test(lastTopic)) {
      return `Setelah mendaftar, kamu akan langsung mendapatkan:\n✅ Nomor tiket digital (simpan baik-baik)\n✅ Tiket PDF yang bisa dicetak\n✅ Kode QR untuk check-in\n\nCukup tunjukkan tiket saat datang ke acara. Mudah sekali! Ada yang ingin ditanyakan lagi? 😊`;
    }
    if (/(lokasi|tempat|venue)/i.test(lastTopic)) {
      return `${venue} berlokasi di ${address}. Tempatnya strategis dan mudah dijangkau. Kalau kamu naik kendaraan umum, kamu bisa turun di terminal Kota Kediri, lalu lanjut naik ojek sekitar 10 menit. Ada yang bisa saya bantu lagi?`;
    }
  }

  const scores: Array<{ topic: string; points: number }> = [];

  // Greetings
  if (/^(halo|hai|hey|hi|helo|selamat|assalamu|pagi|siang|sore|malam|test|tes)/.test(m) && m.length < 10) {
    const g = getTimeGreeting();
    const variants = [
      `Selamat ${g}! Saya Elias, asisten KKR RPPI ${year}. Senang berkenalan dengan Anda! Ada yang ingin ditanyakan seputar acara, pendaftaran, atau lokasi?`,
      `Halo! Selamat ${g}. Saya Elias, asisten virtual KKR RPPI ${year}. Ada yang bisa saya bantu?`,
      `Selamat ${g}! 🙏 Saya Elias, salam kenal! Silakan tanya apapun tentang KKR RPPI ${year} ya.`,
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  // Thanks
  if (/makasih|terima kasih|terimakasih|thanks|thank|suwun|matur/i.test(m)) {
    const variants = [
      `Sama-sama! 😊 Senang bisa membantu. Kalau ada pertanyaan lain, bilang aja ya.`,
      `Sama-sama! Semoga informasi yang saya berikan bermanfaat. Ada lagi yang bisa dibantu?`,
      `Dengan senang hati! 🙏 Jangan sungkan bertanya lagi kalau butuh info lain seputar KKR RPPI ${year}.`,
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  }

  // Goodbye
  if (/dadah|bye|goodbye|sampai jumpa|sampai ketemu|daah|dah/i.test(m) && m.length < 15) {
    return `Sampai jumpa! 😊 Terima kasih sudah menggunakan Elias. Semoga diberkati dan sampai bertemu di KKR RPPI ${year}! 🙏`;
  }

  // Build topic scores
  scores.push({ topic: "event", points: score(m, "kkr rppi", "acara", "tentang", "kebaktian", "kebangunan", "rohani") });
  scores.push({ topic: "schedule", points: score(m, "kapan", "tanggal", "jadwal", "hari", "jam", "pukul", "mulai", "selesai", "dilaksanakan", "pelaksanaan", "waktu") });
  scores.push({ topic: "location", points: score(m, "lokasi", "tempat", "venue", "dimana", "di mana", "maps", "alamat", "bertempat", "berlokasi", "gedung", "gereja") });
  scores.push({ topic: "ticket", points: score(m, "tiket", "daftar", "registrasi", "pendaftaran", "mendaftar", "biaya", "bayar", "gratis", "free", "harga", "daftarnya", "cara") });
  scores.push({ topic: "speaker", points: score(m, "pembicara", "speaker", "pengisi", "pendeta", "pdt", "khotbah", "pengkhotbah") });
  scores.push({ topic: "altar", points: score(m, "pelayan altar", "altar", "pelayan") });
  scores.push({ topic: "sponsor", points: score(m, "sponsor", "mitra", "dukungan", "donasi") });
  scores.push({ topic: "contact", points: score(m, "kontak", "hubungi", "wa", "whatsapp", "email", "telepon", "telp", "phone", "cs", "panitia") });
  scores.push({ topic: "group", points: score(m, "grup wa", "group wa", "grup whatsapp", "grup", "group", "komunitas") });
  scores.push({ topic: "deadline", points: score(m, "batas", "deadline", "terakhir", "penutupan", "ditutup") });
  scores.push({ topic: "prepare", points: score(m, "bawa", "persiapan", "siapkan", "perlu", "bawaan", "atribut", "yang perlu", "yg perlu", "dress", "pakaian") });
  scores.push({ topic: "verse", points: score(m, "ayat", "alkitab", "firman", "tema", "renungan", "nas") });
  scores.push({ topic: "after", points: score(m, "setelah daftar", "selanjutnya", "tiket sudah", "sudah daftar", "cetak", "pdf", "qr code", "check in", "checkin") });
  scores.push({ topic: "invite", points: score(m, "ayo", "yuk", "mari", "ajak", "teman", "datang", "daftarin", "mendaftarkan") });

  // Also consider last topic context
  if (scores.every(s => s.points === 0) && lastTopic) {
    scores.push({ topic: "followup_any", points: 1 });
  }

  scores.sort((a, b) => b.points - a.points);
  const top = scores[0];

  if (!top || top.points < 2) {
    const suggestions = [
      "🗓️ Kapan dan di mana acaranya?",
      "🎟️ Cara daftar tiket gratis",
      "📞 Kontak panitia",
      "🙏 info pembicara",
    ];
    const s = suggestions[Math.floor(Math.random() * suggestions.length)];
    return `Maaf, saya belum bisa menjawab pertanyaan itu secara spesifik. Tapi saya bisa bantu seputar:\n\n${suggestions.map((x, i) => `  ${i+1}. ${x}`).join("\n")}\n\nAtau ketik pertanyaanmu dengan kata kunci yang lebih jelas ya 😊`;
  }

  // Check deadline
  const isExpired = (() => {
    if (!s.regDeadlineISO) return false;
    let dl = s.regDeadlineISO;
    if (!dl.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(dl)) dl += "+07:00";
    return Date.now() > new Date(dl).getTime();
  })();

  switch (top.topic) {
    case "event":
      return `KKR RPPI ${year} adalah Kebaktian Kebangunan Rohani yang mempersatukan siswa, alumni, guru, dan masyarakat untuk mengalami kebangunan rohani dalam Yesus Kristus.\n\n📅 ${date}\n🕐 ${time}\n📍 ${venue}\n🎟️ GRATIS!\n\nYuk daftar sekarang, jangan sampai terlewat!`;

    case "schedule":
      return `KKR RPPI ${year} akan dilaksanakan:\n📅 ${date}\n🕐 ${time}\n📍 ${venue}\n\nAcara dimulai pukul ${time.split("-")[0]?.trim() || time} dan selesai sekitar ${endTime}. Yuk daftar sekarang, gratis! 🎉`;

    case "location":
      return `Lokasi acara KKR RPPI ${year}:\n📍 ${venue}\n📮 ${address}\n\nKamu bisa lihat peta interaktif di halaman utama website atau klik "Buka di Google Maps" untuk petunjuk arah dari lokasimu.`;

    case "ticket":
      if (isExpired) {
        return `Maaf, pendaftaran KKR RPPI ${year} sudah ditutup pada ${deadline}. Terima kasih atas minat Anda. Nantikan KKR RPPI berikutnya ya! 🙏`;
      }
      return `Tiket KKR RPPI ${year} GRATIS! 🎉\n\nCara daftar:\n1️⃣ Buka halaman pendaftaran di website\n2️⃣ Isi Nama Lengkap, Email, dan WhatsApp\n3️⃣ Pilih jenis tiket yang tersedia\n4️⃣ Klik "Konfirmasi Pendaftaran"\n5️⃣ Tiket digital langsung didapatkan!\n\n⏰ Batas pendaftaran: ${deadline}\n\nAyo segera daftar, jangan sampai kehabisan!`;

    case "speaker":
      return `${s.sectionHeadingSpeakers || "KKR RPPI"} menghadirkan pembicara-pembicara rohani yang akan menginspirasi dan memberkati kita semua. Untuk melihat profil lengkap para pembicara, kunjungi halaman utama website dan scroll ke bagian Pembicara.`;

    case "altar":
      return `${s.sectionHeadingAltar || "Pelayan Altar KKR RPPI"} adalah mereka yang akan melayani dalam ibadah. Lihat profil lengkapnya di halaman utama ya!`;

    case "sponsor":
      return `${s.sectionHeadingSponsors || "Sponsor dan mitra"} yang mendukung terselenggaranya KKR RPPI ${year}. Informasi lengkap ada di halaman utama website.`;

    case "contact":
      return `Hubungi panitia KKR RPPI ${year}:\n📱 WhatsApp: ${waDisplay}\n📧 Email: ${email}\n\nKami siap membantu kamu!`;

    case "group":
      if (waGroup) return `Grup WhatsApp KKR RPPI ${year}:\n${waGroup}\n\nGabung sekarang untuk info terbaru seputar acara!`;
      return `Link grup WhatsApp akan tersedia setelah kamu mendaftar tiket. Yuk daftar dulu! 😊`;

    case "deadline":
      if (isExpired) return `Maaf, pendaftaran KKR RPPI ${year} sudah ditutup pada ${deadline}. Terima kasih banyak atas antusiasmenya! 🙏`;
      return `Batas pendaftaran KKR RPPI ${year}: ${deadline}. Segera daftar sebelum ditutup! Tiket GRATIS 🎉`;

    case "prepare":
      return `Yang perlu disiapkan:\n🙏 Hati yang rindu akan Tuhan\n📱 Tiket digital (simpan di HP/cetak)\n👔 Pakaian rapi dan sopan\n\nSemua gratis! Tinggal daftar dan datang.`;

    case "verse": {
      const verse = s.heroVerse;
      const ref = s.heroVerseRef;
      if (verse && ref) return `Tema KKR RPPI ${year}:\n"${verse}" (${ref})\n\nAyat ini menjadi dasar dan inspirasi acara kita. Mari renungkan bersama 🙏`;
      return `Tema dan ayat KKR RPPI ${year} bisa kamu lihat di halaman utama website.`;
    }

    case "after":
      return `Setelah berhasil mendaftar, kamu akan dapat:\n✅ Nomor tiket digital\n✅ Tiket PDF untuk dicetak\n✅ Kode QR untuk check-in\n\nSaat acara, tunjukkan tiket ke petugas check-in. Mudah banget! 😊`;

    case "invite":
      return `Yuk, ajak keluarga, teman, dan saudara untuk hadir di KKR RPPI ${year}! 🎉\n\n📅 ${date}\n🕐 ${time}\n📍 ${venue}\n🎟️ GRATIS!\n\nDaftar sekarang di website. Sampai jumpa! 🙏`;

    case "followup_any":
      return `Maaf, saya kurang paham maksudnya. Tapi tenang, saya bisa bantu menjawab pertanyaan seputar:\n• Info acara (tanggal, lokasi, waktu)\n• Pendaftaran tiket\n• Pembicara dan acara\n• Kontak panitia\n\nAda yang bisa saya bantu?`;

    default:
      return `Terima kasih! Untuk info lebih lanjut tentang KKR RPPI ${year}, silakan cek website atau hubungi kami. Ada yang bisa saya bantu lagi?`;
  }
}
