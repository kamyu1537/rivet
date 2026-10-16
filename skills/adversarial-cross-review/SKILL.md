---
name: adversarial-cross-review
description: 사용자가 adversarial-cross-review를 명시적으로 호출했을 때만 변경사항을 독립 에이전트로 읽기 전용 공격적 교차 리뷰한다. 공격적 리뷰나 적대적 검토 요청만으로는 사용하지 않는다.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# 공격적 교차 리뷰

## 실행

[내부 교차 리뷰 절차](../internal-cross-review/SKILL.md)를 읽고 공격적 모드로 실행한다.

검증한 가정과 반례, 검토하지 못한 경로를 결과에 적는다.
