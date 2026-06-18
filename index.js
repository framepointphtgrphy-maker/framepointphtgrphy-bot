const express = require("express");
const axios   = require("axios");
const app     = express();
app.use(express.json());

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "YOUR_PAGE_ACCESS_TOKEN";
const VERIFY_TOKEN      = process.env.VERIFY_TOKEN      || "framepointbot2024";

// ── SESSION STORE ─────────────────────────────────────────────────────────────
const sessions = {};

// ── PRICING ───────────────────────────────────────────────────────────────────
const TIER1_OCCASIONS = [
  "Birthday", "Christening/Baptism", "Debut", "Marriage Proposal",
  "Family Reunion", "Graduation", "Pictorial",
];
const TIER2_OCCASIONS = [
  "Civil Wedding", "Pre-nup", "Maternity",
  "Corporate Party", "Conferences", "Concert",
];
const OTHERS_SUB = [
  { title: "Gender Reveal",        price: "₱2,499" },
  { title: "Baby Shower",          price: "₱2,499" },
  { title: "Monthsary/Anniversary", price: "₱2,499" },
  { title: "Let me type my own",   price: null },
];

function getPrice(occasion) {
  if (TIER1_OCCASIONS.includes(occasion)) return "₱2,499";
  if (TIER2_OCCASIONS.includes(occasion)) return "₱3,499";
  return "₱2,499";
}

// ── INCLUSIONS ────────────────────────────────────────────────────────────────
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

function getInclusions(occasion) {
  return INCLUSIONS[occasion] || INCLUSIONS.default;
}

// ── TRANSPORT & ADDITIONAL NOTES ─────────────────────────────────────────────
const TRANSPORT_NOTE =
  "📌 Additional Notes:\n" +
  "  • ₱500 per additional hour\n\n" +
  "🚗 Transportation Fee:\n" +
  "  • 14km and below — FREE\n" +
  "  • 15km – 20km — ₱400\n" +
  "  • 21km – 28km — ₱700\n" +
  "  • 29km – 35km — ₱1,000\n" +
  "  • 36km and above — To be checked with our team\n\n" +
  "📍 To measure distance, check Google Maps from your venue to:\n" +
  "  Jollibee G. Tuazon, Manila";

// ── OCCASION IMAGES ───────────────────────────────────────────────────────────
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

// ── CARD ORDER ────────────────────────────────────────────────────────────────
const TIER1_CARD_ORDER = [
  "Birthday",
  "Christening/Baptism",
  "Marriage Proposal",
  "Pictorial",
  "Debut",
  "Graduation",
  "Family Reunion",
];
const TIER2_CARD_ORDER = [
  "Civil Wedding",
  "Pre-nup",
  "Maternity",
  "Corporate Party",
  "Conferences",
  "Concert",
];

// ── VALIDATION HELPERS ────────────────────────────────────────────────────────
function looksLikeDate(text) {
  const t = text.trim();
  const patterns = [
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(,?\s*\d{4})?\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}\b/i,
    /\b(next|this|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  ];
  return patterns.some(p => p.test(t));
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
  return t.length >= 2
    && /^[a-zA-ZÀ-ÿ\s'\-\.]+$/.test(t)
    && !t.includes("?")
    && !t.toLowerCase().includes("http");
}

function looksLikeVenue(text) {
  const t = text.trim().toLowerCase();
  const bad = ["yes","no","okay","ok","sure","oo","hindi","di","wala","nalang",
               "dont know","don't know","tbd","not yet","maybe","baka","siguro"];
  return !bad.includes(t) && t.length >= 3;
}

// ── PARSE FREE-FORM DETAILS BLOB ──────────────────────────────────────────────
function parseDetailBlob(text) {
  const result = {};

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

  const lines = text.split(/[\n,|\/\\]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lo = line.toLowerCase();
    if (result.date && lo.includes(result.date.toLowerCase())) continue;

    if (/\b(at|sa|venue|location|place|held|in|city|hall|hotel|resort|park|church|chapel|resto|restaurant|barangay|brgy|bgy|qc|manila|makati|taguig|pasig|cavite|laguna|batangas|bulacan|pampanga|rizal|paranaque|las pinas|muntinlupa|caloocan|malabon|valenzuela|navotas|marikina|pasay|pateros)\b/i.test(lo)) {
      if (!result.venue) result.venue = line;
      continue;
    }

    if (looksLikeName(line) && !result.name) {
      result.name = line;
      continue;
    }
  }

  return result;
}

// ── WEBHOOK VERIFICATION ──────────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

// ── WEBHOOK RECEIVER ──────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  if (body.object !== "page") return;

  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      const uid = event.sender.id;
      if (!sessions[uid]) {
        sessions[uid] = { step: "idle" };
        await sendWelcomeCard(uid);
        continue;
      }
      if (event.postback)
        await handlePostback(uid, event.postback.payload);
      else if (event.message && !event.message.is_echo)
        await handleMessage(uid, event.message.text || "");
    }
  }
});

// ── WELCOME CARD ──────────────────────────────────────────────────────────────
async function sendWelcomeCard(uid) {
  await sendText(uid,
    "Hi there! Welcome to Framepoint Photography 📸\n\n" +
    "We capture your most precious moments — birthdays, weddings, debuts, and more!\n\n" +
    "How can we help you today?"
  );
  await sendButtonMsg(uid,
    "Tap below to get started:",
    [
      { type: "postback", title: "📅 Book an Appointment", payload: "START_BOOKING" },
      { type: "postback", title: "💬 Talk to Our Team",    payload: "TALK_HUMAN"    },
    ]
  );
}

// ── POSTBACK HANDLER ──────────────────────────────────────────────────────────
async function handlePostback(uid, payload) {
  const s = sessions[uid];

  if (payload === "START_BOOKING" || payload === "BOOK_ANOTHER") {
    sessions[uid] = { step: "occasion" };
    await sendText(uid, "Let's get your shoot booked! 🎉\n\nWhich occasion are you celebrating?");
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
    s.occasion = sub;
    s.price = found ? found.price : "₱2,499";
    s.step = "othersub_specify";
    await sendText(uid,
      `Great! You selected *${sub}*. 🎉

` +
      `Could you please specify more details about your event?
` +
      `(e.g., theme, number of guests, special requests, etc.)`
    );
    return;
  }

  if (payload === "TALK_HUMAN") {
    await sendText(uid,
      "Our team has been notified and will message you shortly! 😊

" +
      "You can also reach us directly:
📘 facebook.com/framepoint.co"
    );
    sessions[uid] = { step: "done" };
    return;
  }

  if (payload === "THATS_ALL") {
    await sendText(uid,
      "You're very welcome! 😊🙏

" +
      "Thank you for choosing Framepoint Photography! We're excited to capture your special moments.

" +
      "See you on your event day! 📸✨"
    );
    sessions[uid] = { step: "done" };
    return;
  }
}

// ── ASK FOR ALL DETAILS AT ONCE ───────────────────────────────────────────────
async function askForDetails(uid) {
  const s = sessions[uid];
  const missing = getMissingFields(s);

  const labels = {
    name:      "📝 Your full name",
    celebrant: "🌟 Name of celebrant / person to be photographed",
    date:      "📅 Event date (e.g., July 20, 2025)",
    venue:     "📍 Venue or location",
  };

  const needed = missing.map(f => `• ${labels[f]}`).join("\n");

  await sendText(uid,
    `Almost there! Please send the following details in one message:\n\n${needed}\n\n` +
    `You can type them all together, e.g.:\n_Maria Santos, Aling Nena, July 20 2025, Taguig City_`
  );
}

// ── WHICH FIELDS ARE STILL MISSING ───────────────────────────────────────────
function getMissingFields(s) {
  const fields = [];
  if (!s.name)      fields.push("name");
  if (!s.celebrant) fields.push("celebrant");
  if (!s.date)      fields.push("date");
  if (!s.venue)     fields.push("venue");
  return fields;
}

// ── FREE-TEXT HANDLER ─────────────────────────────────────────────────────────
async function handleMessage(uid, text) {
  const s = sessions[uid];
  const t = text.trim();

  // Thank you reply
  if (/^(thank you|thanks|thank u|salamat|ty|tysm|maraming salamat)$/i.test(t)) {
    await sendButtonMsg(uid,
      "You're most welcome! 😊 We're excited to capture your special moments!

Is there anything else we can help you with?",
      [
        { type: "postback", title: "📅 Book Another Event", payload: "BOOK_ANOTHER" },
        { type: "postback", title: "💬 Talk to Our Team",   payload: "TALK_HUMAN"   },
      ]
    );
    return;
  }

  // Thank you response
  if (/^(thank you|thanks|salamat|ty|thank u|thankyou)$/i.test(t)) {
    await sendButtonMsg(uid,
      "You're welcome! 😊 We're excited to capture your special moments!

Is there anything else we can help you with?",
      [
        { type: "postback", title: "📅 Book Another Event", payload: "BOOK_ANOTHER" },
        { type: "postback", title: "💬 Talk to Our Team",   payload: "TALK_HUMAN"   },
      ]
    );
    return;
  }

  // Global restart shortcut
  if (/^(hi|hello|hey|oi|musta|kamusta|start|book)$/i.test(t)) {
    sessions[uid] = { step: "occasion" };
    await sendText(uid, "Hi! Let's find you the perfect shoot. 📸\n\nWhat occasion are you celebrating?");
    await sendOccasionCards(uid);
    return;
  }

  // Intercept package/rate/inclusion questions at any step
  if (/inclusion|kasama|included|package|rate|price|magkano|how much|ano.*kasama|anong.*package/i.test(t)) {
    if (s.occasion) {
      const inc = getInclusions(s.occasion).map(i => `  • ${i}`).join("\n");
      await sendText(uid, `Here's what's included for ${s.occasion} (${s.price || getPrice(s.occasion)}):\n\n${inc}`);
      await sendText(uid, TRANSPORT_NOTE);
    } else {
      await sendText(uid,
        `Our packages:\n\n` +
        `Tier 1 - ₱2,499\nBirthday, Christening/Baptism, Debut, Marriage Proposal, Family Reunion, Graduation, Pictorial, Gender Reveal, Baby Shower\n\n` +
        `Tier 2 - ₱3,499\nCivil Wedding, Pre-nup, Maternity, Corporate Party, Conferences, Concert\n\n` +
        `All packages include a professional photographer, 2-hour coverage, and soft copies via Google Drive. 😊`
      );
      await sendText(uid, TRANSPORT_NOTE);
    }
    if (s.step === "collect_details") await askForDetails(uid);
    return;
  }

  switch (s.step) {

    case "idle":
    case "done":
      await sendButtonMsg(uid,
        "Hey! 😊 Our team will be with you shortly for any follow-up questions.\n\nWant to book another event?",
        [
          { type: "postback", title: "📅 Book Another Event", payload: "BOOK_ANOTHER" },
          { type: "postback", title: "💬 Talk to Our Team",   payload: "TALK_HUMAN"   },
        ]
      );
      break;

    case "occasion": {
      const all = [...TIER1_OCCASIONS, ...TIER2_OCCASIONS, "Others", ...OTHERS_SUB.map(o => o.title)];
      const matched = all.find(o => t.toLowerCase().includes(o.toLowerCase()));
      if (matched) {
        await handlePostback(uid, `OCC_${encodeURIComponent(matched)}`);
      } else {
        await sendText(uid, "Please choose your occasion from the options below:");
        await sendOccasionCards(uid);
      }
      break;
    }

    case "others_sub": {
      const matched = OTHERS_SUB.find(o => t.toLowerCase().includes(o.title.toLowerCase()));
      if (matched) {
        await handlePostback(uid, `OTHERSUB_${encodeURIComponent(matched.title)}`);
      } else {
        await sendText(uid, "Please choose one of these options:");
        await sendOthersSubCards(uid);
      }
      break;
    }

    case "others_specify": {
      s.eventNotes = t;
      s.step = "collect_details";
      await sendText(uid, "Got it! Thanks for sharing those details. 😊");
      await askForDetails(uid);
      break;
    }

    case "others_custom": {
      s.occasion = t;
      s.step = "others_specify";
      await sendText(uid,
        `Got it — a *${t}* shoot! 📸

` +
        `Could you tell us a bit more? For example:
` +
        `• Theme or concept
` +
        `• Number of guests
` +
        `• Any special requests`
      );
      break;
    }



    case "othersub_specify": {
      s.otherDetails = t;
      s.step = "collect_details";
      await sendText(uid, `Got it! Noted: "${t}" 📝`);
      await askForDetails(uid);
      break;
    }

    case "collect_details": {
      const parsed = parseDetailBlob(t);

      if (parsed.name  && looksLikeName(parsed.name)   && !s.name)  s.name  = parsed.name;
      if (parsed.date  && looksLikeDate(parsed.date)   && !s.date)  s.date  = parsed.date;
      if (parsed.venue && looksLikeVenue(parsed.venue) && !s.venue) s.venue = parsed.venue;

      if (!s.celebrant) {
        const parts = t.split(/[\n,]+/).map(p => p.trim()).filter(p => looksLikeName(p));
        if (parts.length >= 2 && !s.name)     { s.name = parts[0]; s.celebrant = parts[1]; }
        else if (parts.length >= 2 && s.name) { s.celebrant = parts.find(p => p !== s.name) || null; }
        else if (parts.length === 1 && s.name && !s.celebrant) { s.celebrant = parts[0]; }
      }

      if (parsed.date && !looksLikeDate(parsed.date)) {
        await sendText(uid, "I couldn't read the date clearly. Please use a format like July 20, 2025 or 07/20/2025.");
      } else if (parsed.date && isPastDate(parsed.date) && !s.date) {
        await sendText(uid, "It looks like that date has already passed. Please double-check your event date!");
      }

      const missing = getMissingFields(s);
      if (missing.length === 0) {
        await sendFinalSummary(uid);
      } else {
        await askForDetails(uid);
      }
      break;
    }

    default:
      await sendButtonMsg(uid,
        "Not sure what you mean. 😊 Tap below or type hi to start.",
        [
          { type: "postback", title: "📅 Book an Appointment", payload: "START_BOOKING" },
          { type: "postback", title: "💬 Talk to Our Team",    payload: "TALK_HUMAN"    },
        ]
      );
  }
}

// ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
async function sendFinalSummary(uid) {
  const s = sessions[uid];
  const inc = getInclusions(s.occasion).map(i => `  • ${i}`).join("\n");

  const summary =
    `✅ Booking Inquiry Received!\n\n` +
    `👤 Client Name : ${s.name}\n` +
    `🌟 Celebrant   : ${s.celebrant}\n` +
    `🎉 Occasion    : ${s.occasion}\n` +
    `📅 Date        : ${s.date}\n` +
    `📍 Location    : ${s.venue}\n` +
    (s.eventNotes ? `📝 Event Notes : ${s.eventNotes}\n` : "") +
    `💰 Rate        : ${s.price}\n\n` +
    `📦 What's Included:\n${inc}`;

  await sendText(uid, summary);
  await sendText(uid, TRANSPORT_NOTE);
  await sendText(uid, "Our team will reach out to confirm your booking shortly. Thank you for choosing Framepoint Photography! 🙏");
  await sendButtonMsg(uid,
    "Is there anything else you need?",
    [
      { type: "postback", title: "📅 Book Another Event",   payload: "BOOK_ANOTHER" },
      { type: "postback", title: "💬 Talk to Our Team",     payload: "TALK_HUMAN"   },
      { type: "postback", title: "✅ That's all, thank you!", payload: "THATS_ALL"   },
    ]
  );
  sessions[uid] = { step: "done" };
}

// ── OCCASION CARDS ────────────────────────────────────────────────────────────
// Messenger max = 10 cards per carousel, so we split into 2 rows
async function sendOccasionCards(uid) {
  // Row 1: Tier 1 (7 cards + Others = 8 cards)
  const row1 = TIER1_CARD_ORDER.map(occ => ({
    title:     occ,
    subtitle:  "Tap to select",
    image_url: OCCASION_IMAGES[occ] || OCCASION_IMAGES["Others"],
    buttons:   [{ type: "postback", title: `Select ${occ}`, payload: `OCC_${encodeURIComponent(occ)}` }],
  }));
  row1.push({
    title:     "Others",
    subtitle:  "Gender Reveal, Baby Shower & more",
    image_url: OCCASION_IMAGES["Others"],
    buttons:   [{ type: "postback", title: "Select Others", payload: "OCC_Others" }],
  });

  // Row 2: Tier 2 (6 cards)
  const row2 = TIER2_CARD_ORDER.map(occ => ({
    title:     occ,
    subtitle:  "Tap to select",
    image_url: OCCASION_IMAGES[occ] || OCCASION_IMAGES["Others"],
    buttons:   [{ type: "postback", title: `Select ${occ}`, payload: `OCC_${encodeURIComponent(occ)}` }],
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
        content_type: "text",
        title: o.title,
        payload: `OTHERSUB_${encodeURIComponent(o.title)}`,
      })),
    },
  });
}

// ── MESSENGER API HELPERS ─────────────────────────────────────────────────────
async function callAPI(body) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      body
    );
  } catch (e) {
    console.error("Messenger API error:", e.response?.data || e.message);
  }
}

async function sendText(uid, text) {
  await callAPI({ recipient: { id: uid }, message: { text } });
}

async function sendButtonMsg(uid, text, buttons) {
  await callAPI({
    recipient: { id: uid },
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "button", text, buttons },
      },
    },
  });
}

async function sendGenericTemplate(uid, elements) {
  await callAPI({
    recipient: { id: uid },
    message: {
      attachment: {
        type: "template",
        payload: { template_type: "generic", elements },
      },
    },
  });
}

// ── SERVER ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Framepoint bot running on port ${PORT}`));

// ── ONE-TIME: Run this endpoint once to set up Get Started button ─────────────
// Visit: https://your-railway-url.app/setup once after deploying
app.get("/setup", async (req, res) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        get_started: { payload: "START_BOOKING" },
        greeting: [
          {
            locale: "default",
            text: "Hi {{user_first_name}}! Welcome to Framepoint Photography 📸\n\nTap Get Started to book your shoot!",
          },
        ],
        persistent_menu: [
          {
            locale: "default",
            composer_input_disabled: false,
            call_to_actions: [
              { type: "postback", title: "📅 Book an Appointment", payload: "START_BOOKING" },
              { type: "postback", title: "💬 Talk to Our Team",    payload: "TALK_HUMAN"    },
            ],
          },
        ],
      }
    );
    res.send("✅ Messenger profile set up successfully! Get Started button, greeting, and persistent menu are now active.");
  } catch (e) {
    res.status(500).send("❌ Error: " + JSON.stringify(e.response?.data || e.message));
  }
});
