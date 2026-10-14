// Voice for ClawRena agents — Deepgram only (verified working; Speechmatics kept
// as a documented alternative). STT transcribes viewer commands; TTS speaks the
// agent's chat lines. Keys read lazily (dotenv loads after the import graph).
const API = 'https://api.deepgram.com/v1';

function key(): string {
  const k = process.env.DEEPGRAM_API_KEY;
  if (!k) throw new Error('DEEPGRAM_API_KEY not loaded');
  return k;
}

// Curated voice roster. Maps the reference's named-voice UI onto real Aura voices.
export const VOICES: Record<string, { aura: string; label: string; gender: string; lang: string }> = {
  'server-default': { aura: 'aura-asteria-en',     label: 'Server default',  gender: '—',      lang: 'en' },
  'andrew':         { aura: 'aura-arcas-en',       label: 'Andrew',  gender: 'male',   lang: 'en' },
  'aria':           { aura: 'aura-asteria-en',     label: 'Aria',    gender: 'female', lang: 'en' },
  'guy':            { aura: 'aura-orion-en',       label: 'Guy',     gender: 'male',   lang: 'en' },
  'jenny':          { aura: 'aura-aurora-en',      label: 'Jenny',   gender: 'female', lang: 'en' },
};

// Emotion -> tiny prosodic prefix. Deepgram has no SSML emotion, so tone is shaped
// by punctuation + a lead-in, which measurably changes delivery.
export const EMOTIONS: Record<string, string> = {
  natural: '', whisper: '', afraid: '', excited: '! ', angry: '! ',
  sad: '... ', suspense: '... ', laughing: 'ha! ',
};

export interface TtsOpts { voiceId?: string; emotion?: string; }
/** Synthesize speech -> MP3 Buffer. */
export async function speak(text: string, opts: TtsOpts = {}): Promise<Buffer> {
  const v = VOICES[opts.voiceId ?? 'server-default'] ?? VOICES['server-default'];
  const prefix = EMOTIONS[(opts.emotion ?? 'natural').toLowerCase()] ?? '';
  const body = JSON.stringify({ text: (prefix + text).slice(0, 1800) });
  const r = await fetch(`${API}/speak?model=${v.aura}&encoding=mp3`, {
    method: 'POST',
    headers: { Authorization: `Token ${key()}`, 'Content-Type': 'application/json' },
    body,
  });
  if (!r.ok) throw new Error(`deepgram tts ${r.status}: ${(await r.text()).slice(0,120)}`);
  return Buffer.from(await r.arrayBuffer());
}

export interface SttResult { transcript: string; confidence: number; }
/** Transcribe audio -> text. Accepts any audio content-type. */
export async function transcribe(audio: Buffer, contentType = 'audio/mpeg'): Promise<SttResult> {
  const r = await fetch(`${API}/listen?model=nova-3&smart_format=true&punctuate=true`, {
    method: 'POST',
    headers: { Authorization: `Token ${key()}`, 'Content-Type': contentType },
    body: new Uint8Array(audio),
  });
  if (!r.ok) throw new Error(`deepgram stt ${r.status}: ${(await r.text()).slice(0,120)}`);
  const j: any = await r.json();
  const alt = j?.results?.channels?.[0]?.alternatives?.[0];
  return { transcript: alt?.transcript ?? '', confidence: alt?.confidence ?? 0 };
}

export function listVoices() {
  return Object.entries(VOICES).map(([id, v]) => ({ id, ...v }));
}
