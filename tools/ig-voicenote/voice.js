export async function speak(text, { key, voiceId, model }) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model || 'eleven_multilingual_v2' }),
    },
  );
  if (!res.ok) {
    let msg = `ElevenLabs error ${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail?.message || j.detail?.status || (typeof j.detail === 'string' ? j.detail : msg);
    } catch {}
    throw new Error(msg);
  }
  return res.arrayBuffer();
}
