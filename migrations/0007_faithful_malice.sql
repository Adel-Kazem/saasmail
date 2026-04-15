CREATE TABLE `sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sequence_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`enrolled_at` integer NOT NULL,
	`cancelled_at` integer
);
--> statement-breakpoint
CREATE INDEX `enrollments_sender_status_idx` ON `sequence_enrollments` (`sender_id`,`status`);--> statement-breakpoint
CREATE TABLE `sequence_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`step_order` integer NOT NULL,
	`template_slug` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` integer,
	`sent_email_id` text
);
--> statement-breakpoint
CREATE INDEX `seq_emails_status_scheduled_idx` ON `sequence_emails` (`status`,`scheduled_at`);