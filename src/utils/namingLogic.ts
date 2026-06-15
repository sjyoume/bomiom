// src/utils/namingLogic.ts
import { Solar } from 'lunar-javascript';

// ============================================================================
// 1️⃣ [DB] 81수리성명학 길흉 데이터 및 대법원 불용문자
// ============================================================================
export const SURI_81_DB: Record<number, { isGood: boolean; title: string; desc: string }> = {
  1: { isGood: true, title: "태초격(太初格)", desc: "만물의 시초이며 두령운을 상징합니다." },
  2: { isGood: false, title: "분산격(分散格)", desc: "재액이 따르고 흩어지는 재액운입니다." },
  3: { isGood: true, title: "명예격(名譽格)", desc: "지혜가 뛰어나고 복록이 따르는 길수입니다." },
  4: { isGood: false, title: "부정격(否定格)", desc: "모든 일이 파괴되고 어긋나는 흉수입니다." },
  5: { isGood: true, title: "통어격(通御格)", desc: "명예와 재물을 모두 얻는 대길수입니다." },
  6: { isGood: true, title: "계승격(繼承格)", desc: "조상의 덕을 물려받아 순탄하게 발전합니다." },
  7: { isGood: true, title: "강성격(剛成格)", desc: "독립심이 강하고 만난을 극복하여 발전합니다." },
  8: { isGood: true, title: "발달격(發達格)", desc: "의지가 굳건하고 목표를 향해 전진하는 길수입니다." },
  9: { isGood: false, title: "종국격(終局格)", desc: "모든 것이 불리하게 끝나고 때를 잃는 흉수입니다." },
  10: { isGood: false, title: "귀공격(歸空格)", desc: "노력해도 공허하게 끝나는 허망한 수입니다." },
  11: { isGood: true, title: "갱신격(更新格)", desc: "가문을 일으키고 새롭게 부흥하는 길수입니다." },
  12: { isGood: false, title: "유약격(幼弱格)", desc: "심신이 연약하고 고독하며 근심이 많습니다." },
  13: { isGood: true, title: "총명격(聰明格)", desc: "지혜가 출중하여 큰 뜻을 이루는 길수입니다." },
  14: { isGood: false, title: "이산격(離散格)", desc: "가족과 흩어지고 파괴되는 흉수입니다." },
  15: { isGood: true, title: "통솔격(統率格)", desc: "만인을 이끌고 복수쌍전하는 대길수입니다." },
  16: { isGood: true, title: "덕망격(德望格)", desc: "마음이 너그럽고 재물이 넉넉해집니다." },
  17: { isGood: true, title: "용진격(勇進格)", desc: "어려움을 돌파하여 뜻을 크게 펼칩니다." },
  18: { isGood: true, title: "발전격(發展格)", desc: "이름을 널리 떨치고 크게 융창합니다." },
  19: { isGood: false, title: "성패격(成敗格)", desc: "성공과 실패가 엇갈리고 병악운이 있습니다." },
  20: { isGood: false, title: "공허격(空虛格)", desc: "재주가 있어도 허망하게 끝나는 흉수입니다." },
  21: { isGood: true, title: "자립격(自立格)", desc: "스스로 우뚝 서서 우두머리가 되는 대길수입니다." },
  22: { isGood: false, title: "중절격(中折格)", desc: "초년은 좋으나 중도에 뜻이 꺾이는 수입니다." },
  23: { isGood: true, title: "혁신격(革新格)", desc: "아침 해가 솟듯 왕성하게 발전하는 길수입니다." },
  24: { isGood: true, title: "출세격(出世格)", desc: "맨손으로 큰 재물을 모으는 최고의 재물운입니다." },
  25: { isGood: true, title: "안강격(安康格)", desc: "성품이 온화하고 재물과 명예가 따릅니다." },
  26: { isGood: false, title: "만달격(晩達格)", desc: "파란장장한 영웅운이나 시련이 많습니다." },
  27: { isGood: false, title: "대인격(大人格)", desc: "뜻은 크나 중도에 좌절하기 쉬운 수입니다." },
  28: { isGood: false, title: "풍파격(風波格)", desc: "바다의 험한 파도처럼 파란이 많은 흉수입니다." },
  29: { isGood: true, title: "성공격(成功格)", desc: "지혜와 인덕으로 부귀영화를 누립니다." },
  30: { isGood: false, title: "불측격(不測格)", desc: "길흉을 예측하기 어렵고 불안정한 수입니다." },
  31: { isGood: true, title: "세찰격(世察格)", desc: "의지가 굳세고 지략이 뛰어나 흥가하는 길수입니다." },
  32: { isGood: true, title: "순풍격(順風格)", desc: "순풍에 돛을 단 듯 왕성하게 발전합니다." },
  33: { isGood: true, title: "등용격(登龍格)", desc: "용이 하늘로 오르듯 크게 융성하는 대길수입니다." },
  34: { isGood: false, title: "변란격(變亂格)", desc: "재난이 잇따르고 파멸에 이르는 흉수입니다." },
  35: { isGood: true, title: "태평격(泰平格)", desc: "문예와 학술에 뛰어나고 평안한 길수입니다." },
  36: { isGood: false, title: "영웅격(英雄格)", desc: "파란이 많고 파동이 심한 영웅운입니다." },
  37: { isGood: true, title: "정치격(政治格)", desc: "충실히 노력하여 세상에 출세하는 길수입니다." },
  38: { isGood: true, title: "문예격(文藝格)", desc: "문학이나 예술로 이름을 떨치는 학사운입니다." },
  39: { isGood: true, title: "장성격(將星格)", desc: "위엄과 권위로 만인을 지휘하는 대길수입니다." },
  40: { isGood: false, title: "변화격(變化格)", desc: "변화가 심하고 공허함이 따르는 수입니다." },
  41: { isGood: true, title: "고명격(高名格)", desc: "이름을 높이고 무리를 구제하는 대길수입니다." },
  42: { isGood: false, title: "신고격(辛苦格)", desc: "수난이 많고 고생이 끊이지 않는 흉수입니다." },
  43: { isGood: false, title: "성쇠격(盛衰格)", desc: "흥망성쇠가 교차하고 재물이 흩어집니다." },
  44: { isGood: false, title: "침마격(侵魔格)", desc: "마귀가 침범하듯 파멸로 치닫는 대흉수입니다." },
  45: { isGood: true, title: "대각격(大覺格)", desc: "큰 깨달음을 얻어 세상에 현달하는 길수입니다." },
  46: { isGood: false, title: "미운격(未運格)", desc: "운이 닿지 않아 슬픔과 수심이 많은 수입니다." },
  47: { isGood: true, title: "출세격(出世格)", desc: "때를 만나 세상에 출세하고 뜻을 이룹니다." },
  48: { isGood: true, title: "제중격(濟衆格)", desc: "덕으로 세상을 구제하고 크게 영달합니다." },
  49: { isGood: false, title: "변화격(變化格)", desc: "성패의 변화가 심하여 예측하기 어렵습니다." },
  50: { isGood: false, title: "상반격(相半格)", desc: "길과 흉이 반반 섞여 운세가 불안정합니다." },
  51: { isGood: false, title: "길흉격(吉凶格)", desc: "성공과 실패가 엇갈리는 수입니다." },
  52: { isGood: true, title: "승룡격(昇龍格)", desc: "때를 타고 오르는 용처럼 발전하는 길수입니다." },
  53: { isGood: false, title: "내허격(內虛格)", desc: "겉은 화려하나 속은 비어있는 반길반흉의 수입니다." },
  54: { isGood: false, title: "무공격(無功格)", desc: "공로가 없고 집안이 기우는 흉수입니다." },
  55: { isGood: false, title: "미달격(未達格)", desc: "목적에 도달하지 못하고 매사 불안합니다." },
  56: { isGood: false, title: "한탄격(恨歎格)", desc: "패망과 한탄이 끊이지 않는 흉수입니다." },
  57: { isGood: true, title: "봉시격(逢時格)", desc: "좋은 때를 만나 강성하게 발전합니다." },
  58: { isGood: true, title: "선곤격(先困格)", desc: "처음에는 곤란하나 나중에는 복을 받는 수입니다." },
  59: { isGood: false, title: "재화격(災禍格)", desc: "재화가 따르고 뜻을 이루기 힘든 흉수입니다." },
  60: { isGood: false, title: "동요격(動搖格)", desc: "기초가 흔들리고 재난이 따르는 수입니다." },
  61: { isGood: true, title: "이지격(理智格)", desc: "이치와 지혜가 뛰어나 재물을 얻는 길수입니다." },
  62: { isGood: false, title: "화락격(花落格)", desc: "꽃이 떨어지듯 운세가 쇠퇴하는 흉수입니다." },
  63: { isGood: true, title: "순성격(順成格)", desc: "모든 일이 순조롭게 성취되고 발전합니다." },
  64: { isGood: false, title: "봉상격(逢霜格)", desc: "서리를 만난 듯 운세가 쇠퇴하고 멸망합니다." },
  65: { isGood: true, title: "휘양격(輝陽格)", desc: "햇빛이 빛나듯 가문을 크게 일으킵니다." },
  66: { isGood: false, title: "암야격(暗夜格)", desc: "어두운 밤처럼 앞길이 막막하고 빛을 잃습니다." },
  67: { isGood: true, title: "천복격(天福格)", desc: "하늘의 복을 받아 막힘없이 영달하는 길수입니다." },
  68: { isGood: true, title: "명지격(明智格)", desc: "밝은 지혜로 새로운 것을 발명하고 성취합니다." },
  69: { isGood: false, title: "종말격(終末格)", desc: "모든 것이 정지되고 종말을 고하는 흉수입니다." },
  70: { isGood: false, title: "공허격(空虛格)", desc: "어두운 밤처럼 헛되고 공허한 흉수입니다." },
  71: { isGood: true, title: "현룡격(見龍格)", desc: "용이 모습을 드러내듯 발전하는 길수입니다." },
  72: { isGood: false, title: "상반격(相半格)", desc: "길흉이 겹치며 후반기에는 곤란을 겪습니다." },
  73: { isGood: true, title: "평길격(平吉格)", desc: "평범한 가운데 안락하게 지내는 무난한 수입니다." },
  74: { isGood: false, title: "우매격(愚昧格)", desc: "지혜가 부족하여 불우한 삶을 사는 흉수입니다." },
  75: { isGood: true, title: "적시격(適時格)", desc: "때에 맞춰 나아가고 물러서며 평화롭습니다." },
  76: { isGood: false, title: "선곤격(先困格)", desc: "처음엔 곤란하고 나중엔 성대해지나 기복이 큽니다." },
  77: { isGood: true, title: "전후격(前後格)", desc: "전후로 길흉이 교차하나 점진적으로 발전합니다." },
  78: { isGood: true, title: "선길격(先吉格)", desc: "처음은 좋으나 나중엔 평범해지는 길수입니다." },
  79: { isGood: false, title: "종국격(終局格)", desc: "모든 것이 불리하게 끝나고 종말을 맞습니다." },
  80: { isGood: false, title: "종극격(終極格)", desc: "은둔하고 쓸쓸하게 여생을 보내는 흉수입니다." },
  81: { isGood: true, title: "환원격(還元格)", desc: "가장 성대하고 만물이 다시 시작되는 대길수입니다." }
};

export const BAD_HANJA_LIST = [
  '甲','江','介','庚','卿','季','桂','坤','鑛','光','龜','九','貴','國','菊','極','根','錦','琴','今','吉',
  '蘭','南','男','大','挑','乭','童','東','冬','了','連','蓮','馬','滿','萬','末','梅','命','明','武','默',
  '美','未','敏','法','炳','秉','柄','丙','寶','福','峰','鳳','富','分','粉','芬','紛','四','山','三','霜',
  '生','錫','石','仙','先','雪','星','聖','笑','松','壽','洙','淑','順','勝','植','伸','新','心','實','時',
  '岳','岩','良','愛','女','榮','英','泳','烈','禮','五','玉','沃','完','王','外','龍','雨','雲','元','遠',
  '月','銀','義','二','伊','貳','寅','仁','一','日','任','子','宰','載','栽','哉','裁','在','長','占','點',
  '珠','竹','中','仲','地','眞','珍','鎭','昌','千','天','鐵','秋','春','忠','初','七','八','兎','泰','平',
  '風','豊','夏','鶴','海','幸','好','虎','紅','花','鎬','華','勳','孝','香','姬','喜','嬉','僖','熙'
];

// ============================================================================
// 2️⃣ [함수] 발음/종성 오행 판별 로직
// ============================================================================
const getElementFromChar = (char: string) => {
  const CHO_SEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return null; 
  const cho = CHO_SEONG[Math.floor(code / 588)];

  if (['ㄱ', 'ㅋ', 'ㄲ'].includes(cho)) return '목';
  if (['ㄴ', 'ㄷ', 'ㄹ', 'ㅌ', 'ㄸ'].includes(cho)) return '화';
  if (['ㅇ', 'ㅎ'].includes(cho)) return '토';
  if (['ㅅ', 'ㅈ', 'ㅊ', 'ㅆ', 'ㅉ'].includes(cho)) return '금';
  if (['ㅁ', 'ㅂ', 'ㅍ', 'ㅃ'].includes(cho)) return '수';
  return null;
};
export const getSoundElement = (char: string) => getElementFromChar(char) || '-';

const checkElementsHarmony = (el1: string, el2: string) => {
  if (el1 === el2) return true; 
  const sangSaeng = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const reverseSaeng = { '화': '목', '토': '화', '금': '토', '수': '금', '목': '수' };
  if (sangSaeng[el1 as keyof typeof sangSaeng] === el2) return true;
  if (reverseSaeng[el1 as keyof typeof reverseSaeng] === el2) return true;
  return false; 
};

// ============================================================================
// 3️⃣ [NEW 엔진] 정통 명리 병(病)과 약(藥) 진단 알고리즘 (조후 & 억부)
// ============================================================================
const STEM_ELEMENTS: Record<string, string> = { '갑': '목', '을': '목', '병': '화', '정': '화', '무': '토', '기': '토', '경': '금', '신': '금', '임': '수', '계': '수' };
const BRANCH_ELEMENTS: Record<string, string> = { '인': '목', '묘': '목', '사': '화', '오': '화', '신': '금', '유': '금', '해': '수', '자': '수', '진': '토', '술': '토', '축': '토', '미': '토' };
const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// 억부 로직: 일간을 돕는 '내 편'의 오행
const SUPPORTING_ELEMENTS: Record<string, string[]> = {
  '목': ['목', '수'], '화': ['화', '목'], '토': ['토', '화'], '금': ['금', '토'], '수': ['수', '금']
};

// 1. 신강/신약 판별기
const calculateSajuPower = (saju8Chars: string[], dayMasterElement: string) => {
  let mySideScore = 0;   
  let otherSideScore = 0; 
  const mySideElements = SUPPORTING_ELEMENTS[dayMasterElement] || [];

  saju8Chars.forEach((char, index) => {
    if (index === 2) return; // 일간(나 자신) 제외
    const element = index < 4 ? STEM_ELEMENTS[char] : BRANCH_ELEMENTS[char];
    if (!element) return;

    // 월지(태어난 달, index 5)는 계절이므로 30점, 나머지는 10점의 가중치
    const weight = (index === 5) ? 30 : 10;
    if (mySideElements.includes(element)) mySideScore += weight;
    else otherSideScore += weight;
  });

  let powerType = '중화';
  if (mySideScore > otherSideScore + 10) powerType = '신강';
  else if (otherSideScore > mySideScore + 10) powerType = '신약';

  return powerType;
};

// 2. 조후/억부 용신(1순위 약) 및 희신(2순위 약) 도출기
const findYongshinAndHeeshin = (dayMasterElement: string, monthBranch: string, powerType: string) => {
  const isWinter = ['해', '자', '축'].includes(monthBranch);
  const isSummer = ['사', '오', '미'].includes(monthBranch);

  let yongshin = ''; let heeshin = ''; let reason = '';

  // 규칙 1: 조후 (온도가 최우선)
  if (isWinter) {
    yongshin = '화'; heeshin = '목';
    reason = `만물이 꽁꽁 얼어붙은 한겨울(${monthBranch}월)에 태어났습니다. 차가운 사주를 따뜻하게 녹여줄 태양의 기운 '화(火)'와 이를 계속 타오르게 돕는 '목(木)'의 기운이 최우선으로 필요합니다.`;
  } else if (isSummer) {
    yongshin = '수'; heeshin = '금';
    reason = `뜨거운 열기가 가득한 한여름(${monthBranch}월)에 태어났습니다. 사주의 열기를 시원하게 식혀줄 '수(水)'와 마르지 않는 수원이 되어줄 '금(金)'의 기운이 최우선으로 필요합니다.`;
  } 
  // 규칙 2: 억부 (세력의 균형)
  else {
    if (powerType === '신약') {
      const medicineForWeak: Record<string, string[]> = {
        '목': ['수', '목'], '화': ['목', '화'], '토': ['화', '토'], '금': ['토', '금'], '수': ['금', '수']
      };
      yongshin = medicineForWeak[dayMasterElement][0]; heeshin = medicineForWeak[dayMasterElement][1];
      reason = `타고난 본성인 '${dayMasterElement}'의 기운이 주변 세력에 비해 다소 억눌려(신약) 있으므로, 기운을 든든하게 북돋아 줄 '${yongshin}'와 '${heeshin}'의 기운을 보완하여 흔들리지 않는 뿌리를 만들어야 합니다.`;
    } else {
      const medicineForStrong: Record<string, string[]> = {
        '목': ['화', '금'], '화': ['토', '수'], '토': ['금', '목'], '금': ['수', '화'], '수': ['목', '토']
      };
      yongshin = medicineForStrong[dayMasterElement][0]; heeshin = medicineForStrong[dayMasterElement][1];
      reason = `타고난 본성인 '${dayMasterElement}'의 기운이 넘치도록 강성(신강)하여 자칫 흐름이 막힐 수 있으므로, 에너지를 아름답게 발산하고 다듬어줄 '${yongshin}'와 '${heeshin}'의 기운을 보완해야 큰 그릇이 됩니다.`;
    }
  }
  return { yongshin, heeshin, reason };
};

// ============================================================================
// 🔮 사주 분석 API 연동부 (한글 추출 및 엔진 연결)
// ============================================================================
const getHourBranch = (hour: number, minute: number) => {
  const time = hour + minute / 60;
  if (time >= 23.5 || time < 1.5) return '자';
  if (time >= 1.5 && time < 3.5) return '축';
  if (time >= 3.5 && time < 5.5) return '인';
  if (time >= 5.5 && time < 7.5) return '묘';
  if (time >= 7.5 && time < 9.5) return '진';
  if (time >= 9.5 && time < 11.5) return '사';
  if (time >= 11.5 && time < 13.5) return '오';
  if (time >= 13.5 && time < 15.5) return '미';
  if (time >= 15.5 && time < 17.5) return '신';
  if (time >= 17.5 && time < 19.5) return '유';
  if (time >= 19.5 && time < 21.5) return '술';
  return '해';
};

const getHourStem = (dayStem: string, hourBranch: string) => {
  const dayIndex = STEMS.indexOf(dayStem) % 5; 
  const startStems = ['갑', '병', '무', '경', '임']; 
  const startStemIndex = STEMS.indexOf(startStems[dayIndex]);
  const branchIndex = BRANCHES.indexOf(hourBranch);
  return STEMS[(startStemIndex + branchIndex) % 10];
};

export const analyzeSaju = async (date: string, time: string) => {
  const elementsCount: Record<string, number> = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };

  try {
    const [year, month, day] = date.split('-');
    const BACKEND_URL = "https://bomiom-saju-server-696394582537.asia-northeast3.run.app";
    const url = `${BACKEND_URL}/api/saju?solYear=${year}&solMonth=${month}&solDay=${day}`;
    
    const response = await fetch(url);
    const data = await response.json();
    const item = data?.item || data?.response?.body?.items?.item; 
    
    if (!item) throw new Error("천문연구원 데이터를 찾을 수 없습니다.");

    const extractHangul = (str: string) => str ? str.replace(/[^가-힣]/g, '') : "모름";
    const yearStr = extractHangul(item.lunSecha);
    const monthStr = extractHangul(item.lunWolgeon);
    const dayStr = extractHangul(item.lunIljin);

    const yearStem = yearStr.charAt(0); const yearBranch = yearStr.charAt(1);
    const monthStem = monthStr.charAt(0); const monthBranch = monthStr.charAt(1);
    const dayStem = dayStr.charAt(0); const dayBranch = dayStr.charAt(1);

    const [hourStr, minStr] = time ? time.split(':') : ['12', '00'];
    const hourBranch = getHourBranch(parseInt(hourStr), parseInt(minStr));
    const hourStem = getHourStem(dayStem, hourBranch);

    const saju8Chars = [yearStem, monthStem, dayStem, hourStem, yearBranch, monthBranch, dayBranch, hourBranch];
    
    saju8Chars.forEach((char, index) => {
      const element = index < 4 ? STEM_ELEMENTS[char] : BRANCH_ELEMENTS[char];
      if (element) elementsCount[element] += 1;
    });

    // 🌟 엔진 가동: 용신/희신 처방전 발행
    const dayMasterElement = STEM_ELEMENTS[dayStem];
    const powerType = calculateSajuPower(saju8Chars, dayMasterElement);
    const prescription = findYongshinAndHeeshin(dayMasterElement, monthBranch, powerType);

    return {
      isSajuAvailable: true,
      elementsCount,
      yongshin: prescription.yongshin,
      heeshin: prescription.heeshin,
      prescriptionReason: prescription.reason,
      solarDate: date,
      lunarDate: `${item.lunYear}년 ${item.lunMonth}월 ${item.lunDay}일`,
      saju8Chars: `${yearStem}${yearBranch}년 ${monthStem}${monthBranch}월 ${dayStem}${dayBranch}일 ${hourStem}${hourBranch}시`,
    };

  } catch (error: any) {
    console.error("사주 분석 실패:", error);
    throw error; 
  }
};

// ============================================================================
// 4️⃣ [함수] 소리음양 및 발음 분석
// ============================================================================
const getSoundYinYang = (char: string) => {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return null; 
  const jungseong = Math.floor(code / 28) % 21;
  const yangVowels = [0, 1, 2, 3, 8, 9, 10, 11, 12];
  return yangVowels.includes(jungseong) ? '양' : '음';
};

const getJongseongElement = (char: string) => {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return null;
  const jongIdx = code % 28;
  if (jongIdx === 0) return null;
  const JONG_SEONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const jong = JONG_SEONG[jongIdx];
  if (['ㄱ','ㄲ','ㅋ','ㄳ','ㄺ'].includes(jong)) return '목';
  if (['ㄴ','ㄷ','ㄹ','ㅌ','ㄵ','ㄶ','ㄾ','ㅀ'].includes(jong)) return '화';
  if (['ㅇ','ㅎ'].includes(jong)) return '토';
  if (['ㅅ','ㅆ','ㅈ','ㅊ','ㄽ'].includes(jong)) return '금';
  if (['ㅁ','ㅂ','ㅍ','ㅄ','ㄻ','ㄼ','ㄿ'].includes(jong)) return '수';
  return null;
};

const analyzePronunciationHarmony = (name0: string, name1: string, name2: string) => {
  const cho0 = getElementFromChar(name0); const jong0 = getJongseongElement(name0);
  const cho1 = getElementFromChar(name1); const jong1 = getJongseongElement(name1);
  const cho2 = getElementFromChar(name2);
  if (!cho0 || !cho1 || !cho2) return { isGood: false, desc: "한글 이름이 아닙니다." };

  const isGoodPair = (c1: string, j1: string | null, c2: string) => {
    if (checkElementsHarmony(c1, c2)) return true; 
    if (j1 && checkElementsHarmony(c1, j1) && checkElementsHarmony(j1, c2)) return true;
    return false;
  };

  const harmony1 = isGoodPair(cho0, jong0, cho1);
  const harmony2 = isGoodPair(cho1, jong1, cho2);

  if (harmony1 && harmony2) return { isGood: true, desc: "막힘없이 상생하여 대인운과 성공운이 아주 좋은 발음입니다. ✅" };
  else if (!harmony1 && !harmony2) return { isGood: false, desc: "소리의 흐름이 전체적으로 단절되어 파란이 예상됩니다. 🚨" };
  else return { isGood: false, desc: "소리의 흐름에 약간의 부딪힘이 있어 아쉽습니다. ⚠️" };
};

// ============================================================================
// 🏆 5️⃣ [최종 평가기] 용신/희신 처방 확인 로직 완벽 적용
// ============================================================================
export const evaluateName = (
  familyName: string, famStrokes: number,
  name1: string, n1Strokes: number, n1Element: string,
  name2: string, n2Strokes: number, n2Element: string,
  sajuInfo: any
) => {
  let totalScore = 100;
  const reports = [];

  // [엔진 처방 사유서 출력] UI에 뿌려주기 위해 맨 위에 추가합니다.
  if (sajuInfo?.prescriptionReason) {
    reports.push(`[✨ AI 명리 처방전] ${sajuInfo.prescriptionReason}`);
  }

  // 1. 불용문자 필터
  const usedBadHanja = [name1, name2].filter(char => BAD_HANJA_LIST.includes(char as string));
  if (usedBadHanja.length > 0) {
    totalScore -= 30;
    reports.push(`[불용문자] 이름에 쓰면 흉하다고 알려진 한자('${usedBadHanja.join(', ')}')가 포함되어 운세가 꺾일 수 있습니다. 🚨`);
  }

  // 2. 사주 보완 (용신/희신 처방) 평가 ★★★
  if (sajuInfo?.yongshin && sajuInfo?.heeshin) {
    const { yongshin, heeshin } = sajuInfo;
    const nameElements = [n1Element, n2Element];

    if (n1Element === n2Element) {
      totalScore -= 20; // 목목, 화화 등 겹치면 치명적 감점!
      reports.push(`[자원오행 편중] 이름 두 글자의 기운이 [${n1Element}] 하나로 겹쳐있습니다. 고인 물은 썩듯이 기운이 정체되므로 개운(開運)에 매우 불리합니다. 🚨 (-20점)`);
    } else if (nameElements.includes(yongshin) && nameElements.includes(heeshin)) {
      totalScore += 20;
      reports.push(`[사주맞춤 대길] 사주의 핵심 약(藥)인 '${yongshin}'(용신)과 '${heeshin}'(희신)을 이름에 완벽하게 담아내어, 아기의 막힌 운로가 크게 열립니다. ✨ (+20점)`);
    } else if (nameElements.includes(yongshin)) {
      totalScore += 10;
      reports.push(`[사주맞춤 길] 사주의 뼈대를 세워줄 가장 시급한 '${yongshin}'(용신)의 기운을 보완하여 운세의 흐름이 한결 부드러워집니다. ✅ (+10점)`);
    } else if (nameElements.includes(heeshin)) {
      totalScore += 5;
      reports.push(`[사주맞춤 무난] 사주의 약점을 돕는 '${heeshin}'(희신)의 기운을 품고 있어 아기의 성장에 긍정적인 보탬이 됩니다. ✅ (+5점)`);
    } else {
      totalScore -= 10;
      reports.push(`[사주보완 실패] 사주에 꼭 필요한 '${yongshin}' 또는 '${heeshin}' 기운이 이름에 반영되지 않아, 사주의 병(病)을 치료하기엔 아쉽습니다. ⚠️ (-10점)`);
    }
  }

  // 3. 발음오행 분석
  const soundAnalysis = analyzePronunciationHarmony(familyName, name1, name2);
  reports.push(`[발음오행] ${soundAnalysis.desc}`);
  if (!soundAnalysis.isGood) totalScore -= 10;

  // 4. 81수리 (원형이정) 분석
  const won = n1Strokes + n2Strokes; const hyeong = famStrokes + n1Strokes;
  const i = famStrokes + n2Strokes; const jeong = famStrokes + n1Strokes + n2Strokes;
  const suriResults = [
    { name: '초년운', val: won, res: SURI_81_DB[won] || { isGood: true, title: "평길(平吉)", desc: "무난" } },
    { name: '청년운', val: hyeong, res: SURI_81_DB[hyeong] || { isGood: true, title: "평길(平吉)", desc: "무난" } },
    { name: '중년운', val: i, res: SURI_81_DB[i] || { isGood: true, title: "평길(平吉)", desc: "무난" } },
    { name: '말년운(총운)', val: jeong, res: SURI_81_DB[jeong] || { isGood: true, title: "평길(平吉)", desc: "무난" } },
  ];

  let badSuriCount = 0;
  suriResults.forEach(r => {
    if (!r.res.isGood) {
      badSuriCount++;
      totalScore -= (r.name === '말년운(총운)') ? 20 : 10;
    }
  });
  if (badSuriCount === 0) reports.push(`[81수리] 초/청/중/말년의 4가지 운이 모두 대길(大吉)한 완벽한 획수입니다. ✅`);
  else reports.push(`[81수리] ${badSuriCount}개의 시기에 흉(凶)수리가 있습니다. 개운을 위해 획수 변경을 권장합니다. ⚠️`);

  // 5. 수리음양 분석
  const strokeYinYang = [famStrokes, n1Strokes, n2Strokes].map(s => s % 2 === 0 ? '음' : '양');
  if (strokeYinYang[0] === strokeYinYang[1] && strokeYinYang[1] === strokeYinYang[2]) {
    totalScore -= 15;
    reports.push(`[수리음양] 획수가 모두 '${strokeYinYang[0]}'으로 치우쳐 흉(凶)합니다. 🚨 (-15점)`);
  } else {
    reports.push(`[수리음양] 획수의 음양(${strokeYinYang.join(', ')})이 음양의 완벽한 조화를 이룹니다. ✅`);
  }

  // 6. 소리음양 분석
  const soundY0 = getSoundYinYang(familyName); const soundY1 = getSoundYinYang(name1); const soundY2 = getSoundYinYang(name2);
  if (soundY0 && soundY1 && soundY2) {
    const soundYinYang = [soundY0, soundY1, soundY2];
    if (soundYinYang.every(val => val === soundYinYang[0])) {
      totalScore -= 5;
      reports.push(`[소리음양] 이름의 모음이 모두 '${soundYinYang[0]}'의 소리라 약간의 치우침이 있습니다. ⚠️`);
    } else {
      reports.push(`[소리음양] 소리의 밝고 어두움(${soundYinYang.join(', ')})이 이상적으로 배합되었습니다. ✅`);
    }
  }

  return {
    rawScore: totalScore, 
    score: Math.min(100, Math.max(0, totalScore)), // 화면엔 100점 만점으로 표기
    suriDetails: suriResults,
    suriSummary: `총합 ${jeong}획 ${suriResults[3].res.title}`,
    reports,
    prescriptionReason: sajuInfo?.prescriptionReason || ""
  };
};

// ============================================================================
// 🤖 6️⃣ [AI 작명 엔진] 용신/희신 저격수(Sniper) 모드 탑재
// ============================================================================
export const generatePerfectNames = (
  familyName: string, famStrokes: number, 
  sajuInfo: any, 
  hanjaDB: Record<string, any[]>,
  namingStyle: 'TRENDY' | 'CLASSIC',
  gender: 'M' | 'F' | null
) => {
  const recommendations: any[] = [];
  const usedNames = new Set<string>();

  const boySyllables = ['준','우','건','도','현','재','율','승','원','태','호','진','결','겸','찬','단','이','시','수','유','민','지','빈','은','해','솔','안','선','경','영','희'];
  const girlSyllables = ['서','지','윤','예','아','하','연','수','유','다','소','빈','주','솔','설','루','리','나','희','린','솜','봄','채','우','현','민','은','진','원','율','해','안','재','이','선','경','영'];

  const modernSyllables = gender === 'M' ? boySyllables : girlSyllables;
  const allChars = Object.keys(hanjaDB).filter(c => c.length === 1 && /[가-힣]/.test(c));
  const searchPool = namingStyle === 'TRENDY' ? modernSyllables : allChars;

  const yongshin = sajuInfo?.yongshin;
  const heeshin = sajuInfo?.heeshin;

  let highestScore = -1;
  let bestFallback: any = null;

  const findNamesWithTargetScore = (targetScore: number, targetCount: number) => {
    const shuffled1 = [...searchPool].sort(() => 0.5 - Math.random());
    const shuffled2 = [...searchPool].sort(() => 0.5 - Math.random());

    for (const char1 of shuffled1) {
      if (!hanjaDB[char1]) continue;
      for (const char2 of shuffled2) {
        if (!hanjaDB[char2]) continue;
        const fullName = char1 + char2;
        if (usedNames.has(fullName)) continue;

        let bestMatch: any = null;
        let matchScore = -1;

        for (const h1 of hanjaDB[char1]) {
          // 🔥 대법원 데이터의 is_unlucky 활용 (이중 필터링으로 완벽 차단)
          if (h1.is_unlucky !== "Normal" || BAD_HANJA_LIST.includes(h1.hanja)) continue;
          
          for (const h2 of hanjaDB[char2]) {
            if (h2.is_unlucky !== "Normal" || BAD_HANJA_LIST.includes(h2.hanja)) continue;

            // 🌟 저격수 로직 (새로운 키 element_jayeon 사용)
            if (targetScore >= 100 && yongshin && heeshin) {
              const hasYongshin = (h1.element_jayeon === yongshin || h2.element_jayeon === yongshin);
              const hasHeeshin = (h1.element_jayeon === heeshin || h2.element_jayeon === heeshin);
              if (!(hasYongshin && hasHeeshin)) continue; 
            }

            // 🌟 평가기 호출 (새로운 키 won_strokes, element_jayeon 사용)
            const result = evaluateName(
              familyName, famStrokes, 
              char1, h1.won_strokes, h1.element_jayeon, 
              char2, h2.won_strokes, h2.element_jayeon, 
              sajuInfo
            );

            if (result.rawScore >= targetScore && result.rawScore > matchScore) {
              matchScore = result.rawScore;
              bestMatch = { 
                firstName: fullName, hanja1: h1, hanja2: h2, 
                score: result.score, 
                reason: result.reports.find(r => r.includes('사주맞춤 대길')) || "음양오행과 수리가 완벽히 조화된 이름입니다." 
              };
            }

            if (result.rawScore > highestScore) {
              highestScore = result.rawScore;
              bestFallback = { firstName: fullName, hanja1: h1, hanja2: h2, score: result.score, reason: "차선책", isFallback: true };
            }
          }
        }

        if (bestMatch) {
          recommendations.push(bestMatch);
          usedNames.add(fullName);
          if (recommendations.length >= targetCount) return;
        }
      }
    }
  };

  // 🔥 완벽한 처방전(+20점)을 받은 이름은 rawScore가 110~120점까지 올라갑니다.
  if (namingStyle === 'TRENDY') {
    findNamesWithTargetScore(110, 10); // 1. 처방약(용신+희신) 완벽 투여된 놈들만 먼저 찾기
    if (recommendations.length < 10) findNamesWithTargetScore(95, 10); // 2. 못 찾으면 1개만 투여된 놈들 추가
  } else {
    findNamesWithTargetScore(115, 10); // 클래식은 한자가 많으니 더 깐깐하게!
    if (recommendations.length < 10) findNamesWithTargetScore(100, 10);
  }

  if (recommendations.length === 0 && bestFallback) recommendations.push(bestFallback);

  return recommendations;
};