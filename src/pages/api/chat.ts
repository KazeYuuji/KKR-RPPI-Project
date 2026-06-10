import type { APIRoute } from "astro";
import { minioListAll } from "../../lib/minio-db";

const GEMINI_API_KEY = import.meta.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const userMessage = body.message?.toString().trim();
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Pesan tidak boleh kosong" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const settings = await loadAllSettings();

    // Try Gemini AI if API key is available
    if (GEMINI_API_KEY) {
      const systemPrompt = buildSystemPrompt(settings);
      try {
        const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.7, maxOutputTokens: 500,
            },
          }),
        });
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return new Response(JSON.stringify({ reply }), {
              status: 200, headers: { "Content-Type": "application/json" },
            });
          }
        }
      } catch (err) {
        console.error("Gemini API error:", err);
      }
    }

    // Smart fallback: comprehensive rule-based answering
    return handleSmartFallback(settings, userMessage);
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ error: "Gagal memproses pesan" }), {
      status: 500, headers: { "Content-Type": "application/json" },
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
  const wa = s.contactWa || "6285800753804";
  const email = s.contactEmail || "kkrrppi@gmail.com";

  return `Kamu adalah asisten virtual bernama "Elias" untuk acara KKR RPPI (Kebaktian Kebangunan Rohani). 
Kamu menjawab pertanyaan tentang acara ini dengan ramah, akurat, dan informatif. 
Gunakan Bahasa Indonesia yang sopan dan natural. Jawab secara singkat tapi informatif.

INFORMASI ACARA:
- Nama acara: KKR RPPI ${s.eventYear || "2026"}
- Tanggal: ${date}
- Waktu: ${time}
- Tempat: ${venue} (${address})
- Tiket: GRATIS
- Batas pendaftaran: ${s.regDeadline || "Belum ditentukan"}
- Kontak: WhatsApp ${wa}, Email ${email}
- Grup WhatsApp: ${s.waGroupLink || "Tersedia setelah pendaftaran"}

HALAMAN UTAMA:
- Judul hero: ${s.heroHeading || "KKR RPPI " + (s.eventYear || "2026")}
- Subtitle: ${s.heroSubtitle || ""}
- Ayat: ${s.heroVerse || ""} (${s.heroVerseRef || ""})

PEMBICARA:
${s.sectionHeadingSpeakers || "Bersama Pembicara Rohani"} - ${s.sectionSpeakersTitle || ""}

PELAYAN ALTAR:
${s.sectionHeadingAltar || "Pelayan Altar KKR RPPI"}

SPONSOR & MITRA:
${s.sectionHeadingSponsors || "Sponsor & Mitra"}

LOKASI & WAKTU:
- Alamat: ${address}
- Tanggal: ${date}
- Waktu: ${time}
- Batas pendaftaran: ${s.regDeadline || "Belum ditentukan"}

REGISTRASI:
- Judul: ${s.regHeading || "Daftar Sekarang"}
- Deskripsi: ${s.regDescription || ""}

JIKA ditanya di luar konteks acara KKR RPPI, arahkan kembali ke topik acara dengan ramah.
Jawab dengan gaya alami dan jangan menyebut bahwa kamu adalah AI atau model bahasa.`;
}

async function handleSmartFallback(s: Record<string, string>, msg: string): Promise<Response> {
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
  const deadline = s.regDeadline || "Belum ditentukan";

  // Greetings
  if (/^(halo|hai|hey|hi|selamat|assalamu|pagi|siang|sore|malam)\b/.test(m) || m.length < 5 && /(halo|hai|hey|hi)/.test(m)) {
    const timeGreet = (() => {
      const h = new Date().getHours();
      if (h < 11) return "Selamat pagi";
      if (h < 15) return "Selamat siang";
      if (h < 18) return "Selamat sore";
      return "Selamat malam";
    })();
    return json(`${timeGreet}! Saya Elias, asisten virtual KKR RPPI ${year}. Senang bisa membantu Anda! Ada yang ingin ditanyakan seputar acara, pendaftaran, atau lokasi?`);
  }

  if (/makasih|terima kasih|terimakasih|thanks|thank/i.test(m)) {
    return json(`Sama-sama! Senang bisa membantu. Jika ada pertanyaan lain seputar KKR RPPI ${year}, jangan ragu untuk bertanya ya!`);
  }

  // About the event
  if (/apa itu kkr|tentang|kkr rppi|acara ini|kebaktian|kebangunan/i.test(m) && !/lokasi|tempat|dimana/i.test(m)) {
    return json(`KKR RPPI ${year} adalah Kebaktian Kebangunan Rohani yang mempersatukan siswa, alumni, guru, dan masyarakat untuk mengalami kebangunan rohani dalam Yesus Kristus. Acara akan berlangsung pada ${date} pukul ${time} di ${venue}. Tiket GRATIS! Daftar sekarang juga ya.`);
  }

  // Date & schedule
  if (/(kapan|tanggal|jadwal|hari|jam|pukul)\b/.test(m) || /pelaksanaan|dilaksanakan|mulai|selesai/i.test(m)) {
    const endTime = s.eventTimeEnd || "12.30 WIB";
    const dayName = date.split(",")[0] || "Sabtu";
    return json(`KKR RPPI ${year} akan dilaksanakan pada:\n📅 ${date}\n🕐 ${time}\n📍 ${venue}\n\nAcara dimulai pukul ${time.split("-")[0]?.trim() || time} dan selesai sekitar ${endTime}. Yuk daftar sekarang, gratis!`);
  }

  // Location / venue
  if (/(lokasi|tempat|venue|dimana|di mana|maps|alamat|lokasinya)\b/.test(m) || /berlokasi|bertempat/i.test(m)) {
    return json(`Acara bertempat di:\n📍 ${venue}\n📮 ${address}\n\nKamu bisa lihat peta interaktif di halaman utama website. Klik "Buka di Google Maps" untuk petunjuk arah langsung dari lokasimu.`);
  }

  // Tickets / registration
  if (/(tiket|daftar|registrasi|pendaftaran|mendaftar|cara daftar|daftarnya|biaya|bayar|gratis|free|harga)\b/.test(m) && !/pembicara|speaker|pelayan|altar/i.test(m)) {
    const dllink = s.regDeadline ? `\n\n⏰ Jangan lupa, batas pendaftaran: ${deadline}` : "";
    return json(`Tiket KKR RPPI ${year} GRATIS! 🎉\n\nCara daftar:\n1️⃣ Buka halaman pendaftaran di website\n2️⃣ Isi Nama Lengkap, Email, dan WhatsApp\n3️⃣ Pilih jenis tiket yang tersedia\n4️⃣ Klik "Konfirmasi Pendaftaran"\n5️⃣ Tiket digital akan langsung kamu dapatkan!${dllink}\n\nAyo segera daftar, jangan sampai kehabisan!`);
  }

  // After registration steps
  if (/(setelah daftar|selanjutnya|langkah|tiket sudah|sudah daftar|cetak|pdf|qr)/i.test(m)) {
    return json(`Setelah berhasil mendaftar, kamu akan mendapatkan:\n✅ Nomor tiket digital (simpan baik-baik)\n✅ Tiket PDF yang bisa dicetak\n✅ Kode QR untuk check-in\n\nSaat acara, cukup tunjukkan tiket (PDF atau screenshot) ke petugas check-in. Mudah, kan? 😊`);
  }

  // Speakers
  if (/(pembicara|speaker|pengisi|pengkhotbah|khutbah|khotbah)\b/i.test(m)) {
    return json(`${s.sectionHeadingSpeakers || "KKR RPPI"} menghadirkan pembicara-pembicara rohani yang akan menginspirasi dan memberkati kita semua. Untuk melihat profil lengkap para pembicara, kunjungi halaman utama website dan scroll ke bagian Pembicara.`);
  }

  // Altar servers
  if (/(pelayan altar|altar|pelayan)\b/i.test(m)) {
    return json(`${s.sectionHeadingAltar || "Pelayan Altar KKR RPPI"} adalah mereka yang akan melayani dalam ibadah. Lihat profil lengkapnya di halaman utama ya!`);
  }

  // Sponsors
  if (/(sponsor|mitra|dukungan|donasi)\b/i.test(m)) {
    return json(`${s.sectionHeadingSponsors || "Sponsor dan mitra"} yang mendukung terselenggaranya KKR RPPI ${year}. Informasi lengkap ada di halaman utama website.`);
  }

  // Contact
  if (/(kontak|hubungi|wa|whatsapp|email|telepon|telp|phone|cs)\b/i.test(m) && !/grup|group/i.test(m)) {
    return json(`Hubungi panitia KKR RPPI ${year}:\n📱 WhatsApp: ${waDisplay}\n📧 Email: ${email}\n\nAtau kunjungi website kami untuk informasi lebih lengkap. Kami siap membantu!`);
  }

  // WhatsApp group
  if (/(grup wa|group wa|grup whatsapp|group whatsapp|komunitas|grup)\b/i.test(m)) {
    if (waGroup) {
      return json(`Grup WhatsApp KKR RPPI ${year} bisa kamu akses di:\n${waGroup}\n\nGabung sekarang untuk dapat info terbaru seputar acara!`);
    }
    return json(`Grup WhatsApp KKR RPPI ${year} tersedia setelah kamu mendaftar tiket. Link grup akan muncul di halaman sukses pendaftaran. Yuk daftar dulu!`);
  }

  // Deadline
  if (/(batas|deadline|terakhir|penutupan|ditutup)\b/i.test(m)) {
    return json(`Batas pendaftaran KKR RPPI ${year}: ${deadline}. Segera daftarkan dirimu sebelum ditutup! Tiket GRATIS, jangan sampai terlewat.`);
  }

  // What to prepare
  if (/(bawa|persiapan|siapkan|perlu|bawaan|attribute|atribut)\b/i.test(m) || /yg perlu|yang perlu/i.test(m)) {
    return json(`Yang perlu disiapkan:\n🙏 Hati yang rindu akan Tuhan\n📱 Tiket digital (simpan di HP atau cetak)\n👔 Pakaian rapi dan sopan\n\nSemua sudah gratis, tinggal daftar dan datang!`);
  }

  // About / about section
  if (/(tentang acara|deskripsi|informasi|info acara|detail acara)\b/i.test(m) && !/lokasi|tempat|waktu|tiket/i.test(m)) {
    const about = s.aboutTitle || "KKR RPPI";
    const desc = s.aboutDesc1 || "";
    return json(`${about}\n${desc ? "\n" + desc : ""}\n\nKKR RPPI ${year} adalah acara kebaktian kebangunan rohani yang akan berlangsung pada ${date} di ${venue}. Tiket GRATIS! Daftar sekarang di website kami.`);
  }

  // Hero/theme verse
  if (/(ayat|alkitab|firman|tema|renungan)\b/i.test(m)) {
    const verse = s.heroVerse || "";
    const ref = s.heroVerseRef || "";
    if (verse && ref) {
      return json(`Tema KKR RPPI ${year}:\n"${verse}" (${ref})\n\nAyat ini menjadi dasar dan inspirasi acara kita. Mari renungkan dan aplikasikan dalam hidup sehari-hari.`);
    }
    return json(`Tema KKR RPPI ${year} bisa kamu lihat di halaman utama website. Setiap tahun kami mengangkat tema yang relevan untuk kebangunan rohani.`);
  }

  // Registration status check
  if (/(cek|status|sudah terdaftar|terdaftar|sudah daftar|verifikasi)\b.*(tiket|daftar|pendaftaran)/i.test(m)) {
    return json(`Untuk mengecek status pendaftaran atau tiket, silakan hubungi panitia melalui WhatsApp di ${waDisplay} atau email ke ${email}. Tim kami akan membantu memverifikasi pendaftaranmu.`);
  }

  // CTA / registration prompt
  if (/(ayo|yuk|mari|ajak|teman|datang)\b/i.test(m) || /daftarin|mendaftarkan/i.test(m)) {
    return json(`Yuk, ajak keluarga, teman, dan saudara untuk hadir di KKR RPPI ${year}! 🎉\n\n📅 ${date}\n🕐 ${time}\n📍 ${venue}\n🎟️ GRATIS!\n\nDaftar sekarang di website dan dapatkan tiket digitalmu. Sampai jumpa di acara! 🙏`);
  }

  // About admin dashboard / website features
  if (/(admin|dashboard|login|panel)/i.test(m)) {
    return json(`Halaman admin digunakan oleh panitia untuk mengelola konten website. Jika kamu panitia dan butuh akses, hubungi tim teknis KKR RPPI ya.`);
  }

  // Catch-all with helpful suggestions
  const suggestions = [
    "🗓️ Kapan acaranya?",
    "📍 Di mana lokasinya?",
    "🎟️ Cara daftar tiket",
    "📞 Kontak panitia",
  ];
  const randomSuggest = suggestions[Math.floor(Math.random() * suggestions.length)];

  return json(`Terima kasih atas pertanyaannya! Saya Elias, asisten KKR RPPI ${year}. Sayangnya saya belum bisa menjawab pertanyaan itu secara spesifik. Tapi saya bisa bantu seputar:\n\n${suggestions.map(s => "• " + s).join("\n")}\n\nAtau kamu bisa langsung cek website kkrrppi untuk info lengkapnya. Ada yang bisa saya bantu?`);
}

function json(data: string): Response {
  return new Response(JSON.stringify({ reply: data }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}
