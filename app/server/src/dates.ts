const pad = (n: number) => String(n).padStart(2, '0');
export const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const today = () => fmt(new Date());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
/** 0 = lunedì … 6 = domenica */
export const weekday = (s: string) => (parse(s).getDay() + 6) % 7;
export const weekStart = (s: string) => addDays(s, -weekday(s));
export const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
export const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
