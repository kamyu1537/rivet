---
name: workstyle
description: 세션 시작 훅이 지정한 필수 스킬이다. 요청 종류와 관계없이 첫 응답 전에 호출해 공통 작업 코어 규칙과 활성화된 TASK 규칙을 읽는다.
---

# 작업 규칙 적용

## 공통 규칙

[공통 작업 규칙](../../prompts/workstyle.md)을 끝까지 읽고 따른다. 현재 하네스와 프로젝트의 지시 우선순위를 따른다.

항상 지킬 규칙은 코어에 둔다. 특정 행동을 할 때만 해당하는 규칙은 아래 상황 스킬로 두고, 그 행동을 하기 직전에 description으로 골라 호출한다. 네임스페이스가 있으면 `rivet:` 접두를 붙인다. 해당하지 않으면 호출하지 않는다.

- `workstyle-root-cause`: 버그·이상 동작을 조사하거나 수정할 때
- `workstyle-test-surface`: 테스트를 위해 프로덕션 API·접근성을 바꾸려 할 때
- `workstyle-pnpm`: Node 패키지 설치·잠금·스크립트·CI 패키지 단계를 다룰 때
- `workstyle-access`: C#·TypeScript 접근 제어자나 그 린트를 다룰 때

## TASK

- 훅 문맥의 `TASK enabled`가 `true`이면 [TASK 규칙](../../prompts/tasks.md)을 읽고 따른다. `TASK script`, `TASK scope`, `TASK workspace`는 훅이 제공한 값을 사용한다.
- TASK가 켜져 있는데 scope가 없거나 오류가 있으면 자동 추적을 사용할 수 없다고 보고한다. 세션 ID나 scope를 추측하거나 상태를 초기화하지 않는다.
- `TASK enabled`가 `false`이거나 훅 문맥이 없으면 TASK 등록을 시작하지 않는다. 이 스킬 적용만을 이유로 TASK를 켜거나 플러그인을 설치하지 않는다.

## 읽기 실패

규칙 파일의 읽기 결과가 잘리면 나머지도 읽는다. 읽지 못한 규칙 파일이 있으면 그 규칙을 적용할 수 없다고 사용자에게 알리고, 읽은 것처럼 계속하지 않는다.
