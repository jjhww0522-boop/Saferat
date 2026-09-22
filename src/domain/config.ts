export function readConfig(env: Record<string, string | undefined>) {
  const app = env.APP_MODE ?? 'demo';
  const ai = env.AI_MODE ?? 'mock';
  const ocr = env.OCR_MODE ?? 'mock';
  if (!['demo', 'live'].includes(app) || !['off', 'mock', 'live'].includes(ai) || !['off', 'mock', 'live'].includes(ocr)) throw new Error('실행 모드 설정이 올바르지 않습니다. .env.example을 확인하세요.');
  if (app === 'live') {
    readSupabaseConfig(env);
    if (ai !== 'off' || ocr !== 'off') throw new Error('실제 작업 공간에서는 미연동 AI/OCR를 off로 설정해주세요.');
    return { app: 'live' as const, ai: 'off' as const, ocr: 'off' as const };
  }
  if (ai === 'live' || ocr === 'live') throw new Error('AI/OCR 실제 연결이 준비되지 않았습니다. off 또는 mock 설정을 사용하세요.');
  return { app: 'demo' as const, ai: ai as 'off' | 'mock', ocr: ocr as 'off' | 'mock' };
}

export function readSupabaseConfig(env: Record<string, string | undefined>) {
  if (env.APP_MODE !== 'live') throw new Error('실제 작업 공간이 연결되지 않았습니다.');
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith('sb_publishable_')) throw new Error('Supabase URL과 publishable key 설정이 필요합니다.');
  const parsed = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((!local && parsed.protocol !== 'https:') || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Supabase URL 설정을 확인해주세요.');
  return { url: parsed.origin, key };
}

export function requireDemoConfig(env: Record<string, string | undefined>) {
  const config = readConfig(env);
  if (config.app !== 'demo') throw new Error('실제 작업 공간에서는 가상 역할·데모 자료를 사용할 수 없습니다.');
  return config;
}
