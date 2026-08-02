import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MeetingRoom = () => {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnections = useRef({}); // socketId -> RTCPeerConnection
  const screenTrackRef = useRef(null);

  const canvasRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const drawIntervalRef = useRef(null);

  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> {stream, name}
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [recording, setRecording] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [participants, setParticipants] = useState({}); // socketId -> name

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (!mounted) return;
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.emit("join-room", {
        roomId: code,
        name: user?.name || "Guest",
        userId: user?._id,
      });

      // Create a peer connection for a given remote socket id
      const createPeerConnection = (remoteId, remoteName) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[remoteId] = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("signal", {
              to: remoteId,
              data: { type: "candidate", candidate: event.candidate },
            });
          }
        };

        pc.ontrack = (event) => {
          setRemoteStreams((prev) => ({
            ...prev,
            [remoteId]: { stream: event.streams[0], name: remoteName },
          }));
        };

        return pc;
      };

      // When told about peers already in the room, we initiate offers to them
      socket.on("existing-peers", (peers) => {
        peers.forEach(({ socketId, name }) => {
          setParticipants((prev) => ({ ...prev, [socketId]: name }));
          const pc = createPeerConnection(socketId, name);
          pc.createOffer().then((offer) => {
            pc.setLocalDescription(offer);
            socket.emit("signal", { to: socketId, data: { type: "offer", offer } });
          });
        });
      });

      // A new peer joined after us — wait for their offer
      socket.on("peer-joined", ({ socketId, name }) => {
        setParticipants((prev) => ({ ...prev, [socketId]: name }));
      });

      socket.on("signal", async ({ from, data }) => {
        let pc = peerConnections.current[from];
        if (!pc) {
          pc = createPeerConnection(from, participants[from] || "Guest");
        }

        if (data.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", { to: from, data: { type: "answer", answer } });
        } else if (data.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === "candidate") {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error("ICE candidate error", e);
          }
        }
      });

      socket.on("peer-left", ({ socketId }) => {
        if (peerConnections.current[socketId]) {
          peerConnections.current[socketId].close();
          delete peerConnections.current[socketId];
        }
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[socketId];
          return copy;
        });
      });

      socket.on("receive-message", (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      socket.on("raise-hand", ({ name, raised }) => {
        setMessages((prev) => [
          ...prev,
          { sender: "System", text: `${name} ${raised ? "raised" : "lowered"} their hand`, system: true },
        ]);
      });
    };

    init();

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      socketRef.current?.emit("leave-room");
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoOn(track.enabled);
      socketRef.current.emit("media-state", { roomId: code, video: track.enabled, audio: audioOn });
    }
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioOn(track.enabled);
      socketRef.current.emit("media-state", { roomId: code, video: videoOn, audio: track.enabled });
    }
  };

  const toggleScreenShare = async () => {
    if (!sharing) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      Object.values(peerConnections.current).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

      screenTrack.onended = () => stopScreenShare();
      setSharing(true);
      socketRef.current.emit("screen-share", { roomId: code, sharing: true });
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    const camTrack = localStreamRef.current.getVideoTracks()[0];
    Object.values(peerConnections.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) sender.replaceTrack(camTrack);
    });
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    screenTrackRef.current?.stop();
    setSharing(false);
    socketRef.current.emit("screen-share", { roomId: code, sharing: false });
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    socketRef.current.emit("raise-hand", { roomId: code, name: user?.name || "Guest", raised: next });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current.emit("send-message", {
      roomId: code,
      sender: user?.name || "Guest",
      text: chatInput,
    });
    setChatInput("");
  };

  const leaveMeeting = () => {
    socketRef.current?.emit("leave-room");
    navigate("/dashboard");
  };

  const remoteStreamsRef = useRef({});
  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  // ---- Recording: composite everyone's video onto a canvas + mix all audio ----
  const startRecording = () => {
    const canvas = canvasRef.current;
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    // build video elements to draw from (hidden, already playing via refs on screen,
    // but we create fresh ones bound to the same streams so we can control drawing)
    const getTiles = () => {
      const tiles = [{ stream: localStreamRef.current, name: "You" }];
      Object.values(remoteStreamsRef.current).forEach((r) => tiles.push(r));
      return tiles;
    };

    const videoEls = new Map(); // stream -> HTMLVideoElement

    const ensureVideoEl = (stream) => {
      if (!videoEls.has(stream)) {
        const v = document.createElement("video");
        v.srcObject = stream;
        v.muted = true;
        v.play().catch(() => {});
        videoEls.set(stream, v);
      }
      return videoEls.get(stream);
    };

    drawIntervalRef.current = setInterval(() => {
      const tiles = getTiles();
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const cols = Math.ceil(Math.sqrt(tiles.length)) || 1;
      const rows = Math.ceil(tiles.length / cols);
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      tiles.forEach((tile, i) => {
        if (!tile.stream) return;
        const v = ensureVideoEl(tile.stream);
        const x = (i % cols) * cellW;
        const y = Math.floor(i / cols) * cellH;
        try {
          ctx.drawImage(v, x, y, cellW, cellH);
        } catch {
          // frame not ready yet, skip
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, y + cellH - 22, 90, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.fillText(tile.name, x + 6, y + cellH - 6);
      });
    }, 100);

    // Mix all audio tracks into one stream using the Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;
    const destination = audioCtx.createMediaStreamDestination();
    [localStreamRef.current, ...Object.values(remoteStreamsRef.current).map((r) => r.stream)].forEach(
      (stream) => {
        if (stream && stream.getAudioTracks().length > 0) {
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(destination);
        }
      }
    );

    const canvasStream = canvas.captureStream(15);
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp8,opus" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meetflow-${code}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      clearInterval(drawIntervalRef.current);
      audioCtx.close();
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const toggleRecording = () => (recording ? stopRecording() : startRecording());

  const summarizeMeeting = async () => {
    setSummarizing(true);
    setSummaryError("");
    setSummary(null);
    try {
      const { data } = await api.post(`/meetings/${code}/summarize`);
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(err.response?.data?.message || "Could not generate summary");
    } finally {
      setSummarizing(false);
    }
  };

  const remoteList = Object.entries(remoteStreams);

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 grid gap-2 p-3 auto-rows-fr grid-cols-2 md:grid-cols-3 overflow-auto">
          <VideoTile stream={localStreamRef.current} label={`${user?.name || "You"} (You)`} muted />
          {remoteList.map(([id, { stream, name }]) => (
            <VideoTile key={id} stream={stream} label={name} />
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 py-4 bg-slate-800">
          <ControlButton active={audioOn} onClick={toggleAudio} label={audioOn ? "Mute" : "Unmute"} />
          <ControlButton active={videoOn} onClick={toggleVideo} label={videoOn ? "Stop Video" : "Start Video"} />
          <ControlButton active={sharing} onClick={toggleScreenShare} label={sharing ? "Stop Share" : "Share Screen"} />
          <ControlButton active={handRaised} onClick={toggleHand} label={handRaised ? "Lower Hand" : "Raise Hand"} />
          <ControlButton active={showChat} onClick={() => setShowChat((s) => !s)} label="Chat" />
          <ControlButton
            active={recording}
            onClick={toggleRecording}
            label={recording ? "● Stop Recording" : "Record"}
          />
          <ControlButton
            active={false}
            onClick={summarizeMeeting}
            label={summarizing ? "Summarizing…" : "AI Summary"}
          />
          <button
            onClick={leaveMeeting}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-sm font-medium"
          >
            Leave
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {(summary || summaryError) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-800 rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-3">AI Meeting Summary</h2>
            {summaryError ? (
              <p className="text-red-500 text-sm">{summaryError}</p>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{summary}</p>
            )}
            <button
              onClick={() => {
                setSummary(null);
                setSummaryError("");
              }}
              className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-md text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showChat && (
        <div className="w-80 bg-white text-slate-800 flex flex-col border-l">
          <div className="p-3 border-b font-semibold">In-call messages</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={m.system ? "text-xs text-slate-400 italic" : "text-sm"}>
                {!m.system && <span className="font-medium">{m.sender}: </span>}
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send a message"
              className="flex-1 border rounded-md px-2 py-1 text-sm"
            />
            <button className="px-3 py-1 bg-brand text-white rounded-md text-sm">Send</button>
          </form>
        </div>
      )}
    </div>
  );
};

const VideoTile = ({ stream, label, muted }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[160px]">
      <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
      <span className="absolute bottom-1 left-2 text-xs bg-black/50 px-2 py-0.5 rounded">{label}</span>
    </div>
  );
};

const ControlButton = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md text-sm font-medium ${
      active ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600/80 hover:bg-red-600"
    }`}
  >
    {label}
  </button>
);

export default MeetingRoom;
