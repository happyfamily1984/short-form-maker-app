# 화면 시험 (브라우저)

휴대폰 없이 앱 화면과 흐름을 시험한다. 유행 리포트와 Gemini 응답은 `demo/` 의 예시 데이터와 가짜 응답으로 바꿔 끼운다.

```bash
cd www && python3 -m http.server 8765 &      # 앱 띄우기
node tools/uitest/run.js                      # Playwright 필요 (require('playwright'))
```

- 화면 캡쳐는 `tools/uitest/out/shots/` 에 저장된다 (git 에 올리지 않음).
- 마지막 줄에 `NO ERRORS` 가 나오면 통과. `ASSERT ...` 는 그 흐름이 깨졌다는 뜻.
