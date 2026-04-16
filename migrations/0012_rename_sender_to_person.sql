-- Rename senders table to people
ALTER TABLE senders RENAME TO people;

-- Rename sender_id columns
ALTER TABLE emails RENAME COLUMN sender_id TO person_id;
ALTER TABLE sent_emails RENAME COLUMN sender_id TO person_id;
ALTER TABLE sequence_enrollments RENAME COLUMN sender_id TO person_id;

-- Recreate indexes with new names
DROP INDEX IF EXISTS senders_last_email_at_idx;
CREATE INDEX people_last_email_at_idx ON people(last_email_at);

DROP INDEX IF EXISTS emails_sender_received_idx;
CREATE INDEX emails_person_received_idx ON emails(person_id, received_at);

DROP INDEX IF EXISTS sent_emails_sender_sent_idx;
CREATE INDEX sent_emails_person_sent_idx ON sent_emails(person_id, sent_at);

DROP INDEX IF EXISTS enrollments_sender_status_idx;
CREATE INDEX enrollments_person_status_idx ON sequence_enrollments(person_id, status);
