# didie111.github.io

> **AI는 답변·구현 전에 [AGENTS.md](AGENTS.md)와 [AI_HANDOFF.md](AI_HANDOFF.md)를 반드시 먼저 전체 읽으세요.**
> 전 세계 스타크래프트 1/브루드워 공개 구현의 실제 코드와 원작 동작을 직접 비교하여 거의 동일하게 구현하는 것이 사용자의 최우선 요구입니다.

브라우저 RTS: [공개 게임](https://didie111.github.io/rts/). 현재 게임 기준: **SC1.20** (`2026.10.02-sc1.20`).

F10·도움말을 열고 조작하는 동안에도 실제 마우스 고정을 유지합니다. F10은 왼쪽 중앙 두 칸으로 열리고 제목줄로 옮길 수 있습니다. 메뉴/고정 버튼은 하단 유닛 정보 패널 중앙 위에 있습니다. 군대와 생산 건물은 각각 24개까지 선택하며, 가스 건설 SCV의 완공 후 자동 채취, 이동/공격 원본 점검, 비비기·고정 상태 보호와 대량 유닛 최적화를 이어 갑니다.

**다른 AI에게 인수인계:** [AI_HANDOFF.md](AI_HANDOFF.md)에 사용자 요구, 완료한 작업, 직접 비교한 공개 소스, 남은 원작 차이, 다음 과제, 빌드/검사/배포 명령이 있습니다. `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`와 RTS 하위 작업 지침이 이 문서로 연결됩니다.

- [RTS 구조·빌드·버전 이력](rts-src/README.md)
- [충돌·비비기·사용자 영상 조사](rts-src/docs/sc1-collision-research.md)
- [46종 이동·무기와 선택/피해 점검](rts-src/docs/sc118-engine-audit.md)
- [이동·성능 기록](rts-src/docs/sc116-movement-performance.md)

기존 문서의 SC1.18/1.19 메뉴 해제/재고정 동작은 역사입니다. 최신 기준과 검증 한계는 인수인계를 확인하세요. 외부 AI의 지침 지원 여부와 관계없이 전달하려면 `AI_HANDOFF.md` 직접 링크와 “이 문서를 먼저 전체 읽고 이어서 작업해줘”를 함께 보내세요.
