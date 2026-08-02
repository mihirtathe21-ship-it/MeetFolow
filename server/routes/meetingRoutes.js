import express from "express";
import {
  createMeeting,
  getMyMeetings,
  getMeetingByCode,
  joinMeeting,
  updateMeeting,
  deleteMeeting,
  getAttendance,
  getChatHistory,
  summarizeMeeting,
} from "../controllers/meetingController.js";
import protect from "../middleware/auth.js";

const router = express.Router();

router.post("/create", protect, createMeeting);
router.get("/all", protect, getMyMeetings);
router.get("/:code", protect, getMeetingByCode);
router.post("/join", protect, joinMeeting);
router.put("/:id", protect, updateMeeting);
router.delete("/:id", protect, deleteMeeting);
router.get("/:code/attendance", protect, getAttendance);
router.get("/:code/chat-history", protect, getChatHistory);
router.post("/:code/summarize", protect, summarizeMeeting);

export default router;
