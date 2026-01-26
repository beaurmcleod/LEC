-- Create lesson_bookings table to track all booked lessons
CREATE TABLE public.lesson_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  customer_first_name text,
  customer_last_name text,
  product_id uuid REFERENCES public.products(id),
  product_title text NOT NULL,
  lesson_date text NOT NULL,
  lesson_time text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  amount_paid integer NOT NULL DEFAULT 0,
  stripe_payment_id text,
  cancellation_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'confirmed',
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lesson_bookings ENABLE ROW LEVEL SECURITY;

-- Only admins can view all bookings
CREATE POLICY "Admins can view all lesson bookings"
ON public.lesson_bookings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage bookings
CREATE POLICY "Admins can manage lesson bookings"
ON public.lesson_bookings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for fast lookup by cancellation token
CREATE INDEX idx_lesson_bookings_cancellation_token ON public.lesson_bookings(cancellation_token);

-- Create index for lookup by email
CREATE INDEX idx_lesson_bookings_customer_email ON public.lesson_bookings(customer_email);

-- Add trigger for updated_at
CREATE TRIGGER update_lesson_bookings_updated_at
  BEFORE UPDATE ON public.lesson_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();