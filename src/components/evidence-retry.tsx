import { retryEvidenceVersion } from '@/server/evidence-actions';
import { WorkspaceForm } from './workspace-form';

export function EvidenceRetry({ version, number, revision }: { version: string; number: number; revision: number }) {
  return <div className="notice"><h3>파일 연결을 다시 시작할 수 있어요</h3><p>업로드 실패·사용 제한 파일 또는 저장을 시작한 지 10분이 지난 업로드 대기가 있어요. 10분은 서비스의 재시도 기준이며 법정 기한이 아닙니다. 사용 제한 파일은 내용을 확인·보완한 뒤 다시 연결해주세요.</p><p>저장된 v{number}의 본문만 같은 문서의 새 버전으로 보존해요. 이전 파일과 검사 이력은 v{number}에 그대로 남습니다. 검사 완료 파일도 자동으로 옮기지 않으므로 필요한 증빙을 모두 다시 연결해주세요. 새 평가 회차나 수행 완료를 만드는 동작은 아닙니다.</p><WorkspaceForm action={retryEvidenceVersion.bind(null, version)}><input type="hidden" name="recovery_revision" value={revision}/><label className="checkbox-label"><input type="checkbox" name="confirm_file_retry" required/>저장된 본문으로 새 버전을 만들고 필요한 파일을 다시 연결하겠습니다.</label><button className="button secondary">새 버전에서 파일 다시 연결</button></WorkspaceForm></div>;
}
