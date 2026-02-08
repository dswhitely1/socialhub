import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    platformNotificationId: varchar("platform_notification_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    userReadCreatedIdx: index("notifications_user_read_created_idx").on(
      t.userId,
      t.isRead,
      t.createdAt,
    ),
    platformNotifIdx: uniqueIndex("notifications_platform_notif_idx").on(
      t.userId,
      t.platformNotificationId,
    ),
  }),
);
