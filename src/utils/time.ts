export const nowIso = () => new Date().toISOString();

export const toIsoNoSeconds = (value: Date) => {
  const d = new Date(value);
  d.setSeconds(0, 0);
  return d.toISOString();
};

export const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const hoursBetween = (aIso: string, bIso: string) => {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.abs(a - b) / 1000 / 60 / 60;
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
};

export const formatTime = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const addHours = (iso: string, hours: number) => {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
};

export const localHHMM = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};
