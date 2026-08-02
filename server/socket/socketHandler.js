import Participant from "../models/Participant.js";
import Message from "../models/Message.js";
import Meeting from "../models/Meeting.js";

// roomId -> Map(socketId -> { name, userId })
const rooms = new Map();

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // ---- Join a meeting room ----
    socket.on("join-room", async ({ roomId, name, userId }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = name;
      socket.data.userId = userId;
      socket.data.joinedAt = Date.now();

      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const roomMap = rooms.get(roomId);

      // tell the newcomer about existing peers so it can create offers
      const existingPeers = Array.from(roomMap.entries()).map(([id, info]) => ({
        socketId: id,
        name: info.name,
      }));
      socket.emit("existing-peers", existingPeers);

      roomMap.set(socket.id, { name, userId });

      // tell everyone else a new peer joined
      socket.to(roomId).emit("peer-joined", { socketId: socket.id, name });

      // record attendance (best-effort; ignore if meeting not found)
      try {
        const meeting = await Meeting.findOne({ meetingCode: roomId });
        if (meeting) {
          await Participant.create({ meeting: meeting._id, user: userId || undefined, name });
        }
      } catch (e) {
        console.error("Attendance write failed:", e.message);
      }
    });

    // ---- WebRTC signaling relay (mesh topology) ----
    socket.on("signal", ({ to, data }) => {
      io.to(to).emit("signal", { from: socket.id, data });
    });

    // ---- Media state toggles broadcast to room ----
    socket.on("media-state", ({ roomId, video, audio }) => {
      socket.to(roomId).emit("media-state", { socketId: socket.id, video, audio });
    });

    // ---- Screen share flag ----
    socket.on("screen-share", ({ roomId, sharing }) => {
      socket.to(roomId).emit("screen-share", { socketId: socket.id, sharing });
    });

    // ---- Raise hand ----
    socket.on("raise-hand", ({ roomId, name, raised }) => {
      socket.to(roomId).emit("raise-hand", { socketId: socket.id, name, raised });
    });

    // ---- Chat ----
    socket.on("send-message", async ({ roomId, sender, text }) => {
      const payload = { sender, text, time: new Date() };
      io.to(roomId).emit("receive-message", payload);
      try {
        const meeting = await Meeting.findOne({ meetingCode: roomId });
        if (meeting) {
          await Message.create({ meeting: meeting._id, sender, text });
        }
      } catch (e) {
        console.error("Chat save failed:", e.message);
      }
    });

    // ---- Leave / disconnect ----
    const leaveRoom = async () => {
      const { roomId, name } = socket.data;
      if (!roomId) return;

      const roomMap = rooms.get(roomId);
      if (roomMap) {
        roomMap.delete(socket.id);
        if (roomMap.size === 0) rooms.delete(roomId);
      }

      socket.to(roomId).emit("peer-left", { socketId: socket.id, name });

      try {
        const meeting = await Meeting.findOne({ meetingCode: roomId });
        if (meeting) {
          const seconds = Math.round((Date.now() - (socket.data.joinedAt || Date.now())) / 1000);
          await Participant.findOneAndUpdate(
            { meeting: meeting._id, name },
            { leaveTime: new Date(), attendanceSeconds: seconds },
            { sort: { createdAt: -1 } }
          );
        }
      } catch (e) {
        console.error("Attendance update failed:", e.message);
      }
    };

    socket.on("leave-room", leaveRoom);
    socket.on("disconnect", leaveRoom);
  });
};

export default socketHandler;
