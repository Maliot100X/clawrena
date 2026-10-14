'use client';
// 7-tab create-agent flow, mirroring the reference UI:
// Body · Head · Colors · Scene · Mind · Voice · More
// On create: POST /api/agents -> agent + its OWN wallet, then go live in the arena.
import { useState } from 'react';
import { Panel, Button, Badge } from '@/components/ui';
import AvatarPreview from '@/components/AvatarPreview';
import VoiceTab from '@/components/voice/VoiceTab';
import MindTab from '@/components/voice/MindTab';

const TABS = ['Body','Head','Colors','Scene','Mind','Voice','More'] as const;
import { AVATARS } from '@/lib/avatars';
const AURAS = ['auto · smoke','auto · glow','auto · ember'];
const NAMES = ['byteraa','dot','Clawrena','Pepe','MONEY AI','Oski','Dobi','Glutos',
  'Zealon','Tercero','Wanpan','Maruchain','Xynta','Loop'];
const surprise = () => NAMES[Math.floor(Math.random() * NAMES.length)];

export default function CreateAgent({ agentName }: { agentName?: string } = {}) {
  const [tab, setTab] = useState<typeof TABS[number]>('Body');
  const [name, setName] = useState('');
  const [preset, setPreset] = useState(AVATARS[0].id);
  const [mind, setMind] = useState('HUMAN');
  const [pers, setPers] = useState('Daredevil');
  const [voice, setVoice] = useState('server-default');
  const [lang, setLang] = useState('EN');
  const [tier, setTier] = useState('SERVER_DEFAULT');
  const [emotion, setEmotion] = useState('Natural');
  const [customMind, setCustomMind] = useState('');
  const [scene, setScene] = useState('Studio');
  const [aura, setAura] = useState(AURAS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');

  const missing = !name.trim() ? 'Still missing: name.' : '';

  async function create(goLive: boolean) {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/agents', { method:'POST',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify({ name, mindTier: mind,
          personality: pers.toUpperCase(), scene: scene.toLowerCase(),
          aura, voiceId: voice, voiceTier: tier, language: lang,
          bodyModel: preset, customMind: customMind || undefined }) });
      const j = await r.json();
      if (r.status === 401) { window.location.href = '/login?next=/build'; return; }
      if (!r.ok) { setErr(j.error ?? 'create failed'); setBusy(false); return; }

      // "when agent is created it goes live" — start an arena run for it
      if (goLive) {
        const L = await fetch('/api/arena/launch', { method:'POST',
          headers:{ 'content-type':'application/json' },
          body: JSON.stringify({ agentName: j.agent.name, mindTier: mind,
            personality: pers, targetLevel: 8 }) });
        const live = await L.json();
        if (live.arenaUrl) { window.location.href = live.arenaUrl; return; }
      }
      setResult(j.agent);
      // it belongs to you now — send them to the dashboard to see it
      setTimeout(() => { window.location.href = '/dashboard'; }, 1400);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:14 }}>
      <div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {TABS.map(t => (
            <span key={t} onClick={() => setTab(t)} style={{ cursor:'pointer',
              padding:'6px 12px', borderRadius:8, fontSize:13,
              border:'1px solid var(--color-line)',
              color: tab===t ? 'var(--color-ink)' : 'var(--color-muted)',
              background: tab===t ? '#17171f' : 'transparent' }}>{t}</span>
          ))}
        </div>

        <Panel style={{ marginTop:14, minHeight:300 }}>
          {tab==='Body' && (<>
            <h3 style={{ marginTop:0 }}>Body</h3>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {['VRM','Normal','GLB','AI'].map(v => <Badge key={v}>{v}</Badge>)}
            </div>
            <div style={{ color:'var(--color-muted)', fontSize:12, marginBottom:6 }}>CHARACTER</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {AVATARS.map(a => (
                <span key={a.id} onClick={()=>setPreset(a.id)} style={{ cursor:'pointer',
                  padding:'8px 14px', borderRadius:10, fontSize:13,
                  border:`1px solid ${preset===a.id?'var(--color-sol-purple)':'var(--color-line)'}`,
                  color: preset===a.id?'var(--color-ink)':'var(--color-muted)' }}>{a.label}</span>
              ))}
              <span style={{ padding:'8px 14px', borderRadius:10, fontSize:13, opacity:.45,
                border:'1px solid var(--color-line)', color:'var(--color-muted)' }}>Your .vrm</span>
            </div>
            <div style={{ marginTop:14, color:'var(--color-muted)', fontSize:12 }}>
              Animations: pixiv Inc.'s VRoid Project · camera auto / full body / medium / face
            </div>
          </>)}

          {tab==='Head' && (<>
            <h3 style={{ marginTop:0 }}>Head</h3>
            <div style={{ color:'var(--color-muted)', fontSize:13 }}>
              Head shape, eyes, hair — inherited from the chosen body preset.
              Custom .vrm uploads replace this whole panel.
            </div>
          </>)}

          {tab==='Colors' && (<>
            <h3 style={{ marginTop:0 }}>Colors</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
              {['#9945ff','#14f195','#3fd0ff','#ff4d5e','#ffcf4d','#a78bfa'].map(c => (
                <div key={c} style={{ height:40, borderRadius:8, background:c,
                  border:'1px solid var(--color-line)' }} />
              ))}
            </div>
          </>)}

          {tab==='Scene' && (<>
            <h3 style={{ marginTop:0 }}>Scene</h3>
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              {['Studio','Stage','Void'].map(s => (
                <span key={s} onClick={()=>setScene(s)} style={{ cursor:'pointer',
                  padding:'8px 14px', borderRadius:10, fontSize:13,
                  border:`1px solid ${scene===s?'var(--color-sol-purple)':'var(--color-line)'}`,
                  color: scene===s?'var(--color-ink)':'var(--color-muted)' }}>{s}</span>
              ))}
            </div>
            <div style={{ color:'var(--color-muted)', fontSize:12 }}>AURA</div>
            <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
              {AURAS.map(a => (
                <span key={a} onClick={()=>setAura(a)} style={{ cursor:'pointer',
                  padding:'8px 14px', borderRadius:10, fontSize:13,
                  border:`1px solid ${aura===a?'var(--color-sol-green)':'var(--color-line)'}`,
                  color: aura===a?'var(--color-ink)':'var(--color-muted)' }}>{a}</span>
              ))}
            </div>
          </>)}

          {tab==='Mind' && (
            <MindTab mind={mind} setMind={setMind} pers={pers} setPers={setPers}
              custom={customMind} setCustom={setCustomMind} agentName={name} />
          )}

          {tab==='Voice' && (
            <VoiceTab voice={voice} setVoice={setVoice} tier={tier} setTier={setTier}
              lang={lang} setLang={setLang} emotion={emotion} setEmotion={setEmotion}
              agentName={name} />
          )}

          {tab==='More' && (<>
            <h3 style={{ marginTop:0 }}>More</h3>
            <div style={{ color:'var(--color-muted)', fontSize:13, lineHeight:1.7 }}>
              Per-game playstyle · language · rules.<br />
              Upload your own game (a markdown file with the rules).<br />
              Export wallet keys · Go Pro · Delete agent.
            </div>
          </>)}
        </Panel>
      </div>

      {/* preview card */}
      <div style={{ display:'grid', gap:12, alignContent:'start' }}>
        <Panel>
          <div style={{ height:200, borderRadius:12, marginBottom:12, overflow:'hidden',
            background:'linear-gradient(160deg,#0b0b11,#121218)' }}>
            <AvatarPreview presetId={preset} />
          </div>
          <label style={{ display:'block', fontSize:11, letterSpacing:1,
            color:'var(--color-muted)', marginBottom:6 }}>NAME</label>
          <div style={{ display:'flex', gap:8 }}>
            <input
              aria-label="agent name"
              placeholder="Name your agent"
              value={name}
              maxLength={24}
              onChange={e => setName(e.target.value)}
              style={{ flex:1, padding:'10px 12px', borderRadius:10,
                background:'#0b0b11', border:'1px solid var(--color-line)',
                color:'var(--color-ink)', fontSize:14, outline:'none' }} />
            <button onClick={() => setName(surprise())} title="Surprise me"
              style={{ padding:'0 12px', borderRadius:10, border:'1px solid var(--color-line)',
                background:'transparent', color:'var(--color-muted)', cursor:'pointer',
                fontSize:12, whiteSpace:'nowrap' }}>🎲 Surprise me</button>
          </div>
          <Badge>common · LV 1</Badge>
          <div style={{ fontSize:16, fontWeight:700, marginTop:8 }}>{name || 'Your agent'}</div>
          <div style={{ fontSize:12, color:'var(--color-muted)' }}>
            {name ? 'new · levels up as it plays' : 'new · levels up as it plays'}
          </div>
          <div style={{ marginTop:12, fontSize:12, color:'var(--color-muted)', lineHeight:1.9 }}>
            <div>Mind <span style={{ color:'var(--color-ink)' }}>{mind.toLowerCase()} · {pers.toLowerCase()}</span></div>
            <div>Voice <span style={{ color:'var(--color-ink)' }}>{voice}</span></div>
            <div>Scene <span style={{ color:'var(--color-ink)' }}>{scene}</span></div>
            <div>Aura <span style={{ color:'var(--color-ink)' }}>{aura}</span></div>
          </div>
          <div style={{ marginTop:12, fontSize:11, color:'var(--color-yellow)' }}>{missing}</div>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <Button variant="ghost" onClick={()=>setName('')}>Cancel</Button>
            <Button variant="solana" onClick={()=>create(true)}>{busy?'Creating…':'✦ Create agent'}</Button>
          </div>
          <div style={{ marginTop:10, fontSize:11, color:'var(--color-muted)' }}>
            It also gets its own wallet (one address per network) so it can pay to play.
          </div>
        </Panel>

        {result && (
          <Panel>
            <div style={{ color:'var(--color-sol-green)', fontSize:13 }}>created ✓</div>
            <div style={{ fontSize:13, marginTop:6 }}>{result.name} · @{result.handle}</div>
            <div style={{ fontSize:12, color:'var(--color-muted)', marginTop:4 }}>
              wallet {result.walletShort}
            </div>
          </Panel>
        )}
        {err && <Panel><span style={{ color:'var(--color-red)', fontSize:13 }}>{err}</span></Panel>}
      </div>
    </div>
  );
}
