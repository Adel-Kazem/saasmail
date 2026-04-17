PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sender_identities` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`display_mode` text DEFAULT 'thread' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_sender_identities`("email", "display_name", "display_mode", "created_at", "updated_at") SELECT "email", "display_name", 'thread', "created_at", "updated_at" FROM `sender_identities`;--> statement-breakpoint
DROP TABLE `sender_identities`;--> statement-breakpoint
ALTER TABLE `__new_sender_identities` RENAME TO `sender_identities`;--> statement-breakpoint
PRAGMA foreign_keys=ON;