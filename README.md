# MeetFlow — Smart Meeting Scheduler & Video Conferencing (MVP)

A working core of the Google Meet-style platform described in the blueprint: auth, meeting
scheduling with unique links/codes, and a live meeting room with WebRTC video, mic/camera
controls, screen sharing, raise hand, real-time chat, and basic attendance logging.

## What's implemented (fully working)
- JWT auth: register / login / protected profile route
- **Forgot / reset password** — real email flow. If you don't set SMTP creds, the server
  auto-creates a free Ethereal test inbox at startup and logs a preview link to the console,
  so it works out of the box with zero configuration.
- **Meeting invitation emails** sent to every participant when a meeting is created (same
  Ethereal-or-real-SMTP email service).
- **In-app notifications** — bell icon in the navbar, polls every 20s, mark-as-read / mark-all-read.
  Fired on: meeting invite received, 10-minutes-before reminder.
- **Automated email + notification reminders** — a `node-cron` job checks every minute for
  meetings starting in ~10 minutes and notifies host + participants once.
- **Add to Google Calendar** button on the "meeting scheduled" screen — uses Google Calendar's
  public pre-fill URL scheme, no OAuth/API key needed.
- Meeting CRUD: create, list "my meetings", get by code, update, delete
- Join flow with optional meeting password
- Live meeting room: mesh WebRTC (native RTCPeerConnection, STUN only) via Socket.IO signaling
- Mute/unmute, camera on/off, screen share (replaces the video track), raise hand
- Real-time chat (Socket.IO), persisted to MongoDB, retrievable via `/meetings/:code/chat-history`
- **Meeting recording** — composites every participant's video into a grid on a canvas, mixes
  all audio tracks via the Web Audio API, records with `MediaRecorder`, and downloads a `.webm`
  file when you stop. Fully client-side, no cloud storage needed.
- **AI meeting summary** — "AI Summary" button in the meeting room sends the chat transcript to
  any OpenAI-compatible endpoint and returns an overview + key points + action items. Disabled
  with a clear message until you set `OPENAI_API_KEY`.
- Attendance: join/leave time + duration written to MongoDB per participant
- Dashboard: upcoming meetings vs. history, quick join by code

## What's stubbed / not built yet (from the original blueprint)
These still need real third-party credentials that I can't provision for you:
- Google OAuth login (needs a Google Cloud OAuth client — the "Add to Calendar" link above
  doesn't need this, but a full two-way Calendar *sync* would)
- Cloud-hosted recording storage via Cloudinary (recording works today, just saves locally
  instead of uploading)
- Background blur / virtual background (needs a segmentation model like MediaPipe/TF.js —
  can add if you want it)
- Speech-to-text transcript + sentiment analysis (needs Whisper or a streaming STT API)
- Smart meeting-time suggestions from calendar availability (needs Calendar API + OAuth)
- TURN server (needed for real-world NAT traversal beyond same-network testing — see note below)

Tell me which of these you want next and I'll add it directly into this same project.

## Run it locally

### 1. Backend
```
cd server
cp .env.example .env     # fill in MONGO_URI and JWT_SECRET (email + AI vars are optional)
npm install
npm run dev              # http://localhost:5000
```
Leave `SMTP_*` blank to use an auto-created Ethereal test inbox (emails "send" successfully and
you get a preview link logged to the console — nothing is actually delivered). Leave
`OPENAI_API_KEY` blank and everything still runs; only the "AI Summary" button will show a
clear "not configured" message instead of a summary.

### 2. Frontend
```
cd client
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

### 3. Try it
1. Register two accounts (or use one account + an incognito window for the second participant).
2. Log in, click **Schedule Meeting**, set a title/time, create it.
3. Click **Start now** — this opens `/meeting/<code>`.
4. Open the same link in a second browser/incognito window, logged in as the other user, and click **Join** on the dashboard using the same meeting code.
5. You should see both video tiles, be able to chat, mute/unmute, and share your screen.

## Important note on WebRTC in production
This MVP only configures a public STUN server (`stun.l.google.com`). That's enough for testing on
the same network or most direct connections, but real-world deployments (users behind strict
NATs/corporate firewalls) need a **TURN server** (e.g. via [Twilio's Network Traversal Service](https://www.twilio.com/docs/stun-turn) or a self-hosted [coturn](https://github.com/coturn/coturn)) or calls will silently fail to connect for some
user pairs. Add it to `ICE_SERVERS` in `client/src/pages/MeetingRoom.jsx`.

Also note: this uses **mesh topology** (every participant connects directly to every other
participant), which is fine for demos/small calls (~4-6 people) but doesn't scale — a real
Zoom/Meet uses an SFU (e.g. mediasoup, LiveKit, Janus) to fan out media server-side. Worth
mentioning in your project report/viva as a known scaling limitation and future improvement.

## Folder structure
```
MeetFlow/
├── server/   Express + MongoDB + Socket.IO API
└── client/   React + Vite + Tailwind frontend
```
