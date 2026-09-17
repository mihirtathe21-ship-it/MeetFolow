import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import socketHandler from "./socket/socketHandler.js";
import { startReminderJob } from "./utils/reminderJob.js";

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/", (req, res) => res.send("MeetFlow API running"));
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});
socketHandler(io);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`MeetFlow server running on port ${PORT}`));
  startReminderJob();
});
