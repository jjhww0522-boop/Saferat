export function readConfig(env: Record<string, string | undefined>) {
  const app = env.APP_MODE ?? 'demo';
  const ai = env.AI_MODE ?? 'mock';
  const ocr = env.OCR_MODE ?? 'mock';
  if (!['demo', 'live'].includes(app) || !['off', 'mock', 'live'].includes(ai) || !['off', 'mock', 'live'].includes(ocr)) throw new Error('실행 모드 설정이 올바르지 않습니다. .env.example을 확인하세요.');
  if (app === 'live') throw new Error('실사용 연결이 준비되지 않았습니다. 인증·DB·비공개 파일 권한을 P2에서 연결해야 합니다.');
  if (ai === 'live' || ocr === 'live') throw new Error('AI/OCR 실제 연결이 준비되지 않았습니다. off 또는 mock 설정을 사용하세요.');
  return { app: 'demo' as const, ai: ai as 'off' | 'mock', ocr: ocr as 'off' | 'mock' };
}
