'use client';
export default function SignOut() {
  return (
    <button onClick={async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    }} style={{ background:'transparent', border:'1px solid var(--color-line)',
      color:'var(--color-muted)', borderRadius:999, padding:'5px 12px',
      fontSize:12, cursor:'pointer' }}>Log out</button>
  );
}
