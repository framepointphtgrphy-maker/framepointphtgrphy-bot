# Framepoint Photography — Messenger Bot Setup Guide

## What you'll set up (free, one-time, ~30 minutes)

1. Meta Developer account → get your Page Access Token
2. Deploy the bot to Railway.app (free hosting)
3. Connect your Facebook Page to the bot
4. Go live!

---

## STEP 1 — Create a Meta Developer App

1. Go to: https://developers.facebook.com
2. Click **My Apps** → **Create App**
3. Choose **Business** → Next
4. App name: `Framepoint Bot` → Create
5. On the dashboard, click **Add Product** → find **Messenger** → click **Set Up**

---

## STEP 2 — Connect your Facebook Page

1. In Messenger settings, scroll to **Access Tokens**
2. Click **Add or Remove Pages** → select your **Framepoint Photography** page
3. Click **Generate Token** → copy this token (this is your `PAGE_ACCESS_TOKEN`)
4. Save it somewhere safe!

---

## STEP 3 — Deploy to Railway (free hosting)

1. Go to: https://railway.app → sign up free with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
   - OR click **New Project** → **Empty Project** → **Add Service** → **GitHub Repo**
3. Upload the two files (`index.js` and `package.json`) to a GitHub repository
   - Go to github.com → New repository → name it `framepoint-bot`
   - Upload both files
4. Connect Railway to that GitHub repo
5. Railway will auto-detect Node.js and deploy it
6. Go to **Settings** → **Networking** → **Generate Domain**
   - Copy your URL, e.g. `https://framepoint-bot.up.railway.app`

---

## STEP 4 — Add Environment Variables in Railway

In Railway → your project → **Variables** tab, add:

| Variable Name      | Value                          |
|--------------------|-------------------------------|
| PAGE_ACCESS_TOKEN  | (paste your token from Step 2) |
| VERIFY_TOKEN       | framepointbot2024              |
| PORT               | 3000                           |

Click **Deploy** after saving.

---

## STEP 5 — Register your Webhook with Meta

1. Go back to developers.facebook.com → your app → Messenger → Settings
2. Scroll to **Webhooks** → click **Add Callback URL**
3. Callback URL: `https://YOUR-RAILWAY-URL.up.railway.app/webhook`
4. Verify Token: `framepointbot2024`
5. Click **Verify and Save**
6. Under **Webhook Fields**, subscribe to: `messages`, `messaging_postbacks`
7. Under **Subscriptions**, click **Add Subscriptions** → select your Framepoint page

---

## STEP 6 — Set Up the "Get Started" Button

Run this once in your terminal (or use Postman):

```
curl -X POST "https://graph.facebook.com/v19.0/me/messenger_profile" \
  -H "Content-Type: application/json" \
  -d '{
    "get_started": {"payload": "GET_STARTED"},
    "greeting": [{"locale": "default", "text": "Hi! Welcome to Framepoint Photography. Tap Get Started to book your shoot! 📸"}]
  }' \
  "?access_token=YOUR_PAGE_ACCESS_TOKEN"
```

Replace `YOUR_PAGE_ACCESS_TOKEN` with your actual token.

---

## STEP 7 — Test it!

1. Open your Facebook Page
2. Click **Send Message**
3. You should see the **Get Started** button
4. Tap it — the bot will respond with event cards!

---

## Customizing your bot

### Update your photos
In `index.js`, find `EVENT_IMAGES` and replace the URLs with your actual Framepoint photos:

```js
const EVENT_IMAGES = {
  Birthday:    "https://your-photo-url/birthday.jpg",
  Wedding:     "https://your-photo-url/wedding.jpg",
  // ... etc
};
```

You can upload photos to your Facebook Page and copy the image URL, or use Google Drive / Dropbox public links.

### Update pricing
In `index.js`, find `const PRICES` and update with your actual rates.

---

## Need help?

If you get stuck on any step, take a screenshot and share it — I can walk you through it!
