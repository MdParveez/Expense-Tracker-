-- Add specific_date column to bills table
ALTER TABLE bills ADD COLUMN specific_date DATE;

-- Add notification_sent column to track if notification has been sent
ALTER TABLE bills ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;

-- Add notification_hours_before column to specify how many hours before to send notification
ALTER TABLE bills ADD COLUMN notification_hours_before INTEGER DEFAULT 3;

-- Add comment to explain the new columns
COMMENT ON COLUMN bills.specific_date IS 'Specific date when the bill is due (optional)';
COMMENT ON COLUMN bills.notification_sent IS 'Whether a notification has been sent for this bill';
COMMENT ON COLUMN bills.notification_hours_before IS 'How many hours before the due date to send a notification';
