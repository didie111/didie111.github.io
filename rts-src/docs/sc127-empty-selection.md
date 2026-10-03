# SC1.27 — 빈 땅 클릭/드래그의 선택 유지

사용자는 건물·유닛·자원을 선택한 상태에서 빈 땅을 드래그하면 선택이 풀리는 기존 동작을 F10 옵션으로 옮기고 기본값은 유지하도록 요청했다. 시작 커밋은 `59d707639f70113e313491cfab4d780acc66c93c`, 결과 버전은 `2026.10.03-sc1.27`이다.

## 구현

`UI.clearSelectionOnEmpty`의 기본값은 `false`다. `UI.clickSelect`/`UI.boxSelect`에서 선택할 대상이 없으면 기존 선택과 명령 패널을 그대로 유지한다. 작은 마우스 이동이 클릭으로 분류되는 경우도 같은 동작이 되도록 빈 땅 클릭을 포함했다. 다른 대상이 있는 영역의 선택 교체, Shift 추가/제거, 부대 호출, 명시적인 `setSelection([])`는 기존 규칙을 따른다.

F10의 게임 설정에 **빈 땅 클릭/드래그 시 선택 해제** 체크박스를 추가했다. 체크하면 기존 동작으로 돌아가고, 체크 해제하면 다시 선택을 유지한다. Shift를 누른 빈 영역 선택은 옵션을 켜도 기존 선택을 유지한다. 옵션은 현재 페이지 세션에서 기억하며 F10을 닫았다 열어도 유지한다. 페이지를 다시 불러오면 기본값으로 시작한다. 고정 커서의 체크박스 전달은 기존 공통 입력 경로를 사용한다.

## 공개 소스 비교 범위

- [OpenBW `ui/ui.h`](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/ui/ui.h)의 `end_drag_select`를 직접 읽었다. 커밋 `4b046d5f65302b10cb0a745f0fecd37ec85b20a8`, 파일 blob `aff631788c468af64fba10cf956e03fa35e35b02`다. 이 UI의 클릭 분기는 `select_get_unit_at`에서 실제 대상을 얻었을 때만 선택을 변경하므로 빈 클릭은 유지한다. 그러나 사각 드래그 분기는 검색 전에 `!shift`이면 `current_selection_clear()`를 호출하므로 빈 드래그도 해제한다. **요청한 빈 드래그 유지 기본값을 해당 OpenBW UI에서 그대로 이식한 것으로 표현하지 않는다.** 사용자 지정 동작을 적용하며, 이 공개 UI만으로 Blizzard 원작의 빈 드래그 규칙을 확정하지 않는다.
- [Teippi `src/selection.cpp`](https://github.com/neivv/teippi/blob/05c006c2f74ad11285c39d37135aed03d1fb8806/src/selection.cpp)의 `Selection::Find`, `SendChangeSelectionCommand` 및 선택 추가/제거 명령을 교차 확인했다. 원작 수정/명령 목록 처리 코드이며 빈 마우스 제스처의 원작 입력 판정 자체를 입증하는 근거는 아니다.

## 검증

`node --test rts-src/tests/camera.test.cjs rts-src/tests/spawn.test.cjs rts-src/tests/sc118.test.cjs`: **186개 통과, 0개 실패**. 새 5개는 실제 UI 함수를 통해 다음을 확인한다.

- 유닛·생산/비생산 건물·미네랄·가스·적 건물과 24기 선택의 빈 클릭/정방향·역방향 빈 드래그 유지 및 정보/명령 패널 보존.
- 옵션 활성/비활성, Shift 예외, 실제 대상 선택 교체·추가, 명시적인 선택 해제.
- 일반 및 고정 조건의 실제 mousedown/mousemove/mouseup 흐름에서 빈 드래그 유지/옵션 해제와 고정 상태 보존.

`python3 rts-src/build.py`, `git diff --check` 통과. 이번 변경은 UI 선택과 F10 설정으로 이동·채취·반납 엔진은 수정하지 않았다. SC1.26 전체 477개 검사는 이전 결과이며 이번에 다시 실행한 결과로 인용하지 않는다. 고정 조건 자동 검사는 실제 OS Pointer Lock 실행 증명과 구분한다.

## 공개 배포·실제 입력 확인

게임 코드 커밋은 [`a6270f607260f5e0a54354f2f8a54d6e990a9c2f`](https://github.com/didie111/didie111.github.io/commit/a6270f607260f5e0a54354f2f8a54d6e990a9c2f)다. GitHub Pages 실행 `37119158474`가 성공했고, 공개 `https://didie111.github.io/rts/`에서 SC1.27을 확인했다.

실제 마우스로 커맨드 센터·미네랄·마린을 각각 선택하고, 대상 없는 지도의 사각 영역을 드래그한 뒤 선택 정보가 그대로 남는 것을 확인했다. F10 체크박스의 초기 값은 꺼짐이었다. 켠 뒤 마린 선택에서 같은 빈 영역을 드래그하면 선택 정보가 사라졌다. 다시 끄고 커맨드 센터를 선택해 빈 영역을 드래그하면 유지됐고, F10 재열기에서도 꺼짐을 보존했다. [최종 화면](sc127-empty-selection-1791026530589.jpg)에 SC1.27, 꺼진 해제 옵션, 유지된 커맨드 센터 선택을 남겼다.

FPS 1인 원격 브라우저에서 게임을 일시정지하고 일반 마우스로 확인했다. UI 정보 갱신은 다음 렌더 프레임을 기다려 확인했다. 실제 OS Pointer Lock, 고주사율 또는 원작 바이너리의 입력 동등성 검증으로 확대하지 않는다.
