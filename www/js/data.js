/* 숏폼 메이커 기본 데이터
   유행 영상과 분석은 short-form-report 저장소에서 새로고침으로 받아 온다. 이 앱에는 미리 써 둔 대본이 없다. */
'use strict';

/* 영상 종류. hk = 국내용 해시태그, tags = 해외용 해시태그 */
const FORMATS = [
  { id:'skit', name:'상황극·코미디', en:'Comedy Skit', icon:'laugh', hue:28, hk:['상황극','공감','웃긴영상'], tags:['skit','comedy','relatable'] },
  { id:'animal', name:'동물', en:'Animals', icon:'paw', hue:150, hk:['동물','강아지','고양이'], tags:['animals','pets','cute'] },
  { id:'anim', name:'애니·캐릭터', en:'Animation', icon:'game', hue:262, hk:['애니메이션','캐릭터','AI애니'], tags:['animation','cartoon','aianimation'] },
  { id:'story', name:'썰·사연', en:'Storytime', icon:'chat', hue:196, hk:['썰','사연','실화'], tags:['storytime','story','truestory'] },
  { id:'drama', name:'숏드라마', en:'Short Drama', icon:'clapper', hue:350, hk:['숏드라마','사이다','반전'], tags:['shortdrama','drama','plottwist'] },
  { id:'info', name:'정보·꿀팁', en:'Tips', icon:'bulb', hue:42, hk:['꿀팁','정보','생활'], tags:['tips','lifehack','howto'] },
  { id:'etc', name:'기타', en:'Shorts', icon:'film', hue:218, hk:['쇼츠','숏폼'], tags:['shorts','viral'] }
];

/* 장면 흐름 기본 이름 (대본마다 샷이 자기 이름을 따로 가질 수 있다) */
const BEATS = [
  ['훅', 'HOOK', '첫 3초에 시선을 붙잡는 장면.'],
  ['전개', 'SETUP', '무슨 상황인지 한 번에 보여 준다.'],
  ['고조', 'BUILD', '기대나 긴장을 한 단계 올린다.'],
  ['반전', 'TURN', '예상이 뒤집히는 순간.'],
  ['터짐', 'PAYOFF', '웃음·통쾌함·감동이 터지는 가장 강한 장면.'],
  ['마무리', 'OUTRO', '여운이나 다음 편 궁금증을 남긴다.']
];
const MOODS = [
  ['첫 순간에 시선을 붙잡는 강한 장면', 'A striking opening moment that grabs attention'],
  ['상황이 한눈에 들어오는 또렷한 장면', 'A clear moment that sets up the situation at a glance'],
  ['기대와 긴장이 한 단계 올라간다', 'Anticipation and tension step up'],
  ['예상이 뒤집히는 순간, 공기가 바뀐다', 'The moment expectations flip, the air changes'],
  ['감정이 터지는 가장 강한 순간', 'The strongest emotional payoff'],
  ['여운을 남기는 마지막 컷', 'A lingering final beat']
];

/* 카메라 코드 → [이름, 한국어 프롬프트 문구, 영어 프롬프트 문구] */
const CAMS = {
  cu: ['얼굴 클로즈업', '얼굴 클로즈업, 미세한 표정 변화가 보이게', 'Tight close-up on the face, subtle micro-expressions'],
  ms: ['미디엄 샷', '상반신이 보이는 미디엄 샷, 고정 카메라', 'Medium shot of the upper body, locked-off camera'],
  ws: ['와이드 샷', '장소 전체가 보이는 와이드 샷, 고정 카메라', 'Wide establishing shot of the location, locked-off camera'],
  pi: ['천천히 다가감', '주인공 쪽으로 천천히 다가가는 카메라', 'Slow push-in toward the subject'],
  cz: ['급속 줌', '얼굴로 빠르게 치고 들어가는 급속 줌', 'Fast dramatic crash zoom onto the face'],
  ots: ['어깨 너머', '상대 어깨 너머로 잡은 샷', 'Over-the-shoulder shot'],
  low: ['로우앵글', '아래에서 올려다보는 로우앵글', 'Low-angle shot looking up'],
  trk: ['따라가기', '움직이는 주인공을 옆에서 따라가는 트래킹 샷', 'Lateral tracking shot following the moving subject'],
  rx: ['반응 컷', '놀란 주변의 표정을 잡는 반응 컷', 'Reaction cut on surprised onlookers'],
  slo: ['슬로모션', '슬로모션, 털이나 옷자락이 천천히 움직임', 'Slow motion, fur or fabric moving gently']
};

/* 영상 스타일 → [이름, 한국어, 영어] */
const STYLES = {
  real: ['실사', '실사 영화 같은 화면, 얕은 심도, 자연스러운 질감, 부드러운 자연광', 'photorealistic cinematic look, shallow depth of field, natural textures, soft natural light'],
  glossy: ['화려한 드라마', '화려하고 고급스러운 드라마 화면, 따뜻한 금빛 조명, 선명한 색감', 'glossy high-end drama look, warm golden lighting, rich saturated colors'],
  toon3d: ['3D 애니', '부드러운 3D 애니메이션 영화 스타일, 풍부한 표정, 둥글고 귀여운 형태', 'soft stylized 3D animated film style, expressive faces, rounded appealing shapes'],
  cute2d: ['2D 캐릭터', '선이 깔끔한 귀여운 2D 캐릭터 애니메이션, 단순한 형태, 밝은 색', 'clean-line cute 2D character animation, simple shapes, bright colors'],
  webtoon: ['웹툰 애니', '선이 깔끔한 웹툰 애니메이션 스타일, 선명한 색, 셀 셰이딩', 'clean-line webtoon anime style, vivid colors, cel shading']
};

/* 인물 분위기(모드별 기본값). 사람에게만 붙는다 */
const CAST_DEFAULT = { kr: '한국인', en: 'American' };
const ROLE_NAME = { H: '주인공', V: '상대역', A: '조력자', X: '주변 인물' };
/* 등장인물 종류 → [이름, 아이콘, 리포트의 kind 글자] */
const KINDS = { P: ['사람', 'user', '사람'], A: ['동물', 'paw', '동물'], C: ['캐릭터', 'game', '캐릭터'], O: ['사물', 'gift', '사물'] };
const kindCode = k => Object.keys(KINDS).find(c => KINDS[c][2] === String(k || '').trim()) || (KINDS[k] ? k : 'P');
const NEG = { kr: '흐릿함, 얼굴 왜곡, 손가락 기형, 얼굴 바뀜, 옷 바뀜, 털색 바뀜, 화면 속 글자, 자막, 워터마크, 로고, 등장인물 추가, 깜빡임', en: 'blurry, distorted face, deformed hands, extra fingers, face changing, outfit changing, fur color changing, on-screen text, subtitles, watermark, logo, extra characters, flicker' };

/* 닮은 정도 */
const SIMS = [
  [1, '비슷하게', 'Stay close: same format, same kind of characters and a similar setting. Change the names, the looks, the specific events, the punchline wording and every line.'],
  [2, '적당히', 'Balanced: keep the format, the hook type, the beat order and the twist position, but move it to a different setting with clearly different characters and events.'],
  [3, '많이 다르게', 'Loose: borrow only the hook type, the pacing and the shape of the payoff. Everything else (world, characters, events) must be new.']
];

/* 자막 언어 */
const SUB_LANGS = [['ko', '한국어'], ['en', '영어'], ['ja', '일본어'], ['es', '스페인어'], ['pt', '포르투갈어'], ['id', '인도네시아어'], ['th', '태국어'], ['vi', '베트남어'], ['hi', '힌디어'], ['ar', '아랍어'], ['fr', '프랑스어'], ['de', '독일어'], ['zh', '중국어']];

/* 안내 */
const INFO = [
  { id:'how', name:'쓰는 순서', icon:'layers', items:[
    ['뜨는 영상을 고른다', '홈에는 매일 아침 모은 인기 숏폼과 숏드라마가 한국·해외로 나뉘어 있습니다. 조회수와 하루 상승 폭을 보고 내 채널에 맞는 영상을 고릅니다.', '목록에 없는 영상은 가운데 + 버튼에서 유튜브 링크를 붙여 가져옵니다.'],
    ['내 것으로 바꾼다', '원본의 훅, 장면 순서, 반전 자리는 살리고 인물·배경·사건·대사는 새로 씁니다. "닮은 정도"로 얼마나 다르게 쓸지 정하고, 내 소재를 한 줄 적으면 그 배경으로 옮겨 씁니다.', '예: "배경을 편의점으로, 주인공은 야간 알바생"'],
    ['나만의 등장인물을 만든다', '원본에 사람이 나오면 사람, 동물이면 동물, 캐릭터면 캐릭터로 비슷하지만 다른 새 등장인물을 만듭니다. 등장인물 탭에서 생김새를 고치고 "비슷하지만 다른 3안"으로 바꿀 수 있습니다. 등장인물이 없는 영상은 없이 만듭니다.', '마음에 드는 등장인물은 "내 캐릭터에 저장"해 다음 영상에서도 씁니다.'],
    ['원클릭으로 영상을 만든다', '완성 탭의 원클릭 제작이 그록으로 장면 이미지를 만들고, 클링으로 핵심 샷 영상을 만들어 내려받은 뒤, 자막을 넣어 한 편으로 합칩니다.', '처음 한 번은 설정에서 자동 입력(접근성)을 켜야 합니다.'],
    ['올린다', '합친 영상을 유튜브·틱톡·인스타 업로드 화면으로 넘기고 제목·설명·해시태그를 붙여넣습니다.', 'AI 생성 콘텐츠 표시를 꼭 켜세요.']
  ]},
  { id:'formula', name:'숏폼 공식', icon:'flame', items:[
    ['첫 3초가 전부다', '인사나 설명 없이 가장 궁금한 장면에서 시작합니다. 첫 화면만 보고도 "이게 뭐지?"가 나와야 넘기지 않습니다.', '실전: 1샷은 결과나 사건 한가운데를 먼저 보여 줍니다.'],
    ['한 샷에는 동작 하나', '5초 안에 큰 동작과 격한 카메라 이동을 함께 넣으면 화면이 깨집니다. 한 샷에는 눈에 보이는 동작 하나, 짧은 말 한 줄만 둡니다.', '길어지면 샷을 둘로 나눕니다.'],
    ['형식은 빌리고 내용은 새로', '잘된 영상에서 가져올 것은 훅 방식, 장면 순서, 반전 자리, 길이입니다. 인물·대사·제목은 그대로 쓰면 삭제와 경고로 이어집니다.', '이 앱의 바꿔 쓰기는 형식만 남기고 내용을 새로 씁니다.'],
    ['동물·캐릭터는 한 가지 성격으로', '동물이나 캐릭터가 주인공이면 성격 하나(시치미, 겁쟁이, 허당)를 정하고 매 편 같은 생김새로 나오게 합니다. 시청자는 캐릭터를 기억하고 돌아옵니다.', '같은 캐릭터 이미지를 모든 영상에서 참조로 씁니다.'],
    ['마지막은 반응을 부른다', '끝에서 웃음·통쾌함·궁금증 중 하나가 터져야 댓글과 공유가 생깁니다. 마지막 샷을 설명으로 끝내지 않습니다.', '예: 뒤집힌 표정 하나로 끊기.'],
    ['제목은 상황을 그대로', '제목은 은유보다 상황 요약이 잘 됩니다. 누가 무엇을 했는지가 들어가면 됩니다.', '예: "간식 숨긴 강아지의 최후"']
  ]},
  { id:'channel', name:'채널 운영', icon:'road', items:[
    ['새 채널은 천천히 시작한다', '만든 지 얼마 안 된 채널이 하루에 많은 영상을 한꺼번에 올리면 스팸으로 분류되어 노출이 막힐 수 있습니다. 처음 1~2주는 하루 1~2편, 일정한 시간에 올리는 편이 안전합니다.', '기준: 첫 2주 하루 1~2편 → 반응이 잡히면 하루 2~3편.'],
    ['한 채널에는 한 가지 종류', '채널이 무엇을 주는지 알고리즘과 시청자 모두 빨리 알아야 합니다. 처음 30편은 같은 종류(예: 동물 상황극)로 올리세요.', '다른 종류는 반응을 본 뒤 따로 시험합니다.'],
    ['국내용과 해외용 채널은 분리한다', '언어가 섞인 채널은 어느 나라 시청자에게 보여 줄지 정해지지 않습니다. 한국어 채널과 영어 채널을 따로 만들고, 같은 대본을 각 언어판으로 올립니다.', '상단의 국내용·해외용 전환이 이 구분에 맞춰져 있습니다.'],
    ['AI로 만든 영상임을 표시한다', '유튜브, 틱톡, 인스타그램은 사실처럼 보이는 AI 생성 영상에 표시를 요구합니다. 업로드 화면의 "변경되거나 합성된 콘텐츠" 항목을 켜세요.', '플랫폼 정책은 자주 바뀌니 업로드 전에 공식 안내를 확인하세요.'],
    ['반복적인 대량 생산으로 보이지 않게', '틀만 같고 내용이 거의 같은 영상을 대량으로 올리면 수익 창출이 거절될 수 있습니다. 바꿔 쓴 대본도 인물·배경·대사를 내 것으로 한 번 더 고치세요.', '같은 영상을 여러 채널에 그대로 올리지 않습니다.'],
    ['남의 영상·음악·캐릭터를 가져오지 않는다', '다른 영상의 장면, 대사, 제목이나 기존 작품의 캐릭터를 그대로 쓰면 삭제와 채널 경고로 이어집니다. 음악은 플랫폼이 제공하는 음원만 씁니다.', '등장인물을 만들 때 "누구와 닮게"라고 쓰지 않습니다.'],
    ['실존 인물과 브랜드를 쓰지 않는다', '유명인의 얼굴, 실제 회사 이름과 로고는 초상권·상표권 문제가 됩니다.', '인물은 가상의 인물로, 가게와 회사는 가상의 이름으로 만듭니다.'],
    ['지표를 보고 다음 편을 고른다', '조회수보다 시청 지속 시간과 반복 재생을 봅니다. 10편 단위로 가장 잘된 편의 훅과 종류를 다음 10편에 반영합니다.', '첫 3초 이탈이 크면 1샷의 화면과 말을 바꿉니다.']
  ]}
];

/* 업로드 전 점검표 */
const CHECKLIST = [
  '1샷이 인사나 설명 없이 바로 시작한다', '원본과 제목·대사·등장인물이 다르다', '기존 작품의 캐릭터나 실존 인물이 없다', '모든 샷에서 등장인물 생김새가 같다',
  '마지막 샷에 웃음·통쾌함·궁금증 중 하나가 있다', '자막이 화면 버튼에 가리지 않는다', '제목이 상황을 그대로 말한다', 'AI 생성 콘텐츠 표시를 켰다', '남의 음악·브랜드 로고가 없다'
];

/* 자동 입력 순서 기본 주소 (설정에서 바꿀 수 있다) */
const KLING_FLOW_URL_DEFAULT = 'https://raw.githubusercontent.com/happyfamily1984/short-form-maker-app/main/kling/flow.json';
const GROK_FLOW_URL_DEFAULT = 'https://raw.githubusercontent.com/happyfamily1984/short-form-maker-app/main/grok/flow.json';
const PICKLE_FLOW_URL_DEFAULT = 'https://raw.githubusercontent.com/happyfamily1984/short-form-maker-app/main/pickle/flow.json';
