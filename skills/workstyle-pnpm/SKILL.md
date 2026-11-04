---
name: workstyle-pnpm
description: Node.js 패키지 설치, 잠금 파일, pnpm/npm/yarn/bun 스크립트, CI 패키지 단계, npm에서 pnpm으로의 전환을 다루기 직전에 사용한다.
---

# 패키지 관리 (Node.js)

## 패키지 매니저

패키지 관리는 pnpm으로 한다. `npm`, `yarn`, `bun`은 쓰지 않는다. 아래 전환 절이 명시적으로 적용되지 않는 한 신규·기존 프로젝트 모두에 해당한다.

- `pnpm init`, `pnpm add`, `pnpm install`을 쓴다.
- `package-lock.json`을 만들지 않는다.
- 스크립트는 `pnpm run`으로 실행한다.
- `npx` 대신 `pnpm dlx`를 쓴다. `npm run`, `npx`를 쓰지 않는다.
- CI에서는 `pnpm/action-setup` 후 `pnpm install --frozen-lockfile`을 쓴다. `npm ci`를 쓰지 않는다.

## npm 프로젝트를 pnpm으로 전환

다른 작업을 하다가 곁다리로 전환하지 않는다.

저장소가 현재 npm을 쓰고 있으면 그 사실을 보고하고, 전환 비용(락파일 재생성, CI 변경, 전이 의존성 해석 변화 가능성)을 설명한 뒤, 사용자가 결정하게 한다.

사용자가 명시적으로 요청하면 `pnpm import`를 실행하고, `package-lock.json`을 삭제하고, CI를 pnpm으로 갱신한 뒤, 빌드와 테스트를 실행한다. 빌드와 테스트가 통과한 뒤에만 전환 완료로 보고한다.
