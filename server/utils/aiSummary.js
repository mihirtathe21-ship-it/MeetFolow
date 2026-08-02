import OpenAI from "openai";

// Works with any OpenAI-compatible endpoint (OpenAI directly, or Gemini/
// OpenRouter/etc via their OpenAI-compatible base URL). If no API key is
// configured, we throw a clearly-labelled error instead of silently failing.
export const summarizeText = async (transcript, meetingTitle) => {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error(
      "AI summary is not configured. Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL / OPENAI_MODEL) in server/.env."
    );
    err.status = "not_configured";
    throw err;
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You summarize meeting chat logs. Return: 1) a 2-3 sentence overview, " +
          "2) key discussion points as bullet points, 3) action items as bullet points " +
          "(if any). Be concise and only use information present in the transcript.",
      },
      {
        role: "user",
        content: `Meeting title: ${meetingTitle}\n\nChat transcript:\n${transcript}`,
      },
    ],
    temperature: 0.3,
  });

  return completion.choices[0].message.content;
};
