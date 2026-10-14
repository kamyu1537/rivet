# 교차 리뷰 설치

## 플러그인으로 사용

1. `rivet`에 포함된 `cross-review`와 `adversarial-cross-review` 스킬이 현재 하네스 스킬 목록에 있는지 확인한다.
2. 없으면 [플러그인 설치](plugin-setup.md)를 따른다. 다른 하네스 사용자 폴더에 일괄 복사하지 않는다.
3. 사용 가능한 독립 리뷰 도구를 확인한다. 특정 공급자나 모델을 필수로 설치하지 않는다.
4. 로그인 확인을 이유로 모든 CLI에 모델 요청을 보내지 않는다. 실제 리뷰가 필요할 때 선택한 도구만 쓴다.

## 스킬만 사용

플러그인을 지원하지 않는 하네스에서는 공식 스킬 경로에 `skills/cross-review/`, `skills/adversarial-cross-review/`, `skills/internal-cross-review/`를 같은 상위 디렉터리 아래에 설치한다. 기존 내용이 다르면 백업한 뒤 요청된 부분만 갱신한다. 세션 시작 훅은 설치하지 않는다.

## 확인

[일반 리뷰](../skills/cross-review/SKILL.md), [공격적 리뷰](../skills/adversarial-cross-review/SKILL.md)와 [공통 절차](../skills/internal-cross-review/SKILL.md)를 읽을 수 있는지 확인한다. 등록 확인과 실제 리뷰 실행 결과를 구분해 보고한다.
