CREATE INDEX `attachments_email_id_idx` ON `attachments` (`email_id`);--> statement-breakpoint
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `enrollments_sequence_status_idx` ON `sequence_enrollments` (`sequence_id`,`status`);--> statement-breakpoint
CREATE INDEX `seq_emails_enrollment_id_idx` ON `sequence_emails` (`enrollment_id`);