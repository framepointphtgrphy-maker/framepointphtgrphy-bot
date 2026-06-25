const express = require("express");
const axios   = require("axios");
const app     = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "YOUR_PAGE_ACCESS_TOKEN";
const VERIFY_TOKEN      = process.env.VERIFY_TOKEN      || "framepointbot2024";
const sessions = {};

// ── BOT PAUSE TRACKER ────────────────────────────────────────────────────────
// When admin manually replies, bot pauses for this user for BOT_PAUSE_HOURS
const BOT_PAUSE_HOURS = 6;
const pausedUsers = {}; // { uid: pausedUntilTimestamp }

function isBotPaused(uid) {
  if (!pausedUsers[uid]) return false;
  if (Date.now() < pausedUsers[uid]) return true;
  delete pausedUsers[uid]; // expired
  return false;
}

function pauseBot(uid) {
  pausedUsers[uid] = Date.now() + BOT_PAUSE_HOURS * 60 * 60 * 1000;
  console.log(`Bot paused for user ${uid} until ${new Date(pausedUsers[uid]).toISOString()}`);
}

function resumeBot(uid) {
  delete pausedUsers[uid];
  console.log(`Bot resumed for user ${uid}`);
}
// ─────────────────────────────────────────────────────────────────────────────

const TIER1_OCCASIONS = ["Birthday","Christening/Baptism","Debut","Marriage Proposal","Family Reunion","Graduation","Pictorial"];
const TIER2_OCCASIONS = ["Civil Wedding","Pre-nup","Maternity","Corporate Party","Conferences","Concert"];
const OTHERS_SUB = [
  { title: "Gender Reveal",         price: "2499" },
  { title: "Baby Shower",           price: "2499" },
  { title: "Monthsary/Anniversary", price: "2499" },
  { title: "Let me type my own",    price: null   },
];

function getPrice(occasion) {
  if (TIER1_OCCASIONS.includes(occasion)) return "P2,499";
  if (TIER2_OCCASIONS.includes(occasion)) return "P3,499";
  return "P2,499";
}

const INCLUSIONS = {
  default: [
    "1 Professional Photographer",
    "2-hour shoot coverage",
    "Soft copies via Google Drive (within 3-5 days)",
    "Basic editing & color grading",
  ],
  Birthday: [
    "1 Professional Photographer",
    "2-hour shoot coverage",
    "Soft copies via Google Drive (within 3-5 days)",
    "Basic editing & color grading",
    "Birthday-themed shot list",
  ],
  "Civil Wedding": [
    "1 Professional Photographer",
    "2-hour shoot coverage",
    "Soft copies via Google Drive (within 5-7 days)",
    "Basic editing & color grading",
  ],
  "Pre-nup": [
    "1 Professional Photographer",
    "2-hour shoot coverage",
    "1 location",
    "Soft copies via Google Drive (within 3-5 days)",
    "Basic editing & color grading",
  ],
  Maternity: [
    "1 Professional Photographer",
    "2-hour indoor/outdoor session",
    "Soft copies via Google Drive (within 3-5 days)",
    "Basic editing & color grading",
  ],
  Pictorial: [
    "1 Professional Photographer",
    "2-hour shoot coverage",
    "1 location",
    "Soft copies via Google Drive (within 3-5 days)",
    "Basic editing & color grading",
  ],
};
function getInclusions(o) { return INCLUSIONS[o] || INCLUSIONS.default; }

const TRANSPORT_NOTE =
  "Additional Notes:\n" +
  "  - P500 per additional hour\n\n" +
  "Transportation Fee:\n" +
  "  - 14km and below: FREE\n" +
  "  - 15km - 20km: P400\n" +
  "  - 21km - 28km: P700\n" +
  "  - 29km - 35km: P1,000\n" +
  "  - 36km and above: To be checked with our team\n\n" +
  "To measure distance, check Google Maps from your venue to:\n" +
  "  Jollibee G. Tuazon, Manila";

const OCCASION_IMAGES = {
  "Birthday":            "https://i.ibb.co/xKVc5v1J/Birthday.png",
  "Christening/Baptism": "https://i.ibb.co/Z6gY1xz6/Christening-Baptism.png",
  "Civil Wedding":       "https://i.ibb.co/xK64vrg1/Civil-Wedding.png",
  "Concert":             "https://i.ibb.co/WWYjhzRx/Concert.png",
  "Conferences":         "https://i.ibb.co/pvGgwSFV/Conference.png",
  "Corporate Party":     "https://i.ibb.co/tT41CdxY/Corporate-Party.png",
  "Debut":               "https://i.ibb.co/7xJDrGSb/Debut.png",
  "Family Reunion":      "https://i.ibb.co/GzT5NXV/Family-Reunion.png",
  "Graduation":          "https://i.ibb.co/HfyjkdC2/Graduation.png",
  "Marriage Proposal":   "https://i.ibb.co/vCpBTzYc/Marriage-Proposal.png",
  "Maternity":           "https://i.ibb.co/7x8Fh9Br/Maternity.png",
  "Others":              "https://i.ibb.co/Qvz5nX4M/Others.png",
  "Pictorial":           "https://i.ibb.co/Nggsgp9d/Pictorial.png",
  "Pre-nup":             "https://i.ibb.co/Qj6hG9Lt/Prenup.png",
};

const TIER1_CARD_ORDER = ["Birthday","Christening/Baptism","Marriage Proposal","Pictorial","Debut","Graduation","Family Reunion"];
const TIER2_CARD_ORDER = ["Civil Wedding","Pre-nup","Maternity","Corporate Party","Conferences","Concert"];

// ── DATE HELPERS ─────────────────────────────────────────────────────────────
function looksLikeDate(text) {
  const t = text.trim();
  return [
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(,?\s*\d{4})?\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}\b/i,
    /\b(next|this|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  ].some(p => p.test(t));
}

function looksLikeTime(text) {
  return /\b(\d{1,2}(:\d{2})?\s*(am|pm|nn|mn|noon|midnight))\b/i.test(text) ||
         /\b(\d{1,2}:\d{2})\b/.test(text);
}

function extractTime(text) {
  const m = text.match(/\b(\d{1,2}(:\d{2})?\s*(am|pm|nn|mn|noon|midnight))\b/i) ||
            text.match(/\b(\d{1,2}:\d{2})\b/);
  return m ? m[0] : null;
}

function isPastDate(text) {
  try {
    const d = new Date(text);
    if (isNaN(d.getTime())) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  } catch { return false; }
}
// ─────────────────────────────────────────────────────────────────────────────

function looksLikeName(text) {
  const t = text.trim();
  return t.length >= 2 && /^[a-zA-ZÀ-ÿ\s'\-\.]+$/.test(t) && !t.includes("?") && !t.toLowerCase().includes("http");
}

// ── FIX 1: Much more permissive venue detection ───────────────────────────────
function looksLikeVenue(text) {
  const t = text.trim().toLowerCase();
  const bad = ["yes","no","okay","ok","sure","oo","hindi","di","wala","nalang",
               "dont know","don't know","tbd","not yet","maybe","baka","siguro"];
  if (bad.includes(t)) return false;
  if (t.length < 3) return false;
  // Accept if it contains any location keyword OR is long enough to be an address
  const locationKeywords = /\b(city|hall|hotel|resort|park|church|chapel|resto|restaurant|barangay|brgy|bgy|qc|manila|makati|taguig|pasig|cavite|laguna|batangas|bulacan|pampanga|rizal|paranaque|las pinas|muntinlupa|caloocan|malabon|valenzuela|navotas|marikina|pasay|pateros|quezon|alabang|bgc|fort|ortigas|mandaluyong|san juan|antipolo|cainta|taytay|binangonan|angono|home|house|backyard|garden|venue|place|location|st\.|ave\.|blvd\.|road|street|purok|sitio|subdivision|village|subd|condo|tower|bldg|building)\b/i;
  return locationKeywords.test(t) || t.length >= 8;
}

// ── FIX 2: Improved detail parser — captures date+time, looser venue matching ─
function parseDetailBlob(text) {
  const result = {};

  // Extract time first (before date, so date regex doesn't eat it)
  const timeMatch = extractTime(text);
  if (timeMatch) result.time = timeMatch;

  // Extract date
  const datePat = [
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{1,2},?\s*\d{4}\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\b/i,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b/i,
  ];
  for (const p of datePat) {
    const m = text.match(p);
    if (m) { result.date = m[0]; break; }
  }

  // Split by newlines and commas to find name/venue
  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lo = line.toLowerCase();
    // Skip line if it contains the date/time we already captured
    if (result.date && lo.includes(result.date.toLowerCase())) continue;
    if (result.time && lo.includes(result.time.toLowerCase())) continue;

    // Venue detection — check for location keywords OR long descriptive text
    const isVenueLine = /\b(at|sa|venue|location|place|held|in|city|hall|hotel|resort|park|church|chapel|resto|restaurant|barangay|brgy|bgy|qc|manila|makati|taguig|pasig|cavite|laguna|batangas|bulacan|pampanga|rizal|paranaque|las pinas|muntinlupa|caloocan|malabon|valenzuela|navotas|marikina|pasay|pateros|quezon|alabang|bgc|fort|ortigas|mandaluyong|san juan|antipolo|cainta|home|house|backyard|garden|st\.|ave\.|blvd\.|road|street|subdivision|village|condo|tower|bldg)\b/i.test(lo);
    if (isVenueLine && !result.venue) { result.venue = line; continue; }

    // Name detection
    if (looksLikeName(line) && !result.name) { result.name = line; }
  }

  // Fallback: if still no venue and there's a line that's not a name/date, treat it as venue
  if (!result.venue) {
    for (const line of lines) {
      const lo = line.toLowerCase();
      if (result.date && lo.includes(result.date.toLowerCase())) continue;
      if (result.time && lo.includes(result.time.toLowerCase())) continue;
      if (result.name && lo === result.name.toLowerCase()) continue;
      if (looksLikeVenue(line)) { result.venue = line; break; }
    }
  }

  return result;
}

app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.status(200).send(req.query["hub.challenge"]);
  } else { res.sendStatus(403); }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== "page") return;

  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      const uid = event.sender.id;

      // ── DETECT ADMIN MANUAL REPLY (is_echo = true means PAGE sent the message) ──
      if (event.message && event.message.is_echo) {
        const adminText = (event.message.text || "").trim().toLowerCase();

        // Admin can type "bot on" / "bot resume" to re-enable the bot for this user
        const recipientId = event.recipient && event.recipient.id;
        if (recipientId) {
          if (/^(bot on|resume bot|bot resume)$/i.test(adminText)) {
            resumeBot(recipientId);
          } else {
            // Any other admin reply = pause the bot for this conversation
            pauseBot(recipientId);
          }
        }
        continue; // don't process echo as user message
      }

      // ── BOT PAUSED — skip all automated responses ──────────────────────────
      if (isBotPaused(uid)) {
        console.log(`Bot is paused for user ${uid}, skipping.`);
        continue;
      }

      if (!sessions[uid]) {
        sessions[uid] = { step: "idle" };
        await sendWelcomeCard(uid);
        continue;
      }

      if (event.postback) await handlePostback(uid, event.postback.payload);
      else if (event.message && !event.message.is_echo) {
        await handleMessage(uid, event.message.text || "");
      }
    }
  }
});

async function sendWelcomeCard(uid) {
  await sendText(uid, "Hi there! Welcome to Framepoint Photography!\n\nWe capture your most precious moments - birthdays, weddings, debuts, and more!\n\nHow can we help you today?");
  await sendButtonMsg(uid, "Tap below to get started:", [
    { type: "postback", title: "Book an Appointment", payload: "START_BOOKING" },
    { type: "postback", title: "Talk to Our Team",    payload: "TALK_HUMAN"    },
  ]);
}

async function handlePostback(uid, payload) {
  const s = sessions[uid];

  if (payload === "START_BOOKING" || payload === "BOOK_ANOTHER") {
    sessions[uid] = { step: "occasion" };
    await sendText(uid, "Let's get your shoot booked!\n\nWhich occasion are you celebrating?");
    await sendOccasionCards(uid);
    return;
  }

  if (payload.startsWith("OCC_")) {
    const occ = decodeURIComponent(payload.replace("OCC_", ""));
    s.occasion = occ;
    if (occ === "Others") {
      s.step = "others_sub";
      await sendText(uid, "Which of these fits your event?");
      await sendOthersSubCards(uid);
    } else {
      s.price = getPrice(occ);
      s.step = "collect_details";
      await askForDetails(uid);
    }
    return;
  }

  if (payload.startsWith("OTHERSUB_")) {
    const sub = decodeURIComponent(payload.replace("OTHERSUB_", ""));
    const found = OTHERS_SUB.find(o => o.title === sub);
    s.price = found && found.price ? "P" + parseInt(found.price).toLocaleString() : "P2,499";
    if (sub === "Let me type my own") {
      s.step = "others_custom";
      await sendText(uid, "Sure! Please describe your event and we will prepare everything for you.\n\nWhat kind of shoot are you looking for?");
    } else {
      s.occasion = sub;
      s.step = "others_specify";
      await sendText(uid, "Great choice! Could you tell us a bit more about your " + sub + " event?\n\n- Theme or concept\n- Number of guests\n- Any special requests\n\nFeel free to share as much or as little as you like!");
    }
    return;
  }

  if (payload === "TALK_HUMAN") {
    await sendText(uid, "Our team has been notified and will message you shortly!\n\nYou can also reach us directly:\nfacebook.com/framepoint.co");
    sessions[uid] = { step: "done" };
    return;
  }

  if (payload === "THATS_ALL") {
    await sendText(uid, "You are very welcome! Thank you for choosing Framepoint Photography!\n\nWe are excited to capture your special moments. We will be in touch soon to confirm everything. Have a wonderful day!");
    sessions[uid] = { step: "done" };
    return;
  }

  // ── ADMIN BOT TOGGLE — tapped by admin directly in Messenger inbox ─────────
  if (payload.startsWith("TOGGLE_BOT_")) {
    const targetUid = payload.replace("TOGGLE_BOT_", "");
    if (isBotPaused(targetUid)) {
      resumeBot(targetUid);
      await sendText(uid, "✅ Bot RESUMED for this conversation. Automated replies are back on.");
    } else {
      pauseBot(targetUid);
      await sendText(uid, "⏸️ Bot PAUSED. You can now reply manually.\n\nTap the toggle button again in the booking summary to turn it back on, or type 'bot on'.");
    }
    return;
  }
}

// ── FIX 3: Ask for date AND time together ────────────────────────────────────
async function askForDetails(uid) {
  const s = sessions[uid];
  const missing = getMissingFields(s);

  // Build a numbered, ordered prompt so parser can rely on position
  const allFields = ["name", "celebrant", "date", "venue"];
  const labels = {
    name:      "Your full name",
    celebrant: "Name of celebrant / person to be photographed",
    date:      "Event date & time",
    venue:     "Venue / location",
  };
  const examples = {
    name:      "e.g. Maria Santos",
    celebrant: "e.g. Baby Esther",
    date:      "e.g. July 20, 2025 at 2:00 PM",
    venue:     "e.g. Taguig City or full address",
  };

  // Only show missing fields, but keep their original order (1→2→3→4)
  const neededFields = allFields.filter(f => missing.includes(f));
  const numbered = neededFields.map((f, i) =>
    (i + 1) + ". " + labels[f] + "\n   " + examples[f]
  ).join("\n\n");

  // Build a sample reply using only the missing fields in order
  const sampleParts = neededFields.map(f => ({
    name:      "Maria Santos",
    celebrant: "Baby Esther",
    date:      "July 20 2025 at 2PM",
    venue:     "Taguig City",
  }[f]));

  await sendText(uid,
    "📋 Please send the following details in this exact order, separated by commas:\n\n" +
    numbered +
    "\n\n✏️ Example reply:\n" +
    sampleParts.join(", ") +
    "\n\n⚠️ Important:\n" +
    "• Send them IN ORDER (name first, location last)\n" +
    "• Use a comma between each detail\n" +
    "• Date & time in one go: July 20 2025 at 2PM"
  );
}

function getMissingFields(s) {
  const fields = [];
  if (!s.name)      fields.push("name");
  if (!s.celebrant) fields.push("celebrant");
  if (!s.date)      fields.push("date");
  if (!s.venue)     fields.push("venue");
  return fields;
}

async function handleMessage(uid, text) {
  const s = sessions[uid];
  const t = text.trim();

  if (/^(hi|hello|hey|oi|musta|kamusta|start|book)$/i.test(t)) {
    sessions[uid] = { step: "occasion" };
    await sendText(uid, "Hi! Let's find you the perfect shoot.\n\nWhat occasion are you celebrating?");
    await sendOccasionCards(uid);
    return;
  }

  if (/^(thank you|thanks|salamat|ty|thank u|thankyou|tysm|maraming salamat)$/i.test(t)) {
    await sendButtonMsg(uid, "You are most welcome! We are excited to capture your special moments.\n\nIs there anything else we can help you with?", [
      { type: "postback", title: "Book Another Event", payload: "BOOK_ANOTHER" },
      { type: "postback", title: "Talk to Our Team",   payload: "TALK_HUMAN"   },
    ]);
    return;
  }

  if (/inclusion|kasama|included|package|rate|price|magkano|how much/i.test(t)) {
    if (s.occasion) {
      const inc = getInclusions(s.occasion).map(i => "  - " + i).join("\n");
      await sendText(uid, "Here is what is included for " + s.occasion + " (" + (s.price || getPrice(s.occasion)) + "):\n\n" + inc);
      await sendText(uid, TRANSPORT_NOTE);
    } else {
      await sendText(uid, "Our packages:\n\nTier 1 - P2,499\nBirthday, Christening/Baptism, Debut, Marriage Proposal, Family Reunion, Graduation, Pictorial, Gender Reveal, Baby Shower, Monthsary/Anniversary\n\nTier 2 - P3,499\nCivil Wedding, Pre-nup, Maternity, Corporate Party, Conferences, Concert\n\nAll packages include a professional photographer, 2-hour coverage, and soft copies via Google Drive.");
      await sendText(uid, TRANSPORT_NOTE);
    }
    if (s.step === "collect_details") await askForDetails(uid);
    return;
  }

  switch (s.step) {
    case "idle":
    case "done":
      await sendButtonMsg(uid, "Hey! Our team will be with you shortly for any follow-up questions.\n\nWant to do something else?", [
        { type: "postback", title: "Book Another Event", payload: "BOOK_ANOTHER" },
        { type: "postback", title: "Talk to Our Team",   payload: "TALK_HUMAN"   },
      ]);
      break;

    case "occasion": {
      const all = [...TIER1_OCCASIONS, ...TIER2_OCCASIONS, "Others", ...OTHERS_SUB.map(o => o.title)];
      const matched = all.find(o => t.toLowerCase().includes(o.toLowerCase()));
      if (matched) { await handlePostback(uid, "OCC_" + encodeURIComponent(matched)); }
      else { await sendText(uid, "Please choose your occasion from the options below:"); await sendOccasionCards(uid); }
      break;
    }

    case "others_sub": {
      const matched = OTHERS_SUB.find(o => t.toLowerCase().includes(o.title.toLowerCase()));
      if (matched) { await handlePostback(uid, "OTHERSUB_" + encodeURIComponent(matched.title)); }
      else { await sendText(uid, "Please choose one of these options:"); await sendOthersSubCards(uid); }
      break;
    }

    case "others_custom": {
      s.occasion = t;
      s.step = "others_specify";
      await sendText(uid, "Got it - a " + t + " shoot! Could you tell us a bit more?\n\n- Theme or concept\n- Number of guests\n- Any special requests");
      break;
    }

    case "others_specify": {
      s.eventNotes = t;
      s.step = "collect_details";
      await sendText(uid, "Got it! Thanks for sharing those details.");
      await askForDetails(uid);
      break;
    }

    case "collect_details": {
      const parsed = parseDetailBlob(t);

      if (parsed.name  && looksLikeName(parsed.name)   && !s.name)  s.name  = parsed.name;
      if (parsed.venue && looksLikeVenue(parsed.venue) && !s.venue) s.venue = parsed.venue;

      // ── FIX: Store date + time together ──
      if (parsed.date && looksLikeDate(parsed.date) && !s.date) {
        s.date = parsed.time
          ? parsed.date + " at " + parsed.time
          : parsed.date;
      }

      // Past date check
      if (parsed.date && isPastDate(parsed.date) && !s.date) {
        await sendText(uid, "It looks like that date has already passed. Please double-check your event date!");
      }

      // ── Celebrant detection ──
      if (!s.celebrant) {
        const parts = t.split(/[\n,]+/).map(p => p.trim()).filter(p => looksLikeName(p));
        if (parts.length >= 2 && !s.name)     { s.name = parts[0]; s.celebrant = parts[1]; }
        else if (parts.length >= 2 && s.name) { s.celebrant = parts.find(p => p.toLowerCase() !== s.name.toLowerCase()) || null; }
        else if (parts.length === 1 && s.name && !s.celebrant) { s.celebrant = parts[0]; }
      }

      const missing = getMissingFields(s);
      if (missing.length === 0) { await sendFinalSummary(uid); }
      else { await askForDetails(uid); }
      break;
    }

    default:
      await sendButtonMsg(uid, "Not sure what you mean. Tap below or type hi to start.", [
        { type: "postback", title: "Book an Appointment", payload: "START_BOOKING" },
        { type: "postback", title: "Talk to Our Team",    payload: "TALK_HUMAN"    },
      ]);
  }
}

async function sendFinalSummary(uid) {
  const s = sessions[uid];
  const inc = getInclusions(s.occasion).map(i => "  - " + i).join("\n");
  const summary =
    "Booking Inquiry Received! 📸\n\n" +
    "Client Name : " + s.name + "\n" +
    "Celebrant   : " + s.celebrant + "\n" +
    "Occasion    : " + s.occasion + "\n" +
    (s.eventNotes ? "Event Notes : " + s.eventNotes + "\n" : "") +
    "Date & Time : " + s.date + "\n" +
    "Location    : " + s.venue + "\n" +
    "Rate        : " + s.price + "\n\n" +
    "What's Included:\n" + inc;
  await sendText(uid, summary);
  await sendText(uid, TRANSPORT_NOTE);
  await sendText(uid, "Our team will reach out to confirm your booking shortly. Thank you for choosing Framepoint Photography! 🎉");
  await sendButtonMsg(uid, "Is there anything else you need?", [
    { type: "postback", title: "Book Another Event",     payload: "BOOK_ANOTHER" },
    { type: "postback", title: "Talk to Our Team",       payload: "TALK_HUMAN"   },
    { type: "postback", title: "That's all, thank you!", payload: "THATS_ALL"    },
  ]);

  // ── ADMIN-ONLY toggle button — visible in the Messenger inbox on the page side ──
  // This lets the admin pause/resume the bot for this specific user with one tap
  await sendButtonMsg(uid,
    "🤖 Admin Controls\n\n" +
    "A new booking inquiry was received from this user.\n\n" +
    "Tap below to pause the bot if you want to reply manually — tap again to resume.",
    [
      { type: "postback", title: "⏸️ Pause / ▶️ Resume Bot", payload: "TOGGLE_BOT_" + uid },
    ]
  );

  sessions[uid] = { step: "done" };
}

async function sendOccasionCards(uid) {
  const row1 = TIER1_CARD_ORDER.map(occ => ({
    title: occ, subtitle: "Tap to select",
    image_url: OCCASION_IMAGES[occ] || OCCASION_IMAGES["Others"],
    buttons: [{ type: "postback", title: "Select " + occ, payload: "OCC_" + encodeURIComponent(occ) }],
  }));
  row1.push({
    title: "Others", subtitle: "Gender Reveal, Baby Shower & more",
    image_url: OCCASION_IMAGES["Others"],
    buttons: [{ type: "postback", title: "Select Others", payload: "OCC_Others" }],
  });
  const row2 = TIER2_CARD_ORDER.map(occ => ({
    title: occ, subtitle: "Tap to select",
    image_url: OCCASION_IMAGES[occ] || OCCASION_IMAGES["Others"],
    buttons: [{ type: "postback", title: "Select " + occ, payload: "OCC_" + encodeURIComponent(occ) }],
  }));
  await sendGenericTemplate(uid, row1);
  await sendGenericTemplate(uid, row2);
}

async function sendOthersSubCards(uid) {
  await callAPI({
    recipient: { id: uid },
    message: {
      text: "Please choose your event type:",
      quick_replies: OTHERS_SUB.map(o => ({
        content_type: "text", title: o.title,
        payload: "OTHERSUB_" + encodeURIComponent(o.title),
      })),
    },
  });
}

async function callAPI(body) {
  try {
    await axios.post("https://graph.facebook.com/v19.0/me/messages?access_token=" + PAGE_ACCESS_TOKEN, body);
  } catch (e) { console.error("Messenger API error:", e.response?.data || e.message); }
}
async function sendText(uid, text) {
  await callAPI({ recipient: { id: uid }, message: { text } });
}
async function sendButtonMsg(uid, text, buttons) {
  await callAPI({ recipient: { id: uid }, message: { attachment: { type: "template", payload: { template_type: "button", text, buttons } } } });
}
async function sendGenericTemplate(uid, elements) {
  await callAPI({ recipient: { id: uid }, message: { attachment: { type: "template", payload: { template_type: "generic", elements } } } });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Framepoint bot running on port " + PORT));
