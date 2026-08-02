import Notification from "../models/Notification.js";

// Small helper so any controller can drop an in-app notification for a user.
export const createNotification = async ({ receiver, title, description, meeting }) => {
  try {
    return await Notification.create({ receiver, title, description, meeting });
  } catch (err) {
    console.error("Notification create failed:", err.message);
    return null;
  }
};
