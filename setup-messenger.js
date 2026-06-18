// ── RUN THIS ONCE to set up the Get Started button + greeting on your FB page ──
// Usage: PAGE_ACCESS_TOKEN=your_token node setup-messenger.js

const axios = require("axios");
const TOKEN = process.env.PAGE_ACCESS_TOKEN || "YOUR_PAGE_ACCESS_TOKEN";

async function setup() {
  try {
    // 1. Set Get Started button
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messenger_profile?access_token=${TOKEN}`,
      {
        get_started: { payload: "START_BOOKING" },
        greeting: [
          {
            locale: "default",
            text: "Hi {{user_first_name}}! Welcome to Framepoint Photography 📸\n\nTap Get Started to book your shoot!",
          },
        ],
        // Persistent menu (optional — shows hamburger icon in chat)
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
    console.log("✅ Messenger profile set up successfully!");
    console.log("   - Get Started button: active");
    console.log("   - Greeting message: active");
    console.log("   - Persistent menu: active");
  } catch (e) {
    console.error("❌ Error:", e.response?.data || e.message);
  }
}

setup();
