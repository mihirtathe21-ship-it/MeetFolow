import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    joinTime: { type: Date, default: Date.now },
    leaveTime: { type: Date },
    attendanceSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Participant", participantSchema);
