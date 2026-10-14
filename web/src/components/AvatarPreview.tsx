'use client';
import dynamic from 'next/dynamic';
import { avatarFor } from '@/lib/avatars';
const VrmAvatar = dynamic(() => import('@/components/arena/VrmAvatar'), { ssr: false });

export default function AvatarPreview({ presetId, mood = 'idle' }:
  { presetId?: string | null; mood?: 'idle'|'talk'|'think'|'walk'|'hit' }) {
  const a = avatarFor(presetId);
  return <VrmAvatar url={a.file} mood={mood} />;
}
