# Mylottomap Sans (Pretendard Variable 한글 서브셋)

- 원본: Pretendard Variable 1.3.9, 제작 길형진 (Kil Hyung-jin), https://github.com/orioncactus/pretendard
- 원본 커밋: `5c41199ea0024a9e0b2cb31735265056e5472d76`
- 원본 경로: `packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2` (2,057,688바이트)
- 라이선스: SIL Open Font License 1.1, 동봉한 [OFL.txt](OFL.txt)
- 원본에 Reserved Font Name "Pretendard"가 있어(OFL 3항) 줄인 글꼴의 이름을 `Mylottomap Sans`로 바꿨다. 저작권·상표·라이선스 이름 레코드는 원본 그대로 둔다.
- 외부 CDN 요청은 없다. 사이트에서 직접 제공한다.

## 서브셋 범위

`mylottomap-sans-subset.woff2`(318,848바이트)는 아래만 담는다. 실제 담긴 글자 목록은 [subset-chars.txt](subset-chars.txt)(글꼴 cmap에서 뽑은 2,680자)이다.

- 굵기 축: 400~800 (사이트가 쓰는 굵기. 가변 축은 유지)
- 한글 음절: KS X 1001 완성형 2,350자 + 그 밖에 데이터·코드에 나온 2자(샾, 힣)
- 한글 호환 자모(ㄱ~ㆎ), 기본 라틴·라틴-1, 일반 구두점, 화살표(←~↕), 원문자 ①~⑳, ·≠≤≥±×÷≈−★☆●○■□▲△▼▽※ㆍ㈜
- 2026-11-25 빌드 결과(`dist/`)와 `src/`·`content/`·`data/`에 나온 그 밖의 글자
- OpenType 기능: fonttools 기본 목록(kern, calt, liga 등) + `tnum`(본문 숫자 폭 고정에 사용)

서브셋에 없는 글자(한자 등)는 CSS `--font-sans`의 다음 글꼴(설치된 Pretendard → 시스템 한글 글꼴)로 보인다. 빌드(`node scripts/build.mjs`)는 페이지·`shops.json`·`draws.json`에 서브셋 밖 글자가 있으면 경고만 낸다(한자는 원본에도 없어 제외).

## 다시 만드는 방법

빌드 의존성이 아니다. 필요할 때 한 번 실행해 결과 파일을 커밋한다. 빌드가 서브셋 밖 글자를 경고하면 그 글자를 `subset-chars.txt` 끝에 붙인 뒤 아래를 실행한다.

```sh
python -m venv .venv && .venv/bin/pip install fonttools==4.55.3 brotli==1.1.0
curl -LO https://raw.githubusercontent.com/orioncactus/pretendard/5c41199ea0024a9e0b2cb31735265056e5472d76/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2
.venv/bin/python -m fontTools.varLib.instancer PretendardVariable.woff2 wght=400:800 -o inst.ttf
.venv/bin/python -m fontTools.subset inst.ttf --text-file=src/shared/fonts/subset-chars.txt --layout-features+=tnum --flavor=woff2 --output-file=sub.woff2
# 이름 변경(OFL 3항): nameID 0·7·13·14를 뺀 이름 레코드의 Pretendard 이름을 Mylottomap Sans로 바꾸고, 글자 목록을 새 cmap으로 다시 쓴다.
.venv/bin/python - <<'EOF'
from fontTools.ttLib import TTFont
f = TTFont('sub.woff2')
for r in f['name'].names:
    if r.nameID in (0, 7, 13, 14): continue
    s = r.toUnicode()
    n = s.replace('Pretendard Variable', 'Mylottomap Sans').replace('PretendardVariable', 'MylottomapSans').replace('Pretendard', 'Mylottomap Sans')
    if n != s: r.string = n
f.save('src/shared/fonts/mylottomap-sans-subset.woff2')
open('src/shared/fonts/subset-chars.txt', 'w', encoding='utf-8', newline='').write(''.join(chr(c) for c in sorted(f.getBestCmap()) if c >= 0x20))
EOF
```

처음 만들 때(2026-11-25)의 `subset-chars.txt` 입력은 위 "서브셋 범위"의 문자 범위와 KS X 1001 2,350자(파이썬 `len(ch.encode('euc-kr')) == 2`), 저장소의 `dist/`·`src/`·`content/`·`data/` 파일에 나온 모든 글자를 합친 것이다.
