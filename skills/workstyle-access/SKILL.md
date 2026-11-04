---
name: workstyle-access
description: C# 또는 TypeScript에서 접근 제어자를 쓰거나 고치거나, 접근 제어자 린트·에디터컨피그를 다루기 직전에 사용한다.
---

# 접근 제어자

접근 제어자는 언어 기본값과 같아도 생략하지 않고 적는다.

- C#: 최상위·중첩 타입(class, struct, record, interface, enum, delegate)과 모든 멤버(필드, 상수, 프로퍼티, 인덱서, 메서드, 생성자, 이벤트, 연산자)에 `public`, `internal`, `protected`, `private`, `protected internal`, `private protected` 중 하나를 적는다. `class Foo` 가 아니라 `internal class Foo`, `int _count;` 가 아니라 `private int _count;` 로 쓴다. 인터페이스 멤버에도 `public` 을 적는다.
- TypeScript: 클래스 멤버(필드, 메서드, 생성자, 접근자, 생성자 파라미터 프로퍼티)에 `public`, `protected`, `private` 중 하나를 적는다.
- 언어가 접근 제어자를 허용하지 않는 곳만 예외다: C# 명시적 인터페이스 구현(`void IFoo.Bar()`), 정적 생성자, 종료자, enum 멤버, 지역 함수, 네임스페이스. Rust처럼 비공개를 나타내는 키워드가 없는 언어는 이 규칙을 적용하지 않는다.
- 새로 쓰거나 수정하는 선언에 적용한다. 기존 코드의 누락은 범위 통제에 따라 보고만 하고, 일괄 수정은 사용자가 요청할 때만 한다.
- 작업을 끝내기 전에 자신이 추가·수정한 선언에 접근 제어자가 빠졌는지 확인한다.

## 린트로 강제

- C# .NET SDK 프로젝트: `.editorconfig`의 `[*.cs]` 절에 아래 두 줄을 두고, `Directory.Build.props`(없으면 각 `.csproj`)에 `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>`를 둬서 누락이 빌드 오류가 되게 한다.

  ```ini
  dotnet_style_require_accessibility_modifiers = always
  dotnet_diagnostic.IDE0040.severity = error
  ```

- Unity 프로젝트: Unity 컴파일러는 IDE0040을 검사하지 않는다. 같은 `.editorconfig`를 저장소 루트에 둬서 IDE(Rider, Visual Studio)에 오류로 표시되게 하고, 빌드가 막아 주지 않으므로 완료 전 확인을 직접 한다.
- TypeScript: ESLint 설정에 `"@typescript-eslint/explicit-member-accessibility": ["error", { "accessibility": "explicit" }]`를 둔다.
- 이 린트를 `#pragma warning disable IDE0040`, `// eslint-disable`, 심각도 하향, 규칙 삭제로 우회하지 않는다.
- 린트 설정이 없는 저장소에 새로 들이는 일(`.editorconfig` 추가, ESLint 도입)은 다른 작업 중에 곁다리로 하지 않는다. 없다고 보고하고 사용자가 정하게 한다.
- 규칙을 켜면 기존 누락이 한꺼번에 오류가 된다. 린트 도입과 기존 코드 일괄 수정은 한 작업으로 묶어, 빌드와 테스트가 통과한 상태로 끝낸다.
