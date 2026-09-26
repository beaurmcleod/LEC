function voiceSettings(s) {
  return {
    stability: s.stability,
    similarity_boost: s.similarity,
    style: s.style,
    use_speaker_boost: s.speakerBoost,
    speed: s.speed,
  };
}

async function request({ key, voiceId, model }, text, settings) {
  const body = { text, model_id: model || 'eleven_multilingual_v2' };
  if (settings) body.voice_settings = settings;
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
}

async function errorText(res) {
  let msg = `ElevenLabs error ${res.status}`;
  try {
    const j = await res.json();
    msg = j.detail?.message || j.detail?.status || (typeof j.detail === 'string' ? j.detail : msg);
  } catch {}
  return msg;
}

// Newer models (v3/v4) accept fewer voice settings, and v3 only takes stability 0, 0.5 or 1.
// Try the full slider set first, then step down so a model that rejects some settings still speaks.
export async function speak(text, s) {
  const attempts = [voiceSettings(s), { stability: Math.round(s.stability * 2) / 2 }, null];
  let res;
  for (const settings of attempts) {
    res = await request(s, text, settings);
    if (res.ok) return res.arrayBuffer();
    if (res.status !== 400 && res.status !== 422) break;
  }
  throw new Error(await errorText(res));
}
