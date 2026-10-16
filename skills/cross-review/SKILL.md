---
name: cross-review
description: 사용자가 cross-review를 명시적으로 호출했을 때만 변경사항을 독립 에이전트로 읽기 전용 교차 리뷰한다. 일반 리뷰나 두 번째 의견 요청만으로는 사용하지 않는다.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# 일반 교차 리뷰

## 실행

[내부 교차 리뷰 절차](../internal-cross-review/SKILL.md)를 읽고 일반 모드로 실행한다.

사용자가 공격적 리뷰나 적대적 검토를 요청했으면 [adversarial-cross-review](../adversarial-cross-review/SKILL.md)를 사용한다.
