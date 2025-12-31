-- Add admin access policy for download_tokens
CREATE POLICY "Admins can view all download tokens"
ON public.download_tokens
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin management policy for download_tokens
CREATE POLICY "Admins can manage download tokens"
ON public.download_tokens
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));