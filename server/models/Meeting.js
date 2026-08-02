import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    meetingCode: { type: String, required: true, unique: true },
    meetingPassword: { type: String, default: "" },
    startTime: { type: Date, required: true },
    duration: { type: Number, default: 30 },
    participants: [{ type: String }],
    status: { type: String, enum: ["scheduled", "live", "ended"], default: "scheduled" },
    recordingUrl: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Meeting", meetingSchema);
