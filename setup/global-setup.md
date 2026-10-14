# 공통 작업 규칙 적용

## 플러그인 훅

1. [공통 작업 규칙](../prompts/global.md)을 읽는다. 현재 하네스의 지시 우선순위를 따른다.
2. 플러그인이 없으면 [플러그인 설치](plugin-setup.md)를 따른다.
3. 새 세션에서 하네스 훅이 `internal-workstyle` 호출을 안내하고, 스킬이 공통 규칙을 끝까지 읽는지 확인한다. OpenCode는 모델 호출마다 첫 system block에 안내를 넣고, OMP는 session_start·session_switch·session_compact에서 보낸다. 현재 세션에서는 규칙을 직접 읽어 적용할 수 있다.

`CLAUDE.md`나 `AGENTS.md`에 규칙을 복사하지 않는다. 별도 전역 규칙 설정도 만들지 않는다. 플러그인을 비활성화한 뒤 새 세션을 시작하면 스킬 호출 안내가 멈춘다.

## 확인

[README의 검증 절차](../README.md#개발과-검증)를 따른다. 설치 목록, 훅 출력, 실제 세션 적용 여부를 구분해 보고한다. Codex 훅 신뢰는 공식 UI에서 사용자가 처리한다. 신뢰 파일을 직접 편집하지 않는다.
