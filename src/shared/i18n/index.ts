import fr from './fr.json';
import ar from './ar.json';

export type I18nKeys = typeof fr;

export function t<K1 extends keyof I18nKeys, K2 extends keyof I18nKeys[K1]>(
  section: K1,
  key: K2,
  locale: 'fr' | 'ar' = 'fr'
): string {
  const catalog = locale === 'ar' ? ar : fr;
  const sec = catalog[section];
  if (sec && key in sec) {
    return (sec as any)[key];
  }
  return `${String(section)}.${String(key)}`;
}

export * from './context';
export { fr, ar };
export default fr;
