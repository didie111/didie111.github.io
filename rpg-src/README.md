# 메이플 스타일 SVG RPG — 소스

브라우저에서 바로 돌아가는 2D 횡스크롤 RPG입니다. 그래픽은 전부 SVG 코드로 생성합니다(외부 이미지 없음).

- 플레이: https://didie111.github.io/rpg/
- 배포 파일: `../rpg/index.html` (이 폴더의 소스를 합쳐 만든 결과물 — 직접 수정하지 말고 소스를 고친 뒤 빌드)

## 폴더 구조

```
src/index.html     화면 구조(SVG 레이어 + HUD + UI 창)
src/css/style.css  전체 UI 스타일
src/js/data.js     직업/스킬/장비/아이템/몬스터/맵/퀘스트 데이터
src/js/art.js      캐릭터·몬스터·보스·아이템·배경 SVG 아트 생성
src/js/engine.js   물리, 이동/점프, 카메라, 맵 로딩, 스폰, 애니메이션
src/js/combat.js   전투, 스킬, 드랍, 경험치/레벨업, 몬스터·보스 AI
src/js/ui.js       HUD, 인벤토리/장비/스탯/스킬/퀘스트 창, 미니맵
src/js/main.js     시작 화면, 게임 루프, 저장/불러오기, 효과음
build.py           src를 합쳐 ../rpg/index.html 한 파일로 빌드
```

## 수정하는 법

1. `src/` 안의 파일을 수정합니다.
2. `rpg-src` 폴더에서 `python3 build.py` (윈도우는 `python build.py`) 실행 → `rpg/index.html` 갱신.
3. 브라우저에서 새로고침. 빌드 없이 확인하려면 `src/index.html`을 직접 열어도 됩니다.

## 조작

이동 ←→ · 점프 Alt/Space(2단) · 아래점프 ↓+Alt · 공격 Z · 스킬 X C V · 줍기 A · 포탈 ↑
인벤 I · 스탯 S · 장비 E · 퀘스트 Q · 도움말 F1 · 물약 1 2 3 4

## 저작권

© 2025 didie111. 자세한 내용은 `../rpg/LICENSE` 참고.
