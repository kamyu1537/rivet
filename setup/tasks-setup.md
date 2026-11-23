# TASK 설정

## 활성화

1. [TASK 규칙](../prompts/tasks.md)을 읽는다.
2. 사용자가 켜거나 끄라고 지정했으면 그 선택을 따른다. 지정이 없으면 스크립트 기반 TASK 추적과 미완료 작업 Stop 검사를 쓸지 묻고 답을 기다린다.
3. 프로젝트 루트에서 `node scripts/tasks.mjs status`를 실행한다. 루트는 Git worktree 최상위다. Git 저장소가 아니거나 Git 실행 파일이 없으면 현재 디렉터리다.
4. 켜져 있는데 사용자가 켠 상태를 유지하면 `node scripts/tasks.mjs enable`을 실행한다. 파일을 다시 묻지 않는다.
5. 꺼져 있는데 사용자가 켠다고 했으면 `CLAUDE.md` 또는 `AGENTS.md`를 묻고 답을 기다린다. 답이 오기 전에 `enable`을 실행하지 않는다. 답이 오면 `node scripts/tasks.mjs enable --file CLAUDE.md` 또는 `node scripts/tasks.mjs enable --file AGENTS.md`를 실행한다. CLI는 파일을 묻지 않고, `--file` 없이 `enable`하면 실패한다.
6. 사용자가 끄라고 했으면 `node scripts/tasks.mjs disable`을 실행한다. 파일을 묻지 않는다.
7. `node scripts/tasks.mjs status`로 결과를 확인한다.
8. 비대화형 실행에서는 답이 없는 선택을 건너뛰고 그 사실을 보고한다. 건너뛴 선택으로 블록을 만들지 않는다.

올바른 블록은 아래 세 줄이 연속된 것이다.

```text
<!-- rivet-tasks:start -->
Rivet TASK tracking is enabled for this project.
<!-- rivet-tasks:end -->
```

`CLAUDE.md`와 `AGENTS.md`만 본다. 한 파일에 이 블록이 하나 있고 마커 줄도 그 시작과 끝뿐이며, 다른 파일은 없거나 마커 줄이 없으면 켜진다. 그 외 조합은 꺼진다. 본문이 다르거나, 마커가 남거나, 블록이 둘이면 꺼진다.

`--file`에 두 이름 외의 값을 넘기면 명령은 실패한다. 켜기와 끄기는 같은 끝 상태로 다시 실행할 수 있다. 끄거나 다른 파일로 켜면 두 파일에서 마커 구간과 고아 마커 줄을 지운다. 지운 뒤 공백만 남으면 그 파일을 삭제한다. 선택하지 않은 파일은 새로 만들지 않는다.

예전 전역 플래그 `~/.config/rivet/tasks-enabled`는 무시하며 삭제하지 않는다.

## 적용

- 켠 경우 현재 세션에서도 TASK 규칙을 읽는다. 상태 명령은 하네스 훅이 문맥에 script와 scope를 넣은 뒤에 쓴다. scope가 없으면 새 세션을 시작한다. 호스트 세션 ID를 추측하지 않는다.
- 플러그인이 없으면 설치할지 묻고 [플러그인 설치](plugin-setup.md)를 따른다. 설치를 원하지 않으면 현재 세션에만 적용하고 자동 주입은 없다고 보고한다.
- 설정만 하면서 빈 TASKS.md나 run을 만들지 않는다. 여러 단계 작업은 begin으로 전체 계획을 등록한다. `CLAUDE.md`나 `AGENTS.md`에 workstyle 본문을 복사하지 않는다.
- 끈 경우 프로젝트 파일의 마커만 제거한다. `~/.config/rivet/tasks/`의 상태 JSON, 기존 TASKS.md, 다른 도구 훅은 삭제하지 않는다. 이후 Stop 검사는 바로 멈춘다. 세션 문맥의 `TASK enabled` 값은 다음 세션 시작부터 바뀐다.
- Stop 훅은 TASK가 켜졌을 때 등록된 현재 run의 pending·active 항목만 계속 진행을 요청한다. 사용자가 지정한 다른 추적 위치는 검사하지 않는다.

## 상태와 복구

- `status`는 켜져 있으면 `enabled`와 블록 파일의 경로를, 꺼져 있으면 `disabled`와 프로젝트 루트를 출력한다. 두 상태 모두 종료 코드는 0이다.
- `~/.config/rivet/tasks/<scope>.json`에 호스트, 안정적인 세션 ID, 정규화한 작업 루트, revision, runs, 변경 이력을 저장한다. Git worktree 최상위 루트를 쓴다. Git 저장소가 아니거나 Git 실행 파일이 없으면 세션 시작 디렉터리를 쓴다.
- scope별 잠금으로 변경을 직렬화하고 같은 폴더의 임시 파일을 rename해 저장한다. 잠금은 최대 0.5초 기다린다. 충돌하면 show로 최신 revision을 확인한다.
- 첫 begin은 빈 `<scope>.registered` 표식을 만든다. snapshot 저장이 실패하면 하네스 훅이 빈 상태로 덮어쓰지 않고 검증 불가를 보고한다. snapshot과 표식을 함께 지우면 등록 여부를 알 수 없으므로 둘 다 보존한다.
- 손상·누락 상태는 신뢰할 수 있는 백업에서 복구한다. 남은 `<scope>.lock`은 해당 scope를 쓰는 프로세스가 없을 때만 수동 제거한다.
- 자동 계속 실행은 run당 2회이다. 상태 오류는 첫 종료에 검증 불가를 알리고 한 번 계속 실행을 요청할 수 있다. 호스트가 재진입으로 표시한 다음 종료에서는 경고하고 멈춘다.

## 하네스별 Stop

- Claude Code와 Codex는 Stop의 `decision: "block"`과 `reason`으로 계속 실행을 요청한다. 오류·한도 소진은 systemMessage와 stderr로 알린다. Claude 사용자 중단은 Stop을 실행하지 않는다. [Claude Stop](https://code.claude.com/docs/en/hooks#stop), [Codex hooks](https://learn.chatgpt.com/docs/hooks)
- Cursor는 `conversation_id`와 `workspace_roots`의 첫 경로를 사용한다. 여러 루트를 합치지 않는다. `status`가 completed일 때만 followup_message로 계속 실행하고 `loop_limit`은 2이다. aborted·error는 건너뛴다. 경고는 stderr에만 남는다. [Cursor hooks](https://cursor.com/docs/hooks)
- Cursor Agent CLI(`2026.10.01-e373342` 기준)는 `--print`에서 Stop 훅을 실행하지 않는다. 대화형 실행도 사용자·프로젝트 Stop 훅 없이 플러그인 Stop 훅만 있으면 실행하지 않는다. 이런 환경에서는 완료 전 `show`와 `check`를 직접 실행한다.
- Antigravity는 `conversationId`와 `workspacePaths`의 첫 경로를 사용한다. 훅은 플러그인 루트에서 실행되므로 작업 디렉터리를 쓰지 않는다. Stop의 `decision: "continue"`와 `reason`으로 계속 실행을 요청한다. `error`가 있는 종료는 건너뛴다. 재진입 표시가 없어 상태 오류는 계속 실행을 요청하지 않고 stderr에만 남긴다. [Antigravity hooks](https://antigravity.google/docs/hooks/)
- OMP는 session_stop의 continue와 additionalContext로 계속 실행을 요청한다. signal 중단과 assistant의 error·aborted는 건너뛴다. 경고는 가능하면 ctx.ui.notify로 표시한다. 계약은 OMP 18.10.3 소스 기준이다. session_stop이 없는 버전은 종료 검사를 지원하지 않는다. [이벤트 계약](https://github.com/can1357/oh-my-pi/blob/7414b7c919b59dd14db354a8f6b9164426237dff/packages/coding-agent/src/extensibility/shared-events.ts#L109)

## 확인

프로젝트 파일의 블록, 훅의 스킬 호출 안내, `TASK enabled`, script, scope, 스킬의 규칙 읽기와 등록된 미완료 항목에 대한 종료 훅 응답을 확인한다. 설정 변경, CLI·훅 입력 검사, 실제 모델 세션 검증을 구분해 보고한다.

Windows 인코딩 회귀 테스트는 [TASK 규칙](../prompts/tasks.md)의 `` `$OutputEncoding = ...` `` 한 줄을 그대로 긁어 실행한다. 그 문장을 바꿔 쓰면 테스트가 깨진다.
