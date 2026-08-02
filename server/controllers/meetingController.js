import Meeting from "../models/Meeting.js";
import Participant from "../models/Participant.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import generateMeetingCode from "../utils/generateMeetingCode.js";
import { sendEmail, meetingInviteTemplate } from "../utils/emailService.js";
import { createNotification } from "../utils/notify.js";
import { summarizeText } from "../utils/aiSummary.js";

// POST /api/meetings/create
export const createMeeting = async (req, res) => {
  try {
    const { title, description, startTime, duration, participants, meetingPassword } = req.body;

    let meetingCode;
    let exists = true;
    while (exists) {
      meetingCode = generateMeetingCode();
      exists = await Meeting.findOne({ meetingCode });
    }

    const meeting = await Meeting.create({
      title,
      description,
      host: req.user._id,
      meetingCode,
      meetingPassword: meetingPassword || "",
      startTime,
      duration: duration || 30,
      participants: participants || [],
    });

    // Fire-and-forget: email invites + in-app notifications for invited users
    const link = `${process.env.CLIENT_URL}/meeting/${meetingCode}`;
    (participants || []).forEach(async (email) => {
      sendEmail({
        to: email,
        subject: `Invitation: ${title}`,
        html: meetingInviteTemplate({
          hostName: req.user.name,
          title,
          startTime,
          link,
          meetingCode,
        }),
      });

      const invitedUser = await User.findOne({ email: email.toLowerCase() });
      if (invitedUser) {
        createNotification({
          receiver: invitedUser._id,
          title: `Meeting invite: ${title}`,
          description: `${req.user.name} invited you to a meeting at ${new Date(
            startTime
          ).toLocaleString()}`,
          meeting: meeting._id,
        });
      }
    });

    return res.status(201).json(meeting);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings/all
export const getMyMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user._id }, { participants: req.user.email }],
    }).sort({ startTime: -1 });
    return res.json(meetings);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings/:code
export const getMeetingByCode = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingCode: req.params.code }).populate(
      "host",
      "name email"
    );
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    return res.json(meeting);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/meetings/join
export const joinMeeting = async (req, res) => {
  try {
    const { meetingCode, password } = req.body;
    const meeting = await Meeting.findOne({ meetingCode });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.meetingPassword && meeting.meetingPassword !== password) {
      return res.status(401).json({ message: "Incorrect meeting password" });
    }

    meeting.status = "live";
    await meeting.save();

    return res.json({ message: "Access granted", meeting });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PUT /api/meetings/:id
export const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    Object.assign(meeting, req.body);
    await meeting.save();
    return res.json(meeting);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/meetings/:id
export const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await meeting.deleteOne();
    return res.json({ message: "Meeting deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings/:code/attendance
export const getAttendance = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingCode: req.params.code });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const participants = await Participant.find({ meeting: meeting._id });
    return res.json(participants);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/meetings/:code/chat-history
export const getChatHistory = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingCode: req.params.code });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const chat = await Message.find({ meeting: meeting._id }).sort({ createdAt: 1 });
    return res.json(chat);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/meetings/:code/summarize  (AI summary of the chat log — requires OPENAI_API_KEY)
export const summarizeMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingCode: req.params.code });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    const chat = await Message.find({ meeting: meeting._id }).sort({ createdAt: 1 });
    if (chat.length === 0) {
      return res.status(400).json({ message: "No chat messages to summarize yet" });
    }

    const transcript = chat.map((m) => `${m.sender}: ${m.text}`).join("\n");
    const summary = await summarizeText(transcript, meeting.title);

    meeting.aiSummary = summary;
    await meeting.save();

    return res.json({ summary });
  } catch (err) {
    return res.status(err.status === "not_configured" ? 501 : 500).json({ message: err.message });
  }
};
