/* 숏폼 메이커 기본 데이터: 교육·과학·다큐멘터리 정보형 숏폼 전용
   유행 영상과 분석은 short-form-report 저장소에서 새로고침으로 받아 온다. 이 앱에는 미리 써 둔 대본이 없다. */
'use strict';

/* 분야. hk = 국내용 해시태그, tags = 해외용 해시태그. style = 이 분야의 기본 영상 스타일 */
const FORMATS = [
  { id:'edu', name:'교육', en:'Education', icon:'bulb', hue:42, style:'motion', hk:['상식','지식','알쓸신잡'], tags:['education','didyouknow','learnontiktok'], ex:'예: 아침에 키가 더 큰 이유' },
  { id:'sci', name:'과학', en:'Science', icon:'rocket', hue:218, style:'sci3d', hk:['과학','우주','과학상식'], tags:['science','space','sciencefacts'], ex:'예: 번개는 왜 지그재그로 칠까' },
  { id:'doc', name:'다큐', en:'Documentary', icon:'film', hue:350, style:'docreal', hk:['다큐','역사','미스터리'], tags:['documentary','history','mystery'], ex:'예: 하루 만에 사라진 도시' }
];

/* 장면 흐름 기본 이름 (대본마다 샷이 자기 이름을 따로 가질 수 있다). 정보형 숏폼의 공식 */
const BEATS = [
  ['훅', 'HOOK', '상식을 뒤집는 질문이나 놀라운 숫자로 3초 안에 붙잡는다.'],
  ['오해', 'MYTH', '사람들이 흔히 믿는 답을 보여 준다.'],
  ['원리', 'HOW', '진짜 이유를 그림 하나로 쉽게 보여 준다.'],
  ['반전', 'TWIST', '"그런데 더 놀라운 건" 한 단계 더 들어간다.'],
  ['핵심', 'PAYOFF', '처음 질문에 한 줄로 답한다.'],
  ['마무리', 'OUTRO', '다음 궁금증이나 질문을 남겨 댓글을 부른다.']
];
const MOODS = [
  ['한눈에 시선을 붙잡는 강렬한 장면', 'A striking opening image that grabs attention instantly'],
  ['익숙하고 평범해 보이는 장면', 'A familiar, ordinary-looking scene'],
  ['원리가 한눈에 보이는 또렷한 설명 장면', 'A crisp explanatory visual where the mechanism is obvious'],
  ['규모가 확 커지는 놀라운 장면', 'A surprising scene where the scale suddenly grows'],
  ['모든 것이 이어지는 깔끔한 정리 장면', 'A clean resolving shot where everything connects'],
  ['여운과 새 궁금증을 남기는 마지막 컷', 'A lingering final shot that raises a new question']
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
  docreal: ['실사 다큐', '자연 다큐멘터리 같은 실사 화면, 사실적인 질감, 자연광, 넓은 풍경과 정밀한 접사', 'photorealistic nature-documentary look, realistic textures, natural light, sweeping vistas and macro detail'],
  sci3d: ['3D 과학 애니', '깔끔한 3D 과학 시각화, 단면도와 반투명 구조, 부드러운 스튜디오 조명, 선명한 색', 'clean 3D science visualization, cutaways and translucent structures, soft studio lighting, vivid colors'],
  motion: ['모션그래픽', '단순한 도형과 아이콘으로 만든 깔끔한 2D 모션그래픽 인포그래픽, 밝고 평평한 색', 'clean flat 2D motion-graphics infographic made of simple shapes and icons, bright flat colors'],
  history: ['역사 재현', '시대 고증을 살린 영화 같은 역사 재현 화면, 따뜻하고 어두운 조명, 필름 질감', 'cinematic historical reenactment, period-accurate details, warm low-key lighting, film grain'],
  illus: ['그림책 일러스트', '부드러운 붓 터치의 그림책 일러스트, 따뜻한 색감', 'soft painterly storybook illustration, warm palette'],
  toon3d: ['3D 캐릭터', '부드러운 3D 애니메이션 영화 스타일, 풍부한 표정, 둥글고 귀여운 형태', 'soft stylized 3D animated film style, expressive faces, rounded appealing shapes']
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
  [1, '같은 주제', 'Same topic, new script: keep the topic, the hook type and the beat order, but write every sentence, example and visual from scratch with a different angle or a fresher example.'],
  [2, '비슷한 주제', 'Sibling topic: keep the format, hook type, beat order, open-loop position and pacing, and move to a closely related but different topic in the same field.'],
  [3, '구성만 빌리기', 'Structure only: borrow only the hook type, the beat order and the pacing. Pick a different topic.']
];

/* 자막 언어 */
const SUB_LANGS = [['ko', '한국어'], ['en', '영어'], ['ja', '일본어'], ['es', '스페인어'], ['pt', '포르투갈어'], ['id', '인도네시아어'], ['th', '태국어'], ['vi', '베트남어'], ['hi', '힌디어'], ['ar', '아랍어'], ['fr', '프랑스어'], ['de', '독일어'], ['zh', '중국어']];

/* 안내 */
const INFO = [
  { id:'how', name:'쓰는 순서', icon:'layers', items:[
    ['뜨는 영상을 고른다', '홈에는 매일 아침 모은 교육·과학·다큐 인기 쇼츠가 한국·해외로 나뉘어 있습니다. 조회수와 하루 상승 폭을 보고 내 채널 분야에 맞는 영상을 고릅니다.', '목록에 없는 영상은 가운데 + 버튼에서 유튜브 링크를 붙여 가져옵니다.'],
    ['주제를 정한다', '잘된 영상의 구성(훅·장면 순서·반전 자리·길이)은 그대로 두고 주제를 내 것으로 바꿉니다. "닮은 정도"로 같은 주제를 새로 쓸지, 비슷한 주제로 옮길지, 구성만 빌릴지 고릅니다.', '예: "번개" 영상의 구성으로 "오로라"를 다루기'],
    ['사실을 확인한다', '정보형 영상은 틀린 사실 하나로 신뢰를 잃습니다. 대본 탭의 "사실 확인"에서 AI가 뽑은 핵심 주장을 하나씩 검색해 보고 체크합니다.', '확인이 어려운 주장은 빼거나 "~라는 연구가 있다"로 낮춥니다.'],
    ['원클릭으로 영상을 만든다', '완성 탭의 원클릭 제작이 그록으로 장면 이미지, 클링으로 핵심 샷 영상을 만들고, 내레이션 음성과 자막을 넣어 한 편으로 합칩니다.', '처음 한 번은 설정에서 자동 입력(접근성)을 켜야 합니다.'],
    ['올린다', '합친 영상을 유튜브·틱톡·인스타 업로드 화면으로 넘기고 제목·설명·해시태그를 붙여넣습니다.', 'AI 생성 콘텐츠 표시를 꼭 켜세요.']
  ]},
  { id:'formula', name:'전략', icon:'flame', items:[
    ['분야는 교육·과학·다큐 하나로', '정보형 영상은 광고 단가가 높고, 얼굴 없이 내레이션과 화면만으로 만들 수 있어 AI 제작과 잘 맞습니다. 채널 하나에는 분야 하나만 두어야 알고리즘이 누구에게 보여 줄지 빨리 압니다.', '실전: 처음 30편은 한 분야(예: 우주 과학)로만 올립니다.'],
    ['잘된 구성을 빌리고 주제는 바꾼다', '터진 영상의 주제 고르는 법, 첫 3초 훅, 장면 순서, 반전 자리는 검증된 틀입니다. 이 틀에 내 주제를 넣으면 실패 확률이 크게 줄어듭니다.', '대사·제목·화면을 그대로 옮기지 않습니다. 같은 사실이라도 문장과 예시는 새로 씁니다.'],
    ['첫 3초는 질문이나 숫자로', '"다들 이렇게 알죠? 사실 틀렸습니다", "지구에서 가장 큰 생물은 동물이 아닙니다"처럼 상식을 뒤집거나 놀라운 숫자를 먼저 던집니다.', '첫 화면은 가장 신기한 장면으로 엽니다.'],
    ['3~5초마다 화면을 바꾼다', '정보형 영상은 말이 길어 화면이 멈추면 바로 넘깁니다. 한 샷은 5초 안에 끝나고 다음 장면으로 넘어가야 합니다.', '이 앱의 대본은 샷마다 화면 하나, 내레이션 한 줄로 쓰입니다.'],
    ['답은 끝에서 준다 (열린 고리)', '"그런데 더 이상한 건"처럼 궁금증을 하나 더 열고 답을 마지막에 줍니다. 끝까지 본 비율이 오르면 노출이 늘어납니다.', '마지막 샷은 첫 질문에 한 줄로 답하고 새 질문 하나를 남깁니다.'],
    ['스타일은 채널 전체에서 하나로', '실사 다큐, 3D 과학 애니, 모션그래픽 중 하나를 정해 모든 영상에 씁니다. 같은 스타일이 쌓이면 썸네일만 보고도 내 채널을 알아봅니다.', '영상 탭의 스타일을 채널마다 고정하세요.'],
    ['시리즈로 묶는다', '"우주의 이상한 사실 3편"처럼 번호를 붙이면 다음 편을 찾아봅니다. 반응이 좋은 주제는 바로 속편을 만듭니다.', '자막·문구 탭의 "몇 편째"를 올리면 제목에 번호가 붙습니다.']
  ]},
  { id:'channel', name:'채널 운영', icon:'road', items:[
    ['새 채널은 천천히 시작한다', '만든 지 얼마 안 된 채널이 하루에 많은 영상을 한꺼번에 올리면 스팸으로 분류되어 노출이 막힐 수 있습니다. 처음 1~2주는 하루 1~2편, 일정한 시간에 올리는 편이 안전합니다.', '기준: 첫 2주 하루 1~2편 → 반응이 잡히면 하루 2~3편.'],
    ['국내용과 해외용 채널은 분리한다', '언어가 섞인 채널은 어느 나라 시청자에게 보여 줄지 정해지지 않습니다. 한국어 채널과 영어 채널을 따로 만들고, 같은 대본을 각 언어판으로 올립니다.', '상단의 국내용·해외용 전환이 이 구분에 맞춰져 있습니다.'],
    ['AI로 만든 영상임을 표시한다', '유튜브, 틱톡, 인스타그램은 사실처럼 보이는 AI 생성 영상에 표시를 요구합니다. 업로드 화면의 "변경되거나 합성된 콘텐츠" 항목을 켜세요. 역사 재현처럼 실제 사건을 AI로 그린 장면은 특히 꼭 표시합니다.', '플랫폼 정책은 자주 바뀌니 업로드 전에 공식 안내를 확인하세요.'],
    ['반복적인 대량 생산으로 보이지 않게', '틀만 같고 내용이 거의 같은 영상을 대량으로 올리면 수익 창출이 거절될 수 있습니다. 주제마다 새 사실과 새 예시를 넣으세요.', '같은 영상을 여러 채널에 그대로 올리지 않습니다.'],
    ['남의 영상·음악·자료화면을 가져오지 않는다', '다른 영상의 장면, 문장, 제목을 그대로 쓰면 삭제와 채널 경고로 이어집니다. 음악은 플랫폼이 제공하는 음원만 씁니다.', '이 앱은 모든 장면을 새로 생성합니다.'],
    ['틀린 정보는 바로 고친다', '댓글로 오류가 지적되면 고정 댓글로 정정하고, 다음 영상에서 바로잡습니다. 신뢰가 쌓인 정보 채널은 구독 전환이 높습니다.', '의학·건강 주제는 단정하지 말고 전문가 상담을 권합니다.'],
    ['지표를 보고 다음 주제를 고른다', '조회수보다 시청 지속 시간과 끝까지 본 비율을 봅니다. 10편 단위로 가장 잘된 편의 훅과 주제를 다음 10편에 반영합니다.', '첫 3초 이탈이 크면 1샷의 화면과 첫 문장을 바꿉니다.']
  ]}
];

/* 업로드 전 점검표 */
const CHECKLIST = [
  '1샷이 질문이나 놀라운 사실로 바로 시작한다', '핵심 사실을 모두 검색해 확인했다', '원본과 제목·문장이 다르다', '3~5초마다 화면이 바뀐다',
  '마지막 샷이 첫 질문에 답하고 새 궁금증을 남긴다', '내레이션과 자막이 맞는다', '자막이 화면 버튼에 가리지 않는다', 'AI 생성 콘텐츠 표시를 켰다', '실존 인물·브랜드·남의 음악이 없다'
];

/* 자동 입력 순서 기본 주소 (설정에서 바꿀 수 있다) */
const KLING_FLOW_URL_DEFAULT = 'https://raw.githubusercontent.com/happyfamily1984/short-form-maker-app/main/kling/flow.json';
const GROK_FLOW_URL_DEFAULT = 'https://raw.githubusercontent.com/happyfamily1984/short-form-maker-app/main/grok/flow.json';
const PICKLE_FLOW_URL_DEFAULT = 'https://raw.githubusercontent.com/happyfamily1984/short-form-maker-app/main/pickle/flow.json';
