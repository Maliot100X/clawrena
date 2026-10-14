'use client';
import { useRef, useState } from 'react';

const VOICES = [
  { id: 'server-default', label: 'Server default', desc: 'the server picks' },
  { id: 'andrew', label: 'Andrew',  desc: 'Male · English' },
  { id: 'aria',   label: 'Aria',    desc: 'Female · English' },
  { id: 'guy',    label: 'Guy',     desc: 'Male · English' },
  { id: 'jenny',  label: 'Jenny',   desc: 'Female · English' },
];
const TIERS = [
  { id: 'SERVER_DEFAULT', label: 'Server default', note: 'the server picks' },
  { id: 'STANDARD', label: 'Standard', note: 'free' },
  { id: 'PREMIUM',  label: 'Premium',  note: 'unlock' },
  { id: 'PRO',      label: 'Pro',      note: 'unlock' },
];
const LANGS = ['EN','ES','PT','FR','DE','JA','KO','ZH'];
const EMOTIONS = ['Natural','Whisper','Afraid','Excited','Angry','Sad','Suspense','Laughing'];

export default function VoiceTab({ voice, setVoice, tier, setTier, lang, setLang, emotion, setEmotion, agentName }:
  { voice: string; setVoice: (v: string) => void; tier: string; setTier: (t: string) => void;
    lang: string; setLang: (l: string) => void; emotion: string; setEmotion: (e: string) => void;
    agentName?: string }) {
  const [busy, setBusy] = useState('');
  const [custom, setCustom] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play(text: string, which: string) {
    if (!text.trim()) { setErr('type something first'); return; }
    setBusy(which); setErr(''); setOk('');
    try {
      const r = await fetch('/api/voice/speak', { method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ text, voiceId: voice, emotion: emotion.toLowerCase() }) });
      if (!r.ok) {
        const j = await r.json().catch(()=>({}));
        setErr(j.error === 'arena unreachable'
          ? 'voice server offline — start the arena to preview'
          : (j.error ?? 'voice failed'));
        setBusy(''); return;
      }
      const url = URL.createObjectURL(await r.blob());
      audioRef.current?.pause();
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => { URL.revokeObjectURL(url); setBusy(''); };
      await a.play();
      setOk(`spoke with ${voice} · ${emotion.toLowerCase()}`);
    } catch (e: any) { setErr(e.message); setBusy(''); }
  }

  const SAMPLE = "Five on me and I'm still grinning. Let's dance, chat.";
  const lbl: any = { color:'var(--color-muted)', fontSize:11, letterSpacing:'0.16em', marginBottom:6 };

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Voice</h3>
      <div style={lbl}>PLAN TIER</div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {TIERS.map(t => (
          <span key={t.id} onClick={()=>setTier(t.id)} style={{ cursor:'pointer',
            padding:'7px 12px', borderRadius:999, fontSize:12,
            border:`1px solid ${tier===t.id?'var(--color-sol-green)':'var(--color-line)'}`,
            color: tier===t.id?'var(--color-ink)':'var(--color-muted)' }}>
            {t.label}<span style={{ opacity:.55, fontSize:10 }}> · {t.note}</span></span>
        ))}
      </div>

      <div style={lbl}>VOICE</div>
      <div style={{ display:'grid', gap:6, marginBottom:16 }}>
        {VOICES.map(v => (
          <div key={v.id} onClick={()=>setVoice(v.id)} style={{ cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'9px 12px', borderRadius:10, fontSize:13,
            border:`1px solid ${voice===v.id?'var(--color-sol-purple)':'var(--color-line)'}`,
            background: voice===v.id ? '#14141c' : 'transparent' }}>
            <span style={{ color: voice===v.id?'var(--color-ink)':'var(--color-muted)' }}>
              {v.label}<span style={{ opacity:.55, fontSize:11 }}> · {v.desc}</span></span>
            <button onClick={(e)=>{e.stopPropagation(); play(SAMPLE, v.id);}} disabled={busy===v.id}
              style={{ padding:'4px 12px', borderRadius:999, fontSize:11, cursor:'pointer',
                border:'1px solid var(--color-line)', background:'transparent',
                color:'var(--color-ink)' }}>{busy===v.id?'…':'Test'}</button>
          </div>
        ))}
      </div>

      <div style={lbl}>LANGUAGE</div>
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {LANGS.map(l => (
          <span key={l} onClick={()=>setLang(l)} style={{ cursor:'pointer',
            padding:'5px 11px', borderRadius:8, fontSize:12,
            border:`1px solid ${lang===l?'var(--color-sol-green)':'var(--color-line)'}`,
            color: lang===l?'var(--color-ink)':'var(--color-muted)' }}>{l}</span>
        ))}
      </div>

      <div style={lbl}>EMOTION</div>
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {EMOTIONS.map(e => (
          <span key={e} onClick={()=>setEmotion(e)} style={{ cursor:'pointer',
            padding:'5px 11px', borderRadius:999, fontSize:12,
            border:`1px solid ${emotion===e?'var(--color-yellow)':'var(--color-line)'}`,
            color: emotion===e?'var(--color-ink)':'var(--color-muted)' }}>{e}</span>
        ))}
      </div>

      <div style={lbl}>SAY IT</div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={custom} onChange={e=>setCustom(e.target.value)}
          placeholder={`Make ${agentName || 'your agent'} say something…`}
          onKeyDown={e=>{ if(e.key==='Enter') play(custom,'custom'); }}
          style={{ flex:1, padding:'10px 12px', borderRadius:10, background:'#0b0b11',
            border:'1px solid var(--color-line)', color:'var(--color-ink)', fontSize:13, outline:'none' }} />
        <button onClick={()=>play(custom,'custom')} disabled={busy==='custom'}
          style={{ padding:'10px 16px', borderRadius:10, border:0, cursor:'pointer',
            background:'#fff', color:'#08080c', fontWeight:600 }}>
          {busy==='custom'?'…':'Say it'}</button>
      </div>
      {err && <div style={{ color:'var(--color-red)', fontSize:12, marginTop:8 }}>{err}</div>}
      {ok && <div style={{ color:'var(--color-sol-green)', fontSize:12, marginTop:8 }}>{ok}</div>}
    </div>
  );
}
