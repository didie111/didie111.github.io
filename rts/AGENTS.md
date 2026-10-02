# RTS 배포 파일 작업 전 필독

반드시 저장소 루트의 [`AGENTS.md`](../AGENTS.md)와 [`AI_HANDOFF.md`](../AI_HANDOFF.md)를 먼저 전체 읽는다.

`index.html`은 `rts-src/build.py`의 생성물이다. **이 파일을 직접 편집하지 않는다.** `rts-src/src/`를 수정·검증한 뒤 저장소 루트에서 `python3 rts-src/build.py`로 다시 생성하고 함께 반영한다.
