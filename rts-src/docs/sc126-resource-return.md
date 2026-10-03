# SC1.26 — 세 종족 본진 자원 반납

사용자가 SC1.25 광맥 접근 개선을 확인한 뒤 해처리 반납 거리/동선과 모든 종족의 원작 비교를 요청했다. 비교 시작은 `4a34c31f2b5b753affd3f60985b12228b7d47d00`, 결과 버전은 `2026.10.03-sc1.26`이다.

## 실제 원인

기존 `returnDepot`는 가장 가까운 완공된 아군 본진을 고른 뒤 두 반납 명령 모두 `moveTo(th.x, th.y, 4, th)`의 반환값만으로 입금했다. 모든 본진 몸체를 4×3 건설 타일의 반폭 64/반높이 48px로 취급했다. 해처리의 DAT 몸체와 차이가 가장 컸다. 점유된 건물 중앙의 대체 경로는 일꾼의 접근 면과 무관한 모서리로 향했다. `moveTo`의 경로 탐색 실패/이동 불가 반환도 `true`여서, 실제 도착하지 않은 일꾼의 적재물을 입금할 수 있었다.

## 직접 읽은 원본과 적용

| 출처·역할·버전 | 직접 읽은 함수/조건 | 프로젝트 적용 |
| --- | --- | --- |
| [OpenBW 공개 재현 엔진](https://github.com/OpenBW/openbw/blob/4b046d5f65302b10cb0a745f0fecd37ec85b20a8/bwgame.h), 커밋 `4b046d5f65302b10cb0a745f0fecd37ec85b20a8`, 파일 blob `4cd76d6066ca825cba7dd0638ff9937573779929` | `order_ReturnGas`는 `order_ReturnMinerals`와 공통. 소유한 활성 지상 기지를 탐색하고 `unit_is_at_move_target`가 참이며 immovable이 아닐 때 적재물 입금·재채취. 실패 시 기지/명령을 재탐색, 기지 없으면 75틱 대기 | 미네랄/가스, 자동 채취 반납/명시 반납 모두 실제 거리 검사. 이륙·파괴·건설 중/적 본진 제외, 적재물·채취 목표 보존 |
| 같은 OpenBW | `find_nearest_active_resource_depot`는 같은 소유자와 `is_reachable`를 검사. `unit_is_active_resource_depot`는 지상·resource depot·완공/저그 건물 업그레이드 허용. `move_to_target_reset`, `unit_pos_is_bordering_target`는 DAT 몸체와 일꾼 extents+1 경계 사용. `unit_is_at_move_target`는 실제 위치와 이동 목표의 일치 | 중심거리 순으로 본진을 검사하고 실제 도달 가능한 경계 경로를 유지. 단순 경로 함수의 완료 반환을 입금으로 사용하지 않음. 저그 업그레이드 중 반납 유지 |
| [Teippi 원작 수정 구현](https://github.com/neivv/teippi/blob/05c006c2f74ad11285c39d37135aed03d1fb8806/src/unit.cpp), 커밋 `05c006c2f74ad11285c39d37135aed03d1fb8806` | `Unit::IsResourceDepot`는 Completed 또는 건물 업그레이드와 ResourceDepot 플래그 검사. 반납 명령들은 `bw::Order_ReturnResource` 원작 함수에 위임 | 활성 기지/업그레이드 의미 교차 확인. 위임된 바이너리 내부를 직접 분석한 근거로 쓰지 않음 |
| [PyMS DAT 데이터·스키마](https://github.com/poiuyqwert/PyMS/tree/bfc5d3aad0b5614a5aff72c223f8efa00afddfa4/PyMS/Tests/DAT), 커밋 `bfc5d3aad0b5614a5aff72c223f8efa00afddfa4` | `UnitsDAT.py`의 `staredit_placement_size`와 `unit_extents`를 구분해 AST 스키마로 독립 추출. 패키지 코드를 실행하지 않음 | 5종 본진의 실제 반폭/반높이와 3종 일꾼 11px 반납 몸체. DAT 바이너리는 배포하지 않음 |
| [BWAPI 원작 연결 API 문서](https://bwapi.github.io/class_b_w_a_p_i_1_1_unit_type.html) | `isResourceDepot`: 일꾼의 가장 가까운 본진 반납 의미 | 본진 선택 의미 교차 확인. AI 봇/API 자체를 물리 엔진으로 취급하지 않음 |

PyMS `units.dat` blob `5c3944532544d5a8a0d19707760fe53c4f0c2482`, `UnitsDAT.py` blob `97cf883536ed01b42b89b28d072905781050d03c`를 확인했다. extents 순서는 왼쪽/위/오른쪽/아래이며 이 타입들은 좌우/상하 대칭이다.

| 본진·unit ID | 건설 너비×높이 | DAT 몸체 반폭/반높이 | 수평/수직 반납 중심 거리(일꾼 11px+간격 1px) |
| --- | --- | --- | --- |
| 커맨드 센터 106 | 128×96px | 58/41px | 70/53px |
| 해처리 131·레어 132·하이브 133 | 128×96px | 49/32px | 61/44px |
| 넥서스 154 | 128×96px | 56/39px | 68/51px |

SCV 7·드론 41·프로브 64의 DAT extents는 각각 11/11/11/11px다. 일반 이동의 기존 원형 반지름 8px를 전체 엔진에서 바꾼 것이 아니라 반납 경계에 이 수치를 사용했다.

## 구현과 동일 조건 재현

`data.js`의 `collision`, `game.js`의 `bodyBox`/`depotReturnDistance`, `map.js`의 `groundObstacleRect`, `PF.positionClear`, `resolveTerrain`가 실제 본진 몸체를 검사한다. 건설 타일 점유/배치 금지는 유지한다. 실제 몸체 바깥이면서 건설 타일 안인 경계에도 일꾼이 걸어 접근하고 Stop/일반 이동으로 전환할 수 있다. 본진 몸체 전체를 무시하지 않는다.

`Entity.returnDepot`/`borderApproach`는 실제로 도달 가능한 면을 선택하고 `setResourceApproach`로 경로 끝점을 유지한다. 건설 타일 A*의 마지막 지점과 실제 경계를 잇는 마지막 구간도 통행 가능해야 한다. 막힘/새 건물이 생기면 재선택하고, 탐색 예산 고갈 시 다음 후보에서 이어간다. `moveToDepot`는 몸체 사이 거리 1px 이내만 입금으로 인정한다. 기존 광맥 경계 접근도 같은 경로 선택 함수를 사용하며 SC1.25 회귀를 통과했다.

재현 명령은 `node rts-src/scripts/depot-repro.cjs [비교할 src/js 디렉터리]`. 열린 맵, 본진 타일(20,20), 적재 미네랄 8, 본진 오른쪽/아래 중심 180px에서 본진을 향한 방향으로 시작한다. `gap`은 본진·일꾼 DAT 몸체 사이 거리다. 측정 원시값·입금 좌표·틱·이동량은 [결과 JSON](sc126-depot-results.json)에 있다.

| 조건 | SC1.25 입금 간격 | SC1.26 입금 간격 | SC1.25→SC1.26 입금 위치(본진 상대 x/y) |
| --- | --- | --- | --- |
| SCV·오른쪽 | 5.62px | 1px | 74.62/−51.09 → 70/0 |
| SCV·아래 | 6.46px | 1px | 65.70/58.46 → 0/53 |
| 드론·오른쪽 | 16.71px | 1px | 74.62/−51.09 → 61/0 |
| 드론·아래 | 16.48px | 1px | 65.70/58.46 → 0/44 |
| 프로브·오른쪽 | 7.70px | 1px | 74.62/−51.09 → 68/0 |
| 프로브·아래 | 8.46px | 1px | 65.70/58.46 → 0/51 |

동일한 도달 불가능 기지 재현은 SC1.25에서 첫 틱에 8을 원격 입금하고 적재물 0이 됐다. SC1.26은 입금 0/적재물 8을 유지했다. 가까운 지형 봉쇄 기지 대신 도달 가능한 소유 기지를 택하는 별도 재현도 통과했다. 가까워진 정확한 경계와 감속 때문에 모든 조건에서 입금 틱이 빨라지는 것은 아니며, 자원 수입 증가율을 주장하지 않는다.

## 검증 범위와 한계

- 새 반납 36개, 전체 `node --test rts-src/tests/*.cjs` **477개 통과**. 3종 일꾼/5종 본진/네 면의 거리·실제 보폭·통행/직접 동선, 미네랄/가스 및 두 반납 명령, 불가 기지/재개·대체 기지·새 건물·저그 업그레이드·Stop/건설 점유 보존을 검사했다. 기존 이륙/파괴/착륙/완공·충돌/광맥 검사를 함께 통과했다.
- `python3 rts-src/build.py`, `git diff --check` 통과.
- 동일 Node VM 벤치마크를 SC1.25→SC1.26 순으로 따로 실행했다. 800기 평균 대기 7.47→6.10ms, 이동 49.32→48.90ms, 밀집 복구 37.90→40.23ms. 단회 측정이며 소규모 변동/복구 비용을 구분한다. 원격 브라우저 렌더 FPS나 일반 PC 성능 보장은 아니다. 전체 100/400/800기 평균·p95·최대와 상태는 JSON에 있다.
- OpenBW/Blizzard 실행의 동일 입력 프레임 추적을 비교한 것은 아니다. 자체 A*·정확한 가까운 면 선택은 공개 함수의 의미를 적용한 구현이며 원작 경로 알고리즘 복사는 아니다. OpenBW에 명시된 비대칭 경계 원작 버그까지 복제하지 않았다. 원작의 사각 일꾼 몸체/픽셀 이동·iscript·경로 선택 전체 차이는 남아 있다. 다른 건물의 공격 경계는 아직 기존 건설 몸체 기준이다.
- 코드 커밋 `5684d863abf0c17c781ba5d9efcd250b6ca70430`, GitHub Pages 실행 `37117826695` 성공, 공개 게임 SC1.26 확인. 실제 브라우저 F10으로 저그 조작/AI 해제/샌드박스를 선택한 뒤 치트 자원 추가 없이 미네랄 50→114 반납을 확인했다. [검증 화면](sc126-zerg-return-1791024915779.jpg). 원격 FPS 1·일반 마우스이며, 세 종족 각각의 정확한 픽셀 거리는 자동 검증 결과와 구분한다.
