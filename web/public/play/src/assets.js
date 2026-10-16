// Tiny IO helpers shared by every module. No game state lives here.

export async function loadJSON(rel) {
  const r = await fetch(rel);
  if (!r.ok) throw new Error('fetch ' + rel + ': ' + r.status);
  return await r.json();
}

export function loadImage(rel) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + rel));
    img.src = rel;
  });
}
