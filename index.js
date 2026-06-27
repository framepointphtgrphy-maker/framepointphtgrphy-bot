const express = require("express");
const axios   = require("axios");
const app     = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "YOUR_PAGE_ACCESS_TOKEN";
const VERIFY_TOKEN      = process.env.VERIFY_TOKEN      || "framepointbot2024";
const sessions = {};

// ── BOT PAUSE TRACKER ────────────────────────────────────────────────────────
const BOT_PAUSE_HOURS = 6;
const pausedUsers = {};

function isBotPaused(uid) {
  if (!pausedUsers[uid]) return false;
  if (Date.now() < pausedUsers[uid]) return true;
  delete pausedUsers[uid];
  return false;
}
function pauseBot(uid) {
  pausedUsers[uid] = Date.now() + BOT_PAUSE_HOURS * 60 * 60 * 1000;
  console.log(`Bot paused for ${uid} until ${new Date(pausedUsers[uid]).toISOString()}`);
}
function resumeBot(uid) {
  delete pausedUsers[uid];
  console.log(`Bot resumed for ${uid}`);
}

// ── RANDOM PICK HELPER ───────────────────────────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── HUMAN-SOUNDING REPLY POOLS ───────────────────────────────────────────────
const GREET_REPLIES = [
  "Hi! 😊 Welcome to Framepoint Photography!\n\nWe specialize in capturing your most special moments — birthdays, weddings, debuts, and more!\n\nHow can we help you today?",
  "Hey! 👋 Framepoint Photography here!\n\nWe'd love to capture your special moments. What can we do for you? 😊",
  "Hello! 📸 Welcome to Framepoint Photography!\n\nReady to capture your special moments. What's the occasion? 😊",
];

const OCCASION_PROMPTS = [
  "Let's get that booked! 📅 What's the occasion?",
  "Sure, let's set that up! 🎉 What event is it for?",
  "Exciting! 📸 What's the occasion?",
];

const THANKS_REPLIES = [
  "You're welcome! 😊 We're excited to capture your special moments!\n\nAnything else I can help with?",
  "Of course! 🎉 We're really excited for your event!\n\nNeed anything else?",
  "Anytime! 😊 We can't wait to capture your moments!\n\nAnything else?",
];

const DETAIL_ACK = [
  "Got it! Thank you! 🙏",
  "Noted! Thanks! 😊",
  "Perfect, noted! ✅",
  "Got that! 😊",
];

const MISSING_INTRO = [
  "Could you send the missing details? 😊",
  "Almost done! Just need a few more: 👇",
  "So close! Can you fill in the rest? 😊",
  "Thanks for that! Still need a couple more: 👇",
];

const PAST_DATE_MSG = [
  "Hmm, it looks like that date has already passed! 🤔 Could you double-check your event date?",
  "That date seems to be in the past — could you check again? 😊",
];

const CUSTOM_EVENT_PROMPT = [
  "Sure! What kind of shoot are you looking for? Just describe it! 😊",
  "No problem! Tell me about the shoot you have in mind. 📸",
];

const OTHERS_SPECIFY_PROMPT = (occ) => pick([
  `Nice, ${occ}! 🎉 Could you share a few details?\n\n- Theme or concept\n- Number of guests\n- Any special requests\n\nFeel free to share as much or as little as you like! 😊`,
  `${occ} sounds fun! 📸 To help us prepare, could you share:\n\n- Theme or concept\n- Number of guests\n- Any special requests\n\nDon't be shy! 😊`,
]);

const SUMMARY_CLOSING = [
  "Our team will reach out to confirm everything. Thank you for choosing Framepoint Photography! 🎉📸",
  "We'll contact you shortly to confirm the booking. Thank you and we're excited for your event! 🎉",
  "Our team will follow up for confirmation. Thank you for trusting Framepoint Photography! 📸🎉",
];

const THATS_ALL_REPLIES = [
  "Thank you! 🎉 We're excited to capture your special moments. See you soon! 📸",
  "Thanks for choosing Framepoint! 😊 Take care and see you at the event! 🎉",
  "Thank you! 🙏 We hope your event is amazing — we can't wait! 📸",
];

const TALK_HUMAN_REPLIES = [
  "Noted! Our team has been notified — brb! 😊",
  "Got it! Our team has been notified, they'll be with you shortly! 😊",
  "Sure! Our team has been notified — brb! 🙏",
];

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
  "📌 Additional Notes:\n" +
  "  • P500 per additional hour\n\n" +
  "🚗 Transportation Fee:\n" +
  "  • 14km and below — FREE\n" +
  "  • 15km–20km — P400\n" +
  "  • 21km–28km — P700\n" +
  "  • 29km–35km — P1,000\n" +
  "  • 36km and above — to be checked with our team\n\n" +
  "📍 Para malaman ang distance, i-check sa Google Maps mula sa venue ninyo papunta sa:\n" +
  "  Jollibee G. Tuazon, Manila";

const PRICING_IMAGE_1 = "https://i.ibb.co/0psnGDHY/6a37ddf5-b808-415c-abea-ab8f7ecd593a.jpg";
const PRICING_IMAGE_2 = "https://i.ibb.co/r2cHfWWD/ab99f85b-f247-41b8-89d2-65f936a315d8.jpg";

const PACKAGE_INCLUSIONS_TEXT =
  "📦 All packages include:\n" +
  "  • 1 Professional Photographer\n" +
  "  • 2-hour shoot coverage\n" +
  "  • Soft copies via Google Drive\n" +
  "  • Basic editing & color grading";

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

// ── DATE / TIME HELPERS ───────────────────────────────────────────────────────
function looksLikeDate(text) {
  return [
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(,?\s*\d{4})?\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}\b/i,
    /\b(next|this|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  ].some(p => p.test(text.trim()));
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

function looksLikeName(text) {
  const t = text.trim();
  return t.length >= 2 && /^[a-zA-ZÀ-ÿ\s'\-\.]+$/.test(t) && !t.includes("?") && !t.toLowerCase().includes("http");
}

function looksLikeVenue(text) {
  const t = text.trim();
  const tl = t.toLowerCase();
  const bad = ["yes","no","okay","ok","sure","oo","hindi","di","wala","nalang",
               "dont know","don't know","tbd","not yet","maybe","baka","siguro"];
  if (bad.includes(tl)) return false;
  if (t.length < 3) return false;
  if (/^[A-Z]{2,8}$/.test(t)) return true;
  const locationKeywords = /\b(city|hall|hotel|resort|park|church|chapel|resto|restaurant|barangay|brgy|bgy|qc|manila|makati|taguig|pasig|cavite|laguna|batangas|bulacan|pampanga|rizal|paranaque|las pinas|muntinlupa|caloocan|malabon|valenzuela|navotas|marikina|pasay|pateros|quezon|alabang|bgc|fort|ortigas|mandaluyong|san juan|antipolo|cainta|taytay|binangonan|angono|home|house|backyard|garden|venue|place|location|st\.|ave\.|blvd\.|road|street|purok|sitio|subdivision|village|subd|condo|tower|bldg|building|picc|smx|wmc|ice|function|ballroom|ground)\b/i;
  return locationKeywords.test(tl) || t.length >= 8;
}

function parseDetailBlob(text) {
  const result = {};
  const timeMatch = extractTime(text);
  if (timeMatch) result.time = timeMatch;

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

  const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lo = line.toLowerCase();
    if (result.date && lo.includes(result.date.toLowerCase())) continue;
    if (result.time && lo.includes(result.time.toLowerCase())) continue;
    const isVenueLine = /\b(at|sa|venue|location|place|held|in|city|hall|hotel|resort|park|church|chapel|resto|restaurant|barangay|brgy|bgy|qc|manila|makati|taguig|pasig|cavite|laguna|batangas|bulacan|pampanga|rizal|paranaque|las pinas|muntinlupa|caloocan|malabon|valenzuela|navotas|marikina|pasay|pateros|quezon|alabang|bgc|fort|ortigas|mandaluyong|san juan|antipolo|cainta|home|house|backyard|garden|st\.|ave\.|blvd\.|road|street|subdivision|village|condo|tower|bldg|picc|smx|wmc)\b/i.test(lo);
    if (isVenueLine && !result.venue) { result.venue = line; continue; }
    if (looksLikeName(line) && !result.name) { result.name = line; }
  }

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

// ── SHARED PRICING DISPLAY ────────────────────────────────────────────────────
async function sendPricingDisplay(uid) {
  await sendText(uid, "Here are our packages! ⭐📸");
  await sendImageMsg(uid, PRICING_IMAGE_1);
  await sendImageMsg(uid, PRICING_IMAGE_2);
  await sendText(uid, PACKAGE_INCLUSIONS_TEXT);
}

// ── WEBHOOK ──────────────────────────────────────────────────────────────────
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

      // Admin echo — pause/resume bot
      if (event.message && event.message.is_echo) {
        const adminText = (event.message.text || "").trim();
        const recipientId = event.recipient && event.recipient.id;
        if (recipientId) {
          if (/^(bot on|resume bot|bot resume)$/i.test(adminText)) {
            resumeBot(recipientId);
          } else {
            pauseBot(recipientId);
          }
        }
        continue;
      }

      if (isBotPaused(uid)) { console.log(`Paused for ${uid}, skipping.`); continue; }

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

// ── WELCOME ───────────────────────────────────────────────────────────────────
async function sendWelcomeCard(uid) {
  await sendText(uid, pick(GREET_REPLIES));
  await sendButtonMsg(uid, "What would you like to do?", [
    { type: "postback", title: "Book an Appointment",    payload: "START_BOOKING" },
    { type: "postback", title: "View Packages & Pricing", payload: "VIEW_PRICING"  },
    { type: "postback", title: "Talk to Our Team",        payload: "TALK_HUMAN"    },
  ]);
}

// ── POSTBACKS ─────────────────────────────────────────────────────────────────
async function handlePostback(uid, payload) {
  const s = sessions[uid];

  if (payload === "VIEW_PRICING") {
    await sendPricingDisplay(uid);
    await sendText(uid, TRANSPORT_NOTE);
    await sendButtonMsg(uid, "Ready to book? 😊", [
      { type: "postback", title: "Book an Appointment", payload: "START_BOOKING" },
      { type: "postback", title: "Talk to Our Team",    payload: "TALK_HUMAN"    },
    ]);
    return;
  }

  if (payload === "START_BOOKING" || payload === "BOOK_ANOTHER") {
    sessions[uid] = { step: "occasion" };
    await sendText(uid, pick(OCCASION_PROMPTS));
    await sendOccasionCards(uid);
    return;
  }

  if (payload.startsWith("OCC_")) {
    const occ = decodeURIComponent(payload.replace("OCC_", ""));
    s.occasion = occ;
    if (occ === "Others") {
      s.step = "others_sub";
      await sendText(uid, "Sure! Which of these fits your event? 👇");
      await sendOthersSubCards(uid);
    } else {
      s.price = getPrice(occ);
      s.step = "collect_details";
      await sendText(uid, pick([
        `${occ}! 🎉 Let's get that booked — just need a few details!`,
        `${occ}! 📸 Exciting! Let me grab some info to set this up.`,
        `Nice choice — ${occ}! 🎉 Let me get your details.`,
      ]));
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
      await sendText(uid, pick(CUSTOM_EVENT_PROMPT));
    } else {
      s.occasion = sub;
      s.step = "others_specify";
      await sendText(uid, OTHERS_SPECIFY_PROMPT(sub));
    }
    return;
  }

  if (payload === "TALK_HUMAN") {
    await sendText(uid, pick(TALK_HUMAN_REPLIES));
    sessions[uid] = { step: "done", handedOff: true };
    return;
  }

  if (payload === "THATS_ALL") {
    await sendText(uid, pick(THATS_ALL_REPLIES));
    sessions[uid] = { step: "done", handedOff: true };
    return;
  }

  if (payload.startsWith("TOGGLE_BOT_")) {
    const targetUid = payload.replace("TOGGLE_BOT_", "");
    if (isBotPaused(targetUid)) {
      resumeBot(targetUid);
      await sendText(uid, "✅ Bot RESUMED — automated replies are back on.");
    } else {
      pauseBot(targetUid);
      await sendText(uid, "⏸️ Bot PAUSED — you can now reply manually.\n\nTap the toggle again to resume, or type 'bot on'.");
    }
    return;
  }
}

// ── ASK FOR MISSING DETAILS ───────────────────────────────────────────────────
async function askForDetails(uid) {
  const s = sessions[uid];
  const missing = getMissingFields(s);

  const allFields = ["name", "celebrant", "date", "venue"];
  const labels = {
    name:      "Your full name (booker)",
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

  const neededFields = allFields.filter(f => missing.includes(f));
  const numbered = neededFields.map((f, i) =>
    `${i + 1}. ${labels[f]}\n   ${examples[f]}`
  ).join("\n\n");

  const sampleParts = neededFields.map(f => ({
    name:      "Maria Santos",
    celebrant: "Baby Esther",
    date:      "July 20 2025 at 2PM",
    venue:     "Taguig City",
  }[f]));

  const intro = s.name || s.date ? pick(MISSING_INTRO) : "Para ma-process ang iyong booking, kailangan ko lang ang ilang details: 😊";

  await sendText(uid,
    `${intro}\n\n` +
    numbered +
    `\n\n✏️ Reply like this (in order, separated by commas):\n${sampleParts.join(", ")}\n\n` +
    `⚠️ Tips:\n• Keep them in order (name first, venue last)\n• Separate each with a comma\n• Include the time with the date: July 20 2025 at 2PM`
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

// ── HANDLE USER MESSAGES ──────────────────────────────────────────────────────
async function handleMessage(uid, text) {
  const s = sessions[uid];
  const t = text.trim();

  // Fully handed off — stay completely silent
  if (s.step === "done" && s.handedOff) {
    console.log(`Handoff silence for ${uid}: "${t}"`);
    return;
  }

  // Greetings — only short single-word/phrase greetings, not full sentences
  if (/^(hi+|hello+|hey+|oi|musta|kamusta|start|good morning|gm|good afternoon|good evening|magandang umaga|magandang hapon|magandang gabi|kumusta)[\s!?.]*$/i.test(t)) {
    sessions[uid] = { step: "occasion" };
    await sendText(uid, pick(GREET_REPLIES));
    await sendButtonMsg(uid, "What would you like to do?", [
      { type: "postback", title: "Book an Appointment", payload: "START_BOOKING" },
      { type: "postback", title: "Talk to Our Team",    payload: "TALK_HUMAN"    },
    ]);
    return;
  }

  // Thank you
  if (/^(thank you|thanks|salamat|ty|thank u|thankyou|tysm|maraming salamat|tnx|thx)[\s!]*$/i.test(t)) {
    await sendButtonMsg(uid, pick(THANKS_REPLIES), [
      { type: "postback", title: "Book Another Event", payload: "BOOK_ANOTHER" },
      { type: "postback", title: "Talk to Our Team",   payload: "TALK_HUMAN"   },
    ]);
    return;
  }

  // Package / price inquiry — expanded Taglish + English vocabulary
  if (/inclusion|kasama|included|package|rate|price|magkano|mag kano|how much|presyo|bayad|mahal|mura|cost|fee|charge|libre|free|pricelist|price list|ilan|ilang piso|anong rate|anong price|anong presyo|quote|quotation|hm|hmm|affordable|halaga|mag hire|mag-hire|mag avail|mag-avail|gusto.*book|book.*photoshoot|hire.*photographer|photographer.*hire/i.test(t)) {
    if (s.occasion) {
      const inc = getInclusions(s.occasion).map(i => `  • ${i}`).join("\n");
      await sendText(uid,
        `Here's our ${s.occasion} package! ⭐📸\n\n` +
        `💰 Rate: ${s.price || getPrice(s.occasion)}\n\n` +
        `📦 What's included:\n${inc}`
      );
    } else {
      await sendPricingDisplay(uid);
    }
    await sendText(uid, TRANSPORT_NOTE);
    if (s.step === "collect_details") await askForDetails(uid);
    return;
  }

  switch (s.step) {

    // Silent after booking done — only greetings above can re-engage
    case "idle":
    case "done":
      console.log(`Silent in done/idle for ${uid}: "${t}"`);
      break;

    case "occasion": {
      const all = [...TIER1_OCCASIONS, ...TIER2_OCCASIONS, "Others", ...OTHERS_SUB.map(o => o.title)];
      const matched = all.find(o => t.toLowerCase().includes(o.toLowerCase()));
      if (matched) {
        await handlePostback(uid, "OCC_" + encodeURIComponent(matched));
      } else {
        await sendText(uid, "Just tap your occasion from the options below! 😊");
        await sendOccasionCards(uid);
      }
      break;
    }

    case "others_sub": {
      const matched = OTHERS_SUB.find(o => t.toLowerCase().includes(o.title.toLowerCase()));
      if (matched) {
        await handlePostback(uid, "OTHERSUB_" + encodeURIComponent(matched.title));
      } else {
        await sendText(uid, "Please choose from the options below: 👇");
        await sendOthersSubCards(uid);
      }
      break;
    }

    case "others_custom": {
      s.occasion = t;
      s.step = "others_specify";
      await sendText(uid, pick([
        `Got it — ${t} shoot! 📸 Could you share a few details?\n\n- Theme or concept\n- Number of guests\n- Any special requests?`,
        `${t}! 🎉 To help us prepare, could you share:\n\n- Theme or concept\n- Number of guests\n- Any special requests`,
      ]));
      break;
    }

    case "others_specify": {
      s.eventNotes = t;
      s.step = "collect_details";
      await sendText(uid, pick(DETAIL_ACK));
      await askForDetails(uid);
      break;
    }

    case "collect_details": {
      const parsed = parseDetailBlob(t);

      if (parsed.name  && looksLikeName(parsed.name)   && !s.name)  s.name  = parsed.name;
      if (parsed.venue && looksLikeVenue(parsed.venue) && !s.venue) s.venue = parsed.venue;

      if (parsed.date && looksLikeDate(parsed.date) && !s.date) {
        s.date = parsed.time ? `${parsed.date} at ${parsed.time}` : parsed.date;
      }

      if (parsed.date && isPastDate(parsed.date) && !s.date) {
        await sendText(uid, pick(PAST_DATE_MSG));
      }

      if (!s.celebrant) {
        const parts = t.split(/[\n,]+/).map(p => p.trim()).filter(p => looksLikeName(p));
        if (parts.length >= 2 && !s.name)     { s.name = parts[0]; s.celebrant = parts[1]; }
        else if (parts.length >= 2 && s.name) { s.celebrant = parts.find(p => p.toLowerCase() !== s.name.toLowerCase()) || null; }
        else if (parts.length === 1 && s.name && !s.celebrant) { s.celebrant = parts[0]; }
      }

      const missing = getMissingFields(s);
      if (missing.length === 0) {
        await sendText(uid, pick(DETAIL_ACK));
        await sendFinalSummary(uid);
      } else {
        await askForDetails(uid);
      }
      break;
    }

    default:
      console.log(`Unknown step "${s.step}" for ${uid} — silent.`);
      break;
  }
}

// ── FINAL BOOKING SUMMARY ─────────────────────────────────────────────────────
async function sendFinalSummary(uid) {
  const s = sessions[uid];
  const inc = getInclusions(s.occasion).map(i => `  • ${i}`).join("\n");

  const summary =
    "🎉 Booking inquiry received!\n\n" +
    `👤 Client     : ${s.name}\n` +
    `🌟 Celebrant  : ${s.celebrant}\n` +
    `🎊 Occasion   : ${s.occasion}\n` +
    (s.eventNotes ? `📝 Notes      : ${s.eventNotes}\n` : "") +
    `📅 Date & Time: ${s.date}\n` +
    `📍 Location   : ${s.venue}\n` +
    `💰 Rate       : ${s.price}\n\n` +
    `📦 What's Included:\n${inc}`;

  await sendText(uid, summary);
  await sendText(uid, TRANSPORT_NOTE);
  await sendText(uid, pick(SUMMARY_CLOSING));

  await sendButtonMsg(uid, "Is there anything else? 😊", [
    { type: "postback", title: "Book Another Event",     payload: "BOOK_ANOTHER" },
    { type: "postback", title: "Talk to Our Team",       payload: "TALK_HUMAN"   },
    { type: "postback", title: "That's all, thank you!", payload: "THATS_ALL"    },
  ]);

  // Admin controls
  await sendButtonMsg(uid,
    "🤖 Admin Controls\n\nNew booking inquiry received from this user.\n\nTap below to pause the bot if you want to reply manually — tap again to resume.",
    [{ type: "postback", title: "⏸️ Pause / ▶️ Resume Bot", payload: "TOGGLE_BOT_" + uid }]
  );

  sessions[uid] = { step: "done" };
}

// ── CARD SENDERS ──────────────────────────────────────────────────────────────
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

// ── MESSENGER API HELPERS ─────────────────────────────────────────────────────
async function callAPI(body) {
  try {
    await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, body);
  } catch (e) { console.error("Messenger API error:", e.response?.data || e.message); }
}
async function sendText(uid, text) {
  await callAPI({ recipient: { id: uid }, message: { text } });
}
async function sendImageMsg(uid, imageUrl) {
  await callAPI({
    recipient: { id: uid },
    message: {
      attachment: {
        type: "image",
        payload: { url: imageUrl, is_reusable: true },
      },
    },
  });
}
async function sendButtonMsg(uid, text, buttons) {
  await callAPI({ recipient: { id: uid }, message: { attachment: { type: "template", payload: { template_type: "button", text, buttons } } } });
}
async function sendGenericTemplate(uid, elements) {
  await callAPI({ recipient: { id: uid }, message: { attachment: { type: "template", payload: { template_type: "generic", elements } } } });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Framepoint bot running on port " + PORT));
