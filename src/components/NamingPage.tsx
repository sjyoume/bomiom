import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Sparkles, X, ChevronRight, CheckCircle, BookOpen, Clock, List, ArrowRight, Info, Activity, Trophy, Timer, XCircle, Medal, Play, Music, Baby, HeartPulse, Share2, Trash2 } from 'lucide-react';
import { arrayUnion, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { analyzeSaju, evaluateName, generatePerfectNames, getSoundElement } from '../utils/namingLogic';
import hanjaData from '../data/hanjaDB.json';

// 🌟 온보딩 7단계 프리미엄 데이터
const ONBOARDING_STEPS = [
  { 
    title: "우리아기 첫 선물, 이름", subtitle: "💎 1. 봄이옴의 철학", 
    content: (
      <div className="space-y-4 text-left w-full mt-4">
        <p className="text-slate-300 text-[15px] leading-relaxed break-keep">
          이름은 부모가 아이에게 주는 첫 번째이자, <strong className="text-pink-400">가장 오래 남는 선물</strong>입니다. 봄이옴은 단순한 글자 맞추기식 작명을 거부합니다.
        </p>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner">
          <p className="text-slate-300 text-[13px] leading-relaxed break-keep">
            최고급 철학관의 논리를 그대로 이식한 <strong className="text-white">'AI 프리미엄 명리 엔진'</strong>을 탑재했습니다. 단순 통계나 획수를 넘어, 아기의 타고난 운명의 흐름을 진단하고 완벽한 균형을 찾아냅니다.
          </p>
        </div>
      </div>
    )
  },
  { 
    title: "발음오행 (원리)", subtitle: "🗣️ 2. 소리의 에너지", 
    content: (
      <div className="space-y-4 text-left w-full mt-4">
        <p className="text-slate-300 text-[15px] leading-relaxed break-keep">이름은 불리는 순간 <strong className="text-pink-400">소리의 파동</strong>이 아기에게 전달됩니다.</p>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner">
          <span className="text-pink-400 font-black block mb-2 text-lg">💡 상생(相生) 구조란?</span>
          <p className="text-slate-300 text-[13px] leading-relaxed break-keep">한글 첫소리와 받침의 5가지 기운(목,화,토,금,수)이 부딪히지 않고 부드럽게 이어지는 조화로운 상태를 말합니다.</p>
        </div>
      </div>
    )
  },
  { 
    title: "발음오행 (예시)", subtitle: "🗣️ 2. 상생과 상극", 
    content: (
      <div className="space-y-3 w-full text-left mt-4">
        <div className="bg-emerald-900/40 border border-emerald-800/60 p-4 rounded-2xl shadow-lg">
          <span className="text-emerald-400 font-black block mb-1 text-base">✅ 상생 (최고의 조화)</span>
          <p className="text-white font-bold mb-1">[이 서 준]</p>
          <p className="text-emerald-200/80 text-[13px] leading-tight">이(토) → 서(금) → 준(금)<br/>흙에서 쇠가 나오듯 자연스럽습니다.</p>
        </div>
        <div className="bg-rose-900/40 border border-rose-800/60 p-4 rounded-2xl shadow-lg">
          <span className="text-rose-400 font-black block mb-1 text-base">❌ 상극 (피해야 함)</span>
          <p className="text-white font-bold mb-1">[박 도 겸]</p>
          <p className="text-rose-200/80 text-[13px] leading-tight">박(수) → 도(화) → 겸(목)<br/>물이 불을 꺼뜨려 조화가 깨집니다.</p>
        </div>
      </div>
    )
  },
  { 
    title: "사주 처방 (자원오행)", subtitle: "📜 3. 운명의 완벽한 보완", 
    content: (
      <div className="space-y-4 text-left w-full mt-4">
        <p className="text-slate-300 text-[15px] leading-relaxed break-keep">사주가 아기가 입고 태어난 몸이라면, 자원오행은 그 몸에 가장 잘 어울리는 <strong className="text-pink-400">맞춤복</strong>입니다.</p>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner">
          <span className="text-pink-400 font-black block mb-2 text-lg">💡 병(病)을 찾고 약(藥)을 쓰다</span>
          <p className="text-slate-300 text-[13px] leading-relaxed break-keep">단순히 개수가 없는 오행을 채우는 1차원적 방식이 아닙니다. 아기가 태어난 <strong className="text-white">계절의 온도(조후)</strong>와 <strong className="text-white">기운의 세기(억부)</strong>를 정밀 진단하여, 운명에 가장 시급한 1순위 약(용신)과 2순위 약(희신)을 이름에 완벽히 주입합니다.</p>
        </div>
      </div>
    )
  },
  { 
    title: "원형이정 (원리)", subtitle: "⏳ 4. 생애의 흐름, 81수리", 
    content: (
      <div className="space-y-4 text-left w-full mt-4">
        <p className="text-slate-300 text-[15px] leading-relaxed break-keep">이름의 획수에는 아기의 인생 단계별 <strong className="text-pink-400">이정표</strong>가 숨겨져 있습니다.</p>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner">
          <p className="text-slate-300 text-[13px] leading-relaxed break-keep">성과 이름 한자의 획수를 조합하여 초년, 청년, 중년, 말년의 4단계 운세(81수리)를 모두 대길(大吉)하게 맞춥니다.</p>
        </div>
      </div>
    )
  },
  { 
    title: "음양의 조화", subtitle: "🌓 5. 완벽한 균형, 음양배합", 
    content: (
      <div className="space-y-4 text-left w-full mt-4">
        <p className="text-slate-300 text-[15px] leading-relaxed break-keep">성명학에서 가장 섬세한 부분은 <strong className="text-pink-400">음(陰)과 양(陽)의 밸런스</strong>입니다.</p>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-inner">
          <p className="text-slate-300 text-[13px] leading-relaxed break-keep">글자 획수의 홀수/짝수, 발음의 밝고 어두움이 어느 한쪽으로 치우치지 않아야 합니다. 0.1%의 불균형도 허용하지 않는 완벽한 배합을 찾아냅니다.</p>
        </div>
      </div>
    )
  },
  { 
    title: "불용문자 필터링", subtitle: "🚫 6. 흉한 기운의 원천 차단", 
    content: (
      <div className="space-y-4 text-left w-full mt-4">
        <p className="text-slate-300 text-[15px] leading-relaxed break-keep">뜻은 참 좋지만 이름에 쓰면 <strong className="text-pink-400">운을 꺾는 한자</strong>들이 있습니다.</p>
        <div className="bg-pink-900/40 border border-pink-800/60 p-5 rounded-2xl shadow-lg">
          <p className="text-pink-100/80 text-[13px] leading-relaxed break-keep">
            가득 찰 만(滿), 다할 극(極) 등 이름에 쓰면 고독하거나 파란을 부르는 대법원 인명용 불용문자를 원천 차단합니다. 아기에게 해로운 한자는 단 하나도 추천하지 않습니다.
          </p>
        </div>
      </div>
    )
  }
];

export default function NamingPage({ user, onBack, onUpdateUser, addToast }: any) {
  const [step, setStep] = useState<'ONBOARDING' | 'MODE_SELECT' | 'INPUT' | 'ANALYZING' | 'HISTORY'>('ONBOARDING');
  const [guidePage, setGuidePage] = useState(1);
  const [namingMode, setNamingMode] = useState<'EVALUATE' | 'RECOMMEND' | null>(null);
  const [inputStep, setInputStep] = useState(1);
  const [formData, setFormData] = useState({ lastName: '', lastNameHanja: null as any, isBorn: null as boolean | null, birthDate: '', birthTime: '', gender: null as 'M' | 'F' | null, firstName: '', firstNameHanja: [] as any[] });
  const [selectedNameDetail, setSelectedNameDetail] = useState<any>(null);
  const [namingHistory, setNamingHistory] = useState<any[]>(user?.namingHistory || []);
  const [sajuSummary, setSajuSummary] = useState<any>(user?.lastSajuAnalysis || null);
  
  // 🔥 [수정됨] missingElements 대신 '처방된 기운(용신, 희신)'을 담는 상태로 변경
  const [currentRequiredElements, setCurrentRequiredElements] = useState<string[]>([]);

  // ✅ 앱에서 쏘는 "광고 시청 완료" 신호를 웹이 귀 기울여 듣습니다!
  useEffect(() => {
    const handleAdCompletion = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // 앱에서 날아온 신호가 '작명소 광고 완료'라면!
        if (data.type === 'AD_REWARD_EARNED' && data.adType === 'NAMING') {
          setStep('ANALYZING'); // 다음 화면(분석)으로 넘어갑니다.
        }
      } catch (e) {
        // json 파싱 에러 방지
      }
    };

    window.addEventListener('message', handleAdCompletion);
    return () => window.removeEventListener('message', handleAdCompletion);
  }, []);

  const MOCK_SURNAME_DB: Record<string, any[]> = {
    '가': [{ hanja: '賈', won_strokes: 13, element_jayeon: '수', meaning: '성씨 가' }],
    '간': [{ hanja: '簡', won_strokes: 18, element_jayeon: '목', meaning: '대쪽 간' }],
    '갈': [{ hanja: '葛', won_strokes: 15, element_jayeon: '목', meaning: '칡 갈' }],
    '감': [{ hanja: '甘', won_strokes: 5, element_jayeon: '목', meaning: '달 감' }],
    '강': [
      { hanja: '姜', won_strokes: 9, element_jayeon: '목', meaning: '성씨 강' },
      { hanja: '康', won_strokes: 11, element_jayeon: '목', meaning: '편안할 강' },
      { hanja: '剛', won_strokes: 10, element_jayeon: '금', meaning: '굳을 강' }
    ],
    '견': [{ hanja: '堅', won_strokes: 11, element_jayeon: '목', meaning: '굳을 견' }, { hanja: '甄', won_strokes: 14, element_jayeon: '금', meaning: '질그릇 견' }],
    '경': [{ hanja: '慶', won_strokes: 15, element_jayeon: '목', meaning: '경사 경' }, { hanja: '景', won_strokes: 12, element_jayeon: '화', meaning: '볕 경' }],
    '계': [{ hanja: '桂', won_strokes: 10, element_jayeon: '목', meaning: '계수나무 계' }],
    '고': [{ hanja: '高', won_strokes: 10, element_jayeon: '목', meaning: '높을 고' }],
    '공': [{ hanja: '孔', won_strokes: 4, element_jayeon: '수', meaning: '구멍 공' }, { hanja: '公', won_strokes: 4, element_jayeon: '금', meaning: '공평할 공' }],
    '곽': [{ hanja: '郭', won_strokes: 15, element_jayeon: '목', meaning: '둘레 곽' }],
    '구': [
      { hanja: '具', won_strokes: 8, element_jayeon: '목', meaning: '갖출 구' },
      { hanja: '丘', won_strokes: 5, element_jayeon: '토', meaning: '언덕 구' },
      { hanja: '邱', won_strokes: 12, element_jayeon: '토', meaning: '땅이름 구' }
    ],
    '국': [{ hanja: '鞠', won_strokes: 17, element_jayeon: '목', meaning: '국문할 국' }, { hanja: '國', won_strokes: 11, element_jayeon: '목', meaning: '나라 국' }],
    '권': [{ hanja: '權', won_strokes: 22, element_jayeon: '목', meaning: '권세 권' }],
    '금': [{ hanja: '琴', won_strokes: 13, element_jayeon: '금', meaning: '거문고 금' }],
    '기': [{ hanja: '奇', won_strokes: 8, element_jayeon: '목', meaning: '기이할 기' }, { hanja: '箕', won_strokes: 14, element_jayeon: '목', meaning: '키 기' }],
    '길': [{ hanja: '吉', won_strokes: 6, element_jayeon: '화', meaning: '길할 길' }],
    '김': [{ hanja: '金', won_strokes: 8, element_jayeon: '금', meaning: '성씨 김' }],
    '나': [{ hanja: '羅', won_strokes: 20, element_jayeon: '화', meaning: '그물 라' }],
    '남': [{ hanja: '南', won_strokes: 9, element_jayeon: '화', meaning: '남녘 남' }],
    '노': [{ hanja: '盧', won_strokes: 16, element_jayeon: '화', meaning: '밥그릇 노' }, { hanja: '魯', won_strokes: 15, element_jayeon: '수', meaning: '노둔할 노' }],
    '도': [{ hanja: '都', won_strokes: 16, element_jayeon: '화', meaning: '도읍 도' }, { hanja: '陶', won_strokes: 16, element_jayeon: '화', meaning: '질그릇 도' }],
    '동': [{ hanja: '董', won_strokes: 15, element_jayeon: '목', meaning: '감독할 동' }],
    '라': [{ hanja: '羅', won_strokes: 20, element_jayeon: '화', meaning: '그물 라' }],
    '류': [{ hanja: '柳', won_strokes: 9, element_jayeon: '목', meaning: '버들 류' }],
    '마': [{ hanja: '馬', won_strokes: 10, element_jayeon: '화', meaning: '말 마' }, { hanja: '麻', won_strokes: 11, element_jayeon: '목', meaning: '삼 마' }],
    '맹': [{ hanja: '孟', won_strokes: 8, element_jayeon: '수', meaning: '맏 맹' }],
    '명': [{ hanja: '明', won_strokes: 8, element_jayeon: '화', meaning: '밝을 명' }],
    '모': [{ hanja: '牟', won_strokes: 6, element_jayeon: '수', meaning: '소우는소리 모' }, { hanja: '毛', won_strokes: 4, element_jayeon: '수', meaning: '털 모' }],
    '목': [{ hanja: '睦', won_strokes: 13, element_jayeon: '목', meaning: '화목할 목' }],
    '문': [{ hanja: '文', won_strokes: 4, element_jayeon: '수', meaning: '글월 문' }],
    '민': [{ hanja: '閔', won_strokes: 12, element_jayeon: '수', meaning: '위문할 민' }],
    '박': [{ hanja: '朴', won_strokes: 6, element_jayeon: '목', meaning: '성씨 박' }],
    '반': [{ hanja: '潘', won_strokes: 16, element_jayeon: '수', meaning: '뜨물 반' }, { hanja: '班', won_strokes: 10, element_jayeon: '수', meaning: '나눌 반' }],
    '방': [{ hanja: '方', won_strokes: 4, element_jayeon: '수', meaning: '모 방' }, { hanja: '房', won_strokes: 8, element_jayeon: '목', meaning: '방 방' }, { hanja: '龐', won_strokes: 19, element_jayeon: '화', meaning: '클 방' }],
    '배': [{ hanja: '裵', won_strokes: 14, element_jayeon: '수', meaning: '성씨 배' }],
    '백': [{ hanja: '白', won_strokes: 5, element_jayeon: '금', meaning: '흰 백' }],
    '범': [{ hanja: '范', won_strokes: 11, element_jayeon: '수', meaning: '법 범' }],
    '변': [{ hanja: '卞', won_strokes: 4, element_jayeon: '수', meaning: '조급할 변' }, { hanja: '邊', won_strokes: 22, element_jayeon: '화', meaning: '가 변' }],
    '복': [{ hanja: '卜', won_strokes: 2, element_jayeon: '수', meaning: '점 복' }],
    '봉': [{ hanja: '奉', won_strokes: 8, element_jayeon: '수', meaning: '받들 봉' }],
    '부': [{ hanja: '夫', won_strokes: 4, element_jayeon: '수', meaning: '지아비 부' }],
    '빈': [{ hanja: '賓', won_strokes: 14, element_jayeon: '수', meaning: '손 빈' }],
    '사': [{ hanja: '史', won_strokes: 5, element_jayeon: '금', meaning: '역사 사' }],
    '서': [{ hanja: '徐', won_strokes: 10, element_jayeon: '금', meaning: '천천히할 서' }],
    '석': [{ hanja: '石', won_strokes: 5, element_jayeon: '금', meaning: '돌 석' }, { hanja: '昔', won_strokes: 8, element_jayeon: '금', meaning: '예 석' }],
    '선': [{ hanja: '宣', won_strokes: 9, element_jayeon: '금', meaning: '베풀 선' }],
    '설': [{ hanja: '薛', won_strokes: 19, element_jayeon: '목', meaning: '맑은대쑥 설' }, { hanja: '偰', won_strokes: 11, element_jayeon: '목', meaning: '맑을 설' }],
    '성': [{ hanja: '成', won_strokes: 7, element_jayeon: '금', meaning: '이룰 성' }, { hanja: '星', won_strokes: 9, element_jayeon: '화', meaning: '별 성' }],
    '소': [{ hanja: '蘇', won_strokes: 22, element_jayeon: '목', meaning: '차조기 소' }, { hanja: '邵', won_strokes: 15, element_jayeon: '금', meaning: '고을 소' }],
    '손': [{ hanja: '孫', won_strokes: 10, element_jayeon: '금', meaning: '손자 손' }],
    '송': [{ hanja: '宋', won_strokes: 7, element_jayeon: '금', meaning: '송나라 송' }],
    '수': [{ hanja: '水', won_strokes: 4, element_jayeon: '수', meaning: '물 수' }, { hanja: '洙', won_strokes: 10, element_jayeon: '수', meaning: '물가 수' }],
    '신': [{ hanja: '申', won_strokes: 5, element_jayeon: '금', meaning: '납 신' }, { hanja: '辛', won_strokes: 7, element_jayeon: '금', meaning: '매울 신' }, { hanja: '愼', won_strokes: 14, element_jayeon: '금', meaning: '삼갈 신' }],
    '심': [{ hanja: '沈', won_strokes: 8, element_jayeon: '수', meaning: '가라앉을 심' }],
    '안': [{ hanja: '安', won_strokes: 6, element_jayeon: '토', meaning: '편안할 안' }],
    '양': [{ hanja: '梁', won_strokes: 11, element_jayeon: '목', meaning: '들보 량' }, { hanja: '楊', won_strokes: 13, element_jayeon: '목', meaning: '버들 양' }],
    '어': [{ hanja: '魚', won_strokes: 11, element_jayeon: '수', meaning: '고기 어' }, { hanja: '於', won_strokes: 8, element_jayeon: '토', meaning: '어조사 어' }],
    '엄': [{ hanja: '嚴', won_strokes: 20, element_jayeon: '금', meaning: '엄할 엄' }],
    '여': [{ hanja: '呂', won_strokes: 7, element_jayeon: '화', meaning: '성씨 여' }, { hanja: '余', won_strokes: 7, element_jayeon: '토', meaning: '나 여' }],
    '연': [{ hanja: '延', won_strokes: 7, element_jayeon: '토', meaning: '늘일 연' }, { hanja: '燕', won_strokes: 16, element_jayeon: '화', meaning: '제비 연' }],
    '염': [{ hanja: '廉', won_strokes: 13, element_jayeon: '목', meaning: '청렴할 염' }],
    '오': [{ hanja: '吳', won_strokes: 7, element_jayeon: '화', meaning: '나라 오' }],
    '옥': [{ hanja: '玉', won_strokes: 5, element_jayeon: '금', meaning: '구슬 옥' }],
    '온': [{ hanja: '溫', won_strokes: 14, element_jayeon: '화', meaning: '따뜻할 온' }],
    '왕': [{ hanja: '王', won_strokes: 4, element_jayeon: '토', meaning: '임금 왕' }],
    '용': [{ hanja: '龍', won_strokes: 16, element_jayeon: '화', meaning: '용 용' }],
    '우': [{ hanja: '禹', won_strokes: 9, element_jayeon: '토', meaning: '하우씨 우' }],
    '원': [{ hanja: '元', won_strokes: 4, element_jayeon: '목', meaning: '으뜸 원' }],
    '위': [{ hanja: '魏', won_strokes: 18, element_jayeon: '목', meaning: '나라 위' }, { hanja: '韋', won_strokes: 9, element_jayeon: '토', meaning: '가죽 위' }],
    '유': [{ hanja: '劉', won_strokes: 15, element_jayeon: '금', meaning: '묘금도 유' }, { hanja: '兪', won_strokes: 9, element_jayeon: '금', meaning: '대답할 유' }, { hanja: '庾', won_strokes: 9, element_jayeon: '목', meaning: '곳집 유' }],
    '육': [{ hanja: '陸', won_strokes: 16, element_jayeon: '화', meaning: '뭍 륙' }],
    '윤': [{ hanja: '尹', won_strokes: 4, element_jayeon: '토', meaning: '다스릴 윤' }],
    '은': [{ hanja: '殷', won_strokes: 10, element_jayeon: '토', meaning: '성할 은' }],
    '음': [{ hanja: '陰', won_strokes: 16, element_jayeon: '토', meaning: '그늘 음' }],
    '이': [{ hanja: '李', won_strokes: 7, element_jayeon: '목', meaning: '오얏 리' }],
    '인': [{ hanja: '印', won_strokes: 6, element_jayeon: '수', meaning: '도장 인' }],
    '임': [{ hanja: '林', won_strokes: 8, element_jayeon: '목', meaning: '수풀 림' }, { hanja: '任', won_strokes: 6, element_jayeon: '금', meaning: '맡길 임' }],
    '장': [{ hanja: '張', won_strokes: 11, element_jayeon: '화', meaning: '베풀 장' }, { hanja: '蔣', won_strokes: 17, element_jayeon: '목', meaning: '줄 장' }, { hanja: '章', won_strokes: 11, element_jayeon: '화', meaning: '글 장' }],
    '전': [{ hanja: '全', won_strokes: 6, element_jayeon: '화', meaning: '온전할 전' }, { hanja: '田', won_strokes: 5, element_jayeon: '토', meaning: '밭 전' }, { hanja: '錢', won_strokes: 16, element_jayeon: '금', meaning: '돈 전' }],
    '정': [{ hanja: '鄭', won_strokes: 19, element_jayeon: '화', meaning: '나라 정' }, { hanja: '丁', won_strokes: 2, element_jayeon: '화', meaning: '고무래 정' }, { hanja: '程', won_strokes: 12, element_jayeon: '화', meaning: '한도 정' }],
    '제': [{ hanja: '諸', won_strokes: 16, element_jayeon: '화', meaning: '모두 제' }, { hanja: '齊', won_strokes: 14, element_jayeon: '금', meaning: '가지런할 제' }],
    '조': [{ hanja: '趙', won_strokes: 14, element_jayeon: '화', meaning: '나라 조' }, { hanja: '曺', won_strokes: 11, element_jayeon: '금', meaning: '마을 조' }],
    '종': [{ hanja: '鍾', won_strokes: 20, element_jayeon: '금', meaning: '쇠북 종' }, { hanja: '宗', won_strokes: 8, element_jayeon: '금', meaning: '마루 종' }],
    '주': [{ hanja: '朱', won_strokes: 6, element_jayeon: '목', meaning: '붉을 주' }, { hanja: '周', won_strokes: 8, element_jayeon: '금', meaning: '두루 주' }],
    '지': [{ hanja: '池', won_strokes: 7, element_jayeon: '수', meaning: '못 지' }, { hanja: '智', won_strokes: 12, element_jayeon: '화', meaning: '지혜 지' }],
    '진': [{ hanja: '陳', won_strokes: 16, element_jayeon: '화', meaning: '베풀 진' }, { hanja: '晉', won_strokes: 10, element_jayeon: '화', meaning: '나아갈 진' }, { hanja: '秦', won_strokes: 10, element_jayeon: '화', meaning: '나라 진' }],
    '차': [{ hanja: '車', won_strokes: 7, element_jayeon: '금', meaning: '수레 차' }],
    '채': [{ hanja: '蔡', won_strokes: 17, element_jayeon: '목', meaning: '거북 채' }],
    '천': [{ hanja: '千', won_strokes: 3, element_jayeon: '금', meaning: '일천 천' }],
    '최': [{ hanja: '崔', won_strokes: 11, element_jayeon: '토', meaning: '높을 최' }],
    '추': [{ hanja: '秋', won_strokes: 9, element_jayeon: '금', meaning: '가을 추' }, { hanja: '鄒', won_strokes: 15, element_jayeon: '금', meaning: '나라 추' }],
    '탁': [{ hanja: '卓', won_strokes: 8, element_jayeon: '화', meaning: '높을 탁' }],
    '태': [{ hanja: '太', won_strokes: 4, element_jayeon: '화', meaning: '클 태' }],
    '팽': [{ hanja: '彭', won_strokes: 12, element_jayeon: '수', meaning: '성씨 팽' }],
    '편': [{ hanja: '片', won_strokes: 4, element_jayeon: '수', meaning: '조각 편' }, { hanja: '扁', won_strokes: 9, element_jayeon: '수', meaning: '작을 편' }],
    '평': [{ hanja: '平', won_strokes: 5, element_jayeon: '수', meaning: '평평할 평' }],
    '표': [{ hanja: '表', won_strokes: 8, element_jayeon: '수', meaning: '겉 표' }],
    '피': [{ hanja: '皮', won_strokes: 5, element_jayeon: '수', meaning: '가죽 피' }],
    '하': [{ hanja: '河', won_strokes: 9, element_jayeon: '수', meaning: '물 하' }, { hanja: '夏', won_strokes: 10, element_jayeon: '화', meaning: '여름 하' }],
    '한': [{ hanja: '韓', won_strokes: 17, element_jayeon: '금', meaning: '나라 한' }, { hanja: '漢', won_strokes: 15, element_jayeon: '수', meaning: '한수 한' }],
    '함': [{ hanja: '咸', won_strokes: 9, element_jayeon: '수', meaning: '다 함' }],
    '허': [{ hanja: '許', won_strokes: 11, element_jayeon: '목', meaning: '허락할 허' }],
    '현': [{ hanja: '玄', won_strokes: 5, element_jayeon: '수', meaning: '검을 현' }],
    '형': [{ hanja: '邢', won_strokes: 11, element_jayeon: '금', meaning: '나라 형' }],
    '호': [{ hanja: '扈', won_strokes: 11, element_jayeon: '수', meaning: '따를 호' }, { hanja: '胡', won_strokes: 9, element_jayeon: '토', meaning: '오랑캐 호' }],
    '홍': [{ hanja: '洪', won_strokes: 10, element_jayeon: '수', meaning: '넓을 홍' }],
    '황': [{ hanja: '黃', won_strokes: 12, element_jayeon: '토', meaning: '누를 황' }, { hanja: '皇', won_strokes: 9, element_jayeon: '수', meaning: '임금 황' }],
    '황보': [{ hanja: '皇甫', won_strokes: 16, element_jayeon: '수', meaning: '성씨 황보 (皇 9획 + 甫 7획)' }],
    '남궁': [{ hanja: '南宮', won_strokes: 19, element_jayeon: '화', meaning: '성씨 남궁 (南 9획 + 宮 10획)' }],
    '선우': [{ hanja: '鮮于', won_strokes: 20, element_jayeon: '금', meaning: '성씨 선우 (鮮 17획 + 于 3획)' }],
    '독고': [{ hanja: '獨孤', won_strokes: 25, element_jayeon: '금', meaning: '성씨 독고 (獨 17획 + 孤 8획)' }],
    '제갈': [{ hanja: '諸葛', won_strokes: 31, element_jayeon: '금', meaning: '성씨 제갈 (諸 16획 + 葛 15획)' }],
    '사공': [{ hanja: '司空', won_strokes: 13, element_jayeon: '금', meaning: '성씨 사공 (司 5획 + 空 8획)' }],
    '동방': [{ hanja: '東方', won_strokes: 12, element_jayeon: '목', meaning: '성씨 동방 (東 8획 + 方 4획)' }]
  };

  const saveNamingToFirebase = async (newRecord: any, sajuInfo: any) => {
    if (!user?.id) return;
    
    // 1. 저장할 데이터 조립
    const recordWithMeta = { 
      ...newRecord, 
      // 🔥 [핵심 수정] 요약본(sajuInfo)이 원본 전체 데이터(newRecord.sajuData)를 덮어쓰지 못하도록 두 개를 완벽하게 합쳐줍니다!
      sajuData: { ...sajuInfo, ...(newRecord.sajuData || {}) }, 
      id: `name_${Date.now()}`, 
      createdAt: new Date().toISOString() 
    };
    
    try {
      const userRef = doc(db, "users", user.id);
      
      // 2. arrayUnion을 써서 기존 DB 데이터에 '안전하게 밀어 넣기'
      await updateDoc(userRef, { 
        namingHistory: arrayUnion(recordWithMeta), 
        lastSajuAnalysis: sajuInfo 
      });
      
      // 3. 현재 화면(State) 업데이트
      const updatedHistory = [...(user.namingHistory || []), recordWithMeta];

      // 4. App.tsx에서 내려받은 전역 user 정보도 업데이트!
      if (typeof onUpdateUser === 'function') {
        onUpdateUser({ 
          ...user, 
          namingHistory: updatedHistory,
          lastSajuAnalysis: sajuInfo 
        });
      }
      
      addToast('success', '작명 결과가 보관함에 안전하게 저장되었습니다! ✨');
      
    } catch (e) {
      console.error("작명 기록 저장 실패:", e);
      addToast('error', '기록 저장에 실패했습니다.');
    }
  };

  const deleteNamingRecord = async (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation(); 
    if (!window.confirm("이 작명 기록을 정말 삭제하시겠습니까?")) return;

    const updatedHistory = namingHistory.filter((item: any) => item.id !== idToDelete);
    setNamingHistory(updatedHistory); 

    if (user?.id) {
      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, { namingHistory: updatedHistory });
      } catch (e) {
        console.error("작명 기록 삭제 실패:", e);
      }
    }
  };

  useEffect(() => {
    if (user?.namingHistory) {
      setNamingHistory(user.namingHistory);
    }
  }, [user]);

  // 🔥 [수정됨] 사주 요청 시 용신/희신을 받아와서 저장
  useEffect(() => {
    if (formData.birthDate) {
      const fetchSaju = async () => {
        try {
          const saju = await analyzeSaju(formData.birthDate, formData.birthTime || "12:00");
          // 1순위 약과 2순위 약을 배열로 저장
          setCurrentRequiredElements([saju.yongshin, saju.heeshin].filter(Boolean));
        } catch (error) {
          console.error("실시간 사주 분석 에러:", error);
          setCurrentRequiredElements([]); 
        }
      };
      fetchSaju();
    }
  }, [formData.birthDate, formData.birthTime]);

  useEffect(() => {
    if (step === 'ANALYZING') {
      const processNaming = async () => {
        try {
          let sajuInfo: any = { isSajuAvailable: false, elementsCount: {} };
          
          if (formData.birthDate) {
            sajuInfo = await analyzeSaju(formData.birthDate, formData.birthTime || "12:00");
          }

          if (namingMode === 'RECOMMEND') {
            const recommendedNames = generatePerfectNames(
              // 🔥 1. 성씨 획수 키 변경
              formData.lastName, formData.lastNameHanja.won_strokes, sajuInfo, hanjaData, (formData as any).namingStyle || 'TRENDY', formData.gender
            );
            
            const best = recommendedNames.length > 0 ? recommendedNames[0] : {
              // 🔥 2. 예외처리용 기본값의 키도 변경
              firstName: "서아", hanja1: { hanja: '瑞', won_strokes: 14, element_jayeon: '금', meaning: '상서로울 서' }, hanja2: { hanja: '雅', won_strokes: 12, element_jayeon: '목', meaning: '맑을 아' }, isFallback: true
            };

            const finalFirstName = Array.isArray(best.firstName) ? best.firstName[0] : best.firstName;

            const result = evaluateName(
              // 🔥 3. 평가 엔진에 넘기는 변수명 완벽 매칭
              formData.lastName, formData.lastNameHanja.won_strokes,
              finalFirstName[0], best.hanja1.won_strokes, best.hanja1.element_jayeon,
              finalFirstName[1] || '', best.hanja2?.won_strokes || 0, best.hanja2?.element_jayeon || '', sajuInfo
            );

            if (best.isFallback) {
               result.reports.unshift("⚠️ 사주에 완벽히 맞는 조합이 나오지 않아 차선책을 추천합니다.");
            }

            const finalData = { 
              type: 'BOMIOM', 
              // 🔥 이름이 2~3개 연달아 붙는 것을 원천 차단! (딱 하나의 이름만 조합)
              name: formData.lastName + finalFirstName, 
              hanja: formData.lastNameHanja.hanja + best.hanja1.hanja + (best.hanja2?.hanja || ''), 
              score: result.score, 
              familyNameHanja: formData.lastNameHanja,
              firstNameHanjaDetails: [best.hanja1, best.hanja2].filter(Boolean), 
              details: result,
              sajuData: sajuInfo 
            };

            const finalSaju = { 
              isBorn: formData.isBorn, 
              requiredElements: [sajuInfo.yongshin, sajuInfo.heeshin].filter(Boolean), 
              elementsCount: sajuInfo.elementsCount, 
              prescriptionReason: sajuInfo.prescriptionReason 
            };
            
            // 아까 수정한 alert 저장 함수가 여기서 호출됩니다!
            saveNamingToFirebase(finalData, finalSaju);
            
          } else {
            const hanja1 = formData.firstNameHanja[0]; 
            const hanja2 = formData.firstNameHanja[1];
            
            const result = evaluateName(
              formData.lastName, formData.lastNameHanja.won_strokes, 
              formData.firstName[0], hanja1.won_strokes, hanja1.element_jayeon, 
              formData.firstName[1] || '', hanja2 ? hanja2.won_strokes : 0, hanja2 ? hanja2.element_jayeon : '', 
              sajuInfo
            );
            
            const finalData = { 
              type: 'USER', 
              name: formData.lastName + formData.firstName, 
              hanja: formData.lastNameHanja.hanja + hanja1.hanja + (hanja2 ? hanja2.hanja : ''), 
              score: result.score, 
              familyNameHanja: formData.lastNameHanja, 
              firstNameHanjaDetails: formData.firstNameHanja.filter(Boolean), 
              details: result,
              sajuData: sajuInfo 
            };
            
            const finalSaju = { 
              isBorn: formData.isBorn, 
              requiredElements: [sajuInfo.yongshin, sajuInfo.heeshin].filter(Boolean), 
              elementsCount: sajuInfo.elementsCount, 
              prescriptionReason: sajuInfo.prescriptionReason 
            };
            saveNamingToFirebase(finalData, finalSaju);
          }
          
          setStep('HISTORY');

        } catch (err: any) {
          console.error("작명 로직 처리 중 에러:", err);
          alert("🚨 에러 원인: " + err.message);
          setStep('INPUT');
        }
      };

      const timer = setTimeout(() => {
        processNaming();
      }, 2500); 
      return () => clearTimeout(timer);
    }
  }, [step]);

  if (step === 'ONBOARDING') {
    const currentStepData = ONBOARDING_STEPS[guidePage - 1]; 
    return (
      <div className="min-h-[100dvh] bg-slate-900 text-white flex flex-col font-sans pb-[env(safe-area-inset-bottom)]">
        <header className="px-5 py-4 flex justify-between items-center shrink-0 border-b border-white/10">
          <button onClick={onBack} className="text-slate-400 p-2 -ml-2 active:scale-90"><ChevronLeft size={28} /></button>
          <div className="flex gap-1.5">
            {ONBOARDING_STEPS.map((_, idx) => (
              <div key={idx} className={`h-1.5 rounded-full transition-all duration-500 ${guidePage - 1 === idx ? 'w-6 bg-pink-500' : 'w-2 bg-slate-700'}`} />
            ))}
          </div>
          <button onClick={() => setStep('MODE_SELECT')} className="text-[13px] font-bold text-slate-400 bg-slate-800 px-4 py-2 rounded-full hover:bg-slate-700 active:scale-95">건너뛰기</button>
        </header>

        <div className="flex-1 flex flex-col items-center p-6 text-center pt-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div 
              key={guidePage} 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}
              className="w-full max-w-sm flex flex-col items-center"
            >
              <span className="text-pink-400 font-black text-xs tracking-widest mb-3 block border border-pink-500/30 bg-pink-500/10 px-3 py-1 rounded-full">
                {currentStepData.subtitle}
              </span>
              <h2 className="text-[22px] font-black mb-2 leading-snug">
                {currentStepData.title}
              </h2>
              {currentStepData.content}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-5 pb-20 flex gap-3 shrink-0 mt-auto bg-slate-900 border-t border-slate-800">
          <button 
            onClick={() => guidePage > 1 && setGuidePage(guidePage - 1)}
            disabled={guidePage === 1}
            className={`flex-1 py-4 rounded-xl font-black transition-all ${guidePage === 1 ? 'bg-slate-800/50 text-slate-600' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            이전
          </button>
          <button 
            onClick={() => guidePage < ONBOARDING_STEPS.length ? setGuidePage(guidePage + 1) : setStep('MODE_SELECT')} 
            className="flex-[2] bg-pink-500 text-white py-4 rounded-xl font-black text-base active:scale-95 transition-transform shadow-[0_0_20px_rgba(236,72,153,0.3)]"
          >
            {guidePage < ONBOARDING_STEPS.length ? '다음 보기' : '찰떡 이름 짓기!'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'MODE_SELECT') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-24">
        <header className="bg-white px-5 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <button onClick={() => setStep('ONBOARDING')} className="p-2 -ml-2 text-slate-500"><ChevronLeft size={24} /></button>
          <h1 className="text-lg font-bold text-slate-800">서비스 선택</h1>
          <button onClick={() => setStep('HISTORY')} className="text-slate-400"><List size={24}/></button>
        </header>
        <div className="p-6 flex-1 flex flex-col gap-4">
          <h2 className="text-2xl font-black text-slate-800 mb-2 mt-4">어떤 작명 서비스가<br/>필요하신가요?</h2>
          
          <button onClick={() => { 
            setNamingMode('EVALUATE'); 
            setInputStep(1); 
            setFormData({ lastName: '', lastNameHanja: null as any, isBorn: null, birthDate: '', birthTime: '', gender: null, firstName: '', firstNameHanja: [] });
            setStep('INPUT'); 
          }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 text-left active:scale-95">
            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-3 inline-block">스스로 작명</span>
            <h3 className="text-xl font-black text-slate-800 mb-2">내가 지은 이름 정밀 감정</h3>
            <p className="text-sm text-slate-500 break-keep">사주와 81수리에 맞는 완벽한 한자를 선택해보고 전문가 수준의 감정서를 받아보세요.</p>
          </button>
          
          <button onClick={() => { 
            setNamingMode('RECOMMEND'); 
            setInputStep(1); 
            setFormData({ lastName: '', lastNameHanja: null as any, isBorn: null, birthDate: '', birthTime: '', gender: null, firstName: '', firstNameHanja: [] });
            setStep('INPUT'); 
          }} className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-lg text-left active:scale-95 relative overflow-hidden mt-2">
            <div className="absolute right-0 top-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl"></div>
            <span className="bg-pink-500/20 text-pink-300 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-3 inline-block border border-pink-500/30">AI 맞춤 추천</span>
            <h3 className="text-xl font-black text-white mb-2">사주 맞춤 프리미엄 이름 추천</h3>
            <p className="text-sm text-slate-300 relative z-10 break-keep">아기 사주에 꼭 맞는 완벽한 한자 조합 후보들을 추천해 드립니다.</p>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'INPUT') {
    const nextInputStep = () => setInputStep(prev => prev + 1);
    const prevInputStep = () => {
      if (inputStep === 1) setStep('MODE_SELECT');
      else setInputStep(prev => prev - 1);
    };
    const maxSteps = namingMode === 'EVALUATE' ? 6 : 5; 
    const progress = (inputStep / maxSteps) * 100;

    return (
      <div className="min-h-screen bg-white flex flex-col font-sans pb-28"> 
        <header className="px-5 py-4 flex items-center justify-between sticky top-0 bg-white z-20">
          <button onClick={() => setStep('MODE_SELECT')} className="p-2 -ml-2 text-slate-500"><ChevronLeft size={28} /></button>
          <div className="flex-1 mx-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="text-xs font-bold text-slate-400">{inputStep} / {maxSteps}</span>
        </header>

        <main className="flex-1 p-6 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div key={inputStep} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
              {inputStep === 1 && (
                <>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 leading-snug">아기의 <span className="text-pink-500">성씨(姓)</span>는<br/>무엇인가요?</h2>
                  <p className="text-slate-500 font-medium mb-8">수리성명학의 기준이 되는 가장 중요한 정보입니다.</p>
                  <input type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value, lastNameHanja: null})} placeholder="예: 김, 이, 박" className="text-4xl font-black text-slate-800 border-b-2 border-slate-200 pb-3 focus:border-pink-500 focus:outline-none w-full text-center transition-colors mb-6" maxLength={2} />
                  {formData.lastName.length > 0 && MOCK_SURNAME_DB[formData.lastName] && (
                    <div className="space-y-3 mt-4">
                      <p className="text-sm font-bold text-slate-400 mb-2 text-center">해당하는 한자를 선택해주세요</p>
                      {MOCK_SURNAME_DB[formData.lastName].map((item, idx) => (
                        <button key={idx} onClick={() => setFormData({...formData, lastNameHanja: item})} className={`w-full p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${formData.lastNameHanja?.hanja === item.hanja ? 'border-pink-500 bg-pink-50 shadow-md' : 'border-slate-100 bg-white'}`}>
                          <div className="flex items-center gap-4">
                            <span className="text-3xl font-black text-slate-800">{item.hanja}</span>
                            <div className="text-left">
                              <p className="font-bold text-slate-700">{item.meaning}</p>
                              <p className="text-xs text-slate-400 font-medium">원획: {item.won_strokes}획 | 자원오행: {item.element_jayeon}</p>
                            </div>
                          </div>
                          {formData.lastNameHanja?.hanja === item.hanja && <CheckCircle className="text-pink-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {inputStep === 2 && (
                <>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 leading-snug">아기가 <span className="text-pink-500">태어났나요?</span></h2>
                  <p className="text-slate-500 font-medium mb-8">정확한 사주 분석을 위해 필요해요.</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => setFormData({...formData, isBorn: true})} className={`p-5 rounded-2xl border-2 font-bold text-lg transition-all ${formData.isBorn === true ? 'border-pink-500 bg-pink-50 text-pink-600 shadow-sm' : 'border-slate-200 text-slate-600 bg-white'}`}>네, 태어났어요</button>
                    <button onClick={() => setFormData({...formData, isBorn: false})} className={`p-5 rounded-2xl border-2 font-bold text-lg transition-all ${formData.isBorn === false ? 'border-pink-500 bg-pink-50 text-pink-600 shadow-sm' : 'border-slate-200 text-slate-600 bg-white'}`}>아직 출산 전이에요 (예정일)</button>
                  </div>
                </>
              )}

              {inputStep === 3 && (
                <>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 leading-snug">아기의 <span className="text-pink-500">생일(예정일)</span>은<br/>언제인가요?</h2>
                  <p className="text-slate-500 font-medium mb-8">만세력을 바탕으로 사주 오행을 정밀 분석합니다.</p>
                  <div className="space-y-4 w-full">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">날짜 (양력 기준)</label>
                      <input type="date" value={formData.birthDate} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-pink-500 focus:outline-none font-bold text-slate-700 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-2">태어난 시간 (모르면 12:00)</label>
                      <input type="time" value={formData.birthTime} onChange={(e) => setFormData({...formData, birthTime: e.target.value})} className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-pink-500 focus:outline-none font-bold text-slate-700 bg-white" />
                    </div>
                  </div>
                </>
              )}

              {inputStep === 4 && (
                <>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 leading-snug">아기의 <span className="text-pink-500">성별</span>을<br/>알려주세요</h2>
                  <p className="text-slate-500 font-medium mb-8">음양의 완벽한 조화를 맞추는데 참고가 됩니다.</p>
                  <div className="flex gap-3 w-full">
                    <button onClick={() => setFormData({...formData, gender: 'M'})} className={`flex-1 p-6 rounded-2xl border-2 font-black text-xl transition-all ${formData.gender === 'M' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm' : 'border-slate-200 text-slate-600 bg-white hover:border-blue-200'}`}>남자아이</button>
                    <button onClick={() => setFormData({...formData, gender: 'F'})} className={`flex-1 p-6 rounded-2xl border-2 font-black text-xl transition-all ${formData.gender === 'F' ? 'border-pink-500 bg-pink-50 text-pink-600 shadow-sm' : 'border-slate-200 text-slate-600 bg-white hover:border-pink-200'}`}>여자아이</button>
                  </div>
                </>
              )}

              {inputStep === 5 && namingMode === 'RECOMMEND' && (
                <>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 leading-snug">원하시는 <span className="text-pink-500">이름 스타일</span>을<br/>선택해주세요</h2>
                  <p className="text-slate-500 font-medium mb-8">AI가 어떤 기준으로 추천할지 결정합니다.</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => setFormData({...formData, namingStyle: 'TRENDY' as any})} className={`p-5 rounded-2xl border-2 text-left transition-all ${(formData as any).namingStyle !== 'CLASSIC' ? 'border-pink-500 bg-pink-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                      <h3 className={`font-black text-lg mb-1 ${(formData as any).namingStyle !== 'CLASSIC' ? 'text-pink-600' : 'text-slate-700'}`}>요즘 이름 느낌 반영 ✨</h3>
                      <p className="text-sm text-slate-500 break-keep">어감이 예쁜 한글 위주로 조합합니다.<br/>(성명학 80~100점 유연하게 추천)</p>
                    </button>
                    <button onClick={() => setFormData({...formData, namingStyle: 'CLASSIC' as any})} className={`p-5 rounded-2xl border-2 text-left transition-all ${(formData as any).namingStyle === 'CLASSIC' ? 'border-pink-500 bg-pink-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                      <h3 className={`font-black text-lg mb-1 ${(formData as any).namingStyle === 'CLASSIC' ? 'text-pink-600' : 'text-slate-700'}`}>정통 성명학 완벽주의 💯</h3>
                      <p className="text-sm text-slate-500 break-keep">이름 어감이 조금 특이하더라도 성명학 점수 100점에 집착하여 무조건 찾습니다.</p>
                    </button>
                  </div>
                </>
              )}

              {inputStep === 5 && namingMode === 'EVALUATE' && (
                <>
                  <h2 className="text-3xl font-black text-slate-800 mb-2 leading-snug">감정받고 싶은<br/><span className="text-pink-500">이름</span>을 적어주세요</h2>
                  <p className="text-slate-500 font-medium mb-8">한글 이름을 적어주시면 사주에 맞는 한자를 찾아드릴게요.</p>
                  <div className="flex items-center text-4xl font-black text-slate-800 border-b-2 border-slate-200 pb-3 focus-within:border-pink-500 transition-colors w-full justify-center">
                    <span className="text-slate-300 mr-2">{formData.lastName}</span>
                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value, firstNameHanja: []})} placeholder="서아" className="focus:outline-none w-32 bg-transparent text-center" maxLength={2} />
                  </div>
                </>
              )}

              {inputStep === 6 && namingMode === 'EVALUATE' && (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-800 mb-2 leading-snug">우리 아기에게 맞는<br/><span className="text-pink-500">최적의 한자</span>를 골라주세요</h2>
                    
                    {/* 🔥 [수정됨] 부족한 기운 -> 엔진이 처방한 용신/희신 기운으로 안내 멘트 변경 */}
                    {currentRequiredElements.length > 0 ? (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex gap-2 items-start">
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5"/>
                        <p className="text-xs text-blue-700 leading-relaxed font-bold break-keep">
                          현재 아기 사주에 <span className="text-pink-500 text-sm">[{currentRequiredElements.join(', ')}]</span> 기운이 처방약(용신/희신)으로 진단되었습니다! 이 오행을 가진 한자를 선택하시면 대길(大吉)한 이름이 됩니다.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 break-keep">사주 오행이 고루 분포되어 있습니다. 뜻과 획수가 좋은 한자를 선택해 보세요.</p>
                    )}
                  </div>

                  <div className="space-y-6">
                    {formData.firstName.split('').map((char, charIdx) => {
                      const dbList = (hanjaData as Record<string, any[]>)[char] || [];

                      return (
                        <div key={charIdx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <h3 className="font-black text-lg text-slate-700 mb-3">'{char}' 한자 선택</h3>
                          
                          {dbList.length > 0 ? (
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
                              {dbList.map((item, idx) => {
                                // 🔥 [수정됨] 추천 기준을 currentRequiredElements(용신/희신)로 변경
                                const isRecommended = currentRequiredElements.includes(item.element_jayeon);
                                const isSelected = formData.firstNameHanja[charIdx]?.hanja === item.hanja;
                                return (
                                  <button 
                                    key={idx} 
                                    onClick={() => {
                                      const newHanjaArr = [...formData.firstNameHanja];
                                      newHanjaArr[charIdx] = item;
                                      setFormData({...formData, firstNameHanja: newHanjaArr});
                                    }}
                                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all bg-white text-left ${isSelected ? 'border-pink-500 shadow-md ring-1 ring-pink-500' : 'border-slate-200 hover:border-pink-300'}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl font-black text-slate-800">{item.hanja}</span>
                                      <div>
                                        <p className="font-bold text-slate-700">{item.meaning}</p>
                                        <p className="text-[11px] text-slate-400 font-medium">원획: {item.won_strokes}획 | 자원오행: {item.element_jayeon}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      {isRecommended && <span className="bg-pink-100 text-pink-600 text-[9px] font-black px-1.5 py-0.5 rounded border border-pink-200">사주 추천</span>}
                                      {isSelected && <CheckCircle className="text-pink-500" size={18}/>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                              <p className="text-sm text-red-500 font-bold">
                                '{char}' 자에 해당하는 인명용 한자가 없습니다.<br/>
                                <span className="text-xs font-normal text-red-400 mt-1 block">(순한글 이름이거나, 오타가 없는지 확인해 주세요)</span>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex gap-3">
            <button 
              onClick={prevInputStep}
              disabled={inputStep === 1}
              className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100"
            >
              이전
            </button>
            <button 
              onClick={() => {
                if (inputStep < maxSteps) nextInputStep();
                else {
                  if (namingMode === 'EVALUATE' && formData.firstNameHanja.length !== formData.firstName.length) {
                    alert("이름의 모든 한자를 선택해 주세요!");
                    return;
                  }
                  
                  // ✅ [수정] 앱(App.js)에게 "동영상 광고 틀어줘!" 하고 리모컨 신호를 쏩니다.
                  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
                    (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SHOW_REWARDED_AD', adType: 'NAMING' }));
                  } else {
                    // PC 브라우저 등 테스트 환경일 때는 광고 없이 바로 넘어갑니다.
                    setStep('ANALYZING');
                  }
                }
              }}
              disabled={
                (inputStep === 1 && !formData.lastNameHanja) ||
                (inputStep === 2 && formData.isBorn === null) ||
                (inputStep === 3 && !formData.birthDate) ||
                (inputStep === 4 && !formData.gender) ||
                (inputStep === 5 && namingMode === 'EVALUATE' && formData.firstName.length < 1)
              }
              className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black text-[15px] whitespace-nowrap flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-30 disabled:active:scale-100"
            >
              {/* ✅ 버튼 텍스트 유지 */}
              {inputStep === maxSteps 
                ? '🎥 30초 광고 보고 감정 시작'
                : <>다음으로 <ArrowRight size={20}/></>
              }
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (step === 'ANALYZING') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans pb-28">
        <Sparkles size={48} className="text-pink-400 animate-pulse mb-6" />
        <h2 className="text-2xl font-black mb-2 tracking-tight">AI 명리 엔진 가동 중...</h2>
        <p className="text-slate-400 text-sm break-keep">조후와 억부를 분석하여 약(용신/희신)을 처방합니다.</p>
      </div>
    );
  }

  if (step === 'HISTORY') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans pb-32">
        <header className="bg-white px-5 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm border-b border-slate-100">
          <button onClick={() => setStep('MODE_SELECT')} className="p-2 -ml-2 text-slate-500 active:scale-90"><ChevronLeft size={24} /></button>
          <h1 className="text-lg font-bold text-slate-800">우리아기 찰떡 이름 보관함</h1>
          <div className="w-10"></div>
        </header>

        <div className="p-5">
          {sajuSummary && sajuSummary.isBorn && (
            <div className="bg-slate-800 rounded-[2rem] p-6 shadow-lg text-white mb-8 relative overflow-hidden">
              <div className="absolute right-[-20px] top-[-20px] text-8xl opacity-10">☯️</div>
              <div className="relative z-10">
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-3 inline-block">사주 정밀 분석 요약</span>
                
                {/* 🔥 [수정됨] missingElements 대신 requiredElements 출력 */}
                <h2 className="text-xl font-black mb-3 leading-snug break-keep">
                  {sajuSummary.requiredElements?.length > 0 ? (
                    <>우리 아기는 <span className="text-pink-400">{sajuSummary.requiredElements.join(', ')}</span> 기운이 처방되었습니다!</>
                  ) : "사주 오행이 완벽하게 조화롭습니다!"}
                </h2>
                
                {/* 🔥 [수정됨] description 대신 처방 사유(prescriptionReason) 출력 */}
                <p className="text-xs text-slate-300 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 break-keep">
                  {sajuSummary.prescriptionReason || "사주의 균형이 좋아 어떤 이름이든 잘 어울립니다."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {namingHistory.length === 0 && (
              <div className="text-center py-10 text-slate-400 font-bold text-sm bg-white rounded-[1.5rem] border border-slate-200 border-dashed">
                아직 보관된 이름이 없습니다.<br/>새로운 이름을 지어보세요!
              </div>
            )}
            
            {namingHistory.slice().reverse().map((item: any, idx) => (
              <div key={item.id || idx} onClick={() => setSelectedNameDetail(item)} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform relative group">
                <button 
                  onClick={(e) => deleteNamingRecord(e, item.id)}
                  className="absolute top-3 right-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                >
                  <Trash2 size={16} />
                </button>
                <div className="pr-6">
                  <div className="flex items-center gap-2 mb-2 mt-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${item.type === 'USER' ? 'bg-slate-100 text-slate-500' : 'bg-pink-100 text-pink-600'}`}>
                      {item.type === 'USER' ? '스스로 작명' : 'AI 추천'}
                    </span>
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">{item.name}</h4>
                    <span className="text-sm font-bold text-slate-400 tracking-widest">{item.hanja}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {item.firstNameHanjaDetails?.map((h: any, i: number) => (
                      <span key={i} className="text-[10px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100">
                        {item.name[i + 1]}({h.element_jayeon}) {/* 👈 여기 변경! */}
                      </span>
                    ))}
                    <span className="text-[10px] font-black px-2 py-1 rounded bg-pink-50 text-pink-600 border border-pink-100">
                      종합 {item.score}점
                    </span>
                  </div>
                </div>
                <ChevronRight className="text-slate-200 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selectedNameDetail && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedNameDetail(null)} className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2rem] z-[9999] flex flex-col h-[90vh] shadow-2xl overflow-hidden">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full" />

                <div className="flex justify-between items-start p-6 pt-8 border-b border-slate-100 shrink-0">
                  <div>
                    <span className="bg-indigo-100 text-indigo-600 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">프리미엄 작명 감정서</span>
                    <h2 className="text-3xl font-black text-slate-800 flex items-end gap-2">
                      {selectedNameDetail.name} 
                      <span className="text-lg font-bold text-slate-400 mb-1 tracking-widest">{selectedNameDetail.hanja}</span>
                    </h2>
                  </div>
                  <button onClick={() => setSelectedNameDetail(null)} className="p-2 bg-slate-100 rounded-full text-slate-500 active:scale-90"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 pb-[180px] space-y-6 scrollbar-hide bg-slate-50">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><Clock size={18} className="text-pink-500"/> 아기 사주 정보</h3>
                    <div className="text-sm font-medium text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="mb-1">• 양력: <span className="font-bold text-slate-800">{selectedNameDetail.sajuData?.solarDate || '정보 없음'}</span></p>
                      <p className="mb-1">• 음력: <span className="font-bold text-slate-800">{selectedNameDetail.sajuData?.lunarDate || '정보 없음'}</span></p>
                      <p>• 사주: <span className="font-black text-pink-600 tracking-widest">{selectedNameDetail.sajuData?.saju8Chars || '정보 없음'}</span></p>
                    </div>
                    <div className="flex justify-between items-center bg-pink-50 p-4 rounded-xl border border-pink-100 mt-2">
                      <span className="font-bold text-pink-800">종합 감정 점수</span>
                      <span className="text-3xl font-black text-pink-600">{selectedNameDetail.score}점</span>
                    </div>
                  </div>

                  <div className="bg-[#FCFAF5] p-2 rounded-lg shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="border-[3px] border-double border-[#C19A5B] p-5 rounded relative h-full">
                      <div className="text-center mb-6 relative z-10">
                        <h1 className="text-4xl font-serif font-black text-[#3A2D23] tracking-[0.4em] ml-[0.4em]">作名書</h1>
                        <p className="text-[#C19A5B] text-[10px] font-bold mt-2 tracking-widest">프리미엄 작명 인증서</p>
                      </div>

                      {/* 🔥 인증서 내 이름 3글자(또는 복성 포함 4글자) + 뜻풀이 + 컬러 오행 */}
                      <div className="flex justify-center gap-2 sm:gap-6 mb-8 border-b border-[#E6D5B8] pb-6 relative z-10 w-full">
                        
                        {/* 1. 성씨 영역 (복성 대응 완벽 처리) */}
                        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[33%]">
                          <span className={`font-black text-slate-800 tracking-tighter whitespace-nowrap ${selectedNameDetail.name[0].length > 1 ? 'text-xl' : 'text-2xl'}`}>
                            {/* 🔥 복성일 경우 name 전체에서 이름 길이를 뺀 앞부분을 성으로 인식! */}
                            {selectedNameDetail.name.length === 4 ? selectedNameDetail.name.substring(0, 2) : selectedNameDetail.name[0]}
                          </span>
                          <span className={`font-serif text-slate-900 tracking-tighter whitespace-nowrap ${selectedNameDetail.familyNameHanja?.hanja.length > 1 ? 'text-3xl' : 'text-4xl'}`}>
                            {selectedNameDetail.familyNameHanja?.hanja || selectedNameDetail.hanja[0]}
                          </span>
                          
                          {/* 🌟 뜻 풀이 (글자가 길어지면 줄바꿈 허용) */}
                          <span className="text-[10px] font-bold text-slate-500 text-center break-keep leading-tight min-h-[30px] flex items-center">
                            {selectedNameDetail.familyNameHanja?.meaning || '뜻 정보 없음'}
                          </span>
                          
                          {/* 🌟 오행 컬러 동적 변경 */}
                          <span className={`mt-1 text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full text-center shadow-sm ${
                            selectedNameDetail.familyNameHanja?.element_jayeon === '목' ? 'bg-green-500' :
                            selectedNameDetail.familyNameHanja?.element_jayeon === '화' ? 'bg-red-500' :
                            selectedNameDetail.familyNameHanja?.element_jayeon === '토' ? 'bg-yellow-600' :
                            selectedNameDetail.familyNameHanja?.element_jayeon === '금' ? 'bg-slate-400' :
                            selectedNameDetail.familyNameHanja?.element_jayeon === '수' ? 'bg-blue-500' : 'bg-[#C19A5B]'
                          }`}>
                            {selectedNameDetail.familyNameHanja?.element_jayeon || '모름'}
                          </span>
                        </div>

                        {/* 2. 이름 글자 영역 */}
                        {selectedNameDetail.firstNameHanjaDetails?.map((hanjaInfo: any, idx: number) => {
                           // 복성일 경우 이름의 시작 인덱스를 조정
                           const nameOffset = selectedNameDetail.name.length === 4 ? 2 : 1; 
                           return (
                            <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 max-w-[33%]">
                              <span className="text-2xl font-black text-slate-800">{selectedNameDetail.name[idx + nameOffset]}</span>
                              <span className="text-4xl font-serif text-slate-900">{hanjaInfo.hanja}</span>
                              
                              {/* 🌟 뜻 풀이 */}
                              <span className="text-[10px] font-bold text-slate-500 text-center break-keep leading-tight min-h-[30px] flex items-center">
                                {hanjaInfo.meaning || '뜻 정보 없음'}
                              </span>
                              
                              {/* 🌟 오행 컬러 동적 변경 */}
                              <span className={`mt-1 text-[10px] font-bold text-white px-2.5 py-0.5 rounded-full text-center shadow-sm ${
                                hanjaInfo.element_jayeon === '목' ? 'bg-green-500' :
                                hanjaInfo.element_jayeon === '화' ? 'bg-red-500' :
                                hanjaInfo.element_jayeon === '토' ? 'bg-yellow-600' :
                                hanjaInfo.element_jayeon === '금' ? 'bg-slate-400' :
                                hanjaInfo.element_jayeon === '수' ? 'bg-blue-500' : 'bg-[#C19A5B]'
                              }`}>
                                {hanjaInfo.element_jayeon}
                              </span>
                            </div>
                           );
                        })}
                      </div>

                      <div className="mb-8 relative z-10">
                        <table className="w-full text-center text-[11px] border-collapse border border-[#E6D5B8]">
                          <thead>
                            <tr className="bg-[#F5EFE6] text-[#8C6D46]">
                              <th className="border border-[#E6D5B8] py-2 font-bold">오행</th>
                              <th className="border border-[#E6D5B8] py-2">木</th>
                              <th className="border border-[#E6D5B8] py-2">火</th>
                              <th className="border border-[#E6D5B8] py-2">土</th>
                              <th className="border border-[#E6D5B8] py-2">金</th>
                              <th className="border border-[#E6D5B8] py-2">水</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-[#E6D5B8] py-2 font-bold text-slate-600 bg-white">사주</td>
                              {['목', '화', '토', '금', '수'].map((el) => {
                                const count = selectedNameDetail.sajuData?.elementsCount?.[el] || 0;
                                const isMissing = count === 0;
                                return (
                                  <td key={el} className={`border border-[#E6D5B8] py-2 ${isMissing ? 'text-red-500 font-bold bg-red-50/50' : 'text-slate-600 bg-white'}`}>
                                    {count}
                                  </td>
                                );
                              })}
                            </tr>
                            <tr>
                              <td className="border border-[#E6D5B8] py-2 font-bold text-slate-600 bg-white">이름</td>
                              {['목', '화', '토', '금', '수'].map((el) => {
                                const nameElements = [
                                  selectedNameDetail.familyNameHanja?.element_jayeon, // 👈 여기 변경!
                                  ...(selectedNameDetail.firstNameHanjaDetails?.map((h: any) => h.element_jayeon) || []) // 👈 여기 변경!
                                ];
                                const addedCount = nameElements.filter(e => e === el).length;
                                return (
                                  <td key={`name-${el}`} className="border border-[#E6D5B8] py-2 bg-white">
                                    {addedCount > 0 ? <span className="font-serif text-base text-[#C19A5B] font-bold">+{addedCount}</span> : <span className="text-slate-300">-</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                        
                        {/* 🔥 [수정됨] prescriptionReason (처방 사유) 출력 부분 */}
                        <p className="text-[10px] text-slate-600 mt-3 text-center break-keep leading-relaxed bg-white/50 p-2 rounded">
                          {selectedNameDetail.sajuData?.prescriptionReason || "사주의 균형이 좋아 어떤 이름이든 잘 어울립니다."}
                        </p>
                      </div>

                      <div className="text-center mt-8 relative z-10">
                        <p className="text-[11px] text-slate-700 font-bold leading-relaxed mb-5">
                          위와 같이 '{selectedNameDetail.name}'은(는) 정통 성명학 원칙에 따라<br/>
                          {(() => {
                            const score = selectedNameDetail.score || 0;
                            if (score >= 90) {
                              return <span className="text-pink-600 font-black">작명된 대길(大吉)한 이름임을 인증합니다.</span>;
                            } else if (score >= 80) {
                              return <span className="text-blue-600 font-black">작명된 길(吉)한 이름임을 인증합니다.</span>;
                            } else {
                              return <span>정밀 감정이 완료된 이름임을 인증합니다.</span>;
                            }
                          })()}
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-sm font-black text-slate-800 tracking-widest">봄이옴 작명 연구소</span>
                          <div className="w-10 h-10 border-[2px] border-red-600/90 rounded flex items-center justify-center transform -rotate-3 opacity-90">
                            <span className="text-red-600/90 font-serif text-[10px] font-black leading-tight text-center">봄이옴<br/>작명</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><Activity size={18} className="text-blue-500"/> 전문가 종합 감정평</h3>
                    <div className="space-y-3">
                      {selectedNameDetail.details?.reports?.map((r: string, i: number) => {
                        const isWarning = r.includes('아쉽') || r.includes('흉') || r.includes('경고');
                        return (
                          <div key={i} className={`p-3 rounded-xl border ${isWarning ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                            <p className="text-[13px] leading-relaxed break-keep font-medium">
                              <span className="font-black mr-1">{isWarning ? '⚠️' : '✅'}</span> {r}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-800 mb-3 flex items-center gap-1.5"><Sparkles size={18} className="text-pink-500"/> 발음/수리 음양 배합</h3>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 text-left">발음 오행 (초성)</span>
                        <div className="flex gap-2">
                          {selectedNameDetail.name.split('').map((char: string, i: number) => {
                            const soundEl = getSoundElement(char);
                            return (
                              <div key={i} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600 border border-slate-200">
                                {char}({soundEl})
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 text-left">수리 음양 (획수)</span>
                        <div className="flex gap-2">
                          {[
                            selectedNameDetail.familyNameHanja?.won_strokes,
                            selectedNameDetail.firstNameHanjaDetails?.[0]?.won_strokes || 0,
                            selectedNameDetail.firstNameHanjaDetails?.[1]?.won_strokes || 0
                          ].map((s, i) => {
                            if (!s) return null;
                            const isYang = s % 2 !== 0; 
                            return (
                              <div key={i} className={`px-2.5 py-1 rounded text-[10px] font-black border ${isYang ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                                {isYang ? '陽(홀)' : '陰(짝)'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {(() => {
                        // 🔥 음양 조화 평가 문구용 데이터도 won_strokes로 수정!
                        const s1 = selectedNameDetail.familyNameHanja?.won_strokes || 0; 
                        const s2 = selectedNameDetail.firstNameHanjaDetails?.[0]?.won_strokes || 0;
                        const s3 = selectedNameDetail.firstNameHanjaDetails?.[1]?.won_strokes || 0;
                        
                        if (!s1 || !s2) return null;
                        
                        const isAllYin = s1 % 2 === 0 && s2 % 2 === 0 && (s3 ? s3 % 2 === 0 : true);
                        const isAllYang = s1 % 2 !== 0 && s2 % 2 !== 0 && (s3 ? s3 % 2 !== 0 : true);
                        
                        if (isAllYin) return <p className="text-[11px] text-rose-500 font-bold leading-relaxed break-keep mt-2">⚠️ 기운이 음(陰)으로만 치우쳐 있어 성명학적으로 흉(凶)한 배합입니다.</p>;
                        if (isAllYang) return <p className="text-[11px] text-rose-500 font-bold leading-relaxed break-keep mt-2">⚠️ 기운이 양(陽)으로만 치우쳐 있어 성명학적으로 흉(凶)한 배합입니다.</p>;
                        return <p className="text-[11px] text-slate-400 leading-relaxed break-keep mt-2">음(陰)과 양(陽)의 기운이 어느 한쪽으로 치우치지 않고 태극처럼 완벽한 조화를 이룹니다.</p>;
                      })()}
                    </div>
                  </div>

                  {selectedNameDetail.details?.suriDetails?.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                      <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> 81수리 생애 운세 분석</h3>
                      <div className="space-y-5">
                        {selectedNameDetail.details.suriDetails.map((s: any, i: number) => (
                          <div key={i} className="border-l-[3px] border-orange-400 pl-3">
                            <div className="flex justify-between items-end mb-1.5">
                              <div>
                                <span className="text-[10px] font-bold text-orange-500 block mb-0.5">{s.name}</span>
                                <span className="font-black text-slate-800 text-sm">{s.val}획 {s.res.title}</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.res.isGood ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                                {s.res.isGood ? '吉' : '凶'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed break-keep">{s.res.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-white via-white/95 to-transparent pb-[calc(1.5rem+env(safe-area-bottom))] z-20">
                  <button onClick={() => alert('가족 공유 기능은 업데이트 예정입니다!')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg active:scale-95 transition-transform shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex justify-center items-center gap-2">
                    가족들에게 감정서 공유하기
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}