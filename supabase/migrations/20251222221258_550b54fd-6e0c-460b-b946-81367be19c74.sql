-- Create lesson_reminders table to store scheduled reminders
CREATE TABLE public.lesson_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  lesson_title TEXT NOT NULL,
  lesson_date TEXT NOT NULL,
  lesson_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  lesson_start_utc TIMESTAMPTZ NOT NULL,
  reminder_time TIMESTAMPTZ NOT NULL,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lesson_reminders ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access this table (edge functions use service role)
CREATE POLICY "Service role only" ON public.lesson_reminders
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Add index for efficient querying of pending reminders
CREATE INDEX idx_lesson_reminders_pending ON public.lesson_reminders (reminder_time, reminder_sent) 
WHERE reminder_sent = false;