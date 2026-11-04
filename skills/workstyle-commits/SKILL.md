---
name: workstyle-commits
description: git 커밋 메시지를 작성하기 직전에 사용한다. Conventional Commits 한 줄 형식과 본문·트레일러 금지를 적용한다.
---

# 커밋 메시지

Conventional Commits 형식의 짧은 한 줄로 쓰고, 본문은 쓰지 않는다.

형식: `<type>: <요약>`

- type은 `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `style`, `build`, `ci`, `revert` 중 하나다.
- 요약은 바뀐 내용을 짧게 설명하는 한 줄이다. 60자 안쪽으로 쓰고, 저장소가 이미 쓰고 있는 언어로 쓴다.
- 괄호를 쓰지 않는다. `(scope)`나 `(주변 알림 통합, 코스튬 교체)` 같은 보충 설명을 넣지 않는다.
- 본문, 불릿 목록, 푸터, 트레일러를 넣지 않는다. `-m`은 한 번만 쓰고 heredoc(`-F -`)을 쓰지 않는다.
- `Co-Authored-By`, `Generated with` 같은 출처 표기 트레일러를 넣지 않는다.
- 한 줄로 요약할 수 없는 변경이면 메시지를 늘리지 말고 커밋을 나눈다.
- 예: `feat: 장비·코스튬 장착 알림 통합`, `fix: TPlayerActor 필드 복구`

근거와 세부 내용은 사용자에게 보내는 응답, 머지 리퀘스트 설명, `docs/`에 적는다. 커밋 메시지에는 적지 않는다.

본문은 사용자가 명시적으로 요청한 경우에만 쓴다.
