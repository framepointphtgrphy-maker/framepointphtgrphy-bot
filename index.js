const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// ── CONFIG ── paste your tokens here ──────────────────────────────────────────
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "YOUR_PAGE_ACCESS_TOKEN";
const VERIFY_TOKEN      = process.env.VERIFY_TOKEN      || "framepointbot2024";
// ─────────────────────────────────────────────────────────────────────────────

// In-memory session store (resets on redeploy — fine for MVP)
const sessions = {};

// ── PRICING TABLE ─────────────────────────────────────────────────────────────
const PRICES = {
  Birthday: {
    Kiddie: { "Photo Only": "₱4,000", "Photo + Video": "₱6,500" },
    Adult:  { "Photo Only": "₱5,000", "Photo + Video": "₱8,000" },
    Debut:  { "Photo Only": "₱6,000", "Photo + Video": "₱10,000" },
  },
  Wedding:     { "Photo Only": "₱8,000",  "Photo + Video": "₱15,000" },
  Christening: { "Photo Only": "₱4,000",  "Photo + Video": "₱6,500"  },
  Graduation:  { "Photo Only": "₱4,500",  "Photo + Video": "₱7,000"  },
  Corporate:   { "Photo Only": "₱6,000",  "Photo + Video": "₱10,000" },
  Pictorial:   { "Photo Only": "₱3,500",  "Photo + Video": "₱5,500"  },
  Others:      null,
};

// ── EVENT IMAGE URLs ──────────────────────────────────────────────────────────
// Replace these with your actual Framepoint Photography photos!
const EVENT_IMAGES = {
  Birthday:    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
  Wedding:     "https://images.unsplash.com/photo-1519741497674-611481863552?w=400",
  Christening: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
  Graduation:  "https://images.unsplash.com/photo-1627556704283-84ec105b4dde?w=400",
  Corporate:   "https://images.unsplash.com/photo-1511578314322-379afb476865?w=400",
  Pictorial:   "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400",
  Others:      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400",
};

// ── WEBHOOK VERIFICATION ──────────────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    console.log("Webhook verified!");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

// ── WEBHOOK RECEIVER ──────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // always ack immediately
  const body = req.body;
  if (body.object !== "page") return;

  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      const senderId = event.sender.id;
      if (!sessions[senderId]) sessions[senderId] = { step: "start" };

      if (event.postback) {
        await handlePostback(senderId, event.postback.payload);
      } else if (event.message && !event.message.is_echo) {
        await handleMessage(senderId, event.message.text || "");
      }
    }
  }
});

// ── HANDLE POSTBACK (button taps) ────────────────────────────────────────────
async function handlePostback(uid, payload) {
  const s = sessions[uid];

  if (payload === "GET_STARTED") {
    s.step = "event";
    await sendText(uid,
      "Hi! Welcome to Framepoint Photography! 📸\n\nI'm here to help you book your shoot. What type of event are you planning?"
    );
    await sendEventCards(uid);
    return;
  }

  if (payload.startsWith("EVENT_")) {
    const event = payload.replace("EVENT_", "");
    s.event = event;
    if (event === "Birthday") {
      s.step = "btype";
      await sendText(uid, "A birthday shoot — love it! 🎂 What type of birthday is this?");
      await sendQuickReplies(uid, "Choose one:", ["Kiddie", "Adult", "Debut"]);
    } else if (event === "Others") {
      s.step = "other_desc";
      await sendText(uid, "No problem! Please describe your event and we'll prepare a custom quote for you.");
    } else {
      s.step = "coverage";
      await sendText(uid, `Great choice! What coverage do you need for your ${event}?`);
      await sendQuickReplies(uid, "Select coverage:", ["Photo Only", "Photo + Video"]);
    }
    return;
  }

  if (payload.startsWith("BTYPE_")) {
    s.btype = payload.replace("BTYPE_", "");
    s.step = "coverage";
    await sendText(uid, `A ${s.btype} birthday! What coverage do you need?`);
    await sendQuickReplies(uid, "Select coverage:", ["Photo Only", "Photo + Video"]);
    return;
  }

  if (payload.startsWith("COVERAGE_")) {
    s.coverage = payload.replace("COVERAGE_", "").replace("_", " + ");
    s.step = "name";
    await sendText(uid, "Perfect! May I have your full name?");
    return;
  }

  if (payload === "BOOK_ANOTHER") {
    sessions[uid] = { step: "event" };
    await sendText(uid, "Sure! What type of event are you planning?");
    await sendEventCards(uid);
    return;
  }

  if (payload === "TALK_HUMAN") {
    await sendText(uid,
      "Our team has been notified and will message you shortly! 😊\n\nYou can also reach us directly:\n📘 facebook.com/framepoint.co"
    );
    sessions[uid] = { step: "done" };
    return;
  }
}

// ── HANDLE FREE-TEXT MESSAGES ─────────────────────────────────────────────────
async function handleMessage(uid, text) {
  const s = sessions[uid];
  const t = text.trim();

  switch (s.step) {
    case "start":
      s.step = "event";
      await sendText(uid,
        "Hi! Welcome to Framepoint Photography! 📸\n\nI'm here to help you book your shoot. What type of event are you planning?"
      );
      await sendEventCards(uid);
      break;

    case "event":
      // Try to match typed event names
      const matched = Object.keys(PRICES).find(e =>
        t.toLowerCase().includes(e.toLowerCase())
      );
      if (matched) {
        await handlePostback(uid, `EVENT_${matched}`);
      } else {
        await sendText(uid, "Please choose your event type below:");
        await sendEventCards(uid);
      }
      break;

    case "btype":
      const types = ["Kiddie", "Adult", "Debut"];
      const bt = types.find(b => t.toLowerCase().includes(b.toLowerCase()));
      if (bt) {
        await handlePostback(uid, `BTYPE_${bt}`);
      } else {
        await sendQuickReplies(uid, "Please choose a birthday type:", types);
      }
      break;

    case "coverage":
      if (t.toLowerCase().includes("video")) {
        await handlePostback(uid, "COVERAGE_Photo_+_Video");
      } else if (t.toLowerCase().includes("photo")) {
        await handlePostback(uid, "COVERAGE_Photo Only");
      } else {
        await sendQuickReplies(uid, "Please choose your coverage:", ["Photo Only", "Photo + Video"]);
      }
      break;

    case "name":
      s.name = t;
      s.step = "venue";
      await sendText(uid, `Nice to meet you, ${t}! 😊 What is your venue or location?`);
      break;

    case "venue":
      s.venue = t;
      s.step = "date";
      await sendText(uid, "What is your preferred event date?");
      break;

    case "date":
      s.date = t;
      await sendBookingSummary(uid);
      break;

    case "other_desc":
      s.otherDesc = t;
      s.step = "name";
      await sendText(uid, `Got it! I've noted your event. May I have your full name?`);
      break;

    default:
      await sendText(uid,
        "Thanks for reaching out to Framepoint Photography! 📸 Our team will get back to you shortly.\n\nType \"hi\" to start a new booking."
      );
  }
}

// ── SEND BOOKING SUMMARY ─────────────────────────────────────────────────────
async function sendBookingSummary(uid) {
  const s = sessions[uid];
  let rate = "Custom quote — our team will reach out";

  if (s.event === "Birthday" && s.btype) {
    rate = PRICES.Birthday[s.btype]?.[s.coverage] || rate;
  } else if (s.event && PRICES[s.event]) {
    rate = PRICES[s.event][s.coverage] || rate;
  }

  const summary =
    `✅ Booking Inquiry Summary\n\n` +
    `👤 Name: ${s.name || "—"}\n` +
    `🎉 Event: ${s.event}${s.btype ? ` (${s.btype})` : ""}\n` +
    `📷 Coverage: ${s.coverage || "—"}\n` +
    `📍 Venue: ${s.venue || "—"}\n` +
    `📅 Date: ${s.date || "—"}\n` +
    `💰 Rate: ${rate}\n\n` +
    `Our team will confirm your booking soon! Thank you for choosing Framepoint Photography. 🙏`;

  await sendText(uid, summary);

  await sendButtonMessage(uid,
    "Is there anything else you need?",
    [
      { type: "postback", title: "Book another event", payload: "BOOK_ANOTHER" },
      { type: "postback", title: "Talk to our team",   payload: "TALK_HUMAN"   },
    ]
  );

  sessions[uid] = { step: "done" };
}

// ── MESSENGER API HELPERS ─────────────────────────────────────────────────────
async function callAPI(body) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      body
    );
  } catch (e) {
    console.error("API error:", e.response?.data || e.message);
  }
}

async function sendText(uid, text) {
  await callAPI({ recipient: { id: uid }, message: { text } });
}

async function sendQuickReplies(uid, text, options) {
  await callAPI({
    recipient: { id: uid },
    message: {
      text,
      quick_replies: options.map(o => ({
        content_type: "text",
        title: o,
        payload: o.startsWith("Photo") ? `COVERAGE_${o}` :
                 ["Kiddie","Adult","Debut"].includes(o) ? `BTYPE_${o}` : o,
      })),
    },
  });
}

async function sendEventCards(uid) {
  const events = Object.keys(PRICES);
  // Messenger generic template (image + title + button), max 10 cards
  const elements = events.map(ev => ({
    title: ev,
    image_url: EVENT_IMAGES[ev] || EVENT_IMAGES.Others,
    subtitle: ev === "Others" ? "Something special? Let us know!" : `Book your ${ev} shoot`,
    buttons: [{ type: "postback", title: `Book ${ev}`, payload: `EVENT_${ev}` }],
  }));

  await callAPI({
    recipient: { id: uid },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements,
        },
      },
    },
  });
}

async function sendButtonMessage(uid, text, buttons) {
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

// ── SERVER ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Framepoint bot running on port ${PORT}`));
