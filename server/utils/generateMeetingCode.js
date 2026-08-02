import { customAlphabet } from "nanoid";

const alphabet = "abcdefghijkmnopqrstuvwxyz23456789"; // no confusing chars
const nanoid = customAlphabet(alphabet, 10);

// produces something like: abc-defg-hij
const generateMeetingCode = () => {
  const raw = nanoid();
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 10)}`;
};

export default generateMeetingCode;
