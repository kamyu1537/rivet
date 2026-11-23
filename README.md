# Rivet

## 사용과 기여

제가 개인적으로 쓰려고 만든 에이전트 플러그인입니다. 취향에 맞으면 설치해서 사용하세요. 개선 제안은 이슈나 PR로 자유롭게 보내 주세요.

## 기능

- 하네스 훅이 [workstyle](skills/workstyle/SKILL.md) 스킬 호출을 안내하고, 스킬이 [공통 작업 규칙](prompts/workstyle.md)을 읽습니다. 훅은 짧은 안내와 설치된 스킬의 절대 경로를 전달합니다.
- TASK를 켜면 작업 계획, 진행 상태와 검증 근거를 기록합니다. 등록된 미완료 항목이 있으면 계획당 최대 2회 계속 실행을 요청합니다.

`rivet-setup`은 설치와 초기 설정을, `tasks-setup`은 TASK 켜기와 끄기를 담당합니다. 스킬 호출 도구가 없으면 해당 스킬 파일을 직접 읽고 따릅니다.

## 에이전트에게 설치 요청

```text
https://github.com/kamyu1537/rivet
이 저장소의 AGENTS.md에 있는 설치 안내에 따라 Rivet을 설치해줘.
```

## 설치

Claude Code, Codex, Cursor, OMP, Antigravity를 지원합니다.

Rivet에는 Node.js 18 이상이 필요합니다. 각 도구가 요구하는 Node.js 버전도 확인하세요. 설치 후에는 새 세션을 시작하세요.

### Claude Code

```sh
claude plugin marketplace add kamyu1537/rivet
claude plugin install rivet@rivet
claude plugin list
```

마켓플레이스로 설치한 뒤 새 세션에서 `/rivet:rivet-setup`을 호출해 TASK 사용 여부를 선택합니다. 나중에는 `/rivet:tasks-setup`을 호출합니다. [공식 마켓플레이스 문서](https://code.claude.com/docs/en/plugin-marketplaces)

### Codex

원격 마켓플레이스에서 설치합니다.

```sh
codex plugin marketplace add kamyu1537/rivet
codex plugin add rivet@rivet
codex plugin list --marketplace rivet
```

새 세션의 `/hooks`에서 Rivet의 `SessionStart`와 `Stop`을 검토하고 신뢰합니다. 설치 목록과 훅 실행 기록을 각각 확인하세요. [플러그인 패키징 문서](https://developers.openai.com/plugins/build/plugins), [훅 문서](https://learn.chatgpt.com/docs/hooks)

### Cursor

로컬 플러그인 폴더에 저장소를 clone하거나 내용을 복사합니다. 같은 경로가 있으면 내용과 변경 상태를 확인하고 덮어쓰지 않습니다. 외부 경로를 가리키는 심볼릭 링크는 쓰지 않습니다.

macOS와 Linux:

```sh
git clone https://github.com/kamyu1537/rivet.git ~/.cursor/plugins/local/rivet
```

Windows PowerShell:

```powershell
git clone https://github.com/kamyu1537/rivet.git "$env:USERPROFILE/.cursor/plugins/local/rivet"
```

Cursor에서 창을 다시 불러온 뒤 Customize에서 플러그인, 스킬, Hooks를 확인합니다. 첫 요청에는 규칙이 아직 적용되지 않을 수 있습니다. 첫 요청부터 필요하면 [공통 작업 규칙](prompts/workstyle.md)을 읽도록 요청하세요. GitHub 마켓플레이스로 설치한 경우에는 Update/Reinstall이 예전 커밋에 고정될 수 있으니, 위 로컬 폴더 설치를 쓴다. [공식 로컬 설치 문서](https://cursor.com/docs/plugins#test-plugins-locally), [Cursor 훅 문서](https://cursor.com/docs/hooks)

Cursor Agent CLI `2026.10.01-e373342`에서는 스킬 읽기와 TASK 등록·완료가 동작합니다. 이 버전은 `--print` 실행에서 Stop 훅을 호출하지 않습니다. 대화형 실행도 사용자·프로젝트 Stop 훅 없이 플러그인 Stop 훅만 있으면 자동으로 계속 실행하지 않습니다. 이때는 완료 전에 [TASK 규칙](prompts/tasks.md)에 따라 `show`와 `check`로 상태를 확인합니다.

### Antigravity

Antigravity CLI(`agy`)로 저장소에서 설치합니다.

```sh
agy plugin install https://github.com/kamyu1537/rivet
agy plugin list
```

Antigravity는 플러그인 루트의 `hooks.json`과 `.antigravity-plugin/plugin.json`을 읽습니다. 세션 시작 문맥은 새 대화의 첫 모델 호출 전에만 들어갑니다. 이어 받은 대화에서는 [공통 작업 규칙](prompts/workstyle.md)을 읽도록 요청하세요. 다른 하네스에서 가져온 rivet이 이미 있으면 위 명령으로 다시 설치합니다. 가져온 복사본은 Claude Code 형식 출력을 내므로 Antigravity가 문맥을 받지 못합니다. [플러그인 문서](https://antigravity.google/docs/build-plugins/), [훅 문서](https://antigravity.google/docs/hooks/)

### OMP

Oh-My-Pi의 `omp` 명령을 사용합니다.

```sh
omp plugin marketplace add kamyu1537/rivet
omp plugin install --scope user rivet@rivet
omp plugin list --json
```

OMP 18.10.3의 확장 기능을 기준으로 구현했습니다. 설치나 업데이트 후 OMP를 완전히 종료하고 다시 실행하세요. [OMP 마켓플레이스](https://omp.sh/docs/marketplace), [OMP 확장](https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md)

## TASK 활성화

기본은 꺼져 있습니다. 프로젝트 루트의 `CLAUDE.md`와 `AGENTS.md` 중 한 파일만 아래 블록을 가지고, 다른 파일은 없거나 마커가 없을 때 켜집니다. 루트는 Git worktree 최상위입니다. Git 저장소가 아니면 현재 디렉터리입니다.

```text
<!-- rivet-tasks:start -->
Rivet TASK tracking is enabled for this project.
<!-- rivet-tasks:end -->
```

`tasks-setup`에 "TASK를 켜줘" 또는 "TASK를 꺼줘"라고 요청할 수 있습니다. 직접 바꾸려면 프로젝트 루트에서 아래 명령을 실행합니다.

| 목적 | 명령 |
| --- | --- |
| 꺼져 있을 때 켜기 | `node scripts/tasks.mjs enable --file CLAUDE.md` 또는 `node scripts/tasks.mjs enable --file AGENTS.md` |
| 이미 켜져 있을 때 같은 파일로 맞추기 | `node scripts/tasks.mjs enable` |
| 상태 확인 | `node scripts/tasks.mjs status` |
| 끄기 | `node scripts/tasks.mjs disable` |

`status`는 켜져 있으면 `enabled`와 블록 파일 경로를, 꺼져 있으면 `disabled`와 프로젝트 루트를 출력합니다. 두 경우 모두 종료 코드는 0입니다. 꺼져 있을 때 파일 없이 `enable`을 실행하면 실패하고, 어느 파일을 쓸지 지정해야 합니다.

블록이 둘인 파일, 본문이 다른 구간, 마커만 남은 파일은 끈 상태입니다. 끄면 두 파일에서 그 구간과 남은 마커 줄을 지웁니다. 공백만 남으면 그 파일을 삭제합니다. 진행 기록은 `~/.config/rivet/tasks/`에 남습니다. 설정을 바꾼 뒤 세션 문맥을 갱신하려면 새 세션을 시작하세요. 끄면 Stop 검사는 바로 멈춥니다.

등록하지 않은 작업과 사용자가 따로 지정한 TODO 위치는 자동으로 검사하지 않습니다. 명령 형식과 상태 규칙은 [TASK 규칙](prompts/tasks.md)을, 저장·복구와 도구별 동작은 [TASK 설정](setup/tasks-setup.md)을 참고하세요.

## 개발과 검증

저장소에서 아래를 실행합니다.

```sh
pnpm install --frozen-lockfile
pnpm run validate
pnpm run test
```

자동 검사는 설치 복사본의 스킬 참조, CLI·훅 출력과 TASK 상태 전환을 확인합니다. 모델이 실제 세션에서 스킬을 호출하고 규칙을 읽는지는 별도로 확인합니다.

1. 설치 목록에서 플러그인과 스킬이 발견되는지, 훅 실행 기록에 오류가 없는지 확인합니다.
2. TASK를 켜고 새 세션에서 스킬 호출 안내·활성화 상태·scope를 받는지, 공통 규칙과 TASK 규칙을 끝까지 읽는지 확인합니다.
3. TASK를 끄고 새 세션에서 `TASK enabled: false`를 받는지, TASK 등록을 시작하지 않는지 확인합니다.
4. 플러그인을 비활성화한 새 세션에서 스킬 호출 안내와 TASK 검사가 중지되는지 확인합니다.

## 업데이트

Claude Code, Codex, OMP는 각 마켓플레이스 업데이트 명령을 사용합니다. Antigravity는 같은 `agy plugin install` 명령으로 다시 설치합니다. Cursor는 `~/.cursor/plugins/local/rivet`에서 `git pull`한 뒤 창을 다시 불러옵니다. 공통 규칙은 다음 세션부터 적용됩니다.

설치 스킬은 `/rivet:rivet-setup`입니다. TASK는 `/rivet:tasks-setup`으로 켜고 끕니다. 2.0.0부터 TASK는 프로젝트의 `CLAUDE.md` 또는 `AGENTS.md` 블록으로만 켜집니다. `~/.config/rivet/tasks-enabled`는 무시되며 삭제되지 않습니다.

### Codex 업데이트

Codex는 원격 마켓플레이스를 갱신한 뒤 플러그인을 설치합니다.

```sh
codex plugin marketplace upgrade rivet
codex plugin add rivet@rivet
```

1.3.1에서 로컬 전용 패키지로 설치했다면 `codex plugin marketplace remove rivet`으로 기존 등록을 해제합니다. 그다음 [Codex 설치](#codex) 명령을 실행합니다. 1.3.2부터는 Codex용 패키지를 따로 만들지 않습니다.
