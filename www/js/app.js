'use strict';
/* ---------- 기본 도구 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FM = Object.fromEntries(FORMATS.map(t => [t.id, t]));
const fmOf = p => FM[p && p.fmt] || FM.edu;
const APP_VERSION = '1.1.0';

const store = {
  get(k, d) { try { const v = localStorage.getItem('sfm.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sfm.' + k, JSON.stringify(v)); } catch (e) {} }
};
let settings = Object.assign({ theme: 'light', mode: 'kr', style: '', voice: { on: true, rate: 1.05, pitch: 1 }, castKr: CAST_DEFAULT.kr, castEn: CAST_DEFAULT.en, checks: [], aiKeys: '', aiModel: '', myBg: '' }, store.get('settings', {}));
let projects = store.get('projects', []);
const saveProjects = () => store.set('projects', projects);
let charLib = store.get('chars', []);
const saveCharLib = () => store.set('chars', charLib);
/* 사진은 용량이 커서 IndexedDB 에 줄여서 저장한다. 인물에는 사진 id 만 둔다 */
const imgCache = {};
const IDB = (() => {
  let op;
  const open = () => op || (op = new Promise((res, rej) => { try { const r = indexedDB.open('sfm-images', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('img', mode), q = fn(t.objectStore('img')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return { put: (k, v) => tx('readwrite', st => st.put(v, k)), get: k => tx('readonly', st => st.get(k)), del: k => tx('readwrite', st => st.delete(k)), keys: () => tx('readonly', st => st.getAllKeys()) };
})();
async function imgGet(id) { if (!id) return null; if (imgCache[id]) return imgCache[id]; try { const v = await IDB.get(id); if (v) imgCache[id] = v; return v || null; } catch (e) { return null; } }
const sessionImgs = new Set();
async function imgPut(dataUrl, id) { id = id || 'img_' + uid(); imgCache[id] = dataUrl; sessionImgs.add(id); await IDB.put(id, dataUrl); return id; }
function hydrateImgs(root) { $$('img[data-img]', root).forEach(el => imgGet(el.dataset.img).then(v => { if (v) el.src = v; else { const sl = el.closest('.slot'); if (sl) sl.classList.add('miss'); } })); }
function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => { const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.9)); }; im.onerror = () => rej(new Error('이미지를 읽지 못했습니다')); im.src = r.result; };
    r.onerror = () => rej(r.error); r.readAsDataURL(file);
  });
}
const usedImgIds = list => { const u = new Set(); list.forEach(p => { (p.chars || []).forEach(c => { if (c.imgFull) u.add(c.imgFull); if (c.imgFace) u.add(c.imgFace); }); Object.values((p.fin && p.fin.stills) || {}).forEach(id => id && u.add(id)); }); return u; };
async function gcImages() { try { const used = usedImgIds([...projects, { chars: charLib }, draft || {}]); for (const k of await IDB.keys()) if (!used.has(k) && !sessionImgs.has(k)) await IDB.del(k); } catch (e) {} }
const saveSettings = () => { store.set('settings', settings); applyTheme(); };
function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', settings.theme);
  const dk = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  try { if (window.AndroidBridge && window.AndroidBridge.setDark) window.AndroidBridge.setDark(dk); } catch (e) {}
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dateStr = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
const tc = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r; };
const words = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;

const ICON = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  book: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tool: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  chart: '<path d="M3 20h18"/><rect x="5" y="12" width="3" height="6" rx="1"/><rect x="10.5" y="8" width="3" height="10" rx="1"/><rect x="16" y="4" width="3" height="14" rx="1"/>',
  chef: '<path d="M7 14a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.1A4 4 0 0 1 17 14v6H7z"/><path d="M7 17h10"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  sparkle: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  laugh: '<circle cx="12" cy="12" r="9"/><path d="M8 13.5a4.5 4.5 0 0 0 8 0z"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  game: '<path d="M6 8h12a4 4 0 0 1 4 4v1a3.5 3.5 0 0 1-6.3 2.1L15 14H9l-.7 1.1A3.5 3.5 0 0 1 2 13v-1a4 4 0 0 1 4-4z"/><path d="M7 10.5v3M5.5 12h3M16 11h.01M18 13h.01"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  rocket: '<path d="M12 3c3.5 2 5 5.5 5 9.5L15 16H9l-2-3.5C7 8.5 8.5 5 12 3z"/><circle cx="12" cy="9.5" r="1.8"/><path d="M9 16l-2.5 3.5M15 16l2.5 3.5M12 17v4"/>',
  baby: '<circle cx="12" cy="12.5" r="8.5"/><path d="M9 15a3.5 3.5 0 0 0 6 0M9 11h.01M15 11h.01M12 4a2 2 0 0 0 2 2"/>',
  plane: '<path d="M21 4l-7.5 16-3-7-7-3z"/><path d="M10.5 13L21 4"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="6" r="1.8"/><circle cx="14" cy="6" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M12 11.5c-3 0-5.5 3.5-5.5 6 0 1.5 1.5 2 3 1.5l2.5-.8 2.5.8c1.5.5 3 0 3-1.5 0-2.5-2.5-6-5.5-6z"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  more: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.2 9.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  caption: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  scene: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  clapper: '<path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 10l-.5-3.2L18.3 4l.6 3.2L4 10M8.5 6l2 3M13.5 5l2 3"/>',
  road: '<path d="M5 20L9.5 4M19 20L14.5 4M12 6v2M12 11v2M12 16v2"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  flame: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 9h10M7 12.5h6"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  hash: '<path d="M5 9h15M4 15h15M10 3L8 21M16 3l-2 18"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l2 2"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-2 0-4.5-.5-4.5-3S11 4 12 9zM12 9c2 0 4.5-.5 4.5-3S13 4 12 9z"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.5A6 6 0 0 1 21 20"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.700l1-1"/>',
  bike: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="17" r="3"/><path d="M5.5 17l4-7h6l3 7M9.5 10L8 7H6M15.5 10l-1.5-4h3"/>',
  exit: '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;

/* ---------- 모드(국내용·해외용)와 대본 ---------- */
const MODE = () => settings.mode === 'en' ? 'en' : 'kr';
const isEn = () => MODE() === 'en';
const sfx = m => (m || MODE()) === 'kr' ? 'k' : 'e';
const blankShot = (cam, bt) => ({ bt: bt || '', pk: '', pe: '', ak: '', ae: '', sp: -1, dk: '', de: '', cam: cam || 'ms', sec: 5 });
const newProject = fmt => { const now = Date.now(); fmt = FM[fmt] ? fmt : 'edu'; return { id: uid(), fmt, src: null, facts: [], tk: '새 숏폼', te: 'New Short', lk: '', le: '', chars: [],
  shots: BEATS.map((b, i) => Object.assign(blankShot(['cz', 'ws', 'pi', 'ws', 'cu', 'slo'][i], b[0]), { sp: NARR })), style: STYLES[settings.style] ? settings.style : FM[fmt].style, ep: 1, subs: {}, over: {}, memo: '', fav: false, created: now, updated: now }; };
const T = (p, m) => p['t' + sfx(m)] || p.tk || p.te;
const LG = (p, m) => p['l' + sfx(m)] || p.lk || p.le;
const cname = (c, m) => c['n' + sfx(m)] || c.nk || c.ne;
const clook = (c, m) => c['d' + sfx(m)] || '';
const totalSec = p => p.shots.reduce((a, s) => a + (+s.sec || 5), 0);
const posBeat = (p, i) => BEATS[Math.min(BEATS.length - 1, p.shots.length === BEATS.length ? i : Math.round(i * (BEATS.length - 1) / Math.max(1, p.shots.length - 1)))];
const beatOf = (p, i) => { const b = posBeat(p, i), s = p.shots[i]; return s && s.bt ? [s.bt, b[1], b[2]] : b; };
/* 말하는 쪽: 0 이상 = 등장인물 번호, -1 = 말 없음, -2 = 내레이션 */
const NARR = -2;
const spName = (p, s, m) => s.sp >= 0 && p.chars[s.sp] ? cname(p.chars[s.sp], m) : s.sp === NARR ? ((m || MODE()) === 'en' ? 'Narrator' : '내레이션') : '';
const ckind = c => (c && KINDS[c.k] ? c.k : 'P');

/* ---------- 프롬프트 생성 ---------- */
function josa(word, j) {
  const pairs = { '을': ['을', '를'], '이': ['이', '가'], '은': ['은', '는'] }, p = pairs[j]; if (!p) return j;
  const ch = String(word).trim().slice(-1), code = ch.charCodeAt(0);
  const batchim = code >= 0xAC00 && code <= 0xD7A3 ? (code - 0xAC00) % 28 !== 0 : /[013678lmnrLMNR]/.test(ch);
  return batchim ? p[0] : p[1];
}

const castOf = m => String(m === 'kr' ? settings.castKr : settings.castEn).trim();
const styleOf = (p, m) => (STYLES[p.style] || STYLES[fmOf(p).style])[m === 'kr' ? 1 : 2];
const TONES = { H: ['또렷하고 자연스럽게', 'clear and natural'], V: ['또박또박 따지듯', 'pointed and firm'], A: ['다급하고 다정하게', 'urgent and warm'], X: ['놀란 목소리로', 'surprised'] };
const moodOf = (p, i, m) => MOODS[BEATS.indexOf(posBeat(p, i))][m === 'kr' ? 0 : 1];
/* 사람에게만 인물 분위기(한국인·American)를 붙인다. 동물·캐릭터·사물은 생김새만 */
const cwho = (c, m) => (ckind(c) === 'P' ? `${castOf(m)} ${clook(c, m)}` : clook(c, m)).trim();
function inShot(p, sh) {
  const idx = new Set();
  p.chars.forEach((c, i) => { if ((c.nk && (sh.ak || '').includes(c.nk)) || (c.ne && (sh.ae || '').includes(c.ne))) idx.add(i); });
  if (sh.sp >= 0 && p.chars[sh.sp]) idx.add(sh.sp);
  return [...idx].sort();
}
const refList = (p, ids, m, local) => ids.map((i, n) => { const no = local ? n + 1 : i + 1; return m === 'kr' ? `${cname(p.chars[i], m)} = 참조 이미지 ${no}` : `${cname(p.chars[i], m)} = reference image ${no}`; }).join(', ');
const legend = (p, m) => p.chars.map((c, i) => m === 'kr' ? `${cname(c, m)}(참조 이미지 ${i + 1}: ${cwho(c, m)})` : `${cname(c, m)} (reference image ${i + 1}: ${cwho(c, m)})`).join('; ');

/* 종류별 기준 이미지 문구: [이름, 전신 자세, 얼굴, 하나만] */
const CP = {
  P: { kr: ['인물', '정면을 보고 똑바로 선 자세, 팔은 자연스럽게 내리고, 머리끝부터 신발까지 전신이 화면에 모두 보이게.\n복장은 설명 그대로, 로고나 글자 없음.', '어깨 위 정면 얼굴 클로즈업, 자연스럽고 차분한 표정, 시선은 카메라.', '한 사람만'],
       en: ['a character', 'Character', 'Standing straight and facing the camera, arms relaxed at the sides, the entire body visible from head to shoes.\nOutfit exactly as described, no logos or lettering.', 'Front-facing head-and-shoulders close-up, natural calm expression, eyes to camera.', 'one person only'] },
  A: { kr: ['동물', '카메라 쪽으로 살짝 비스듬히 선 자연스러운 자세, 머리부터 꼬리와 발끝까지 몸 전체가 화면에 모두 보이게.\n설명에 없는 옷이나 소품은 넣지 않는다.', '정면 얼굴 클로즈업, 차분한 표정, 시선은 카메라. 털결과 눈이 또렷하게.', '한 마리만'],
       en: ['an animal', 'Animal', 'Natural standing pose turned slightly toward the camera, the whole body visible from head to tail and paws.\nNo clothes or props unless described.', 'Front-facing close-up of the face, calm expression, eyes to camera, crisp fur and eyes.', 'one animal only'] },
  C: { kr: ['캐릭터', '정면을 보고 선 자세, 머리끝부터 발끝까지 전체가 화면에 모두 보이게.\n기존 작품의 캐릭터와 닮지 않은 새로운 디자인.', '정면 얼굴 클로즈업, 밝고 또렷한 표정, 시선은 카메라.', '캐릭터 하나만'],
       en: ['an original cartoon character', 'Character', 'Standing and facing the camera, the whole figure visible from head to toe.\nA new design that does not resemble any existing franchise character.', 'Front-facing close-up of the face, bright clear expression, eyes to camera.', 'one character only'] },
  O: { kr: ['사물 캐릭터', '정면에서 본 모습, 전체 형태가 화면에 모두 보이게.\n상표·로고·글자 없음.', '정면 클로즈업, 표정이나 특징이 또렷하게.', '하나만'],
       en: ['an object character', 'Object', 'Seen from the front, the whole shape visible in frame.\nNo brand marks, logos or lettering.', 'Front close-up, the expression or key feature clearly visible.', 'one object only'] }
};
function charPrompt(p, i, m, kind) {
  const c = p.chars[i], st = styleOf(p, m), face = kind === 'face';
  if (m === 'kr') { const t = CP[ckind(c)].kr; return `영상 제작용 ${t[0]} ${face ? '얼굴' : '전신'} 기준 이미지.\n${t[0]}: ${cwho(c, m)}.\n${face ? t[2] : t[1]}\n배경은 밝은 회색 단색, 부드럽고 고른 조명.\n${st}.\n9:16 세로. 글자·워터마크·로고 없음, ${t[3]}.`; }
  const t = CP[ckind(c)].en;
  return `${face ? 'Face' : 'Full-body'} reference image of ${t[0]} for video production.\n${t[1]}: ${cwho(c, m)}.\n${face ? t[3] : t[2]}\nPlain light-gray background, soft even lighting.\nStyle: ${st}.\nVertical 9:16. No text, no watermark, no logos, ${t[4]}.`;
}
function framePrompt(p, i, m) {
  const sh = p.shots[i], ids = inShot(p, sh), cam = (CAMS[sh.cam] || CAMS.ms)[m === 'kr' ? 1 : 2], st = styleOf(p, m);
  if (m === 'kr') return `세로 9:16 숏폼 영상의 장면 한 장 (샷 ${i + 1}의 첫 프레임).\n장소: ${sh.pk}.\n장면: ${sh.ak}.\n등장: ${ids.length ? refList(p, ids, m) : '없음'}.\n구도: ${cam}.\n분위기: ${moodOf(p, i, m)}.\n${st}.\n${ids.length ? '첨부한 기준 이미지와 생김새를 똑같이 유지한다. ' : ''}화면 속 글자·자막·워터마크 없음.`;
  return `One vertical 9:16 short-form video still (first frame of shot ${i + 1}).\nLocation: ${sh.pe}.\nMoment: ${sh.ae}.\nCharacters: ${ids.length ? refList(p, ids, m) : 'none'}.\nFraming: ${cam}.\nMood: ${moodOf(p, i, m)}.\nStyle: ${st}.\n${ids.length ? 'Keep every character identical to the attached reference images. ' : ''}No on-screen text, subtitles or watermark.`;
}
/* 그록 장면 이미지(움직이지 않는 샷)용: 생김새를 글로 모두 적고, 사진에 맞는 고정 구도를 쓴다 */
const STILL_CAM = {
  cu: ['얼굴이 크게 보이는 클로즈업', 'Close-up on the face'], ms: ['상반신 미디엄 샷', 'Medium shot of the upper body'],
  ws: ['장소 전체가 보이는 와이드 샷', 'Wide shot showing the whole location'], pi: ['상반신 미디엄 클로즈업', 'Medium close-up'],
  cz: ['얼굴 클로즈업', 'Tight close-up on the face'], ots: ['상대 어깨 너머로 잡은 샷', 'Over-the-shoulder shot'],
  low: ['아래에서 올려다보는 로우앵글', 'Low-angle shot looking up'], trk: ['움직이는 주인공의 온몸이 옆에서 보이는 샷', 'Full-body side view of the moving subject'],
  rx: ['놀란 주변의 표정이 함께 보이는 샷', 'Shot including surprised onlookers'], slo: ['상반신 미디엄 샷', 'Medium shot of the upper body']
};
const FLOOR_RE = /바닥|발밑|발 밑|땅에|떨어진|떨어뜨|무릎을 꿇|엎드|쓰러|floor|ground|kneel|dropped|fallen/i;
function stillPrompt(p, i, m) {
  const sh = p.shots[i], ids = inShot(p, sh), st = styleOf(p, m), kr = m === 'kr', act = String(kr ? sh.ak : sh.ae || '').replace(/[.。]\s*$/, '');
  const floor = FLOOR_RE.test(sh.ak || '') || FLOOR_RE.test(sh.ae || '');
  const cam = floor ? (kr ? '머리부터 발끝, 바닥까지 모두 보이는 풀샷' : 'Full shot showing the subjects from head to toe and the floor') : (STILL_CAM[sh.cam] || STILL_CAM.ms)[kr ? 0 : 1];
  const who = ids.map(c => `${cname(p.chars[c], m)}: ${cwho(p.chars[c], m)}`.trim()).join(' / ');
  if (kr) return `세로 9:16 숏폼 영상의 장면 사진 한 장.\n가장 중요: 아래 '장면'을 글자 그대로 정확하게 보여 준다.\n장소: ${sh.pk}.\n장면: ${act}.\n등장: ${who || '없음 (사람이나 동물을 새로 넣지 않는다)'}.\n구도: ${cam}.\n분위기: ${moodOf(p, i, m)}.\n${st}.\n지킬 것: 물건은 설명된 자리에 그대로 둔다. 설명에 없는 소품이나 등장인물을 새로 만들지 않는다. 공간 크기와 원근, 몸과 손발 모양이 자연스럽게. 시선과 몸짓이 장면 속 행동과 맞게. 화면 속 글자·자막·워터마크 없음.`;
  return `One vertical 9:16 short-form video scene photo.\nMost important: show the 'Moment' below exactly as written.\nLocation: ${sh.pe}.\nMoment: ${act}.\nCharacters: ${who || 'none (do not add people or animals)'}.\nFraming: ${cam}.\nMood: ${moodOf(p, i, m)}.\nStyle: ${st}.\nRules: keep every object exactly where it is described. Do not invent props or characters that are not described. Realistic scale, perspective, bodies, hands and paws. Gaze and body language must match the action. No on-screen text, subtitles or watermark.`;
}
function klingPrompt(p, i, m, local) {
  const sh = p.shots[i], ids0 = inShot(p, sh), ids = Array.isArray(local) ? local : ids0, cam = (CAMS[sh.cam] || CAMS.ms)[m === 'kr' ? 1 : 2], st = styleOf(p, m), n = p.shots.length;
  const sp = sh.sp >= 0 ? p.chars[sh.sp] : null, line = m === 'kr' ? sh.dk : sh.de, tone = sp ? (TONES[sp.r] || TONES.X)[m === 'kr' ? 0 : 1] : '';
  if (m === 'kr') return `[샷 ${i + 1}/${n} · ${sh.sec || 5}초 · 세로 9:16]\n장소: ${sh.pk}.\n카메라: ${cam}.\n동작: ${sh.ak}.\n${sp && line ? `대사: ${cname(sp, m)}${josa(cname(sp, m), '이')} 한국어로 ${tone} 말한다. "${line}" 입 모양을 대사에 정확히 맞춘다.` : sh.sp === NARR ? '화면 속에서는 아무도 말하지 않는다 (내레이션은 편집에서 넣는다). 표정과 몸짓으로만 연기한다.' : '대사 없음. 표정과 몸짓으로만 연기한다.'}\n분위기: ${moodOf(p, i, m)}.\n화면: ${st}.\n${ids.length ? `등장인물의 생김새는 참조 이미지와 똑같이 유지한다 (${refList(p, ids, m, !!local)}). ` : ''}자막이나 화면 속 글자를 넣지 않는다.`;
  return `[Shot ${i + 1}/${n} · ${sh.sec || 5}s · vertical 9:16]\nLocation: ${sh.pe}.\nCamera: ${cam}.\nAction: ${sh.ae}.\n${sp && line ? `Dialogue: ${cname(sp, m)} says in English, ${tone}: "${line}" Lip-sync the line precisely.` : sh.sp === NARR ? 'Nobody speaks on screen (voice-over is added in editing). Acting through expression and body language only.' : 'No dialogue. Acting through expression and body language only.'}\nMood: ${moodOf(p, i, m)}.\nLook: ${st}.\n${ids.length ? `Keep every character identical to the reference images (${refList(p, ids, m, !!local)}). ` : ''}No subtitles and no on-screen text.`;
}
function multiPrompt(p, m, from, to) {
  const part = p.shots.slice(from, to), st = styleOf(p, m); let t = 0;
  const total = part.reduce((a, s) => a + (+s.sec || 5), 0);
  const lines = part.map((sh, k) => {
    const a = t; t += (+sh.sec || 5); const sp = sh.sp >= 0 ? p.chars[sh.sp] : null, line = m === 'kr' ? sh.dk : sh.de, cam = (CAMS[sh.cam] || CAMS.ms)[m === 'kr' ? 1 : 2];
    return m === 'kr'
      ? `샷 ${k + 1} (${a}~${t}초): ${sh.pk}. ${cam}. ${sh.ak}.${sp && line ? ` ${cname(sp, m)}${josa(cname(sp, m), '이')} 한국어로 말한다: "${line}"` : ' 화면 속 대사 없음.'}`
      : `Shot ${k + 1} (${a}-${t}s): ${sh.pe}. ${cam}. ${sh.ae}.${sp && line ? ` ${cname(sp, m)} says in English: "${line}"` : ' No on-screen dialogue.'}`;
  });
  return m === 'kr'
    ? `세로 9:16 숏폼 영상, 총 ${total}초, ${part.length}개 샷으로 이어지는 한 편.\n화면: ${st}.\n등장: ${legend(p, m) || '없음'}.\n모든 샷에서 등장인물의 생김새를 똑같이 유지한다. 대사는 입 모양을 맞춘다. 자막이나 화면 속 글자 없음.\n\n${lines.join('\n')}`
    : `Vertical 9:16 short-form video, ${total} seconds total, one continuous piece in ${part.length} shots.\nLook: ${st}.\nCharacters: ${legend(p, m) || 'none'}.\nKeep every character identical across all shots. Lip-sync all dialogue. No subtitles or on-screen text.\n\n${lines.join('\n')}`;
}
/* 수정한 프롬프트는 over 에 따로 보관한다 */
const PROMPTS = {
  c: (p, a, m) => charPrompt(p, +a[0], m, a[1]),
  f: (p, a, m) => framePrompt(p, +a[0], m),
  k: (p, a, m) => klingPrompt(p, +a[0], m),
  m: (p, a, m) => multiPrompt(p, m, +a[0], +a[1]),
  n: (p, a, m) => NEG[m]
};
function promptText(p, key, m) { m = m || MODE(); const ov = p.over && p.over[key + ':' + m]; if (ov != null) return ov; const a = key.split(':'); return PROMPTS[a[0]](p, a.slice(1), m); }
const promptBase = (p, key, m) => { const a = key.split(':'); return PROMPTS[a[0]](p, a.slice(1), m || MODE()); };

/* ---------- 자막·업로드·내보내기 ---------- */
function subLines(p, lang) { return lang === 'ko' ? p.shots.map(s => s.dk) : lang === 'en' ? p.shots.map(s => s.de) : (p.subs && p.subs[lang]) || null; }
function toSrt(p, lang) {
  const lines = subLines(p, lang); if (!lines) return '';
  const f = x => { const ms = Math.round(x * 1000), h = Math.floor(ms / 3600000), mi = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  let t = 0, n = 0; const out = [];
  p.shots.forEach((s, i) => { const a = t; t += (+s.sec || 5); const tx = (lines[i] || '').trim(); if (tx) out.push(`${++n}\n${f(a + 0.4)} --> ${f(t - 0.3)}\n${tx}\n`); });
  return out.join('\n');
}
function uploadKit(p, m) {
  const f = fmOf(p), ep = p.ep || 1, t = ep > 1 ? `${T(p, m)} | ${ep}편` : T(p, m);
  if (m === 'kr') return { title: t, desc: `${LG(p, m)}\n\n다음 영상도 보고 싶다면 팔로우해 주세요.\n\n#${f.hk.join(' #')} #쇼츠 #shorts`, pin: '재밌었다면 댓글에 "다음 편" 남겨 주세요!' };
  return { title: ep > 1 ? `${T(p, m)} | Part ${ep}` : T(p, m), desc: `${LG(p, m)}\n\nFollow for the next one.\n\n#${f.tags.join(' #')} #shorts #fyp`, pin: 'Comment "NEXT" if you want another one!' };
}
function toScriptText(p, m) {
  let t = 0;
  return [`[${T(p, m)}]`, LG(p, m), `종류: ${fmOf(p).name} · ${p.shots.length}샷 · ${totalSec(p)}초 · ${m === 'kr' ? '국내용' : '해외용'}`, '────────────────', '등장인물',
    ...(p.chars.length ? p.chars.map(c => `- ${cname(c, m)} (${KINDS[ckind(c)][0]} · ${ROLE_NAME[c.r] || ''}): ${clook(c, m)}`) : ['- 없음']), '────────────────',
    ...p.shots.map((s, i) => { const a = t; t += (+s.sec || 5); const who = spName(p, s, m);
      return `${tc(a)}–${tc(t)}  샷 ${i + 1} · ${beatOf(p, i)[0]}\n장소: ${s['p' + sfx(m)]}\n화면: ${s['a' + sfx(m)]}\n말: ${who && s['d' + sfx(m)] ? `${who}: ${s['d' + sfx(m)]}` : '-'}\n카메라: ${(CAMS[s.cam] || CAMS.ms)[0]}\n`; })].join('\n').trim() + '\n';
}
function toPack(p, m) {
  const k = uploadKit(p, m), half = Math.ceil(p.shots.length / 2), bar = '\n════════════════════\n';
  return [toScriptText(p, m), bar + '① 등장인물 이미지 프롬프트 (그록·챗GPT 등에 붙여넣기)\n',
    ...p.chars.map((c, i) => `▶ ${cname(c, m)} · 전신\n${promptText(p, `c:${i}:full`, m)}\n\n▶ ${cname(c, m)} · 얼굴\n${promptText(p, `c:${i}:face`, m)}\n`),
    bar + '② 샷별 프롬프트 (첫 프레임 이미지 → 클링 영상)\n',
    ...p.shots.map((s, i) => `▶ 샷 ${i + 1} 첫 프레임\n${promptText(p, `f:${i}`, m)}\n\n▶ 샷 ${i + 1} 클링 영상\n${promptText(p, `k:${i}`, m)}\n`),
    bar + '③ 클링 멀티샷 프롬프트\n', `▶ 전체\n${promptText(p, `m:0:${p.shots.length}`, m)}\n`, `▶ 앞부분\n${promptText(p, `m:0:${half}`, m)}\n`, `▶ 뒷부분\n${promptText(p, `m:${half}:${p.shots.length}`, m)}\n`,
    `▶ 제외 프롬프트\n${promptText(p, 'n', m)}\n`, bar + '④ 업로드\n', `제목: ${k.title}\n\n설명:\n${k.desc}\n\n고정 댓글: ${k.pin}\n`].join('\n');
}
const EXPORTS = [
  { id: 'pack', name: '제작 팩 전체', sub: '대본, 등장인물·샷·클링 프롬프트, 업로드 문구', ext: 'txt', mime: 'text/plain', one: p => toPack(p, MODE()), join: '\n\n████████████████████\n\n' },
  { id: 'script', name: '대본만', sub: '등장인물과 샷별 대본', ext: 'txt', mime: 'text/plain', one: p => toScriptText(p, MODE()), join: '\n\n════════════════\n\n' },
  { id: 'srt', name: '자막 파일 (SRT)', sub: '지금 모드의 언어, 한 편씩', ext: 'srt', mime: 'application/x-subrip', one: p => toSrt(p, isEn() ? 'en' : 'ko'), single: true },
  { id: 'json', name: '백업 파일 (JSON)', sub: '작업, 내 캐릭터, 첨부 사진까지. 다른 기기로 옮길 때', ext: 'json', mime: 'application/json', backup: true }
];
const buildExport = (fmt, list) => list.map(fmt.one).join(fmt.join || '\n\n');
async function buildBackup(list) {
  const images = {};
  for (const id of usedImgIds([...list, { chars: charLib }])) { const v = await imgGet(id); if (v) images[id] = v; }
  return JSON.stringify({ app: 'short-form-maker', version: 1, projects: list, chars: charLib, images });
}
const Native = {
  has: () => typeof window.AndroidBridge !== 'undefined',
  share(title, text) {
    if (this.has()) return window.AndroidBridge.shareText(title, text);
    if (navigator.share) return navigator.share({ title, text }).catch(() => {});
    copyText(text, '공유를 지원하지 않아 복사했습니다');
  },
  save(name, mime, text) {
    if (this.has()) return window.AndroidBridge.saveFile(name, mime, text);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); toast('파일로 저장했습니다');
  },
  shareImage(name, dataUrl) {
    if (this.has() && window.AndroidBridge.shareImage) return window.AndroidBridge.shareImage(name, dataUrl);
    fetch(dataUrl).then(r => r.blob()).then(b => { const f = new File([b], name, { type: 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: name }).catch(() => {}); this.saveImage(name, dataUrl); }).catch(() => this.saveImage(name, dataUrl));
  },
  saveImage(name, dataUrl) {
    if (this.has() && window.AndroidBridge.saveImage) return window.AndroidBridge.saveImage(name, dataUrl);
    const a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('사진을 저장했습니다');
  },
  exit() { if (this.has()) window.AndroidBridge.exitApp(); else { exiting = true; history.go(-2); } }
};
window.onNativeSaved = ok => toast(ok ? '파일로 저장했습니다' : '저장하지 않았습니다');
function copyText(text, msg = '복사했습니다') {
  const done = () => toast(msg);
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
}
const fileName = (label, ext) => `숏폼_${String(label).replace(/[^가-힣0-9a-zA-Z]+/g, '_').slice(0, 24)}_${dateStr().replace(/\./g, '')}.${ext}`;
function outSheet(title, text, name, mime, fileOnly) {
  const save = ['파일로 저장', name, () => Native.save(name, mime || 'text/plain', text)];
  sheet(title, fileOnly ? [save] : [['공유하기', '앱을 골라 보내기 (그록, 챗GPT, 메신저 등)', () => Native.share(title, text)], save, ['복사하기', '클립보드에 복사', () => copyText(text)]]);
}
function exportFlow(list, label) {
  if (!list.length) return toast('내보낼 대본이 없습니다');
  sheet(`${label} 내보내기`, EXPORTS.filter(f => !(f.single && list.length > 1)).map(f => [f.name, f.sub, () => f.backup
    ? buildBackup(list).then(t => outSheet(f.name, t, fileName(label, f.ext), f.mime, true))
    : outSheet(f.name, buildExport(f, list), fileName(label, f.ext), f.mime)]));
}

/* ---------- 화면 전환과 뒤로가기 ---------- */
let stack = [{ v: 'home', p: {} }], overlays = [], exiting = false;
let draft = null, dirty = false, sel = null, aiToken = null;
const cur = () => stack[stack.length - 1];
function go(v, p = {}, replace = false) { if (replace) stack.pop(); stack.push({ v, p }); render(true); }
function tab(v) { stack = v === 'home' ? [{ v: 'home', p: {} }] : [{ v: 'home', p: {} }, { v, p: {} }]; sel = null; render(true); }
function pop() { if (stack.length > 1) stack.pop(); render(true); }
function onBack() {
  if (overlays.length) return closeLayer();
  const c = cur();
  if (c.v === 'library' && sel) { sel = null; return render(); }
  if (c.v === 'editor' && dirty) {
    return dialog('수정한 내용을 저장할까요?', '저장하지 않으면 바뀐 내용이 사라집니다.', [
      ['저장 안 함', () => { dirty = false; draft = null; pop(); }], ['저장', () => { saveDraft(); pop(); }, 'pri']]);
  }
  if (stack.length > 1) return pop();
  dialog('앱을 종료하겠습니까?', '', [['아니오', null], ['예', () => Native.exit(), 'pri']]);
}
window.onAndroidBack = onBack;
history.pushState({ sfm: 1 }, '');
window.addEventListener('popstate', () => { if (exiting) return; history.pushState({ sfm: 1 }, ''); onBack(); });

let layerActs = {};
function layer(html, center) { const L = $('#layer'); L.className = center ? 'center' : ''; L.innerHTML = html; overlays.push(1); }
function closeLayer() { if (aiToken) { aiToken.cancel = true; aiToken = null; } overlays.pop(); $('#layer').innerHTML = ''; layerActs = {}; }
function dialog(title, body, acts) {
  layerActs = {};
  layer(`<div class="dialog" role="alertdialog" aria-label="${esc(title)}"><span class="di">${ic(/종료/.test(title) ? 'exit' : /삭제|지울/.test(title) ? 'trash' : 'info')}</span><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}<div class="acts">${acts.map(([l, fn, c], i) => { layerActs['d' + i] = fn; return `<button class="btn ${c || ''}" data-lact="d${i}">${esc(l)}</button>`; }).join('')}</div></div>`, true);
}
function sheet(title, rows) {
  layerActs = {};
  layer(`<div class="sheet"><h3>${esc(title)}</h3><div class="list">${rows.map(([l, sub, fn], i) => { layerActs['s' + i] = fn; return `<button class="row" data-lact="s${i}"><span class="grow"><b>${esc(l)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="chev">${ic('chevron')}</span></button>`; }).join('')}</div></div>`);
}
$('#layer').addEventListener('click', e => {
  if (e.target.id === 'layer') return closeLayer();
  const b = e.target.closest('[data-lact]'); if (!b) return;
  const fn = layerActs[b.dataset.lact]; closeLayer(); if (fn) fn();
});
let toastT;
function toast(m) { const t = $('#toast'); t.innerHTML = ic('checkc') + esc(m); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1900); }

/* ---------- AI (Gemini) ---------- */
const AI_DEFAULT_MODEL = 'gemini-3.8-flash';
const aiKeys = () => String(settings.aiKeys || '').split(/[,\s\n]+/).map(k => k.trim()).filter(Boolean);
const aiModel = () => String(settings.aiModel || AI_DEFAULT_MODEL).replace(/^models\//, '').trim() || AI_DEFAULT_MODEL;
const maskKey = k => k.length > 10 ? k.slice(0, 4) + '…' + k.slice(-4) : '••••';
const httpWait = {}, keyRest = {};
window.__nativeHttp = (id, status, text) => { const f = httpWait[id]; delete httpWait[id]; if (f) f({ status, text }); };
function httpReq(url, { method = 'GET', headers = {}, body = '' } = {}) {
  if (Native.has() && window.AndroidBridge.http) return new Promise(res => { const id = uid(); httpWait[id] = res; window.AndroidBridge.http(id, url, method, JSON.stringify(headers), body || ''); });
  return fetch(url, { method, headers, body: body || undefined }).then(async r => ({ status: r.status, text: await r.text() }), () => ({ status: 0, text: '' }));
}
function aiErr(r, ki) {
  let msg = ''; try { msg = JSON.parse(r.text).error.message || ''; } catch (e) {}
  const who = `${ki + 1}번 키`;
  if (r.status === 0) return '인터넷에 연결되지 않았거나 응답이 너무 오래 걸렸습니다. 연결을 확인하고 다시 시도하세요.';
  if (r.status === 400 && /API key/i.test(msg)) return `${who}가 올바르지 않습니다.`;
  if (r.status === 429) return `${who}의 사용 한도가 찼습니다.`;
  if (r.status === 403) return `${who}에 이 API 사용 권한이 없습니다.`;
  if (r.status === 404) return `모델 "${aiModel()}"을 찾을 수 없습니다. 설정에서 모델 목록을 불러와 다른 모델을 고르세요.`;
  if (r.status >= 500) return 'Gemini 서버가 혼잡합니다. 잠시 후 다시 시도하세요.';
  return `${who} 요청 실패 (${r.status}) ${msg.slice(0, 120)}`;
}
const AI_SYS = `You are a top writer of faceless educational, science and documentary short-form videos (YouTube Shorts, Reels, TikTok). You study why a hit video works and write a NEW script the creator can publish as their own: you keep its format, hook type, beat order, open-loop position, pacing and kind of payoff, and you write every sentence, example and visual from scratch. Never reuse an original title or sentence. Never use real living people, real brands, or characters from existing films, shows, games or comics.
Formula: shot 1 hooks within 3 seconds with a myth-busting question, a surprising number or the most astonishing image; then the common belief or context; then the real mechanism shown with ONE clear visual; then "but here is the stranger part" (an open loop that keeps people watching); then a one-line answer to the opening question; the last shot leaves a new question that invites comments. Each shot is 5 seconds with one visual and at most one narration line (Korean up to 28 characters, English up to 14 words). The visual changes every shot.
Accuracy matters more than drama. State only well-established facts, give numbers you are confident about (round them), and never invent studies, dates or quotes. If something is debated, say so in the line. List every factual claim the script makes in facts[] with a web search query that would verify it.
Narration is the voice of the video: lines are spoken by an off-screen narrator (sp = -2) unless an on-screen character speaks (sp = index into chars). Characters are optional: a recurring mascot or presenter (person, animal, original cartoon character or object) may appear; most scripts need none (chars empty). Looks must be drawable and never resemble real people.
No gore, weapons in use, sexual content or dangerous how-to (AI video generators reject them).
Korean fields are natural spoken Korean narration; English fields are natural native English and contain no Korean. Output JSON only.`;
async function gemini(prompt, schema, token, opt = {}) {
  const keys = aiKeys(); if (!keys.length) throw new Error('설정에서 Gemini API 키를 먼저 넣어 주세요.');
  const parts = []; if (opt.video) parts.push({ fileData: { fileUri: opt.video } }); parts.push({ text: prompt });
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: opt.sys || AI_SYS }] }, contents: [{ role: 'user', parts }],
    generationConfig: { temperature: opt.temp == null ? 0.9 : opt.temp, responseMimeType: 'application/json', responseSchema: schema } });
  const start = (settings.aiNext || 0) % keys.length, errs = [], now = Date.now();
  const order = keys.map((_, i) => (start + i) % keys.length).sort((a, b) => ((keyRest[keys[a]] || 0) > now) - ((keyRest[keys[b]] || 0) > now));
  for (const ki of order) {
    if (token.cancel) throw new Error('cancel');
    const r = await httpReq(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(aiModel())}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys[ki] }, body });
    if (r.status === 200) {
      settings.aiNext = (ki + 1) % keys.length; store.set('settings', settings);
      let text = ''; try { text = JSON.parse(r.text).candidates[0].content.parts.map(p => p.text || '').join(''); } catch (e) {}
      text = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
      try { return JSON.parse(text); } catch (e) { errs.push('AI 응답을 읽지 못했습니다. 다시 시도하세요.'); continue; }
    }
    errs.push(aiErr(r, ki));
    if (r.status === 429) keyRest[keys[ki]] = Date.now() + 60e3;
    else if (r.status === 403 || (r.status === 400 && /API key/i.test(r.text))) keyRest[keys[ki]] = Date.now() + 600e3;
    if (r.status === 404 || r.status === 0 || (r.status === 400 && !/API key/i.test(r.text))) break;
  }
  throw new Error(errs.length > 1 ? `모든 키가 실패했습니다.\n${errs.join('\n')}` : errs[0]);
}
const S_STR = { type: 'STRING' }, S_INT = { type: 'INTEGER' }, S_ARR = items => ({ type: 'ARRAY', items });
const S_CHAR = { type: 'OBJECT', properties: { r: S_STR, k: S_STR, nk: S_STR, ne: S_STR, dk: S_STR, de: S_STR }, required: ['r', 'k', 'nk', 'ne', 'dk', 'de'] };
const S_SHOT = { type: 'OBJECT', properties: { bt: S_STR, pk: S_STR, pe: S_STR, ak: S_STR, ae: S_STR, sp: S_INT, dk: S_STR, de: S_STR, cam: S_STR }, required: ['bt', 'pk', 'pe', 'ak', 'ae', 'sp', 'dk', 'de', 'cam'] };
const S_FACT = { type: 'OBJECT', properties: { f: S_STR, q: S_STR }, required: ['f', 'q'] };
const S_SCRIPT = { type: 'OBJECT', properties: { tk: S_STR, te: S_STR, lk: S_STR, le: S_STR, fmt: S_STR, style: S_STR, chars: S_ARR(S_CHAR), shots: S_ARR(S_SHOT), facts: S_ARR(S_FACT) }, required: ['tk', 'te', 'lk', 'le', 'fmt', 'style', 'chars', 'shots', 'facts'] };
const AI_FIELDS = `JSON fields: tk/te = Korean/English title (a curiosity-driven title that states the question or the surprising fact, no clickbait lies); lk/le = Korean/English one-line summary; fmt = one of ${FORMATS.map(f => `${f.id} (${f.en})`).join(', ')}; style = one of ${Object.entries(STYLES).map(([k, v]) => `${k} (${v[0]})`).join(', ')} chosen to fit the topic (nature, places and real objects: docreal; how things work, space, the body: sci3d; numbers, comparisons, everyday knowledge: motion; past events: history); chars[] (usually empty) = {r: role code H presenter or lead, A helper, X other; k: kind code P person, A animal, C original cartoon character, O object; nk/ne = Korean/English name; dk/de = Korean/English look}; shots[] = {bt = Korean beat label of 2 to 4 characters such as 훅, 오해, 원리, 반전, 핵심, 마무리; pk/pe = Korean/English setting of the visual; ak/ae = Korean/English description of what is on screen, concrete enough for an image generator, naming any character that appears; sp = -2 for narrator, speaker index into chars, or -1 for silence; dk/de = Korean/English narration line or empty; cam = one of ${Object.keys(CAMS).join(', ')}}; facts[] = {f: one factual claim the script makes, in Korean; q: a short web search query (Korean for Korean facts, English otherwise) to verify it}.`;
const draftJson = p => JSON.stringify({ tk: p.tk, te: p.te, lk: p.lk, le: p.le, fmt: p.fmt, style: p.style, chars: p.chars.map(c => ({ r: c.r, k: ckind(c), nk: c.nk, ne: c.ne, dk: c.dk, de: c.de })), shots: p.shots.map(s => ({ bt: s.bt || '', pk: s.pk, pe: s.pe, ak: s.ak, ae: s.ae, sp: s.sp, dk: s.dk, de: s.de, cam: s.cam })) });
const cleanShot = (s, nChars) => { const sp = Number.isInteger(s.sp) && s.sp >= NARR && s.sp < nChars ? s.sp : -1, line = sp === -1 ? '' : null;
  return { bt: String(s.bt || '').slice(0, 8), pk: String(s.pk || ''), pe: String(s.pe || ''), ak: String(s.ak || ''), ae: String(s.ae || ''), sp, dk: line == null ? String(s.dk || '') : '', de: line == null ? String(s.de || '') : '', cam: CAMS[s.cam] ? s.cam : 'ms', sec: 5 }; };
function applyScript(p, r) {
  if (!r || !Array.isArray(r.shots) || !r.shots.length) return false;
  ['tk', 'te', 'lk', 'le'].forEach(k => { if (r[k]) p[k] = String(r[k]); });
  if (FM[r.fmt]) p.fmt = r.fmt;
  if (STYLES[r.style]) p.style = r.style;
  if (Array.isArray(r.chars)) p.chars = r.chars.slice(0, 4).map((c, i) => { const old = p.chars[i], same = old && old.nk === String(c.nk || '');
    return Object.assign({ r: ROLE_NAME[c.r] ? c.r : 'X', k: kindCode(c.k), nk: String(c.nk || ''), ne: String(c.ne || ''), dk: String(c.dk || ''), de: String(c.de || '') },
      old && old.ok ? { ok: old.ok } : {}, same ? { imgFull: old.imgFull || '', imgFace: old.imgFace || '', libId: old.libId || '' } : {}); });
  p.shots = r.shots.slice(0, 10).map(s => cleanShot(s, p.chars.length));
  if (Array.isArray(r.facts)) p.facts = r.facts.filter(x => x && x.f).slice(0, 8).map(x => ({ f: String(x.f), q: String(x.q || x.f), ok: false }));
  p.over = {}; p.subs = {}; return true;
}
function aiRun(label, job, apply, note) {
  if (!aiKeys().length) return dialog('Gemini API 키가 필요합니다', '설정에서 키를 넣으면 AI가 대본을 바꿔 씁니다.', [['닫기', null], ['설정 열기', () => go('settings'), 'pri']]);
  const token = { cancel: false }; layerActs = { c0: () => { token.cancel = true; } };
  layer(`<div class="dialog" role="alertdialog" aria-label="${esc(label)}"><span class="spin" aria-hidden="true"></span><h3>${esc(label)}</h3><p>Gemini · ${esc(aiModel())}\n${esc(note || '보통 10~40초 걸립니다.')}</p><div class="acts"><button class="btn" data-lact="c0">취소</button></div></div>`, true);
  aiToken = token;
  job(token).then(res => { if (token.cancel) return; aiToken = null; closeLayer(); apply(res); },
    e => { if (token.cancel) return; aiToken = null; closeLayer(); dialog('AI 작업에 실패했습니다', e.message, [['닫기', null], ['설정 열기', () => go('settings')]]); });
}

/* ----- 원본 → 내 대본 ----- */
const KIND_EN = { P: 'person', A: 'animal', C: 'original cartoon character', O: 'object character' };
const fmtGuess = (text, kind) => FM[kind] ? kind : /과학|우주|science|space|physics|biology|chem/i.test(String(text || '')) ? 'sci' : /다큐|역사|미스터리|document|history|mystery/i.test(String(text || '')) ? 'doc' : 'edu';
const remixShots = q => { const s = q.src, n = +q.len || s.script.length || (s.flow.length ? s.flow.length + 1 : 6); return Math.max(4, Math.min(8, n)); };
const remixNoCast = q => q.castMode === 'none' || (!q.src.cast.length && q.castMode !== 'add');
const remixMy = q => String(q.topic || '').trim();
function remixPrompt(q) {
  const s = q.src, sim = SIMS.find(x => x[0] === (+q.sim || 2)) || SIMS[1], n = remixShots(q), noCast = remixNoCast(q), my = remixMy(q), dir = String(settings.myBg || '').trim();
  const cast = s.cast.map((c, i) => { const lc = q['cl' + i] && charLib.find(x => x.id === q['cl' + i]), mine = String(q['c' + i] || '').trim(), kc = kindCode(c.kind);
    return `${i + 1}. ${c.role} [${KIND_EN[kc]}] original: "${[c.who, c.look].filter(Boolean).join(' / ') || 'no details'}" → ` + (lc ? `use the creator's saved character exactly: kind ${ckind(lc)}, Korean name "${lc.nk}", English name "${lc.ne}", Korean look "${lc.dk}", English look "${lc.de}"` : mine ? `the creator wants (may be Korean): ${mine}` : `invent a similar-but-different new ${KIND_EN[kc]} with the same role and charm`); });
  const castText = noCast ? 'NO recurring characters. Return chars as an empty array. Visuals are footage-like scenes, diagrams, objects, places, animals in the wild or hands. Every line uses sp = -2 (narrator).'
    : s.cast.length ? `Return chars in this same order and keep each kind (a person stays a person, an animal stays an animal but another breed, color or species, a cartoon character stays an original cartoon character with a clearly different design).\n${cast.join('\n')}`
      : `The original has no characters, but the creator wants to add: ${String(q.cadd || '').trim() || 'one fitting lead character'}.`;
  return [`Adapt the hit short-form video below into ONE new original script.`,
    `Similarity: ${sim[2]}`,
    `Shots: exactly ${n} shots of 5 seconds.`,
    `Topic: ${my ? `the creator chose this topic (may be Korean): ${my}` : (+q.sim || 2) === 1 ? 'the same topic as the original' : 'pick a fresh topic in the same field that has the same kind of surprise'}.`,
    dir ? `The creator's channel direction (may be Korean): ${dir}.` : '',
    `Characters: ${castText}`,
    s.visual ? `Original visual style: ${s.visual}. Use a fitting style value.` : '',
    `Ending: original "${s.ending || 'unknown'}" → ${String(q.end || '').trim() || 'the same kind of payoff for the new topic'}.`,
    q.more ? `Extra request (may be Korean): ${q.more}` : '',
    `Target audience: ${isEn() ? 'English-speaking viewers; the English fields are what gets filmed' : 'Korean viewers; the Korean fields are what gets filmed'}.`,
    AI_FIELDS, '',
    'ORIGINAL VIDEO (analysis in Korean; study it, do not copy it):',
    JSON.stringify({ title: s.title, topic: s.topic, format: s.format, visual: s.visual, hook: s.hook, structure: s.structure, open_loop: s.loops, script: s.script, facts_claimed: s.facts, flow: s.flow, ending: s.ending, why_it_works: s.take, viewer_reaction: s.reaction })].filter(x => x !== '').join('\n');
}
const slimSrc = s => ({ id: s.id || '', url: s.url || '', thumb: s.thumb || '', title: s.title || '', from: s.from || '', topic: s.topic || '', format: s.format || '', visual: s.visual || '', audio: s.audio || '', hook: s.hook || '', loops: s.loops || '', cast: s.cast, script: s.script, flow: s.flow, ending: s.ending || '' });
function aiRemix(q) {
  const s = q.src;
  aiRun('AI가 내 대본으로 바꿔 쓰는 중', token => gemini(remixPrompt(q), S_SCRIPT, token), r => {
    const p = newProject(fmtGuess(`${s.topic} ${s.genre || ''}`, s.kind));
    if (!applyScript(p, r)) return toast('AI 응답이 비어 있습니다');
    if (remixNoCast(q)) { p.chars = []; p.shots.forEach(x => { if (x.sp >= 0) x.sp = x.dk || x.de ? NARR : -1; }); }
    p.chars.forEach((c, i) => { const o = s.cast[i], lc = q['cl' + i] && charLib.find(x => x.id === q['cl' + i]);
      if (o) c.ok = [o.who, o.look].filter(Boolean).join(' · ');
      if (lc) Object.assign(c, { k: ckind(lc), nk: lc.nk, ne: lc.ne, dk: lc.dk, de: lc.de, imgFull: lc.imgFull || '', imgFace: lc.imgFace || '', libId: lc.id }); });
    p.src = slimSrc(s); p.ai = true; draft = p; dirty = true; go('editor', {}, true); toast('내 대본으로 바꿨습니다 · 사실 확인 뒤 원클릭 제작을 누르세요');
  });
}
function aiIdea(fmt, idea) {
  const f = FM[fmt] || FM.edu;
  aiRun('AI가 새 대본을 쓰는 중', token => gemini(`Write one original faceless ${f.en.toLowerCase()} short.\nField: ${f.en} (${f.name}).\nTopic or idea (may be Korean): ${idea || 'none; pick a surprising, verifiable topic that is trending in this field'}.\nThe creator's channel direction (may be Korean): ${String(settings.myBg || '').trim() || 'none'}.\nShots: 6 shots of 5 seconds.\nTarget audience: ${isEn() ? 'English-speaking viewers' : 'Korean viewers'}.\n${AI_FIELDS}`, S_SCRIPT, token),
    r => { const p = newProject(fmt); if (!applyScript(p, r)) return toast('AI 응답이 비어 있습니다'); p.ai = true; draft = p; dirty = true; go('editor', {}, true); toast('AI가 대본을 썼습니다 · 사실 확인을 먼저 하세요'); });
}
function aiRewriteAll() {
  const p = draft;
  aiRun('AI가 대본을 다시 쓰는 중', token => gemini(`Rewrite this short-form script to be far more gripping and clearer while keeping the same topic, the facts that are correct, the same number of shots (${p.shots.length}) and the same characters (same order, names and kinds) unless the request says otherwise.\nCreator's request (may be Korean): ${(p.aiReq || '').trim() || 'none'}.\n${AI_FIELDS}\nCurrent script JSON:\n${draftJson(p)}\nCurrent facts: ${JSON.stringify((p.facts || []).map(x => x.f))}`, S_SCRIPT, token),
    r => { const undo = draftJson(p); if (!applyScript(p, r)) return toast('AI 응답이 비어 있습니다'); p._undo = undo; p.ai = true; dirty = true; render(); toast('AI가 대본을 다시 썼습니다'); });
}
function aiShot(i) {
  const p = draft, sh = p.shots[i];
  aiRun(`AI가 샷 ${i + 1}을 다시 쓰는 중`, token => gemini(`Here is a short-form script JSON:\n${draftJson(p)}\n\nRewrite ONLY shot ${i + 1} (beat: ${beatOf(p, i)[0]}) in 3 clearly different ways. Keep continuity with the other shots and the same characters.\n${AI_FIELDS}`,
    { type: 'OBJECT', properties: { options: S_ARR(S_SHOT) }, required: ['options'] }, token),
  r => {
    const opts = (r.options || []).filter(o => o && (o.ak || o.ae)).slice(0, 3); if (!opts.length) return toast('AI 응답이 비어 있습니다');
    const k = sfx();
    sheet(`샷 ${i + 1} · 마음에 드는 안을 고르세요`, opts.map((o, n) => [`${n + 1}안 · ${o['a' + k]}`, o['d' + k] ? `말: ${o['d' + k]}` : '말 없음', () => {
      const c = cleanShot(o, p.chars.length);
      Object.assign(sh, { pk: c.pk || sh.pk, pe: c.pe || sh.pe, ak: c.ak || sh.ak, ae: c.ae || sh.ae, dk: c.dk, de: c.de, sp: c.sp, cam: CAMS[o.cam] ? o.cam : sh.cam });
      ['f', 'k'].forEach(x => ['kr', 'en'].forEach(m => delete p.over[`${x}:${i}:${m}`])); dirty = true; render(); toast(`${n + 1}안으로 바꿨습니다`); }]));
  });
}
/* 비슷하지만 다른 등장인물 3안 */
function aiCharVar(i) {
  const p = draft, c = p.chars[i], kc = ckind(c);
  const S = { type: 'OBJECT', properties: { options: S_ARR({ type: 'OBJECT', properties: { nk: S_STR, ne: S_STR, dk: S_STR, de: S_STR }, required: ['nk', 'ne', 'dk', 'de'] }) }, required: ['options'] };
  aiRun(`${cname(c) || '등장인물'}의 다른 안을 만드는 중`, token => gemini(`Design 3 alternative characters for a short-form video. Each must fill the same role and keep the same charm as the reference, stay a ${KIND_EN[kc]}, and look clearly different from the reference and from each other (for an animal: another breed, color or species; for a person: other age, hair, outfit; for a cartoon character: other shape and palette). No real people, no existing franchise characters.\nRole: ${ROLE_NAME[c.r] || 'character'}.\nSource video's character (Korean, do not copy): ${c.ok || 'unknown'}.\nCurrent character: Korean name "${c.nk}", look "${c.dk}"; English name "${c.ne}", look "${c.de}".\nScript summary: ${p.lk || p.le}.\nReturn options[] = {nk/ne = Korean/English name, dk/de = Korean/English drawable look}.`, S, token),
  r => {
    const opts = (r.options || []).filter(o => o && (o.dk || o.de)).slice(0, 3); if (!opts.length) return toast('AI 응답이 비어 있습니다');
    const k = sfx();
    sheet(`${cname(c) || '등장인물'} · 마음에 드는 안을 고르세요`, opts.map((o, n) => [`${n + 1}안 · ${o['n' + k] || ''}`, o['d' + k] || '', () => {
      swapName(p, c.nk, o.nk); swapName(p, c.ne, o.ne);
      Object.assign(c, { nk: String(o.nk || c.nk), ne: String(o.ne || c.ne), dk: String(o.dk || c.dk), de: String(o.de || c.de), imgFull: '', imgFace: '', libId: '' });
      p.over = {}; dirty = true; render(); toast(`${n + 1}안으로 바꿨습니다 · 대본 속 이름도 바뀌었습니다`); }]));
  });
}
function aiSync() {
  const p = draft, from = MODE(), toName = from === 'kr' ? 'natural native English (Western names)' : 'natural Korean (Korean names)', f = sfx(from), t = from === 'kr' ? 'e' : 'k';
  const src = { title: p['t' + f], logline: p['l' + f], chars: p.chars.map(c => ({ name: c['n' + f], look: c['d' + f] })), shots: p.shots.map(s => ({ place: s['p' + f], action: s['a' + f], line: s['d' + f] })) };
  const S = { type: 'OBJECT', properties: { title: S_STR, logline: S_STR, chars: S_ARR({ type: 'OBJECT', properties: { name: S_STR, look: S_STR }, required: ['name', 'look'] }), shots: S_ARR({ type: 'OBJECT', properties: { place: S_STR, action: S_STR, line: S_STR }, required: ['place', 'action', 'line'] }) }, required: ['title', 'logline', 'chars', 'shots'] };
  aiRun(from === 'kr' ? '한국어 내용을 영어판에 반영하는 중' : '영어 내용을 한국어판에 반영하는 중', token => gemini(`Adapt this short-form script into ${toName}. Keep the same order and number of characters (${src.chars.length}) and shots (${src.shots.length}). Keep lines short and punchy; an empty line stays empty. Do not translate literally.\n${JSON.stringify(src)}`, S, token),
    r => {
      if (!r || !Array.isArray(r.shots)) return toast('AI 응답이 비어 있습니다');
      p['t' + t] = r.title || p['t' + t]; p['l' + t] = r.logline || p['l' + t];
      (r.chars || []).slice(0, p.chars.length).forEach((c, i) => { p.chars[i]['n' + t] = c.name || p.chars[i]['n' + t]; p.chars[i]['d' + t] = c.look || p.chars[i]['d' + t]; });
      r.shots.slice(0, p.shots.length).forEach((s, i) => { const sh = p.shots[i]; sh['p' + t] = s.place || sh['p' + t]; sh['a' + t] = s.action || sh['a' + t]; sh['d' + t] = sh['d' + f] ? (s.line || sh['d' + t]) : ''; });
      dirty = true; render(); toast(from === 'kr' ? '영어판에 반영했습니다' : '한국어판에 반영했습니다');
    });
}
function aiSubs(lang) {
  const p = draft, name = (SUB_LANGS.find(l => l[0] === lang) || [])[1] || lang;
  aiRun(`${name} 자막을 만드는 중`, token => gemini(`Translate these short-form video subtitle lines into the language with code "${lang}" (${name}). Natural, punchy subtitle style. Return exactly ${p.shots.length} items in the same order; an empty input stays an empty string.\nKorean: ${JSON.stringify(p.shots.map(s => s.dk))}\nEnglish: ${JSON.stringify(p.shots.map(s => s.de))}`,
    { type: 'OBJECT', properties: { lines: S_ARR(S_STR) }, required: ['lines'] }, token),
    r => { if (!r || !Array.isArray(r.lines)) return toast('AI 응답이 비어 있습니다'); p.subs = p.subs || {}; p.subs[lang] = p.shots.map((s, i) => String(r.lines[i] || '')); dirty = true; render(); toast(`${name} 자막을 만들었습니다`); });
}
async function aiTest() {
  const keys = aiKeys(); if (!keys.length) return toast('API 키를 먼저 넣어 주세요');
  const box = $('#aiStatus'); if (box) box.innerHTML = `<span class="spin sm"></span> 키 ${keys.length}개 확인 중…`;
  const lines = []; let models = [], allNames = [];
  for (let i = 0; i < keys.length; i++) {
    const r = await httpReq('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': keys[i] } });
    if (r.status === 200) {
      lines.push([true, `${i + 1}번 키 ${maskKey(keys[i])} 사용 가능`]);
      if (!models.length) try { allNames = JSON.parse(r.text).models.map(m => m.name.replace(/^models\//, '')); models = JSON.parse(r.text).models.filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')).filter(n => /^gemini/.test(n) && !/(embed|image|tts|audio|live|vision|aqa|robotics|computer)/i.test(n)); } catch (e) {}
    } else lines.push([false, `${i + 1}번 키 ${maskKey(keys[i])}: ${aiErr(r, i)}`]);
  }
  const tts = allNames.filter(n => /tts/i.test(n));
  if (tts.length) settings.ttsModel = tts.find(n => /flash/.test(n) && !/lite/.test(n)) || tts[0];
  settings.aiModels = models.slice(0, 16);
  if (models.length && !models.includes(aiModel())) settings.aiModel = models.find(n => n === AI_DEFAULT_MODEL) || models.find(n => /flash/.test(n) && !/lite|preview|exp/.test(n)) || models[0];
  settings.aiCheck = lines; saveSettings(); render();
  const ok = lines.filter(l => l[0]).length; toast(ok ? `키 ${keys.length}개 중 ${ok}개 사용 가능` : '사용 가능한 키가 없습니다');
}

/* ----- 영상을 직접 보고 분석 (유튜브 주소를 Gemini에 넘긴다) ----- */
const ytId = u => { const m = String(u || '').match(/(?:shorts\/|watch\?(?:.*&)?v=|youtu\.be\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(String(u || '').trim()) ? String(u).trim() : ''; };
const AN_SYS = 'You are a careful short-form video analyst. You watch the attached video fully and describe only what is actually in it. You answer in easy Korean. You never transcribe lines word for word; you write the gist in your own words. You never name real people or existing franchise characters; you describe looks instead. Output JSON only.';
const S_ANALYSIS = { type: 'OBJECT', properties: { title_ko: S_STR, topic: S_STR, format: S_STR, visual: S_STR, audio: S_STR, hook: S_STR, structure: S_STR, loops: S_STR,
  cast: S_ARR({ type: 'OBJECT', properties: { role: S_STR, kind: S_STR, who: S_STR, look: S_STR }, required: ['role', 'kind', 'who', 'look'] }),
  script: S_ARR({ type: 'OBJECT', properties: { t: S_STR, scene: S_STR, line: S_STR }, required: ['t', 'scene', 'line'] }),
  facts: S_ARR(S_STR), flow: S_ARR(S_STR), ending: S_STR, take: S_STR }, required: ['title_ko', 'topic', 'format', 'visual', 'audio', 'hook', 'structure', 'loops', 'cast', 'script', 'facts', 'flow', 'ending', 'take'] };
function aiAnalyze(id, done) {
  aiRun('AI가 영상을 직접 보는 중', token => gemini(`붙인 유튜브 영상을 처음부터 끝까지 보고 아래 항목을 한국어로 채워라. 교육·과학·다큐멘터리 정보형 숏폼으로 보고 분석한다.
- title_ko: 이 영상을 한 줄로 부를 제목 (원래 제목을 그대로 옮기지 않는다)
- topic: 다루는 주제 한 줄
- format: 구성 방식 한 단어 (질문 풀이/놀라운 사실/원리 해부/비교/순위/역사 이야기/실험/기타)
- visual: 화면 방식 (실사 자료화면/3D 애니메이션/모션그래픽/일러스트/진행자 출연/자막 위주)
- audio: 소리 방식 (내레이션 / 진행자 말 / 자막만 / 음악만)
- hook: 첫 3초에 시선을 잡는 방식 한 줄
- structure: 구성 흐름 (예: 질문 → 흔한 오해 → 진짜 원리 → 반전 사실 → 한 줄 결론)
- loops: 끝까지 보게 만드는 장치 한 줄
- cast: 화면에 계속 나오는 진행자·동물·캐릭터·사물 0~4. kind 는 사람/동물/캐릭터/사물 중 하나, look 은 그림으로 다시 그릴 수 있는 외형 한 줄. 자료화면·풍경뿐이면 빈 목록.
- script: 장면 순서대로 4~8줄. t 는 시간 구간(예: 0~3초), scene 은 화면에 보이는 것, line 은 그 장면의 내레이션·자막 요지 (없으면 빈 문자열)
- facts: 영상이 전하는 핵심 사실 2~4개 요약 (맞는지 판단하지 않는다)
- flow: 마무리 직전까지의 흐름 3~5단계
- ending: 마무리 한 줄
- take: 이 영상이 잘 되는 이유 한 줄`, S_ANALYSIS, token, { video: `https://www.youtube.com/watch?v=${id}`, sys: AN_SYS, temp: 0.3 }),
    r => { if (!r || !Array.isArray(r.script)) return toast('AI 응답이 비어 있습니다'); done(r); }, '영상 길이에 따라 30초~2분 걸립니다.');
}

/* ---------- 유행 리포트 (short-form-report 저장소가 매일 아침 교육·과학·다큐 인기 쇼츠를 한국·해외로 수집·분석) ---------- */
const TRENDS_BASE = 'https://raw.githubusercontent.com/happyfamily1984/short-form-report/main/trends/data/';
const trendsBase = () => (String(settings.trendsUrl || '').trim() || TRENDS_BASE).replace(/\/?$/, '/');
let trendsMem = null;
const trends = () => trendsMem || (trendsMem = store.get('trends', { dates: [], days: {}, fetched: 0 }));
/* 리포트가 커서 저장 공간이 모자라면 오래된 날부터 덜어 내고 저장한다 */
function saveTrends(t) {
  trendsMem = t; const keys = Object.keys(t.days).sort().reverse();
  for (let n = Math.min(keys.length, 3); n >= 1; n--) { const days = {}; keys.slice(0, n).forEach(k => { days[k] = t.days[k]; }); try { localStorage.setItem('sfm.trends', JSON.stringify({ dates: t.dates, days, fetched: t.fetched })); return; } catch (e) {} }
}
const ginfo = (an, g) => (an && an.genre_info && an.genre_info[g]) || { market: /^해외/.test(g || '') ? 'global' : 'kr', kind: /과학/.test(g || '') ? 'sci' : /다큐/.test(g || '') ? 'doc' : /교육/.test(g || '') ? 'edu' : 'old' };
const slimVideo = v => ({ mkt: v.market || ginfo(null, v.genre).market, kind: v.kind || ginfo(null, v.genre).kind, id: v.video_id, url: v.url, thumb: /^https:\/\/i\.ytimg\.com\//.test(v.thumbnail || '') ? v.thumbnail : '', title: v.title, channel: v.channel, views: v.views, likes: v.likes, dur: v.duration_sec, genre: v.genre, rank: v.rank, vel: v.velocity, ratio: v.view_sub_ratio, comments: (v.top_comments || []).slice(0, 3).map(c => c.text) });
const man = n => n >= 1e8 ? `${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1)}만` : String(n || 0);
async function fetchTrends(date, quiet) {
  if (!quiet) toast('유행 영상을 불러오는 중…');
  const base = trendsBase(), bust = '?t=' + Date.now(), t = trends();
  const fail = (a, b) => { if (!quiet) dialog(a, b, [['닫기', null]]); };
  let dates = t.dates;
  if (!date) {
    const h = await httpReq(base + 'history.csv' + bust);
    if (h.status !== 200) return fail('유행 영상을 읽지 못했습니다', h.status === 0 ? '인터넷 연결을 확인하세요.' : `리포트 저장소의 기록 파일을 찾지 못했습니다 (응답 ${h.status}).`);
    dates = [...new Set(h.text.split('\n').slice(1).map(l => l.split(',')[0].trim()).filter(d => /^\d{4}-\d\d-\d\d$/.test(d)))].sort().reverse().slice(0, 7);
    if (!dates.length) return fail('아직 수집된 리포트가 없습니다', '리포트 저장소의 자동 수집(매일 아침 6시)이 한 번 돈 뒤에 다시 눌러 주세요.');
    date = dates[0];
  }
  const [a, r] = await Promise.all([httpReq(base + date + '/analysis.json' + bust), httpReq(base + date + '/raw.json' + bust)]);
  let analysis = null, raw = null;
  try { if (a.status === 200) analysis = JSON.parse(a.text); } catch (e) {}
  try { if (r.status === 200) raw = JSON.parse(r.text); } catch (e) {}
  if (!analysis && !raw) return fail(`${date} 리포트를 읽지 못했습니다`, a.status === 0 ? '인터넷 연결을 확인하세요.' : '그날 분석 파일이 없거나 형식이 올바르지 않습니다.');
  const days = Object.assign({}, t.days);
  days[date] = { analysis, videos: raw && Array.isArray(raw.videos) ? raw.videos.map(slimVideo).map(v => Object.assign(v, analysis && analysis.genre_info && analysis.genre_info[v.genre] ? { mkt: analysis.genre_info[v.genre].market, kind: analysis.genre_info[v.genre].kind } : {})) : [] };
  saveTrends({ dates, days, fetched: Date.now() });
  if (cur().v === 'home') { cur().p.d = date; render(); }
  if (!quiet) toast(`${date} 유행 영상을 불러왔습니다`);
}
/* 리포트의 영상 한 편 → 바꿔 쓰기 화면의 원본 */
const noGuess = x => String(x || '').replace(/\s*\((?:추정|샘플)[^)]*\)\.?/g, '').trim();
const splitFlow = x => noGuess(x).split(/\s*(?:→|->|⇒|>)\s*/).map(t => t.trim()).filter(Boolean);
const vaOf = (an, genre, id) => ((an && an.genres && an.genres[genre] && an.genres[genre].videos) || []).find(x => x.video_id === id);
function srcFrom(va, extra) {
  va = va || {};
  const fl = Array.isArray(va.flow) && va.flow.length ? va.flow.map(noGuess).filter(Boolean) : splitFlow(va.structure);
  return Object.assign({ topic: noGuess(va.topic), visual: noGuess(va.visual), loops: noGuess(va.loops), facts: (Array.isArray(va.facts) ? va.facts : []).map(noGuess).filter(Boolean).slice(0, 5), format: noGuess(va.format), audio: noGuess(va.audio), hook: noGuess(va.hook), structure: noGuess(va.structure), take: noGuess(va.take), reaction: noGuess(va.reaction),
    cast: (Array.isArray(va.cast) ? va.cast : []).filter(c => c && (c.who || c.look || c.desc)).slice(0, 4).map(c => ({ role: noGuess(c.role) || '등장인물', kind: KINDS[kindCode(c.kind)][0], who: noGuess(c.who || c.desc), look: noGuess(c.look) })),
    script: (Array.isArray(va.script) ? va.script : []).filter(x => x && (x.scene || x.line)).slice(0, 10).map(x => ({ t: String(x.t || ''), scene: noGuess(x.scene), line: noGuess(x.line) })),
    flow: fl, ending: noGuess(va.ending), watched: !!va.watched }, extra || {});
}
const srcOfVideo = (v, va) => srcFrom(va, { id: v.id, url: v.url, thumb: v.thumb, title: (va && va.title_ko) || v.title, orig: v.title, genre: v.genre, kind: v.kind, from: `${String(v.genre || '').replace(/^해외\s*/, '')} · 조회 ${man(v.views)}`, dur: v.dur, views: v.views });
const srcEmpty = s => !s.script.length && !s.flow.length && !s.cast.length && !s.hook && !s.topic;

/* ---------- 클링 자동 입력 (접근성 서비스) ---------- */
/* 저장된 순서가 앱에 든 기본 순서보다 오래됐으면 기본 순서를 쓴다 */
const newerFlow = (saved, def) => saved && Array.isArray(saved.shot) && (parseFloat(saved.version) || 0) >= (parseFloat(def.version) || 0) ? saved : def;
const flowNow = () => newerFlow(settings.klingFlow, KLING_FLOW_DEFAULT);
const grokFlow = () => newerFlow(settings.grokFlow, GROK_FLOW_DEFAULT);
const gInfo = () => { if (!Native.has() || !window.AndroidBridge.autoInfo) return null; try { return JSON.parse(window.AndroidBridge.autoInfo('grok', grokFlow().package || '')); } catch (e) { return null; } };
const pickleFlow = () => newerFlow(settings.pickleFlow, PICKLE_FLOW_DEFAULT);
const pInfo = () => { if (!Native.has() || !window.AndroidBridge.autoInfo) return null; try { return JSON.parse(window.AndroidBridge.autoInfo('pickle', pickleFlow().package || '')); } catch (e) { return null; } };
const flowUrl = () => String(settings.klingFlowUrl || '').trim() || KLING_FLOW_URL_DEFAULT;
const kInfo = () => { if (!Native.has() || !window.AndroidBridge.klingInfo) return null; try { return JSON.parse(window.AndroidBridge.klingInfo(flowNow().package || '')); } catch (e) { return null; } };
async function buildKlingJob(p, range, skipSet) {
  const m = MODE(), pick = c => c.imgFull || c.imgFace, miss = new Set(), shots = [];
  const imgsFor = async ids => { const out = []; for (const i of ids) { const v = await imgGet(pick(p.chars[i])); if (v) out.push(v); else miss.add(cname(p.chars[i], m)); } return out; };
  if (range === 'multi') shots.push({ prompt: promptText(p, `m:0:${p.shots.length}`, m), images: await imgsFor(p.chars.map((c, i) => i)), sec: totalSec(p) });
  else for (const i of (range === 'all' ? p.shots.map((x, n) => n) : range === 'vid' ? vidShots(p) : Array.isArray(range) ? range : [+range])) {
    if (skipSet && skipSet.has(i)) { shots.push({ skip: true, prompt: '', images: [], sec: p.shots[i].sec || 5, tag: m === 'kr' ? `[샷 ${i + 1}/${p.shots.length}` : `[Shot ${i + 1}/${p.shots.length}` }); continue; }
    const ov = p.over && p.over[`k:${i}:${m}`];
    const ids = inShot(p, p.shots[i]), has = []; for (const c of ids) if (await imgGet(pick(p.chars[c]))) has.push(c);
    shots.push({ prompt: ov != null ? ov : klingPrompt(p, i, m, has), images: await imgsFor(ids), sec: p.shots[i].sec || 5, tag: m === 'kr' ? `[샷 ${i + 1}/${p.shots.length}` : `[Shot ${i + 1}/${p.shots.length}` });
  }
  return { job: { shots, neg: promptText(p, 'n', m), mode: m }, miss: [...miss] };
}
function klingNeedSetup(info) {
  if (!Native.has()) return dialog('안드로이드 앱에서만 됩니다', '클링 자동 입력은 휴대폰에 설치한 앱에서 동작합니다.', [['닫기', null]]), true;
  if (!info || !info.on) return dialog('자동 입력을 켜 주세요', '접근성 설정 > 설치된 앱 > "숏폼 메이커 · 자동 입력"을 켜야 합니다. 켜지지 않고 회색이면 앱 정보 > 오른쪽 위 ⋮ > "제한된 설정 허용"을 먼저 누르세요.', [['앱 정보', () => window.AndroidBridge.openAppInfo()], ['접근성 설정', () => window.AndroidBridge.openAccessibility(), 'pri']]), true;
  if (!info.pkg) return dialog('클링 앱을 찾지 못했습니다', '클링 앱이 설치되어 있는지 확인하세요.', [['닫기', null]]), true;
  return false;
}
function klingSend() {
  const p = draft, info = kInfo(); if (klingNeedSetup(info)) return;
  if (info.running) return toast('이미 자동 입력이 진행 중입니다');
  const go2 = range => buildKlingJob(p, range).then(({ job, miss }) => {
    const start = auto => { job.autoGenerate = auto; settings.klingAuto = auto; store.set('settings', settings); const r = window.AndroidBridge.startKling(JSON.stringify(job), JSON.stringify(flowNow())); if (r !== 'ok') dialog('자동 입력을 시작하지 못했습니다', r, [['닫기', null]]); };
    const confirm = () => dialog('클링에 자동으로 입력합니다', `${job.shots.length}개를 차례로 입력합니다. 진행 중에는 화면을 만지지 마세요. 멈추려면 위쪽 막대의 "중지"를 누르세요.${flowNow().verified ? '' : '\n\n아직 클링 화면에 완전히 맞춰지지 않은 순서라 중간에 멈출 수 있습니다. 멈추면 그 화면을 기록해 보내 주세요.'}`,
      [['입력만', () => start(false)], ['생성까지', () => start(true), 'pri']]);
    if (miss.length) dialog('사진이 없는 등장인물이 있습니다', `${miss.join(', ')}의 사진이 없습니다. 등장인물 탭에서 사진을 첨부하면 생김새가 일정하게 나옵니다.`, [['취소', null], ['사진 없이 진행', confirm, 'pri']]);
    else confirm();
  });
  sheet('클링으로 보내기', [[`영상 샷만 (${vidShots(p).map(i => i + 1).join(', ')}번)`, `크레딧 약 ${vidShots(p).length * KLING_COST} · 나머지는 그록 이미지`, () => go2('vid')], [`전체 ${p.shots.length}샷을 차례로`, `크레딧 약 ${p.shots.length * KLING_COST}`, () => go2('all')], ['멀티샷 한 번에', '모든 샷을 한 프롬프트로 (멀티샷 지원 모델)', () => go2('multi')],
    ...p.shots.map((x, i) => [`${i + 1}번 샷만`, `${beatOf(p, i)[0]} · ${x['a' + sfx()] || ''}`, () => go2(i)])]);
}
async function fetchFlow() {
  toast('순서를 불러오는 중…');
  const got = [], bad = [];
  for (const [key, url, name] of [['klingFlow', flowUrl(), '클링'], ['grokFlow', String(settings.grokFlowUrl || '').trim() || GROK_FLOW_URL_DEFAULT, '그록'], ['pickleFlow', String(settings.pickleFlowUrl || '').trim() || PICKLE_FLOW_URL_DEFAULT, '피클']]) {
    const r = await httpReq(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
    try { if (r.status !== 200) throw r.status; const f = JSON.parse(r.text); if (!Array.isArray(f.shot)) throw 0; settings[key] = f; got.push(`${name} ${f.version || ''}`); }
    catch (e) { bad.push(`${name}: ${e === 404 ? '파일 없음 (저장소 비공개이거나 main 브랜치에 없음)' : e === 0 && r.status === 0 ? '인터넷 연결 확인' : '읽지 못함'}`); }
  }
  saveSettings(); render();
  if (bad.length) dialog(got.length ? '일부만 받았습니다' : '순서를 불러오지 못했습니다', [got.length ? '받음: ' + got.join(', ') : '', ...bad].filter(Boolean).join('\n'), [['닫기', null]]);
  else toast(`순서를 받았습니다: ${got.join(', ')}`);
}

/* ---------- 그록으로 인물 이미지 만들기 ---------- */
const GROK_PREFIX = { kr: '아래 설명대로 이미지 한 장을 만들어 줘.\n\n', en: 'Generate one image exactly as described below.\n\n' };
function grokMake(ctx, ref, kind) {
  const c = charTarget(ctx, ref); if (!c) return;
  if (!Native.has()) return dialog('안드로이드 앱에서만 됩니다', '그록 자동 생성은 휴대폰에 설치한 앱에서 동작합니다.', [['닫기', null]]);
  const info = gInfo();
  if (!info || !info.on) return dialog('자동 입력을 켜 주세요', '접근성 설정 > 설치된 앱 > "숏폼 메이커 · 자동 입력"을 켜야 합니다. 회색으로 막혀 있으면 앱 정보 > ⋮ > "제한된 설정 허용"을 먼저 누르세요.', [['앱 정보', () => window.AndroidBridge.openAppInfo()], ['접근성 설정', () => window.AndroidBridge.openAccessibility(), 'pri']]);
  if (!info.pkg) return dialog('그록 앱을 찾지 못했습니다', '그록 앱이 설치되어 있는지 확인하세요.', [['닫기', null]]);
  if (info.running) return toast('이미 자동 입력이 진행 중입니다');
  if (!window.AndroidBridge.hasMediaPerm()) return dialog('사진 접근을 허용해 주세요', '그록이 저장한 이미지를 이 앱이 가져와 첨부하려면 사진 접근 권한이 필요합니다. "모두 허용"을 골라 주세요.', [['취소', null], ['허용하기', () => window.AndroidBridge.requestMediaPerm(), 'pri']]);
  const m = MODE(), prompt = GROK_PREFIX[m] + (ctx === 'd' ? promptText(draft, `c:${ref}:${kind}`, m) : charPrompt(libProj(c), 0, m, kind));
  dialog(`그록으로 ${KIND_NAME[kind]} 이미지 만들기`, `그록 앱을 열어 프롬프트를 넣고 이미지를 만든 뒤 저장하고 돌아옵니다. 진행 중에는 화면을 만지지 마세요.${grokFlow().verified ? '' : '\n\n아직 그록 화면에 맞춰지지 않은 순서라 중간에 멈출 수 있습니다. 멈추면 위쪽 막대의 "이 화면 기록"을 눌러 보내 주세요.'}`, [['취소', null], ['시작', () => {
    const pend = { ctx, ref: String(ref), kind, since: Date.now(), pid: draft ? draft.id : '' };
    store.set('pendingGrok', pend);
    const r = window.AndroidBridge.startAuto('grok', JSON.stringify({ shots: [{ prompt, images: [] }], doneMsg: '그록 이미지를 저장했습니다. 숏폼 메이커로 돌아갑니다.' }), JSON.stringify(grokFlow()));
    if (r !== 'ok') { store.set('pendingGrok', null); dialog('그록 자동 생성을 시작하지 못했습니다', r, [['닫기', null]]); }
  }, 'pri']]);
}
async function grokCollect(manual) {
  const pend = store.get('pendingGrok', null); if (!pend || !Native.has()) return;
  const info = gInfo(); if (info && info.running) return;
  const url = window.AndroidBridge.latestImageSince(pend.since);
  const c = pend.ctx === 'd' ? (draft && draft.id === pend.pid ? draft.chars[+pend.ref] : null) : charLib.find(x => x.id === pend.ref);
  if (!url) {
    if (!manual) return dialog('그록 이미지를 찾지 못했습니다', `${info && info.status ? info.status + '\n\n' : ''}그록에서 이미지를 저장했다면 "다시 찾기"를 누르세요. 아니면 사진 칸을 눌러 직접 첨부하세요.`, [['그만두기', () => store.set('pendingGrok', null)], ['다시 찾기', () => grokCollect(true), 'pri']]);
    return toast('아직 새 이미지가 없습니다');
  }
  store.set('pendingGrok', null);
  if (!c) return toast('이미지를 받았지만 넣을 인물이 없습니다. 대본을 다시 열어 직접 첨부하세요');
  try {
    const id = await imgPut(await shrinkDataUrl(url, pend.kind === 'full' ? 1400 : 1000));
    c[pend.kind === 'full' ? 'imgFull' : 'imgFace'] = id;
    if (pend.ctx === 'd') dirty = true; else { c.updated = Date.now(); saveCharLib(); }
    render(); toast(`그록 이미지를 ${KIND_NAME[pend.kind]} 사진에 첨부했습니다`);
  } catch (e) { toast('이미지를 저장하지 못했습니다'); }
}
function shrinkDataUrl(url, max) {
  return fetch(url).then(r => r.blob()).then(b => shrinkImage(new File([b], 'grok.jpg', { type: b.type || 'image/jpeg' }), max));
}
const klingDumps = () => { if (!Native.has() || !window.AndroidBridge.readKlingDumps) return []; try { return JSON.parse(window.AndroidBridge.readKlingDumps() || '[]'); } catch (e) { return []; } };
let seenStatus = '', seenDumps = 0;
window.onAppResume = () => {
  if (store.get('pendingGrok', null)) setTimeout(() => grokCollect(false), 600);
  if (store.get('pipeline', null)) setTimeout(pipelineResume, 800);
  const info = kInfo(); if (!info) return;
  if (info.status && info.status !== seenStatus && !info.running) { seenStatus = info.status; toast(info.status.slice(0, 60)); }
  const d = klingDumps().length;
  if (d && d !== seenDumps) {
    seenDumps = d; const nm = window.AndroidBridge.lastDumpName ? window.AndroidBridge.lastDumpName() : '';
    if (nm) dialog(`화면 ${d}개를 기록했습니다`, `내 파일 > 다운로드 > ShortFormMaker > ${nm} 에 자동 저장했습니다. 이 파일을 보내 주시면 자동 입력 순서를 화면에 맞춰 고칠 수 있습니다.`, [['닫기', null], ['바로 보내기', () => window.AndroidBridge.shareLastDump(), 'pri']]);
    else dialog(`화면 ${d}개를 기록했습니다`, '이 파일을 보내 주시면 자동 입력 순서를 화면에 맞춰 고칠 수 있습니다.', [['나중에', null], ['파일로 저장', () => A.dumpOut(), 'pri']]);
  }
  if (cur().v === 'settings') render();
};

/* ---------- 완성 영상 (클립 모으기 → 자막 새기기 → 업로드) ---------- */
/* 내레이션: 내레이터(sp = -2)의 줄만 읽는다. 화면 속 인물의 대사는 클링 영상의 소리를 쓴다 */
const voiceCfg = () => Object.assign({ on: true, rate: 1.05, pitch: 1, engine: 'gemini', name: 'Charon', tone: '' }, settings.voice || {});
/* Gemini AI 목소리 (무료 키로 쓰는 TTS). 응답은 24kHz 16비트 모노 PCM */
const GVOICES = [['Charon', '정보 전달 · 차분한 남성'], ['Kore', '단단한 · 또렷한 여성'], ['Orus', '묵직한 다큐 · 남성'], ['Aoede', '산뜻한 · 여성'], ['Puck', '경쾌한 · 남성'], ['Zephyr', '밝은 · 여성']];
const TONE_DEFAULT = { kr: '차분하고 또렷한 다큐멘터리 내레이션 톤으로, 궁금증을 끌어올리듯 읽어 줘', en: 'Read in a calm, clear documentary narrator tone that builds curiosity' };
const ttsModel = () => settings.ttsModel || 'gemini-2.5-flash-preview-tts';
const voiceMem = {};
async function geminiVoice(text, token) {
  const vc = voiceCfg(), keys = aiKeys(), tone = String(vc.tone || '').trim() || TONE_DEFAULT[isEn() ? 'en' : 'kr'];
  const key = `${ttsModel()}|${vc.name}|${tone}|${text}`; if (voiceMem[key]) return voiceMem[key];
  const body = JSON.stringify({ contents: [{ parts: [{ text: `${tone}:\n${text}` }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: vc.name } } } } });
  let last = '';
  for (let tries = 0; tries < keys.length * 2 + 2; tries++) {
    if (token.cancel) throw new Error('cancel');
    const ki = (settings.aiNext || 0) % keys.length, k = keys[ki];
    const r = await httpReq(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ttsModel())}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k }, body });
    if (r.status === 200) { let d = ''; try { d = JSON.parse(r.text).candidates[0].content.parts.find(x => x.inlineData).inlineData.data; } catch (e) {} if (d) return (voiceMem[key] = d); last = '목소리 응답이 비어 있습니다.'; continue; }
    if (r.status === 404) throw new Error(`음성 모델 "${ttsModel()}"을 찾을 수 없습니다. 설정에서 "키 확인·모델"을 눌러 음성 모델을 다시 찾으세요.`);
    last = aiErr(r, ki);
    if (r.status === 429) { settings.aiNext = (ki + 1) % keys.length; if (keys.length === 1 || tries >= keys.length) await new Promise(res => setTimeout(res, 20000)); continue; }
    if (r.status >= 500 || r.status === 0) { await new Promise(res => setTimeout(res, 3000)); continue; }
    throw new Error(last);
  }
  throw new Error(last || '목소리를 만들지 못했습니다.');
}
const narrOf = (p, i) => { const s = p.shots[i]; return s && s.sp === NARR ? String((isEn() ? s.de : s.dk) || '').trim() : ''; };
let asm = null;            /* 진행 중인 합치기 상태 { state, progress, uri, error } */
const thumbCache = {};
const finOf = p => { p.fin = p.fin || { clips: [], burn: true, lang: '', size: 58, pos: -0.62, out: '' }; p.fin.stills = p.fin.stills || {}; return p.fin; };
/* 샷 구성: 핵심 샷만 클링 영상, 나머지는 그록 장면 이미지(무료) */
const KLING_COST = 30;
const vidDefault = p => { const n = p.shots.length; return n >= 4 ? [n - 3, n - 2] : p.shots.map((x, i) => i); };
const vidShots = p => (Array.isArray(p.vids) ? p.vids : vidDefault(p)).filter(i => i < p.shots.length).sort((a, b) => a - b);
const isVid = (p, i) => vidShots(p).includes(i);
const stillShots = p => p.shots.map((x, i) => i).filter(i => !isVid(p, i));
const stillOf = (p, i) => finOf(p).stills[i] || '';
/* 이어 하기: 샷별 영상(clip.shot), 클링에 생성 요청한 시각(fin.sent) */
const SENT_FRESH = 12 * 3600e3;
const sentOf = (p, i) => { const t = (finOf(p).sent || {})[i]; return t && Date.now() - t < SENT_FRESH ? t : 0; };
const clipOf = (p, i) => finOf(p).clips.find(c => c.shot === i) || null;
function klingPlan(p) {
  const vids = vidShots(p), have = vids.filter(i => clipOf(p, i)), need = vids.filter(i => !clipOf(p, i));
  return { vids, have, need, gen: need.filter(i => !sentOf(p, i)), get: need.filter(i => sentOf(p, i)) };
}
const finLang = p => finOf(p).lang || (isEn() ? 'en' : 'ko');
const vThumb = uri => { if (thumbCache[uri] == null) { try { thumbCache[uri] = window.AndroidBridge.videoThumb(uri) || ''; } catch (e) { thumbCache[uri] = ''; } } return thumbCache[uri]; };
const needPhone = () => { if (Native.has() && window.AndroidBridge.assemble) return false; dialog('휴대폰 앱에서만 됩니다', '영상 모으기, 합치기, 업로드는 휴대폰에 설치한 앱에서 동작합니다.', [['닫기', null]]); return true; };
/* since 뒤로 받은 영상을 idx(샷 번호들)에 순서대로 붙인다. idx 가 없으면 예전처럼 목록 전체 */
function findClips(p, since, idx, auto) {
  let list = []; try { list = JSON.parse(window.AndroidBridge.listVideosSince(since) || '[]'); } catch (e) {}
  const f = finOf(p);
  if (!list.length) { if (!auto) dialog('새 영상을 찾지 못했습니다', '클링에서 영상을 내려받았는지 확인하세요. "직접 고르기"로 골라도 됩니다.', [['닫기', null], ['직접 고르기', () => A.pickClips(), 'pri']]); return 0; }
  if (!Array.isArray(idx)) { f.clips = list.slice(-idx || undefined).map(v => ({ uri: v.uri, name: v.name, dur: v.dur })); dirty = true; render(); return f.clips.length; }
  const take = list.slice(-idx.length);
  take.forEach((v, k) => { const i = idx[k]; f.clips = f.clips.filter(c => c.shot !== i).concat({ uri: v.uri, name: v.name, dur: v.dur, shot: i }); });
  f.clips.sort((a, b) => (a.shot == null ? 99 : a.shot) - (b.shot == null ? 99 : b.shot));
  dirty = true; saveDraft(); render(); return take.length;
}
async function startAssemble(p, auto, skipCheck) {
  if (needPhone()) return;
  const f = finOf(p), lines = subLines(p, finLang(p)) || [], items = [], subs = [], miss = [], voice = [];
  if (!stillShots(p).length) {   /* 모두 영상 샷: 모은 클립을 순서대로 */
    if (!f.clips.length) return toast('먼저 영상 클립을 모으세요');
    f.clips.forEach((c, i) => { items.push({ video: c.uri, ms: p.shots[i] ? (+p.shots[i].sec || 5) * 1000 : 0 }); subs.push(f.burn ? (lines[i] || '') : ''); voice.push(narrOf(p, i)); });
  } else {
    let k = 0;
    for (let i = 0; i < p.shots.length; i++) {
      if (isVid(p, i)) { const c = clipOf(p, i) || f.clips.filter(x => x.shot == null)[k++]; if (!c) { miss.push(i + 1); continue; } items.push({ video: c.uri, ms: (+p.shots[i].sec || 5) * 1000 }); }
      else { const d = await imgGet(stillOf(p, i)); if (!d) { miss.push(i + 1); continue; } items.push({ image: d, ms: (+p.shots[i].sec || 5) * 1000 }); }
      subs.push(f.burn ? (lines[i] || '') : ''); voice.push(narrOf(p, i));
    }
  }
  if (!items.length) return toast('장면 이미지나 영상 클립을 먼저 모으세요');
  if (miss.length && !auto && !skipCheck) return dialog(`샷 ${miss.join(', ')}번이 비어 있습니다`, '빈 샷을 빼고 만들까요? 장면 이미지는 ① 그록으로 만들거나 직접 첨부하고, 영상은 ② 클립에서 모을 수 있습니다.', [['취소', null], ['빼고 만들기', () => startAssemble(p, auto, true), 'pri']]);
  const vc = voiceCfg(), useVoice = vc.on && voice.some(Boolean);
  let voicePcm = null;
  if (useVoice && vc.engine === 'gemini' && aiKeys().length) {
    voicePcm = await new Promise(res => {
      const token = { cancel: false }, n = voice.filter(Boolean).length; let k = 0; layerActs = { c0: () => { token.cancel = true; res(undefined); } };
      layer(`<div class="dialog" role="alertdialog" aria-label="AI 목소리 만드는 중"><span class="spin" aria-hidden="true"></span><h3>AI 목소리 만드는 중</h3><p id="vprog">Gemini · ${esc(vc.name)} · 0/${n}줄</p><div class="acts"><button class="btn" data-lact="c0">취소</button></div></div>`, true);
      (async () => { const out = []; for (const line of voice) { if (!line) { out.push(''); continue; } out.push(await geminiVoice(line, token)); k++; const el = $('#vprog'); if (el) el.textContent = `Gemini · ${vc.name} · ${k}/${n}줄`; } return out; })()
        .then(out => { if (token.cancel) return; closeLayer(); res(out); }, e => { if (token.cancel) return; closeLayer();
          dialog('AI 목소리를 만들지 못했습니다', `${e.message}\n\n휴대폰 음성으로 대신 만들 수 있습니다.`, [['취소', () => res(undefined)], ['휴대폰 음성으로', () => res(null), 'pri']]); });
    });
    if (voicePcm === undefined) return;
  }
  const ok = window.AndroidBridge.assemble(JSON.stringify({ items, subs, burn: f.burn, size: f.size, pos: f.pos, title: T(p), voice: useVoice ? voice : null, voicePcm, voicePcmRate: 24000, voiceLang: isEn() ? 'en-US' : 'ko-KR', voiceRate: vc.rate, voicePitch: vc.pitch }));
  if (!ok) return toast('이미 영상을 만들고 있습니다');
  asm = { state: 'running', progress: 0, auto: !!auto, pid: p.id }; render();
}
/* 그록으로 장면 이미지 만들기 (only: 원클릭이 아니라 이미지만) */
function startGrokStills(p, idx, only) {
  const gi = gInfo();
  if (!gi || !gi.on) return klingNeedSetup(gi), false;
  if (!gi.pkg) return dialog('그록 앱을 찾지 못했습니다', '그록 앱이 설치되어 있는지 확인하세요. 장면 이미지는 직접 첨부해도 됩니다.', [['닫기', null]]), false;
  if (gi.running) return toast('이미 자동 입력이 진행 중입니다'), false;
  const m = MODE(), shots = idx.map(i => ({ prompt: GROK_PREFIX[m] + stillPrompt(p, i, m), images: [] }));
  store.set('pipeline', { pid: p.id, stage: 'grok', since: Date.now(), idx, only: !!only });
  const r = window.AndroidBridge.startAuto('grok', JSON.stringify({ shots, doneMsg: `그록 장면 이미지 ${idx.length}장을 저장했습니다. 숏폼 메이커로 돌아갑니다.` }), JSON.stringify(grokFlow()));
  if (r !== 'ok') { store.set('pipeline', null); dialog('그록을 시작하지 못했습니다', r, [['닫기', null]]); return false; }
  return true;
}
function startKlingStage(p) {
  const pl = klingPlan(p);
  if (!pl.need.length) { store.set('pipeline', null); return startAssemble(p, true); }
  return buildKlingJob(p, pl.need, new Set(pl.get)).then(({ job }) => {
    job.id = uid(); job.autoGenerate = true; job.collect = true; if (!pl.gen.length) job.collectOnly = true;
    store.set('pipeline', { pid: p.id, stage: 'kling', since: Date.now(), idx: pl.need, n: pl.need.length, jobId: job.id });
    const r = window.AndroidBridge.startKling(JSON.stringify(job), JSON.stringify(flowNow()));
    if (r !== 'ok') { store.set('pipeline', null); dialog('클링을 시작하지 못했습니다', r, [['닫기', null]]); }
  });
}
async function collectStills(pl) {
  let list = []; try { list = JSON.parse(window.AndroidBridge.imagesSince(pl.since, 30) || '[]'); } catch (e) {}
  const take = list.slice(-pl.idx.length), f = finOf(draft);
  for (let k = 0; k < take.length; k++) { try { f.stills[pl.idx[k]] = await imgPut(await shrinkDataUrl(take[k], 1400)); } catch (e) {} }
  if (take.length) { dirty = true; saveDraft(); }
  return take.length;
}
window.onAssemble = o => {
  asm = Object.assign(asm || {}, o);
  const bar = $('#asmBar'), txt = $('#asmTxt');
  if (o.state === 'running' && bar) { bar.style.width = (o.progress || 0) + '%'; if (txt) txt.textContent = `영상 만드는 중… ${o.progress || 0}%`; return; }
  if (o.state === 'done') {
    const p = draft && draft.id === asm.pid ? draft : null;
    if (p) { finOf(p).out = o.uri; saveDraft(); }
    const auto = asm.auto; asm = null; render();
    if (auto && p) { if (settings.upWay === 'pickle') pickleUpload(p, true); else uploadOut(p); } else toast('완성 영상을 동영상 앱의 ShortFormMaker 폴더에 저장했습니다');
    store.set('pipeline', null);
  } else if (o.state === 'error') { asm = null; render(); dialog('영상을 만들지 못했습니다', o.error || '', [['닫기', null]]); store.set('pipeline', null); }
  else if (o.state === 'cancelled') { asm = null; render(); toast('영상 만들기를 멈췄습니다'); }
};
function uploadOut(p) {
  const f = finOf(p); if (!f.out) return toast('먼저 완성 영상을 만드세요');
  const k = uploadKit(p, MODE());
  window.AndroidBridge.shareVideo(f.out, k.title, `${k.title}\n\n${k.desc}`);
  toast('제목·설명 복사됨 · AI 생성 표시를 켜세요');
}
/* ---------- 피클(텍스트로 지시하는 AI 에이전트 앱)에게 업로드 맡기기 ---------- */
const PLATS = [['yt', '유튜브 쇼츠'], ['tt', '틱톡'], ['ig', '인스타그램 릴스']];
const upPlats = () => { const v = (settings.upPlats || ['yt']).filter(x => PLATS.some(([id]) => id === x)); return v.length ? v : ['yt']; };
function pickleText(p) {
  const k = uploadKit(p, MODE()), names = upPlats().map(x => PLATS.find(([id]) => id === x)[1]);
  return [`방금 보낸 세로 영상(동영상 앱 > Movies/ShortFormMaker 폴더의 가장 최근 "${T(p)}_assembled" 파일)을 ${names.join(', ')}에 올려 줘.`,
    '', `제목: ${k.title}`, '', '설명:', k.desc, '', `고정 댓글: ${k.pin}`, '',
    '지켜 줄 것:', '1. "AI 생성 콘텐츠(변경되거나 합성된 콘텐츠)" 표시를 꼭 켜 줘.', '2. 공개 범위는 "공개", 아동용 아님으로 해 줘.', '3. 올린 뒤 고정 댓글을 달아 줘.', '4. 끝나면 올라간 영상 링크를 알려 줘.'].join('\n');
}
function pickleUpload(p, auto) {
  if (needPhone()) return;
  const f = finOf(p); if (!f.out) return toast('먼저 완성 영상을 만드세요');
  const text = pickleText(p), via = window.AndroidBridge.shareToApp ? window.AndroidBridge.shareToApp('pickle', f.out, text) : 'noshare';
  if (via === 'ok') return toast('피클에 영상과 지시문을 보냈습니다 · 피클에서 보내기를 누르세요 (지시문은 복사도 됨)');
  if (via === 'noapp') return dialog('피클 앱을 찾지 못했습니다', '피클 앱이 설치되어 있는지 확인하세요. 지금은 업로드할 앱을 직접 고르는 창을 엽니다.', [['닫기', null], ['앱 고르기', () => uploadOut(p), 'pri']]);
  const info = pInfo();
  if (!info || !info.on) { Native.share('업로드 지시문', text); return toast('피클이 영상 공유를 받지 않습니다 · 지시문을 보내니 피클을 고르세요 (자동 입력을 켜면 바로 입력)'); }
  if (info.running) return toast('이미 자동 입력이 진행 중입니다');
  const r = window.AndroidBridge.startAuto('pickle', JSON.stringify({ shots: [{ prompt: text, images: [] }], doneMsg: '피클에 업로드 지시를 보냈습니다.' }), JSON.stringify(pickleFlow()));
  if (r !== 'ok') dialog('피클에 보내지 못했습니다', r, [['닫기', null]]);
  else if (!auto) toast('피클 채팅에 지시문을 입력합니다');
}
/* 원클릭: 그록 장면 이미지 → 클링 핵심 샷 → 영상 내려받기 → 돌아오면 합치기 → 업로드 */
function oneClick() {
  if (needPhone()) return;
  const p = draft, info = kInfo(); if (klingNeedSetup(info)) return;
  if (!window.AndroidBridge.hasMediaPerm()) return dialog('사진·동영상 접근을 허용해 주세요', '그록 이미지와 클링 영상을 찾으려면 접근 권한이 필요합니다. "모두 허용"을 골라 주세요.', [['취소', null], ['허용하기', () => window.AndroidBridge.requestMediaPerm(), 'pri']]);
  const need = stillShots(p).filter(i => !stillOf(p, i)), vids = vidShots(p);
  buildKlingJob(p, 'vid').then(({ miss }) => {
    const kp = klingPlan(p), doneSt = stillShots(p).length - need.length;
    const steps = [need.length ? `그록으로 장면 이미지 ${need.length}장 만들기 (무료)${doneSt ? ` · ${doneSt}장은 이미 있어 건너뜀` : ''}` : '',
      kp.gen.length ? `클링으로 ${kp.gen.map(i => i + 1).join(', ')}번 샷 영상 만들기 · 약 ${kp.gen.length * KLING_COST}크레딧` : '',
      kp.get.length ? `${kp.get.map(i => i + 1).join(', ')}번 샷은 이미 생성 요청함 → 다시 만들지 않고 내려받기만` : '',
      kp.have.length ? `${kp.have.map(i => i + 1).join(', ')}번 샷 영상은 이미 있어 건너뜀` : '',
      kp.need.length ? '생성이 끝나면 영상 내려받기 (몇 분 걸립니다)' : '', '이 앱으로 돌아와 이미지·영상을 잇고 내레이션·자막 넣기', settings.upWay === 'pickle' ? '피클에게 영상과 업로드 지시 보내기' : '업로드할 앱을 고르는 창 열기'].filter(Boolean);
    const resumed = doneSt || kp.have.length || kp.get.length;
    const go1 = () => dialog(resumed ? '이어서 제작합니다' : '원클릭 제작을 시작합니다', `${steps.map((t, n) => `${'①②③④⑤⑥⑦⑧'[n]} ${t}`).join('\n')}\n\n진행 중에는 화면을 만지지 마세요. 클링은 "비디오 생성·01, 720p · 5s"로 맞춰 두세요.`,
      [['취소', null], ['시작', () => { saveDraft(); if (need.length) startGrokStills(p, need, false); else startKlingStage(p); }, 'pri']]);
    if (miss.length) dialog('사진이 없는 등장인물이 있습니다', `${miss.join(', ')}의 사진이 없습니다. 등장인물 탭에서 그록으로 만들거나 첨부하면 생김새가 일정하게 나옵니다.`, [['취소', null], ['사진 없이 진행', go1, 'pri']]);
    else go1();
  });
}
async function pipelineResume() {
  const pl = store.get('pipeline', null); if (!pl || !Native.has()) return;
  const info = kInfo(), gi = gInfo(); if ((info && info.running) || (gi && gi.running)) return;
  if (!draft || draft.id !== pl.pid) { const pr = projects.find(x => x.id === pl.pid); if (!pr) return store.set('pipeline', null); draft = JSON.parse(JSON.stringify(pr)); dirty = false; stack = [{ v: 'home', p: {} }, { v: 'editor', p: { tab: 'finish' } }]; }
  else if (cur().v !== 'editor') stack = [{ v: 'home', p: {} }, { v: 'editor', p: { tab: 'finish' } }];
  else cur().p.tab = 'finish';
  if (pl.stage === 'grok') {
    const got = await collectStills(pl), n = pl.idx.length;
    const next = () => { if (pl.only) { store.set('pipeline', null); render(); } else startKlingStage(draft); };
    if (got >= n) { toast(`그록 장면 이미지 ${got}장을 넣었습니다`); return next(); }
    render();
    return dialog(`장면 이미지 ${got}/${n}장을 받았습니다`, '그록에서 일부를 만들지 못했거나 저장하지 못했습니다. 빈 칸은 직접 첨부해도 됩니다.', [['그만두기', () => store.set('pipeline', null)], ['다시 만들기', () => startGrokStills(draft, stillShots(draft).filter(i => !stillOf(draft, i)), pl.only)], [pl.only ? '닫기' : '빈 칸 두고 계속', () => { if (pl.only) store.set('pipeline', null); else startKlingStage(draft); }, 'pri']]);
  }
  if (info && pl.jobId && info.jobId === pl.jobId && Array.isArray(info.done) && pl.idx) {
    const f = finOf(draft); f.sent = f.sent || {};
    info.done.forEach(d => { if (pl.idx[d] != null) f.sent[pl.idx[d]] = Date.now(); }); dirty = true; saveDraft();
  }
  const got = findClips(draft, pl.since, pl.idx || pl.n, true);
  if (got >= pl.n) return startAssemble(draft, true);
  render();
  dialog(`영상 ${got}/${pl.n}개를 찾았습니다`, '아직 생성 중이거나 내려받기가 멈췄을 수 있습니다.', [['그만두기', () => store.set('pipeline', null)], ['다시 찾기', pipelineResume], [got ? '찾은 것으로 계속' : '직접 고르기', () => { if (got) { store.set('pipeline', null); startAssemble(draft, true); } else A.pickClips(); }, 'pri']]);
}
window.onVideosPicked = uris => {
  if (!draft || !uris || !uris.length) return;
  const f = finOf(draft), open = stillShots(draft).length ? vidShots(draft).filter(i => !clipOf(draft, i)) : [];
  f.clips = f.clips.concat(uris.map((u, k) => ({ uri: u, name: decodeURIComponent(u.split('/').pop()), dur: 0, ...(open[k] != null ? { shot: open[k] } : {}) })));
  f.clips.sort((a, b) => (a.shot == null ? 99 : a.shot) - (b.shot == null ? 99 : b.shot)); dirty = true; render();
};
function tabFinish(p) {
  const f = finOf(p), lang = finLang(p), lines = subLines(p, lang), on = Native.has() && window.AndroidBridge.assemble, running = asm && asm.state === 'running';
  const stills = stillShots(p), needClips = stills.length ? vidShots(p).length : p.shots.length, num = n => '①②③④⑤'[stills.length ? n : n - 1];
  const clipRow = (c, i) => `<div class="row clip"><span class="cthumb">${on && vThumb(c.uri) ? `<img src="${vThumb(c.uri)}" alt="">` : ic('film')}</span><span class="grow"><b>${c.shot != null ? `${c.shot + 1}번 샷 · ${beatOf(p, c.shot)[0]}` : stills.length ? '샷 미지정 클립' : `샷 ${i + 1}${p.shots[i] ? ' · ' + beatOf(p, i)[0] : ''}`}</b><small>${esc(c.name || '')}${c.dur ? ` · ${Math.round(c.dur / 100) / 10}초` : ''}</small></span>
    <button class="ib sm" data-act="clipMove" data-i="${i}" data-d="-1" aria-label="위로">${ic('back')}</button><button class="ib sm" data-act="clipDel" data-i="${i}" aria-label="빼기">${ic('x')}</button></div>`;
  return `
    <div class="card aicard kling"><div class="aih"><span class="glyph" style="--h:350">${ic('bolt')}</span><span class="grow"><b>원클릭 제작</b><small>그록 장면 이미지 → 클링 핵심 ${vidShots(p).length}샷(약 ${vidShots(p).length * KLING_COST}크레딧) → 내레이션·자막 넣어 합치기 → ${settings.upWay === 'pickle' ? '피클에게 업로드 맡기기' : '업로드 창'}까지</small></span>${flowNow().verified ? '' : '<span class="tag warn">시험 중</span>'}</div>
      <button class="btn pri block" data-act="oneClick" ${running ? 'disabled' : ''}>${ic('bolt')}원클릭 제작 시작</button>
      <p class="hint">중간에 멈추면 아래 ①~⑤를 하나씩 눌러 이어 할 수 있습니다. 등장인물 사진을 먼저 넣어 두면 생김새가 일정하게 나옵니다. 어느 샷을 영상으로 할지는 영상 탭의 "샷 구성"에서 바꿉니다.</p></div>
    ${stills.length ? `<div class="sec">${h2('camera', `① 장면 이미지 ${stills.filter(i => stillOf(p, i)).length}/${stills.length} (그록 · 무료)`)}
      <div class="slots still">${stills.map(i => { const id = stillOf(p, i); return `<div class="slot full">${id
        ? `<button class="sthumb" data-act="viewImg" data-id="${id}" data-n="${i + 1}번_장면" aria-label="${i + 1}번 샷 장면 이미지 크게 보기"><img data-img="${id}" alt=""></button><div class="sacts"><button class="ib sm" data-act="stillRegen" data-i="${i}" aria-label="그록으로 다시 만들기">${ic('sparkle')}</button><button class="ib sm" data-act="stillPick" data-i="${i}" aria-label="직접 바꾸기">${ic('refresh')}</button><button class="ib sm" data-act="stillRm" data-i="${i}" aria-label="빼기">${ic('trash')}</button></div>`
        : `<button class="sadd" data-act="stillPick" data-i="${i}">${ic('plus')}<b>${i + 1}번 샷</b><small>${esc(beatOf(p, i)[0])}</small></button>`}<span class="slab">${i + 1}번</span></div>`; }).join('')}</div>
      <button class="btn sm grok" data-act="grokStills">${ic('sparkle')}그록으로 ${stills.some(i => !stillOf(p, i)) ? '빈 칸' : '모두 다시'} 만들기</button>
      <div class="chips">${stills.map(i => `<button class="chip" data-act="stillPrompt" data-i="${i}">${ic('share')}${i + 1}번 프롬프트</button>`).join('')}</div>
      <p class="hint">움직이지 않는 샷은 그록 장면 이미지에 천천히 확대되는 효과와 자막을 넣어 영상 사이에 이어 붙입니다. 칸을 눌러 직접 첨부해도 됩니다. 장면이 이상하게 나오면 그 칸의 ✦ 버튼으로 그 장면만 다시 만드세요.</p></div>` : ''}
    <div class="sec">${h2('film', `${stills.length ? '②' : '①'} 클링 영상 클립 ${f.clips.length}/${needClips}${stills.length ? ` (${vidShots(p).map(i => i + 1).join(', ')}번 샷)` : ''}`)}
      ${stills.length ? `<div class="chips">${vidShots(p).map(i => `<span class="chip ${clipOf(p, i) ? 'on' : ''}">${i + 1}번 · ${clipOf(p, i) ? '영상 있음' : sentOf(p, i) ? '생성 요청함 (내려받기만 남음)' : '아직'}</span>`).join('')}</div>
      ${vidShots(p).some(i => sentOf(p, i) && !clipOf(p, i)) ? `<p class="hint">이미 클링에 생성 요청한 샷은 원클릭을 다시 눌러도 새로 만들지 않고 내려받기만 합니다. 다시 생성하려면 <button class="pbtn" data-act="sentReset">${ic('refresh')}생성 기록 지우기</button></p>` : ''}` : ''}
      <div class="aiacts">${stills.length && klingPlan(p).need.length ? `<button class="btn sm" data-act="klingFetchOnly">${ic('download')}클링에서 내려받기만</button>` : ''}<button class="btn sm blue" data-act="findClips">${ic('search')}방금 받은 영상 찾기</button><button class="btn sm" data-act="pickClips">${ic('folder')}직접 고르기</button></div>
      ${f.clips.length ? `<div class="list">${f.clips.map(clipRow).join('')}</div>` : '<p class="hint">클링에서 내려받은 영상을 찾거나 직접 골라 샷 순서대로 놓으세요. "방금 받은 영상 찾기"는 최근 30분 안에 저장된 영상을 오래된 것부터 가져옵니다.</p>'}</div>
    <div class="sec">${h2('mic', '내레이션 음성')}
      ${(() => { const vc = voiceCfg(), n = p.shots.filter((x, i) => narrOf(p, i)).length, g = vc.engine === 'gemini'; return `${seg('p_von', [[1, '음성 넣기'], [0, '음성 없이']], vc.on ? 1 : 0)}
      ${vc.on ? `<span class="lab">목소리</span>${seg('p_veng', [['gemini', 'Gemini AI 목소리'], ['device', '휴대폰 음성']], vc.engine)}
      ${g ? `<div class="chips wrap">${GVOICES.map(([id, d]) => `<button class="chip ${vc.name === id ? 'on' : ''}" data-act="vname" data-v="${id}">${id}<small class="cs">${d}</small></button>`).join('')}</div>
        <div class="field"><label>${ic('edit')}읽는 말투</label><input class="in" data-vtone="1" value="${esc(vc.tone || '')}" placeholder="${esc(TONE_DEFAULT[isEn() ? 'en' : 'kr'])}" aria-label="읽는 말투"></div>`
        : `<span class="lab">읽는 속도</span>${seg('p_vrate', [['0.95', '천천히'], ['1.05', '보통'], ['1.2', '빠르게']], String(vc.rate))}`}` : ''}
      <p class="hint">${!vc.on ? '소리 없이 자막만 넣습니다.' : g ? `내레이션 ${n}줄을 설정의 Gemini 키로 한 줄씩 읽어 샷마다 맞춰 넣습니다. 무료 키는 수익 채널에도 쓸 수 있지만, 입력한 문장이 Google 서비스 개선에 쓰일 수 있습니다. 한도에 걸리면 잠시 기다렸다 이어서 만듭니다.` : `내레이션 ${n}줄을 휴대폰 음성 엔진으로 읽어 넣습니다. 돈이 들지 않지만 기계음에 가깝습니다.`}${vc.on ? ' 화면 속 등장인물의 대사는 클링 영상의 소리를 그대로 씁니다.' : ''}${vc.on && !n ? ' 지금 대본에 내레이션 줄이 없습니다. 대본 탭에서 말하는 쪽을 "내레이션"으로 고르세요.' : ''}</p>
      ${vc.on && (g ? aiKeys().length : Native.has() && window.AndroidBridge.ttsTest) ? `<button class="btn sm" data-act="ttsTest">${ic('play')}목소리 미리 듣기</button>` : ''}`; })()}</div>
    <div class="sec">${h2('caption', `${num(2)} 자막`)}
      ${seg('p_burn', [[1, '자막 넣기'], [0, '자막 없이']], f.burn ? 1 : 0)}
      ${f.burn ? `<div class="chips">${SUB_LANGS.filter(([id]) => subLines(p, id)).map(([id, n]) => `<button class="chip ${lang === id ? 'on' : ''}" data-act="finSet" data-k="lang" data-v="${id}">${n}</button>`).join('')}</div>
      ${seg('p_fsize', [[48, '작게'], [58, '보통'], [70, '크게']], f.size)}${seg('p_fpos', [['-0.62', '아래'], ['-0.3', '조금 위'], ['0', '가운데']], String(f.pos))}
      <p class="hint">${lines ? `여기서 고른 대로, 아래 "완성 영상 만들기"를 누를 때 샷마다 말 한 줄이 영상에 새겨집니다 (따로 누를 것 없음). 예: "${esc((lines.find(Boolean) || '').slice(0, 30))}"` : '이 언어 자막이 없습니다. 자막·문구 탭에서 만드세요.'}</p>` : ''}</div>
    <div class="sec">${h2('bolt', `${num(3)} 완성 영상`)}
      ${running ? `<div class="card asm"><span id="asmTxt">영상 만드는 중… ${asm.progress || 0}%</span><div class="pbar"><i id="asmBar" style="width:${asm.progress || 0}%"></i></div><button class="btn sm" data-act="asmCancel">${ic('x')}멈추기</button></div>`
        : `<button class="btn blue block" data-act="assemble">${ic('film')}${f.out ? '다시 만들기' : `완성 영상 만들기${f.burn ? ' (자막 넣어 합치기)' : ''}`}</button>`}
      ${f.out && !running ? `<div class="card done"><b>${ic('checkc')}완성 영상이 있습니다</b><small>동영상 앱 > ShortFormMaker 폴더</small><div class="aiacts"><button class="btn sm" data-act="openOut">${ic('play')}열어 보기</button></div></div>` : ''}</div>
    <div class="sec">${h2('share', `${num(4)} 업로드`)}
      <div class="seg">${[['share', '앱 직접 고르기'], ['pickle', '피클에게 맡기기']].map(([id, n]) => `<button class="${(settings.upWay || 'share') === id ? 'on' : ''}" data-act="upWay" data-v="${id}">${n}</button>`).join('')}</div>
      ${settings.upWay === 'pickle' ? `<div class="chips">${PLATS.map(([id, n]) => `<button class="chip ${upPlats().includes(id) ? 'on' : ''}" data-act="upPlat" data-v="${id}">${n}</button>`).join('')}</div>
      <button class="btn pri block" data-act="pickleUp" ${f.out ? '' : 'disabled'}>${ic('bolt')}피클에게 업로드 맡기기</button>
      <button class="btn sm" data-act="pickleCopy">${ic('copy')}지시문만 복사</button>
      <p class="hint">완성 영상과 업로드 지시문(제목·설명·해시태그·고정 댓글·AI 생성 표시·링크 보고)을 피클 앱으로 보냅니다. 피클이 공유를 받지 않으면 자동 입력으로 피클 채팅에 지시문을 넣고 보냅니다. 원클릭 제작도 끝에 이 방식으로 넘깁니다.</p>`
      : `<button class="btn pri block" data-act="uploadOut" ${f.out ? '' : 'disabled'}>${ic('share')}유튜브·틱톡·인스타로 보내기</button>
      <p class="hint">업로드할 앱을 고르면 완성 영상이 그 앱의 업로드 화면으로 넘어가고, 제목·설명·해시태그가 복사됩니다. 붙여넣은 뒤 "AI 생성 콘텐츠" 표시를 켜고 직접 올리세요. 하루 1~2편으로 시작하세요.</p>`}</div>`;
}

/* ---------- 공통 조각 ---------- */
let artN = 0;
function art(icon, h = 218) {
  const n = ++artN, bars = [[14, 58, 24], [25, 46, 44], [36, 38, 60], [47, 50, 36], [58, 42, 52]];
  return `<svg class="art" viewBox="0 0 170 130" aria-hidden="true"><defs>
  <linearGradient id="ag${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 95% 72%)"/><stop offset="1" stop-color="hsl(${h + 14} 88% 50%)"/></linearGradient>
  <radialGradient id="ab${n}"><stop offset="0" stop-color="hsl(${h} 95% 80%)" stop-opacity=".75"/><stop offset="1" stop-color="hsl(${h} 95% 80%)" stop-opacity="0"/></radialGradient></defs>
  <circle cx="108" cy="62" r="64" fill="url(#ab${n})"/>
  <g fill="hsl(${h} 90% 70%)" opacity=".5">${bars.map(([x, y, hh]) => `<rect x="${x}" y="${y}" width="7" height="${hh}" rx="3.5"/>`).join('')}</g>
  <ellipse cx="114" cy="118" rx="44" ry="8" fill="hsl(${h} 60% 50%)" opacity=".16"/>
  <rect x="74" y="20" width="80" height="80" rx="27" fill="url(#ag${n})"/>
  <rect x="81" y="25" width="66" height="30" rx="16" fill="#fff" opacity=".24"/>
  <g transform="translate(90 36) scale(2)" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[icon]}</g>
  <path d="M155 12l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFC53D"/>
  <path d="M68 14l1.7 3.8 3.8 1.7-3.8 1.7L68 25l-1.7-3.8-3.8-1.7 3.8-1.7z" fill="#FFC53D" opacity=".85"/></svg>`;
}
const glyph = (t, big) => `<span class="glyph${big ? ' big' : ''}" style="--h:${t.hue}">${ic(t.icon)}</span>`;
const chev = `<span class="chev">${ic('chevron')}</span>`;
const h2 = (icon, text, right = '') => `<h2 class="h2"><span class="hi">${ic(icon)}</span>${text}<span class="sp"></span>${right}</h2>`;
const seg = (name, opts, val) => `<div class="seg" role="group">${opts.map(([v, l, i]) => `<button data-act="set" data-k="${name}" data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${i ? ic(i) : ''}${l}</button>`).join('')}</div>`;
const pageHead = o => `<div class="phead"><div class="ph-t">${o.eyebrow ? `<span class="eyebrow">${ic(o.eicon || 'sparkle')}${o.eyebrow}</span>` : ''}${o.title ? `<h2>${o.title}</h2>` : ''}${o.lead ? `<p>${o.lead}</p>` : ''}</div>${art(o.icon, o.hue)}</div>`;
const modeSeg = () => `<div class="mode" role="group" aria-label="제작 대상">${[['kr', '국내용'], ['en', '해외용']].map(([v, l]) => `<button data-act="mode" data-v="${v}" class="${MODE() === v ? 'on' : ''}">${v === 'en' ? ic('globe') : ''}${l}</button>`).join('')}</div>`;
const projRow = (p, extra) => { const t = fmOf(p); return `<div class="row" role="button" tabindex="0" data-act="open" data-id="${p.id}">${extra || (p.src && p.src.thumb ? `<span class="pthumb">${thumb(p.src.thumb, t.icon, t.hue)}</span>` : glyph(t))}<span class="grow"><b>${esc(T(p))}</b><small>${t.name} · ${p.shots.length}샷 · ${totalSec(p)}초 · ${dateStr(p.updated)}</small></span>${extra ? '' : `<button class="ib sm star ${p.fav ? 'on' : ''}" data-act="fav" data-id="${p.id}" aria-label="즐겨찾기">${ic('star')}</button><button class="ib sm" data-act="rowMenu" data-id="${p.id}" aria-label="더보기">${ic('more')}</button>`}</div>`; };
function openProject(id) { const p = projects.find(x => x.id === id); if (!p) return; draft = JSON.parse(JSON.stringify(p)); dirty = false; go('editor'); }
function saveDraft() {
  draft.updated = Date.now(); const c = JSON.parse(JSON.stringify(draft)); delete c._undo;
  const i = projects.findIndex(x => x.id === c.id); if (i >= 0) projects[i] = c; else projects.unshift(c);
  saveProjects(); dirty = false; toast('보관함에 저장했습니다');
}
const BAN_RE = /피를|칼로|총을|살인|blood|knife|\bgun\b|kill|murder|naked/i;
function scoreOf(p) {
  const m = MODE(), k = sfx(m), spoken = p.shots.filter(s => s.sp !== -1 && s['d' + k]).length, tot = totalSec(p);
  const lineOk = s => m === 'kr' ? (s.dk || '').length <= 30 : words(s.de) <= 15, actOk = s => m === 'kr' ? (s.ak || '').length <= 60 : words(s.ae) <= 26;
  const same = p.src && p.src.title && [p.tk, p.te].some(x => String(x || '').trim() === String(p.src.title).trim());
  const items = [
    [!!(p.shots[0] && (p.shots[0]['a' + k] || '').length >= 8 && (p.shots[0]['d' + k] || '').length >= 4), '1샷이 질문이나 놀라운 사실로 시작한다 (훅)', '첫 샷에 가장 신기한 장면과 첫 문장을 넣으세요.'],
    [spoken >= p.shots.length - 1, '거의 모든 샷에 내레이션이 있다', '정보형 영상은 말이 끊기면 바로 넘깁니다.'],
    [p.shots.every(lineOk), '모든 말이 5초 안에 끝난다', m === 'kr' ? '한 줄은 28자 이내로 줄이세요.' : '한 줄은 14단어 이내로 줄이세요.'],
    [p.shots.every(actOk), '샷마다 동작이 하나다', '화면 묘사가 길면 5초 영상에 담기지 않습니다.'],
    [p.shots.every(s => s['p' + k] && s['a' + k]), '모든 샷에 장소와 화면 묘사가 있다', '비어 있는 샷을 채우세요.'],
    [p.chars.every(c => (c['d' + k] || '').length >= (m === 'kr' ? 10 : 20)), p.chars.length ? '등장인물 생김새 설명이 충분하다' : '등장인물 없이 만드는 영상이다', '사람은 나이대·머리·옷, 동물은 종·털색·크기를 적으세요.'],
    [p.shots.every(s => s.sp < 0 || p.chars[s.sp]), '말하는 등장인물이 모두 등장인물 탭에 있다', '삭제한 인물의 대사가 남아 있습니다.'],
    [p.shots.length >= 4 && p.shots.length <= 8, '샷이 4~8개다', '한 편은 6샷(30초)이 가장 안정적입니다.'],
    [tot >= 15 && tot <= 60, '전체 길이가 15~60초다', `지금 ${tot}초입니다.`],
    [!same, '원본과 제목이 다르다', '원본 제목을 그대로 쓰면 안 됩니다. 제목을 고치세요.'],
    [!(p.facts || []).length || (p.facts || []).every(x => x.ok), '핵심 사실을 모두 확인했다', '대본 탭의 사실 확인에서 하나씩 검색해 체크하세요.'],
    [!BAN_RE.test(p.shots.map(s => s.ak + s.ae + s.dk + s.de).join(' ')), '생성이 거부될 표현이 없다', '폭력·흉기·노출 표현을 순화하세요.']
  ].map(([ok, label, tip]) => ({ ok, label, tip }));
  return { items, score: Math.round(items.filter(i => i.ok).length / items.length * 100) };
}
const scoreList = sc => sc.items.map(i => `<li><span class="m ${i.ok ? '' : 'x'}">${ic(i.ok ? 'check' : 'x')}</span><span>${i.label}${i.ok ? '' : `<small>${i.tip}</small>`}</span></li>`).join('');
const KIND_NAME = { full: '전신', face: '얼굴' };
function imgSlot(ctx, ref, c, kind) {
  const id = c[kind === 'full' ? 'imgFull' : 'imgFace'], nm = esc(cname(c));
  return `<div class="slot ${kind}">${id
    ? `<button class="sthumb" data-act="viewImg" data-id="${id}" data-n="${nm}_${KIND_NAME[kind]}" aria-label="${nm} ${KIND_NAME[kind]} 사진 크게 보기"><img data-img="${id}" alt=""></button><div class="sacts"><button class="ib sm" data-act="attachImg" data-ctx="${ctx}" data-ref="${ref}" data-kind="${kind}" aria-label="사진 바꾸기">${ic('refresh')}</button><button class="ib sm" data-act="rmImg" data-ctx="${ctx}" data-ref="${ref}" data-kind="${kind}" aria-label="사진 빼기">${ic('trash')}</button></div>`
    : `<button class="sadd" data-act="attachImg" data-ctx="${ctx}" data-ref="${ref}" data-kind="${kind}">${ic('plus')}<b>${KIND_NAME[kind]} 사진</b><small>AI로 만든 이미지 첨부</small></button>`}<span class="slab">${KIND_NAME[kind]}</span></div>`;
}
const libProj = c => ({ style: settings.style, chars: [c], shots: [], over: {} });
const charFields = c => ({ r: c.r, k: ckind(c), nk: c.nk, ne: c.ne, dk: c.dk, de: c.de, imgFull: c.imgFull || '', imgFace: c.imgFace || '' });
const charTarget = (ctx, ref) => ctx === 'd' ? draft && draft.chars[+ref] : charLib.find(c => c.id === ref);
function swapName(p, from, to) {
  if (!from || !to || from === to) return;
  p.shots.forEach(s => ['ak', 'ae', 'dk', 'de', 'pk', 'pe'].forEach(f => { if (s[f]) s[f] = s[f].split(from).join(to); }));
  ['lk', 'le'].forEach(f => { if (p[f]) p[f] = p[f].split(from).join(to); });
}
function putLibChar(i, lc) {
  const p = draft, nc = Object.assign(charFields(lc), { libId: lc.id });
  if (i >= p.chars.length) { p.chars.push(nc); }
  else { const old = p.chars[i]; nc.r = old.r; swapName(p, old.nk, nc.nk); swapName(p, old.ne, nc.ne); p.chars[i] = nc; }
  p.over = {}; dirty = true; render(); toast(`${cname(nc)}${josa(cname(nc), '을')} 넣었습니다`);
}
const charCard = c => `<div class="card lchar" role="button" tabindex="0" data-act="go" data-v="char" data-id="${c.id}">
  <span class="lthumb">${c.imgFull || c.imgFace ? `<img data-img="${c.imgFull || c.imgFace}" alt="">` : ic(KINDS[ckind(c)][1])}</span>
  <b>${esc(cname(c))}</b><span class="tag k${ckind(c)}">${ic(KINDS[ckind(c)][1])}${KINDS[ckind(c)][0]}</span><small>${esc(clook(c) || c.dk || c.de)}</small></div>`;
function viewChar(p) {
  const c = charLib.find(x => x.id === p.id);
  if (!c) return { title: '내 캐릭터', back: true, html: '<div class="card empty"><b>캐릭터를 찾을 수 없습니다</b>삭제되었을 수 있습니다.</div>' };
  const f = (k, l, ph, ta) => `<div class="field"><label>${l}</label>${ta ? `<textarea class="in ag" rows="2" data-lc="${c.id}:${k}" placeholder="${ph}">${esc(c[k])}</textarea>` : `<input class="in" data-lc="${c.id}:${k}" value="${esc(c[k])}" placeholder="${ph}">`}</div>`;
  return { title: cname(c) || '내 캐릭터', back: true, acts: `${modeSeg()}<button class="ib" data-act="delLibChar" data-id="${c.id}" aria-label="캐릭터 삭제">${ic('trash')}</button>`, html: `
    <div class="slots big">${imgSlot('l', c.id, c, 'full')}${imgSlot('l', c.id, c, 'face')}</div>
    <div class="aiacts"><button class="btn sm grok" data-act="grokMake" data-ctx="l" data-ref="${c.id}" data-kind="full">${ic('sparkle')}그록으로 전신 생성</button><button class="btn sm grok" data-act="grokMake" data-ctx="l" data-ref="${c.id}" data-kind="face">${ic('sparkle')}그록으로 얼굴 생성</button></div>
    <div class="card ccard">
      <div class="csel"><select class="sel" data-lc="${c.id}:k" aria-label="종류">${Object.entries(KINDS).map(([r, n]) => `<option value="${r}" ${ckind(c) === r ? 'selected' : ''}>${n[0]}</option>`).join('')}</select><select class="sel" data-lc="${c.id}:r" aria-label="역할">${Object.entries(ROLE_NAME).map(([r, n]) => `<option value="${r}" ${c.r === r ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      ${f('nk', '이름 (국내용)', '예: 서윤')}${f('ne', '이름 (해외용)', 'e.g. Grace')}
      ${f('dk', '생김새 (국내용 프롬프트)', '예: 작은 흰색 말티즈, 동그란 검은 눈, 빨간 목줄', 1)}${f('de', '생김새 (해외용 프롬프트, 영어)', 'e.g. small white Maltese, round black eyes, red collar', 1)}
      <div class="aiacts"><button class="btn sm blue" data-act="shareLibPrompt" data-id="${c.id}" data-kind="full">${ic('share')}전신 프롬프트</button><button class="btn sm" data-act="shareLibPrompt" data-id="${c.id}" data-kind="face">${ic('share')}얼굴 프롬프트</button></div>
      <p class="hint">지금 모드(${isEn() ? '해외용' : '국내용'})의 이름과 생김새로 프롬프트를 만듭니다. 고친 내용은 바로 저장됩니다.</p></div>` };
}
function promptBox(p, key, title) {
  const m = MODE(), ov = p.over && p.over[key + ':' + m] != null;
  return `<div class="pbox"><div class="ph"><b>${title}</b><span class="sp"></span>${ov ? `<button class="pbtn" data-act="resetP" data-k="${key}">${ic('refresh')}원래대로</button>` : ''}<button class="ib sm cpy" data-act="copyP" data-k="${key}" aria-label="복사" title="복사">${ic('copy')}</button><button class="pbtn blue" data-act="shareP" data-k="${key}" data-t="${title}">${ic('share')}내보내기</button></div>
    <textarea class="ag ptx" data-ov="${key}" spellcheck="false" aria-label="${title}">${esc(promptText(p, key, m))}</textarea>
    ${m === 'en' ? `<details class="kox"><summary>${ic('info')}한국어 설명 보기</summary><p>${esc(promptBase(p, key, 'kr'))}</p></details>` : ''}</div>`;
}

/* ---------- 화면들 ---------- */
const V = {};
V.char = viewChar;
V.chars = p => {
  const q = (p.q || '').trim().toLowerCase(), kf = p.kf || '';
  const cl = charLib.filter(c => (!kf || ckind(c) === kf) && (!q || [c.nk, c.ne, c.dk, c.de].join(' ').toLowerCase().includes(q))).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return { nav: 'chars', title: '내 캐릭터', ticon: 'users', big: true, acts: modeSeg(), html: `
    <div class="search">${ic('search')}<input class="in" id="cq" type="search" data-q="1" placeholder="이름이나 생김새로 찾기" value="${esc(p.q || '')}" aria-label="검색">${q ? `<button class="ib sm" data-act="qclear" aria-label="검색어 지우기">${ic('x')}</button>` : ''}</div>
    <div class="chips"><button class="chip ${!kf ? 'on' : ''}" data-act="set" data-k="p_kf" data-v="">전체 ${charLib.length}</button>${Object.entries(KINDS).map(([k, v]) => `<button class="chip ${kf === k ? 'on' : ''}" data-act="set" data-k="p_kf" data-v="${k}">${ic(v[1])}${v[0]} ${charLib.filter(c => ckind(c) === k).length}</button>`).join('')}</div>
    ${cl.length ? `<div class="lchars">${cl.map(charCard).join('')}</div>` : `<div class="card empty"><b>${charLib.length ? '찾는 캐릭터가 없습니다' : '저장한 캐릭터가 없습니다'}</b>${charLib.length ? '다른 단어로 찾아보세요.' : '대본의 등장인물 탭에서 "내 캐릭터에 저장"을 누르면 생김새와 사진이 여기 모입니다. 다음 영상을 바꿔 쓸 때 원본 인물 자리에 넣을 수 있습니다.'}</div>`}
    <button class="btn block" data-act="newLibChar">${ic('plus')}새 캐릭터 만들기</button>` };
};

/* 유행 영상 카드 */
const kindChips = cast => { const n = {}; (cast || []).forEach(c => { const k = kindCode(c.kind); n[k] = (n[k] || 0) + 1; }); return Object.entries(n).map(([k, c]) => `<span class="tag k${k}">${ic(KINDS[k][1])}${KINDS[k][0]}${c > 1 ? ' ' + c : ''}</span>`).join(''); };
const thumb = (url, icon, hue) => `<span class="thumb" style="--h:${hue == null ? 255 : hue}">${ic(icon || 'film')}${url ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
function feedCard(v, va, n) {
  const ko = va && va.title_ko, fm = FM[v.kind] || FM[fmtGuess(v.genre, v.kind)], topic = va && noGuess(va.topic);
  return `<article class="card fv"><button class="fthumb" data-act="trendVideo" data-id="${esc(v.id)}" aria-label="내 것으로 바꾸기">${thumb(v.thumb, fm.icon, fm.hue)}<span class="rk num ${n <= 3 ? 'top' : ''}">${n}</span><span class="dur num">${v.dur || '?'}초</span></button>
    <div class="fbody"><b class="ft">${esc(ko || v.title)}</b>${topic && topic !== ko ? `<small class="ftopic">${esc(topic)}</small>` : ''}
      <small class="num">${ic('eye')}${man(v.views)}${v.vel ? `<i>${ic('rocket')}하루 +${man(v.vel)}</i>` : ''}</small>
      <div class="ftags"><span class="tag" style="--h:${fm.hue}">${ic(fm.icon)}${fm.name}</span>${va && va.format ? `<span class="tag mut">${esc(noGuess(va.format))}</span>` : ''}${va && va.visual ? `<span class="tag mut">${esc(noGuess(va.visual))}</span>` : ''}${va && va.watched ? `<span class="tag ok">${ic('eye')}직접 봄</span>` : ''}</div>
      <div class="facts"><button class="btn sm pri" data-act="trendVideo" data-id="${esc(v.id)}">${ic('sparkle')}내 것으로 바꾸기</button><button class="ib sm" data-act="openUrl" data-u="${esc(v.url || '')}" aria-label="원본 영상 보기">${ic('play')}</button></div></div></article>`;
}
V.home = p => {
  const t = trends(), date = (p.d && t.days[p.d] ? p.d : '') || t.dates.find(d => t.days[d]) || '', day = t.days[date], an = day && day.analysis, vids = ((day && day.videos) || []).filter(v => FM[v.kind]);
  const fld = FM[p.f] ? p.f : '', mk = p.mk === 'global' ? 'global' : 'kr';
  const list = vids.filter(v => (!fld || v.kind === fld) && v.mkt === mk).sort((a, b) => p.so === 'vel' ? (b.vel || 0) - (a.vel || 0) : (b.views || 0) - (a.views || 0)).slice(0, 40);
  const sm = (an && an.summary) || {}, clean = x => esc(noGuess(x)), recent = [...projects].sort((a, b) => b.updated - a.updated).slice(0, 2);
  const flowItems = [...(sm.common || []).map(c => [c.name, c.detail]), ...(sm.rising || []).map(x => ['뜨는 주제', x])];
  const gname = fld ? (mk === 'global' ? '해외 ' : '') + FM[fld].name : '', pt = gname && an && an.genres && an.genres[gname] && an.genres[gname].patterns;
  const ideas = (sm.ideas || []).filter(it => it && it.topic && (!fld || fmtGuess(it.field, '') === fld || String(it.field || '').includes(FM[fld].name)));
  const old = !vids.length && day && (day.videos || []).length;
  return { nav: 'home', top: `<div class="brand"><img src="img/icon.png" alt="">숏폼 메이커</div>${modeSeg()}<button class="ib" data-act="go" data-v="settings" aria-label="설정">${ic('gear')}</button>`,
    html: `
    <section class="hero card">
      <div class="ph-t"><span class="eyebrow">${ic('flame')}${date ? `${date.slice(5).replace('-', '/')} 교육·과학·다큐 인기 ${vids.length}편` : '매일 아침 자동 수집'}</span><h2>잘 되는 구성에<br><em>내 주제</em>를 얹는다.</h2></div>${art('bulb', 42)}
      <div class="go"><div class="search grow1">${ic('link')}<input class="in" id="link" type="url" inputmode="url" placeholder="유튜브 쇼츠 링크 붙여넣기" enterkeyhint="go" maxlength="200" aria-label="유튜브 링크"></div><button class="btn pri" data-act="linkGo">가져오기</button></div>
      <p class="modehint">${ic('layers')}뜨는 영상 고르기 → 주제 바꾸기 → 사실 확인 → 원클릭 제작</p>
    </section>
    ${recent.length ? `<section class="sec">${h2('clock', '이어서 만들기', `<button class="pbtn" data-act="tab" data-v="library">전체 보기${ic('chevron')}</button>`)}<div class="list">${recent.map(x => projRow(x)).join('')}</div></section>` : ''}
    <section class="sec">${h2('trophy', '오늘 뜨는 영상', `<button class="pbtn blue" data-act="trendsFetch">${ic('refresh')}새로고침</button>`)}
      <div class="chips">${[['', '전체', 'grid', 255], ...FORMATS.map(x => [x.id, x.name, x.icon, x.hue])].map(([v, n, i, h]) => `<button class="chip ${fld === v ? 'on' : ''}" style="--h:${h}" data-act="set" data-k="p_f" data-v="${v}">${ic(i)}${n} ${vids.filter(x => (!v || x.kind === v) && x.mkt === mk).length}</button>`).join('')}</div>
      <div class="fbar">${seg('p_mk', [['kr', '국내'], ['global', '해외']], mk)}<span class="sp"></span>${t.dates.length > 1 ? `<select class="sel" data-act2="trendDay" aria-label="날짜">${t.dates.slice(0, 7).map(d => `<option value="${d}" ${d === date ? 'selected' : ''}>${d.slice(5).replace('-', '/')}</option>`).join('')}</select>` : ''}<div class="seg mini">${[['', '조회수'], ['vel', '급상승']].map(([v, n]) => `<button class="${(p.so || '') === v ? 'on' : ''}" data-act="set" data-k="p_so" data-v="${v}">${n}</button>`).join('')}</div></div>
      ${mk === 'global' && list.length ? '<p class="hint">해외 영상은 제목과 대본을 한국어로 옮겨 보여 줍니다. 해외에서 먼저 뜬 주제를 국내에 먼저 가져오면 경쟁이 적습니다.</p>' : ''}
      ${pt ? `<details class="more"><summary>${ic('bulb')}${esc(gname)} 형식 요약</summary><div class="body kv">${[['제목', pt.title], ['길이', pt.length], ['구성', pt.story], ['리듬', pt.rhythm]].filter(x => x[1]).map(([k, x]) => `<div class="item"><p><span class="lab">${k}</span><span class="pre">${clean(x)}</span></p></div>`).join('')}</div></details>` : ''}
      ${!fld && flowItems.length ? `<details class="more"><summary>${ic('bulb')}오늘의 흐름</summary><div class="body kv">${flowItems.map(([k, x]) => `<div class="item"><p><span class="lab">${esc(k)}</span><span class="pre">${clean(x)}</span></p></div>`).join('')}</div></details>` : ''}
      ${list.length ? `<div class="feed">${list.map((v, i) => feedCard(v, vaOf(an, v.genre, v.id), i + 1)).join('')}</div>`
        : `<div class="card empty"><b>${!day ? '아직 받은 유행 영상이 없습니다' : old ? '교육·과학·다큐 영상이 아직 수집되지 않았습니다' : '이 조건에 맞는 영상이 없습니다'}</b>${!day ? '새로고침을 눌러 오늘 리포트를 받아오세요. 매일 아침 6시쯤 새로 올라옵니다.' : old ? '리포트 저장소의 수집 분야가 바뀐 다음 날 아침부터 보입니다. 그 전에는 위에 링크를 붙여 가져오거나 아래 아이디어로 시작하세요.' : '분야나 국내·해외를 바꿔 보세요.'}${!day ? `<div style="margin-top:14px"><button class="btn sm blue" data-act="trendsFetch">${ic('refresh')}유행 영상 받아오기</button></div>` : ''}</div>`}
    </section>
    ${ideas.length ? `<section class="sec">${h2('sparkle', '오늘 만들 주제')}
      ${ideas.map(it => { const fm = FM[fmtGuess(it.field, '')] || FM.edu, i = sm.ideas.indexOf(it); return `<div class="card tv"><div class="tvh"><span class="glyph" style="--h:${fm.hue}">${ic(fm.icon)}</span><span class="grow"><b>${esc(noGuess(it.title))}</b><small>${fm.name}${it.length ? ` · ${esc(it.length)}` : ''}</small></span></div>
        <dl class="tvk">${it.hook ? `<dt>훅</dt><dd>${clean(it.hook)}</dd>` : ''}${it.structure ? `<dt>구성</dt><dd>${clean(it.structure)}</dd>` : ''}${it.why ? `<dt>지금 될 이유</dt><dd>${clean(it.why)}</dd>` : ''}</dl>
        <div class="aiacts"><button class="btn sm blue" data-act="trendIdea" data-i="${i}">${ic('sparkle')}이 주제로 만들기</button></div></div>`; }).join('')}</section>` : ''}` };
};

V.make = p => {
  const fm = FM[p.fm] ? p.fm : 'edu';
  return { title: '새로 만들기', back: true, html: `
    ${pageHead({ eyebrow: '목록에 없는 영상도 됩니다', eicon: 'link', title: '링크 하나면 됩니다', lead: '유튜브 쇼츠 링크를 붙이면 AI가 영상을 직접 보고 구성과 장면별 대본을 뽑은 뒤, 내 주제로 바꿔 씁니다.', icon: 'link', hue: 218 })}
    <div class="card aicard"><div class="field"><label for="link">${ic('link')}유튜브 링크</label><input class="in" id="link" type="url" inputmode="url" data-p="link" value="${esc(p.link || '')}" placeholder="https://youtube.com/shorts/..." maxlength="200"></div>
      <button class="btn pri block" data-act="linkGo">${ic('eye')}${aiKeys().length ? '영상 가져와서 분석하기' : 'API 키 넣으러 가기'}</button>
      <p class="hint">공개된 영상만 볼 수 있습니다. 내 Gemini 키로 분석하며 30초~2분 걸립니다.</p></div>
    <div class="sec">${h2('sparkle', '주제로 새로 쓰기')}
      <div class="chips wrap">${FORMATS.map(t => `<button class="chip ${fm === t.id ? 'on' : ''}" style="--h:${t.hue}" data-act="set" data-k="p_fm" data-v="${t.id}">${ic(t.icon)}${t.name}</button>`).join('')}</div>
      <div class="field"><textarea class="in" rows="3" data-p="idea" aria-label="주제" placeholder="${esc(FM[fm].ex)}">${esc(p.idea || '')}</textarea></div>
      <button class="btn blue block" data-act="ideaGo">${ic('sparkle')}대본 만들기</button>
      <button class="btn block" data-act="blankNew">${ic('edit')}빈 대본으로 직접 쓰기</button></div>` };
};

/* ----- 편집: 대본 / 인물 / 영상 / 자막·업로드 ----- */
const ETABS = [['script', '대본', 'list'], ['cast', '등장인물', 'users'], ['video', '영상', 'film'], ['sub', '자막·문구', 'caption'], ['finish', '완성', 'bolt']];
function shotCard(p, i, start) {
  const s = p.shots[i], k = sfx(), en = isEn(), b = beatOf(p, i), cls = i === 0 ? 'h' : i === p.shots.length - 1 ? 'c' : '';
  return `<div class="beat ${cls}" data-i="${i}">
    <div class="tc num"><span class="pdot">${ic('play')}</span><b>${tc(start)}</b><small>${s.sec || 5}초</small></div>
    <div class="box card"><div class="hd"><span class="pill">${i + 1} ·<input class="btin" data-sf="${i}:bt" value="${esc(b[0])}" maxlength="8" aria-label="장면 이름"></span><span class="sp"></span><select class="sel" data-sf="${i}:cam" aria-label="카메라">${Object.entries(CAMS).map(([c, v]) => `<option value="${c}" ${s.cam === c ? 'selected' : ''}>${v[0]}</option>`).join('')}</select><button class="ib sm" data-act="shotMenu" aria-label="샷 ${i + 1} 메뉴">${ic('more')}</button></div>
      <div class="frow"><span>${ic('pin')}장소</span><input data-sf="${i}:p${k}" value="${esc(s['p' + k])}" placeholder="${en ? 'e.g. corporate lobby' : '예: 회사 로비'}" aria-label="장소"></div>
      <textarea rows="1" class="ag" data-sf="${i}:a${k}" aria-label="화면 묘사" placeholder="${en ? 'One visible action' : '화면에 보이는 동작 하나'}">${esc(s['a' + k])}</textarea>
      ${en ? `<div class="ko"><span>한국어 설명</span><textarea rows="1" class="ag" data-sf="${i}:ak" aria-label="화면 묘사 한국어 설명">${esc(s.ak)}</textarea></div>` : ''}
      <div class="say"><select class="sel" data-sf="${i}:sp" aria-label="말하는 인물"><option value="-1">말 없음</option><option value="-2" ${s.sp === NARR ? 'selected' : ''}>내레이션</option>${p.chars.map((c, n) => `<option value="${n}" ${s.sp === n ? 'selected' : ''}>${esc(cname(c))}</option>`).join('')}</select>
        <textarea rows="1" class="ag line" data-sf="${i}:d${k}" aria-label="대사" placeholder="${en ? 'Line (max 14 words)' : '대사·내레이션 (28자 이내)'}" ${s.sp === -1 ? 'disabled' : ''}>${esc(s['d' + k])}</textarea></div>
      ${en && s.sp !== -1 ? `<div class="ko"><span>대사 한국어</span><textarea rows="1" class="ag" data-sf="${i}:dk" aria-label="대사 한국어">${esc(s.dk)}</textarea></div>` : ''}
    </div></div>`;
}
function factBox(p) {
  const fx = p.facts || [], done = fx.filter(x => x.ok).length;
  return `<div class="sec">${h2('checkc', `사실 확인 ${done}/${fx.length}`, `<button class="pbtn" data-act="factAdd">${ic('plus')}추가</button>`)}
    ${fx.length ? `<div class="card facts-c">${fx.map((x, i) => `<div class="fact ${x.ok ? 'ok' : ''}"><button class="ck ${x.ok ? 'on' : ''}" data-act="factOk" data-i="${i}" aria-label="확인함">${ic('check')}</button><textarea class="ag" rows="1" data-fact="${i}" aria-label="사실 ${i + 1}">${esc(x.f)}</textarea><button class="ib sm" data-act="factSearch" data-i="${i}" aria-label="검색해서 확인">${ic('search')}</button><button class="ib sm" data-act="factDel" data-i="${i}" aria-label="빼기">${ic('x')}</button></div>`).join('')}</div>
    <p class="hint">돋보기를 누르면 검색 결과가 열립니다. 믿을 만한 출처(교과서, 기관, 백과사전)에서 확인되면 체크하세요. 확인되지 않는 주장은 대본에서 빼거나 "~라는 연구가 있다"로 낮추세요.</p>`
      : `<div class="card empty"><b>확인할 사실이 없습니다</b>AI로 바꿔 쓴 대본은 핵심 주장을 여기에 모아 줍니다. 직접 쓴 대본이면 "추가"로 넣으세요.</div>`}</div>`;
}
function tabScript(p) {
  const sc = scoreOf(p), k = sfx(), en = isEn(); let t = 0;
  return `
    <div class="stats num"><div class="stat t1"><span class="v">${ic('film')}${p.shots.length}샷</span><small>샷 수</small></div><div class="stat t2"><span class="v">${ic('clock')}${totalSec(p)}초</span><small>전체 길이</small></div><div class="stat t3"><span class="v">${ic('checkc')}${sc.score}점</span><small>완성도</small></div></div>
    ${p.src && (p.src.title || p.src.url) ? `<div class="card srcc sm">${thumb(p.src.thumb, 'film')}<div class="grow"><span class="eyebrow">${ic('trophy')}원본 · ${esc(p.src.from || '가져온 영상')}</span><b>${esc(p.src.title || '')}</b></div>${p.src.url ? `<button class="ib" data-act="openUrl" data-u="${esc(p.src.url)}" aria-label="원본 영상 보기">${ic('play')}</button>` : ''}</div>` : ''}
    ${factBox(p)}
    <div class="card aicard"><div class="aih"><span class="glyph" style="--h:262">${ic('sparkle')}</span><span class="grow"><b>AI로 다시 쓰기</b><small>${aiKeys().length ? `Gemini · ${esc(aiModel())} · 키 ${aiKeys().length}개` : '설정에서 Gemini API 키를 넣으면 쓸 수 있습니다'}</small></span>${p.ai ? `<span class="tag pur">AI 작성</span>` : ''}</div>
      ${aiKeys().length ? `<input class="in" id="ai_req" data-pf="aiReq" value="${esc(p.aiReq || '')}" placeholder="요청 (선택) 예: 더 쉽게, 첫 문장을 더 세게">` : ''}
      <div class="aiacts">${p._undo ? `<button class="btn sm" data-act="aiUndo">${ic('back')}AI 전으로</button>` : ''}<button class="btn sm" data-act="${aiKeys().length ? 'aiSync' : 'settings'}">${ic('globe')}${en ? '한국어판에 반영' : '영어판에 반영'}</button><button class="btn sm blue" data-act="${aiKeys().length ? 'aiAll' : 'settings'}">${ic('sparkle')}${aiKeys().length ? '전체 다시 쓰기' : 'API 키 넣기'}</button></div>
      <p class="hint">${en ? '영어 칸이 프롬프트에 들어갑니다. 영어를 고친 뒤 "한국어판에 반영"을 누르면 한국어 설명도 맞춰집니다.' : '한국어 칸이 프롬프트에 들어갑니다. 해외용으로도 쓸 대본이면 고친 뒤 "영어판에 반영"을 누르세요.'}</p></div>
    <div class="sec beats" id="beats">${p.shots.map((s, i) => { const a = t; t += (+s.sec || 5); return shotCard(p, i, a); }).join('')}
      <button class="btn sm" data-act="addShot">${ic('plus')}샷 추가</button></div>
    <div class="sec">${h2('checkc', '완성도 점검')}<div class="card score"><ul>${scoreList(sc)}</ul></div></div>
    <div class="field"><label for="memo">${ic('caption')}메모</label><textarea class="in" id="memo" rows="2" data-pf="memo" placeholder="다음 편 아이디어 등">${esc(p.memo || '')}</textarea></div>`;
}
function tabCast(p) {
  const k = sfx(), en = isEn(), open = cur().p.cp || {};
  return `
    <div class="card guide"><b>${ic('info')}나만의 등장인물 만들기</b><ol><li>원본과 종류는 같고 생김새는 다른 새 등장인물입니다. 생김새 칸을 직접 고치거나 "비슷하지만 다른 3안"으로 바꾸세요.</li><li>"그록으로 전신 생성"을 누르면 그록 앱에서 이미지를 만들어 사진 칸에 넣습니다. 직접 만들려면 "전신 프롬프트"로 그록·챗GPT에 보내세요.</li><li>"내 캐릭터에 저장"하면 다음 영상에서도 같은 생김새로 불러옵니다.</li></ol>
      <button class="btn sm" data-act="loadChar">${ic('users')}내 캐릭터 불러오기${charLib.length ? ` (${charLib.length})` : ''}</button>
      ${p.chars.some(c => ckind(c) === 'P') ? `<div class="frow wide"><span>${ic('globe')}인물 분위기</span><input data-set="${en ? 'castEn' : 'castKr'}" value="${esc(castOf(MODE()))}" aria-label="인물 분위기" placeholder="${en ? 'American' : '한국인'}"></div>
      <p class="hint">사람 등장인물의 프롬프트 앞에만 붙습니다. ${en ? 'British, Latina처럼 바꿀 수 있습니다.' : ''}</p>` : ''}</div>
    ${p.chars.length ? '' : `<div class="card empty"><b>등장인물이 없는 영상입니다</b>손·사물·풍경과 내레이션만으로 만듭니다. 필요하면 아래에서 추가하세요.</div>`}
    ${p.chars.map((c, i) => { const kc = ckind(c); return `<div class="card ccard" data-ci="${i}">
      <div class="chd"><span class="glyph" style="--h:${{ P: 218, A: 150, C: 262, O: 42 }[kc]}">${ic(KINDS[kc][1])}</span><input class="cname" data-cf="${i}:n${k}" value="${esc(c['n' + k])}" aria-label="이름" placeholder="${en ? 'Name' : '이름'}"><button class="ib sm" data-act="delChar" data-i="${i}" aria-label="등장인물 삭제">${ic('trash')}</button></div>
      <div class="csel"><select class="sel" data-cf="${i}:k" aria-label="종류">${Object.entries(KINDS).map(([r, n]) => `<option value="${r}" ${kc === r ? 'selected' : ''}>${n[0]}</option>`).join('')}</select><select class="sel" data-cf="${i}:r" aria-label="역할">${Object.entries(ROLE_NAME).map(([r, n]) => `<option value="${r}" ${c.r === r ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      ${c.ok ? `<div class="origc"><span>원본</span><p>${esc(c.ok)}</p></div>` : ''}
      <div class="field"><label>${ic('edit')}내 등장인물 생김새 ${en ? '(영어, 프롬프트에 그대로 들어갑니다)' : '(프롬프트에 그대로 들어갑니다)'}</label><textarea class="in ag" rows="2" data-cf="${i}:d${k}" placeholder="${en ? { P: 'woman in her 30s, long black coat, ...', A: 'small white Maltese, round black eyes, red collar', C: 'round blue 3D robot, big yellow eyes, short arms', O: 'chubby yellow mug with a sleepy face' }[kc] : { P: '예: 30대 여성, 검은 롱코트, 긴 생머리, 차가운 눈빛', A: '예: 작은 흰색 말티즈, 동그란 검은 눈, 빨간 목줄', C: '예: 둥근 파란 3D 로봇, 큰 노란 눈, 짧은 팔다리', O: '예: 졸린 표정의 통통한 노란 머그컵' }[kc]}">${esc(c['d' + k])}</textarea></div>
      ${en ? `<div class="ko"><span>한국어 설명</span><textarea rows="1" class="ag" data-cf="${i}:dk" aria-label="생김새 한국어 설명">${esc(c.dk)}</textarea></div><div class="ko"><span>한국어 이름</span><input data-cf="${i}:nk" value="${esc(c.nk)}" aria-label="한국어 이름"></div>` : ''}
      <button class="btn sm pur" data-act="${aiKeys().length ? 'charVar' : 'settings'}" data-i="${i}">${ic('sparkle')}AI로 비슷하지만 다른 3안 받기</button>
      <div class="aiacts"><button class="btn sm blue" data-act="genChar" data-i="${i}" data-kind="full">${ic('share')}전신 프롬프트</button><button class="btn sm" data-act="genChar" data-i="${i}" data-kind="face">${ic('share')}얼굴 프롬프트</button></div>
      <div class="slots">${imgSlot('d', i, c, 'full')}${imgSlot('d', i, c, 'face')}</div>
      <div class="aiacts"><button class="btn sm grok" data-act="grokMake" data-ctx="d" data-ref="${i}" data-kind="full">${ic('sparkle')}그록으로 전신 생성</button><button class="btn sm grok" data-act="grokMake" data-ctx="d" data-ref="${i}" data-kind="face">${ic('sparkle')}그록으로 얼굴 생성</button></div>
      <button class="btn sm ${c.libId ? '' : 'blue'}" data-act="saveChar" data-i="${i}">${ic(c.libId ? 'check' : 'download')}${c.libId ? '내 캐릭터에 저장됨 · 다시 저장' : '내 캐릭터에 저장'}</button>
      ${open[`${i}:full`] ? promptBox(p, `c:${i}:full`, `${esc(cname(c))} · 전신 이미지 프롬프트`) : ''}${open[`${i}:face`] ? promptBox(p, `c:${i}:face`, `${esc(cname(c))} · 얼굴 이미지 프롬프트`) : ''}
    </div>`; }).join('')}
    <div class="aiacts"><button class="btn sm" data-act="addChar">${ic('plus')}등장인물 추가</button>${p.chars.length ? `<button class="btn sm" data-act="shareAllChars">${ic('share')}전신 프롬프트 모두 내보내기</button>` : ''}</div>`;
}
function shotPlan(p) {
  const vids = vidShots(p), k = sfx();
  return `<div class="sec">${h2('layers', '샷 구성 (크레딧 절약)')}
    <p class="hint">클링 영상 ${vids.length}샷 × ${KLING_COST} = 약 <b>${vids.length * KLING_COST}크레딧</b> · 나머지 ${p.shots.length - vids.length}샷은 그록 장면 이미지(무료)에 천천히 확대되는 효과를 넣습니다.</p>
    <div class="list">${p.shots.map((s, i) => `<div class="row plan"><span class="grow"><b>${i + 1} · ${beatOf(p, i)[0]}</b><small>${esc(s['a' + k] || '')}</small></span>
      <div class="seg mini">${[['v', '영상'], ['s', '이미지']].map(([v, n]) => `<button class="${(isVid(p, i) ? 'v' : 's') === v ? 'on' : ''}" data-act="shotKind" data-i="${i}" data-v="${v}">${n}</button>`).join('')}</div></div>`).join('')}</div></div>`;
}
function tabVideo(p) {
  const vt = cur().p.vt || 'shot', half = Math.ceil(p.shots.length / 2), k = sfx(), info = kInfo();
  return `
    <div class="card aicard kling"><div class="aih"><span class="glyph" style="--h:350">${ic('bolt')}</span><span class="grow"><b>클링으로 보내기</b><small>${!Native.has() ? '휴대폰 앱에서 쓸 수 있습니다' : !info || !info.on ? '설정에서 클링 자동 입력을 켜야 합니다' : !info.pkg ? '클링 앱을 찾지 못했습니다' : `${esc(info.label || '클링')} 앱에 사진과 프롬프트를 자동으로 넣습니다`}</small></span>${flowNow().verified ? '' : '<span class="tag warn">시험 중</span>'}</div>
      <div class="aiacts"><button class="btn sm" data-act="klingSend">${ic('bolt')}클링에 입력만</button><button class="btn sm blue" data-act="goFinish">${ic('bolt')}원클릭 제작</button></div>
      <p class="hint">등장인물 탭에 첨부한 사진을 샷마다 골라 올리고, 지금 모드(${isEn() ? '해외용 영어' : '국내용 한국어'}) 프롬프트를 입력합니다. 켜는 방법과 순서 업데이트는 설정에 있습니다.</p></div>
    ${shotPlan(p)}
    <div class="card guide"><b>${ic('film')}클링으로 영상 만드는 순서</b><ol>${p.chars.length ? `<li>등장인물 탭에서 만든 등장인물 이미지를 클링의 참조 이미지(Elements)로 올립니다. 번호는 등장인물 순서와 같습니다: ${p.chars.map((c, i) => `${i + 1} = ${esc(cname(c))}`).join(', ')}.</li>` : ''}<li>샷마다 "첫 프레임 프롬프트"로 장면 이미지를 만들면 구도가 고정됩니다. (건너뛰어도 됩니다)</li><li>"클링 영상 프롬프트"를 붙여넣고 길이 5초, 비율 9:16으로 생성합니다.</li><li>직접 편집하려면 샷들을 편집 앱에서 이어 붙이고 자막 탭의 자막 파일을 넣습니다. 완성 탭의 원클릭 제작은 이 과정을 대신 합니다.</li></ol></div>
    <div class="sec"><span class="lab">${ic('sparkle')}영상 스타일</span><div class="chips">${Object.entries(STYLES).map(([id, v]) => `<button class="chip ${(p.style || 'real') === id ? 'on' : ''}" data-act="pstyle" data-v="${id}">${v[0]}</button>`).join('')}</div></div>
    ${seg('p_vt', [['shot', '샷별 프롬프트', 'list'], ['multi', '멀티샷', 'layers']], vt)}
    ${vt === 'shot' ? p.shots.map((s, i) => `<div class="card vcard"><div class="vh"><span class="pill">${i + 1} · ${beatOf(p, i)[0]}</span><small>${esc(s['a' + k])}</small></div>${promptBox(p, `f:${i}`, '첫 프레임 이미지 프롬프트')}${promptBox(p, `k:${i}`, '클링 영상 프롬프트')}</div>`).join('')
      : `<p class="hint">멀티샷을 지원하는 클링 모델에 통째로 붙여넣습니다. 한 번에 만들 수 있는 길이가 짧은 모델은 앞부분과 뒷부분을 따로 만드세요.</p>
        <div class="card vcard">${promptBox(p, `m:0:${p.shots.length}`, `전체 ${p.shots.length}샷 · ${totalSec(p)}초`)}</div>
        <div class="card vcard">${promptBox(p, `m:0:${half}`, `앞부분 (샷 1~${half})`)}${promptBox(p, `m:${half}:${p.shots.length}`, `뒷부분 (샷 ${half + 1}~${p.shots.length})`)}</div>`}
    <div class="card vcard">${promptBox(p, 'n', '제외 프롬프트 (Negative prompt)')}</div>
    <button class="btn block" data-act="exportPack">${ic('share')}제작 팩 전체 내보내기</button>`;
}
function tabSub(p) {
  const sl = cur().p.sl || (isEn() ? 'en' : 'ko'), srt = toSrt(p, sl), has = !!subLines(p, sl), name = (SUB_LANGS.find(l => l[0] === sl) || [])[1], kit = uploadKit(p, MODE());
  return `
    <div class="sec">${h2('caption', '언어별 자막')}
      <div class="chips">${SUB_LANGS.map(([id, n]) => `<button class="chip ${sl === id ? 'on' : ''}" data-act="set" data-k="p_sl" data-v="${id}">${n}${subLines(p, id) ? '' : ' +'}</button>`).join('')}</div>
      ${has ? `<div class="card vcard"><div class="ph"><b>${name} 자막 (SRT)</b><span class="sp"></span><button class="pbtn" data-act="subOut" data-v="${sl}">${ic('share')}내보내기</button><button class="pbtn blue" data-act="copy" data-t="${esc(srt)}">${ic('copy')}복사</button></div><pre class="srt">${esc(srt) || '대사가 없습니다'}</pre></div>`
        : `<div class="card empty"><b>${name} 자막이 아직 없습니다</b>한국어·영어 대본을 바탕으로 AI가 번역합니다.<div style="margin-top:14px"><button class="btn sm blue" data-act="${aiKeys().length ? 'aiSubs' : 'settings'}" data-v="${sl}">${ic('sparkle')}${aiKeys().length ? `${name} 자막 만들기` : 'API 키 넣으러 가기'}</button></div></div>`}
      <p class="hint">한국어와 영어 자막은 대본에서 바로 나옵니다. "+" 표시가 붙은 언어는 Gemini로 번역합니다. 자막 시간은 샷 길이에 맞춰져 있습니다.</p></div>
    <div class="sec">${h2('share', `업로드 문구 (${isEn() ? '해외용' : '국내용'})`)}
      <div class="card kv"><div class="frow wide"><span>${ic('hash')}몇 편째</span><input type="number" min="1" max="999" data-pf="ep" value="${p.ep || 1}" aria-label="회차"></div>
        ${[['제목', kit.title], ['설명', kit.desc], ['고정 댓글', kit.pin]].map(([l, v]) => `<div class="item"><p><span class="lab">${l}</span><span class="pre">${esc(v)}</span></p><button class="pbtn" data-act="copy" data-t="${esc(v)}">${ic('copy')}복사</button></div>`).join('')}</div>
      <p class="hint">2편부터 제목 뒤에 번호가 붙습니다. 업로드할 때 AI 생성 콘텐츠 표시를 켜세요.</p></div>`;
}
V.editor = () => {
  const p = draft, t = fmOf(p), et = cur().p.tab || 'script', k = sfx(), en = isEn();
  return { title: t.name, back: true, flush: true, acts: `${modeSeg()}<button class="ib" data-act="exportOne" aria-label="내보내기">${ic('share')}</button>`, html: `
    <div class="ehead"><div class="tline"><span class="playdot">${ic('play')}</span><textarea class="titlein ag" rows="1" data-pf="t${k}" aria-label="제목">${esc(p['t' + k])}</textarea></div>${art(t.icon, t.hue)}</div>
    <textarea class="logline ag" rows="1" data-pf="l${k}" aria-label="한 줄 줄거리" placeholder="${en ? 'One-line logline' : '한 줄 줄거리'}">${esc(p['l' + k])}</textarea>
    ${en ? `<div class="ko top"><span>한국어 제목·줄거리</span><p>${esc(p.tk)} · ${esc(p.lk)}</p></div>` : ''}
    <div class="chips etabs">${ETABS.map(([v, l, i]) => `<button class="chip ${et === v ? 'on' : ''}" data-act="set" data-k="p_tab" data-v="${v}">${ic(i)}${l}</button>`).join('')}</div>
    ${{ script: tabScript, cast: tabCast, video: tabVideo, sub: tabSub, finish: tabFinish }[et](p)}
    <div class="sticky"><button class="btn" data-act="save">${ic('check')}저장</button>${et === 'finish' ? '' : `<button class="btn pri" data-act="goOne">${ic('bolt')}원클릭 제작</button>`}</div>` };
};

V.remix = p => {
  const s = p.src, sim = +p.sim || 2, noCast = remixNoCast(p), n = remixShots(p), fm = FM[s.kind] || FM[fmtGuess(`${s.topic} ${s.genre || ''}`, s.kind)];
  const ko = s.orig && s.orig !== s.title;
  return { title: '내 주제로 바꾸기', back: true, flush: true, html: `
    <div class="card srcc">${thumb(s.thumb, fm.icon, fm.hue)}<div class="grow"><span class="eyebrow">${ic('trophy')}${esc(s.from || '가져온 영상')}</span><b>${esc(s.title || '제목 없음')}</b>${ko ? `<small class="orig">${esc(s.orig)}</small>` : ''}
      <div class="ftags"><span class="tag" style="--h:${fm.hue}">${ic(fm.icon)}${fm.name}</span>${s.format ? `<span class="tag mut">${esc(s.format)}</span>` : ''}${s.visual ? `<span class="tag mut">${esc(s.visual)}</span>` : ''}${s.watched ? `<span class="tag ok">${ic('eye')}영상을 직접 보고 적음</span>` : s.id && !srcEmpty(s) ? '<span class="tag warn">제목·댓글로 추정</span>' : ''}</div>
      <div class="aiacts">${s.url ? `<button class="btn sm" data-act="openUrl" data-u="${esc(s.url)}">${ic('play')}원본 보기</button>` : ''}${s.id && !s.watched ? `<button class="btn sm blue" data-act="analyzeSrc">${ic('eye')}AI가 직접 보고 분석</button>` : ''}</div></div></div>
    ${srcEmpty(s) ? `<div class="card empty"><b>아직 이 영상의 분석이 없습니다</b>"AI가 직접 보고 분석"을 누르면 구성과 장면별 대본을 뽑아 옵니다.</div>` : `
    <div class="card hookc">${s.topic ? `<span class="lab">${ic('target')}원본 주제</span><p>${esc(s.topic)}</p>` : ''}${s.hook ? `<span class="lab">${ic('flame')}첫 3초 훅</span><p>${esc(s.hook)}</p>` : ''}${s.loops ? `<span class="lab">${ic('refresh')}끝까지 보게 하는 장치</span><p>${esc(s.loops)}</p>` : ''}${s.take ? `<span class="lab">${ic('bulb')}잘 되는 이유</span><p>${esc(s.take)}</p>` : ''}</div>
    <div class="sec">${h2('list', s.script.length ? `원본 구성 ${s.script.length}장면` : '원본 흐름')}
      <ol class="scr">${s.script.length ? s.script.map(x => `<li><span class="t num">${esc(x.t)}</span><p>${esc(x.scene)}${x.line ? `<em>${esc(x.line)}</em>` : ''}</p></li>`).join('') : [...s.flow, s.ending].filter(Boolean).map((x, i) => `<li><span class="t num">${i + 1}</span><p>${esc(x)}</p></li>`).join('')}</ol>
      ${s.ending && s.script.length ? `<p class="hint">마무리: ${esc(s.ending)}</p>` : ''}
      ${s.facts && s.facts.length ? `<details class="more"><summary>${ic('checkc')}원본이 전한 사실 ${s.facts.length}</summary><div class="body"><ul class="flist">${s.facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="hint">원본의 주장일 뿐 확인된 사실이 아닙니다. 그대로 쓰지 말고 내 대본의 사실 확인에서 다시 검증하세요.</p></div></details>` : ''}</div>`}
    <div class="sec">${h2('sparkle', '어떻게 바꿀까요')}
      <span class="lab">닮은 정도</span>${seg('p_sim', SIMS.map(x => [x[0], x[1]]), sim)}
      <p class="hint">${['', '같은 주제를 다른 문장·다른 예시·다른 화면으로 새로 씁니다.', '구성·훅·반전 자리는 그대로, 같은 분야의 비슷한 다른 주제로 옮깁니다.', '훅 방식과 장면 순서만 빌리고 주제는 새로 고릅니다.'][sim]}</p>
      <div class="field"><label>${ic('target')}내 주제 ${sim === 1 ? '(같은 주제면 비워 두세요)' : '(비우면 AI가 고릅니다)'}</label><textarea class="in" rows="2" data-p="topic" placeholder="${esc(fm.ex)}">${esc(p.topic || '')}</textarea></div>
      <span class="lab">길이</span><div class="chips">${[[0, `원본처럼 (${remixShots(Object.assign({}, p, { len: 0 }))}샷)`], [4, '20초'], [6, '30초'], [8, '40초']].map(([v, l]) => `<button class="chip ${(+p.len || 0) === v ? 'on' : ''}" data-act="set" data-k="p_len" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="sec">${h2('users', '화면에 나오는 진행자·캐릭터')}
      ${s.cast.length ? seg('p_castMode', [['keep', '비슷한 새 캐릭터로'], ['none', '없이 (내레이션만)']], noCast ? 'none' : 'keep') : seg('p_castMode', [['none', '없이 (내레이션만)'], ['add', '캐릭터 넣기']], noCast ? 'none' : 'add')}
      ${!s.cast.length ? (noCast ? '<p class="hint">자료화면 같은 장면과 내레이션만으로 만듭니다. 정보형 숏폼에서 가장 흔하고 만들기 쉬운 방식입니다.</p>' : `<div class="field"><textarea class="in" rows="2" data-p="cadd" aria-label="넣을 캐릭터" placeholder="예: 둥근 안경을 쓴 꼬마 과학자 캐릭터">${esc(p.cadd || '')}</textarea></div><p class="hint">매 편 같은 캐릭터가 나오면 채널을 기억하기 쉽습니다. 내 캐릭터에 저장해 두고 계속 쓰세요.</p>`)
        : noCast ? '<p class="hint">원본의 진행자·캐릭터를 빼고 자료화면 같은 장면과 내레이션만으로 다시 씁니다.</p>' : `<div class="rxh"><span>원본</span><span>내 캐릭터</span></div>${s.cast.map((c, i) => { const kc = kindCode(c.kind), lc = p['cl' + i] && charLib.find(x => x.id === p['cl' + i]);
          return `<div class="rx"><div class="ro"><span class="lab">${ic(KINDS[kc][1])}${esc(c.role)} · ${KINDS[kc][0]}</span><p>${c.who ? esc(c.who) : '<i>설정 정보 없음</i>'}</p>${c.look ? `<p class="look">${esc(c.look)}</p>` : ''}</div>
            <div class="rm">${lc ? `<div class="mychar"><span class="lthumb">${lc.imgFull || lc.imgFace ? `<img data-img="${lc.imgFull || lc.imgFace}" alt="">` : ic(KINDS[ckind(lc)][1])}</span><span class="grow"><b>${esc(cname(lc))}</b><small>${esc(clook(lc) || lc.dk)}</small></span><button class="ib sm" data-act="remixLibX" data-i="${i}" aria-label="내 캐릭터 빼기">${ic('x')}</button></div>`
              : `<textarea class="in" rows="3" data-p="c${i}" placeholder="비우면 비슷하지만 다른 새 ${KINDS[kc][0]}" aria-label="${esc(c.role)} 바꿔 쓰기">${esc(p['c' + i] || '')}</textarea>`}
              ${lc ? '' : `<button class="pbtn" data-act="remixLib" data-i="${i}">${ic('users')}내 캐릭터 쓰기</button>`}</div></div>`; }).join('')}`}</div>
    <div class="sec"><div class="field"><label>${ic('flame')}마무리 바꾸기 (선택)</label><textarea class="in" rows="2" data-p="end" placeholder="${esc(s.ending ? `원본: ${s.ending}` : '예: 마지막에 다음 편 주제를 질문으로 던진다')}">${esc(p.end || '')}</textarea></div>
      <div class="field"><label>${ic('edit')}더 바라는 점 (선택)</label><textarea class="in" rows="2" data-p="more" placeholder="예: 초등학생도 알아듣게 쉽게">${esc(p.more || '')}</textarea></div></div>
    <div class="sticky"><button class="btn pri" data-act="remixGo" ${srcEmpty(s) ? 'disabled' : ''}>${ic('sparkle')}${aiKeys().length ? `내 대본으로 변환 · ${n}샷 ${n * 5}초` : 'API 키 넣으러 가기'}</button></div>` };
};

V.library = p => {
  const q = (p.q || '').trim().toLowerCase(), tf = p.th || '';
  const list = projects.filter(x => (!tf || x.fmt === tf) && (!p.fav || x.fav) && (!q || (x.tk + x.te + x.lk + x.le).toLowerCase().includes(q))).sort((a, b) => b.updated - a.updated);
  const counts = {}; projects.forEach(x => counts[x.fmt] = (counts[x.fmt] || 0) + 1);
  if (sel) return { nav: 'library', title: `${sel.size}개 선택`, back: true, flush: true, acts: `<button class="tb" data-act="selAll">${ic('check')}전체 선택</button>`, html: `
    <div class="list">${list.map(x => projRow(x, `<span class="ck ${sel.has(x.id) ? 'on' : ''}">${ic('check')}</span>`)).join('')}</div>
    <div class="sticky"><button class="btn" data-act="selDelete">${ic('trash')}삭제</button><button class="btn pri" data-act="selExport">${ic('share')}내보내기</button></div>` };
  return { nav: 'library', title: '보관함', ticon: 'folder', big: true, acts: `${modeSeg()}${projects.length ? `<button class="tb" data-act="selStart">${ic('check')}선택</button>` : ''}`, html: `
    <div class="search">${ic('search')}<input class="in" id="lq" type="search" data-q="1" placeholder="제목이나 줄거리로 찾기" value="${esc(p.q || '')}" aria-label="검색">${q ? `<button class="ib sm" data-act="qclear" aria-label="검색어 지우기">${ic('x')}</button>` : ''}</div>
    <div class="chips"><button class="chip ${!tf && !p.fav ? 'on' : ''}" data-act="lth" data-v="">${ic('grid')}전체 ${projects.length}</button><button class="chip ${p.fav ? 'on' : ''}" style="--h:40" data-act="lfav">${ic('star')}즐겨찾기</button>${FORMATS.filter(t => counts[t.id]).map(t => `<button class="chip ${tf === t.id ? 'on' : ''}" style="--h:${t.hue}" data-act="lth" data-v="${t.id}">${ic(t.icon)}${t.name} ${counts[t.id]}</button>`).join('')}</div>
    <div class="sec">${h2('clock', tf ? FM[tf].name : p.fav ? '즐겨찾기' : '내가 만든 숏폼', list.length ? `<button class="pbtn blue" data-act="exportShown">${ic('share')}이 목록 내보내기</button>` : '')}
    ${list.length ? `<div class="list">${list.map(x => projRow(x)).join('')}</div><p class="hintpill">${ic('info')}길게 누르면 여러 개를 골라 한 번에 내보낼 수 있습니다.</p>` : `<div class="card empty"><b>${projects.length ? '찾는 작업이 없습니다' : '아직 만든 숏폼이 없습니다'}</b>${projects.length ? '검색어나 종류를 바꿔 보세요.' : '홈에서 뜨는 영상을 골라 내 것으로 바꾸고 저장하면 여기에 모입니다.'}</div>`}</div>` };
};

V.info = p => {
  const t = p.tab || 'how', sec = INFO.find(x => x.id === t);
  return { nav: 'info', title: '안내', ticon: 'book', big: true, html: `
    ${pageHead({ eyebrow: '시작 전에 읽기', eicon: 'info', lead: '쓰는 순서, 잘 되는 숏폼의 공식, 채널을 안전하게 키우는 방법을 정리했습니다.', icon: 'book', hue: 196 })}
    <div class="chips">${INFO.map(x => `<button class="chip ${x.id === t ? 'on' : ''}" data-act="set" data-k="p_tab" data-v="${x.id}">${ic(x.icon)}${x.name}</button>`).join('')}<button class="chip" data-act="go" data-v="check">${ic('list')}업로드 점검표</button></div>
    <div class="list">${sec.items.map(([h, d, ex], n) => `<div class="artc"><div class="ah"><span class="no num">${n + 1}</span><h3>${h}</h3></div><p>${d}</p><div class="ex">${ic('bulb')}<span>${ex}</span></div></div>`).join('')}</div>
    ${t === 'channel' ? '<p class="hint">플랫폼 정책과 수치는 자주 바뀝니다. 여기 적힌 내용은 일반적인 운영 원칙이며, 업로드 전에 각 플랫폼의 공식 안내를 확인하세요.</p>' : ''}` };
};
V.check = () => ({ title: '업로드 전 점검표', back: true, html: `${pageHead({ eyebrow: `${settings.checks.length} / ${CHECKLIST.length} 확인`, eicon: 'check', lead: '올리기 전에 하나씩 눌러 확인하세요.', icon: 'list', hue: 28 })}<div class="list">${CHECKLIST.map((c, i) => `<button class="row" data-act="check" data-i="${i}"><span class="ck ${settings.checks.includes(i) ? 'on' : ''}">${ic('check')}</span><span class="grow"><b style="white-space:normal">${c}</b></span></button>`).join('')}</div><button class="btn block" data-act="checkReset">${ic('trash')}모두 지우기</button>` });

const setRow = (icon, hue, title, sub, act, right = chev) => `<button class="row" data-act="${act}"><span class="glyph" style="--h:${hue}">${ic(icon)}</span><span class="grow"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${right}</button>`;
V.settings = () => ({ title: '설정', back: true, html: `
  <div class="sec"><span class="lab">${ic('globe')}제작 대상</span>${seg('mode', [['kr', '국내용 (한국어·한국 인물)'], ['en', '해외용 (영어·서양 인물)']], MODE())}</div>
  <div class="sec"><span class="lab">${ic('target')}내 채널 방향</span><input class="in" data-set="myBg" value="${esc(settings.myBg || '')}" placeholder="예: 우주·천문 위주, 초등학생도 알아듣게" aria-label="내 채널 방향"><p class="hint">AI가 주제를 고르고 대본을 쓸 때 늘 참고합니다. 한 채널에 한 분야가 가장 잘 됩니다.</p></div>
  <div class="sec"><span class="lab">${ic('user')}인물 분위기</span><div class="card kv"><div class="frow wide"><span>국내용</span><input data-set="castKr" value="${esc(settings.castKr)}" aria-label="국내용 인물 분위기"></div><div class="frow wide"><span>해외용</span><input data-set="castEn" value="${esc(settings.castEn)}" aria-label="해외용 인물 분위기"></div></div><p class="hint">사람 진행자·인물의 이미지 프롬프트 앞에 붙는 말입니다. 동물·캐릭터에는 붙지 않습니다.</p></div>
  <div class="sec"><span class="lab">${ic('sparkle')}기본 영상 스타일</span><div class="chips wrap">${[['', '분야에 맞게'], ...Object.entries(STYLES).map(([id, v]) => [id, v[0]])].map(([id, n]) => `<button class="chip ${(settings.style || '') === id ? 'on' : ''}" data-act="set" data-k="style" data-v="${id}">${n}</button>`).join('')}</div><p class="hint">채널 전체에서 한 스타일을 쓰면 썸네일만 보고도 내 채널을 알아봅니다. "분야에 맞게"는 교육=모션그래픽, 과학=3D 과학 애니, 다큐=실사 다큐로 고릅니다.</p></div>
  <div class="sec"><span class="lab">${ic('sun')}화면 테마</span>${seg('theme', [['light', '밝게'], ['dark', '어둡게'], ['system', '기기 설정']], settings.theme)}</div>
  <div class="sec">${h2('sparkle', 'AI (Gemini)')}<div class="card aibox">
    <div class="field"><label for="ai_keys">${ic('shield')}API 키 <span class="tag">${aiKeys().length}개</span></label><textarea class="in mono" id="ai_keys" rows="3" data-set="aiKeys" placeholder="AIza... , AIza... (쉼표로 여러 개)" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(settings.aiKeys || '')}</textarea></div>
    <p class="hint">쉼표로 여러 개를 넣으면 번갈아 쓰고, 한도가 찬 키는 건너뜁니다. 내 것으로 바꿔 쓰기, 영상 직접 분석, 등장인물 다른 안, 자막 번역에 씁니다.</p>
    <div class="field"><label for="ai_model">${ic('cpu')}모델</label><input class="in mono" id="ai_model" data-set="aiModel" value="${esc(aiModel())}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    ${(settings.aiModels || []).length ? `<div class="chips wrap">${settings.aiModels.map(m => `<button class="chip ${m === aiModel() ? 'on' : ''}" data-act="aiPick" data-v="${esc(m)}">${esc(m)}</button>`).join('')}</div>` : ''}
    <div class="aiacts"><button class="btn sm" data-act="aiClear">${ic('trash')}키 지우기</button><button class="btn sm blue" data-act="aiTest">${ic('checkc')}키 확인·모델</button></div>
    ${settings.ttsModel ? `<p class="hint">내레이션 음성 모델: ${esc(settings.ttsModel)}</p>` : ''}<div id="aiStatus" class="aistat">${(settings.aiCheck || []).map(([ok, t]) => `<div class="${ok ? 'ok' : 'bad'}">${ic(ok ? 'checkc' : 'x')}<span>${esc(t)}</span></div>`).join('')}</div>
    <p class="hint">키는 이 기기에만 저장되며, AI 기능을 쓸 때 대본 내용이나 영상 주소와 함께 Google Gemini API로만 전송됩니다.</p></div></div>
  <div class="sec">${h2('bolt', '자동 입력 (클링·그록·피클)')}${(() => { const info = kInfo(), gi = gInfo(), pi = pInfo(), f = flowNow(), g = grokFlow(), pf = pickleFlow(), nd = klingDumps().length, row = (ok, t) => `<div class="${ok ? 'ok' : 'bad'}">${ic(ok ? 'checkc' : 'x')}<span>${t}</span></div>`; return `<div class="card aibox">
    <div class="aistat">${Native.has() ? row(info && info.on, `접근성 서비스 ${info && info.on ? '켜짐' : '꺼짐'}`) + row(info && info.pkg, info && info.pkg ? `클링 앱: ${esc(info.label || info.pkg)}` : '클링 앱을 찾지 못함') + row(gi && gi.pkg, gi && gi.pkg ? `그록 앱: ${esc(gi.label || gi.pkg)}` : '그록 앱을 찾지 못함') + row(pi && pi.pkg, pi && pi.pkg ? `피클 앱: ${esc(pi.label || pi.pkg)}` : '피클 앱을 찾지 못함') + row(window.AndroidBridge.hasMediaPerm && window.AndroidBridge.hasMediaPerm(), '사진 접근 권한 (그록 이미지 가져오기)') : '<div class="bad">' + ic('x') + '<span>휴대폰 앱에서만 쓸 수 있습니다</span></div>'}
      <div class="${f.verified ? 'ok' : 'bad'}">${ic(f.verified ? 'checkc' : 'info')}<span>클링 순서 ${esc(f.version || '')}${f.verified ? '' : ' · 아직 일부만 맞춰짐'}</span></div>
      <div class="${g.verified ? 'ok' : 'bad'}">${ic(g.verified ? 'checkc' : 'info')}<span>그록 순서 ${esc(g.version || '')}${g.verified ? '' : ' · 아직 그록 화면에 맞춰지지 않음'}</span></div>
      <div class="${pf.verified ? 'ok' : 'bad'}">${ic(pf.verified ? 'checkc' : 'info')}<span>피클 순서 ${esc(pf.version || '')}${pf.verified ? '' : ' · 보내기 버튼 위치는 추측'}</span></div></div>
    ${Native.has() && window.AndroidBridge.hasMediaPerm && !window.AndroidBridge.hasMediaPerm() ? `<button class="btn sm" data-act="mediaPerm">${ic('shield')}사진 접근 허용하기</button>` : ''}
    <div class="aiacts"><button class="btn sm blue" data-act="openAcc">${ic('gear')}접근성 설정</button><button class="btn sm" data-act="openAppInfo">${ic('info')}앱 정보</button></div>
    <p class="hint">켜는 방법: 접근성 설정 > 설치된 앱 > "숏폼 메이커 · 자동 입력" 켜기. 회색으로 막혀 있으면 앱 정보 > 오른쪽 위 ⋮ > "제한된 설정 허용"을 먼저 누르세요.</p>
    <div class="aiacts"><button class="btn sm" data-act="flowFetch">${ic('refresh')}순서 업데이트</button></div>
    <div class="aiacts"><button class="btn sm" data-act="inspect" data-t="kling">${ic('camera')}클링 화면 기록</button><button class="btn sm" data-act="inspect" data-t="grok">${ic('camera')}그록 화면 기록</button><button class="btn sm" data-act="inspect" data-t="pickle">${ic('camera')}피클 화면 기록</button></div>
    ${nd ? `<button class="btn sm blue" data-act="dumpOut">${ic('download')}기록한 화면 ${nd}개 파일로 저장</button>` : ''}
    <p class="hint">"화면 기록"을 누르면 그 앱이 열리고 위쪽에 막대가 뜹니다. 클링은 만들기 화면, 모드 메뉴, 사진 고르는 화면, 생성 뒤 화면에서, 그록은 첫 화면, 프롬프트를 보낸 뒤 이미지가 나온 화면, 이미지를 눌러 연 화면(저장 버튼이 보이는 화면), 피클은 채팅 화면(지시문을 입력한 상태)에서 각각 "이 화면 기록"을 누른 뒤 "끝내기"를 누르세요. 누를 때마다 내 파일 > 다운로드 > ShortFormMaker 폴더의 kling_screens_….json 파일에 자동 저장되니, 그 파일을 보내 주시면 순서를 맞춰 드립니다.</p>
    <p class="hint">클링 앱 화면을 대신 누르는 기능이라 클링 앱이 업데이트되면 멈출 수 있고, 클링 이용약관상 자동 조작이 문제가 될 수 있습니다. 본인 계정에서 본인 책임으로 쓰세요.</p></div>`; })()}</div>
  <div class="sec">${h2('shield', '백업')}<div class="list">
    ${setRow('book', 196, '사용 안내·업로드 점검표', '쓰는 순서와 채널 운영', 'infoGo')}
    ${setRow('download', 218, '모든 작업 백업하기', `작업 ${projects.length}편을 파일 하나로 저장`, 'backup')}
    ${setRow('folder', 150, '백업 파일 불러오기', '같은 작업은 건너뛰고 새 작업만 추가', 'restore')}</div></div>
  <div class="sec">${h2('info', '정보')}<div class="list">
    ${setRow('shield', 262, '개인정보 처리방침', '', 'privacy')}
    <div class="row"><span class="glyph" style="--h:196">${ic('info')}</span><span class="grow"><b>버전</b></span><span class="chev num">${APP_VERSION}</span></div></div></div>` });
V.privacy = () => ({ title: '개인정보 처리방침', back: true, html: `${pageHead({ lead: '숏폼 메이커는 개인정보를 수집하지 않습니다.', icon: 'shield', hue: 262 })}<div class="card" style="display:flex;flex-direction:column;gap:10px">
  <p style="margin:0">작성한 대본, 설정, Gemini API 키는 이 기기 안에만 저장됩니다. 앱을 삭제하면 함께 지워집니다.</p>
  <p style="margin:0">AI 기능은 사용자가 직접 넣은 Gemini API 키로 동작합니다. AI 버튼을 누를 때만 대본 내용이 Google Gemini API로 전송되며, 이 전송에는 Google의 약관과 개인정보 처리방침이 적용됩니다.</p>
  <p style="margin:0">"AI가 직접 보고 분석"을 누르면 그 유튜브 영상의 주소가 Google Gemini API로 전송됩니다.</p>
  <p style="margin:0">유행 영상 목록은 깃허브 공개 저장소의 파일을 읽어 오고, 미리보기 그림은 유튜브 서버에서 불러옵니다. 이때 기기의 정보를 따로 보내지 않으며, 앱 제작자의 서버로는 아무것도 전송되지 않습니다.</p>
  <p style="margin:0">원클릭 제작에 쓰는 자동 입력(접근성) 기능은 클링·그록·피클 앱 화면을 대신 누르는 데만 쓰이고, 화면 내용을 기기 밖으로 보내지 않습니다.</p>
  <p style="margin:0">문의: happyfamily1984.3@gmail.com</p></div>` });

/* ---------- 그리기 ---------- */
const NAV = [['home', '유행', 'flame'], ['library', '보관함', 'folder'], ['make', '만들기', 'plus'], ['chars', '캐릭터', 'users'], ['info', '안내', 'book']];
function render(resetScroll) {
  const c = cur(), r = V[c.v](c.p), view = $('#view'), keep = view.scrollTop;
  $('#nav').hidden = !!r.back;
  $('#top').innerHTML = r.top || `${r.back ? `<button class="ib" data-act="back" aria-label="뒤로">${ic('back')}</button>` : ''}<h1 class="${r.big ? 'big' : ''}">${r.ticon ? `<span class="ticon">${ic(r.ticon)}</span>` : ''}${esc(r.title || '')}</h1>${r.acts || ''}`;
  view.className = r.flush ? 'flush' : ''; view.innerHTML = r.html;
  $('#nav').innerHTML = NAV.map(([v, l, i]) => v === 'make' ? `<button class="nav make" data-act="make" aria-label="새로 만들기"><span>${ic(i)}</span><em>${l}</em></button>` : `<button class="nav ${r.nav === v ? 'on' : ''}" data-act="tab" data-v="${v}">${ic(i)}${l}</button>`).join('');
  view.scrollTop = resetScroll ? 0 : keep;
  $$('textarea.ag', view).forEach(autoGrow);
  hydrateImgs(view);
}
const autoGrow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };

function importBackup(text) {
  try {
    const data = JSON.parse(text), arr = Array.isArray(data) ? data : data.projects; if (!Array.isArray(arr)) throw 0;
    const ids = new Set(projects.map(p => p.id)), cids = new Set(charLib.map(c => c.id)); let n = 0, m = 0;
    arr.forEach(p => { if (p && p.id && !ids.has(p.id) && Array.isArray(p.shots) && Array.isArray(p.chars)) { if (!FM[p.fmt]) p.fmt = 'edu'; projects.push(p); n++; } });
    (data.chars || []).forEach(c => { if (c && c.id && !cids.has(c.id)) { charLib.push(c); m++; } });
    Object.entries(data.images || {}).forEach(([id, v]) => { if (typeof v === 'string' && v.startsWith('data:image')) imgPut(v, id).catch(() => {}); });
    saveProjects(); saveCharLib(); toast(n || m ? `작업 ${n}편, 캐릭터 ${m}명을 불러왔습니다` : '새로 추가할 내용이 없습니다'); render();
  } catch (e) { toast('백업 파일을 읽지 못했습니다'); }
}
let pendingImg = null;
$('#imgFile').addEventListener('change', async e => {
  const f = e.target.files[0], d = pendingImg; e.target.value = ''; pendingImg = null; if (!f || !d) return;
  try {
    if (d.still != null) { if (!draft) return; finOf(draft).stills[d.still] = await imgPut(await shrinkImage(f, 1400)); touch(); render(); return toast(`${+d.still + 1}번 샷 장면 이미지를 넣었습니다`); }
    const c = charTarget(d.ctx, d.ref); if (!c) return;
    const id = await imgPut(await shrinkImage(f, d.kind === 'full' ? 1400 : 1000));
    c[d.kind === 'full' ? 'imgFull' : 'imgFace'] = id;
    if (d.ctx === 'd') touch(); else { c.updated = Date.now(); saveCharLib(); }
    render(); toast(`${KIND_NAME[d.kind]} 사진을 첨부했습니다`);
  } catch (err) { dialog('사진을 저장하지 못했습니다', String(err.message || err), [['닫기', null]]); }
});
$('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => importBackup(r.result); r.readAsText(f); e.target.value = ''; });

/* ---------- 동작 ---------- */
const touch = () => { dirty = true; };
const A = {
  back: () => onBack(),
  go: d => go(d.v, d.id ? { id: d.id } : {}),
  tab: d => tab(d.v),
  mode: d => { settings.mode = d.v; saveSettings(); render(); toast(d.v === 'en' ? '해외용: 영어 프롬프트, 서양권 인물' : '국내용: 한국어 프롬프트, 한국 인물'); },
  make: () => go('make'),
  infoGo: () => tab('info'),
  qclear: () => { cur().p.q = ''; render(); },
  open: d => { if (sel) { sel.has(d.id) ? sel.delete(d.id) : sel.add(d.id); return render(); } openProject(d.id); },
  trendDay: d => { const t = trends(); cur().p.d = d.v; if (!t.days[d.v]) fetchTrends(d.v); else render(true); },
  trendIdea: d => { const t = trends(), day = t.days[cur().p.d || t.dates.find(x => t.days[x])], it = day && day.analysis && day.analysis.summary && day.analysis.summary.ideas[+d.i]; if (!it) return;
    const k = fmtGuess(it.field, ''); go('remix', { sim: 1, topic: noGuess(it.topic), src: srcFrom(it, { title: noGuess(it.title), kind: k, format: '', from: `오늘 만들 주제 · ${FM[k].name}` }) }); },
  trendVideo: d => { const t = trends(), day = t.days[cur().p.d || t.dates.find(x => t.days[x])], v = day && day.videos.find(x => x.id === d.id); if (!v) return; go('remix', { src: srcOfVideo(v, vaOf(day.analysis, v.genre, v.id)) }); },
  linkGo: () => {
    const el = $('#link'), id = ytId(el && el.value); if (!id) return toast('유튜브 영상 링크를 붙여넣어 주세요');
    if (!aiKeys().length && cur().v === 'make') return go('settings');
    const t = trends(); let hit = null;
    for (const dk of Object.keys(t.days)) { const v = t.days[dk].videos.find(x => x.id === id); if (v) { hit = srcOfVideo(v, vaOf(t.days[dk].analysis, v.genre, v.id)); break; } }
    const src = hit || srcFrom({}, { id, url: `https://www.youtube.com/shorts/${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, title: '가져온 영상', from: '링크로 가져온 영상' });
    go('remix', { src }, cur().v === 'make'); if (!src.watched && srcEmpty(src) && aiKeys().length) A.analyzeSrc();
  },
  analyzeSrc: () => { const q = cur().p, s = q && q.src; if (!s || !s.id) return; aiAnalyze(s.id, r => { if (cur().p !== q) return;
    q.src = srcFrom(Object.assign({}, r, { watched: true }), { id: s.id, url: s.url, thumb: s.thumb, title: s.orig && s.title !== '가져온 영상' ? s.title : (r.title_ko || s.title), orig: s.orig, genre: s.genre, kind: s.kind, from: s.from, dur: s.dur, views: s.views });
    Object.keys(q).filter(k => /^c(l)?\d+$/.test(k)).forEach(k => delete q[k]); render(true); toast('영상을 직접 보고 대본과 등장인물을 뽑았습니다'); }); },
  remixLib: d => { if (!charLib.length) return dialog('저장한 캐릭터가 없습니다', '대본의 등장인물 탭에서 "내 캐릭터에 저장"을 누르면 다음부터 여기서 불러올 수 있습니다.', [['닫기', null]]);
    const q = cur().p; sheet('이 자리에 쓸 내 캐릭터', charLib.map(lc => [`${cname(lc)} · ${KINDS[ckind(lc)][0]}${lc.imgFull || lc.imgFace ? ' · 사진 있음' : ''}`, clook(lc) || lc.dk, () => { q['cl' + d.i] = lc.id; render(); }])); },
  remixLibX: d => { delete cur().p['cl' + d.i]; render(); },
  remixGo: () => { if (!aiKeys().length) return go('settings'); aiRemix(cur().p); },
  ideaGo: () => { if (!aiKeys().length) return go('settings'); const p = cur().p; aiIdea(FM[p.fm] ? p.fm : 'edu', (p.idea || '').trim()); },
  charVar: d => aiCharVar(+d.i),
  factOk: d => { const x = draft.facts[+d.i]; x.ok = !x.ok; touch(); render(); },
  factDel: d => { draft.facts.splice(+d.i, 1); touch(); render(); },
  factAdd: () => { draft.facts = draft.facts || []; draft.facts.push({ f: '', q: '', ok: false }); touch(); render(); const el = $$('[data-fact]').pop(); if (el) el.focus(); },
  factSearch: d => { const x = draft.facts[+d.i]; if (!x) return; A.openUrl({ u: 'https://www.google.com/search?q=' + encodeURIComponent(x.q || x.f) }); },
  vname: d => { settings.voice = Object.assign(voiceCfg(), { name: d.v }); saveSettings(); render(); },
  ttsTest: () => { const p = draft, i = p.shots.findIndex((x, n) => narrOf(p, n)), vc = voiceCfg(), text = i >= 0 ? narrOf(p, i) : (isEn() ? 'This is how the narration will sound.' : '내레이션은 이런 목소리로 들어갑니다.');
    if (vc.engine === 'gemini') return aiRun(`${vc.name} 목소리 만드는 중`, token => geminiVoice(text, token), d => { const b = atob(d), n = b.length, a = new Uint8Array(44 + n), v = new DataView(a.buffer), w = (o, t) => [...t].forEach((c, k) => a[o + k] = c.charCodeAt(0));
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n, true);
      for (let k = 0; k < n; k++) a[44 + k] = b.charCodeAt(k); new Audio(URL.createObjectURL(new Blob([a], { type: 'audio/wav' }))).play().catch(() => toast('소리를 재생하지 못했습니다')); }, '보통 5~15초 걸립니다.');
    const r = window.AndroidBridge.ttsTest(text, isEn() ? 'en-US' : 'ko-KR', vc.rate, vc.pitch); if (r && r !== 'ok') dialog('목소리를 재생하지 못했습니다', r, [['닫기', null]]); },
  goOne: () => { cur().p.tab = 'finish'; render(true); oneClick(); },
  openUrl: d => { const u = d.u || ''; if (!/^https:\/\//.test(u)) return; if (Native.has() && window.AndroidBridge.openUrl) window.AndroidBridge.openUrl(u); else window.open(u, '_blank'); },
  set: d => {
    const k = d.k, v = /^-?\d+$/.test(d.v) ? +d.v : d.v;
    if (k === 'mode') return A.mode({ v });
    if (k === 'theme' || k === 'style') { settings[k] = v; saveSettings(); }
    else if (k === 'p_burn' && draft) { finOf(draft).burn = !!v; dirty = true; }
    else if (k === 'p_fsize' && draft) { finOf(draft).size = +v; dirty = true; }
    else if (k === 'p_fpos' && draft) { finOf(draft).pos = parseFloat(d.v); dirty = true; }
    else if (k === 'p_von' || k === 'p_vrate' || k === 'p_veng') { settings.voice = Object.assign(voiceCfg(), k === 'p_von' ? { on: !!v } : k === 'p_veng' ? { engine: d.v } : { rate: parseFloat(d.v) }); saveSettings(); }
    else if (k.startsWith('p_')) { cur().p[k.slice(2)] = v; if (k === 'p_k' || k === 'p_mk') cur().p.g = ''; }
    render(k === 'p_tab');
  },
  blankNew: () => { draft = newProject((cur().p && cur().p.fm) || 'edu'); dirty = true; go('editor', {}, true); },
  save: () => { saveDraft(); render(); },
  copy: d => copyText(d.t),
  settings: () => go('settings'),
  privacy: () => go('privacy'),
  exportOne: () => exportFlow([draft], T(draft)),
  exportPack: () => outSheet('제작 팩', toPack(draft, MODE()), fileName(T(draft), 'txt')),
  pstyle: d => { draft.style = d.v; touch(); render(); },
  genChar: d => { const key = `${d.i}:${d.kind}`, o = cur().p.cp = cur().p.cp || {}; o[key] = 1; render(); Native.share(`${cname(draft.chars[+d.i])} · ${KIND_NAME[d.kind]} 이미지 프롬프트`, promptText(draft, `c:${d.i}:${d.kind}`)); },
  shareAllChars: () => Native.share('등장인물 전신 이미지 프롬프트', draft.chars.map((c, i) => `[${cname(c)}]\n${promptText(draft, `c:${i}:full`)}`).join('\n\n')),
  attachImg: d => { pendingImg = d; $('#imgFile').click(); },
  rmImg: d => { const c = charTarget(d.ctx, d.ref); if (!c) return; c[d.kind === 'full' ? 'imgFull' : 'imgFace'] = ''; if (d.ctx === 'd') touch(); else { c.updated = Date.now(); saveCharLib(); } render(); toast('사진을 뺐습니다'); },
  viewImg: d => imgGet(d.id).then(v => {
    if (!v) return toast('사진을 찾을 수 없습니다');
    layerActs = { i0: () => Native.shareImage(`${d.n}.jpg`, v), i1: () => Native.saveImage(`${d.n}.jpg`, v) };
    layer(`<div class="imgview"><img src="${v}" alt="${esc(d.n)}"><div class="acts"><button class="btn" data-lact="x">${ic('x')}닫기</button><button class="btn" data-lact="i1">${ic('download')}저장</button><button class="btn pri" data-lact="i0">${ic('share')}내보내기</button></div></div>`, true);
  }),
  saveChar: d => {
    const c = draft.chars[+d.i], ex = c.libId && charLib.find(x => x.id === c.libId), now = Date.now();
    if (ex) Object.assign(ex, charFields(c), { updated: now }); else { const lc = Object.assign({ id: 'ch_' + uid(), created: now, updated: now }, charFields(c)); charLib.unshift(lc); c.libId = lc.id; touch(); }
    saveCharLib(); render(); toast(ex ? '내 캐릭터를 업데이트했습니다' : '내 캐릭터에 저장했습니다');
  },
  loadChar: () => {
    if (!charLib.length) return dialog('저장한 캐릭터가 없습니다', '인물 카드의 "내 캐릭터에 저장"을 누르면 다음부터 여기서 불러올 수 있습니다.', [['닫기', null]]);
    sheet('불러올 캐릭터', charLib.map(lc => [`${cname(lc)} · ${ROLE_NAME[lc.r] || '인물'}${lc.imgFull || lc.imgFace ? ' · 사진 있음' : ''}`, clook(lc) || lc.dk, () =>
      sheet(`${cname(lc)}${josa(cname(lc), '을')} 어디에 넣을까요?`, [...draft.chars.map((c, i) => [`${cname(c)} 자리에 넣기`, `${ROLE_NAME[c.r]} · 대본 속 이름도 바뀝니다`, () => putLibChar(i, lc)]),
        ...(draft.chars.length < 4 ? [['새 인물로 추가', '', () => putLibChar(draft.chars.length, lc)]] : [])])]));
  },
  newLibChar: () => { const now = Date.now(), lc = { id: 'ch_' + uid(), r: 'H', k: 'P', nk: '새 캐릭터', ne: 'New Character', dk: '', de: '', imgFull: '', imgFace: '', created: now, updated: now }; charLib.unshift(lc); saveCharLib(); go('char', { id: lc.id }); },
  delLibChar: d => dialog('이 캐릭터를 삭제할까요?', '대본에 이미 넣은 인물은 그대로 남습니다.', [['취소', null], ['삭제', () => { charLib = charLib.filter(c => c.id !== d.id); saveCharLib(); pop(); toast('삭제했습니다'); }, 'pri']]),
  shareLibPrompt: d => { const c = charLib.find(x => x.id === d.id); if (c) Native.share(`${cname(c)} · ${KIND_NAME[d.kind]} 이미지 프롬프트`, charPrompt(libProj(c), 0, MODE(), d.kind)); },
  copyP: d => copyText(promptText(draft, d.k), '프롬프트를 복사했습니다'),
  shareP: d => Native.share(d.t || '프롬프트', promptText(draft, d.k)),
  resetP: d => { delete draft.over[d.k + ':' + MODE()]; touch(); render(); },
  addChar: () => { if (draft.chars.length >= 4) return toast('등장인물은 4까지입니다'); draft.chars.push({ r: draft.chars.length ? 'X' : 'H', k: draft.chars.length ? ckind(draft.chars[0]) : 'P', nk: '새 등장인물', ne: 'New Character', dk: '', de: '' }); touch(); render(); },
  delChar: d => { const i = +d.i; dialog('이 등장인물을 삭제할까요?', `${cname(draft.chars[i])} · 이 등장인물의 대사는 내레이션으로 바뀝니다.`, [['취소', null], ['삭제', () => { draft.chars.splice(i, 1); draft.shots.forEach(s => { if (s.sp === i) s.sp = s.dk || s.de ? NARR : -1; else if (s.sp > i) s.sp--; }); draft.over = {}; touch(); render(); }, 'pri']]); },
  addShot: () => { if (draft.shots.length >= 10) return toast('샷은 10개까지입니다'); draft.shots.splice(Math.max(1, draft.shots.length - 1), 0, blankShot('ms', '')); draft.over = {}; touch(); render(); },
  shotMenu: (d, el) => { const i = +el.closest('.beat').dataset.i, s = draft.shots[i], mv = n => { draft.shots.splice(i + n, 0, draft.shots.splice(i, 1)[0]); draft.over = {}; touch(); render(); };
    sheet(`샷 ${i + 1} · ${beatOf(draft, i)[0]}`, [['AI로 이 샷 다시 쓰기', aiKeys().length ? '3가지 안 중에서 고르기' : '설정에서 Gemini API 키를 넣어야 합니다', () => aiShot(i)],
      [`길이 ${s.sec === 10 ? '5초로' : '10초로'} 바꾸기`, `지금 ${s.sec || 5}초`, () => { s.sec = s.sec === 10 ? 5 : 10; touch(); render(); }],
      ['위로 옮기기', '', () => { if (i > 0) mv(-1); }], ['아래로 옮기기', '', () => { if (i < draft.shots.length - 1) mv(1); }],
      ['이 샷 삭제', '', () => { if (draft.shots.length <= 3) return toast('샷은 최소 3개입니다'); draft.shots.splice(i, 1); draft.over = {}; touch(); render(); }]]); },
  aiAll: () => aiRewriteAll(),
  aiSync: () => aiSync(),
  aiSubs: d => aiSubs(d.v),
  aiUndo: () => { if (!draft._undo) return; applyScript(draft, JSON.parse(draft._undo)); delete draft._undo; draft.ai = false; touch(); render(); toast('AI 전으로 되돌렸습니다'); },
  aiTest: () => aiTest(),
  aiPick: d => { settings.aiModel = d.v; saveSettings(); render(); toast(`모델을 ${d.v}로 바꿨습니다`); },
  aiClear: () => dialog('API 키를 모두 지울까요?', '이 기기에 저장된 키만 지워집니다.', [['취소', null], ['지우기', () => { settings.aiKeys = ''; settings.aiCheck = []; saveSettings(); render(); toast('키를 지웠습니다'); }, 'pri']]),
  subOut: d => outSheet('자막 파일', toSrt(draft, d.v), fileName(T(draft) + '_' + d.v, 'srt'), 'application/x-subrip'),
  trendsFetch: () => fetchTrends(),
  oneClick: () => oneClick(),
  shotKind: d => { const i = +d.i, v = vidShots(draft).filter(x => x !== i); draft.vids = d.v === 'v' ? v.concat(i).sort((a, b) => a - b) : v; touch(); render(); },
  klingFetchOnly: () => {
    if (needPhone()) return; const info = kInfo(); if (klingNeedSetup(info)) return;
    const need = klingPlan(draft).need; if (!need.length) return toast('영상 샷이 모두 들어 있습니다');
    dialog('클링에서 내려받기만 할까요?', `${need.map(i => i + 1).join(', ')}번 샷 영상을 새로 만들지 않고, 클링 작품 목록에서 찾아 내려받습니다. 크레딧이 들지 않습니다. 클링에서 이미 만든 영상이어야 합니다.`, [['취소', null], ['내려받기', () => {
      const f = finOf(draft); f.sent = f.sent || {}; need.forEach(i => { f.sent[i] = Date.now(); }); saveDraft(); startKlingStage(draft);
    }, 'pri']]);
  },
  sentReset: () => dialog('클링 생성 기록을 지울까요?', '이미 클링에 생성 요청한 샷도 다음 원클릭 때 다시 생성합니다. 크레딧이 또 듭니다.', [['취소', null], ['지우기', () => { finOf(draft).sent = {}; touch(); render(); }, 'pri']]),
  grokStills: () => { if (needPhone()) return; const need = stillShots(draft).filter(i => !stillOf(draft, i)); const idx = need.length ? need : stillShots(draft); if (!idx.length) return toast('이미지 샷이 없습니다'); saveDraft(); startGrokStills(draft, idx, true); },
  stillPick: d => { pendingImg = { still: +d.i }; $('#imgFile').click(); },
  stillRegen: d => { if (needPhone()) return; saveDraft(); startGrokStills(draft, [+d.i], true); },
  stillRm: d => { delete finOf(draft).stills[+d.i]; touch(); render(); },
  stillPrompt: d => { const m = MODE(); const t = `${+d.i + 1}번 샷 장면 이미지 프롬프트`; outSheet(t, GROK_PREFIX[m] + stillPrompt(draft, +d.i, m), fileName(t, 'txt')); },
  goFinish: () => { cur().p.tab = 'finish'; render(true); },
  findClips: () => { if (needPhone()) return; if (!window.AndroidBridge.hasMediaPerm()) return dialog('동영상 접근을 허용해 주세요', '내려받은 영상을 찾으려면 접근 권한이 필요합니다.', [['취소', null], ['허용하기', () => window.AndroidBridge.requestMediaPerm(), 'pri']]); const pl = store.get('pipeline', null); const n = findClips(draft, pl && pl.pid === draft.id ? pl.since : Date.now() - 30 * 60e3, stillShots(draft).length ? (klingPlan(draft).need.length ? klingPlan(draft).need : vidShots(draft)) : draft.shots.length, false); if (n) toast(`영상 ${n}개를 가져왔습니다`); },
  pickClips: () => { if (!needPhone()) window.AndroidBridge.pickVideos(); },
  clipMove: d => { const a = finOf(draft).clips, i = +d.i; if (i > 0) { a.splice(i - 1, 0, a.splice(i, 1)[0]); dirty = true; render(); } },
  clipDel: d => { finOf(draft).clips.splice(+d.i, 1); dirty = true; render(); },
  finSet: d => { finOf(draft)[d.k] = d.v; dirty = true; render(); },
  assemble: () => startAssemble(draft, false),
  asmCancel: () => window.AndroidBridge.cancelAssemble(),
  openOut: () => window.AndroidBridge.openVideo(finOf(draft).out),
  uploadOut: () => { if (!needPhone()) uploadOut(draft); },
  upWay: d => { settings.upWay = d.v; saveSettings(); render(); },
  upPlat: d => { const v = upPlats(), on = v.includes(d.v); settings.upPlats = on ? v.filter(x => x !== d.v) : v.concat(d.v); if (!settings.upPlats.length) settings.upPlats = [d.v]; saveSettings(); render(); },
  pickleUp: () => pickleUpload(draft, false),
  pickleCopy: () => copyText(pickleText(draft)),
  klingSend: () => klingSend(),
  openAcc: () => { if (Native.has()) window.AndroidBridge.openAccessibility(); else toast('휴대폰 앱에서만 됩니다'); },
  openAppInfo: () => { if (Native.has()) window.AndroidBridge.openAppInfo(); else toast('휴대폰 앱에서만 됩니다'); },
  flowFetch: () => fetchFlow(),
  inspect: d => { const info = kInfo(); if (!Native.has() || !info || !info.on) return klingNeedSetup(info); window.AndroidBridge.clearKlingDumps(); seenDumps = 0; const t = ['grok', 'pickle'].includes(d.t) ? d.t : 'kling'; const r = window.AndroidBridge.startAutoInspect(t, (t === 'grok' ? grokFlow() : t === 'pickle' ? pickleFlow() : flowNow()).package || ''); if (r !== 'ok') toast(r); },
  grokMake: d => grokMake(d.ctx, d.ref, d.kind),
  mediaPerm: () => window.AndroidBridge.requestMediaPerm(),
  dumpOut: () => { const d = klingDumps(); if (!d.length) return toast('기록한 화면이 없습니다'); Native.save(`kling_screens_${dateStr().replace(/\./g, '')}.json`, 'application/json', JSON.stringify({ app: 'short-form-maker', flow: flowNow().version, screens: d })); },
  lth: d => { const p = cur().p; p.th = d.v || ''; p.fav = false; render(true); },
  lfav: () => { const p = cur().p; p.fav = !p.fav; p.th = ''; render(true); },
  fav: d => { const p = projects.find(x => x.id === d.id); if (!p) return; p.fav = !p.fav; saveProjects(); render(); toast(p.fav ? '즐겨찾기에 넣었습니다' : '즐겨찾기에서 뺐습니다'); },
  rowMenu: d => { const p = projects.find(x => x.id === d.id); if (!p) return;
    sheet(T(p), [['열기', '작업 화면으로', () => openProject(p.id)], [p.fav ? '즐겨찾기 해제' : '즐겨찾기', '', () => A.fav(d)],
      ['복제', '같은 내용으로 새 작업 만들기 (다음 편용)', () => { const c = JSON.parse(JSON.stringify(p)); c.id = uid(); c.ep = (p.ep || 1) + 1; c.created = c.updated = Date.now(); projects.unshift(c); saveProjects(); render(); toast('복제했습니다'); }],
      ['내보내기', '제작 팩, 대본, 자막, 백업', () => exportFlow([p], T(p))],
      ['삭제', '되돌릴 수 없습니다', () => dialog('이 작업을 삭제할까요?', T(p), [['취소', null], ['삭제', () => { projects = projects.filter(x => x.id !== p.id); saveProjects(); render(); toast('삭제했습니다'); }, 'pri']])]]); },
  selStart: () => { sel = new Set(); render(); },
  selAll: () => { const all = $$('#view [data-act="open"]').map(e => e.dataset.id); sel = new Set(sel.size === all.length ? [] : all); render(); },
  selDelete: () => { if (!sel.size) return toast('작업을 선택하세요'); dialog(`작업 ${sel.size}편을 삭제할까요?`, '삭제한 작업은 되돌릴 수 없습니다.', [['취소', null], ['삭제', () => { projects = projects.filter(p => !sel.has(p.id)); saveProjects(); sel = null; render(); toast('삭제했습니다'); }, 'pri']]); },
  selExport: () => { if (!sel.size) return toast('작업을 선택하세요'); exportFlow(projects.filter(p => sel.has(p.id)), `선택 ${sel.size}편`); },
  exportShown: () => { const ids = $$('#view [data-act="open"]').map(e => e.dataset.id); exportFlow(projects.filter(p => ids.includes(p.id)), '보관함'); },
  check: d => { const i = +d.i, a = settings.checks; a.includes(i) ? a.splice(a.indexOf(i), 1) : a.push(i); saveSettings(); render(); },
  checkReset: () => { settings.checks = []; saveSettings(); render(); },
  backup: () => exportFlow(projects, '전체'),
  restore: () => $('#importFile').click()
};
let pressT, pressFired = false;
document.addEventListener('click', e => {
  if (e.target.closest('#layer')) return;
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (pressFired) { pressFired = false; return; }
  if (el.tagName !== 'BUTTON' && e.target.closest('input,textarea,select')) return;
  const fn = A[el.dataset.act]; if (fn) fn(el.dataset, el);
});
function onField(e) {
  const t = e.target, d = t.dataset, isSel = t.tagName === 'SELECT';
  const grow = () => { if (t.classList.contains('ag')) autoGrow(t); };
  if (d.pf) { draft[d.pf] = d.pf === 'ep' ? Math.max(1, parseInt(t.value) || 1) : t.value; touch(); grow(); if (d.pf === 'ep' && e.type === 'change') render(); }
  else if (d.sf) { const [i, f] = d.sf.split(':'), s = draft.shots[+i]; s[f] = f === 'sp' ? +t.value : t.value; if (f === 'sp' && s.sp === -1) s.dk = s.de = ''; ['f', 'k'].forEach(x => ['kr', 'en'].forEach(m => delete draft.over[`${x}:${i}:${m}`])); touch(); grow(); if (isSel) render(); }
  else if (d.lc) { const [id, f] = d.lc.split(':'), c = charLib.find(x => x.id === id); if (c) { c[f] = t.value; c.updated = Date.now(); saveCharLib(); } grow(); if (isSel) render(); }
  else if (d.cf) { const [i, f] = d.cf.split(':'); draft.chars[+i][f] = t.value; if (f === 'k') ['full', 'face'].forEach(x => ['kr', 'en'].forEach(m => delete draft.over[`c:${i}:${x}:${m}`])); touch(); grow(); if (isSel) render(); }
  else if (d.vtone) { settings.voice = Object.assign(voiceCfg(), { tone: t.value }); store.set('settings', settings); }
  else if (d.fact != null) { const x = draft.facts[+d.fact]; if (x) { x.f = t.value; x.q = t.value; x.ok = false; } touch(); grow(); }
  else if (d.ov) { draft.over[d.ov + ':' + MODE()] = t.value; touch(); grow(); }
  else if (d.set) { settings[d.set] = t.value; store.set('settings', settings); }
  else if (d.p) cur().p[d.p] = t.value;
  else if (d.q) { cur().p.q = t.value; clearTimeout(t._t); const id = t.id; t._t = setTimeout(() => { render(); const n = $('#' + id); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 350); }
}
document.addEventListener('input', onField);
document.addEventListener('change', e => { if (e.target.dataset.pf === 'ep') onField(e); const a = e.target.dataset.act2; if (a && A[a]) A[a]({ v: e.target.value }); });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'link') A.linkGo();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape') onBack();
});
document.addEventListener('pointerdown', e => {
  pressFired = false;
  const row = e.target.closest('[data-act="open"]'); if (!row || cur().v !== 'library' || sel) return;
  pressT = setTimeout(() => { pressFired = true; sel = new Set([row.dataset.id]); render(); if (navigator.vibrate) navigator.vibrate(15); }, 480);
});
['pointerup', 'pointercancel', 'pointermove'].forEach(n => document.addEventListener(n, e => { if (n !== 'pointermove' || Math.abs(e.movementY) > 3) clearTimeout(pressT); }));

/* ---------- 시작 ---------- */
applyTheme();
render(true);
setTimeout(gcImages, 3000);
/* 하루에 한 번, 앱을 열 때 유행 영상을 조용히 받아 둔다 */
if (Date.now() - (trends().fetched || 0) > 6 * 3600e3) setTimeout(() => fetchTrends('', true), 400);
