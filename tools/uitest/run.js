const { chromium } = require('playwright'); const fs = require('fs');
const S = process.env.OUT || require('path').join(__dirname, 'out'); const DEMO = require('path').join(__dirname, 'demo');
const script = { tk: '오로라는 왜 초록색일까?', te: 'Why Are Auroras Green?', lk: '하늘의 초록 커튼, 그 색은 산소가 만든다.', le: 'The green curtain in the sky is painted by oxygen.', fmt: 'sci', style: 'sci3d', chars: [],
  shots: [
    { bt: '훅', pk: '북극 밤하늘', pe: 'Arctic night sky', ak: '눈 덮인 숲 위로 초록 오로라가 커튼처럼 흔들린다', ae: 'A green aurora ripples like a curtain over a snowy forest', sp: -2, dk: '오로라가 초록인 건 우연이 아닙니다', de: 'Auroras are green for a reason', cam: 'ws' },
    { bt: '오해', pk: '하늘', pe: 'Sky', ak: '햇빛이 구름에 비치는 장면', ae: 'Sunlight reflecting off clouds', sp: -2, dk: '햇빛이 반사된 거라고요? 아닙니다', de: 'Reflected sunlight? No.', cam: 'ms' },
    { bt: '원리', pk: '지구 대기 단면', pe: 'Cross-section of the atmosphere', ak: '태양에서 온 입자가 대기의 산소 원자에 부딪힌다', ae: 'Solar particles strike oxygen atoms in the atmosphere', sp: -2, dk: '태양 입자가 산소와 부딪히면', de: 'When solar particles hit oxygen', cam: 'pi' },
    { bt: '원리', pk: '원자 확대', pe: 'Atom close-up', ak: '산소 원자가 초록 빛을 내뿜는다', ae: 'An oxygen atom emits green light', sp: -2, dk: '산소가 초록빛을 냅니다', de: 'oxygen glows green', cam: 'cu' },
    { bt: '반전', pk: '높은 하늘', pe: 'High atmosphere', ak: '오로라 윗부분이 붉게 물든다', ae: 'The top of the aurora turns red', sp: -2, dk: '더 높이 올라가면 빨간색이 됩니다', de: 'Higher up, it turns red', cam: 'low' },
    { bt: '마무리', pk: '북극 밤하늘', pe: 'Arctic night sky', ak: '초록 오로라 아래 작은 오두막 불빛', ae: 'A tiny cabin light beneath the green aurora', sp: -2, dk: '그럼 보라색 오로라는 누가 만들까요?', de: 'So who paints the purple ones?', cam: 'ws' }],
  facts: [{ f: '오로라의 초록색은 산소 원자가 내는 빛이다', q: '오로라 초록색 산소 557.7nm' }, { f: '더 높은 고도의 산소는 붉은빛을 낸다', q: '오로라 붉은색 고도 산소' }] };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await pg.route('**/raw.githubusercontent.com/**', r => { const u = r.request().url().split('?')[0]; const f = u.endsWith('history.csv') ? 'history.csv' : u.endsWith('analysis.json') ? 'analysis.json' : u.endsWith('raw.json') ? 'raw.json' : null; f ? r.fulfill({ status: 200, body: fs.readFileSync(`${DEMO}/${f}`), headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '' }); });
  const pcm = Buffer.alloc(24000 * 2).toString('base64'); let prompts = [];
  await pg.route('**/generativelanguage.googleapis.com/**', r => { const q = JSON.parse(r.request().postData() || '{}'); const txt = q.contents ? q.contents[0].parts.map(p => p.text || JSON.stringify(p)).join('\n') : ''; prompts.push(txt);
    if (q.generationConfig && q.generationConfig.responseModalities) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: pcm } }] } }] }) });
    const props = q.generationConfig ? Object.keys(q.generationConfig.responseSchema.properties) : [];
    const out = props.includes('shots') ? script : props.includes('script') ? JSON.parse(fs.readFileSync(`${DEMO}/analysis.json`)).genres['과학'].videos[0] : { options: [] };
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] }) }); });
  await pg.addInitScript(() => { if (!localStorage.getItem('sfm.settings')) localStorage.setItem('sfm.settings', JSON.stringify({ theme: 'light', mode: 'kr', aiKeys: 'AIzaTESTKEY000000000000000000' })); });
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForSelector('.fv', { timeout: 8000 });
  fs.mkdirSync(`${S}/shots`, { recursive: true });
  const shot = async n => { await pg.waitForTimeout(400); await pg.screenshot({ path: `${S}/shots/${n}.png` }); };
  const ev = f => pg.evaluate(f), ok = (c, m) => { if (!c) errs.push('ASSERT ' + m); }, sc = y => ev(y => document.querySelector('#view').scrollTo(0, y), y);
  await shot('01_home'); await sc(700); await shot('01b_home');
  await pg.click('.chip[data-k="p_f"][data-v="sci"]'); ok(await pg.locator('.fv').count() === 2, 'sci filter');
  await pg.click('.seg [data-k="p_mk"][data-v="global"]'); ok(await pg.locator('.fv').count() === 1, 'global sci');
  await pg.click('.seg [data-k="p_mk"][data-v="kr"]'); await pg.click('.chip[data-k="p_f"][data-v=""]');
  await pg.click('.fv .btn[data-id="dSCI1"]'); await shot('02_remix'); ok(/초 단위 분석 42칸/.test(await pg.locator('details.more summary').first().innerText()), 'timeline box'); ok(/약 42초 14샷/.test(await pg.locator('[data-act="remixGo"]').innerText()), 'remix len'); await sc(900); await shot('02b_remix');
  await pg.fill('[data-p="topic"]', '오로라는 왜 초록색일까'); await pg.click('[data-act="remixGo"]'); await pg.waitForSelector('.beat');
  ok(/오로라는 왜 초록색일까/.test(prompts[prompts.length - 1]) && /open_loop/.test(prompts[prompts.length - 1]), 'remix prompt topic');
  ok(/SECOND-BY-SECOND/.test(prompts[prompts.length - 1]) && /every 3 seconds/.test(prompts[prompts.length - 1]), 'remix prompt timeline');
  await shot('03_editor'); await sc(700); await pg.waitForTimeout(500); await shot('03b_facts');
  await pg.click('[data-act="factOk"]'); ok(await ev(() => draft.facts[0].ok), 'fact ok');
  await pg.click('.etabs [data-v="finish"]'); await pg.waitForTimeout(2200); await sc(1250); await pg.waitForTimeout(400); await shot('04_finish_voice');
  await pg.click('[data-act="ttsTest"]'); await pg.waitForTimeout(800); ok(prompts.some(t => /다큐멘터리 내레이션 톤/.test(t)), 'tts called');
  await pg.click('[data-act="vname"][data-v="Kore"]'); ok(await ev(() => voiceCfg().name === 'Kore'), 'voice name');
  await pg.click('[data-k="p_veng"][data-v="device"]'); ok(await pg.locator('[data-k="p_vrate"]').count() === 3, 'device rate');
  await pg.click('[data-k="p_veng"][data-v="gemini"]');
  // 합치기 흐름: 안드로이드 다리 흉내
  const job = await ev(async () => { let got = null; window.AndroidBridge = { assemble: j => { got = JSON.parse(j); return true; }, hasMediaPerm: () => true }; for (let i = 0; i < draft.shots.length; i++) finOf(draft).stills[i] = await imgPut('data:image/jpeg;base64,/9j/'); draft.vids = []; await startAssemble(draft, false, true); for (let k = 0; k < 50 && !got; k++) await new Promise(r => setTimeout(r, 100)); delete window.AndroidBridge; return got; });
  ok(job && job.voicePcm && job.voicePcm.length === 6 && job.voicePcm.every(Boolean) && job.items.length === 6, 'assemble job voicePcm');
  await ev(() => { asm = null; dirty = false; onBack(); });
  // 주제 아이디어, 링크 분석, 새로 만들기
  await pg.click('[data-act="trendIdea"]'); ok(await ev(() => cur().v === 'remix' && cur().p.topic === '오로라 색의 원리'), 'idea remix'); await shot('05_idea'); await ev(() => onBack());
  await pg.fill('#link', 'https://youtube.com/shorts/abcdefghijk'); await pg.click('[data-act="linkGo"]'); await pg.waitForSelector('.scr'); ok(/교육·과학·다큐멘터리/.test(prompts[prompts.length - 1]), 'analyze prompt'); await ev(() => onBack());
  await pg.click('#nav [data-act="make"]'); await shot('06_make'); await pg.fill('[data-p="idea"]', '하품은 왜 옮을까'); await pg.click('[data-act="ideaGo"]'); await pg.waitForSelector('.beat'); ok(await ev(() => draft.facts.length === 2), 'idea facts');
  await ev(() => { dirty = false; onBack(); }); await pg.click('#nav [data-v="info"]'); await shot('07_info'); await ev(() => go('settings')); await shot('08_settings');
  await ev(() => { settings.theme = 'dark'; saveSettings(); tab('home'); }); await shot('09_dark');
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
