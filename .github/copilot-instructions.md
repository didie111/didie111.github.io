# RTS 인수인계 — 먼저 읽기

Before answering about or changing this repository, read the root `AGENTS.md` and `AI_HANDOFF.md` in full. Follow their reading order before implementing an RTS change.

사용자 최우선 목표는 스타크래프트 1/브루드워 원작의 동작 재현이다. 전 세계 공개 엔진·관련 구현 소스를 계속 조사하고, 직접 읽은 원본 조건과 프로젝트의 실제 코드·검증 결과를 비교한다. 추측이나 화면만 비슷한 구현으로 완료 처리하지 않는다.

Preserve SC1.20 actual pointer lock throughout F10/help interaction, harvesting collision exceptions, illegal-overlap recovery for movable Hold/Stop units, immovable siege/egg states, and the intentional 24-unit / 24-production-building selection.

Edit `rts-src/src/`, rebuild with `python3 rts-src/build.py`, and include `rts/index.html` when runtime source changes. Run relevant behavior tests; run the full RTS suite for engine/collision changes. Update `AI_HANDOFF.md` with evidence and remaining differences. Do not modify unrelated RPG or RSI files for an RTS task.
