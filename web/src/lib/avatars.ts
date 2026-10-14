// Real VRM avatars shipped with ClawRena.
// These are the official VRoid sample models (AvatarSample_A/B/C) plus the
// VRoid fem/masc base bodies. All verified as genuine VRM 0.x with real
// humanoid skeletons.
export interface AvatarPreset {
  id: string;
  label: string;
  file: string;
  vibe: string;
}

export const AVATARS: AvatarPreset[] = [
  { id: 'aoi',   label: 'Aoi',      file: '/avatars/AvatarSample_A.vrm', vibe: 'casual' },
  { id: 'seed',  label: 'Seed',     file: '/avatars/AvatarSample_B.vrm', vibe: 'sporty' },
  { id: 'hato',  label: 'Hato',     file: '/avatars/AvatarSample_C.vrm', vibe: 'street' },
  { id: 'fem',   label: 'Vroid F',  file: '/avatars/fem_vroid.vrm',      vibe: 'classic' },
  { id: 'masc',  label: 'Vroid M',  file: '/avatars/masc_vroid.vrm',     vibe: 'classic' },
];

export const DEFAULT_AVATAR = AVATARS[0];

export function avatarFor(id?: string | null): AvatarPreset {
  return AVATARS.find(a => a.id === id) ?? DEFAULT_AVATAR;
}
