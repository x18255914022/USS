export const NOTIFICATIONS_QUEUE = "notifications";

export type NotificationChannel = "TELEGRAM";
export type NotificationJobName = "change_notification" | "class_reminder" | "direct_message";

export type ChangeNotificationJob = {
  kind: "change_notification";
  notificationId: string;
  channel: NotificationChannel;
  chatId: string;
  text: string;
};

export type DirectMessageJob = {
  kind: "direct_message";
  channel: NotificationChannel;
  chatId: string;
  text: string;
};

export type ClassReminderJob = {
  kind: "class_reminder";
  notificationId: string;
  channel: NotificationChannel;
  chatId: string;
  text: string;
  sendAt: string;
};

export type NotificationJob = ChangeNotificationJob | DirectMessageJob | ClassReminderJob;

