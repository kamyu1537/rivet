# TASK 작업 추적

## 등록

- 여러 단계 요청을 시작하기 전에 수행할 일과 검증 방법을 모두 `begin`으로 등록한다. 구현과 검증을 별도 항목으로 두고, 새로 발견한 필수 작업은 `add`로 추가한다. 단순 질문은 등록하지 않아도 된다.
- 세션 문맥의 `TASK script`, `TASK scope`, `TASK workspace`를 그대로 사용한다. 세션 ID나 scope를 추측하거나 상태 JSON을 직접 편집하지 않는다. scope가 없거나 오류가 있으면 자동 추적을 사용할 수 없다고 보고한다.
- 사용자나 프로젝트가 다른 추적 위치를 지정했다면 그 위치를 따르고 같은 항목을 중복 기록하지 않는다. 그 위치는 자동 Stop 검사의 대상이 아니므로 완료를 직접 대조해야 한다고 알린다. 기존 scope에 미완료 작업이 있으면 실제 사유를 기록해 정리한다.
- 기존 TASKS.md와 다른 세션의 기록은 보존한다. 예시 코드 블록, 다른 작업, Later 항목을 종료 조건으로 사용하지 않는다.

## 명령

등록된 작업 루트 안에서 `node "<TASK script>" <명령> --scope <TASK scope>`를 실행한다. 경로에 공백이나 한글이 있어도 하나의 인수로 전달한다. `show`와 `check`를 제외한 명령은 다음 JSON을 표준 입력으로 받는다.

표준 입력은 UTF-8 JSON이며, 선행 UTF-8 BOM은 허용한다. Windows PowerShell에서 JSON을 파이프로 보낼 때는 같은 호출 안에서 먼저 `$OutputEncoding = [System.Text.Encoding]::UTF8`을 설정한다. Windows PowerShell 5.1에서 UTF-8 JSON 파일을 `Get-Content`로 읽을 때는 `-Encoding UTF8`을 지정한다. UTF-16LE 파일은 UTF-8로 변환한 뒤 전달한다.

| 명령 | 입력 |
| --- | --- |
| `show` | 없음. scope, revision, 현재 run ID, 전체 runs와 이력을 반환한다. |
| `check` | 없음. 현재 run의 outcome, actionable 항목, completed를 반환한다. |
| `begin` | `{"expectedRevision":0,"title":"요청 제목","items":[{"id":"implement","title":"구현","verification":"동작 검증 방법"},{"id":"verify","title":"검증","verification":"실제 결과 확인 방법"}]}` |
| `add` | `{"expectedRevision":1,"runId":"현재 run ID","items":[{"id":"review","title":"검토","verification":"변경 diff 확인"}]}` |
| `set` | `{"expectedRevision":2,"runId":"현재 run ID","itemId":"implement","status":"active"}` |
| `resume` | `{"expectedRevision":3,"runId":"기존 run ID","reason":"재개 사유"}` |

- 변경 결과는 새 snapshot JSON이다. 항상 `show`나 직전 결과의 `revision`과 `currentRunId`를 사용한다. Stop도 revision을 증가시키므로 충돌하면 `show`로 다시 읽고 변경이 여전히 맞는지 판단한다. 숫자를 추측해 재시도하지 않는다.
- 항목 ID는 영문·숫자·밑줄·하이픈 1~64자이며 첫 글자는 영문·숫자다. 같은 run 안에서 유일해야 한다. title과 verification은 빈 문자열일 수 없다.
- 상태는 `pending`, `active`, `done`, `waiting`, `cancelled`다. `done`에는 실행한 검증과 결과를 적은 `evidence`가 필요하다. `waiting`과 `cancelled`에는 구체적인 `reason`이 필요하다. 예를 들어 완료 입력은 `{"expectedRevision":3,"runId":"현재 run ID","itemId":"implement","status":"done","evidence":"pnpm run test 통과, CLI 결과 확인"}`이다.
- 사용자 입력이나 외부 조치를 기다릴 때 `waiting`으로 두고 필요한 조치를 reason에 쓴다. 사용자 취소나 합의한 범위 제외는 `cancelled`로 기록한다. 미완료를 숨기기 위한 취소는 하지 않는다.
- done·waiting·cancelled에서 pending·active로 다시 열 때 reason을 쓴다. 예전 근거와 사유는 이력에 남는다. 새 run은 현재 run에 pending·active가 없을 때만 시작할 수 있다.
- 이전 run은 보존한다. 현재 run의 pending·active를 먼저 정리한 뒤 `resume`으로 이전 run을 선택하고, `set`으로 필요한 항목을 다시 연다. `resume`만으로 상태나 계속 실행 횟수가 초기화되지는 않는다.

## 완료 확인

- 완료 보고 전에 `show`와 `check` 결과를 실제 작업·검증 결과와 대조한다. 모든 항목이 done일 때만 completed가 true다. waiting이나 cancelled가 섞인 run은 완료가 아니다.
- Stop은 현재 호스트·세션·작업 루트의 현재 run만 검사한다. pending·active가 있으면 run당 최대 2회 계속 작업을 요청한다. 일반 상태 변경, 세션 재시작과 resume은 이 횟수를 초기화하지 않는다.
- 정상 대기, 사용자 중단, 하네스 오류 종료는 자동 재개하지 않는다. 한도가 소진되면 미완료 항목과 필요한 조치를 보고한다. 한도 회피를 위해 새 run이나 세션을 만들지 않는다.
- 등록되지 않은 다단계 요청은 자동으로 알아낼 수 없다. 근거가 비어 있지 않은지는 검사하지만 실제 검증이 충분한지는 스크립트가 판단하지 못한다. 자동 훅의 허용을 작업 완료의 증거로 삼지 않는다.
- 상태 누락·손상·잠금 오류는 완료가 아니라 검증 불가다. 상태나 등록 표식을 지우거나 빈 상태로 초기화하지 않는다. 잠금이 남았으면 작성 중인 프로세스가 없는지 확인한 뒤에만 복구한다. 오래됐다는 이유만으로 잠금을 삭제하지 않는다.
