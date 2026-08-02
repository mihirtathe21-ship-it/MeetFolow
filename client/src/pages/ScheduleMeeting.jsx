import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const ScheduleMeeting = () => {
  const [form, setForm] = useState({
    title: "",
    description: "",
    startTime: "",
    duration: 30,
    meetingPassword: "",
    participants: "",
  });
  const [created, setCreated] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      participants: form.participants
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    };
    const { data } = await api.post("/meetings/create", payload);
    setCreated(data);
  };

  if (created) {
    const link = `${window.location.origin}/meeting/${created.meetingCode}`;

    // Build a "Add to Google Calendar" link using Google's public URL scheme.
    // This needs no OAuth/API key — it just opens Google Calendar's pre-filled
    // event creation page in a new tab.
    const toGCalDate = (iso) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
    const start = toGCalDate(created.startTime);
    const end = toGCalDate(new Date(new Date(created.startTime).getTime() + created.duration * 60000));
    const gcalUrl =
      `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(created.title)}` +
      `&dates=${start}/${end}` +
      `&details=${encodeURIComponent(`Join: ${link}\n\n${created.description || ""}`)}`;

    return (
      <div className="max-w-lg mx-auto p-6 mt-10 bg-white rounded-xl shadow-md text-center">
        <h2 className="text-xl font-bold mb-2">Meeting scheduled!</h2>
        <p className="text-sm text-slate-500 mb-4">Share this link with your participants</p>
        <div className="bg-slate-100 rounded-md p-3 break-all text-sm mb-4">{link}</div>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="px-4 py-2 bg-slate-800 text-white rounded-md"
          >
            Copy link
          </button>
          <a
            href={gcalUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Add to Google Calendar
          </a>
          <button
            onClick={() => navigate(`/meeting/${created.meetingCode}`)}
            className="px-4 py-2 bg-brand text-white rounded-md"
          >
            Start now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-3">
        <h1 className="text-xl font-bold mb-2">Schedule a Meeting</h1>
        <input
          name="title"
          placeholder="Meeting title"
          value={form.title}
          onChange={handleChange}
          className="w-full border rounded-md px-3 py-2"
          required
        />
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          type="datetime-local"
          name="startTime"
          value={form.startTime}
          onChange={handleChange}
          className="w-full border rounded-md px-3 py-2"
          required
        />
        <input
          type="number"
          name="duration"
          placeholder="Duration (minutes)"
          value={form.duration}
          onChange={handleChange}
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          type="text"
          name="meetingPassword"
          placeholder="Password (optional)"
          value={form.meetingPassword}
          onChange={handleChange}
          className="w-full border rounded-md px-3 py-2"
        />
        <input
          type="text"
          name="participants"
          placeholder="Participant emails, comma separated"
          value={form.participants}
          onChange={handleChange}
          className="w-full border rounded-md px-3 py-2"
        />
        <button className="w-full bg-brand text-white py-2 rounded-md hover:bg-brand-dark">
          Create Meeting
        </button>
      </form>
    </div>
  );
};

export default ScheduleMeeting;
