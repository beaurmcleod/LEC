UPDATE public.product_downloads
SET download_path = 'LEC/Key & BPM Finder 2.1.zip',
    download_url = 'LEC/Key & BPM Finder 2.1.zip'
WHERE product_id = '8fbb3028-e57f-4e44-91ab-44f9229aaf8f';

UPDATE public.products
SET full_description = E'Thank you for purchasing Key & BPM Finder 2.1!\n\nKey & BPM Finder 2.1 is a native Ableton Live Max for Live device designed to help you quickly detect the key and BPM of reference tracks directly inside Ableton Live.\n\nPlease note: this device is intended for full reference tracks and longer audio files. It is not designed for one-shot samples, and results may be less accurate when analyzing short sounds.\n\nImportant Notes:\n• The device must be placed on a MIDI track\n• It may affect audio routed through the track, so it''s recommended to use it on a dedicated track\n• Simply drag and drop your reference track into the labeled drop area to begin analysis\n\nWatch a quick walkthrough here:\nhttps://youtu.be/SOjierLwIew?si=enYI6yg0FVZyA6Jf'
WHERE id = '8fbb3028-e57f-4e44-91ab-44f9229aaf8f';