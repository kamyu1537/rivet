# Rivet

## 사용과 기여

제가 개인적으로 쓰려고 만든 에이전트 플러그인입니다. 취향에 맞으면 설치해서 사용하세요. 개선 제안은 이슈나 PR로 자유롭게 보내 주세요.

## 기능

- 하네스 훅이 [internal-workstyle](skills/internal-workstyle/SKILL.md) 스킬 호출을 안내하고, 스킬이 [공통 작업 규칙](prompts/global.md)을 읽고 적용합니다. 훅은 짧은 안내와 설치된 스킬의 절대 경로를 전달합니다.
- TASK를 켜면 작업 계획, 진행 상태와 검증 근거를 기록합니다. 등록된 미완료 항목이 있으면 계획당 최대 2회 계속 실행을 요청합니다.
- `cross-review`는 일반 교차 리뷰, `adversarial-cross-review`는 가정과 실패 경로까지 검토하는 공격적 교차 리뷰를 실행합니다. 두 스킬 모두 독립된 에이전트에게 읽기 전용으로 검토를 요청합니다.

`internal-agent-setup`은 설치와 초기 설정을, `tasks-setup`은 TASK 켜기와 끄기를 담당합니다. `internal-` 접두사가 붙은 스킬은 주로 훅, 설치 절차와 다른 스킬이 호출합니다. 스킬 호출 도구가 없으면 해당 스킬 파일을 직접 읽고 따릅니다.

## 에이전트에게 설치 요청

```text
https://github.com/kamyu1537/rivet
이 저장소의 AGENTS.md에 있는 설치 안내에 따라 Rivet을 설치해줘.
```

## 설치

Claude Code, Codex, Cursor, OMP, Gemini CLI, GitHub Copilot CLI, OpenCode를 지원합니다.

Rivet에는 Node.js 18 이상이 필요합니다. 각 도구가 요구하는 Node.js 버전도 확인하세요. 설치 후에는 새 세션을 시작하세요.

### Claude Code

```sh
claude plugin marketplace add kamyu1537/rivet
claude plugin install rivet@rivet
claude plugin list
```

설치 과정에서 `/rivet:internal-agent-setup`으로 TASK 사용 여부를 선택합니다. 나중에는 `/rivet:tasks-setup`을 호출합니다. [공식 마켓플레이스 문서](https://code.claude.com/docs/en/plugin-marketplaces)

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

Cursor에서 창을 다시 불러온 뒤 Customize에서 플러그인, 스킬, Hooks를 확인합니다. 첫 요청에는 규칙이 아직 적용되지 않을 수 있습니다. 첫 요청부터 필요하면 [공통 작업 규칙](prompts/global.md)을 읽도록 요청하세요. [공식 로컬 설치 문서](https://cursor.com/docs/plugins#test-plugins-locally), [Cursor 훅 문서](https://cursor.com/docs/hooks)

Cursor Agent CLI `2026.10.01-e373342`에서는 스킬 읽기와 TASK 등록·완료가 동작합니다. 이 버전은 `--print` 실행에서 Stop 훅을 호출하지 않습니다. 대화형 실행도 사용자·프로젝트 Stop 훅 없이 플러그인 Stop 훅만 있으면 자동으로 계속 실행하지 않습니다. 이때는 완료 전에 [TASK 규칙](prompts/tasks.md)에 따라 `show`와 `check`로 상태를 확인합니다.

### OMP

Oh-My-Pi의 `omp` 명령을 사용합니다.

```sh
omp plugin marketplace add kamyu1537/rivet
omp plugin install --scope user rivet@rivet
omp plugin list --json
```

OMP 18.10.3의 확장 기능을 기준으로 구현했습니다. 설치나 업데이트 후 OMP를 완전히 종료하고 다시 실행하세요. [OMP 마켓플레이스](https://omp.sh/docs/marketplace), [OMP 확장](https://github.com/can1357/oh-my-pi/blob/main/docs/extensions.md)

### Gemini CLI

저장소를 clone한 뒤 저장소 밖의 새 폴더에 전용 확장을 만들어 설치합니다. 원본 저장소 루트를 Gemini에 직접 설치하지 않습니다.

```sh
git clone https://github.com/kamyu1537/rivet.git
cd rivet
node scripts/package-gemini.mjs ../rivet-gemini
gemini extensions install ../rivet-gemini
gemini extensions list
```

설치 후 Gemini CLI를 다시 시작하세요. 스킬 호출 안내는 세션 시작·재개 때 전달하며, 대화가 압축된 직후에는 다시 전달하지 않습니다. [확장 설치](https://geminicli.com/docs/extensions/reference/)

### GitHub Copilot CLI

```sh
copilot plugin install kamyu1537/rivet
copilot plugin list
```

Copilot CLI 1.0.96을 기준으로 구현했습니다. 같은 이름의 개인 스킬이 있으면 그 스킬이 먼저 선택될 수 있습니다. 샌드박스가 `~/.config/rivet` 접근을 막으면 TASK를 사용할 수 없습니다. 스킬 호출 안내는 세션 시작·재개 때 전달하며, 대화가 압축된 직후에는 다시 전달하지 않습니다. [플러그인 설치](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference), [훅 규격](https://docs.github.com/en/copilot/reference/hooks-reference)

### OpenCode

저장소를 로컬에 받은 뒤 OpenCode 설정의 `plugin` 배열에 설치 경로를 추가합니다. 기존 항목과 다른 설정은 보존합니다.

```json
{
  "plugin": ["file:///absolute/path/to/rivet/hooks/opencode.mjs"]
}
```

Windows에서는 `file:///C:/path/to/rivet/hooks/opencode.mjs`처럼 씁니다. 실제 설치 경로로 바꾸고 OpenCode를 다시 시작하세요. 스킬은 함께 등록됩니다.

OpenCode 1.19.0을 기준으로 구현했습니다. `opencode run`은 후속 요청 전에 종료될 수 있어 미완료 TASK의 자동 계속 실행을 보장하지 않습니다. [플러그인](https://opencode.ai/docs/plugins/), [설정](https://opencode.ai/docs/config/)

## TASK 활성화

기본은 꺼져 있습니다. `tasks-setup` 스킬에 "TASK를 켜줘" 또는 "TASK를 꺼줘"라고 요청할 수 있습니다. 직접 바꾸려면 설치된 플러그인 루트에서 아래 명령을 실행합니다.

| 목적 | 명령 |
| --- | --- |
| 켜기 | `node scripts/tasks.mjs enable` |
| 상태 확인 | `node scripts/tasks.mjs status` |
| 끄기 | `node scripts/tasks.mjs disable` |

TASK 설정은 지원하는 도구 모두에 함께 적용됩니다. 설정을 바꾼 뒤에는 새 세션을 시작하세요. 끄면 자동 계속 실행은 즉시 멈추고 기존 작업 기록은 남습니다.

등록하지 않은 작업과 사용자가 따로 지정한 TODO 위치는 자동으로 검사하지 않습니다. 명령 형식과 상태 규칙은 [TASK 규칙](prompts/tasks.md)을, 저장·복구와 도구별 동작은 [TASK 설정](setup/tasks-setup.md)을 참고하세요.

## 교차 리뷰

| 요청 | 동작 |
| --- | --- |
| "cross-review로 일반 리뷰해줘" | 변경 범위의 버그, 회귀, 요구사항과 검증 공백 확인 |
| "adversarial-cross-review로 리뷰해줘" | 관련 호출 경로와 설계 가정을 따라 반례, 실패·복구, 보안·데이터·동시성 검토 |

스킬은 현재 세션에서 쓸 수 있는 독립 에이전트나 CLI를 찾아 읽기 전용으로 리뷰합니다. 기존 인증과 구독 또는 API 연결을 사용하며, 사용할 수 없는 도구는 설치하지 않습니다. 두 모드 모두 리뷰어가 코드를 직접 수정하지 않습니다.

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

마켓플레이스 업데이트 명령을 실행하거나 로컬 저장소를 갱신합니다. 공통 규칙은 다음 세션부터 적용됩니다.

설치 스킬 이름이 `/rivet:agent-setup`에서 `/rivet:internal-agent-setup`으로 바뀌었습니다. 업데이트 후에는 새 이름으로 호출하세요. TASK를 켜거나 끄는 `/rivet:tasks-setup`은 그대로입니다.

### Codex 업데이트

Codex는 원격 마켓플레이스를 갱신한 뒤 플러그인을 설치합니다.

```sh
codex plugin marketplace upgrade rivet
codex plugin add rivet@rivet
```

1.3.1에서 로컬 전용 패키지로 설치했다면 `codex plugin marketplace remove rivet`으로 기존 등록을 해제합니다. 그다음 [Codex 설치](#codex) 명령을 실행합니다. 1.3.2부터는 Codex용 패키지를 따로 만들지 않습니다.

### Gemini CLI 업데이트

갱신한 저장소에서 [Gemini CLI 설치](#gemini-cli) 순서에 따라 전용 패키지를 만들고 설치합니다. 출력 경로는 저장소 밖의 새 폴더로 지정하세요.

### OpenCode 업데이트

설정이 가리키는 로컬 저장소를 갱신하고 OpenCode를 다시 시작합니다.
