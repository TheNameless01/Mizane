import fr from './fr.json';

export type I18nKeys = typeof fr;

export function t<K1 extends keyof I18nKeys, K2 extends keyof I18nKeys[K1]>(
  section: K1,
  key: K2
): string {
  const sec = fr[section];
  if (sec && key in sec) {
    return (sec as any)[key];
  }
  return `${String(section)}.${String(key)}`;
}

export default fr;
