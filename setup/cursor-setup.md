# Cursor 플러그인 설치

## 로컬 설치

1. [README의 Cursor 설치](../README.md#cursor)를 따른다. 활성 설치는 `~/.cursor/plugins/local/rivet`이다.
2. Cursor를 다시 불러오고 플러그인과 스킬이 발견되는지 확인한다.
3. `sessionStart` 훅의 안내에 따라 `workstyle` 스킬이 공통 작업 규칙을 읽는지 확인한다. TASK는 [TASK 설정](tasks-setup.md)을 따른다. 블록은 프로젝트의 `CLAUDE.md` 또는 `AGENTS.md`에만 두고, workstyle 본문은 복사하지 않는다.
4. Cursor와 다른 플러그인의 모델 설정을 새로 만들거나 덮어쓰지 않는다.

GitHub URL로 넣은 Cursor 마켓플레이스 설치는 처음 받은 커밋에 고정될 수 있다. Settings의 Update/Reinstall이 그 스냅샷을 다시 깔 뿐이면, 마켓 설치를 끄고 로컬 폴더 설치로 바꾼 뒤 `git pull`한다. 같은 이름이면 마켓 설치가 로컬보다 우선한다.

## 선택 규칙

`cursor/rules/`는 자동 설치하지 않는다. 사용자가 선택한 규칙만 현재 Cursor 버전이 지원하는 위치에 설치한다.

- [다른 하네스 지침 읽기](../cursor/rules/apply-claude-instructions.mdc): 프로젝트가 Claude 지침을 쓰지만 Cursor가 읽지 못할 때.
- [외부 에이전트 위임](../cursor/rules/subscription-delegation.mdc): 사용자가 별도 CLI 위임을 원할 때.
- [수정 후 검증](../cursor/rules/verify-after-edit.mdc): 프로젝트별 검증 절차를 보완할 때.

예전에 복사한 모델 강제 규칙이 남아 있으면 파일과 내용을 보고한다. 사용자 요청 없이 기존 규칙을 지우지 않는다. 플러그인을 업데이트해도 따로 복사한 파일은 자동으로 제거되지 않는다.

## 확인

설치된 스킬과 훅을 확인한다. 시작 훅은 비동기이므로 첫 응답 전에 규칙을 읽었다고 단정하지 않는다. 첫 요청에 확실히 적용해야 하면 [공통 작업 규칙](../prompts/workstyle.md)을 직접 읽도록 요청한다.
