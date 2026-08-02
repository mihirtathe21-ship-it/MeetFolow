import cron from "node-cron";
import Meeting from "../models/Meeting.js";
import User from "../models/User.js";
import { sendEmail, reminderTemplate } from "./emailService.js";
import { createNotification } from "./notify.js";

// Runs every minute, finds meetings starting in ~10 minutes that haven't
// been reminded yet, and emails + notifies the host and invited participants.
export const startReminderJob = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);

      const meetings = await Meeting.find({
        startTime: { $gte: windowStart, $lte: windowEnd },
        status: "scheduled",
        reminderSent: { $ne: true },
      }).populate("host", "name email");

      for (const meeting of meetings) {
        const link = `${process.env.CLIENT_URL}/meeting/${meeting.meetingCode}`;
        const recipients = [meeting.host.email, ...meeting.participants];

        for (const email of recipients) {
          sendEmail({
            to: email,
            subject: `Reminder: ${meeting.title} starts in 10 minutes`,
            html: reminderTemplate({ title: meeting.title, startTime: meeting.startTime, link }),
          });

          const recipientUser =
            email === meeting.host.email ? meeting.host : await User.findOne({ email });
          if (recipientUser) {
            createNotification({
              receiver: recipientUser._id,
              title: `Starting soon: ${meeting.title}`,
              description: "This meeting starts in about 10 minutes.",
              meeting: meeting._id,
            });
          }
        }

        meeting.reminderSent = true;
        await meeting.save();
      }
    } catch (err) {
      console.error("Reminder job error:", err.message);
    }
  });

  console.log("Meeting reminder cron job started (runs every minute)");
};
