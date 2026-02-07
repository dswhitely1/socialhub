// TODO: Notification service for push notifications via Socket.IO

import type { Server } from "socket.io";

export function sendNotification(
  io: Server,
  userId: string,
  notification: { type: string; title: string; body: string },
) {
  io.to(`user:${userId}`).emit("notification", notification);
}
