import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const Dashboard = () => {
  const [meetings, setMeetings] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMeetings = async () => {
      const { data } = await api.get("/meetings/all");
      setMeetings(data);
    };
    fetchMeetings();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    try {
      await api.post("/meetings/join", { meetingCode: joinCode, password: joinPassword });
      navigate(`/meeting/${joinCode}`);
    } catch (err) {
      alert(err.response?.data?.message || "Could not join meeting");
    }
  };

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.startTime) >= now);
  const past = meetings.filter((m) => new Date(m.startTime) < now);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={() => navigate("/schedule")}
          className="px-4 py-2 bg-brand text-white rounded-md hover:bg-brand-dark"
        >
          + Schedule Meeting
        </button>

        <form onSubmit={handleJoin} className="flex gap-2 flex-1 min-w-[300px]">
          <input
            placeholder="Meeting code (abc-defg-hij)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="border rounded-md px-3 py-2 flex-1"
            required
          />
          <input
            placeholder="Password (if any)"
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            className="border rounded-md px-3 py-2 w-40"
          />
          <button className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900">
            Join
          </button>
        </form>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Upcoming Meetings</h2>
        {upcoming.length === 0 && <p className="text-slate-500 text-sm">No upcoming meetings.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {upcoming.map((m) => (
            <div key={m._id} className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-medium">{m.title}</h3>
              <p className="text-sm text-slate-500">{new Date(m.startTime).toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Code: {m.meetingCode}</p>
              <button
                onClick={() => navigate(`/meeting/${m.meetingCode}`)}
                className="mt-2 text-sm text-brand hover:underline"
              >
                Start / Join →
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">History</h2>
        {past.length === 0 && <p className="text-slate-500 text-sm">No past meetings yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {past.map((m) => (
            <div key={m._id} className="bg-white rounded-lg shadow-sm p-4 opacity-80">
              <h3 className="font-medium">{m.title}</h3>
              <p className="text-sm text-slate-500">{new Date(m.startTime).toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Status: {m.status}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
