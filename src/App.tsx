import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, MapPin, ArrowLeft, ChevronRight, CheckCircle2, Building2,
  User as UserIcon, LogOut, MessageCircle, X, Home, Trophy, Gift,
  ChevronDown, Flower2, Smile, Info, Send, ListFilter, Edit3, Calendar, Users, Baby, Globe,
  Shield, HeartHandshake, ArrowRight, ShoppingBag, Heart, PieChart,
  Camera, Image as ImageIcon, Sun, CloudRain, Snowflake, Wind, AlertCircle, Check, 
  Lock, Unlock, Upload, FileText, ShoppingCart, ListChecks
} from 'lucide-react';

// 🔥 limit 추가
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, arrayUnion, deleteDoc, limit, getDoc, setDoc, writeBatch, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // 🔥 [추가] 영수증 업로드용 Storage
// 🔥 [추가] 통계를 위한 모듈 임포트
import { getAnalytics, logEvent } from "firebase/analytics";

import logoImg from './assets/bomiom_logo.png';

import { Benefit, User } from './types';
import { loadBenefitsSmart, registerUserToSheet, fetchUserActionHistory, saveInquiryToSheet, getUserFromSheet, getStatsData, fetchNaverTrend, fetchNameRankingsFromSheet, getMallItems, getHelpers, generateInviteCode, linkCoupleAccount, fetchYoutubeVideos } from './services/benefitService';
import { getCurrentUser, logoutUser } from './services/authService';
import { BenefitCard } from './components/BenefitCard';
import { SkeletonList } from './components/SkeletonCard';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import GardenPage from './components/GardenPage';
import { db, storage, analytics } from './firebase';
import { Map, CustomOverlayMap, MarkerClusterer, useKakaoLoader } from 'react-kakao-maps-sdk';
import initialCareData from './data.json';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getAuth, OAuthProvider, signInWithCredential, deleteUser } from 'firebase/auth';
import AdminReportPage from './AdminReportPage';
import FinchMain from './components/FinchMain';

// 🔥 [만능 외부 링크 탈출 함수] 앱이면 사파리로 띄우고, 웹이면 새 창으로 띄움
export const openExternalLink = (url: string) => {
  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
    // 앱(App.js)에게 "이 주소는 사파리로 열어줘!" 라고 지시
    (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'OPEN_EXTERNAL_URL', url }));
  } else {
    // 웹 브라우저 환경
    window.location.href = url;
  }
};

// ✅ [여기에 추가!] 만능 애플 로그인 실행 함수
export const handleAppleLogin = () => {
  if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
    (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'APPLE_LOGIN_REQUEST' }));
  } else {
    alert('애플 로그인은 봄이옴 아이폰 앱에서만 지원됩니다 🍎');
  }
};

// 🔥 N 뱃지 실시간 감지를 위한 Custom Hook (여기에 추가!)
const useBoardNewBadge = (boardName: string) => {
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    if (!db || !boardName) return; // 🔥 db 방어코드 추가
    const collectionName = `boards_${boardName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`;
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const createdAt = data.createdAt?.toMillis?.() || 0;
        const lastRead = Number(localStorage.getItem(`lastRead_${collectionName}`) || 0);
        setIsNew(createdAt > lastRead);
      }
    });
    return () => unsub();
  }, [boardName]);
  return isNew;
};

// ==========================================
// 1. 기본 데이터 및 유틸 함수 설정
// ==========================================

const SIDO_LIST = ['전체','서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','충남','충북','전남','전북','경남','경북','제주'];

const AVATAR_LIST = [
  "👩", "👨", "🧑", "👧", "👦", "👵", "👴", "👱‍♀️", "👱‍♂️", "🕵️‍♀️",
  "👩‍⚕️", "👨‍⚕️", "👩‍🌾", "👨‍🌾", "👩‍🍳", "👨‍🍳", "👩‍🎤", "👨‍🎤", "👩‍🎨", "👨‍🎨",
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯"
];

// 🔥 [추가] 출산·육아템 베이비페어 카테고리 데이터
const BABY_FAIR_CATEGORIES: any = {
  '1_safety': {
    title: '1순위: 대형/안전',
    rationale: '가장 비싸고 배송이 오래 걸려요! 지금 예약해야 출산 전 도착합니다.',
    // 💡 바구니카시트 삭제 -> 기저귀 갈이대, 아기 매트, 아기 의자 추가
    filters: ['유모차', '카시트', '아기침대', '기저귀 갈이대', '아기매트', '아기의자']
  },
  '2_fabric': {
    title: '2순위: 의류/패브릭',
    rationale: '미리 세탁하고 건조할 시간이 필요해요. 최소 3번 세탁은 필수!',
    filters: ['손수건', '배냇저고리', '속싸개', '아기이불']
  },
  '3_appliance': {
    title: '3순위: 육아 가전',
    rationale: '소독기나 분유포트는 한 번 사면 매일 쓰는 필수템! 스펙을 비교하세요.',
    filters: ['젖병소독기', '분유포트', '홈캠', '가습기']
  },
  '4_hygiene': {
    title: '4순위: 수유/위생',
    rationale: '기저귀, 젖병 등 소모품입니다. 국민템 위주로 핫딜 뜰 때 쟁이세요!',
    // 💡 아기 세탁세제, 아기 주방세제 추가
    filters: ['젖병', '기저귀', '물티슈', '아기욕조', '바디워시', '세탁세제', '주방세제']
  }
};

const REGION_DATA: any = {
  '서울': { '강남구': [], '강동구': [], '강북구': [], '강서구': [], '관악구': [], '광진구': [], '구로구': [], '금천구': [], '노원구': [], '도봉구': [], '동대문구': [], '동작구': [], '마포구': [], '서대문구': [], '서초구': [], '성동구': [], '성북구': [], '송파구': [], '양천구': [], '영등포구': [], '용산구': [], '은평구': [], '종로구': [], '중구': [], '중랑구': [] },
  '경기': { '수원시': ['장안구', '권선구', '팔달구', '영통구'], '성남시': ['수정구', '중원구', '분당구'], '의정부시': [], '안양시': ['만안구', '동안구'], '부천시': [], '광명시': [], '평택시': [], '동두천시': [], '안산시': ['상록구', '단원구'], '고양시': ['덕양구', '일산동구', '일산서구'], '과천시': [], '구리시': [], '남양주시': [], '오산시': [], '시흥시': [], '군포시': [], '의왕시': [], '하남시': [], '용인시': ['처인구', '기흥구', '수지구'], '파주시': [], '이천시': [], '안성시': [], '김포시': [], '화성시': [], '광주시': [], '양주시': [], '포천시': [], '여주시': [], '연천군': [], '가평군': [], '양평군': [] },
  '인천': { '중구': [], '동구': [], '미추홀구': [], '연수구': [], '남동구': [], '부평구': [], '계양구': [], '서구': [], '강화군': [], '옹진군': [] },
  '부산': { '중구': [], '서구': [], '동구': [], '영도구': [], '부산진구': [], '동래구': [], '남구': [], '북구': [], '해운대구': [], '사하구': [], '금정구': [], '강서구': [], '연제구': [], '수영구': [], '사상구': [], '기장군': [] },
  '대구': { '중구': [], '동구': [], '서구': [], '남구': [], '북구': [], '수성구': [], '달서구': [], '달성군': [], '군위군': [] },
  '광주': { '동구': [], '서구': [], '남구': [], '북구': [], '광산구': [] },
  '대전': { '동구': [], '중구': [], '서구': [], '유성구': [], '대덕구': [] },
  '울산': { '중구': [], '남구': [], '동구': [], '북구': [], '울주군': [] },
  '세종': { '세종시': [] },
  '강원': { '춘천시': [], '원주시': [], '강릉시': [], '동해시': [], '태백시': [], '속초시': [], '삼척시': [], '홍천군': [], '횡성군': [], '영월군': [], '평창군': [], '정선군': [], '철원군': [], '화천군': [], '양구군': [], '인제군': [], '고성군': [], '양양군': [] },
  '충북': { '청주시': ['상당구', '서원구', '흥덕구', '청원구'], '충주시': [], '제천시': [], '보은군': [], '옥천군': [], '영동군': [], '증평군': [], '진천군': [], '괴산군': [], '음성군': [], '단양군': [] },
  '충남': { '천안시': ['동남구', '서북구'], '공주시': [], '보령시': [], '아산시': [], '서산시': [], '논산시': [], '계룡시': [], '당진시': [], '금산군': [], '부여군': [], '서천군': [], '청양군': [], '홍성군': [], '예산군': [], '태안군': [] },
  '전북': { '전주시': ['완산구', '덕진구'], '군산시': [], '익산시': [], '정읍시': [], '남원시': [], '김제시': [], '완주군': [], '진안군': [], '무주군': [], '장수군': [], '임실군': [], '순창군': [], '고창군': [], '부안군': [] },
  '전남': { '목포시': [], '여수시': [], '순천시': [], '나주시': [], '광양시': [], '담양군': [], '곡성군': [], '구례군': [], '고흥군': [], '보성군': [], '화순군': [], '장흥군': [], '강진군': [], '해남군': [], '영암군': [], '무안군': [], '함평군': [], '영광군': [], '장성군': [], '완도군': [], '진도군': [], '신안군': [] },
  '경북': { '포항시': ['남구', '북구'], '경주시': [], '김천시': [], '안동시': [], '구미시': [], '영주시': [], '영천시': [], '상주시': [], '문경시': [], '경산시': [], '의성군': [], '청송군': [], '영양군': [], '영덕군': [], '청도군': [], '고령군': [], '성주군': [], '칠곡군': [], '예천군': [], '봉화군': [], '울진군': [], '울릉군': [] },
  '경남': { '창원시': ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'], '진주시': [], '통영시': [], '사천시': [], '김해시': [], '밀양시': [], '거제시': [], '양산시': [], '의령군': [], '함안군': [], '창녕군': [], '고성군': [], '남해군': [], '하동군': [], '산청군': [], '함양군': [], '거창군': [], '합천군': [] },
  '제주': { '제주시': [], '서귀포시': [] }
};

const normalizeSido = (s: string) => {
  const v = (s || '').trim().replace(/\s/g, ''); 
  if (v.startsWith('서울')) return '서울';
  if (v.startsWith('경기')) return '경기';
  if (v.startsWith('인천')) return '인천';
  if (v.startsWith('부산')) return '부산';
  if (v.startsWith('대구')) return '대구';
  if (v.startsWith('광주')) return '광주';
  if (v.startsWith('대전')) return '대전';
  if (v.startsWith('울산')) return '울산';
  if (v.startsWith('세종')) return '세종';
  if (v.startsWith('강원')) return '강원';
  if (v.startsWith('충') && v.includes('남')) return '충남';
  if (v.startsWith('충') && v.includes('북')) return '충북';
  if (v.startsWith('전') && v.includes('남')) return '전남';
  if (v.startsWith('전') && v.includes('북')) return '전북';
  if (v.startsWith('경') && v.includes('남')) return '경남';
  if (v.startsWith('경') && v.includes('북')) return '경북';
  if (v.startsWith('제주')) return '제주';
  return v;
};

const normalizeStr = (s: string) => (s || '').replace(/\s/g, '').toLowerCase();

const checkRegionMatch = (benefit: Benefit, userSido: string, userSigugun: string, userDetail: string) => {
  const bSido = normalizeSido(benefit.sido);
  const uSido = normalizeSido(userSido);
  if (bSido !== uSido) return false;
  if (benefit.sigugun) {
    const bSigugun = normalizeStr(benefit.sigugun);
    const uSigugun = normalizeStr(userSigugun);
    if (bSigugun !== uSigugun) return false;
    if (benefit.regionTarget) {
       const bTarget = normalizeStr(benefit.regionTarget);
       const uDetail = normalizeStr(userDetail);
       if (bTarget !== uDetail) return false;
    }
  }
  return true;
};

const getUserAvatar = (userId: string) => {
  if (!userId) return AVATAR_LIST[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_LIST[Math.abs(hash) % AVATAR_LIST.length];
};

const calculatePregnancyWeek = (dueDate: string) => {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
  const currentDays = 280 - diffDays;
  if (currentDays < 0) return 0;
  if (currentDays > 280) return 40;
  return Math.floor(currentDays / 7);
};

// 🔥 [여기에 추가!] 날짜 기반의 정확한 D-Day 계산 함수
const calculateDDay = (dueDate: string) => {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 시간 오차를 없애기 위해 자정으로 초기화
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
  return diffDays;
};

// 📝 [레지스트리 데이터 가이드라인] (21개 항목)
const REGISTRY_GUIDE = [
  { category: "1순위: 대형/안전", items: [
    { name: "유모차", guide: "1대 (디럭스/절충형. 핸들링 후 예약 필수)" },
    { name: "카시트", guide: "1대 (회전형 새제품 추천, 바구니형은 대여)" },
    { name: "아기침대", guide: "1개 (원목/범퍼. 사용기간이 짧아 당근 추천)" },
    { name: "기저귀 갈이대", guide: "1개 (출산 후 산모 손목/허리 보호 필수템)" },
    { name: "아기매트", guide: "거실용 (층간 소음 및 안전용. 폴더/시공매트)" },
    { name: "아기의자", guide: "1개 (이유식 시작 6개월 전후 구매 추천)" }
  ]},
  { category: "2순위: 의류/패브릭", items: [
    { name: "손수건", guide: "최소 40장 (거즈 20장 + 엠보싱 20장)" },
    { name: "배냇저고리", guide: "3~5벌 (조리원 퇴소 후 한 달간 착용)" },
    { name: "속싸개", guide: "3장 (모로반사 방지용. 스와들업 혼합)" },
    { name: "아기이불", guide: "쿨매트 1개 + 얇은 블랭킷 2장 (질식주의)" }
  ]},
  { category: "3순위: 육아 가전", items: [
    { name: "젖병소독기", guide: "1대 (UV 또는 스팀형. 맘마존 핵심)" },
    { name: "분유포트", guide: "1대 (1도 단위 온도 조절 필수)" },
    { name: "홈캠", guide: "1대 (분리수면 및 산후도우미 모니터링용)" },
    { name: "가습기", guide: "1대 (대용량 가열/자연기화. 습도 50~60%)" }
  ]},
  { category: "4순위: 수유/위생", items: [
    { name: "젖병", guide: "160ml 2~4개 (배앓이 확인 후 추가 구매)" },
    { name: "기저귀", guide: "신생아용(1단계) 2~3팩 (금방 크니 대량금지)" },
    { name: "물티슈", guide: "1~2박스 (70평량 이상 도톰한 신생아 전용)" },
    { name: "아기욕조", guide: "신생아용 2개 (씻기용 1개, 헹굼용 1개)" },
    { name: "바디워시", guide: "1개 (머리부터 발끝까지 탑투토 워시)" },
    { name: "세탁세제", guide: "1통 (무향, 잔여물 없는 유아 전용)" },
    { name: "주방세제", guide: "1통 (1종 젖병 세정제. 거품형 추천)" }
  ]}
];

// 📊 [출산 준비 1페이지 레포트 모달]
const RegistryReportModal = ({ registryData = {}, onClose }: any) => {
  const totalItems = REGISTRY_GUIDE.reduce((acc, cat) => acc + cat.items.length, 0);
  const preparedCount = Object.values(registryData).filter((v: any) => v.isPrepared).length;
  const progress = Math.round((preparedCount / totalItems) * 100) || 0;

  return (
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in font-pretendard">
      <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-start sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black text-gray-900">부부의 출산 준비 리포트</h2>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm font-bold text-orange-600">진행률 {progress}%</span>
              <div className="flex-1 w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="bg-gray-100 text-gray-500 p-2 rounded-full active:scale-95"><X size={18}/></button>
        </header>

        <main className="flex-1 overflow-y-auto p-5 space-y-8 pb-10">
          {REGISTRY_GUIDE.map((cat, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span> {cat.category}
              </h3>
              <div className="grid grid-cols-1 gap-2.5">
                {cat.items.map(item => {
                  const status = registryData[item.name];
                  const isDone = status?.isPrepared;
                  return (
                    <div key={item.name} className={`flex flex-col p-3.5 rounded-2xl border-2 transition-all ${isDone ? 'bg-orange-50 border-orange-200 opacity-80' : 'bg-white border-gray-100 shadow-sm'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-sm ${isDone ? 'text-orange-900 line-through decoration-orange-300' : 'text-gray-800'}`}>{item.name}</span>
                          {isDone && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-black">완료</span>}
                        </div>
                        {isDone ? <Check size={18} className="text-orange-500" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-200"></div>}
                      </div>
                      {isDone && status?.brandName ? (
                        <p className="text-xs text-orange-700 mt-1.5 font-bold">👉 결정: {status.brandName}</p>
                      ) : (
                        <p className={`text-[11px] mt-1.5 leading-relaxed break-keep ${isDone ? 'text-orange-600/70' : 'text-rose-500 font-medium'}`}>
                          {item.guide}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

// ==========================================
// 🌟 카카오 애드핏 네이티브 광고 (혜택 카드용)
// ==========================================
const KakaoAdFit = ({ unit }: { unit: string }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 기존에 남아있는 광고 관련 요소를 깔끔하게 초기화
    if (adRef.current) {
      adRef.current.innerHTML = '';
    }

    // 2. 카카오 광고 ins 태그를 자바스크립트로 직접 생성
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-width', '320');
    ins.setAttribute('data-ad-height', '100');
    ins.setAttribute('data-ad-unit', unit);

    // 3. 카카오 광고 스크립트 태그 생성
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;

    // 4. 준비해둔 빈 공간(div)에 ins와 script를 순서대로 주입!
    if (adRef.current) {
      adRef.current.appendChild(ins);
      adRef.current.appendChild(script);
    }
  }, [unit]);

  return (
    <div className="w-full flex justify-center items-center mt-2 mb-2">
      {/* 리액트가 렌더링하지 않고, useEffect에서 자바스크립트로 채워넣을 빈 공간 */}
      <div ref={adRef} className="w-full flex justify-center"></div>
    </div>
  );
};

// ==========================================
// 🌟 카카오 애드핏 다목적 띠 배너 (여정, 맘스픽용)
// ==========================================
// 🌟 카카오 애드핏 다목적 띠 배너 (여정, 맘스픽용) - React 탭 이동 완벽 대응 (최종)
const KakaoAdBanner = ({ unit, width, height }: { unit: string, width: string, height: string }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adRef.current) {
      adRef.current.innerHTML = '';
    }

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-width', width);
    ins.setAttribute('data-ad-height', height);
    ins.setAttribute('data-ad-unit', unit);

    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;

    if (adRef.current) {
      adRef.current.appendChild(ins);
      adRef.current.appendChild(script);
    }
  }, [unit, width, height]);

  return (
    <div className="w-full flex justify-center items-center mt-6 mb-2">
      {/* 빈 공간 */}
      <div ref={adRef} className="w-full flex justify-center"></div>
    </div>
  );
};

// ==========================================
// 2. 공통 UI 및 모달 컴포넌트
// ==========================================

const KakaoMapWrapper = ({ address, name }: { address: string, name: string }) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initMap = () => {
      const kakao = (window as any).kakao;
      kakao.maps.load(() => {
        if (!mapRef.current) return;
        const mapOption = { center: new kakao.maps.LatLng(37.566826, 126.9786567), level: 3 };
        const map = new kakao.maps.Map(mapRef.current, mapOption);
        const geocoder = new kakao.maps.services.Geocoder();

        geocoder.addressSearch(address, function(result: any, status: any) {
          if (status === kakao.maps.services.Status.OK) {
            const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
            const marker = new kakao.maps.Marker({ map: map, position: coords });
            const infowindow = new kakao.maps.InfoWindow({
              content: `<div style="width:150px;text-align:center;padding:6px 0;font-size:12px;font-weight:bold;color:#333;border:none;">${name}</div>`
            });
            infowindow.open(map, marker);
            map.setCenter(coords);
          }
        });
      });
    };

    if ((window as any).kakao && (window as any).kakao.maps) {
      initMap();
    } else {
      if (document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk.js"]')) {
          const checkReady = setInterval(() => {
            if ((window as any).kakao && (window as any).kakao.maps) {
                clearInterval(checkReady);
                initMap();
            }
          }, 100);
          return;
      }
      
      // 🔥 [수정 3] 백엔드를 거치지 않고, 프론트에서 카카오 키를 직접 주입하여 지도를 바로 띄웁니다!
      const script = document.createElement('script');
      script.id = 'kakao-map-script';
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=cef1d01b84acf6b64cabac2fc6c3df18&libraries=services,clusterer&autoload=false`;
      document.head.appendChild(script);
      script.onload = () => { 
          (window as any).kakao.maps.load(() => {
            initMap(); 
          });
      };
    }
  }, [address, name]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 0 }}></div>;
};

const BoardCard = ({ icon, title, desc, onClick }: any) => {
  const isNew = useBoardNewBadge(title); // 🔥 새 글 감지
  return (
    <div onClick={onClick} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:border-pink-200 transition-colors flex items-start gap-3 relative">
       {/* 🔥 새 글 N 뱃지 표시 */}
       {isNew && <span className="absolute top-3 right-3 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse z-10">N</span>}
       <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 text-xl border border-gray-100">{icon}</div>
       <div>
        <h4 className="font-bold text-gray-800 text-sm mb-0.5">{title}</h4>
        <p className="text-xs text-gray-500 leading-snug">{desc}</p>
      </div>
  </div>
  );
};

const SeniorPrompt = ({ currentWeek, targetWeek, question, reward }: any) => {
  if (currentWeek <= targetWeek) return null;
  return (
    <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-4 rounded-2xl border border-pink-100 flex items-center justify-between shadow-sm mb-4 cursor-pointer hover:shadow-md transition-all">
      <div>
        <p className="text-[10px] font-bold text-pink-500 mb-1 flex items-center gap-1"><span className="animate-pulse">✨</span> 선배 산모님의 도움이 필요해요!</p>
        <p className="text-sm font-bold text-gray-800">{question}</p>
        <p className="text-xs text-gray-500 mt-1">{reward}</p>
      </div>
      <ChevronRight className="text-pink-300"/>
    </div>
  );
};

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '💪'];

const getUserMetaStr = (u: any) => {
  if (!u) return '익명산모';
  const region = u.address ? u.address.split(' ').slice(0, 2).join(' ') : '지역미상';
  const week = calculatePregnancyWeek(u.dueDate);
  const weekStr = !u.dueDate ? '예비맘' : (week > 40 ? '선배맘' : `${week}주차`);
  const genderStr = u.babyGender ? ` ${u.babyGender}` : '';
  return `${u.nickname} (${region} | ${weekStr}${genderStr})`;
};

const BoardOverlay = ({ title, onClose, user }: any) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'WRITE' | 'DETAIL'>('LIST');
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeImage, setWriteImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [commentInput, setCommentInput] = useState('');

  const [chatInput, setChatInput] = useState('');
  const isChatMode = title.includes('수다방');
  
  // 🔥 관리자 권한 확인 (대소문자/필드명 예외처리 강화 및 닉네임으로도 관리자 부여)
  const isAdmin = String(user?.admin || (user as any)?.Admin || '').trim().toLowerCase() === 'admin' || 
                  user?.nickname === '관리자' || user?.nickname === '봄이옴 관리자';

  const collectionName = `boards_${title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`;

  useEffect(() => {
    if (!db) return; // 🔥 db 방어코드 추가
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(data);
      
      // 🔥 게시판 열람 시 '마지막 읽은 시간' 저장 (N 뱃지 사라짐 처리)
      if (snapshot.docs.length > 0) {
        const latestTime = snapshot.docs[0].data().createdAt?.toMillis?.() || Date.now();
        localStorage.setItem(`lastRead_${collectionName}`, latestTime.toString());
      }

      if (selectedPost) {
        const updatedPost = data.find(p => p.id === selectedPost.id);
        if (updatedPost) setSelectedPost(updatedPost);
        else { setViewMode('LIST'); setSelectedPost(null); }
      }
    });
    return () => unsubscribe();
  }, [title, selectedPost?.id]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const lowerQ = searchQuery.toLowerCase();
    return posts.filter(p => 
      (p.title || '').toLowerCase().includes(lowerQ) || 
      (p.content || '').toLowerCase().includes(lowerQ) ||
      (p.comments || []).some((c:any) => c.text.toLowerCase().includes(lowerQ))
    );
  }, [posts, searchQuery]);

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('사진 용량이 너무 큽니다. (최대 5MB 이하)');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setWriteImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePostSubmit = async () => {
    if (!writeTitle.trim() || !writeContent.trim()) return;
    setIsSubmitting(true);
    try {
      if (editingPostId) {
        await updateDoc(doc(db, collectionName, editingPostId), { title: writeTitle, content: writeContent, image: writeImage });
        setViewMode('DETAIL');
        setEditingPostId(null);
      } else {
        const newPost = {
          userId: user?.id,
          title: writeTitle,
          content: writeContent,
          image: writeImage,
          userMeta: getUserMetaStr(user),
          time: new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          createdAt: serverTimestamp(),
          comments: [],
          reactions: {}
        };
        await addDoc(collection(db, collectionName), newPost);
        setViewMode('LIST');
      }
      setWriteTitle(''); setWriteContent(''); setWriteImage('');
    } catch (e) { alert('업로드 실패'); }
    setIsSubmitting(false);
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, collectionName, postId));
        setViewMode('LIST');
        setSelectedPost(null);
      } catch (e) { alert('삭제 실패'); }
    }
  };

  const handleCommentSubmit = async (e: any) => {
    e.preventDefault();
    if (!commentInput.trim() || !selectedPost) return;
    const newComment = {
      id: Date.now().toString(),
      userId: user?.id,
      userMeta: getUserMetaStr(user),
      text: commentInput,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    try {
      await updateDoc(doc(db, collectionName, selectedPost.id), { comments: arrayUnion(newComment) });
      setCommentInput('');
    } catch (e) { alert('댓글 달기 실패'); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    const updatedComments = selectedPost.comments.filter((c:any) => c.id !== commentId);
    try {
      await updateDoc(doc(db, collectionName, selectedPost.id), { comments: updatedComments });
    } catch(e) { alert('댓글 삭제 실패'); }
  };

  const handleReaction = async (emoji: string) => {
    if (!selectedPost) return;
    const currentReactions = selectedPost.reactions || {};
    const newCount = (currentReactions[emoji] || 0) + 1;
    try { await updateDoc(doc(db, collectionName, selectedPost.id), { [`reactions.${emoji}`]: newCount }); } catch (e) {}
  };

  // 🔥 메신저 형태의 실시간 수다방 전용 UI
  if (isChatMode) {
    const handleChatSubmit = async (e: any) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      const newChat = {
        userId: user?.id,
        userMeta: getUserMetaStr(user),
        text: chatInput,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
      };
      setChatInput('');
      try { await addDoc(collection(db, collectionName), newChat); } catch (e) { alert('메시지 전송 실패'); }
    };

    const handleDeleteChat = async (chatId: string) => {
      if (!window.confirm('메시지를 삭제하시겠습니까?')) return;
      try { await deleteDoc(doc(db, collectionName, chatId)); } catch(e) { alert('삭제 실패'); }
    };

    return (
      <div className="fixed inset-0 z-[100] bg-[#f4f6f9] flex flex-col animate-fade-in">
        <header className="px-4 py-3 flex items-center justify-between border-b bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
            <h2 className="font-bold text-lg leading-tight text-gray-900">{title}</h2>
          </div>
        </header>
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-5 pb-24">
          {[...posts].reverse().map(p => {
            const isMe = p.userId === user?.id;
            return (
              <div key={p.id} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] font-bold text-gray-500 mb-1.5 mx-1">{p.userMeta}</span>
                <div className={`flex items-end gap-1.5 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed ${isMe ? 'bg-rose-500 text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm border border-gray-200'}`}>
                    {p.text}
                  </div>
                  <div className={`flex flex-col shrink-0 ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] text-gray-400 mb-1">{p.time}</span>
                    {(isMe || isAdmin) && (
                      <button onClick={() => handleDeleteChat(p.id)} className="text-[9px] text-rose-400 hover:text-rose-600">삭제</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {posts.length === 0 && <div className="text-center text-gray-400 py-10 text-sm">첫 메시지를 보내보세요!</div>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t pb-8 shadow-lg z-20">
           {/* 🔥 w-full 추가 및 input에 min-w-0 추가하여 모바일 화면 이탈 방지 */}
           <form onSubmit={handleChatSubmit} className="flex gap-2 w-full max-w-6xl mx-auto">
              <input type="text" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="가볍게 수다를 시작해보세요!" className="flex-1 min-w-0 bg-gray-100 px-4 py-3 rounded-full text-sm outline-none focus:ring-2 focus:ring-rose-200 transition-all"/>
              <button type="submit" disabled={!chatInput.trim()} className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm ${chatInput.trim() ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-gray-200 text-gray-400'}`}><Send size={18} className={chatInput.trim() ? 'ml-1' : ''}/></button>
           </form>
        </div>
      </div>
    );
  }

  // 🔥 일반 커뮤니티 게시판 UI
  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col animate-fade-in">
      <header className="px-4 py-3 flex items-center justify-between border-b bg-white shadow-sm sticky top-0 z-10">
         <div className="flex items-center gap-3">
           <button onClick={() => {
             if (viewMode === 'WRITE') {
               setViewMode(editingPostId ? 'DETAIL' : 'LIST');
               setEditingPostId(null); setWriteTitle(''); setWriteContent(''); setWriteImage('');
             } else if (viewMode === 'DETAIL') {
               setViewMode('LIST');
             } else {
               onClose();
             }
           }} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
           <h2 className="font-bold text-lg leading-tight text-gray-900 truncate max-w-[200px]">{title}</h2>
         </div>
         {viewMode === 'LIST' && (
           <button onClick={() => {
             setWriteTitle(''); setWriteContent(''); setWriteImage(''); setEditingPostId(null);
             setViewMode('WRITE');
           }} className="text-sm font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg">글쓰기</button>
         )}
      </header>

      {viewMode === 'LIST' && (
        <div className="flex-1 overflow-y-auto pb-safe">
          <div className="p-4 border-b bg-white sticky top-0 z-10">
            <div className="relative">
              <input type="text" placeholder="제목, 본문, 댓글 검색..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full p-3 pl-10 bg-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-200"/>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>
          <div className="p-4 space-y-3 pb-24">
            {filteredPosts.length === 0 ? (
              <div className="text-center text-gray-400 py-10 text-sm">게시글이 없습니다.</div>
            ) : (
              filteredPosts.map(p => {
                const totalReactions = Object.values(p.reactions || {}).reduce((a:any,b:any)=>a+b,0) as number;
                return (
                  <div key={p.id} onClick={() => { setSelectedPost(p); setViewMode('DETAIL'); }} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-rose-200 transition-all">
                    <h3 className="font-bold text-gray-800 text-base mb-1 truncate">{p.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">{p.content}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 border-t pt-2 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.userMeta}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* 🔥 관리자나 본인이면 리스트에서도 바로 삭제할 수 있는 버튼 추가 */}
                        {(p.userId === user?.id || isAdmin) && (
                          <button onClick={(e) => { e.stopPropagation(); handleDeletePost(p.id); }} className="text-rose-400 hover:text-rose-600 font-bold mr-1">삭제</button>
                        )}
                        <span className="flex items-center gap-1"><MessageCircle size={12}/> {p.comments?.length || 0}</span>
                        <span className="flex items-center gap-1"><Smile size={12}/> {totalReactions}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {viewMode === 'WRITE' && (
        <div className="flex-1 p-4 overflow-y-auto bg-white pb-24">
          <input type="text" placeholder="제목을 입력하세요" value={writeTitle} onChange={e=>setWriteTitle(e.target.value)} className="w-full text-lg font-bold text-gray-900 border-b p-3 mb-4 outline-none placeholder:text-gray-300"/>
          <textarea placeholder="궁금한 점이나 공유할 내용을 자세히 적어주세요!" value={writeContent} onChange={e=>setWriteContent(e.target.value)} className="w-full h-64 text-sm text-gray-800 outline-none resize-none leading-relaxed p-2"/>
          {writeImage && <div className="mb-4 relative w-32 h-32 rounded-xl overflow-hidden border"><img src={writeImage} alt="preview" className="w-full h-full object-cover"/><button onClick={()=>setWriteImage('')} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={14}/></button></div>}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
              <Camera size={16}/> 촬영 <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden"/>
            </label>
            <label className="cursor-pointer flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
              <ImageIcon size={16}/> 앨범 <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
            </label>
            <button onClick={handlePostSubmit} disabled={!writeTitle || !writeContent || isSubmitting} className="flex-1 bg-rose-500 text-white font-bold py-2.5 rounded-xl disabled:bg-gray-300 shadow-md ml-1">{editingPostId ? '수정하기' : '등록하기'}</button>
          </div>
        </div>
      )}

      {viewMode === 'DETAIL' && selectedPost && (
        <div className="flex-1 overflow-y-auto pb-24 bg-white flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">👩</div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{selectedPost.userMeta.split('(')[0]}</p>
                  <p className="text-[10px] text-gray-400">{selectedPost.userMeta.split('(')[1].replace(')','')} • {selectedPost.time}</p>
                </div>
              </div>
              {(selectedPost.userId === user?.id || isAdmin) && (
                <div className="flex items-center gap-1.5 mt-1 shrink-0">
                  {selectedPost.userId === user?.id && (
                    <button onClick={() => {
                      setWriteTitle(selectedPost.title);
                      setWriteContent(selectedPost.content);
                      setWriteImage(selectedPost.image || '');
                      setEditingPostId(selectedPost.id);
                      setViewMode('WRITE');
                    }} className="text-[11px] text-gray-500 hover:text-gray-700 bg-gray-100 px-2 py-1 rounded">수정</button>
                  )}
                  <button onClick={() => handleDeletePost(selectedPost.id)} className="text-[11px] text-rose-500 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded">삭제</button>
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 leading-tight">{selectedPost.title}</h2>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
            {selectedPost.image && <img src={selectedPost.image} alt="attached" className="w-full mt-4 rounded-xl border border-gray-100 shadow-sm" />}
            
            <div className="mt-8">
              <p className="text-[10px] font-bold text-gray-400 mb-2">이모티콘으로 반응 남기기</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => handleReaction(e)} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full text-sm hover:bg-rose-50 hover:border-rose-200 transition-colors">
                    <span>{e}</span> <span className="text-[11px] font-bold text-gray-600">{selectedPost.reactions?.[e] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-gray-50 p-5">
            <h4 className="font-bold text-sm text-gray-800 mb-4">댓글 <span className="text-rose-500">{selectedPost.comments?.length || 0}</span></h4>
            <div className="space-y-4">
              {selectedPost.comments?.map((c:any) => (
                <div key={c.id} className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">{c.userMeta.split('(')[0]}</span>
                      <span className="text-[9px] text-gray-400">{c.userMeta.split('(')[1].replace(')','')}</span>
                    </div>
                    {(c.userId === user?.id || isAdmin) && (
                      <button onClick={() => handleDeleteComment(c.id)} className="text-[10px] text-rose-500 hover:text-rose-700">삭제</button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t pb-8 shadow-lg z-20">
             {/* 🔥 w-full 및 min-w-0 추가 */}
             <form onSubmit={handleCommentSubmit} className="flex gap-2 w-full max-w-6xl mx-auto">
                <input type="text" value={commentInput} onChange={e=>setCommentInput(e.target.value)} placeholder="따뜻한 댓글을 남겨주세요..." className="flex-1 min-w-0 bg-gray-100 px-4 py-3 rounded-full text-sm outline-none focus:ring-2 focus:ring-rose-200 transition-all"/>
                <button type="submit" disabled={!commentInput.trim()} className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm ${commentInput.trim() ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-gray-200 text-gray-400'}`}><Send size={18} className={commentInput.trim() ? 'ml-1' : ''}/></button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

const InquiryModal = ({ onClose, addToast }: { onClose: () => void, addToast: (t: ToastType, m: string) => void }) => {
  const [formData, setFormData] = useState({ name: '', company: '', email: '', content: '' });
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.content) { addToast('error', '필수 정보를 입력해주세요.'); return; }
    setIsSending(true);
    try {
      await saveInquiryToSheet(formData);
      addToast('success', '문의가 성공적으로 접수되었습니다!');
      onClose();
    } catch (e) { addToast('error', '전송 실패. 다시 시도해주세요.'); } finally { setIsSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
        <h3 className="text-xl font-bold mb-1 text-gray-900">제휴 문의</h3>
        <p className="text-sm text-gray-500 mb-6">성공적인 파트너십을 위해 꼼꼼히 검토하겠습니다.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="담당자 성함" className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-gray-400" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          <input type="text" placeholder="업체명 (선택)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-gray-400" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
          <input type="email" placeholder="연락받을 이메일" className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:border-gray-400" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <textarea placeholder="제안하실 내용을 간단히 적어주세요" className="w-full p-3 bg-gray-50 border rounded-xl text-sm h-32 resize-none outline-none focus:border-gray-400" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} />
          <button type="submit" disabled={isSending} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">{isSending ? '전송 중...' : '문의 제출하기'}</button>
        </form>
      </div>
    </div>
  );
};

// 🔥 [수정 1] 제보하기 버튼 및 안내 문구 텍스트 크기 축소 (text-xs, text-sm 적용)
const FooterSection = ({ onShowMustHave, addToast }: { onShowMustHave: () => void, addToast: (t: ToastType, m: string) => void }) => {
  const [isShaking, setIsShaking] = useState(false);
  const handleReportClick = () => {
    openExternalLink('http://pf.kakao.com/_qAixlX/chat'); 
  };
  
  return (
    // 🔥 여백(mt-12)을 mt-6으로 줄여서 붕 뜨는 공간을 싹 없앴습니다!
    <div className="mt-6 max-w-6xl mx-auto pb-20 space-y-4 px-4 sm:px-0 animate-fade-in">      
      {/* 제보하기 박스 */}
      <div className="bg-gray-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center border border-gray-100">
         <p className="text-xs text-gray-500 mb-3 font-medium">혹시 여기에 없는 공통/지자체 혜택을 알고 계신가요?</p>
         <button onClick={handleReportClick} className={`bg-[#FEE500] text-[#3c1e1e] px-6 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-transform shadow-sm hover:brightness-95 ${isShaking ? 'animate-shake' : ''}`}>
           <MessageCircle size={18} fill="currentColor"/> 카카오톡으로 혜택 제보하기
         </button>
      </div>
      
      {/* 안내사항 박스 */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-1.5 text-gray-500 mb-2"><Info size={16} /><span className="text-sm font-bold">안내</span></div>
        <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed break-keep">
          본 서비스는 혜택 정보를 수시로 업데이트하고 있으나, 정확한 신청 자격 및 최신 내용은 반드시 공식 안내 페이지를 통해 다시 한 번 확인해 주시기 바랍니다.
        </p>
      </div>
    </div>
  );
};


// ==========================================
// 3. 주요 페이지 컴포넌트들 (누락 복구 완료)
// ==========================================

// 🔥 누락 복구: AddressSetupModal
const AddressSetupModal = ({ user, onComplete, addToast, onClose }: { user: User, onComplete: (n: string, w: string, a: string) => void, addToast: (t: ToastType, m: string) => void, onClose?: () => void }) => {
  const isEditMode = !!user.nickname;
  const isInvited = !!user.partnerId && !!user.address; // 👨‍👩‍👦 남편 초대 여부 확인

  const [nickname, setNickname] = useState(user.nickname || '');
  const [who, setWho] = useState(user.who || (isInvited ? '산모가족' : '')); // 남편은 기본 '산모가족' 세팅
  const [nickError, setNickError] = useState('');
  const [nickVerified, setNickVerified] = useState(isEditMode);
  
  // 주소 초기값 세팅 (초대받은 남편이면 아내 주소를 분리해서 세팅)
  const initialSido = isInvited ? user.address.split(' ')[0] : '';
  const initialSigugun = isInvited ? user.address.split(' ')[1] : '';
  const initialGu = isInvited ? user.address.split(' ').slice(2).join(' ') : '';

  const [selectedSido, setSelectedSido] = useState(initialSido);
  const [selectedSigugun, setSelectedSigugun] = useState(initialSigugun);
  const [selectedGu, setSelectedGu] = useState(initialGu);
  
  const sigugunList = useMemo(() => selectedSido ? Object.keys(REGION_DATA[selectedSido] || {}).sort() : [], [selectedSido]);
  const guList = useMemo(() => (selectedSido && selectedSigugun) ? REGION_DATA[selectedSido][selectedSigugun] : [], [selectedSido, selectedSigugun]);

  // ⚡ [핵심] 글자 칠 때마다 실시간으로 파이어베이스 검사 (중복확인 버튼 제거)
  useEffect(() => {
    if (isEditMode) return;
    if (nickname.trim().length < 2) {
      setNickVerified(false);
      setNickError('2글자 이상 입력해주세요.');
      return;
    }
    const checkDup = async () => {
      const q = query(collection(db, 'users'), where('nickname', '==', nickname.trim()));
      const snap = await getDocs(q);
      const isDup = snap.docs.some(doc => doc.id !== user.id);
      
      if (isDup) {
        setNickVerified(false);
        setNickError('아쉽게도 이미 있는 이름이에요. 살짝 바꿔볼까요?');
      } else {
        setNickVerified(true);
        setNickError('멋진 이름이네요! 사용 가능합니다 ✨');
      }
    };
    
    // 타자 치는 중에는 검사 안 하고, 0.4초 멈추면 검사 (비용 방어)
    const timer = setTimeout(checkDup, 400);
    return () => clearTimeout(timer);
  }, [nickname, isEditMode, user.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickVerified || !who || !selectedSido || !selectedSigugun) { addToast('error', '모든 정보를 확인해주세요.'); return; }
    const fullAddress = `${selectedSido} ${selectedSigugun}${selectedGu ? ' ' + selectedGu : ''}`;
    onComplete(nickname, who, fullAddress); 
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 relative">
        {onClose && <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X size={24}/></button>}
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">{isEditMode ? '거주지 변경 🏠' : '봄이옴에 오신 것을 환영해요! 🎉'}</h3>
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* 1. 닉네임 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">닉네임</label>
            <input 
              type="text" 
              value={nickname} 
              readOnly={isEditMode}
              onChange={(e) => setNickname(e.target.value)} 
              className={`w-full p-3 border rounded-xl text-sm outline-none transition-colors ${isEditMode ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-2 focus:ring-rose-200'}`} 
              placeholder="예: 봄이맘, 봄이아빠"
            />
            {/* ⚡ 실시간 결과 안내 텍스트 */}
            {!isEditMode && nickname.length > 0 && (
               <p className={`text-[10px] mt-1.5 ml-1 font-bold ${nickVerified ? 'text-emerald-500' : 'text-rose-500'}`}>{nickError}</p>
            )}
          </div>
          
          {/* 2. 유형 선택 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">어떤 유형에 해당하시나요?</label>
            <select value={who} disabled={isEditMode || isInvited} onChange={e => setWho(e.target.value)} className={`w-full p-3 border rounded-xl text-sm outline-none transition-colors ${(isEditMode || isInvited) ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed appearance-none' : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-2 focus:ring-rose-200'}`}>
              <option value="">선택해주세요</option>
              <option value="산모">임산부(산모)</option>
              <option value="산모가족">산모가족</option>
              <option value="정부/지자체 관계자">정부/지자체 관계자</option>
              <option value="기타">기타</option>
            </select>
          </div>
          
          {/* 3. 거주지 선택 (남편 초대면 잠금) */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">거주지 <span className="text-rose-500 font-normal ml-1">(주민등록상 주소 기준)</span></label>
            <div className="space-y-2">
              <select value={selectedSido} disabled={isInvited} onChange={(e) => {setSelectedSido(e.target.value); setSelectedSigugun(''); setSelectedGu('');}} className={`w-full p-3 border rounded-xl text-sm outline-none transition-colors ${isEditMode ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : isInvited ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed appearance-none' : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-2 focus:ring-rose-200'}`}><option value="">시/도 선택</option>{Object.keys(REGION_DATA).map(s => <option key={s} value={s}>{s}</option>)}</select>
              {selectedSido && <select value={selectedSigugun} disabled={isInvited} onChange={(e) => {setSelectedSigugun(e.target.value); setSelectedGu('');}} className={`w-full p-3 border rounded-xl text-sm outline-none transition-colors ${isEditMode ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : isInvited ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed appearance-none' : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-2 focus:ring-rose-200'}`}><option value="">시/군/구 선택</option>{sigugunList.map(s => <option key={s} value={s}>{s}</option>)}</select>}
              {selectedSigugun && guList.length > 0 && <select value={selectedGu} disabled={isInvited} onChange={(e) => setSelectedGu(e.target.value)} className={`w-full p-3 border rounded-xl text-sm outline-none transition-colors ${isEditMode ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : isInvited ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed appearance-none' : 'bg-gray-50 border-gray-200 text-gray-900 focus:ring-2 focus:ring-rose-200'}`}><option value="">상세 구 선택</option>{guList.map(s => <option key={s} value={s}>{s}</option>)}</select>}
            </div>
            {isInvited && <p className="text-[10px] text-gray-500 font-bold mt-2 ml-1 flex items-center gap-1">💡 배우자와 동일한 지역으로 자동 설정됩니다.</p>}
          </div>
          <button type="submit" disabled={!nickVerified || !who || !selectedSido || !selectedSigugun} className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold mt-2 shadow-md disabled:bg-gray-300">시작하기</button>
        </form>
      </div>
    </div>
  );
};

// 🛑 [심사관 모드 스위치] 심사 제출 시에는 true, 승인 후 평소엔 false로 변경하세요!
const IS_APP_REVIEW_MODE = true;

// ✅ [수정 후] 박스 제거하고 심플하게 중앙 정렬된 HomePage
const HomePage: React.FC<any> = ({ onSearch, user, onLoginClick, onGuestLogin, benefits }) => {
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigugun, setSelectedSigugun] = useState('');
  const [selectedGu, setSelectedGu] = useState('');
  const sigugunList = useMemo(() => selectedSido ? Object.keys(REGION_DATA[selectedSido] || {}).sort() : [], [selectedSido]);
  const guList = useMemo(() => (selectedSido && selectedSigugun) ? REGION_DATA[selectedSido][selectedSigugun] : [], [selectedSido, selectedSigugun]);

  const [isApp, setIsApp] = useState(false);
  const [isIOS, setIsIOS] = useState(false); 
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isWebView = !!(window as any).ReactNativeWebView;
      const hasBomiomBadge = navigator.userAgent.includes('BomiomApp');
      if (isWebView || hasBomiomBadge) {
        setIsApp(true);
      }
      
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isAppleDevice = /iPad|iPhone|iPod/.test(ua) || 
                            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      setIsIOS(isAppleDevice);
    }
  }, []);

  return (
    <div className="w-full bg-white font-pretendard animate-fade-in overflow-y-auto">
      <main className="w-full flex flex-col items-center text-center z-20">
        
        {/* 🌟 구역 1: 실제 유저가 보는 화면 (딱 스마트폰 1 화면 높이(100dvh)만 차지하며 완벽하게 중앙 정렬!) */}
        <div className="min-h-[100dvh] w-full max-w-md flex flex-col items-center justify-center px-6 py-10 relative">
          
          <img src={logoImg} alt="로고" className="w-20 h-20 mx-auto mb-6 object-contain" />
          
          <h2 className="text-[26px] sm:text-3xl font-extrabold mb-4 leading-tight text-gray-900 tracking-tight">
            삶의 가장 중요한 순간,<br/>
            <span className="text-[#F84B6A]">오래 기억될 경험으로</span>
          </h2>
          
          <p className="text-[13px] sm:text-sm text-gray-500 mb-10 leading-relaxed font-medium">
            우리 동네 임산부 혜택 한 번에 찾아보고,<br/>
            주차별 어려운 결정 함께 해결해요!
          </p>
          
          {!user ? (
            <>
              {isApp ? (
                <div className="w-full flex flex-col gap-3.5 animate-fade-in px-2">
                  <button 
                    onClick={onLoginClick} 
                    className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-2xl font-extrabold flex items-center justify-center gap-2.5 shadow-sm hover:brightness-95 active:scale-[0.98] transition-all text-base"
                  >
                    <MessageCircle size={18} fill="currentColor" /> 카카오로 시작하기
                  </button>

                  {isIOS && (
                    <button 
                      onClick={handleAppleLogin} 
                      className="w-full py-4 mt-3 bg-black text-white rounded-2xl font-extrabold flex items-center justify-center gap-2.5 shadow-sm hover:bg-gray-900 active:scale-[0.98] transition-all text-base"
                    >
                      <svg viewBox="0 0 384 512" width="18" height="18" fill="currentColor">
                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"></path>
                      </svg>
                      Apple로 시작하기
                    </button>
                  )}
                  {/* 🚨 심사관 버튼이 여기서 제거되고 아래쪽 구역 2로 안전하게 이사갔습니다! */}
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="flex justify-center w-full mb-5 relative z-10 animate-fade-in">
                     <div className="bg-rose-50/50 text-[#F84B6A] text-[11px] sm:text-xs font-bold px-5 py-2.5 rounded-full flex items-center gap-1.5 border border-rose-100 shadow-sm">
                       <CheckCircle2 size={16} /> 주민등록상 거주지를 선택해주세요
                     </div>
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); onSearch(`${selectedSido} ${selectedSigugun}${selectedGu ? ' ' + selectedGu : ''}`); }} className="space-y-3 w-full max-w-md relative z-10 animate-fade-in">
                    <select value={selectedSido} onChange={(e) => {setSelectedSido(e.target.value); setSelectedSigugun(''); setSelectedGu('');}} className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-200 text-gray-800 font-medium text-sm sm:text-base cursor-pointer"><option value="">시/도 선택</option>{Object.keys(REGION_DATA).map(s => <option key={s} value={s}>{s}</option>)}</select>
                    {selectedSido && <select value={selectedSigugun} onChange={(e) => {setSelectedSigugun(e.target.value); setSelectedGu('');}} className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-200 text-gray-800 font-medium text-sm sm:text-base cursor-pointer"><option value="">시/군/구 선택</option>{sigugunList.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                    {selectedSigugun && guList.length > 0 && <select value={selectedGu} onChange={(e) => setSelectedGu(e.target.value)} className="w-full p-4 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-200 text-gray-800 font-medium text-sm sm:text-base cursor-pointer"><option value="">상세 구 선택</option>{guList.map(s => <option key={s} value={s}>{s}</option>)}</select>}
                    <button type="submit" disabled={!selectedSido || !selectedSigugun} className="w-full py-4 mt-2 rounded-xl bg-gray-200 text-gray-400 font-bold disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2 transition-colors [&:not(:disabled)]:bg-slate-200 [&:not(:disabled)]:text-slate-500 [&:not(:disabled)]:hover:bg-slate-300 text-sm sm:text-base"><Search size={18} /> 혜택 조회하기</button>
                  </form>
                  <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 mt-8 relative z-10 animate-fade-in">
                     <p className="text-xs sm:text-sm text-gray-500 mb-5 font-medium leading-relaxed">로그인하면 내 거주지 혜택을<br/>더 편하게 확인할 수 있어요.</p>
                     <button onClick={onLoginClick} className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-extrabold flex items-center justify-center gap-2 hover:brightness-95 transition-all text-sm sm:text-base"><MessageCircle size={18} fill="currentColor" /> 카카오로 3초 만에 시작하기</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-gray-100 mt-2 shadow-sm">
               <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100"><MapPin size={28} className="text-[#F84B6A]" /></div>
               <h3 className="font-bold text-gray-900 text-xl mb-2">{user.address || '거주지 미설정'}</h3>
               <p className="text-sm text-gray-500 mb-8 leading-relaxed">회원님의 거주지로 설정되어 있습니다.<br/>다른 지역 혜택은 안쪽 페이지의<br/><b className="text-gray-700">'전국 혜택 보러가기'</b>를 이용해주세요.</p>
               <button onClick={() => onSearch(user.address || '서울 강남구')} className="w-full py-4 bg-[#F84B6A] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:bg-rose-600 transition-all">🏡 내 거주지 혜택 보러가기 <ChevronRight size={18} /></button>
            </div>
          )}
        </div>

        {/* 🌟 구역 2. 앱 심사관 게스트 모드 (화면 바닥 아래로 분리) */}
        {!user && IS_APP_REVIEW_MODE && (
          <div className="w-full pb-20 pt-32 flex flex-col items-center">
            <button onClick={onGuestLogin} className="w-[80%] max-w-xs py-4 bg-gray-800 text-white rounded-2xl font-bold shadow-lg text-sm active:scale-95 transition-transform">
              [심사관 전용] 9주차 게스트 모드
            </button>
            <p className="text-gray-400 text-xs mt-2 font-medium">App Reviewer: Please click to test.</p>
          </div>
        )}

        {/* 🌟 구역 3. 구글 봇을 위한 SEO 텍스트 폭격 구역 (스크롤을 한참 내려야만 나타납니다) */}
        {!user && !isApp && benefits && benefits.length > 0 && (
          <div className="w-full max-w-3xl mx-auto pt-10 border-t border-gray-200 text-left pb-20 opacity-80 px-6 mt-10">
            <h3 className="text-lg font-black text-gray-700 mb-2">2026 전국 지자체 임신/출산/육아 혜택 통합 안내</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              봄이옴은 대한민국 모든 예비 엄마아빠를 위해 전국 각 지자체 및 정부 부처에서 제공하는 수백 가지의 임신, 출산, 육아 지원 정책을 실시간으로 안내합니다. 
              아래 혜택 디렉토리를 통해 내가 받을 수 있는 지원금을 확인해 보세요.
            </p>
            <div className="space-y-5 bg-gray-50 p-6 rounded-2xl border border-gray-100 h-96 overflow-y-auto">
              {benefits.map((b: any, idx: number) => (
                <div key={idx} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                  <h4 className="text-sm font-bold text-gray-800 mb-1">
                    [{b.sido} {b.sigugun}] {b.title}
                  </h4>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {b.description}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">대상: {b.target} | 지원내용: {b.supportDetail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};


const NationwidePage = ({ benefits, onBack, onLoginClick, userActions, userId, addToast, user }: any) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'BEST'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSido, setSelectedSido] = useState('전체');

  const regionList = useMemo(() => {
    let list = benefits.filter((b: Benefit) => b.source === 'GOV_LOCAL');
    if (selectedSido !== '전체') {
      list = list.filter((b: Benefit) => normalizeSido(b.sido) === selectedSido);
    }
    if (searchTerm) {
      const lower = normalizeStr(searchTerm);
      list = list.filter((b: Benefit) => 
        normalizeStr(b.title).includes(lower) || 
        normalizeStr(b.description).includes(lower) || 
        normalizeStr(b.sido || '').includes(lower) ||
        normalizeStr(b.sigugun || '').includes(lower) ||
        b.tags.some(t => normalizeStr(t).includes(lower))
      );
    }
    return list;
  }, [benefits, selectedSido, searchTerm]);

  const envyList = useMemo(() => {
    let list = benefits.filter((b: Benefit) => b.source === 'GOV_LOCAL' && (b.envyCount || 0) > 0);
    if (searchTerm) {
        const lower = normalizeStr(searchTerm);
        list = list.filter((b: Benefit) => 
          normalizeStr(b.title).includes(lower) || 
          normalizeStr(b.description).includes(lower) || 
          normalizeStr(b.sido || '').includes(lower) ||
          b.tags.some(t => normalizeStr(t).includes(lower))
        );
    }
    return list.sort((a, b) => (b.envyCount || 0) - (a.envyCount || 0));
  }, [benefits, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-pretendard">
      <header className="bg-white sticky top-0 z-50 border-b border-gray-100 px-4 pt-3 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2 min-w-0 pr-2">
               <button onClick={onBack} className="p-1.5 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-full shrink-0"><ArrowLeft size={22} /></button>
               <h2 className="font-bold text-base text-gray-900 ml-1 truncate">전국 지자체 혜택 둘러보기</h2>
             </div>
             {!user && (
               <button onClick={onLoginClick} className="text-[11px] font-bold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shrink-0">
                 로그인
               </button>
             )}
          </div>
          <div className="flex border-b border-gray-100">
            <button onClick={() => setActiveTab('LIST')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'LIST' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'}`}>전국 지자체 혜택</button>
            <button onClick={() => setActiveTab('BEST')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'BEST' ? 'border-rose-500 text-rose-500' : 'border-transparent text-gray-400'}`}>🏆 🔥 부러워요 Best</button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto p-4">
        <div className="relative mb-6">
          <input type="text" placeholder="지역명, 혜택명, 태그로 검색해보세요" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 pl-12 bg-white rounded-2xl border border-gray-200 shadow-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        </div>
        {activeTab === 'LIST' && (
          <>
            <div className="max-w-6xl mx-auto">
                 {/* 전국 페이지 지역 탭 영역 (N 뱃지 추가) */}
                 <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-2.5 mb-6">
                   {SIDO_LIST.map(s => {
                     // 🔥 해당 지역에 NEW 데이터가 있는지 체크하는 로직
                     const hasNewInRegion = benefits.some(b => {
                       if (s === '전체') return b.source === 'GOV_LOCAL' && b.updateType === 'NEW';
                       return normalizeSido(b.sido) === s && b.updateType === 'NEW';
                     });

                     return (
                       <button 
                         key={s} 
                         onClick={() => setSelectedSido(s)} 
                         className={`relative px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                           selectedSido === s 
                             ? 'bg-blue-500 text-white border-blue-500 shadow-md' 
                             : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                         }`}
                       >
                         {/* 🔥 지역별 N 뱃지 */}
                         {hasNewInRegion && (
                           <span className="absolute -top-1.5 -right-0.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white">N</span>
                         )}
                         {s}
                       </button>
                     );
                   })}
                 </div>
            </div>
            {/* ... 이하 리스트 출력 로직 동일 ... */}
            <div className="bg-blue-50 rounded-xl p-5 mb-6 text-center border border-blue-100">
                <div className="flex items-center justify-center gap-2 mb-1 text-blue-600 font-bold"><MapPin size={18}/> 전국 지자체 혜택</div>
                <p className="text-xs text-blue-500">다른 지역 임산부들은 어떤 혜택을 받고 있을까요?<br/><b>부러워요(💖)</b>를 눌러 우리 동네에도 생기길 함께 바라봐요!</p>
            </div>
            <div className="mb-4 text-sm font-bold text-gray-500">총 <span className="text-blue-500">{regionList.length}</span>개의 혜택이 있어요</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in mb-10">
              {regionList.length > 0 ? regionList.map((b: Benefit, idx: number) => (
                <BenefitCard key={`${b.id}_${idx}`} benefit={b} userId={userId} initialEnvy={userActions?.envy?.includes(b.id)} showApply={false} showEnvy={true} />
              )) : <div className="col-span-full py-20 text-center text-gray-400">조건에 맞는 혜택이 없습니다.</div>}
            </div>
          </>
        )}
        {activeTab === 'BEST' && (
          <>
             {envyList.length > 0 && (
               <div className="mb-8">
                 <h3 className="font-bold text-lg mb-4 flex items-center gap-2">👑 명예의 전당 (Top 3)</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {envyList.slice(0, 3).map((b: Benefit, idx: number) => (
                     <BenefitCard key={`top-${b.id}`} benefit={b} userId={userId} initialEnvy={userActions?.envy?.includes(b.id)} showApply={false} showEnvy={true} rank={idx + 1} />
                   ))}
                 </div>
               </div>
             )}
             <h3 className="font-bold text-gray-600 mb-4 text-sm">전체 랭킹 ({envyList.length}개)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in mb-10">
               {envyList.slice(3).map((b: Benefit, idx: number) => (
                 <BenefitCard key={b.id} benefit={b} userId={userId} initialEnvy={userActions?.envy?.includes(b.id)} showApply={false} showEnvy={true} rank={idx + 4} />
               ))}
               {envyList.length === 0 && <div className="col-span-full py-20 text-center text-gray-400">아직 부러워요를 받은 혜택이 없습니다.</div>}
             </div>
          </>
        )}
      </div>
    </div>
  );
};


// 🔥 [수정] onLoginClick 프롭스 추가 및 비로그인 블러/팝업 처리
const MustHaveSection = ({ benefits, user, userActions, openInquiry, onLoginClick }: { benefits: Benefit[], user: User|null, userActions: any, openInquiry: () => void, onLoginClick: () => void }) => {
  const [category, setCategory] = useState('전체');
  const categories = ['전체', '바로 받기', '할인/쿠폰', '패키지', '생활·뷰티', '가입형', '보험·금융'];

  const list = useMemo(() => {
    let res = benefits.filter(b => b.source === 'PRIVATE');
    if (category !== '전체') res = res.filter(b => b.category === category);
    return res.sort((a, b) => (b.appliedCount || 0) - (a.appliedCount || 0));
  }, [benefits, category]);

  // 🔥 비로그인일 때는 스크롤이 너무 길어지지 않게 뒤쪽 배경용 리스트를 3개만 자릅니다.
  const displayList = user ? list : list.slice(0, 3);

  return (
    <div className="relative animate-fade-in">
      {/* 🔥 뒷배경 (비로그인 시 블러 처리 및 클릭 방지) */}
      {/* 🔥 뒷배경 (비로그인 시 블러 처리 및 클릭 방지) */}
      <div className={`bg-[#fff5f6] py-8 px-4 sm:p-6 rounded-2xl border border-rose-100/50 ${!user ? 'opacity-50 blur-[4px] pointer-events-none select-none overflow-hidden h-[450px]' : ''}`}>
        
        {/* 🔥 순서 변경: 팁 배너 먼저! 문구도 변경! */}
        <div className="bg-white border border-rose-100 rounded-xl p-4 mb-5 flex items-center gap-2.5 shadow-sm">
           <span className="text-xl shrink-0">🎁</span>
           <p className="text-xs font-bold text-gray-800 leading-relaxed">봄이옴 엄마들이 꼭 챙기셨으면 하는 혜택들이에요.</p>
        </div>

        {/* 🔥 세부 필터 (배너 아래로 이동) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mb-6 pr-2">
          {categories.map(c => {
             // 🔥 해당 카테고리에 NEW(또는 New) 아이템이 있는지 검사 (전체 탭일 땐 전체 검사)
             const hasNew = benefits.some(b => 
               b.source === 'PRIVATE' && 
               (b.updateType === 'NEW' || b.updateType === 'New') && 
               (c === '전체' || b.category === c)
             );

             return (
               <button 
                 key={c} 
                 onClick={() => setCategory(c)} 
                 className={`relative px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all shadow-sm ${category === c ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
               >
                 {/* 🔥 조건 만족 시 N 뱃지 노출! */}
                 {hasNew && (
                   <span className="absolute -top-1.5 -right-0.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white z-10">N</span>
                 )}
                 {c}
               </button>
             );
          })}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {displayList.length > 0 ? displayList.map(b => (
            <BenefitCard key={b.id} benefit={b} userId={user?.id} initialApplied={userActions?.applied?.includes(b.id)} showApply={true} showEnvy={false} />
          )) : <div className="col-span-full py-10 text-center text-gray-400 text-sm">해당 카테고리의 혜택이 없습니다.</div>}
        </div>
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
           <h3 className="font-bold text-gray-900 mb-2 flex items-center justify-center gap-2"><Send size={18}/> 기업 제휴 문의</h3>
           <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">봄이옴과 함께 예비맘들에게 진정성 있는 혜택을 전해주실<br className="hidden sm:block"/> 따뜻한 파트너를 기다립니다.</p>
           <button onClick={openInquiry} className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold text-sm">문의하기</button>
        </div>
      </div>

      {/* 🔥 [신규 추가] 로그인 요구 오버레이 (비로그인 시 노출) */}
      {!user && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/50 to-white/95 flex flex-col justify-center items-center z-30 rounded-2xl">
          <div className="bg-white/95 p-6 sm:p-8 rounded-3xl border border-rose-200 shadow-xl text-center w-[90%] max-w-[320px] backdrop-blur-md animate-fade-in mt-10">
            <span className="text-4xl block mb-4 animate-bounce-short">🎁</span>
            <div className="bg-gray-800 text-white text-[11px] font-bold py-1.5 px-3 rounded-full inline-flex items-center gap-1.5 mb-3 shadow-sm">
              <span>🔒</span> 로그인 후 이용 가능해요!
            </div>
            <h4 className="font-extrabold text-gray-900 text-[15px] sm:text-base mb-2 tracking-tight">
              놓치면 후회하는 <br/><span className="text-rose-500">핵심 혜택 모음집</span>
            </h4>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed break-keep font-medium">
              임산부라면 무조건 받아야 할 꿀 혜택들만<br/>
              인기 순위대로 싹- 정리해두었어요!
            </p>
            <button onClick={onLoginClick} className="w-full py-3.5 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-black flex items-center justify-center gap-2 shadow-sm hover:brightness-95 transition-all text-sm">
              <MessageCircle size={18} fill="currentColor" /> 로그인하고 전체 확인하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 🔥 [추가] 주차별 맞춤 유튜브 영상 큐레이션 컴포넌트
const VideoCurationSection = ({ currentWeek }: { currentWeek: number }) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔥 주차별 맞춤 검색 키워드 (정확도 대폭 향상!)
  const getSearchQuery = (week: number) => {
    if (week === 0) return "임신 준비 영양제 엽산 추천 꿀팁";
    if (week <= 12) return "임신 초기 증상 조심할것 필수 영양제";
    if (week <= 27) return "임신 중기 임산부 요가 환도선 스트레칭"; // 중기 산모들의 최대 고민 반영
    if (week <= 36) return "출산가방 싸기 필수템 신생아 용품 준비";
    if (week <= 40) return "신생아 목욕시키는 법 모유수유 수면교육 기초"; // 실전 육아 정보
    return "산후조리 산모 회복 스트레칭 골반교정"; // 출산 후 선배맘 전용
  };

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const query = getSearchQuery(currentWeek);
        // 방금 benefitService에 만든 함수를 호출합니다!
        const result = await fetchYoutubeVideos(query); 
        
        if (result && result.length > 0) {
          setVideos(result);
        } else {
          setVideos([]);
        }
      } catch (e) {
        console.error("유튜브 영상 로드 실패:", e);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
  }, [currentWeek]);

  if (loading) return <div className="animate-pulse bg-gray-100 h-40 rounded-2xl w-full"></div>;
  if (videos.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100">
      <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
        📺 맞춤 큐레이션 영상
      </h3>
      <p className="text-xs text-gray-500 mb-4">이번 주차에 딱 필요한 정보만 모았어요!</p>
      
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {videos.map((vid, idx) => (
          <div 
            key={idx} 
            className="w-40 shrink-0 cursor-pointer group"
            onClick={() => openExternalLink(`https://www.youtube.com/watch?v=${vid.videoId}`)}
          >
            <div className="relative w-full h-24 rounded-xl overflow-hidden mb-2 bg-gray-100 shadow-inner">
              <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
              <div className="absolute bottom-1.5 right-1.5 bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded font-bold">YouTube</div>
            </div>
            {/* 제목에서 HTML 태그(특수문자) 변환 처리 */}
            <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-snug" dangerouslySetInnerHTML={{ __html: vid.title }}></p>
            <p className="text-[9px] text-gray-400 mt-1 truncate">{vid.channelTitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// 🔥 [추가] 임산부 맞춤 날씨 & 외출 지수 컴포넌트
const WeatherOutingSection = ({ region }: { region: string }) => {
  const [weather, setWeather] = useState({ temp: '20', status: 'SUNNY', dust: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔥 /api/weather 호출을 막습니다.
    setLoading(false);
    setWeather({ temp: '20', status: 'SUNNY', dust: false }); // 기본값 설정
  }, []);

  if (loading) return <div className="animate-pulse bg-gray-100 h-32 rounded-2xl"></div>;

  // 상태별 귀여운 문구 & 디자인 매핑
  const getWeatherData = () => {
    if (weather.dust) {
      return {
        icon: <Wind size={36} className="text-gray-400" />,
        color: "bg-gray-50 border-gray-200",
        title: "오늘은 미세먼지가 나빠요 😷",
        desc: "콜록콜록, 창문은 꼭 닫아주세요! 외출은 잠시 미루고 집에서 좋아하는 음악을 들으며 가벼운 홈스트레칭 어떨까요?",
        tag: "외출 자제",
        tagColor: "bg-gray-200 text-gray-600"
      };
    }
    if (weather.status === 'RAIN') {
      return {
        icon: <CloudRain size={36} className="text-blue-500" />,
        color: "bg-blue-50 border-blue-100",
        title: "토독토독 비가 오는 날 🌧️",
        desc: "빗소리를 들으며 따뜻한 차 한잔 어때요? 꼭 외출하셔야 한다면 바닥이 미끄러우니 천천히, 조심조심 걸어주세요!",
        tag: "미끄럼 주의",
        tagColor: "bg-blue-200 text-blue-700"
      };
    }
    if (weather.status === 'SNOW') {
      return {
        icon: <Snowflake size={36} className="text-sky-400" />,
        color: "bg-sky-50 border-sky-100",
        title: "소복소복 눈이 내려요 ⛄",
        desc: "하얀 눈 구경은 따뜻한 창밖으로 하는 게 제일 안전해요! 부득이하게 나갈 땐 굽이 낮고 튼튼한 신발 잊지 마세요 ❄️",
        tag: "낙상 주의",
        tagColor: "bg-sky-200 text-sky-700"
      };
    }
    return { // SUNNY
      icon: <Sun size={36} className="text-amber-500" />,
      color: "bg-amber-50 border-amber-100",
      title: "햇살이 너무 예쁜 날이에요! ☀️",
      desc: "아기랑 광합성 하기 딱 좋은 날씨! 가볍게 30분 정도 동네 산책을 다녀오시면 기분이 한결 상쾌해질 거예요 💛",
      tag: "산책 추천",
      tagColor: "bg-amber-200 text-amber-700"
    };
  };

  const wData = getWeatherData();

  return (
    <div className={`p-5 rounded-2xl border shadow-sm transition-colors ${wData.color}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${wData.tagColor}`}>
            {wData.tag}
          </span>
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
            <MapPin size={10} /> {region.split(' ')[0] || '우리 동네'} ({weather.temp}℃)
          </span>
        </div>
        <div className="bg-white p-2 rounded-full shadow-sm">
          {wData.icon}
        </div>
      </div>
      
      <h3 className="text-base font-bold text-gray-900 mb-1.5">{wData.title}</h3>
      <p className="text-xs text-gray-700 leading-relaxed break-keep">
        {wData.desc}
      </p>

      {/* 🔥 [추가된 부분] 시/도 기반 안내 문구 */}
      <div className="mt-4 bg-white/60 p-2.5 rounded-xl border border-black/5">
        <p className="text-[10px] text-gray-600 leading-snug break-keep">
          💡 거주하시는 <strong>시/도 기준</strong> 대표 날씨예요. 안전한 외출을 위해 나가시기 전 동네 날씨를 한 번 더 확인해 주세요!
        </p>
      </div>

      {/* 🔥 필수 저작권 표시 */}
      <div className="mt-3 pt-3 border-t border-black/5 flex items-start gap-1 opacity-60">
        <AlertCircle size={10} className="text-gray-500 shrink-0 mt-0.5" />
        <p className="text-[8px] text-gray-500 leading-tight">
          자료출처: 기상청, 한국환경공단
        </p>
      </div>
    </div>
  );
};

// 🔥 [수정] 태명 짓기 컴포넌트 (중복 제거 + 구글 시트 연동 버전)
const BabyNameSection = ({ user, onUpdateUser, addToast }: any) => {
  const [status, setStatus] = useState(user?.babyName ? 'DONE' : 'THINKING');
  const [candidates, setCandidates] = useState<string[]>(user?.candidateNames ? user.candidateNames.split(',').filter(Boolean) : []);
  const [finalName, setFinalName] = useState(user?.babyName || '');
  const [newInput, setNewInput] = useState('');
  
  const [naverTrends, setNaverTrends] = useState<string[]>([]); // 👈 이거 바로 아래에 있는 useEffect를 고칩니다!
  const [loading, setLoading] = useState(true);

  const [boysRank, setBoysRank] = useState<string[]>([]);
  const [girlsRank, setGirlsRank] = useState<string[]>([]);

  useEffect(() => {
    const top50Names = [
      '찰떡이', '열무', '튼튼이', '축복이', '사랑이', '소망이', '행복이', '기쁨이', '맑음이', '봄이',
      '용용이', '청룡이', '대박이', '별이', '달이', '우주', '하늘', '바다', '태양이', '구름이',
      '도담이', '쑥쑥이', '건강이', '알콩이', '달콩이', '반짝이', '새복이', '딱풀이', '로또', '단디',
      '열매', '포도', '자두', '체리', '망고', '보리', '나무', '새싹이', '토리', '호두',
      '가온이', '다온이', '라온이', '루리', '마루', '보람이', '슬아', '아라', '이레', '하람이'
    ];
    
    setNaverTrends(top50Names);
    setLoading(false);
  }, []);

  // ✅ 1. 정상적인 함수 호출로 수정 완료!
  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchNameRankingsFromSheet(); 
      if (data && data.boys && data.boys.length > 0) {
        setBoysRank(data.boys);
        setGirlsRank(data.girls);
      }
    };
    fetchData();
  }, []);

  // 💾 구글 시트 데이터 저장 로직 (이 함수가 호출되어야 시트에 쌓입니다!)
  const syncWithSheet = (babyName: string, candidateList: string[]) => {
    onUpdateUser({ 
      ...user, 
      babyName: babyName, 
      candidateNames: candidateList.join(',') 
    });
  };

  const handleConfirmName = (name: string) => {
    if (!name.trim()) return;
    setFinalName(name);
    setStatus('DONE');
    syncWithSheet(name, candidates); // 확정 즉시 DB 저장
    addToast('success', `'${name}'(으)로 확정되었습니다! ✨`);
  };

  const handleAddCandidate = (e?: React.FormEvent, name?: string) => {
    if (e) e.preventDefault();
    const val = (name || newInput).trim();
    if (!val || candidates.includes(val)) return;
    const newList = [...candidates, val];
    setCandidates(newList);
    setNewInput('');
    syncWithSheet(finalName, newList); // 후보 추가 시에도 DB 저장
    addToast('success', '후보군 리스트에 추가되었습니다.');
  };

  // 🔥 [추가] 후보군에서 삭제하는 함수
  const handleRemoveCandidate = (nameToRemove: string) => {
    const newList = candidates.filter(c => c !== nameToRemove);
    setCandidates(newList);
    
    // 💾 삭제된 상태를 구글 시트에도 즉시 반영
    syncWithSheet(finalName, newList); 
    addToast('success', '후보 리스트에서 삭제되었습니다.');
  };

  return (
    <div className="w-full space-y-4 animate-fade-in px-1">
      <p className="text-[11px] text-rose-700 bg-rose-50 p-3.5 rounded-xl border border-rose-100 leading-relaxed shadow-sm">
        💡 우리아이의 첫 번째 이름, <b>태명을 지어주세요.</b>
      </p>

      {/* 1. [초기 화면] 정했는지 안 정했는지 물어보기 */}
      {status === 'NONE' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className="text-4xl mb-3">👶</div>
          <h3 className="font-bold text-lg text-gray-800 mb-2">우리 아기 태명, 정하셨나요?</h3>
          <div className="space-y-3 mt-6">
            <button onClick={() => setStatus('DONE')} className="w-full py-3.5 bg-rose-500 text-white font-bold rounded-xl text-sm shadow-md">네, 이미 정했어요!</button>
            <button onClick={() => setStatus('THINKING')} className="w-full py-3.5 bg-rose-50 text-rose-600 font-bold rounded-xl text-sm border border-rose-100">아직 고민 중이에요 🤔</button>
          </div>
        </div>
      )}

      {/* 2. [이미 정함] 태명 입력창 + 과거 후보군 + 하단 인기 순위 */}
      {status === 'DONE' && (
        <div className="space-y-4">
          <div className="bg-white p-7 rounded-2xl border-2 border-rose-100 shadow-sm text-center">
            {/* ✅ 1. Our Baby Name 글자 크기를 살짝 키웠습니다 (text-[10px] -> text-sm) */}
            <p className="text-sm font-bold text-gray-400 mb-5 uppercase tracking-wider">Our Baby Name 👶</p>
            
            <div className="flex gap-2 w-full mb-5">
              <input 
                className="flex-1 min-w-0 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-lg outline-none focus:border-rose-300"
                placeholder="우리아이 태명" value={finalName} onChange={e => setFinalName(e.target.value)}
              />
              <button 
                onClick={() => handleConfirmName(finalName)} 
                disabled={finalName === user.babyName}
                className={`shrink-0 px-5 rounded-xl font-bold text-sm transition-colors ${
                  finalName === user.babyName 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-rose-500 text-white hover:bg-rose-600'
                }`}
              >
                {finalName === user.babyName ? '확정완료' : '수정하기'}
              </button>
            </div>

            {/* ✅ 3. 태명 짓기 꿀팁 가이드 추가 (작고 예쁜 박스) */}
            <div className="bg-rose-50/40 p-3.5 rounded-xl text-left text-[11px] text-gray-500 leading-relaxed border border-rose-50 mb-2">
              <span className="font-bold text-rose-500 mb-1 block">💡 태명 짓기 TIP</span>
              • 성별에 구애받지 않는 <b>중성적인 이름</b>이 좋아요.<br/>
              • <b>된소리(ㄲ·ㄸ·ㅃ·ㅆ·ㅉ)</b>가 양수를 뚫고 태아에게 가장 잘 들린답니다!<br/>
              • 병원에 가면 <b>'{finalName || '태명'} 엄마~'</b>로 불리게 되니 예쁜 이름으로 정해보세요.
            </div>

            {/* 과거 후보군 보여주기 */}
            {candidates.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100 text-left animate-in fade-in">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[11px] font-bold text-gray-500">💭 우리가 고민했던 후보들</h4>
                  {/* ✅ 2. '후보군 편집' -> '태명 변경'으로 문구 수정 */}
                  <button onClick={() => setStatus('THINKING')} className="text-[11px] text-gray-400 underline hover:text-rose-500 transition-colors">
                    태명 변경
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {candidates.map((c, i) => (
                    <span key={i} className="px-3 py-1.5 bg-rose-50/50 border border-rose-100 rounded-lg text-xs font-bold text-gray-600">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 확정 후 참고할 수 있도록 인기 순위 배치 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="font-bold text-gray-900 text-sm mb-4">🔥 실시간 인기 태명 TOP 50</h4>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
              {naverTrends.map((name, idx) => {
                // 🔥 [핵심 로직] '찰떡'과 '찰떡이'를 같은 태명으로 인식하도록 '이'를 떼고 비교합니다.
                const coreMyName = finalName.replace(/[이]$/, ''); 
                const isMyBaby = finalName && name.includes(coreMyName);

                return (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-3 rounded-lg text-xs transition-colors ${
                      isMyBaby 
                        ? 'bg-rose-50 border border-rose-300 shadow-sm' // 내 아기 태명이면 예쁜 핑크색 음영
                        : 'bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-bold w-4 shrink-0 text-center ${isMyBaby ? 'text-rose-600' : 'text-rose-300'}`}>
                        {idx + 1}
                      </span>
                      <span className={`flex-1 truncate ${isMyBaby ? 'text-rose-700 font-bold text-sm' : 'text-gray-600'}`}>
                        {name}
                      </span>
                    </div>
                    
                    {/* 내 아기 태명이면 우측에 귀여운 배지 표시! */}
                    {isMyBaby && (
                      <span className="text-[10px] font-bold text-rose-500 bg-white px-2 py-1 rounded-md shadow-sm animate-bounce-short">
                        우리아이 태명 👶
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. [고민 중] 후보군 관리 + 하단 인기 순위 */}
      {status === 'THINKING' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="font-bold text-gray-800 text-sm mb-4">📝 태명 후보 리스트</h4>
            <form onSubmit={handleAddCandidate} className="flex gap-2 w-full mb-5">
              <input 
                className="flex-1 min-w-0 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-300 shadow-inner"
                placeholder="태명을 적어주세요" value={newInput} onChange={e => setNewInput(e.target.value)}
              />
              <button type="submit" className="shrink-0 bg-gray-800 text-white px-4 rounded-xl font-bold text-xs">후보군 추가</button>
            </form>

            {/* ✅ 여기에 꿀팁 가이드가 안전하게 추가되었습니다 (입력창 바로 아래) */}
            <div className="bg-rose-50/40 p-3.5 rounded-xl text-left text-[11px] text-gray-500 leading-relaxed border border-rose-50 mb-5">
              <span className="font-bold text-rose-500 mb-1 block">💡 태명 짓기 TIP</span>
              • 성별에 구애받지 않는 <b>중성적인 이름</b>이 좋아요.<br/>
              • <b>된소리(ㄲ·ㄸ·ㅃ·ㅆ·ㅉ)</b>가 양수를 뚫고 태아에게 가장 잘 들린답니다!<br/>
              • 병원에 가면 <b>'{newInput || '태명'} 엄마~'</b>로 불리게 되니 예쁜 이름으로 정해보세요.
            </div>
            
            <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto no-scrollbar">
              {candidates.map((c, i) => (
                <div key={i} className="flex justify-between items-center bg-rose-50/40 p-3 rounded-xl border border-rose-100">
                  <span className="font-bold text-gray-700">{c}</span>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => handleRemoveCandidate(c)} className="p-1 text-gray-400 hover:text-rose-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                    <button onClick={() => handleConfirmName(c)} className="bg-rose-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold shadow-sm">확정!</button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* ✅ 직관적으로 개선된 공유 버튼 영역 (안내 문구 추가) */}
            <div className="flex flex-col gap-2">
              <span className="text-center text-[11px] text-gray-500 font-medium">
                💬 버튼을 누르면 카톡에 붙여넣을 수 있게 복사돼요!
              </span>
              <button onClick={() => {
                navigator.clipboard.writeText(`여보! 우리 아기 태명 후보들이야: ${candidates.join(', ')}\n같이 골라보자! 💕`);
                addToast('success', '카톡 메시지가 복사되었습니다!');
              }} className="w-full py-3.5 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-sm shadow-sm active:scale-[0.98] transition-transform">
                <span>카톡으로 남편과 같이 고르기 👉</span>
              </button>
            </div>
          </div>

          {/* 후보군 고를 때 참고할 수 있도록 인기 순위 배치 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center justify-between">
              🔥 네이버 인기 태명 TOP 50
              {loading && <span className="text-[10px] text-gray-400 animate-pulse">분석 중...</span>}
            </h4>
            <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
              {naverTrends.map((name, idx) => (
                <button 
                  key={idx} onClick={() => handleAddCandidate(undefined, name)}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-xs text-left hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
                >
                  <span className="font-bold text-rose-300 w-4 shrink-0 text-center">{idx + 1}</span>
                  <span className="text-gray-700 flex-1 truncate">{name}</span>
                  <span className="text-rose-400 font-bold shrink-0">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RealNameSection = ({ user, onUpdateUser, addToast, onGoGarden }: any) => {
  // 📡 구글 시트에 저장된 값(user.realName)에 따라 초기 상태 자동 설정!
  const initialStatus = user?.realName?.startsWith('[확정]') ? 'DONE' : (user?.realName?.startsWith('[고민]') ? 'THINKING' : 'NONE');
  const [status, setStatus] = useState<'NONE' | 'DONE' | 'THINKING'>(initialStatus);
  
  // 저장된 이름이 있으면 불러오고 꼬리표 떼기
  const [nameInput, setNameInput] = useState(() => {
    if (user?.realName) return user.realName.replace('[확정]', '').replace('[고민]', '').trim();
    return '';
  });
  
  const [topBoys, setTopBoys] = useState<string[]>([]);
  const [topGirls, setTopGirls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const momName = user?.babyName ? `${user.babyName} 엄마님` : '산모님';

  // 🚀 1) [이미 정했어요] 클릭 시: 바로 '확정' 처리 및 시트에 저장
  const handleAlreadyDone = () => {
    setStatus('DONE');
    onUpdateUser({ ...user, realName: `[확정] ${nameInput}` });
    addToast('success', '이름 짓기를 완료하셨군요! 정말 축하드려요 🎉');
  }; 

  // 🚀 2) [아직 고민 중이에요] 클릭 시: 상태만 변경! (데이터는 아래 useEffect가 자동으로 가져옴)
  const handleThinkingClick = () => {
    setStatus('THINKING');
    onUpdateUser({ ...user, realName: `[고민] ${nameInput}` });
  };

  // ✅ 2. 정상적인 함수 호출로 수정 완료!
  useEffect(() => {
    if (status === 'THINKING' && topBoys.length === 0 && topGirls.length === 0) {
      const fetchData = async () => {
        setLoading(true);
        const data = await fetchNameRankingsFromSheet(); 
        if (data && data.boys && data.boys.length > 0) {
          setTopBoys(data.boys);
          setTopGirls(data.girls);
        }
        setLoading(false);
      };
      fetchData();
    }
  }, [status]); 

  // 🚀 3) 입력창에서 [저장] 클릭 시: 시트에만 조용히 저장
  const handleSaveThinking = () => {
    onUpdateUser({ ...user, realName: `[고민] ${nameInput}` });
    addToast('success', '고민 중인 이름이 안전하게 저장되었습니다!');
  };

  // 🚀 4) 입력창에서 [확정!] 클릭 시: 편지 화면(DONE)으로 넘기고 시트에 확정값 저장
  const handleConfirmName = () => {
    if (!nameInput.trim()) { addToast('error', '결정하신 이름을 먼저 입력해주세요!'); return; }
    setStatus('DONE');
    onUpdateUser({ ...user, realName: `[확정] ${nameInput}` });
    addToast('success', '우리 아기 진짜 이름 확정! 축하드려요 ✨');
  };

  const handlePromiseClick = () => addToast('success', '봄이옴과 약속 완료! 🌸 선배맘의 멋진 활동을 기다릴게요!');
  const handleNamingServiceClick = () => addToast('info', '유명 작명소/철학관 연결 기능은 현재 열심히 준비 중입니다! 🛠️');

  return (
    <div className="w-full space-y-4 animate-fade-in px-1">
      <p className="text-[11px] text-indigo-700 bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 leading-relaxed shadow-sm">
        💡 출산 전후 마지막 미션! <b>우리아이 진짜 이름, 정하셨나요?</b>
      </p>

      {/* 1. [초기 화면] 상태 선택 */}
      {status === 'NONE' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
          <div className="text-4xl mb-3">🏷️</div>
          <h3 className="font-bold text-lg text-gray-800 mb-2">출생신고에 들어갈 진짜 이름!</h3>
          <p className="text-xs text-gray-500 mb-6">평생 불릴 소중한 이름, 준비되셨나요?</p>
          <div className="space-y-3">
            <button onClick={handleAlreadyDone} className="w-full py-3.5 bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-md">네, 이미 다 정해뒀어요! ✨</button>
            <button onClick={handleThinkingClick} className="w-full py-3.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-sm border border-indigo-100">아직 고민 중이에요 🤔</button>
          </div>
        </div>
      )}

      {/* 2. [이미 정함] 확정 완료 및 봄이옴 감동 편지 */}
      {status === 'DONE' && (
        <div className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm text-center animate-in fade-in slide-in-from-bottom-2">
          {nameInput && <p className="text-sm font-bold text-indigo-600 mb-4 bg-indigo-50 inline-block px-4 py-1.5 rounded-full shadow-sm">우리아이 이름: {nameInput}</p>}
          <div className="bg-[#FFFDF7] p-6 rounded-xl border border-[#F2E8D5] text-left leading-relaxed shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-100 rounded-bl-full opacity-30"></div>
            <p className="font-bold text-gray-800 text-sm mb-4">To. 사랑하는 {momName} 💌</p>
            <p className="text-xs text-gray-600 space-y-3 break-keep">
              <span className="block">그동안 열 달이라는 긴 임신 여정을 묵묵히, 그리고 훌륭하게 이겨내신다고 고생많았어요! 🎉</span>
              <span className="block">앞으로 웃음꽃이 만발하는 행복한 가정을 위해 <b>봄이옴</b>이 늘 곁에서 응원할게요.</span>
              <span className="block font-bold text-indigo-600 mt-4 pt-4 border-t border-dashed border-[#F2E8D5]">
                P.S. 몸조리 잘 마치시고 나면, 봄이옴 게시판에 오셔서 이제 막 임신을 시작한 초보 산모들에게 따뜻한 '선배맘'이 되어주실 거죠? 😊
              </span>
            </p>
          </div>
          <button onClick={handlePromiseClick} className="mt-5 w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
            🤙 봄이옴과 굳게 약속하기!
          </button>
          {/* 다시 고민으로 돌아갈 수 있는 버튼 */}
          <button onClick={handleThinkingClick} className="mt-3 text-[10px] text-gray-400 underline">이름 다시 고민하기</button>
        </div>
      )}

      {/* 3. [고민 중] 구글 시트 연동 + 저장/확정 버튼 추가 */}
      {status === 'THINKING' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="font-bold text-gray-800 text-sm mb-3">💭 생각 중인 이름이 있나요?</h4>
            
            {/* 🔥 저장 & 확정 버튼 UI 적용 */}
            <div className="flex gap-2 w-full mb-4">
              <input 
                className="flex-1 min-w-0 p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-300"
                placeholder="예: 예준, 서아 (적어보세요)" value={nameInput} onChange={e => setNameInput(e.target.value)}
              />
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={handleSaveThinking} className="bg-gray-800 text-white px-4 py-1.5 rounded-lg font-bold text-[11px] shadow-sm">저장</button>
                <button onClick={handleConfirmName} className="bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-bold text-[11px] shadow-sm">확정!</button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl border border-indigo-100 flex flex-col items-center text-center shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-full"></div>
              <span className="text-2xl mb-2 relative z-10">📜</span>
              <h5 className="font-black text-white text-sm mb-1 relative z-10">내 아이를 위한 단 하나의 이름</h5>
              <p className="text-[10px] text-indigo-100 mb-4 opacity-90 relative z-10">정통 성명학 기반 • 사주 맞춤형 프리미엄 작명</p>
              <button 
                onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); onGoGarden(); }} 
                className="w-full py-3.5 bg-white text-indigo-600 font-black rounded-xl text-xs shadow-[0_4px_15px_rgba(0,0,0,0.1)] active:scale-95 transition-all"
              >
                봄이옴 작명 연구소 입장하기 →
              </button>
            </div>
          </div>

          {/* 대법원 인기 이름 순위 (기존과 동일) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h4 className="font-bold text-gray-900 text-sm mb-4 flex justify-between items-center">
              <span>🏆 대법원 등록 인기 이름</span>
              {loading && <span className="text-[10px] text-indigo-400 animate-pulse">데이터 로딩 중...</span>}
            </h4>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="bg-blue-50 text-blue-600 font-bold text-[11px] p-2 rounded-t-lg text-center border-b border-blue-100">🧒 남아 TOP 20</div>
                <div className="bg-gray-50 rounded-b-lg p-2 space-y-1 h-[240px] overflow-y-auto no-scrollbar">
                  {topBoys.map((name, idx) => (
                    <div key={idx} className="flex gap-2 items-center text-[11px] p-2 border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-colors">
                      <span className="font-bold text-blue-400 w-4 text-center">{idx + 1}</span><span className="text-gray-700 font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-pink-50 text-pink-500 font-bold text-[11px] p-2 rounded-t-lg text-center border-b border-pink-100">👧 여아 TOP 20</div>
                <div className="bg-gray-50 rounded-b-lg p-2 space-y-1 h-[240px] overflow-y-auto no-scrollbar">
                  {topGirls.map((name, idx) => (
                    <div key={idx} className="flex gap-2 items-center text-[11px] p-2 border-b border-gray-100 last:border-0 hover:bg-pink-50 transition-colors">
                      <span className="font-bold text-pink-400 w-4 text-center">{idx + 1}</span><span className="text-gray-700 font-medium">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 mt-3 text-right">* 대법원 전자가족관계등록시스템 통계 기준</p>
          </div>
        </div>
      )}
    </div>
  );
};

// 🔥 1. 주차별 아기 크기 및 밸런스 게임 데이터 (컴포넌트 밖에 위치해야 성능에 좋습니다)
const BABY_SIZE_MAP: Record<number, { emoji: string, name: string, desc: string }> = {
  4: { emoji: '🌾', name: '좁쌀', desc: '아주 작지만 위대한 생명이 시작되었어요!' },
  5: { emoji: '🍎', name: '사과씨', desc: '심장이 콩닥콩닥 뛰기 시작해요.' },
  6: { emoji: '🌱', name: '완두콩', desc: '초음파로 아기집을 볼 수 있어요.' },
  7: { emoji: '🫐', name: '블루베리', desc: '팔과 다리가 생기기 시작했어요!' },
  8: { emoji: '🍇', name: '라즈베리', desc: '꼬리가 없어지고 사람의 형태를 갖춰요.' },
  9: { emoji: '🍒', name: '체리', desc: '손가락과 발가락이 생겨나고 있어요.' },
  10: { emoji: '🫒', name: '금귤', desc: '이마가 튀어나오고 뼈가 단단해져요.' },
  11: { emoji: '🍓', name: '딸기', desc: '양수 안에서 꼼지락 움직이기 시작해요!' },
  12: { emoji: '🍑', name: '자두', desc: '성별의 차이가 나타나기 시작해요.' },
  13: { emoji: '🍋', name: '레몬', desc: '지문이 생기고 탯줄로 영양분을 듬뿍 받아요.' },
  14: { emoji: '🍊', name: '오렌지', desc: '엄지손가락을 빨기도 하고 표정을 지어요!' },
  15: { emoji: '🍎', name: '사과', desc: '빛을 감지할 수 있게 되었어요.' },
  16: { emoji: '🥑', name: '아보카도', desc: '청각이 발달해서 엄마 아빠 목소리를 들어요 🎵' },
  17: { emoji: '🍐', name: '배', desc: '뼈가 점점 단단해지고 있어요.' },
  18: { emoji: '🍠', name: '고구마', desc: '빠른 분들은 첫 태동을 느낄 수 있어요!' },
  19: { emoji: '🥭', name: '망고', desc: '머리카락이 자라나기 시작해요.' },
  20: { emoji: '🍌', name: '바나나', desc: '임신의 딱 절반을 지나왔어요! 축하해요 🎉' },
  21: { emoji: '🥕', name: '당근', desc: '속눈썹과 눈썹이 생겼어요.' },
  22: { emoji: '🌽', name: '옥수수', desc: '미각이 발달해서 쓴맛 단맛을 알아요.' },
  23: { emoji: '🍈', name: '참외', desc: '폐 혈관이 발달하며 숨쉬기 연습을 해요.' },
  24: { emoji: '🍆', name: '가지', desc: '소리에 민감하게 반응하며 움직여요!' },
  25: { emoji: '🥦', name: '콜리플라워', desc: '머리카락 색깔이 정해지고 있어요.' },
  26: { emoji: '🥬', name: '양배추', desc: '눈을 뜨고 눈동자를 굴릴 수 있어요 👀' },
  28: { emoji: '🎃', name: '단호박', desc: '뇌가 급격하게 성장하는 시기예요.' },
  30: { emoji: '🍈', name: '멜론', desc: '피하지방이 생겨 포동포동해지고 있어요.' },
  32: { emoji: '🍍', name: '파인애플', desc: '태동이 아주 힘차고 강해졌어요 💪' },
  34: { emoji: '🥥', name: '코코넛', desc: '세상에 나갈 준비를 위해 머리를 아래로 향해요.' },
  36: { emoji: '🍈', name: '허니듀', desc: '통통하게 살이 오르고 세상에 나올 준비 완료!' },
  38: { emoji: '🍉', name: '수박', desc: '언제 나와도 건강한 훌륭한 크기가 되었어요 🍉' },
  40: { emoji: '👶', name: '신생아', desc: '엄마 아빠, 곧 만나요! 사랑해요 💕' }
};

const getBabySize = (week: number) => {
  if (week < 4) return { emoji: '✨', name: '작은 별', desc: '아주 소중한 생명이 찾아왔어요!' };
  const weeks = Object.keys(BABY_SIZE_MAP).map(Number).sort((a, b) => b - a);
  const match = weeks.find(w => week >= w);
  return match ? BABY_SIZE_MAP[match] : BABY_SIZE_MAP[40];
};

const BALANCE_QUESTIONS = [
  ['입덧 최악은?', '먹덧(먹어야 살것같음)', '토덧(먹으면 다 게워냄)'], ['출산의 고통', '진통 10시간 자연분만', '수술 후유증 10일 제왕절개'], ['성별', '날 닮은 딸', '남편 닮은 아들'], ['육아템', '무조건 새상품 플렉스', '가성비 당근마켓 쓸어담기'], ['조리원', '밥이 미슐랭급인 곳', '마사지가 신의 손인 곳'], ['임신 중 더 참기 힘든 것', '커피 딱 한 잔의 유혹', '시원한 맥주 한 잔의 유혹'], ['초음파', '누가봐도 아빠 판박이', '누가봐도 엄마 판박이'], ['임신 중 꿀템', '바디필로우 없인 못 자', '압박스타킹 없인 못 걸어'], ['태교', '클래식 들으며 태교바느질', '내가 즐거운 예능/드라마 시청'], ['입덧 끝난 후', '매일매일 고기 파티', '매콤달콤 떡볶이/분식'],
  ['남편의 역할', '칼퇴하고 매일 집안일 싹 다하기', '주말에 하루 종일 아기 풀케어'], ['시댁/친정 도움', '매일 오셔서 반찬 챙겨주시기', '용돈 100만원 쿨하게 송금'], ['만삭 때 제일 힘든 점', '숨차서 똑바로 눕기 힘듦', '시도 때도 없이 화장실 직행'], ['출산 전 마지막 외식', '우아한 파인다이닝 스테이크', '연기 자욱한 철판 삼겹살'], ['아기 이름', '철학관에서 받아온 비싼 이름', '우리가 직접 지은 예쁜 이름'], ['조리원 동기', '마음 맞는 동기 1명 평생 가기', '여러 명 모임으로 정보 얻기'], ['모유수유', '초유만 먹이고 깔끔하게 단유', '돌까지 완모 도전!'], ['수면교육', '안아서 재워주며 교감하기', '수면의식으로 스스로 자기'], ['육아휴직', '엄마가 1년 몰아서 쓰기', '엄마 아빠 6개월씩 나눠 쓰기'], ['베이비페어', '아침 오픈런해서 선착순 선물 받기', '오후에 여유롭게 가서 할인 더 받기'], ['산전검사', '검사 항목 꼼꼼히 다 받기', '꼭 필요한 것만 선택해서 받기'],
  ['임신 확인 방법', '약국 테스트기로 혼자 먼저 확인', '병원 가서 의사한테 바로 확인'],
  ['태동', '발로 쾅쾅 차는 강한 태동', '살살 간지럽히는 부드러운 태동'],
  ['출산 후 첫 식사', '따끈한 미역국 한 그릇', '치킨이랑 맥주 한 캔'],
  ['아기 용품 쇼핑', '베이비페어에서 한 번에 싹 쓸기', '필요할 때마다 하나씩 구매'],
  ['출산 가방', '한 달 전부터 꼼꼼히 준비', '진통 오면 그때 10분 만에 싸기'],
  ['분만실', '남편이 꼭 옆에서 손잡아주기', '혼자가 오히려 더 편해'],
  ['신생아 목욕', '매일 꼼꼼히 통목욕', '필요할 때만 부분 세정'],
  ['아기 사진', '전문 작가 불러 백일 화보 촬영', '스마트폰으로 매일 셀카 찍기'],
  ['첫 이유식', '직접 재료 갈아서 정성껏 만들기', '믿을 수 있는 유기농 제품 구매'],
  ['수유 방식', '모유수유로 아기와 교감하기', '분유로 편하게 누구나 먹이기'],
  ['임신 중 운동', '요가/필라테스로 유연하게', '매일 30분 가볍게 산책하기'],
  ['아기 돌봄', '친정엄마 옆에서 도움받기', '산후도우미 전문가한테 맡기기'],
  ['임신 소식 알리기', '직접 만나서 깜짝 이벤트로', '카카오톡으로 귀엽게 사진 공유'],
  ['태명 짓기', '귀엽고 재미있는 태명', '이름 미리 지어서 태명으로 쓰기'],
  ['임신 중 잠', '왼쪽으로 누워 바디필로우 끼기', '앉아서 쿠션 잔뜩 받치고 자기'],
  ['출산 후 체형관리', '산후 필라테스로 코어 잡기', '매일 유모차 끌며 걷기 운동'],
  ['육아템 중고', '당근마켓에서 상태 좋은 중고로', '아기 건강 위해 무조건 새것으로'],
  ['아기 첫 외출', '100일 되자마자 나들이 도전', '6개월은 지나야 나가는 게 맞아'],
  ['임신 중 스트레스 해소', '먹방 유튜브 보며 대리만족', '좋아하는 드라마 몰아보기'],
  ['조리원 룸타입', '1인실에서 혼자 조용히 쉬기', '2인실에서 동기랑 수다 떨기'],
  ['아기 잠재우기', '노래 불러주며 토닥토닥', '백색소음 틀고 자연스럽게'],
  ['출산 후 첫 외식', '삼겹살 구워먹으러 바로 달려가기', '집 앞 편의점 라면으로 소소하게'],
  ['기저귀 브랜드', '피부 위해 비싸도 프리미엄으로', '가성비 좋은 대용량 브랜드로'],
  ['아기 잠자리', '부모랑 한 침대에서 같이 자기', '아기 전용 침대에서 독립적으로'],
  ['산후조리 방식', '조리원에서 전문적으로 케어받기', '집에서 가족과 함께 조리하기'],
  ['임신 중 간식', '과일 잔뜩 챙겨먹기', '견과류 한 줌씩 꾸준히'],
  ['아기 첫 생일', '화려한 돌잔치 파티로', '가족끼리 소소하게 케이크만'],
  ['태아보험 가입', '임신 초기에 바로 서두르기', '꼼꼼히 비교하고 11주에 딱 맞춰'],
  ['남편 태교 참여', '태담 매일 밤 10분씩 꼭 하기', '태교 음악 틀어주는 것만으로도 OK'],
  ['임신 중 외식', '건강한 샐러드 카페에서 브런치', '생선구이 백반집에서 든든하게'],
  ['출산 후 남편 육아휴직', '꼭 같이 써야 진짜 팀플이지', '혼자 쓰는 게 더 효율적이야'],
  ['아기 옷 쇼핑', '매 시즌 예쁜 신상으로 바꿔입히기', '금방 크니까 중고로 돌려입히기'],
  ['임신 중 카페인', '디카페인 커피로 대체하기', '그냥 커피 딱 하루 한 잔만'],
  ['임신 사실 직장 공개', '초기에 바로 팀장님께 말씀드리기', '배 나올 때까지 최대한 숨기기'],
  ['태교 여행', '비행기 타고 해외 태교여행', '국내 힐링 리조트에서 느긋하게'],
  ['임신 중 여행', '제주도 힐링 국내여행', '가깝고 편한 호캉스'],
  ['아기 발달', '월령별 발달 책 정독하며 체크', '아기 페이스 믿고 자연스럽게'],
  ['임신 튼살', '매일 꼼꼼하게 오일 바르기', '이미 늦었어 그냥 포기'],
  ['출산 후 다이어트', '모유수유하면 저절로 빠지겠지', '산후 6주 지나면 바로 운동 시작'],
  ['아기 이유식 시작', '5개월부터 일찍 시작하기', '6개월 지나서 천천히 시작하기'],
  ['임신 중 부종', '다리 올리고 누워서 쉬기', '압박스타킹 신고 꾸준히 걷기'],
  ['산후우울증', '남편한테 솔직하게 다 털어놓기', '전문 상담사한테 도움 요청하기'],
  ['아기 수영', '돌 전부터 물에 익숙하게 하기', '걸을 때까지 기다렸다가 시작하기'],
  ['임신 중 취미', '태교 뜨개질로 아기용품 만들기', '임신 일기 써서 소중한 추억 남기기'],
  ['출산 후 머리카락', '단발로 시원하게 확 자르기', '묶는 게 편해서 그냥 기르기'],
  ['아기 분리수면', '6개월부터 일찍 독립 훈련시키기', '24개월까지는 같이 자도 괜찮아'],
  ['임신 중 살', '나중에 빼면 되지 맘껏 먹기', '적정 체중 유지하며 건강하게 먹기'],
  ['아기 예방접종', '맞을 때마다 같이 울어줌', '간호사 선생님 믿고 잠깐 자리 피함'],
  ['출산 후 복직', '아기 12개월 되면 바로 복직', '24개월까지 육아휴직 꽉 채우기'],
  ['임신 중 남편 태도', '먹고 싶은 거 새벽에도 사다 주기', '집안일 전담해서 몸 편하게 해주기'],
  ['아기 낮잠', '낮잠 루틴 철저하게 지키기', '피곤하면 알아서 자겠지 자유롭게'],
  ['출산 후 친정 vs 시댁', '친정엄마랑 한 달 같이 지내기', '시댁 도움 없이 우리끼리 해내기'],
  ['임신 중 병원 선택', '집 근처 동네 산부인과 단골로', '시설 좋은 대학병원에서 관리받기'],
  ['아기 첫 말', '엄마 먼저 하면 우리 편', '아빠 먼저 하면 배신자'],
  ['임신 준비', '엽산 6개월 전부터 미리 챙기기', '임신되면 그때부터 챙겨도 늦지 않아'],
  ['출산 후 부부관계', '아기 재우고 둘만의 시간 갖기', '일단 1년은 아기가 최우선이야'],
  ['아기 외출복', '매일 예쁘게 코디해서 인스타 올리기', '편하고 따뜻한 실용파 우선'],
  ['임신 중 독서', '태교 전집 정독하며 공부하기', '출산 경험담 에세이로 공감하기'],
  ['아기 장난감', '발달에 좋은 교육용 장난감으로', '아기가 좋아하는 거면 뭐든 OK'],
  ['출산 후 몸매', '이제 편하게 살아도 돼 포기', '반드시 임신 전 몸매로 돌아간다'],
  ['아기 목욕 시간', '매일 저녁 같은 시간에 루틴으로', '필요할 때마다 그때그때 씻기기'],
  ['임신 중 쇼핑', '출산 전에 다 사놓기 든든해', '필요할 때 그때그때 사는 게 현명해'],
  ['아기 이유식 재료', '친환경 유기농 재료만 엄선해서', '대형마트 신선 코너면 충분해'],
  ['출산 후 운동 복귀', '산후 6주 체크 후 바로 헬스장으로', '1년은 쉬고 나서 천천히 시작하기'],
  ['아기 사진 인화', '매달 포토북으로 예쁘게 만들기', '구글 포토에 저장하면 충분해'],
  ['임신 중 걱정', '검색하다 더 무서워져서 검색 금지', '모르는 게 약이야 그냥 믿고 가기'],
  ['아기 수면 의식', '목욕-마사지-수유-취침 루틴 고수', '그날그날 아기 컨디션에 맞게 유연하게'],
  ['출산 후 식단', '산모 몸보신 위해 보양식 집중 공략', '균형 잡힌 일반식으로 건강하게'],
  ['아기 첫 걸음마', '보행기로 미리 연습시키기', '자연스럽게 혼자 일어날 때까지 기다리기'],
  ['임신 중 태명 공개', 'sns에 귀엽게 공유하기', '가족끼리만 아는 우리만의 비밀로'],
  ['출산 후 부부싸움', '피곤해도 대화로 바로 풀기', '일단 자고 일어나면 해결돼'],
  ['아기 책 읽어주기', '매일 밤 10권씩 읽어주기', '아기가 원할 때만 같이 보기'],
  ['임신 중 체중관리', '매일 체중계 올라가서 체크하기', '임신 중엔 스트레스가 더 나빠 안 재기'],
  ['아기 어린이집', '18개월에 일찍 사회성 키우기', '36개월까지 엄마랑 집에서 지내기'],
  ['출산 후 요리', '건강한 이유식 직접 만들어 먹이기', '검증된 시판 이유식으로 편하게'],
  ['임신 중 감정', '호르몬 탓이니 실컷 울어도 돼', '남편한테 솔직히 말하고 위로받기'],
  ['아기 돌잔치 드레스코드', '한복 입혀서 전통 느낌으로', '드레스 입혀서 공주님처럼'],
  ['임신 중 불안', '맘카페에서 정보 얻어 대비하기', '의사 선생님 말만 믿고 따르기'],
  ['출산 후 첫 혼자 시간', '카페 가서 혼자 커피 마시기', '미용실 가서 머리 손질하기']
];

// 🔥 [완벽 수정] 한국 시간(KST) YYYY-MM-DD 포맷 (03월 03일 형태로 고정)
const kstDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
const yyyy = kstDate.getFullYear();
const mm = String(kstDate.getMonth() + 1).padStart(2, '0');
const dd = String(kstDate.getDate()).padStart(2, '0');
const todayStr = `${yyyy}-${mm}-${dd}`; // 결과: 무조건 "2026-03-03"

// 한국 시간 기준으로 날짜 카운트 (밤 12시에 정확히 다음 문제로 넘어감!)
const kstTime = new Date().getTime() + (9 * 60 * 60 * 1000); 
const daysSinceEpochKst = Math.floor(kstTime / 86400000);
const todayQuestion = BALANCE_QUESTIONS[daysSinceEpochKst % BALANCE_QUESTIONS.length];

// 🔥 [수정 완료] 튼살관리 & 임부복 컴포넌트 (가이드 위치 변경 + 모바일 레이아웃 최적화)
const MaternitySection = ({ user, onUpdateUser, addToast }: any) => {
  const [tab, setMatTab] = useState<'stretch' | 'clothes'>('stretch');
  const [customSearch, setCustomSearch] = useState('');
  const [chatInput, setChatInput] = useState('');

  const STRETCH_TOP10 = ['비오템 튼살크림', '클라랑스 예비맘크림', '버츠비 마마비', '프라이웰 튼살오일', '파머스 튼살크림', '일리윤 튼살크림', '아토팜 매터니티', '무스텔라 튼살크림', '록시땅 아몬드오일', '몽디에스 마더케어'];
  const CLOTHES_TOP10 = ['소임 (SOIM)', '해피텐 (Happy10)', '맘누리', '딘트스타일', '블룸마더니티', '코니 (Konny)', '세컨스킨', '마더피아', '안다르 임산부', '무인양품 임산부'];

  const stretchStats = [
    { name: '비오템', count: 320 }, { name: '클라랑스', count: 210 }, { name: '일리윤', count: 150 }, 
    { name: '버츠비', count: 120 }, { name: '파머스', count: 90 }, { name: '기타', count: 110 }
  ];
  const clothesStats = [
    { name: '소임', count: 400 }, { name: '해피텐', count: 250 }, { name: '세컨스킨', count: 180 }, 
    { name: '맘누리', count: 120 }, { name: '코니', count: 90 }, { name: '기타', count: 160 }
  ];

  const [chatsStretch, setChatsStretch] = useState<any[]>([]);
  const [chatsClothes, setChatsClothes] = useState<any[]>([]);

  useEffect(() => {
    const qStretch = query(collection(db, 'chats_stretch'), orderBy('createdAt', 'desc'), limit(30));
    const unsubStretch = onSnapshot(qStretch, (snap) => {
      setChatsStretch(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qClothes = query(collection(db, 'chats_clothes'), orderBy('createdAt', 'desc'), limit(30));
    const unsubClothes = onSnapshot(qClothes, (snap) => {
      setChatsClothes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubStretch(); unsubClothes(); };
  }, []);

  const handleSelect = (item: string) => {
    const key = tab === 'stretch' ? 'myStretchMark' : 'myMaternityWear';
    onUpdateUser({ ...user, [key]: item }); 
    addToast('success', `'${item}' 선택 완료! 통계에 반영됩니다.`);
    setCustomSearch('');
  };

  const handleChatSubmit = async (e: any) => {
    e.preventDefault();
    if (chatInput.length !== 7) { addToast('error', '정확히 7글자로 입력해주세요!'); return; }
    
    const colName = tab === 'stretch' ? 'chats_stretch' : 'chats_clothes';
    try {
      await addDoc(collection(db, colName), {
        text: chatInput,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        meta: user?.nickname || '산모',
        createdAt: serverTimestamp()
      });
      setChatInput('');
    } catch (error) {
      addToast('error', '채팅 전송에 실패했습니다.');
    }
  };

  const renderDonutChart = (statsData: any[]) => {
    const total = statsData.reduce((acc, cur) => acc + cur.count, 0);
    const COLORS = ['#fda4af', '#93c5fd', '#fde047', '#c4b5fd', '#86efac', '#e5e7eb'];
    let currentAcc = 0;
    const chartData = statsData.map((s, idx) => {
      const pct = Math.round((s.count / total) * 100);
      const start = currentAcc;
      currentAcc += pct;
      return { ...s, pct, color: COLORS[idx], start, end: idx === statsData.length - 1 ? 100 : currentAcc };
    });
    const conicStr = chartData.map(g => `${g.color} ${g.start}% ${g.end}%`).join(', ');

    return (
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-6">
        <p className="text-[11px] font-bold text-rose-500 mb-4 bg-rose-50 inline-block px-2 py-1 rounded">
          📊 봄이옴 산모들의 실제 선택 TOP 5
        </p>
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 rounded-full shadow-sm shrink-0" style={{ background: `conic-gradient(${conicStr})` }}>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center shadow-inner">
              <span className="text-xl">{tab === 'stretch' ? '🧴' : '👗'}</span>
            </div>
          </div>
          <div className="flex-1 w-full space-y-2">
            {chartData.map((g, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: g.color }}></span>
                  <span className="text-gray-700 font-bold">{g.name}</span>
                </div>
                <span className="font-bold text-gray-900">{g.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const currentTop10 = tab === 'stretch' ? STRETCH_TOP10 : CLOTHES_TOP10;
  const selectedItem = tab === 'stretch' ? user?.myStretchMark : user?.myMaternityWear;
  const currentChats = tab === 'stretch' ? chatsStretch : chatsClothes;

  return (
    <section className="space-y-4 animate-fade-in">
      
      {/* 1. 세부 필터 (탭) */}
      <div className="flex gap-2">
        <button onClick={() => setMatTab('stretch')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${tab === 'stretch' ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>🧴 튼살 관리</button>
        <button onClick={() => setMatTab('clothes')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${tab === 'clothes' ? 'bg-rose-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>👗 임부복</button>
      </div>

      {/* 🔥 2. 안내 문구를 탭 아래로 이동! */}
      <p className="text-xs text-rose-700 bg-rose-50 p-3.5 rounded-xl border border-rose-200 shadow-sm leading-relaxed">
        {tab === 'stretch' 
          ? <>💡 배가 본격적으로 나오는 <b>16주차</b>부터는 아침저녁으로 꼼꼼히 튼살 보습 관리를 시작해 주세요!</>
          : <>💡 체형 변화가 느껴지는 <b>16~20주차</b>, 조이지 않고 편안한 임부복과 속옷으로 바꿔 입을 시기예요.</>
        }
      </p>

      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full overflow-hidden">
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5">
          <Search size={16} className="text-rose-500"/> 네이버 검색 트렌드 TOP 10
        </h3>
        <p className="text-[11px] text-gray-500 mb-4 font-medium break-keep">
          산모님은 어떤 선택을 하셨나요? 아래에서 선택하고 맘스픽 결과를 함께 확인해요!
        </p>
        
        <div className="space-y-2 mb-5 max-h-[250px] overflow-y-auto no-scrollbar pr-1">
          {currentTop10.map((item, idx) => (
            <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedItem === item ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-gray-50 border-transparent'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx < 3 ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{idx + 1}</span>
                <span className={`text-xs ${selectedItem === item ? 'font-bold text-rose-700' : 'text-gray-700'}`}>{item}</span>
              </div>
              {selectedItem === item ? (
                <span className="text-[10px] font-bold text-rose-500 bg-white px-2 py-1 rounded shadow-sm">내 선택 👆</span>
              ) : (
                <button onClick={() => handleSelect(item)} className="text-[10px] text-gray-400 border border-gray-200 px-2 py-1 rounded hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">선택</button>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-100 w-full">
          <p className="text-[10px] font-bold text-gray-500 mb-2">순위에 없다면 텍스트로 직접 입력해 주세요!</p>
          {/* 🔥 버튼 밀림 방지 레이아웃 적용 */}
          <div className="flex gap-2 items-center w-full">
            <input type="text" value={customSearch} onChange={e => setCustomSearch(e.target.value)} placeholder={tab === 'stretch' ? "예: 프리메라 튼살크림" : "예: 뮬아웨어 임산부"} className="flex-1 min-w-0 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-300"/>
            <button onClick={() => handleSelect(customSearch)} disabled={!customSearch} className="shrink-0 whitespace-nowrap bg-gray-800 text-white px-4 py-3 rounded-xl font-bold text-xs disabled:bg-gray-300 shadow-sm">내 선택 추가</button>
          </div>
        </div>
      </div>

      {renderDonutChart(tab === 'stretch' ? stretchStats : clothesStats)}

      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-4 w-full overflow-hidden">
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5"><MessageCircle size={16} className="text-rose-500"/> 💬 딱 7글자로 말해요!</h3>
        <p className="text-[10px] text-gray-500 mb-3 ml-5 break-keep">
          {tab === 'stretch' ? '예: 오일이너무미끌, 배가너무가려워' : '예: 맞는바지가없음, 원피스가최고야'}
        </p>
        <div className="space-y-3 mb-4 h-[150px] overflow-y-auto no-scrollbar flex flex-col-reverse">
          {currentChats.map((chat, idx) => (
            <div key={chat.id || idx} className="flex flex-col items-start gap-1">
              <span className="text-[9px] text-gray-400 font-bold ml-1">{chat.meta}</span>
              <div className="flex items-end gap-1.5">
                <span className="bg-rose-50 border border-rose-100 text-gray-800 text-xs font-bold px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm">{chat.text}</span>
                <span className="text-[8px] text-gray-400 mb-0.5">{chat.time}</span>
              </div>
            </div>
          ))}
          {currentChats.length === 0 && <div className="text-center text-gray-400 text-xs py-5">첫 번째 대화의 주인공이 되어보세요!</div>}
        </div>
        {/* 🔥 버튼 밀림 방지 레이아웃 적용 */}
        <form onSubmit={handleChatSubmit} className="flex gap-2 items-center border-t pt-3 w-full">
          <input 
            type="text" 
            value={chatInput} 
            onChange={e => setChatInput(e.target.value)} 
            maxLength={7} 
            placeholder={tab === 'stretch' ? '튼살 고민을 7글자로!' : '임부복 후기를 7글자로!'} 
            className="flex-1 min-w-0 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button type="submit" disabled={chatInput.length !== 7} className="shrink-0 whitespace-nowrap bg-rose-500 text-white px-4 py-3 rounded-xl font-bold text-xs disabled:bg-gray-300 shadow-sm">전송</button>
        </form>
        <p className="text-[9px] text-gray-400 text-right mt-1">* {chatInput.length}/7 글자</p>
      </div>
    </section>
  );
};

// 🔥 [수정 완료] 태교여행 컴포넌트 (가이드 위치 변경 + 모바일 레이아웃 최적화)
const BabymoonSection = ({ user, onUpdateUser, addToast }: any) => {
  const [tab, setTab] = useState<'OVERSEAS' | 'DOMESTIC'>('OVERSEAS');
  const [chatInput, setChatInput] = useState('');
  const [chatsBabymoon, setChatsBabymoon] = useState<any[]>([]);

  const OVERSEAS_TOP10 = ['괌', '다낭 (베트남)', '나트랑 (베트남)', '사이판', '후쿠오카 (일본)', '오키나와 (일본)', '발리 (인도네시아)', '세부 (필리핀)', '코타키나발루', '푸껫 (태국)'];
  const DOMESTIC_TOP10 = ['제주도', '강릉 / 속초', '서울 (5성급 호캉스)', '인천 / 영종도 (파라다이스 등)', '부산 / 해운대', '남해', '여수', '경주', '통영', '거제도'];

  const overseasStats = [
    { name: '괌', count: 500 }, { name: '다낭', count: 350 }, { name: '나트랑', count: 280 },
    { name: '사이판', count: 150 }, { name: '후쿠오카', count: 120 }, { name: '기타', count: 100 }
  ];
  const domesticStats = [
    { name: '제주도', count: 450 }, { name: '서울 호캉스', count: 250 }, { name: '강릉/속초', count: 200 },
    { name: '인천 호캉스', count: 150 }, { name: '부산', count: 120 }, { name: '기타', count: 110 }
  ];

  useEffect(() => {
    const qBabymoon = query(collection(db, 'chats_babymoon'), orderBy('createdAt', 'desc'), limit(30));
    const unsubBabymoon = onSnapshot(qBabymoon, (snap) => {
      setChatsBabymoon(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubBabymoon();
  }, []);

  const finalSelection = user?.myBabymoon || ''; 
  const thinkingList = user?.myBabymoonThinking ? user.myBabymoonThinking.split(',').filter(Boolean) : [];

  const toggleThinking = (place: string) => {
    let newList;
    if (thinkingList.includes(place)) {
      newList = thinkingList.filter((p: string) => p !== place);
      addToast('info', `'${place}' 고민 리스트에서 뺐어요.`);
    } else {
      newList = [...thinkingList, place];
      addToast('success', `'${place}' 고민 리스트에 쏙! 담았어요 ❤️`);
    }
    onUpdateUser({ ...user, myBabymoonThinking: newList.join(',') });
  };

  const selectFinal = (place: string) => {
    if (finalSelection === place) return;
    onUpdateUser({ ...user, myBabymoon: place });
    addToast('success', `🎉 태교여행지가 '${place}'(으)로 최종 확정되었습니다!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearFinal = () => {
    onUpdateUser({ ...user, myBabymoon: '' });
    addToast('info', '최종 결정을 취소했습니다. 다시 여유롭게 골라보세요!');
  };

  const handleChatSubmit = async (e: any) => {
    e.preventDefault();
    if (chatInput.length !== 7) { addToast('error', '정확히 7글자로 입력해주세요!'); return; }
    
    try {
      await addDoc(collection(db, 'chats_babymoon'), {
        text: chatInput,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        meta: user?.nickname || '산모',
        createdAt: serverTimestamp()
      });
      setChatInput('');
    } catch (error) {
      addToast('error', '채팅 전송에 실패했습니다.');
    }
  };

  const renderDonutChart = (statsData: any[], type: string) => {
    const total = statsData.reduce((acc, cur) => acc + cur.count, 0);
    const COLORS = ['#818cf8', '#60a5fa', '#38bdf8', '#7dd3fc', '#bae6fd', '#e5e7eb']; 
    let currentAcc = 0;
    const chartData = statsData.map((s, idx) => {
      const pct = Math.round((s.count / total) * 100);
      const start = currentAcc;
      currentAcc += pct;
      return { ...s, pct, color: COLORS[idx], start, end: idx === statsData.length - 1 ? 100 : currentAcc };
    });
    const conicStr = chartData.map(g => `${g.color} ${g.start}% ${g.end}%`).join(', ');

    return (
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-4">
        <p className="text-[11px] font-bold text-indigo-500 mb-4 bg-indigo-50 inline-block px-2 py-1 rounded">
          📊 {type} 맘스픽 TOP 5
        </p>
        <div className="flex items-center gap-6">
          <div className="relative w-28 h-28 rounded-full shadow-sm shrink-0" style={{ background: `conic-gradient(${conicStr})` }}>
            <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center shadow-inner">
              <span className="text-xl">{type === '해외' ? '✈️' : '🚙'}</span>
            </div>
          </div>
          <div className="flex-1 w-full space-y-2">
            {chartData.map((g, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: g.color }}></span>
                  <span className="text-gray-700 font-bold">{g.name}</span>
                </div>
                <span className="font-bold text-gray-900">{g.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const currentList = tab === 'OVERSEAS' ? OVERSEAS_TOP10 : DOMESTIC_TOP10;

  return (
    <section className="space-y-4 animate-fade-in">
      
      {/* 1. 나의 최종 선택 현황판 */}
      {finalSelection ? (
        <div className="bg-indigo-500 p-5 rounded-2xl text-white shadow-md text-center relative overflow-hidden">
          <span className="absolute -right-2 -bottom-4 text-6xl opacity-20">🛫</span>
          <p className="text-xs font-bold text-indigo-200 mb-1">우리 아기와의 첫 여행지</p>
          <h3 className="text-2xl font-black mb-4">📍 {finalSelection}</h3>
          <button onClick={clearFinal} className="bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-4 py-2 rounded-full transition-colors backdrop-blur-sm">
            계획이 바뀌셨나요? (수정하기)
          </button>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
            <Heart size={16} className="text-rose-500 fill-rose-500"/> 내가 고민 중인 여행지
          </h3>
          {thinkingList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {thinkingList.map((place: string, idx: number) => (
                <span key={idx} className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                  {place}
                  <button onClick={() => toggleThinking(place)} className="ml-1 text-rose-300 hover:text-rose-500">×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 bg-gray-50 p-3 rounded-xl text-center">아래 목록에서 하트(❤️)를 눌러 찜해보세요!</p>
          )}
        </div>
      )}

      {/* 2. 탭 분리 (국내/해외) */}
      <div className="flex gap-2">
        <button onClick={() => setTab('OVERSEAS')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${tab === 'OVERSEAS' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>✈️ 해외 여행지</button>
        <button onClick={() => setTab('DOMESTIC')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${tab === 'DOMESTIC' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>🚙 국내 여행지</button>
      </div>

      {/* 🔥 3. 안내 문구를 탭 아래로 이동! */}
      <p className="text-xs text-indigo-700 bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 shadow-sm leading-relaxed">
        💡 컨디션이 가장 안정적인 <b>20~27주차</b>! 무리하지 않는 선에서 뱃속 아기와의 뜻깊은 첫 여행을 떠나보세요 ✈️
      </p>

      {/* 여행지 리스트 */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">인기 {tab === 'OVERSEAS' ? '해외' : '국내'} TOP 10</h3>
            <p className="text-[11px] text-gray-500 mt-1">산모님은 어디로 가고 싶으신가요? 찜하거나 확정하고 통계를 확인해요!</p>
          </div>
        </div>
        
        <div className="space-y-2">
          {currentList.map((place, idx) => {
            const isThinking = thinkingList.includes(place);
            const isFinal = finalSelection === place;

            return (
              <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isFinal ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${idx < 3 ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{idx + 1}</span>
                  <span className={`text-xs ${isFinal ? 'font-bold text-indigo-700' : 'text-gray-700'}`}>{place}</span>
                </div>
                
                <div className="flex gap-1.5 shrink-0">
                  <button 
                    onClick={() => toggleThinking(place)} 
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-colors ${isThinking ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-gray-200 text-gray-400 hover:text-rose-400'}`}
                  >
                    <Heart size={12} className={isThinking ? 'fill-rose-500' : ''}/> 찜
                  </button>
                  <button 
                    onClick={() => selectFinal(place)} 
                    disabled={!!finalSelection && !isFinal}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isFinal ? 'bg-indigo-500 text-white shadow-md' : finalSelection ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-black'}`}
                  >
                    {isFinal ? '결정완료 ✅' : '최종결정'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 🔥 [추가] 태교여행 생략 버튼 */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
           <button onClick={() => selectFinal('안 가기로 했어요')} className="text-xs text-gray-500 underline hover:text-gray-700">
             저희는 태교여행 생략할게요 🙅‍♀️
           </button>
        </div>

      </div>

      {renderDonutChart(tab === 'OVERSEAS' ? overseasStats : domesticStats, tab === 'OVERSEAS' ? '해외' : '국내')}

      {/* 7글자 톡 채팅창 */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-4 w-full overflow-hidden">
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-1.5"><MessageCircle size={16} className="text-indigo-500"/> 💬 딱 7글자로 말해요!</h3>
        <p className="text-[10px] text-gray-500 mb-3 ml-5 break-keep">
          예: 비행기는힘들어, 호캉스가최고야, 맛집투어갈거야
        </p>
        <div className="space-y-3 mb-4 h-[150px] overflow-y-auto no-scrollbar flex flex-col-reverse">
          {chatsBabymoon.map((chat, idx) => (
            <div key={chat.id || idx} className="flex flex-col items-start gap-1">
              <span className="text-[9px] text-gray-400 font-bold ml-1">{chat.meta}</span>
              <div className="flex items-end gap-1.5">
                <span className="bg-indigo-50 border border-indigo-100 text-gray-800 text-xs font-bold px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm">{chat.text}</span>
                <span className="text-[8px] text-gray-400 mb-0.5">{chat.time}</span>
              </div>
            </div>
          ))}
          {chatsBabymoon.length === 0 && <div className="text-center text-gray-400 text-xs py-5">첫 번째 대화의 주인공이 되어보세요!</div>}
        </div>
        {/* 🔥 버튼 밀림 방지 레이아웃 적용 */}
        <form onSubmit={handleChatSubmit} className="flex gap-2 items-center border-t pt-3 w-full">
          <input 
            type="text" 
            value={chatInput} 
            onChange={e => setChatInput(e.target.value)} 
            maxLength={7} 
            placeholder="태교여행 기대를 7글자로!" 
            className="flex-1 min-w-0 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button type="submit" disabled={chatInput.length !== 7} className="shrink-0 whitespace-nowrap bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold text-xs disabled:bg-gray-300 shadow-sm">전송</button>
        </form>
        <p className="text-[9px] text-gray-400 text-right mt-1">* {chatInput.length}/7 글자</p>
      </div>

    </section>
  );
};

// 🔥 2-1. 비로그인 유저용 맘스픽 화면 (Hook 에러 방지용 분리)
const LocalMomsSectionLoggedOut = ({ onLoginClick }: any) => {
  return (
    <div className="animate-fade-in w-full pb-8 pt-2 px-4 sm:px-0">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-rose-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-300 via-pink-400 to-rose-300"></div>

          <div className="bg-gray-800 text-white text-[11px] font-bold py-1.5 px-4 rounded-full inline-flex items-center gap-1.5 mb-5 shadow-sm">
            <span>🔒</span> 맘's pick은 로그인 후 이용 가능한 메뉴예요!
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2 break-keep tracking-tight">
            우리가 함께 만드는 <br className="sm:hidden"/> <span className="text-rose-500">리얼 임산부 통계</span>
          </h3>
          
          {/* 🔥 [수정] 300명 목표 멘트와 진행 바를 과감히 삭제하고 텍스트를 깔끔하게 정리했습니다. */}
          <p className="text-[13px] text-gray-500 mb-8 leading-relaxed break-keep">
            예비맘들의 진짜 선택만 모아 선명한 기준을 세웁니다.
          </p>

          {/* 로그인 시 확인 가능한 맞춤 정보 (바로 노출!) */}
          <div className="bg-white p-5 rounded-2xl mb-7 text-left border border-rose-100 shadow-sm text-sm">
            <p className="font-bold text-rose-500 text-[13px] mb-3 flex items-center gap-1.5 border-b border-rose-50 pb-2">
              🔓 로그인 시 확인 가능한 맞춤 정보
            </p>
            <ul className="text-[11px] text-gray-700 space-y-3 font-medium">
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-rose-400 shrink-0 mt-0.5"/> <span className="break-keep">주차별 맞춤 미션과 선배맘들의 선택 가이드</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-rose-400 shrink-0 mt-0.5"/> <span className="break-keep">실제 산모들이 선택한 <b>산부인과/조리원 랭킹</b></span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-rose-400 shrink-0 mt-0.5"/> <span className="break-keep">정부지원 <b>산후도우미 업체별 실제 평가</b></span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-rose-400 shrink-0 mt-0.5"/> <span className="break-keep">가장 많이 가입한 <b>태아보험사 및 평균 납입액 통계</b></span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-rose-400 shrink-0 mt-0.5"/> <span className="break-keep">출산 전 준비할 <b>육아용품 카테고리별 랭킹</b></span></li>
              <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-rose-400 shrink-0 mt-0.5"/> <span className="break-keep">대법원 전자가족관계등록 <b>아기 이름 인기 순위</b></span></li>
            </ul>
          </div>

          <p className="text-[11px] text-gray-500 mb-2 font-bold animate-pulse">👇 데이터에 동참하고 바로 확인</p>
          <button onClick={onLoginClick} className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:brightness-95 active:scale-95 transition-all text-sm">
            <MessageCircle size={18} fill="currentColor" /> 카카오로 3초 만에 시작하기
          </button>
        </div>
      </div>
    );
}; // 🔥 여기서 비로그인 컴포넌트 끝!

// 💳 국민행복카드 찰떡 매칭 테스트 컴포넌트 (답변 데이터 저장 완비!)
const HappinessCardTest = ({ user, onCancel, onComplete }: any) => {
  const [step, setStep] = useState(1); 
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [scores, setScores] = useState<any>({ 롯데: 0, 삼성: 0, 국민: 0, 농협: 0, 신한: 0, 기업: 0 });
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);

  const QUESTIONS = [
    { id: 1, q: "최대 혜택을 받으려면 신규 발급이어야 해요!\n최근 6개월간 결제 이력이 '없는' 카드는?", type: 'CHECKBOX' },
    { id: 2, q: "평소 장을 보거나 쇼핑할 때\n어떤 방식을 더 선호하시나요?", options: [{ txt: "문 앞까지 로켓배송! 온라인파 📱", scores: { 신한: 2, 삼성: 2, 농협: 1 } }, { txt: "직접 보고 사야 제맛! 오프라인파 🛒", scores: { 롯데: 2, 국민: 2, 기업: 1 } }] },
    { id: 3, q: "매달 숨만 쉬어도 나가는 고정비!\n이 카드로 자동이체 하실 건가요?", options: [{ txt: "관리비, 통신비 싹 다 자동이체! 🧾", scores: { 삼성: 2, 국민: 2, 기업: 1 } }, { txt: "혜택은 쇼핑/육아에만 집중! 🛍️", scores: { 롯데: 2, 신한: 2 } }] },
    { id: 4, q: "나를 위한 소소한 힐링,\n어디에 쓸 때 가장 행복한가요?", options: [{ txt: "배민 시켜 먹고 넷플릭스 보기 📺", scores: { 신한: 3, 삼성: 1 } }, { txt: "카페에서 커피와 맛있는 외식 🍰", scores: { 농협: 2, 기업: 2, 롯데: 1 } }] },
    { id: 5, q: "아기가 태어나면 주말에 주로\n어디를 가고 싶으신가요?", options: [{ txt: "놀이공원 가서 신나게 놀기 🎠", scores: { 롯데: 2, 농협: 2 } }, { txt: "키즈카페나 문화센터 가기 🎨", scores: { 국민: 2, 기업: 1 } }] },
    { id: 6, q: "마지막으로, 가장 끌리는\n'알짜 혜택' 하나만 고른다면?", options: [{ txt: "남편 차 주유 할인 ⛽", scores: { 삼성: 3 } }, { txt: "아이 무료 상해보험 🛡️", scores: { 국민: 3 } }, { txt: "유료 멤버십(네이버/쿠팡) 할인 📦", scores: { 신한: 3 } }] }
  ];

  // 🔥 [핵심 수정 1] 상태(State) 지연을 막기 위해 'showWarning' 신호를 버튼에서 직접 받습니다.
  const handleNext = (pointObj?: any, answerText?: string, showWarning: boolean = false) => {
    if (answerText) setAnswers(prev => [...prev, { qId: step, question: QUESTIONS[step-1]?.q, answer: answerText }]);
    
    if (pointObj) {
      const newScores = { ...scores };
      Object.keys(pointObj).forEach(key => { newScores[key] += pointObj[key]; });
      setScores(newScores);
    }
    
    // 🔥 [핵심 수정 2] 1번 질문이면서 경고 신호가 들어오면 무조건 팝업을 띄웁니다!
    if (step === 1 && showWarning) {
      setShowDisclaimer(true); 
    } else if (step < 6) {
      setStep(step + 1);
    } else {
      setStep(7); 
      setTimeout(() => {
        const sorted = Object.entries(scores).sort(([, a]: any, [, b]: any) => b - a).map(([name]) => name);
        onComplete(sorted[0], sorted[1], answers);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm font-pretendard">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col relative max-h-[85vh] overflow-hidden">
        
        {/* 헤더 */}
        <header className="px-5 py-4 flex justify-between items-center border-b border-gray-100 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Happiness Card</span>
            <div className="h-1.5 w-28 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${(step / 6) * 100}%` }}></div>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-900 transition-colors"><X size={20}/></button>
        </header>

        {/* 메인 팝업 콘텐츠 영역 */}
        <main className="flex-1 flex flex-col px-5 py-6 overflow-y-auto relative no-scrollbar">
          {step > 0 && step <= 6 && !showDisclaimer && (
            <div className="animate-slide-up space-y-6">
              <div className="space-y-2">
                <span className="text-rose-500 font-black text-xs">{step} / 6</span>
                <h3 className="text-lg font-bold text-gray-900 leading-snug whitespace-pre-wrap">{QUESTIONS[step-1].q}</h3>
              </div>
              <div className="space-y-2.5">
                {step === 1 ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {['롯데', '삼성', '국민', '농협', '신한', '기업'].map(c => (
                        <button key={c} onClick={() => setSelectedCards(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev, c])} className={`py-3.5 rounded-2xl font-bold text-sm border-2 transition-all ${selectedCards.includes(c) ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-md' : 'bg-gray-50 border-transparent text-gray-500'}`}>{c}카드</button>
                      ))}
                    </div>
                    {/* 🔥 [핵심 수정 3] 버튼 클릭 시 강제로 경고 신호(true)를 함수로 쏴줍니다! */}
                    <button onClick={() => handleNext(null, '모두 이미 사용 중', true)} className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-400 font-bold text-xs mt-1">모두 이미 사용 중이에요 😭</button>
                    {/* 🔥 디테일: 만약 카드를 6개 꽉 채워서 수동으로 선택하고 넘어가려고 해도 팝업 띄우기 방어 장착! */}
                    <button disabled={selectedCards.length === 0} onClick={() => handleNext(null, selectedCards.join(', '), selectedCards.length === 6)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg disabled:bg-gray-200 mt-4 transition-transform active:scale-95 text-sm">다음 질문으로 ➡️</button>
                  </>
                ) : (
                  QUESTIONS[step-1].options?.map((opt: any, i: number) => (
                    <button key={i} onClick={() => handleNext(opt.scores, opt.txt)} className="w-full p-4 text-left bg-white border-2 border-gray-100 rounded-2xl hover:border-rose-300 hover:bg-rose-50 transition-all group active:scale-95 shadow-sm">
                      <p className="font-bold text-gray-800 text-[13px] group-hover:text-rose-600">{opt.txt}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 🚨 실적 경고 알림창 */}
          {showDisclaimer && (
            <div className="animate-fade-in flex flex-col items-center justify-center text-center py-6">
              <span className="text-5xl mb-4 animate-bounce-short">⚠️</span>
              <h3 className="text-base font-black text-gray-900 mb-3 leading-relaxed">잠시만요 산모님!</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed break-keep bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6">
                선택하신 모든 카드사에 최근 6개월간 사용 이력이 있으시네요. 이 경우 <b className="text-rose-500">별도의 사은품이나 최대 혜택을 받지 못할 수 있어요.</b><br/><br/>
                사은품과 상관없이 산모님께 가장 잘 맞는 혜택의 카드를 계속 찾아드릴까요?
              </p>
              <button onClick={() => { setShowDisclaimer(false); setStep(2); }} className="w-full py-4 bg-gray-900 text-white rounded-xl font-black shadow-md active:scale-95 transition-transform text-sm">네, 계속 진행할게요! 🔍</button>
            </div>
          )}

          {step === 7 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-10">
              <div className="w-16 h-16 border-4 border-rose-100 border-t-rose-500 rounded-full animate-spin mb-5"></div>
              <h3 className="text-base font-black text-gray-900 mb-2">산모님의 라이프스타일을<br/>정밀 분석 중이에요...</h3>
              <p className="text-[11px] text-gray-400 font-medium">거의 다 됐어요! 찰떡 카드를 골라드릴게요 👀</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// 🛡️ 태아보험 AI 맞춤 설계소 테스트 컴포넌트 (팝업 모달형)
const InsuranceMatchingTest = ({ onCancel, onComplete }: any) => {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<any[]>([]);

  const QUESTIONS = [
    { id: 1, q: "혹시 쌍둥이를 품고 계시거나\n시험관(인공수정)을 통해 만나셨나요? 👶👶", options: [{ txt: "자연임신 / 단태아 예비맘", val: "NORMAL" }, { txt: "시험관 / 다태아(쌍둥이) 예비맘", val: "HIGH_RISK" }] },
    { id: 2, q: "보험의 '유통기한'인 만기 설정,\n어떤 가치관에 더 가까우신가요? ⚖️", options: [{ txt: "가성비파: 30세 만기 (경제적 독립 우선)", val: "30Y" }, { txt: "든든파: 100세 만기 (평생 보장 우선)", val: "100Y" }, { txt: "전문가파: 30세+100세 복층 설계 (효율 중시)", val: "HYBRID" }] },
    { id: 3, q: "가장 조심스럽지만 꼭 확인해야 할 가족력!\n암, 뇌, 심장 질환 이력이 있으신가요? 🏥", options: [{ txt: "네, 가족력이 있어 진단비를 강화하고 싶어요", val: "FAMILY_H_YES" }, { txt: "아니요, 특별한 이력은 없어요", val: "FAMILY_H_NO" }] },
    { id: 4, q: "요즘 엄마들이 가장 걱정하는 질환 중\n어떤 것이 가장 신경 쓰이시나요? 🩺", options: [{ txt: "아토피, 천식 등 환경성 질환", val: "ENV" }, { txt: "응급실 방문, 골절, 화상 등 사고", val: "ACCIDENT" }, { txt: "ADHD, 틱장애 등 소아 정신질환", val: "MENTAL" }] },
    { id: 5, q: "아기만큼 소중한 산모님의 건강!\n'산모 특약'을 추가하실 건가요? 🤰", options: [{ txt: "네, 노산이거나 첫째라 불안해서 추가할래요", val: "MOM_YES" }, { txt: "아니요, 제 실비보험으로 커버할게요", val: "MOM_NO" }] },
    { id: 6, q: "매달 내는 보험료 방식,\n어떤 조건이 더 끌리시나요? 💸", options: [{ txt: "무해지형: 해지 시 환급금 없지만 30% 저렴!", val: "LOW_COST" }, { txt: "표준형: 조금 비싸도 중도 해지 시 환급금 발생", val: "STANDARD" }] },
    { id: 7, q: "마지막! 실비 포함 매달 지출 가능한\n최대 예산 범위는 어느 정도인가요? 💰", options: [{ txt: "월 5만 원 내외 (초가성비)", val: "P1" }, { txt: "월 6~8만 원 (국민 표준)", val: "P2" }, { txt: "월 9~12만 원 (프리미엄)", val: "P3" }] },
  ];

  const handleNext = (val: string, txt: string) => {
    const newAnswers = [...answers, { qId: step, question: QUESTIONS[step - 1].q, answer: txt, value: val }];
    setAnswers(newAnswers);

    if (step < 7) {
      setStep(step + 1);
    } else {
      setStep(8); // 분석 중 화면
      setTimeout(() => {
        // 🏆 결과 도출 로직 (페르소나 매칭)
        let typeId = "TYPE2"; // 기본값: 30세 만기 표준형
        const q1 = newAnswers.find(a => a.qId === 1)?.value; // 쌍둥이/시험관
        const q2 = newAnswers.find(a => a.qId === 2)?.value; // 만기 (30Y, 100Y, HYBRID)
        const q7 = newAnswers.find(a => a.qId === 7)?.value; // 예산 (P1, P2, P3)

        if (q1 === "HIGH_RISK") {
          typeId = "TYPE4"; // 고위험군 최우선 배정
        } else if (q2 === "HYBRID") {
          typeId = "TYPE5"; // 복층 설계파
        } else if (q2 === "100Y") {
          typeId = "TYPE3"; // 100세 만기는 무조건 평생 든든형 (예산 무시)
        } else if (q2 === "30Y") {
          // 30세 만기파는 예산에 따라 초가성비 vs 국민표준으로 나뉨
          if (q7 === "P1") typeId = "TYPE1";
          else typeId = "TYPE2";
        }

        onComplete(typeId, newAnswers);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm font-pretendard">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col relative max-h-[85vh] overflow-hidden">
        <header className="px-5 py-4 flex justify-between items-center border-b border-gray-100 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Insurance AI</span>
            <div className="h-1.5 w-28 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(step / 7) * 100}%` }}></div>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-900 transition-colors"><X size={20}/></button>
        </header>

        <main className="flex-1 flex flex-col px-5 py-6 overflow-y-auto relative no-scrollbar">
          {step > 0 && step <= 7 && (
            <div className="animate-slide-up space-y-6">
              <div className="space-y-2">
                <span className="text-blue-500 font-black text-xs">{step} / 7</span>
                <h3 className="text-lg font-bold text-gray-900 leading-snug whitespace-pre-wrap">{QUESTIONS[step-1].q}</h3>
              </div>
              <div className="space-y-2.5">
                {QUESTIONS[step-1].options.map((opt: any, i: number) => (
                  <button key={i} onClick={() => handleNext(opt.val, opt.txt)} className="w-full p-4 text-left bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all group active:scale-95 shadow-sm">
                    <p className="font-bold text-gray-800 text-[13px] group-hover:text-blue-600">{opt.txt}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in py-10">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-5"></div>
              <h3 className="text-base font-black text-gray-900 mb-2">산모님의 답변을 바탕으로<br/>최적의 플랜을 설계 중이에요...</h3>
              <p className="text-[11px] text-gray-400 font-medium">거의 다 됐어요! 맞춤 리포트를 생성할게요 📝</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// 👩‍🍼 산후도우미 정부지원금 계산기 & AI 매칭 모달 (빨간줄 완벽 제거!)
const HelperMatchingTest = ({ mode, onCancel, onComplete }: any) => {
  // mode가 'VOUCHER'면 1단계부터, 'AI'면 3단계(질문)부터 시작!
  const [step, setStep] = useState(mode === 'VOUCHER' ? 1 : 3);
  const [form, setForm] = useState({ babyType: 'A-1', incomeType: '통합형', periodIdx: 1 });
  const [answers, setAnswers] = useState<any[]>([]);

  const VOUCHER_DATA: Record<string, any> = {
    'A-1': { label: 'A-① 단태아 첫째아', p: [{ t:'단축 (5일)', tot:732000, s:{'가형':659000, '통합형':569000, '라형':456000}}, { t:'표준 (10일)', tot:1464000, s:{'가형':1165000, '통합형':1002000, '라형':764000}}, { t:'연장 (15일)', tot:2196000, s:{'가형':1525000, '통합형':1303000, '라형':1035000}}] },
    'A-2': { label: 'A-② 단태아 둘째아', p: [{ t:'단축 (10일)', tot:1464000, s:{'가형':1345000, '통합형':1165000, '라형':943000}}, { t:'표준 (15일)', tot:2196000, s:{'가형':1794000, '통합형':1525000, '라형':1193000}}, { t:'연장 (20일)', tot:2928000, s:{'가형':2094000, '통합형':1767000, '라형':1440000}}] },
    'A-3': { label: 'A-③ 단태아 셋째아 이상', p: [{ t:'단축 (10일)', tot:1464000, s:{'가형':1374000, '통합형':1195000, '라형':973000}}, { t:'표준 (15일)', tot:2196000, s:{'가형':1838000, '통합형':1548000, '라형':1236000}}, { t:'연장 (20일)', tot:2928000, s:{'가형':2154000, '통합형':1797000, '라형':1499000}}] },
    'B-1': { label: 'B-① 쌍태아 (인력 1명)', p: [{ t:'단축 (10일)', tot:1832000, s:{'가형':1758000, '통합형':1572000, '라형':1274000}}, { t:'표준 (15일)', tot:2748000, s:{'가형':2357000, '통합형':2050000, '라형':1605000}}, { t:'연장 (20일)', tot:3664000, s:{'가형':2771000, '통합형':2436000, '라형':1952000}}] },
    'B-2': { label: 'B-② 쌍태아 (인력 2명)', p: [{ t:'단축 (10일)', tot:2848000, s:{'가형':2614000, '통합형':2369000, '라형':2004000}}, { t:'표준 (15일)', tot:4272000, s:{'가형':3478000, '통합형':3165000, '라형':2698000}}, { t:'연장 (20일)', tot:5696000, s:{'가형':4289000, '통합형':3915000, '라형':3353000}}] }
  };

  const currentData = VOUCHER_DATA[form.babyType];
  const currentPeriod = currentData.p[form.periodIdx];
  const subsidy = currentPeriod.s[form.incomeType];
  const myCost = currentPeriod.tot - subsidy;

  const QUESTIONS = [
    { q: "가장 중요한 1순위는 무엇인가요?", opts: [{ t: "아기 케어 전담 (목욕/수유) 전문가", v: "아기 케어(목욕/수유 등)를 최우선으로 전담해주실 베테랑 이모님을 원합니다. 가사 비중은 적어도 괜찮습니다." }, { t: "가사/요리 완벽, 초보맘 코칭", v: "초보맘이라 많이 배우고 싶으며, 아기 케어와 함께 식사와 집안일(가사)을 깔끔하게 도와주실 분을 원합니다." }] },
    { q: "식사 및 요리 스타일은요?", opts: [{ t: "이모님 손맛 팍팍! 맛있는 식사", v: "식사는 이모님께서 냉장고 파먹기 등 솜씨 좋게 챙겨주시면 좋겠습니다." }, { t: "배달/간편식 OK, 대신 철저한 위생!", v: "식사는 배달이나 밀키트로 해결해도 괜찮으니, 청소와 위생(젖병 소독 등)에 더 신경 써주세요." }] },
    { q: "홈캠(CCTV)이 있으신가요?", opts: [{ t: "네, 거실/아기방에 있어요 📷", v: "거실과 아기방에 홈캠이 작동 중이오니 동의하시는 분만 배정 부탁드립니다." }, { t: "아니요, 따로 없습니다", v: "" }] },
    { q: "반려동물이 있으신가요?", opts: [{ t: "네, 강아지/고양이가 있어요 🐶", v: "집에 반려동물이 있으니 동물을 무서워하지 않으시는 분이 필수입니다." }, { t: "아니요, 없습니다", v: "" }] },
    { q: "수유 계획은 어떻게 되시나요?", opts: [{ t: "완모 목표! (가슴마사지/코칭 필요)", v: "모유 수유를 목표로 하고 있어 수유 자세 코칭과 가슴 마사지 경험이 많으신 분을 선호합니다." }, { t: "분유/혼합! (칼같은 텀 관리 필요)", v: "분유/혼합 수유 예정이므로 철저한 젖병 소독과 수유 텀 관리를 잘해주셨으면 합니다." }] },
    { q: "선호하는 이모님 성향은?", opts: [{ t: "친정엄마처럼 다정하고 말벗이 되는 분", v: "친정엄마처럼 따뜻하게 말벗도 되어주시고 다정한 성향이신 분이 좋습니다." }, { t: "사담 NO! 묵묵하고 조용한 프로페셔널", v: "사적인 대화나 참견은 최소화해 주시고, 조용히 묵묵하게 본인 업무에 집중해 주시는 분을 선호합니다." }] },
  ];

  const handleNextQuestion = (val: string) => {
    const newAnswers = [...answers, val];
    setAnswers(newAnswers);
    if (step - 2 < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      setStep(10);
      setTimeout(() => {
        const text = `[산후도우미 매칭 요청서]\n\n안녕하세요, 출산 예정인 산모입니다. 저와 잘 맞는 이모님 배정을 위해 아래 요청사항을 꼭 확인해 주세요!\n\n${newAnswers.filter(Boolean).map(a => `- ${a}`).join('\n')}\n- 기타: 종교 강요 절대 금지, 백일해 접종 완료자 필수\n\n위 조건에 잘 맞는 에이스 이모님으로 배정 부탁드립니다!`;
        onComplete('AI', text);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/70 flex flex-col justify-end sm:justify-center items-center animate-fade-in p-0 sm:p-4 pb-safe backdrop-blur-sm font-pretendard">
      <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col relative max-h-[90vh] overflow-hidden">
        <header className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10 shrink-0">
          <div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${mode === 'VOUCHER' ? 'text-emerald-500' : 'text-blue-500'}`}>
              {mode === 'VOUCHER' ? 'Voucher Calculator' : 'AI Matching'}
            </span>
            <div className="text-sm font-bold text-gray-900">
              {mode === 'VOUCHER' ? (step === 1 ? '정부지원 바우처 1분 계산기' : '바우처 견적 상세 리포트') : '찰떡 이모님 매칭 테스트'}
            </div>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-900"><X size={24}/></button>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-5 bg-gray-50/50">
          {/* VOUCHER 모드: STEP 1, 2 */}
          {mode === 'VOUCHER' && step === 1 && (
            <div className="space-y-6 animate-slide-up pb-10">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">1. 출산 자녀 유형 (단태아/다태아)</label>
                <select value={form.babyType} onChange={e => setForm({...form, babyType: e.target.value})} className="w-full p-4 bg-white border border-gray-200 rounded-xl font-bold text-sm text-gray-800 outline-none focus:border-emerald-500 shadow-sm">
                  {Object.keys(VOUCHER_DATA).map(k => <option key={k} value={k}>{VOUCHER_DATA[k].label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">2. 건강보험료 소득 구간 <span className="text-[10px] font-normal text-gray-400 ml-1">(3인 가구 약 29만 원 기준)</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {['가형', '통합형', '라형'].map(inc => (
                    <button key={inc} onClick={() => setForm({...form, incomeType: inc})} className={`py-3 text-xs font-bold rounded-xl border ${form.incomeType === inc ? 'bg-emerald-50 text-emerald-600 border-emerald-500 shadow-sm' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {inc}<br/><span className="text-[9px] font-normal opacity-70">{inc==='가형'?'수급자/차상위':inc==='통합형'?'150% 이하':'150% 초과'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700">3. 서비스 이용 기간</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map(idx => (
                    <button key={idx} onClick={() => setForm({...form, periodIdx: idx})} className={`py-3 text-xs font-bold rounded-xl border ${form.periodIdx === idx ? 'bg-emerald-50 text-emerald-600 border-emerald-500 shadow-sm' : 'bg-white text-gray-500 border-gray-200'}`}>
                      {currentData.p[idx].t.split(' ')[0]}<br/><span className="text-[10px] opacity-70">{currentData.p[idx].t.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setStep(2)} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-transform text-sm">내 바우처 견적 계산하기 🧮</button>
            </div>
          )}

          {mode === 'VOUCHER' && step === 2 && (
            <div className="animate-fade-in space-y-6 pb-6">
              <div className="bg-[#FCFAF2] border border-[#EBE5D3] p-6 rounded-2xl shadow-sm">
                <div className="inline-block bg-[#F4EEDB] text-[#8C7B50] text-[10px] font-bold px-2 py-1 rounded-md mb-3">
                  {new Date().getFullYear()}년 • {form.incomeType} • {currentPeriod.t.split(' ')[0]}
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">{currentData.label.split(' ')[1]} {currentPeriod.t.split(' ')[0]} 기준 예상 본인부담금</h3>
                <p className="text-3xl font-black text-[#B08D38] mb-4">{myCost.toLocaleString()}원</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-[#EBE5D3]"><p className="text-[10px] text-gray-400 mb-1">서비스가격</p><p className="font-bold text-gray-800">{currentPeriod.tot.toLocaleString()}원</p></div>
                  <div className="bg-white p-3 rounded-xl border border-[#EBE5D3]"><p className="text-[10px] text-gray-400 mb-1">정부지원금</p><p className="font-bold text-gray-800">{subsidy.toLocaleString()}원</p></div>
                  <div className="bg-white p-3 rounded-xl border border-[#EBE5D3]"><p className="text-[10px] text-gray-400 mb-1">판정 소득유형</p><p className="font-bold text-gray-800">{form.incomeType}</p></div>
                  <div className="bg-white p-3 rounded-xl border border-[#EBE5D3]"><p className="text-[10px] text-[#B08D38] mb-1">예상 본인부담금</p><p className="font-bold text-[#B08D38]">{myCost.toLocaleString()}원</p></div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
                <p className="text-[11px] font-bold text-gray-700 mb-5 flex items-center gap-1"><PieChart size={14}/> 서비스가격·지원금·본인부담금 비교</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-gray-500 text-right">서비스가격</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-r-md"><div className="h-full bg-[#D4AF37] rounded-r-md shadow-sm" style={{width: '100%'}}></div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-gray-500 text-right">정부지원금</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-r-md"><div className="h-full bg-[#4E9B65] rounded-r-md shadow-sm" style={{width: `${(subsidy/currentPeriod.tot)*100}%`}}></div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[10px] text-gray-500 text-right">본인부담금</span>
                    <div className="flex-1 h-5 bg-gray-50 rounded-r-md"><div className="h-full bg-[#C26B3E] rounded-r-md shadow-sm" style={{width: `${(myCost/currentPeriod.tot)*100}%`}}></div></div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
                 <p className="text-[11px] font-bold text-gray-800 mb-3 border-b pb-2">💡 자주 묻는 질문</p>
                 <div className="space-y-3">
                   <div className="bg-yellow-50/50 p-3 rounded-lg"><p className="text-[10px] font-bold text-yellow-800 mb-1">Q. 본인부담금이 실제 결제금액과 같나요?</p><p className="text-[10px] text-gray-600 leading-relaxed">항상 같지는 않습니다. 실제 결제는 제공기관 자율가격 및 추가 계약에 따라 달라질 수 있습니다.</p></div>
                 </div>
              </div>

              {/* 🔥 AI로 넘어가지 않고 여기서 바로 저장하고 닫기! */}
              <button onClick={() => {
                const voucherRes = { type: `${currentData.label.split(' ')[0]}-${form.incomeType.replace('형','')}`, period: currentPeriod.t, total: currentPeriod.tot, sub: subsidy, myCost };
                onComplete('VOUCHER', voucherRes);
              }} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-md active:scale-95 transition-transform text-sm mt-4">
                내 견적 저장하고 닫기 ✅
              </button>
            </div>
          )}

          {/* AI 모드: STEP 3 ~ 10 */}
          {mode === 'AI' && step > 2 && step <= 8 && (
            <div className="animate-slide-up space-y-6 pt-4">
              <div className="space-y-2">
                <span className="text-blue-500 font-black text-xs">Q{step - 2} / 6</span>
                <h3 className="text-lg font-bold text-gray-900 leading-snug break-keep">{QUESTIONS[step-3].q}</h3>
              </div>
              <div className="space-y-3">
                {QUESTIONS[step-3].opts.map((opt, i) => (
                  <button key={i} onClick={() => handleNextQuestion(opt.v)} className="w-full p-5 text-left bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-95 shadow-sm font-bold text-gray-800 text-[13px]">
                    {opt.t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'AI' && step === 10 && (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin mb-5"></div>
              <h3 className="text-base font-black text-gray-900 mb-2">산모님의 성향을 분석하여<br/>요청서를 작성 중이에요...</h3>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// 🔥 2-2. 로그인 유저용 맘스픽 화면 (모든 Hook은 여기에 모아둡니다!)
const LocalMomsSectionLoggedIn = ({ user, region, onUpdateUser, addToast, onOpenBoard, helpers, setActiveTab, setShowRegistryReport, onGoGarden, onGoCare }: any) => {
  
  // 💡 [수정] stats를 일반 변수가 아닌 '상태(State)'로 관리하여 실시간 반영 보장
  const [stats, setStats] = useState(getStatsData() || { totalUsers: 0, hospitals: [], cares: [], regionStats: [], genders: [], balance: {A:0, B:0} });

  useEffect(() => {
    let checkCount = 0;
    const interval = setInterval(() => {
      const freshStats = getStatsData();
      if (freshStats && (freshStats.hospitals?.length > 0 || freshStats.cares?.length > 0)) {
        setStats({ ...freshStats });
        clearInterval(interval);
      }
      checkCount++;
      if (checkCount > 20) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const getCleanName = (name: string) => (name || '').replace(/\s/g, '').replace(/병원|의원|여성|산부인과/g, '');
  const getCleanCareName = (name: string) => (name || '').replace(/\s/g, '').replace(/산후조리원|조리원/g, '');

  const [currentUsers, setCurrentUsers] = useState(1000);
  const targetUsers = 1000;

  const [realBalanceStats, setRealBalanceStats] = useState({ A: 0, B: 0 });
  
  // 🔥 [핵심 수정 1] 모달창 상태를 조건문 밖(최상단)으로 안전하게 빼냅니다!
  const [showWorldCup, setShowWorldCup] = useState(false);
  const [showCompareTable, setShowCompareTable] = useState(false);
  const [showInsTest, setShowInsTest] = useState(false);     // 태아보험 AI 테스트 팝업
  const [showInsDetail, setShowInsDetail] = useState(false); // 태아보험 상세 리포트 팝업

  const [showHelperVoucher, setShowHelperVoucher] = useState(false);
  const [showHelperAi, setShowHelperAi] = useState(false);

  const [showVoucherResultModal, setShowVoucherResultModal] = useState(false);
  const [showAiResultModal, setShowAiResultModal] = useState(false);
  const [showVoucherDetailModal, setShowVoucherDetailModal] = useState(false);

  useEffect(() => {
    const fetchTodayBalance = async () => {
      try {
        const q = query(collection(db, 'balance_votes'), where('date', '==', todayStr));
        const snap = await getDocs(q);
        let countA = 0; let countB = 0;
        snap.forEach(doc => {
          if (doc.data().selected === 'A') countA++;
          else countB++;
        });
        setRealBalanceStats({ A: countA, B: countB });
      } catch(e) { console.error("밸런스 투표 로드 실패:", e); }
    };
    fetchTodayBalance();
  }, [user?.balanceCount]);

  useEffect(() => {
    const fetchRealUserCount = async () => {
      if (!db) return;
      try {
        const snapshot = await getCountFromServer(collection(db, 'users'));
        const realCount = snapshot.data().count;
        if (realCount > 0) {
          setCurrentUsers(realCount);
        }
      } catch (e) {
        console.error("가입자 수 가져오기 실패:", e);
      }
    };
    fetchRealUserCount();
  }, []);

  const isRealData = currentUsers >= targetUsers;
  const displayUser = user || {};
  const [searchTerm, setSearchTerm] = useState('');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [tempDate, setTempDate] = useState(displayUser.dueDate || '');
  const [isPreMom, setIsPreMom] = useState(false);
  const [isOtherHospRegion, setIsOtherHospRegion] = useState(false);
  const [hospFormType, setHospFormType] = useState<'NONE'|'LOOKING'|'ATTENDING'>('NONE');
  const [isHospLooking, setIsHospLooking] = useState(false); // ✅ 산부인과 알아보고 있어요 상태
  const [isHospFocused, setIsHospFocused] = useState(false); 
  const [isCareFocused, setIsCareFocused] = useState(false);
  const [hSido, setHSido] = useState('');
  const [hSigugun, setHSigugun] = useState('');
  const [babyGender, setBabyGender] = useState(displayUser.babyGender || '');
  
  const GENDER_OPTIONS = [
    { label: '아직 몰라요', emoji: '❓' }, { label: '딸', emoji: '👧' }, { label: '아들', emoji: '👦' },
    { label: '이란성쌍둥이', emoji: '👧👦' }, { label: '딸 쌍둥이', emoji: '👧👧' }, { label: '아들 쌍둥이', emoji: '👦👦' }, { label: '세쌍둥이+', emoji: '👶👶👶' }
  ];

  const hasData = (!!displayUser.myHospitalName && !!displayUser.dueDate) || displayUser.myHospitalName === '예비맘';
  const [isEditing, setIsEditing] = useState(false);
  const [activeMomTab, setActiveMomTab] = useState('dashboard');
  
  // 🔥 [핵심 해결] 변수가 생성된 '이후'에 안전장치를 달아야 앱이 터지지 않습니다!
  useEffect(() => {
    setShowWorldCup(false);
    setShowCompareTable(false);
    setShowInsTest(false);
    setShowInsDetail(false);
    setShowHelperVoucher(false); // 🚀 [수정] 
    setShowHelperAi(false);
    setShowVoucherResultModal(false);
    setShowAiResultModal(false);
  }, [activeMomTab]);

  const district = (displayUser.address || '서울 강남구').split(' ')[1] || '동네';
  const currentWeek = calculatePregnancyWeek(displayUser.dueDate);
  const exactDDay = displayUser.dueDate ? calculateDDay(displayUser.dueDate) : 0;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const target = window.localStorage.getItem('targetMomTab');
      if (target) {
        setActiveMomTab(target);
        window.localStorage.removeItem('targetMomTab');
      }
    }
  }, []);

  useEffect(() => {
    const activeBtn = document.getElementById(`mom-tab-${activeMomTab}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeMomTab]);

  const INS_PRICE_LABELS = ["5만 원 미만", "5~7만 원", "7~10만 원", "10~12만 원", "12만 원 이상"];
  const [insStatus, setInsStatus] = useState<'NONE'|'FORM'|'DONE'>(displayUser.insCompany ? 'DONE' : 'NONE');
  const [insCompany, setInsCompany] = useState(displayUser.insCompany || '');
  const [insPriceIdx, setInsPriceIdx] = useState(displayUser.insPrice ? Math.max(0, INS_PRICE_LABELS.indexOf(displayUser.insPrice)) : 1);

  const [careStatus, setCareStatus] = useState<'NONE'|'FORM'|'DONE'>(displayUser.myCareCenter ? 'DONE' : 'NONE');
  const [isCareLooking, setIsCareLooking] = useState(false); // ✅ 산후조리원 알아보고 있어요 상태
  const [careSearchTerm, setCareSearchTerm] = useState('');
  const [careHospitals, setCareHospitals] = useState<any[]>([]);
  const [selectedCare, setSelectedCare] = useState<any>(displayUser.myCareCenter ? {name: displayUser.myCareCenter, address: displayUser.myCareCenterAddress} : null);
  const [hospMaster, setHospMaster] = useState<any[]>([]);
  const [careMaster, setCareMaster] = useState<any[]>([]);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const hSnap = await getDocs(collection(db, 'hospitals_master'));
        setHospMaster(hSnap.docs.map(d => ({id: d.id, ...d.data()})));
        const cSnap = await getDocs(collection(db, 'cares_master'));
        setCareMaster(cSnap.docs.map(d => ({id: d.id, ...d.data()})));
      } catch(e) { console.error("마스터 데이터 로드 실패:", e); }
    };
    if (db) fetchMasterData();
  }, []);
  
  const [isOtherCareRegion, setIsOtherCareRegion] = useState(false);
  const [cSido, setCSido] = useState('');
  const [cSigugun, setCSigugun] = useState('');
  const [careViewSido, setCareViewSido] = useState('');
  const [careViewSigugun, setCareViewSigugun] = useState('');
  const [searchedCareRegion, setSearchedCareRegion] = useState('');
  const [helperViewSido, setHelperViewSido] = useState('');
  const [helperViewSigugun, setHelperViewSigugun] = useState('');
  const [searchedHelperRegion, setSearchedHelperRegion] = useState('');

  const [babyL1, setBabyL1] = useState('1_safety');
  const [babyL2, setBabyL2] = useState('유모차');
  const [babyTab, setBabyTab] = useState<'naver'|'coupang'>('naver');
  const [babyData, setBabyData] = useState<any[]>([]);
  const [isBabyLoading, setIsBabyLoading] = useState(false);

  useEffect(() => {
    if (activeMomTab !== 'baby') return;
    const fetchBabyData = async () => {
      setIsBabyLoading(true);
      try {
        const docRef = doc(db, "moms_pick_cache", babyL2);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBabyData(docSnap.data().trends || []);
        } else {
          const result = await fetchNaverTrend(babyL2); 
          if (result && result.length > 0) {
            setBabyData(result);
          } else {
            const mallItems = getMallItems();
            const filtered = mallItems
              .filter((item: any) => item.subCategory === babyL2)
              .map((item: any) => ({ rank: item.rank, name: item.title, trend: item.badge || '인기' }));
            setBabyData(filtered);
          }
        }
      } catch (e) {
        console.error("데이터 로드 실패", e);
      } finally {
        setIsBabyLoading(false);
      }
    };
    fetchBabyData();
  }, [activeMomTab, babyL2]);

  // 🌟 맘스픽: 산부인과 검색 (서버 API 연동 완벽 복구!)
  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (selectedHospital && val !== selectedHospital.name) setSelectedHospital(null);
    if (val.length > 0) {
      try {
        // 🔥 서버에 "산부인과" 키워드를 붙여서 카카오 검색을 요청합니다.
        const res = await fetch(`/api/search/hospital?query=${encodeURIComponent(val + ' 산부인과')}`);
        const data = await res.json();
        // 🔥 카카오 API가 내려주는 데이터 형태(place_name, road_address_name)를 앱에 맞게 변환!
        if (Array.isArray(data)) {
          setHospitals(data.map((item: any) => ({ 
            id: item.id, 
            name: item.place_name, 
            address: item.road_address_name || item.address_name, 
            lat: item.y, lng: item.x 
          })));
        } else { setHospitals([]); }
      } catch (e) { console.error("검색 실패", e); setHospitals([]); }
    } else { setHospitals([]); }
  };

  // 🌟 맘스픽: 산후조리원 검색 (서버 API 연동 완벽 복구!)
  const handleCareSearch = async (val: string) => {
    setCareSearchTerm(val);
    if (selectedCare && val !== selectedCare.name) setSelectedCare(null);
    if (val.length > 0) {
      try {
        // 🔥 서버에 "산후조리원" 키워드를 붙여서 카카오 검색을 요청합니다.
        const res = await fetch(`/api/search/hospital?query=${encodeURIComponent(val + ' 산후조리원')}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setCareHospitals(data.map((item: any) => ({ 
            id: item.id, 
            name: item.place_name, 
            address: item.road_address_name || item.address_name, 
            lat: item.y, lng: item.x 
          })));
        } else { setCareHospitals([]); }
      } catch (e) { console.error("조리원 검색 실패", e); setCareHospitals([]); }
    } else { setCareHospitals([]); }
  };

  const handleHospSubmit = () => {
    if (hospFormType === 'NONE') return;
    if (hospFormType === 'LOOKING') {
      if (!tempDate) { addToast('error', '출산 예정일을 입력해주세요.'); return; }
      onUpdateUser({ 
        ...displayUser, 
        myHospitalName: '알아보는 중', 
        myHospitalAddress: '',
        hospitalRegion: displayUser.address || '서울 강남구',
        dueDate: tempDate,
        babyGender
      });
      addToast('success', '등록완료! 대시보드를 확인하세요.');
      return;
    }
    if (hospFormType === 'ATTENDING') {
      // ✅ '알아보고 있어요' 체크 시 파이어베이스 처리
      if (isHospLooking) {
        onUpdateUser({ 
          ...displayUser, 
          myHospitalName: '알아보는 중', 
          myHospitalAddress: '',
          hospitalRegion: displayUser.address || '서울 강남구',
          dueDate: tempDate,
          babyGender
        });
        addToast('success', '천천히 알아보셔도 좋아요. 봄이옴이 함께할게요! 💕');
      } else {
        if (!selectedHospital) { addToast('error', '다니시는 산부인과를 선택해주세요.'); return; }
        let autoRegion = displayUser.address || '서울 강남구';
        if (selectedHospital.address) {
          const parts = selectedHospital.address.split(' ');
          if (parts.length >= 2) autoRegion = `${normalizeSido(parts[0])} ${parts[1]}`;
        }
        const targetRegion = isOtherHospRegion && hSido && hSigugun ? `${hSido} ${hSigugun}` : autoRegion;
        onUpdateUser({ 
          ...displayUser, 
          myHospitalName: selectedHospital.name, 
          myHospitalAddress: selectedHospital.address,
          hospitalRegion: targetRegion,
          dueDate: tempDate,
          babyGender
        });
        addToast('success', '멋진 곳이네요! 등록 완료되었습니다 🎉');
      }
    }
  };

  const handlePreMomSubmit = () => {
    onUpdateUser({ ...displayUser, myHospitalName: '예비맘', dueDate: '2099-12-31', babyGender: '' });
    addToast('success', '예비맘 모드로 대시보드를 시작합니다!');
  };

  const handleInsSubmit = () => {
    onUpdateUser({ ...displayUser, insCompany, insPrice: INS_PRICE_LABELS[insPriceIdx] });
    addToast('success', '정보 공유 감사합니다! 통계를 확인해보세요.');
    setInsStatus('DONE');
  };

  const handleCareSubmit = () => {
    // ✅ '알아보고 있어요' 체크 시 파이어베이스 처리
    if (isCareLooking) {
      onUpdateUser({ 
        ...displayUser, 
        myCareCenter: '알아보는 중', 
        myCareCenterAddress: '',
        careRegion: displayUser.address || '서울 강남구'
      });
      addToast('success', '천천히 알아보셔도 좋아요. 인기 랭킹을 먼저 참고해 보세요! 💕');
      setCareStatus('DONE');
    } else {
      if(!selectedCare) return;
      let autoCareRegion = displayUser.address || '서울 강남구';
      if (selectedCare.address) {
        const parts = selectedCare.address.split(' ');
        if (parts.length >= 2) autoCareRegion = `${normalizeSido(parts[0])} ${parts[1]}`;
      }
      const targetCareRegion = isOtherCareRegion && cSido && cSigugun ? `${cSido} ${cSigugun}` : autoCareRegion;
      onUpdateUser({ 
        ...displayUser, 
        myCareCenter: selectedCare.name, 
        myCareCenterAddress: selectedCare.address,
        careRegion: targetCareRegion
      });
      addToast('success', '공유 완료! 동네 랭킹을 확인해보세요.');
      setCareStatus('DONE');
    }
  };

  const getWeekMessage = (week: number) => {
    if (displayUser.myHospitalName === '예비맘') return "💖 예비맘님, 건강한 임신 준비를 응원합니다! 봄이옴에서 미리 정보를 확인해보세요.";
    if (week <= 7) return "🎉 임신을 진심으로 축하드립니다! 가장 먼저 안심하고 다닐 '산부인과'를 정해보세요.";
    if (week <= 12) return "💡 이 시기엔 '태아보험' 가입을 많이 알아봐요! 봄이옴에서 선배 맘들의 추천 보험을 확인해보세요.";
    if (week <= 16) return "🏨 인기 있는 '산후조리원'은 일찍 마감된답니다! 우리 동네 인기 조리원을 서둘러 확인해보세요.";
    if (week <= 28) return "🌿 안정기에 접어드신 걸 축하해요! 슬슬 출산 용품과 '산후도우미' 정보를 살펴볼까요?";
    if (week <= 40) return "👶 출산이 얼마 남지 않았네요! '출산가방' 리스트를 체크하고 순산을 기원합니다. 파이팅!";
    return "🌷 선배맘님! 후배 산모들을 위해 소중한 임신/출산 경험을 적극적으로 공유해 주세요!";
  };
  
  const MOCK_HOSPITALS = [
    {name: '차여성의원', count: 124}, {name: '미즈메디병원', count: 98}, 
    {name: '곽여성병원', count: 76}, {name: '린여성병원', count: 52}, {name: '햇빛병원', count: 31}
  ];

  const matchSmartRegion = (dbRegionStr: string, currentDisplay: string, userFullAddr: string) => {
    if (!dbRegionStr) return false;
    
    // 1. 기준 단어 추출 (화면 표시용 '성남시' 또는 유저 진짜 주소에서 구/시 이름 추출)
    const targetAddr = userFullAddr || '';
    const parts = targetAddr.trim().split(/\s+/);
    
    // 유저 주소의 2번째 단어(성남시, 강남구 등)를 가져오되, 없으면 기본 디스플레이 키워드 사용
    let targetKeyword = parts[1] || currentDisplay;
    
    // 공백을 다 없애서 띄어쓰기 버그를 원천 차단합니다.
    const cleanDb = dbRegionStr.replace(/\s/g, '');
    const cleanTarget = targetKeyword.replace(/\s/g, '');
    
    if (!cleanTarget) return false;

    // 2. 서울 중구 vs 부산 중구 섞임 대참사 방지용 시/도 안전장치
    const dbFirstWord = dbRegionStr.trim().split(/\s+/)[0] || '';
    const userFirstWord = parts[0] || '';
    
    if (dbFirstWord && userFirstWord) {
      const dbSido = normalizeSido(dbFirstWord);
      const userSido = normalizeSido(userFirstWord);
      if (dbSido !== userSido) return false; // 시/도가 다르면 매칭 취소!
    }

    // 3. 2단계 키워드가 서로 포함 관계인지 검사 ("성남시" 가 "경기도 성남시"에 포함되는가?)
    return cleanDb.includes(cleanTarget) || cleanTarget.includes(cleanDb);
  };

  // 🏥 산부인과 매칭에 스마트 필터 적용
  const hospRegionFull = displayUser.hospitalRegion || displayUser.address || '서울 강남구';
  const hospRegionDisplay = hospRegionFull.split(' ')[1] || district;
  const localHospMaster = hospMaster.filter((h:any) => matchSmartRegion(h.region, hospRegionDisplay, hospRegionFull));
  const realHospList = (stats.hospitals || []).filter((h:any) => matchSmartRegion(h.region, hospRegionDisplay, hospRegionFull));

  const actualHospTotal = realHospList.reduce((acc:any, cur:any) => acc + (cur.count || 0), 0);
  const isGlobalHybridOpen = currentUsers >= 1000;
  const isRegionalHospRealOpen = actualHospTotal >= 100;

  let hospitalList: any[] = [];
  const baseHospData = localHospMaster.length > 0 ? localHospMaster : MOCK_HOSPITALS.map(m => ({ name: m.name, count: m.count }));

  if (isRegionalHospRealOpen) {
    hospitalList = [...realHospList];
  } else if (isGlobalHybridOpen) {
    const merged = baseHospData.map((m: any) => ({ 
      name: m.name, 
      count: Number(m.count) || 15, // 0% 방지 베이스 점수
      isExternal: true 
    }));

    realHospList.forEach((r: any) => {
      const rClean = getCleanName(r.name);
      const ex = merged.find(m => getCleanName(m.name).includes(rClean) || rClean.includes(getCleanName(m.name)));
      if (ex) { ex.count += (Number(r.count) * 3); ex.isBomionPick = true; } 
      else { merged.push({ name: r.name, count: (Number(r.count) * 3), isBomionPick: true }); }
    });
    hospitalList = merged;
  } else {
    hospitalList = baseHospData.map((m: any) => ({ name: m.name, count: Number(m.count) || 15 }));
  }

  // 내 병원 매칭 검사 시에도 띄어쓰기 버그 방지 공백 제거 적용
  const myHospClean = getCleanName(displayUser.myHospitalName);
  if (displayUser.myHospitalName && !['예비맘','알아보는 중'].includes(displayUser.myHospitalName) && !hospitalList.find((h:any) => getCleanName(h.name).includes(myHospClean) || myHospClean.includes(getCleanName(h.name)))) {
    hospitalList.push({ name: displayUser.myHospitalName, count: 3, isBomionPick: true }); 
  }
  hospitalList.sort((a:any,b:any) => b.count - a.count);
  const totalHospUsers = hospitalList.reduce((acc:any, cur:any) => acc + (Number(cur.count) || 0), 0) || 1;
  const top10Hosp = hospitalList.slice(0, 10);
  const isMyHospInTop10 = top10Hosp.some((h:any) => h.name === displayUser.myHospitalName);
  const myHospIndex = hospitalList.findIndex((h:any) => h.name === displayUser.myHospitalName);
  const myHospRank = myHospIndex + 1;
  const myHospCount = myHospIndex >= 0 ? hospitalList[myHospIndex].count : 1;
  const myHospPct = Math.round((myHospCount / totalHospUsers) * 100);

  const insTop5 = [{name:'현대해상 굿앤굿', pct: 65}, {name:'KB 희망플러스', pct: 15}, {name:'메리츠 내맘같은', pct: 10}, {name:'DB 손해보험', pct: 5}, {name:'삼성화재', pct: 5}];
  const priceChartData = [
    { label: '~5만', pct: 2 }, { label: '5~7만', pct: 45 }, { label: '7~10만', pct: 30 }, { label: '10~12만', pct: 15 }, { label: '12만~', pct: 8 }
  ];

  const currentRegionGu = region ? region.split(' ')[1] : district;
  const careRegionDisplay = searchedCareRegion 
    ? (searchedCareRegion.includes(' ') ? searchedCareRegion.split(' ')[1] : searchedCareRegion)
    : (displayUser.careRegion ? displayUser.careRegion.split(' ')[1] : currentRegionGu);

  // 매칭에 사용할 전체 주소 (matchSmartRegion에 넘길 용도)
  const careRegionFull = searchedCareRegion || displayUser.careRegion || displayUser.address || '서울 강남구';
  
  const MOCK_CARES = [
    {name: '트리니티 산후조리원', count: 150}, {name: '헤리티지 산후조리원', count: 120}, 
    {name: '올리비움 산후조리원', count: 95}, {name: '세인트파크 산후조리원', count: 70}, {name: '궁 산후조리원', count: 55}
  ];

  const localCareMaster = careMaster.filter((c:any) => matchSmartRegion(c.region, careRegionDisplay, careRegionFull));
  const realCareList = (stats.cares || []).filter((c:any) => matchSmartRegion(c.region, careRegionDisplay, careRegionFull));

  const actualCareTotal = realCareList.reduce((acc:any, cur:any) => acc + (cur.count || 0), 0);
  const isRegionalCareRealOpen = actualCareTotal >= 100;

  let careList: any[] = [];
  const baseCareData = localCareMaster.length > 0 ? localCareMaster : MOCK_CARES.map(m => ({ name: m.name, count: m.count }));

  if (isRegionalCareRealOpen) {
    careList = [...realCareList];
  } else if (isGlobalHybridOpen) {
    const merged = baseCareData.map((m: any) => ({ name: m.name, count: Number(m.count) || 15, isExternal: true }));
    realCareList.forEach((r: any) => {
      const rClean = getCleanCareName(r.name);
      const ex = merged.find(m => getCleanCareName(m.name).includes(rClean) || rClean.includes(getCleanCareName(m.name)));
      if (ex) { ex.count += (Number(r.count) * 3); ex.isBomionPick = true; } 
      else { merged.push({ name: r.name, count: (Number(r.count) * 3), isBomionPick: true }); }
    });
    careList = merged;
  } else {
    careList = baseCareData.map((m: any) => ({ name: m.name, count: Number(m.count) || 15 }));
  }

  const myCareClean = getCleanCareName(displayUser.myCareCenter);
  if (!searchedCareRegion && displayUser.myCareCenter && !['알아보는 중','안감','안 가기로 했어요'].includes(displayUser.myCareCenter) && !careList.find((c:any) => getCleanCareName(c.name).includes(myCareClean) || myCareClean.includes(getCleanCareName(c.name)))) {
    careList.push({ name: displayUser.myCareCenter, count: 3, isBomionPick: true }); 
  }
  careList.sort((a:any,b:any) => b.count - a.count);

  // 💡 조리원 전체 분모 점수 합산 방어막 가동
  const totalCareUsers = careList.reduce((acc:any, cur:any) => acc + (Number(cur.count) || 0), 0) || 1;
  const top10Care = careList.slice(0, 10);
  const isMyCareInTop10 = displayUser.myCareCenter ? top10Care.some(c => c.name === displayUser.myCareCenter) : false;
  const myCareIndex = careList.findIndex(c => c.name === displayUser.myCareCenter);
  const myCareRank = myCareIndex + 1;
  const myCareCount = myCareIndex >= 0 ? careList[myCareIndex].count : 1;
  const myCarePct = Math.round((myCareCount / totalCareUsers) * 100);

  const helperBaseRegion = displayUser.address ? displayUser.address.split(' ').slice(0,2).join(' ') : '서울 강남구';
  const helperRegionDisplay = searchedHelperRegion || helperBaseRegion;
  const currentHelperList = useMemo(() => {
    const parts = helperRegionDisplay.split(' ');
    const targetSido = parts[0] || '';
    const targetSigugun = parts[1] || '';
    let filtered = (helpers || []).filter((h: any) => {
       const hSido = h['시도'] || '';
       const hSigugun = h['시군구'] || '';
       if (targetSido === '전체' || targetSido === '') return true;
       if (hSido !== targetSido) return false;
       if (targetSigugun && !hSigugun.includes(targetSigugun)) return false;
       return true;
    });
    const gradeScore: any = { 'A': 3, 'B': 2, 'C': 1, '미공개': 0 };
    filtered.sort((a: any, b: any) => {
       const gradeA = a['품질평가'] || '미공개';
       const gradeB = b['품질평가'] || '미공개';
       const sA = gradeScore[gradeA] !== undefined ? gradeScore[gradeA] : 0;
       const sB = gradeScore[gradeB] !== undefined ? gradeScore[gradeB] : 0;
       if (sA !== sB) return sB - sA;
       const usersA = Number(a['이용자 수']) || 0;
       const usersB = Number(b['이용자 수']) || 0;
       return usersB - usersA;
    });
    return filtered.slice(0, 10);
  }, [helperRegionDisplay, helpers]);

  const MOMS_TABS = [
    { id: 'dashboard', icon: '✨', label: '대시보드', week: '종합' }, 
    { id: 'babyname', icon: '👼', label: '태명짓기', week: '~5주' },
    { id: 'happinesscard', icon: '💳', label: '국민행복카드', week: '5~7주' },
    { id: 'hospital', icon: '🏥', label: '산부인과', week: '5~8주' },
    { id: 'insurance', icon: '🛡️', label: '태아보험', week: '8~12주' },
    { id: 'care', icon: '🏨', label: '산후조리원', week: '12~16주' },
    { id: 'maternity', icon: '👗', label: '튼살·임부복', week: '16~20주' }, 
    { id: 'babymoon', icon: '✈️', label: '태교여행', week: '20~27주' },     
    { id: 'helper', icon: '👩‍🍼', label: '산후도우미', week: '28~32주' },
    { id: 'baby', icon: '🍼', label: '출산·육아템', week: '32~38주' },
    { id: 'realname', icon: '🏷️', label: '아기이름짓기', week: '34주~산후' },
  ];

  return (
    <>
    <div className="animate-fade-in w-full pb-8 px-4 sm:px-0">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); } 
          100% { transform: translateX(-100%); } 
        }
        .animate-marquee { 
          display: inline-block; 
          white-space: nowrap; 
          padding-left: 100%;
          animation: marquee 20s linear infinite; 
        }
      `}</style>
      
      <div className="space-y-6">
        {/* 상단 프로필 & 인사말 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden mt-2">
          <div className="relative z-10">
             <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">My Status</p>
             {hasData ? (
               <>
                 <p className="font-bold text-lg flex items-center gap-2">
                   {displayUser.myHospitalName === '예비맘' ? '환영합니다! 예비맘님 ✨' : (currentWeek > 40 ? '환영합니다! 선배맘님 ✨' : `현재 ${currentWeek}주차 이시군요!`)}
                   {displayUser.babyGender && <span className="text-xl">{displayUser.babyGender.split(' ')[0]}</span>}
                 </p>
                 <div className="flex items-center gap-2 mt-1">
                   <p className="text-xs text-gray-300 flex items-center gap-1"><MapPin size={12}/> {hospRegionDisplay} • {displayUser.myHospitalName}</p>
                   <button onClick={() => setHospFormType('LOOKING')} className="p-1 bg-white/10 rounded-full hover:bg-white/20"><Edit3 size={12}/></button>
                 </div>
               </>
             ) : (
               <>
                 <p className="font-bold text-lg flex items-center gap-2 text-white">환영합니다! 산모님 ✨</p>
                 <p className="text-xs text-gray-300 mt-1">출산 예정일과 병원을 입력하고 우리 동네 랭킹을 열어보세요!</p>
               </>
             )}
          </div>
          <Baby size={44} className="text-gray-600 opacity-40 absolute right-4 top-4 z-0"/>
          
          <div className="mt-4 bg-gray-900/50 rounded-xl overflow-hidden py-2 px-3 flex items-center relative z-10 border border-gray-700">
             <span className="text-rose-400 mr-2 shrink-0 bg-gray-900 z-20 relative"><Info size={14}/></span>
             <div className="w-full overflow-hidden block">
               <div className="animate-marquee text-xs text-gray-200 font-medium tracking-wide">
                 {hasData ? getWeekMessage(currentWeek) : "예정일을 입력하시면 주차별 맞춤 가이드를 띄워드릴게요!"}
               </div>
             </div>
          </div>
        </div>

        {/* 1차 목표 진행 상황 바 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm mt-4">
          {!isRealData ? (
            <>
              <div className="flex justify-between items-end mb-2">
                <span className="text-[11px] sm:text-xs font-bold text-gray-800 flex items-center gap-1.5"><Trophy size={14} className="text-yellow-500"/> 동네 랭킹 데이터 오픈까지!</span>
                <span className="text-[10px] sm:text-[11px] text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded">{currentUsers} / {targetUsers}명</span>
              </div>
              <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-rose-300 to-rose-500 transition-all duration-1000" style={{ width: `${Math.min(Math.round((currentUsers / targetUsers) * 100), 100)}%` }}></div>
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-2.5 leading-relaxed break-keep">
                더 정교한 데이터 분석을 위해 1차 목표가 <b className="text-rose-500">1,000명</b>으로 상향되었어요!<br/>1,000명이 모이면 <b>우리 동네 산부인과/태아보험/조리원 데이터</b>가 정식 공개됩니다 💌
              </p>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} className="text-emerald-600"/>
              </div>
              <div>
                <h4 className="text-[11px] sm:text-xs font-bold text-emerald-700 mb-0.5">🎉 1차 목표 (전국 1,000명) 달성 완료!</h4>
                <p className="text-[10px] sm:text-[11px] text-gray-600 leading-relaxed break-keep">
                  데이터가 열렸어요! 이제 <b>산부인과/조리원탭</b>에서 봄이옴 산모들의 선택과 네이버 블로그 검색순위를 조합한 하이브리드 랭킹을 확인해보세요.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 탭 메뉴 */}
        <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible no-scrollbar py-2 mb-6 px-1 border-b border-gray-100 pb-4 mt-2">
           {MOMS_TABS.map(tab => (
             <button 
               key={tab.id} 
               id={`mom-tab-${tab.id}`} 
               onClick={() => setActiveMomTab(tab.id)} 
               className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border flex items-center shrink-0 transition-all ${activeMomTab === tab.id ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
             >
               {tab.icon} {tab.label} <span className="text-gray-400 font-normal ml-1">({tab.week})</span>
             </button>
           ))}
        </div>

        <div key={activeMomTab} className="space-y-6 animate-fade-in">
          
          {/* ✨ 1. 대시보드 탭 */}
          {activeMomTab === 'dashboard' && (
            <section className="space-y-5 animate-fade-in">
              {!hasData && (
                <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-sm text-center relative overflow-hidden">
                  <span className="text-5xl mb-3 block animate-bounce-short">🎁</span>
                  <h3 className="font-extrabold text-lg text-gray-900 mb-2">우리 아기, 언제 세상에 나오나요?</h3>
                  <p className="text-xs text-gray-500 mb-5 leading-relaxed break-keep">출산 예정일을 알려주시면 매주 쑥쑥 자라는<br/>아기 크기와 맞춤 가이드를 열어드릴게요!</p>
                  <button onClick={() => setHospFormType('LOOKING')} className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold shadow-md hover:bg-rose-600 active:scale-95 transition-transform text-sm">
                    내 출산 예정일 입력하기 🚀
                  </button>
                </div>
              )}

              {/* 1. 환영 인사 및 아기 과일 크기 (D-Day) */}
              <div className={`bg-rose-50 p-6 rounded-3xl border border-rose-100 shadow-sm text-center relative overflow-hidden ${!hasData ? 'hidden' : ''}`}>
                <div className="absolute top-3 right-3 bg-white text-rose-500 text-[10px] font-black px-3 py-1 rounded-full shadow-sm border border-rose-100">
                  {displayUser.myHospitalName === '예비맘' ? 'D-Day 준비중' : (exactDDay < 0 ? '탄생을 축하해요!' : (exactDDay === 0 ? 'D-Day (오늘 출산예정일!)' : `출산까지 D-${exactDDay}`))}
                </div>
                
                {displayUser.myHospitalName === '예비맘' ? (
                  <>
                    <div className="text-5xl mb-2 mt-2 transform hover:scale-110 transition-transform cursor-pointer">🌱</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">건강한 임신을 응원해요!</h3>
                    <p className="text-xs text-gray-600 bg-white/60 inline-block px-4 py-1.5 rounded-lg mt-1 font-medium">소중한 새생명이 움트기를 따뜻한 마음으로 기다리고 있어요.</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-2 transform hover:scale-110 transition-transform cursor-pointer mt-2">
                      {getBabySize(currentWeek).emoji}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      이번 주 아기는 <span className="text-rose-600">[{getBabySize(currentWeek).name}]</span> 만해요!
                    </h3>
                    <p className="text-xs text-gray-600 bg-white/60 inline-block px-4 py-1.5 rounded-lg mt-1 font-medium">
                      {getBabySize(currentWeek).desc}
                    </p>
                  </>
                )}
              </div>

              {!isPreMom && (() => {
                const dashTotal = 10;
                const dashReg = displayUser.registryItems ? displayUser.registryItems.split(',').filter(Boolean) : [];
                const dashCompleted = [
                  !!displayUser.babyName && displayUser.babyName !== '아직 고민중이에요',
                  !!displayUser.myHospitalName && displayUser.myHospitalName !== '예비맘' && displayUser.myHospitalName !== '알아보는 중',
                  !!displayUser.insCompany,
                  !!displayUser.myCareCenter,
                  !!displayUser.myStretchMark && !!displayUser.myMaternityWear,
                  !!displayUser.myBabymoon,
                  displayUser.completedMissions?.includes('산후도우미 예약'),
                  dashReg.length >= 5,
                  !!displayUser.realName && displayUser.realName.startsWith('[확정]'),
                  displayUser.completedMissions?.includes('히든미션')
                ].filter(Boolean).length;
                
                const dashPct = Math.round((dashCompleted / dashTotal) * 100);
                const expectedMissionsCount = [1, 5, 8, 12, 16, 20, 28, 30, 32, 34].filter(startWeek => startWeek <= currentWeek).length;
                
                let titleBadge = "";
                let descMsg = "";
                
                if (dashCompleted === 10) {
                  titleBadge = "프로맘 👑";
                  descMsg = "모든 퀘스트 완료! 완벽하게 출산을 준비했어요.";
                } else if (dashCompleted === 0) {
                  titleBadge = "삐약이맘 🐣";
                  descMsg = "출산 준비, 어디까지 왔을까요? 첫 미션을 시작해봐요!";
                } else if (dashCompleted >= expectedMissionsCount) {
                  titleBadge = "꼼꼼맘 ✨";
                  descMsg = `동급 주차 산모들보다 ${dashCompleted === expectedMissionsCount ? '딱 맞게' : '빠르게'} 잘 준비하고 있어요!`;
                } else {
                  titleBadge = "열혈맘 🔥";
                  descMsg = `다른 엄마들보다 미션 수행이 ${expectedMissionsCount - dashCompleted}개 늦어요! 얼른 서둘러주세요 🏃‍♀️`;
                }

                return (
                  <div className="bg-white p-5 rounded-3xl border border-rose-100 shadow-sm flex items-center justify-between gap-4 animate-fade-in mt-4 relative overflow-hidden">
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-rose-50" />
                          <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-rose-500 transition-all duration-1000 ease-out" strokeDasharray="163.3" strokeDashoffset={163.3 - (163.3 * (dashCompleted / dashTotal))} strokeLinecap="round" />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-[9px] text-gray-400 font-bold -mb-1">달성률</span>
                          <span className="text-sm font-black text-rose-500">{dashPct}<span className="text-[9px]">%</span></span>
                        </div>
                      </div>
                      
                      <div>
                        <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-md border border-rose-100 mb-1 inline-block">현재 칭호</span>
                        <h4 className="font-extrabold text-gray-900 text-base mb-0.5 tracking-tight">{titleBadge}</h4>
                        <p className="text-[10px] text-gray-500 leading-snug break-keep">{descMsg}</p>
                      </div>
                    </div>
                    <button onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setActiveTab('JOURNEY'); 
                    }} className="shrink-0 bg-gray-900 text-white px-3.5 py-2.5 rounded-xl text-[11px] font-bold shadow-md hover:bg-black transition-transform active:scale-95 z-10">
                      현황 보기 🚀
                    </button>
                    <div className="absolute -right-4 -bottom-4 text-6xl opacity-10">🏃‍♀️</div>
                  </div>
                );
              })()}

              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-indigo-100 shadow-sm relative">
                <div className="flex justify-between items-center mb-4">
                  <p className="font-bold text-indigo-600 text-sm flex items-center gap-1.5">
                    <span className="text-lg">⚖️</span> 오늘의 맘스 밸런스 게임
                  </p>
                  <span className="bg-indigo-50 text-indigo-500 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                    참여 {displayUser.balanceCount || 0}일차 / 100
                  </span>
                </div>

                {(displayUser.balanceCount || 0) < 100 && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl py-2 px-3 mb-4 flex items-center gap-1.5 border border-amber-100/50 shadow-inner">
                    <span className="text-[13px] animate-bounce">🎁</span>
                    <span className="text-[10px] sm:text-[11px] text-amber-700 font-bold tracking-tight">
                      100일 완주하면 특별한 선물을 드릴지도! (봄이옴 열일중🤫)
                    </span>
                  </div>
                )}

                {(displayUser.balanceCount || 0) >= 100 && (
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-3 rounded-xl border border-yellow-200 text-center mb-4 animate-bounce-short">
                    <p className="text-sm font-black text-amber-600">👑 명예의 전당 등극! 100일 미션 클리어 👑</p>
                    <p className="text-[10px] text-amber-700 mt-1">100일 동안 봄이옴과 함께해주셔서 정말 감사합니다!</p>
                  </div>
                )}

                {displayUser.lastBalanceDate !== todayStr ? (
                  <div className="space-y-3 mt-4">
                    <p className="text-center font-bold text-gray-800 mb-4">{todayQuestion[0]}</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button onClick={async () => {
                        onUpdateUser({ ...displayUser, lastBalanceDate: todayStr, lastBalanceAnswer: 'A', balanceCount: (displayUser.balanceCount || 0) + 1 });
                        addToast('success', '미션 클리어! 오후 6시에 결과를 확인하세요 ✨');
                        try {
                          await addDoc(collection(db, 'balance_votes'), { userId: displayUser.id, date: todayStr, question: todayQuestion[0], selected: 'A', answerText: todayQuestion[1], createdAt: serverTimestamp() });
                        } catch(e) {}
                      }} className="flex-1 py-4 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 text-indigo-700 font-bold rounded-2xl transition-all shadow-sm">
                        {todayQuestion[1]}
                      </button>
                      <div className="flex items-center justify-center font-black text-gray-300 text-xs py-1">VS</div>
                      <button onClick={async () => {
                        onUpdateUser({ ...displayUser, lastBalanceDate: todayStr, lastBalanceAnswer: 'B', balanceCount: (displayUser.balanceCount || 0) + 1 });
                        addToast('success', '미션 클리어! 오후 6시에 결과를 확인하세요 ✨');
                        try {
                          await addDoc(collection(db, 'balance_votes'), { userId: displayUser.id, date: todayStr, question: todayQuestion[0], selected: 'B', answerText: todayQuestion[2], createdAt: serverTimestamp() });
                        } catch(e) {}
                      }} className="flex-1 py-4 bg-gray-50 hover:bg-rose-50 border border-gray-200 hover:border-rose-300 text-rose-600 font-bold rounded-2xl transition-all shadow-sm">
                        {todayQuestion[2]}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-700 mb-1">🎉 오늘 미션 클리어!</p>
                    {new Date().getHours() >= 18 ? (
                      <div className="mt-4 animate-fade-in">
                        {(() => {
                          const balA = realBalanceStats.A;
                          const balB = realBalanceStats.B;
                          const totalBal = balA + balB;
                          const pctA = totalBal === 0 ? 50 : Math.round((balA / totalBal) * 100);
                          const pctB = totalBal === 0 ? 50 : 100 - pctA;

                          return (
                            <>
                              {/* 오늘의 질문 표시 */}
                              <p className="text-[11px] font-bold text-gray-700 mb-3 text-center break-keep leading-snug">"{todayQuestion[0]}"</p>
                              <p className="text-[10px] text-gray-500 mb-2 text-center">전국 맘들의 선택 결과는?</p>

                              {/* A 선택지 - 막대 위 좌측 */}
                              <div className={`flex items-center gap-2 mb-1.5 ${displayUser.lastBalanceAnswer === 'A' ? 'text-indigo-600' : 'text-indigo-300'}`}>
                                <div className="w-3 h-3 rounded-full bg-indigo-500 shrink-0"></div>
                                <span className="text-[11px] font-bold break-keep leading-snug">{todayQuestion[1]}</span>
                                <span className="text-[11px] font-black shrink-0 ml-2">{pctA}%</span>
                                {displayUser.lastBalanceAnswer === 'A' && <span className="shrink-0 bg-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded shadow-sm">내 선택</span>}
                              </div>

                              {/* 막대 그래프 */}
                              <div className="h-5 w-full bg-rose-100 rounded-full overflow-hidden flex shadow-inner mb-1.5">
                                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${pctA}%` }}></div>
                                <div className="h-full bg-rose-400 transition-all duration-1000 flex-1"></div>
                              </div>

                              {/* B 선택지 - 막대 아래 우측 */}
                              <div className={`flex items-center gap-2 justify-end ${displayUser.lastBalanceAnswer === 'B' ? 'text-rose-600' : 'text-rose-300'}`}>
                                {displayUser.lastBalanceAnswer === 'B' && <span className="shrink-0 bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded shadow-sm">내 선택</span>}
                                <span className="text-[11px] font-black shrink-0">{pctB}%</span>
                                <span className="text-[11px] font-bold break-keep leading-snug text-right mr-2">{todayQuestion[2]}</span>
                                <div className="w-3 h-3 rounded-full bg-rose-400 shrink-0"></div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="mt-3 py-3 px-4 bg-white rounded-xl shadow-sm inline-block">
                        <span className="text-2xl animate-pulse block mb-1">🤫</span>
                        <span className="text-[11px] font-bold text-indigo-500">다른 사람들은 뭘 골랐을까요?</span><br/>
                        <span className="text-[10px] text-gray-500">결과는 <b>오늘 오후 6시</b>에 공개됩니다!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(() => {
                const totalGender = (stats.genders || []).reduce((acc: any, cur: any) => acc + cur.count, 0);
                if (totalGender === 0) return null; 

                const COLORS = ['#fda4af', '#93c5fd', '#fde047', '#c4b5fd', '#86efac', '#fdba74'];
                let currentAcc = 0;
                const genderData = (stats.genders || []).map((g: any, idx: number) => {
                  const pct = Math.round((g.count / totalGender) * 100);
                  const parts = g.name.split(' '); 
                  const emoji = parts.length > 1 ? parts[0] : '👶';
                  const label = parts.length > 1 ? parts.slice(1).join(' ') : g.name;
                  const start = currentAcc;
                  currentAcc += pct;
                  return { label, emoji, pct, count: g.count, color: COLORS[idx % COLORS.length], start, end: currentAcc };
                });

                if (genderData.length > 0) genderData[genderData.length - 1].end = 100;
                const conicStr = genderData.map(g => `${g.color} ${g.start}% ${g.end}%`).join(', ');

                return (
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-4 animate-fade-in">
                    <p className="text-[11px] font-bold text-rose-500 mb-4 bg-rose-50 inline-block px-2 py-1 rounded">📊 재미로 보는 맘스픽 성별 비율</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 px-2">
                      <div className="relative w-32 h-32 rounded-full flex items-center justify-center shadow-md shrink-0 transition-transform hover:scale-105 duration-300" style={{ background: `conic-gradient(${conicStr})` }}>
                        <div className="w-16 h-16 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                          <span className="text-2xl">👶</span>
                        </div>
                      </div>
                      <div className="flex-1 w-full space-y-2.5">
                        {genderData.map((g: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: g.color }}></span>
                              <span className="text-gray-700 font-medium">{g.emoji} {g.label}</span>
                            </div>
                            <span className="font-bold text-gray-900">{g.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <WeatherOutingSection region={displayUser.address || '서울 강남구'} />
              <VideoCurationSection currentWeek={currentWeek} />
            </section>
          )}
          
          {/* ✨ 2. 태명짓기 탭 */}
          {activeMomTab === 'babyname' && (
            <BabyNameSection user={displayUser} onUpdateUser={onUpdateUser} addToast={addToast} />
          )}

          {/* ✨ 2-1. 국민행복카드 탭 (월드컵 테스트 + 결과화면) */}
          {activeMomTab === 'happinesscard' && (() => {
            const CARD_DB: any = {
              '신한': { name: '신한카드', desc: '배달/스트리밍 등 2030 집콕 트렌드 혜택', benefit: '최대 55만원 상당 혜택' },
              '삼성': { name: '삼성카드 V2', desc: '온오프라인 쇼핑 및 주유/생활비 할인', benefit: '최대 31.7만원 상당 혜택' },
              '롯데': { name: '롯데카드', desc: '오프라인 쇼핑과 육아/교육 할인 끝판왕', benefit: '최대 37만원 상당 혜택' },
              '국민': { name: 'KB국민카드', desc: '무실적 혜택과 아이 상해보험 무료 가입', benefit: '최대 24만원 상당 혜택' },
              '농협': { name: 'NH농협카드', desc: '놀이공원 50% 및 카페/외식 특화', benefit: '최대 22만원 상당 혜택' },
              '기업': { name: 'IBK기업은행', desc: '주요 온라인/생활/외식 무난한 혜택', benefit: '최대 24만원 상당 혜택' },
            };

            const testResult = displayUser?.cardTestResult || null;

            return (
              <section className="space-y-5 animate-fade-in">
                {/* 🎯 테스트를 안 한 유저 (시작 화면) */}
                {!testResult && (
                  <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-sm text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-300 to-indigo-400"></div>
                    <span className="text-5xl mb-4 block animate-bounce-short">💳</span>
                    <h3 className="text-lg font-black text-gray-900 mb-2">국민행복카드, 어떤 게 좋을까요?</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-6 break-keep">나라에서 주는 100만원 바우처를<br/>가장 똑똑하게 받는 법을 알려드려요!</p>
                    <div className="bg-indigo-50/50 p-4 rounded-2xl text-left space-y-3 mb-8 border border-indigo-100">
                      <p className="text-[11px] text-indigo-700 font-bold leading-relaxed flex gap-2"><span className="shrink-0">🙅‍♀️</span> 은행 직접 방문은 사은품이 거의 없으니 비추천!</p>
                      <p className="text-[11px] text-indigo-700 font-bold leading-relaxed flex gap-2"><span className="shrink-0">🎁</span> 6개월간 결제 이력이 없는 곳을 골라야 혜택 100%!</p>
                      <p className="text-[11px] text-indigo-700 font-bold leading-relaxed flex gap-2"><span className="shrink-0">🛒</span> 바우처는 동일하니 내 생활 할인 혜택을 보세요!</p>
                    </div>
                    <button onClick={() => setShowWorldCup(true)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-transform active:scale-95 text-sm">
                      내게 딱 맞는 카드 찾기 🔍
                    </button>
                  </div>
                )}

                {/* 🏆 테스트 결과가 있는 유저 (결과 화면) */}
                {testResult && (
                  <div className="animate-fade-in pb-10">
                    <div className="text-center mb-6">
                      <span className="text-[10px] font-black bg-rose-50 text-rose-500 border border-rose-100 px-3 py-1 rounded-full mb-3 inline-block shadow-sm">분석 완료 ✅</span>
                      <h3 className="text-[17px] font-black text-gray-900 leading-tight">봄이맘님을 위한<br/>찰떡 카드 TOP 2 🏆</h3>
                      <p className="text-xs text-gray-400 mt-2 font-medium">소비 패턴을 분석한 결과, 이 카드들이 가장 유리해요!</p>
                    </div>
                    
                    <div className="space-y-4">
                      {/* 1순위 카드 */}
                      <div className="bg-gradient-to-br from-rose-50 to-white p-5 rounded-3xl border border-rose-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-rose-100 rounded-bl-full opacity-30"></div>
                        <span className="text-2xl font-black italic text-rose-200 absolute right-4 top-4">1st</span>
                        <h4 className="font-black text-lg text-rose-600 mb-1">{CARD_DB[testResult.top1]?.name}</h4>
                        <p className="text-[11px] font-bold text-gray-800 mb-3">{CARD_DB[testResult.top1]?.desc}</p>
                        <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-inner mb-4">
                          <p className="text-[10px] text-gray-500 mb-0.5 font-bold">🎉 예상 가입 혜택</p>
                          <p className="text-sm font-black text-rose-500">{CARD_DB[testResult.top1]?.benefit}</p>
                        </div>
                        <button onClick={() => addToast('info', '봄이옴이 최고 혜택을 위해 열심히 제휴를 준비 중이에요! 💦')} className="w-full py-3.5 bg-rose-500 text-white font-black rounded-xl shadow-md hover:bg-rose-600 active:scale-95 transition-transform text-sm">
                          최대 혜택 받고 발급하기 🚀
                        </button>
                      </div>

                      {/* 2순위 카드 */}
                      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm relative">
                        <span className="text-xl font-black italic text-gray-200 absolute right-4 top-4">2nd</span>
                        <h4 className="font-bold text-base text-gray-700 mb-1">{CARD_DB[testResult.top2]?.name}</h4>
                        <p className="text-[11px] font-bold text-gray-500 mb-3">{CARD_DB[testResult.top2]?.desc}</p>
                        <button onClick={() => addToast('info', '봄이옴이 최고 혜택을 위해 열심히 제휴를 준비 중이에요! 💦')} className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-colors text-xs hover:bg-gray-200">
                          이 카드로 살펴보기
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                      <div className="flex gap-2">
                        <button onClick={() => setShowCompareTable(true)} className="flex-[2] py-4 bg-gray-800 text-white rounded-xl font-bold text-[13px] shadow-md hover:bg-black transition-colors active:scale-95">전체 비교 분석표 보기 📋</button>
                        <button onClick={() => setShowWorldCup(true)} className="flex-1 py-4 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold text-[13px] hover:bg-gray-50 transition-colors active:scale-95">다시 하기 🔄</button>
                      </div>
                      
                      <button onClick={() => {
                        const kakao = (window as any).Kakao;
                        if (!kakao) { addToast('error', '카카오 도구를 불러오는 중입니다.'); return; }
                        if (!kakao.isInitialized()) { kakao.init('cef1d01b84acf6b64cabac2fc6c3df18'); }
                        kakao.Share.sendDefault({
                          objectType: 'text',
                          text: `💌 [봄이옴] 나에게 딱 맞는 국민행복카드 찾기\n\n"여보! 나한테 제일 잘 맞는 카드는 [${CARD_DB[testResult.top1]?.name}]이래! 우리 이걸로 신청할까? 💕"`,
                          link: { mobileWebUrl: 'https://bomiom.co.kr', webUrl: 'https://bomiom.co.kr' },
                        });
                      }} className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-black text-sm shadow-sm hover:brightness-95 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <MessageCircle size={18} fill="currentColor"/> 남편에게 내 결과 공유하기 💌
                      </button>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* ✨ 3. 산부인과 탭 */}
          {activeMomTab === 'hospital' && (
            <section className="space-y-4 relative">
              {!hasData && (
                // 🔥 absolute inset-0을 없애고 top-12로 올려서 탭 바로 밑에 뜨게 합니다!
                <div className="absolute top-12 left-0 right-0 z-30 flex flex-col items-center animate-fade-in">
                  <div className="bg-white/95 p-6 rounded-3xl border border-gray-200 shadow-xl text-center w-[90%] max-w-[300px] backdrop-blur-md">
                    <span className="text-4xl block mb-3 animate-bounce-short">🔒</span>
                    <h4 className="font-extrabold text-gray-900 text-[15px] mb-2 tracking-tight">우리 동네 맘들의 선택은?</h4>
                    <p className="text-xs text-gray-500 mb-5 leading-relaxed break-keep">다니시는 산부인과를 알려주시면,<br/>100% 리얼 동네 랭킹을 열어드릴게요!</p>
                    {/* 🔥 LOOKING에서 ATTENDING으로 변경하여 병원 입력창이 바로 뜨게 합니다! */}
                    <button onClick={() => setHospFormType('ATTENDING')} className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center shadow-md active:scale-95 transition-transform text-sm">
                      내 정보 입력하고 랭킹 보기 🚀
                    </button>
                  </div>
                </div>
              )}
              
              <div className={!hasData ? 'opacity-20 blur-[6px] pointer-events-none select-none' : ''}>
                <p className="text-xs text-gray-600 mb-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200 shadow-sm leading-relaxed">
                  💡 임신을 처음 확인하는 <b>5~8주차</b>에 가장 많이 알아보고 산부인과를 결정해요.
                </p>
                
                {/* ✅ 조리원 탭과 동일한 레이아웃 적용 (우측에 수정 버튼 추가) */}
                <div className="flex justify-between items-start ml-1 mb-2">
                  <div className="min-w-0 pr-2 overflow-hidden">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 tracking-tighter whitespace-nowrap">
                      <Trophy size={18} className="text-yellow-500 shrink-0"/>
                      <span className="truncate">{hospRegionDisplay}</span> <span className="shrink-0">맘's pick 산부인과 랭킹</span>
                    </h3>
                    <div className="mt-1.5 inline-flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 whitespace-nowrap overflow-x-auto no-scrollbar max-w-full">
                      {isRegionalHospRealOpen ? (
                        <>
                          <span className="text-[10px] animate-pulse">👑</span>
                          <span className="text-[9px] text-rose-600 font-bold tracking-tight">100% 리얼 데이터 (기준일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '')})</span>
                        </>
                      ) : isGlobalHybridOpen ? (
                        <>
                          <span className="text-[10px] animate-pulse">🔥</span>
                          <span className="text-[9px] text-orange-600 font-bold tracking-tight">하이브리드 랭킹 제공 중</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] animate-pulse">🌱</span>
                          <span className="text-[9px] text-rose-500 font-bold tracking-tight">데이터를 모으는 중이에요 💕</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <button onClick={() => {
                    if (displayUser.myHospitalName === '알아보는 중') {
                      setIsHospLooking(true);
                      setSearchTerm('');
                      setSelectedHospital(null);
                    } else if (displayUser.myHospitalName && displayUser.myHospitalName !== '예비맘') {
                      setIsHospLooking(false);
                      setSearchTerm(displayUser.myHospitalName);
                      setSelectedHospital({ name: displayUser.myHospitalName, address: displayUser.myHospitalAddress });
                    }
                    setHospFormType('ATTENDING'); 
                  }} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md flex items-center gap-1 mt-1.5 shrink-0">
                    <Edit3 size={10}/> 내 병원 수정
                  </button>
                </div>

                {isGlobalHybridOpen && !isRegionalHospRealOpen && (
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 mb-4 shadow-sm animate-fade-in">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[11px] sm:text-xs font-bold text-gray-700">📍 {hospRegionDisplay} 리얼 랭킹 오픈까지</span>
                      <span className="text-[10px] text-gray-500"><b className="text-rose-500 text-[11px]">{actualHospTotal}명</b> / 100명</span>
                    </div>
                    <div className="h-2.5 w-full bg-white border border-gray-100 rounded-full overflow-hidden">
                      {/* 🔥 0명일 때도 게이지가 살짝(2%)은 보이게 처리 */}
                      <div className="h-full bg-rose-400 transition-all duration-1000" style={{ width: `${Math.max((actualHospTotal/100)*100, 2)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed break-keep">
                      {actualHospTotal === 0 
                        ? `아직 ${hospRegionDisplay}의 첫 번째 주인공이 없어요! 병원을 등록하고 랭킹을 시작해 보세요 🐣`
                        : `현재 ${hospRegionDisplay} 산모님들이 모이고 있어요! 우리 지역 봄이옴 산모가 100명이 되면 100% 리얼 랭킹으로 전환됩니다 🚀`}
                    </p>
                  </div>
                )}
                {isRegionalHospRealOpen && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl mb-4 shadow-sm animate-fade-in">
                    <h4 className="font-bold text-rose-600 text-xs mb-1 flex items-center gap-1"><CheckCircle2 size={14}/> 100% 리얼 우리 동네 랭킹 오픈!</h4>
                    <p className="text-[10px] text-rose-500/80 break-keep">동네 산모님들의 실제 산부인과 선택 랭킹입니다.</p>
                  </div>
                )}

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                   {top10Hosp.map((h:any, idx:number) => {
                     const isMine = h.name === displayUser.myHospitalName;
                     const score = Number(h.count) || 0;
                     const barWidth = Math.max(1, Math.round((score / (top10Hosp[0]?.count || 1)) * 100));
                     
                     // 🔥 상위 1~3위와 내 병원에만 예쁜 뱃지 부여
                     const badge = isMine ? { text: "내 병원", style: "bg-rose-500 text-white border-rose-500" }
                                : idx === 0 ? { text: "👑 1위", style: "bg-yellow-50 text-yellow-600 border-yellow-200" }
                                : idx === 1 ? { text: "✨ 대세", style: "bg-blue-50 text-blue-600 border-blue-200" }
                                : idx === 2 ? { text: "👍 추천", style: "bg-gray-50 text-gray-500 border-gray-200" }
                                : null;

                     return (
                       <div key={idx} className={isMine ? "" : "opacity-80"}>
                         <div className="flex justify-between items-center text-xs mb-1.5 font-bold text-gray-800">
                           <div className="flex items-center gap-1.5">
                             <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${idx < 3 ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'}`}>{idx+1}</span>
                             <span className="truncate">{h.name}</span>
                             
                             {/* 🔥 뱃지가 있을 때만(1~3위) 출력 */}
                             {badge && (
                               <span className={`shrink-0 text-[8px] px-1.5 py-0.5 rounded border shadow-sm ${badge.style}`}>
                                 {badge.text}
                               </span>
                             )}
                           </div>
                           <span className="text-rose-500 font-black">{score}점</span>
                         </div>
                         <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 transition-all" style={{width: `${barWidth}%`}}></div></div>
                       </div>
                     );
                   })}
                   {!isMyHospInTop10 && displayUser.myHospitalName && displayUser.myHospitalName !== '예비맘' && (
                     <div className="pt-3 border-t border-dashed border-gray-200 mt-2">
                        <div className="flex justify-between items-center text-xs mb-1.5 font-bold text-gray-800">
                           <div className="flex items-center gap-2">
                             <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-gray-100 text-gray-500">{myHospRank}</span>
                             <span>{displayUser.myHospitalName}</span>
                             <span className="bg-gray-500 text-white text-[9px] px-1.5 py-0.5 rounded-md shadow-sm">내 병원</span>
                           </div>
                           <span className="text-gray-500 font-black">{myHospCount}점</span>
                         </div>
                     </div>
                   )}
                </div>
                <h4 className="font-bold text-sm text-gray-700 mt-6 mb-2 ml-1">관련 게시판</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <BoardCard icon="🤔" title="산부인과 결정 조언방" desc="어디가 좋을지 선배들에게 물어보세요" onClick={() => onOpenBoard('산부인과 결정 조언방')} />
                  <BoardCard icon="🤝" title={`${displayUser.myHospitalName === '예비맘' ? '우리동네' : displayUser.myHospitalName} 동기방`} desc="같은 병원에 다니는 산모들 모여라!" onClick={() => onOpenBoard(`${displayUser.myHospitalName === '예비맘' ? '우리동네' : displayUser.myHospitalName} 동기방`)} />
                </div>
              </div>
            </section>
          )}

          {/* ✨ 4. 태아보험 탭 */}
          {activeMomTab === 'insurance' && (() => {
            const INS_PERSONAS: any = {
              TYPE1: { title: "초가성비 실속형", price: "월 3~5만 원대", desc: "불필요한 특약은 싹 다이어트! 신생아 시기 핵심 방어에만 집중한 가장 똑똑한 플랜입니다.", tags: ["30세만기", "무해지", "가성비"] },
              TYPE2: { title: "국민 표준 안심형", price: "월 6~8만 원대", desc: "대한민국 산모 10명 중 6명이 선택! 자잘하게 병원 갈 일이 많은 영유아기를 완벽하게 커버합니다.", tags: ["30세만기", "풀담보", "인기"] },
              TYPE3: { title: "평생 든든 철벽형", price: "월 9~12만 원대", desc: "화폐가치 하락보다 안전이 우선! 성인이 되어서도 아플 걱정 없이 평생 지켜주는 철벽 방어 플랜입니다.", tags: ["100세만기", "최대보장", "철벽방어"] },
              TYPE4: { title: "고위험군 집중 방어형", price: "월 6~9만 원대", desc: "다태아/시험관 산모님을 위한 맞춤형! 니큐 입원일당과 선천이상 보장을 최대치로 설정했습니다.", tags: ["니큐집중", "쌍둥이맞춤", "선천이상"] },
              TYPE5: { title: "전문가 픽! 하이브리드형", price: "월 7~9만 원대", desc: "가성비와 든든함을 모두 잡은 고난도 설계! 큰 병은 100세, 자잘한 병은 30세로 효율을 극대화했습니다.", tags: ["복층설계", "효율끝판왕", "전문가추천"] },
            };

            const isUnlocked = !!displayUser.insCompany || !!displayUser.insTestResult;
            const myResult = displayUser.insTestResult ? INS_PERSONAS[displayUser.insTestResult.typeId] : null;

            return (
              <section className="space-y-4 relative">
                {/* 🎯 1. 탭 첫 진입 시 (자물쇠 + 분기점) */}
                {!isUnlocked && (
                  <div className="absolute top-12 left-0 right-0 z-30 flex flex-col items-center animate-fade-in">
                    <div className="bg-white/95 p-6 rounded-3xl border border-gray-200 shadow-xl text-center w-[90%] max-w-[320px] backdrop-blur-md">
                      <span className="text-4xl block mb-3 animate-bounce-short">🛡️</span>
                      <h4 className="font-extrabold text-gray-900 text-[15px] mb-2 tracking-tight">우리 아이 첫 보험, 준비하셨나요?</h4>
                      <p className="text-xs text-gray-500 mb-5 leading-relaxed break-keep">산모님의 상황에 맞게 봄이옴이<br/>가장 완벽한 가이드를 드릴게요!</p>
                      
                      <div className="space-y-2">
                        <button onClick={() => setShowInsTest(true)} className="w-full py-3.5 bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center shadow-md active:scale-95 transition-all text-sm">
                          아직 안 했어요! (AI 맞춤 설계) 🔍
                        </button>
                        <button onClick={() => setInsStatus('FORM')} className="w-full py-3.5 bg-blue-50 text-blue-600 rounded-xl font-bold border border-blue-100 flex items-center justify-center active:scale-95 transition-all text-sm">
                          네, 이미 가입했어요! (정보 공유) ✍️
                        </button>
                        <button onClick={() => { 
                          onUpdateUser({ ...displayUser, insCompany: '가입안함' }); 
                          addToast('info','보험 없이도 건강한 출산을 응원합니다!'); 
                        }} className="mt-2 text-[10px] text-gray-400 underline pt-2">가입 안 하려고요</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className={!isUnlocked ? 'opacity-20 blur-[6px] pointer-events-none select-none' : 'animate-fade-in'}>
                  <p className="text-xs text-blue-700 mb-4 bg-blue-50 p-3.5 rounded-xl border border-blue-200 shadow-sm leading-relaxed">
                    💡 태아보험은 필수 특약 가입 시기가 정해져 있으니, <b>8~12주차</b>부터 꼼꼼히 비교해 보고 준비하시는 것을 권장해요.
                  </p>

                  {/* 🎯 2. AI 테스트를 완료한 유저의 대시보드 상단 리포트 요약 */}
                  {myResult && (
                    <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black bg-blue-50 text-blue-500 border border-blue-100 px-3 py-1 rounded-full inline-block shadow-sm">AI 정밀 진단 완료 ✅</span>
                        <button onClick={() => setShowInsTest(true)} className="text-[10px] text-gray-400 underline hover:text-gray-600">테스트 다시하기 🔄</button>
                      </div>
                      <h3 className="text-[17px] font-black text-gray-900 leading-tight mb-2">봄이맘님을 위한 맞춤 플랜은<br/><span className="text-blue-600">[{myResult.title}]</span> 입니다.</h3>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">{myResult.desc}</p>
                      
                      <div className="flex gap-2">
                        <button onClick={() => setShowInsDetail(true)} className="flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200 transition-colors">내 답변 및 상세 리포트 📝</button>
                        <button onClick={() => addToast('info', '봄이옴의 엄선된 전문가를 곧 연결해 드릴게요! ⏳')} className="flex-1 py-3.5 bg-gray-900 text-white font-bold rounded-xl text-xs shadow-md hover:bg-black transition-transform active:scale-95">무료 견적 받기 🚀</button>
                      </div>
                    </div>
                  )}

                  {/* 🎯 3. 이미 가입한 유저의 정보 렌더링 (테스트 유도 버튼 추가!) */}
                  {displayUser.insCompany && (
                    <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm mb-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 mb-1">산모님의 가입 정보</p>
                          <p className="text-sm font-black text-blue-600">{displayUser.insCompany} <span className="text-gray-800">({displayUser.insPrice})</span></p>
                        </div>
                        <button onClick={() => setInsStatus('FORM')} className="text-[10px] bg-gray-100 text-gray-500 px-3 py-2 rounded-lg font-bold shrink-0">정보 수정</button>
                      </div>
                      
                      {/* 🔥 AI 테스트를 아직 안 한 경우, 가입 정보 아래에 예쁜 버튼 노출! */}
                      {!displayUser.insTestResult && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <button 
                            onClick={() => setShowInsTest(true)} 
                            className="w-full py-3.5 bg-blue-50 text-blue-600 font-bold rounded-xl text-xs border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm active:scale-95"
                          >
                            나에게 딱 맞는 플랜은? AI 설계 테스트 해보기 🔍
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 📊 3. 맘스픽 랭킹 대시보드 (보험사 & 가격 랭킹) */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2"><Trophy size={18} className="text-yellow-500"/> 맘's pick 태아보험 랭킹</h3>
                      <span className="text-[10px] text-gray-400">실시간 집계 중 🔥</span>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                      <p className="text-[11px] font-bold text-blue-500 mb-5 bg-blue-50 inline-block px-2 py-1 rounded">가장 많이 가입한 보험사 TOP 5</p>
                      <div className="space-y-3.5">
                        {insTop5.map((i, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1.5">
                              <span className="truncate pr-1"><span className={idx===0?'text-blue-500':''}>{idx+1}.</span> {i.name}</span>
                              <span className="text-blue-500 shrink-0">{i.pct}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden w-full">
                              <div className="h-full bg-blue-400 rounded-full transition-all duration-1000" style={{width: `${i.pct}%`}}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                      <p className="text-[11px] font-bold text-indigo-500 mb-4 bg-indigo-50 inline-block px-2 py-1 rounded">가장 많이 선택한 월 납입액</p>
                      <div className="flex justify-around items-end h-32 mt-2 px-1">
                        {priceChartData.map((p, idx) => (
                          <div key={idx} className="flex flex-col items-center w-full group cursor-pointer">
                            <span className="text-[10px] font-bold text-indigo-600 mb-1 opacity-80 group-hover:opacity-100">{p.pct}%</span>
                            <div className="w-8 sm:w-10 h-20 bg-gray-50 rounded-t-lg relative flex items-end justify-center overflow-hidden">
                              <div className="w-full bg-indigo-400 rounded-t-lg transition-all duration-1000" style={{height: `${p.pct}%`}}></div>
                            </div>
                            <span className="text-[9px] text-gray-500 mt-2 font-medium break-keep text-center">{p.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* 📊 태아보험 맘스픽 트렌드 (모바일 레이아웃 최적화 완료) */}
                  <div className="space-y-6 mt-10 animate-fade-in pb-10 w-full overflow-hidden">
                    <div className="flex justify-between items-end px-1">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <PieChart size={18} className="text-blue-500 shrink-0"/> <span className="truncate">맘스픽 보험 설계 트렌드</span>
                      </h3>
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">실시간 집계 중 🔥</span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 w-full">
                      {/* 1. 보험 만기 설정 (Q2) */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                        <p className="text-[11px] font-bold text-blue-500 mb-4 bg-blue-50 inline-block px-2 py-1 rounded">가장 선호하는 보험 만기</p>
                        <div className="space-y-3">
                          {[ 
                            {lab:'30세 만기 (실속파)', pct:62, color:'bg-blue-400'}, 
                            {lab:'100세 만기 (든든파)', pct:28, color:'bg-gray-200'}, 
                            {lab:'복층 설계 (전문가파)', pct:10, color:'bg-indigo-300'} 
                          ].map(i => (
                            <div key={i.lab}>
                              <div className="flex justify-between text-xs font-bold mb-1.5 text-gray-700">
                                <span className="truncate pr-2">{i.lab}</span>
                                <span className="shrink-0">{i.pct}%</span>
                              </div>
                              <div className="h-2 bg-gray-50 rounded-full overflow-hidden w-full">
                                <div className={`h-full ${i.color} transition-all duration-1000`} style={{width:`${i.pct}%`}}></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. 산모 특약 가입 여부 (Q5) */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                        <p className="text-[11px] font-bold text-emerald-500 mb-4 bg-emerald-50 inline-block px-2 py-1 rounded">산모 특약 가입 비중</p>
                        <div className="flex gap-2 sm:gap-3 w-full">
                          <div className="flex-1 min-w-0 bg-emerald-500 text-white p-3 sm:p-4 rounded-xl text-center shadow-md">
                            <p className="text-[10px] font-bold opacity-80 mb-1 truncate">추가함</p>
                            <p className="text-base sm:text-lg font-black">74%</p>
                          </div>
                          <div className="flex-1 min-w-0 bg-gray-50 text-gray-400 p-3 sm:p-4 rounded-xl text-center border border-gray-100">
                            <p className="text-[10px] font-bold mb-1 truncate">추가 안 함</p>
                            <p className="text-base sm:text-lg font-black">26%</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-3 text-center break-keep leading-relaxed">※ 노산이나 첫째 산모님들의 가입 비중이 높아요!</p>
                      </div>

                      {/* 3. 가장 걱정되는 질환 (Q4) - flex-wrap 적용으로 화면 삐져나감 완벽 차단 */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                        <p className="text-[11px] font-bold text-rose-500 mb-4 bg-rose-50 inline-block px-2 py-1 rounded">집중 보장 희망 질환</p>
                        <div className="flex flex-wrap gap-2 w-full">
                          {[
                            {lab: '환경성 질환(아토피 등)', pct: 45},
                            {lab: '상해/사고(골절 등)', pct: 30},
                            {lab: '정신질환(ADHD 등)', pct: 25}
                          ].map(item => (
                            <div key={item.lab} className="flex-1 min-w-[100px] bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                              <p className="text-[10px] text-gray-500 font-bold mb-1 leading-snug break-keep">{item.lab}</p>
                              <p className="text-sm font-black text-gray-800">{item.pct}%</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 4. 임신 형태 분포 (Q1) - min-w-0으로 글자 밀림 차단 */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                        <p className="text-[11px] font-bold text-indigo-500 mb-4 bg-indigo-50 inline-block px-2 py-1 rounded">임신 형태 분포</p>
                        <div className="flex items-center gap-4 w-full">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[5px] sm:border-[6px] border-indigo-500 flex items-center justify-center shadow-inner shrink-0">
                            <span className="text-[11px] font-black text-indigo-600">82%</span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs font-bold text-gray-700 truncate">단태아 / 자연임신 (82%)</p>
                            <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate">다태아 / 시험관 임신 (18%)</p>
                          </div>
                        </div>
                      </div>

                      {/* 5. 환급 방식 및 예산 (Q6) */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                        <p className="text-[11px] font-bold text-orange-500 mb-4 bg-orange-50 inline-block px-2 py-1 rounded">환급형 vs 저해지형 선호도</p>
                        <div className="space-y-4 w-full">
                           <div className="flex items-center justify-between gap-2">
                             <span className="text-[11px] sm:text-xs font-bold text-gray-600 truncate">무해지/저해지 (보험료 절감)</span>
                             <span className="text-xs font-black text-orange-500 shrink-0">68%</span>
                           </div>
                           <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                             <div className="h-full bg-orange-400 transition-all duration-1000" style={{width: '68%'}}></div>
                             <div className="h-full bg-gray-200 transition-all duration-1000" style={{width: '32%'}}></div>
                           </div>
                           <div className="flex items-center justify-between gap-2">
                             <span className="text-[11px] sm:text-xs font-bold text-gray-600 truncate">표준형 (환급금 발생)</span>
                             <span className="text-xs font-black text-gray-400 shrink-0">32%</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 하단 마케팅 배너 - 모바일 글자 겹침 방지 */}
                    <div className="bg-blue-600 p-5 sm:p-6 rounded-[32px] text-white text-center shadow-lg mt-8 relative overflow-hidden w-full">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-bl-full pointer-events-none"></div>
                      <h4 className="font-bold text-sm mb-2 break-keep leading-snug">분석 리포트를 설계사에게 전달하세요!</h4>
                      <p className="text-[10px] sm:text-[11px] opacity-80 mb-5 leading-relaxed break-keep">
                        7가지 답변 데이터를 기반으로 상담받으면<br/>불필요한 특약 없는 최저가 설계가 가능합니다.
                      </p>
                      
                      {/* 🔥 클릭 시 분기 처리 (결과 있으면 팝업 띄우고, 없으면 알림 띄우고 테스트 시작!) */}
                      <button 
                        onClick={() => {
                          if (displayUser.insTestResult) {
                            setShowInsDetail(true);
                          } else {
                            addToast('info', 'AI 설계 테스트를 먼저 진행해야 분석 리포트를 볼 수 있어요! 🔍');
                            setShowInsTest(true); // 알림 띄우고 친절하게 테스트 창 바로 열어주기
                          }
                        }} 
                        className="w-full py-4 bg-white text-blue-600 font-black rounded-xl text-xs sm:text-sm shadow-md active:scale-95 transition-transform"
                      >
                        내 분석 리포트 확인하기 📝
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* ✨ 5. 산후조리원 탭 */}
          {activeMomTab === 'care' && (
            <section className="space-y-4 relative">
              {careStatus === 'NONE' && (
                // 🔥 자물쇠가 화면 정중앙으로 올라옵니다.
                <div className="absolute top-12 left-0 right-0 z-30 flex flex-col items-center animate-fade-in">
                  <div className="bg-white/95 p-6 rounded-3xl border border-gray-200 shadow-xl text-center w-[90%] max-w-[300px] backdrop-blur-md">
                    <span className="text-4xl block mb-3 animate-bounce-short">🔒</span>
                    <h4 className="font-extrabold text-gray-900 text-[15px] mb-2 tracking-tight">우리 동네 1위 조리원은?</h4>
                    <p className="text-xs text-gray-500 mb-5 leading-relaxed break-keep">예약하신 조리원을 살짝 알려주시면,<br/>100% 리얼 랭킹을 바로 열어드릴게요!</p>
                    <button onClick={() => setCareStatus('FORM')} className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center shadow-md active:scale-95 transition-all text-sm">
                      내 정보 공유하고 랭킹 보기 🚀
                    </button>
                    <button onClick={() => { 
                      onUpdateUser({ ...displayUser, myCareCenter: '안감' }); 
                      addToast('success','도우미나 가족 케어도 훌륭한 선택입니다!'); 
                      setCareStatus('DONE'); 
                    }} className="mt-3 text-[10px] text-gray-400 underline">안 가려고 해요</button>
                  </div>
                </div>
              )}

              <div className={careStatus === 'NONE' ? 'opacity-20 blur-[6px] pointer-events-none select-none' : ''}>
                <p className="text-xs text-emerald-700 mb-4 bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 shadow-sm leading-relaxed">
                  💡 인기 있는 조리원은 일찍 마감될 수 있으니, 보통 <b>12~16주차</b>부터는 예약을 준비하셔야 해요.
                </p>

                {/* 🏥 [신규 추가] 조리원 예약 배너 */}
                <div onClick={onGoCare} className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-transform group mb-6">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold inline-block">전국 조리원 랭킹 및 예약 🏩</span>
                    </div>
                    <h3 className="font-extrabold text-lg mb-1 tracking-tight">조리원을 찾고 계시다면?</h3>
                    <p className="text-xs text-emerald-50 font-medium break-keep leading-relaxed">우리 동네 인기 조리원을 한눈에 비교해보고<br/>방문 상담부터 실시간 예약까지 한 번에!</p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-bold text-white/90 gap-1">
                    조리원 알아보기 <ArrowRight size={14}/>
                  </div>
                </div>
                
                <div className="space-y-6 animate-fade-in">
                  <div className="flex justify-between items-start ml-1">
                    <div className="min-w-0 pr-2 overflow-hidden">
                      <h3 className="font-bold text-[15px] sm:text-lg text-gray-800 flex items-center gap-1 mt-1 tracking-tighter whitespace-nowrap">
                         <Building2 size={16} className="text-emerald-500 mb-0.5 shrink-0"/> 
                         <span className="text-emerald-600 truncate">{careRegionDisplay}</span> <span className="shrink-0">맘's pick 조리원 랭킹</span>
                      </h3>
                      <div className="mt-1.5 inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 whitespace-nowrap overflow-x-auto no-scrollbar max-w-full">
                        {isRegionalCareRealOpen ? (
                          <>
                            <span className="text-[10px] animate-pulse">👑</span>
                            <span className="text-[9px] text-emerald-700 font-bold tracking-tight">100% 리얼 데이터 (기준일: {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '')})</span>
                          </>
                        ) : isGlobalHybridOpen ? (
                          <>
                            <span className="text-[10px] animate-pulse">🔥</span>
                            <span className="text-[9px] text-emerald-600 font-bold tracking-tight">하이브리드 랭킹 제공 중</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] animate-pulse">🌱</span>
                            <span className="text-[9px] text-emerald-600 font-bold tracking-tight">실제 랭킹을 집계 중이에요! 조금만 기다려주세요 💕</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setCareStatus('FORM')} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-md flex items-center gap-1 mt-1.5 shrink-0"><Edit3 size={10}/> 내 조리원 수정</button>
                  </div>

                  {isGlobalHybridOpen && !isRegionalCareRealOpen && (
                    <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 mb-4 shadow-sm animate-fade-in">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-[11px] sm:text-xs font-bold text-gray-700">📍 {careRegionDisplay} 리얼 랭킹 오픈까지</span>
                        <span className="text-[10px] text-gray-500"><b className="text-emerald-500 text-[11px]">{actualCareTotal}명</b> / 100명</span>
                      </div>
                      <div className="h-2.5 w-full bg-white border border-gray-100 rounded-full overflow-hidden">
                        {/* 🔥 0명일 때도 게이지가 살짝(2%)은 보이게 처리 */}
                        <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${Math.max((actualCareTotal/100)*100, 2)}%` }}></div>
                      </div> 
                      <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed break-keep">
                        {actualCareTotal === 0 
                          ? "아직 이 동네에서 등록된 조리원 정보가 없어요. 첫 번째 정보를 공유해 주세요! 🌿"
                          : "조리원 동기들이 모이고 있어요! 우리 지역 봄이옴 산모가 100명이 되면 우리 동네 리얼 순위로 전환됩니다 🚀"}
                      </p>
                    </div>
                  )}
                  {isRegionalCareRealOpen && (
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl mb-4 shadow-sm animate-fade-in">
                      <h4 className="font-bold text-emerald-600 text-xs mb-1 flex items-center gap-1"><CheckCircle2 size={14}/> 100% 리얼 우리 동네 랭킹 오픈!</h4>
                      <p className="text-[10px] text-emerald-500/80 break-keep">동네 산모님들의 실제 산후조리원 선택 랭킹입니다.</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-inner">
                     <p className="text-[10px] font-bold text-gray-400 ml-1">다른 지역 랭킹 검색</p>
                     <div className="flex gap-2">
                       <select value={careViewSido} onChange={e => {setCareViewSido(e.target.value); setCareViewSigugun('');}} className="flex-1 text-xs p-2.5 rounded-lg outline-none border border-gray-200">
                          <option value="">시/도 선택</option>{Object.keys(REGION_DATA).map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                       {careViewSido && (
                         <select value={careViewSigugun} onChange={e => setCareViewSigugun(e.target.value)} className="flex-1 text-xs p-2.5 rounded-lg outline-none border border-gray-200">
                            <option value="">시/군/구</option>{Object.keys(REGION_DATA[careViewSido] || {}).map(s => <option key={s} value={s}>{s}</option>)}
                         </select>
                       )}
                       <button onClick={() => setSearchedCareRegion(careViewSigugun ? `${careViewSido} ${careViewSigugun}` : careViewSido)} disabled={!careViewSido} className="bg-emerald-500 text-white px-3 text-xs font-bold rounded-lg disabled:bg-gray-300">검색</button>
                     </div>
                     {searchedCareRegion && (
                       <button onClick={() => {setSearchedCareRegion(''); setCareViewSido(''); setCareViewSigugun('');}} className="text-[10px] text-gray-500 underline mt-1 text-left w-fit">내 거주지로 돌아가기</button>
                     )}
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 mt-4">
                     {top10Care.map((c:any, idx:number) => {
                       const isMine = c.name === displayUser.myCareCenter;
                       const score = Number(c.count) || 0;
                       const barWidth = Math.max(1, Math.round((score / (top10Care[0]?.count || 1)) * 100));
                       
                       // 🔥 조리원 1~3위 전용 뱃지 로직
                       const badge = isMine ? { text: "내 조리원", style: "bg-emerald-500 text-white border-emerald-500" }
                                  : idx === 0 ? { text: "👑 1위", style: "bg-yellow-50 text-yellow-600 border-yellow-200" }
                                  : idx === 1 ? { text: "✨ 대세", style: "bg-blue-50 text-blue-600 border-blue-200" }
                                  : idx === 2 ? { text: "👍 추천", style: "bg-gray-50 text-gray-500 border-gray-200" }
                                  : null;

                       return (
                         <div key={idx} className={isMine ? "" : "opacity-80"}>
                           <div className="flex justify-between items-center text-xs mb-1.5 font-bold text-gray-800">
                             <div className="flex items-center gap-1.5">
                               <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${idx < 3 ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>{idx+1}</span>
                               <span className="truncate">{c.name}</span>
                               
                               {/* 🔥 뱃지가 있을 때만(1~3위) 출력 */}
                               {badge && (
                                 <span className={`shrink-0 text-[8px] px-1.5 py-0.5 rounded border shadow-sm ${badge.style}`}>
                                   {badge.text}
                                 </span>
                               )}
                             </div>
                             <span className="text-emerald-500 font-black">{score}점</span>
                           </div>
                           <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{width: `${barWidth}%`}}></div></div>
                         </div>
                       );
                     })}
                     {!isMyCareInTop10 && displayUser.myCareCenter && (
                       <div className="pt-3 border-t border-dashed border-gray-200 mt-2">
                          <div className="flex justify-between items-center text-xs mb-1.5 font-bold text-gray-800">
                             <div className="flex items-center gap-2">
                               <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-gray-100 text-gray-500">{myCareRank}</span>
                               <span>{displayUser.myCareCenter}</span>
                               <span className="bg-gray-500 text-white text-[9px] px-1.5 py-0.5 rounded-md shadow-sm">내 조리원</span>
                             </div>
                             <span className="text-gray-500 font-black">{myCareCount}점</span>
                           </div>
                       </div>
                     )}
                  </div>
                  <h4 className="font-bold text-sm text-gray-700 mt-6 mb-2 ml-1">관련 게시판</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <BoardCard icon="🏃‍♀️" title="조리원 투어 생생 후기" desc="투어 다녀오신 분들 썰 풀어주세요" onClick={() => onOpenBoard('조리원 투어 후기')} />
                    <BoardCard icon="🛏️" title="조리원 동기 찾기" desc="같은 달 입소하시는 분 계신가요?" onClick={() => onOpenBoard('조리원 동기 찾기')} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ✨ 5-1. 튼살/임부복 탭 */}
          {activeMomTab === 'maternity' && (
            <MaternitySection user={displayUser} onUpdateUser={onUpdateUser} addToast={addToast} />
          )}

          {/* ✨ 5-2. 태교여행 탭 */}
          {activeMomTab === 'babymoon' && (
            <BabymoonSection user={displayUser} onUpdateUser={onUpdateUser} addToast={addToast} />
          )}

          {/* ✨ 6. 산후도우미 탭 (계산기와 AI 매칭 완벽 분리) */}
          {activeMomTab === 'helper' && (() => {
            // 파이어베이스에서 저장된 내 결과물 가져오기
            const voucherData = displayUser.helperTestResult?.voucher;
            const requestText = displayUser.helperTestResult?.requestText;

            return (
              <section className="space-y-4">
                <p className="text-xs text-orange-700 mb-4 bg-orange-50 p-3.5 rounded-xl border border-orange-200 shadow-sm leading-relaxed">
                  💡 정부지원 바우처 신청시기에 맞춰, 임신 후기인 <b>28~32주차</b>에 산후도우미를 가장 많이 알아봐요.
                </p>
                
                {/* 🧮 버튼 1: 바우처 계산기 배너 (결과 도출 후에도 유지) */}
                <div onClick={() => voucherData ? setShowVoucherResultModal(true) : setShowHelperVoucher(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-transform group mt-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold inline-block">1분 만에 확인하기 ⏱️</span>
                      {/* 🔥 완료 시 나타나는 뱃지 */}
                      {voucherData && <span className="bg-white text-emerald-600 text-[10px] font-black px-2 py-1 rounded-lg shadow-md animate-bounce-short">✅ 결과 보기</span>}
                    </div>
                    <h3 className="font-extrabold text-lg mb-1 tracking-tight">정부지원 바우처 유형 계산기</h3>
                    <p className="text-xs text-emerald-50 font-medium break-keep leading-relaxed">어렵고 복잡한 표는 그만! 딱 3번만 누르면<br/>내 예상 본인부담금을 바로 알려드려요.</p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-bold text-white/90 gap-1">
                    {/* 🔥 텍스트 동적 변경 */}
                    {voucherData ? '나의 계산 결과 확인하기' : '지금 바로 계산해 보기'} <ArrowRight size={14}/>
                  </div>
                </div>

                {/* 📝 버튼 2: 이모님 매칭 요청서 배너 (결과 도출 후에도 유지) */}
                <div onClick={() => requestText ? setShowAiResultModal(true) : setShowHelperAi(true)} className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-transform group mt-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold inline-block">찰떡 이모님 찾기 🔍</span>
                      {/* 🔥 완료 시 나타나는 뱃지 */}
                      {requestText && <span className="bg-white text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg shadow-md animate-bounce-short">✅ 결과 보기</span>}
                    </div>
                    <h3 className="font-extrabold text-lg mb-1 tracking-tight">산모 성향 맞춤 이모님 요청하기!</h3>
                    <p className="text-xs text-blue-50 font-medium break-keep leading-relaxed">나와 딱 맞는 성향의 이모님을 찾기 위해<br/>업체 전송용 완벽 가이드 텍스트를 만들어드려요.</p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-bold text-white/90 gap-1">
                    {/* 🔥 텍스트 동적 변경 */}
                    {requestText ? '내 맞춤 요청서 확인하기' : '요청서 만들러 가기'} <ArrowRight size={14}/>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* 이하 기존 랭킹 UI 및 게시판 코드 (대표님 코드 100% 복원!) */}
                {/* ========================================================================= */}
                <div className="flex justify-between items-end ml-1 mt-6">
                  <h3 className="font-bold text-gray-800 flex items-center gap-1.5 mt-1">
                     <HeartHandshake size={18} className="text-orange-500 mb-0.5"/> 
                     <span className="text-orange-600">{helperRegionDisplay}</span> 산후도우미 TOP 10
                  </h3>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 leading-relaxed shadow-sm">
                  본 순위는 <span className="font-bold text-gray-800">사회서비스 전자바우처의 2025년 품질평가 데이터 및 이용자 수</span>를 기반으로 합니다. <br className="hidden sm:block"/>
                  정확한 기관 정보 및 제공 인력 등급은 <a href="https://www.socialservice.or.kr:444/user/svcsrch/supply/supplyList.do" target="_blank" rel="noreferrer" className="text-orange-600 font-bold underline ml-0.5">공식 홈페이지(바로가기)</a>에서 확인해주세요.
                </div>

                <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 shadow-inner">
                   <p className="text-[10px] font-bold text-gray-400 ml-1">다른 지역 검색</p>
                   <div className="flex gap-2">
                     <select value={helperViewSido} onChange={e => {setHelperViewSido(e.target.value); setHelperViewSigugun('');}} className="flex-1 text-xs p-2.5 rounded-lg outline-none border border-gray-200">
                        <option value="">시/도 선택</option>{Object.keys(REGION_DATA).map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                     {helperViewSido && (
                       <select value={helperViewSigugun} onChange={e => setHelperViewSigugun(e.target.value)} className="flex-1 text-xs p-2.5 rounded-lg outline-none border border-gray-200">
                          <option value="">시/군/구</option>{Object.keys(REGION_DATA[helperViewSido] || {}).map(s => <option key={s} value={s}>{s}</option>)}
                       </select>
                     )}
                     <button onClick={() => setSearchedHelperRegion(helperViewSigugun ? `${helperViewSido} ${helperViewSigugun}` : helperViewSido)} disabled={!helperViewSido} className="bg-orange-500 text-white px-3 text-xs font-bold rounded-lg disabled:bg-gray-300">검색</button>
                   </div>
                   {searchedHelperRegion && (
                     <button onClick={() => {setSearchedHelperRegion(''); setHelperViewSido(''); setHelperViewSigugun('');}} className="text-[10px] text-gray-500 underline mt-1 text-left w-fit">내 거주지로 돌아가기</button>
                   )}
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  {currentHelperList.length > 0 ? currentHelperList.map((h: any, idx: number) => {
                    const grade = h['품질평가'] || '미공개';
                    const name = h['기관명'] || '이름없음';
                    const users = h['이용자 수'] || 0;
                    return (
                      <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${idx < 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{idx+1}</span>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${grade === 'A' ? 'bg-blue-100 text-blue-600' : grade === 'B' ? 'bg-emerald-100 text-emerald-600' : grade === 'C' ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                                {grade === '미공개' ? '등급미공개' : `${grade}등급`}
                              </span>
                              <span className="text-sm font-bold text-gray-800">{name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500 shrink-0 text-right">
                          이용자: <span className="font-bold text-gray-800">{users}</span>명
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-center py-6 text-gray-400 text-sm">해당 지역의 산후도우미 정보가 없습니다.</div>
                  )}
                </div>

                <SeniorPrompt currentWeek={currentWeek} targetWeek={32} question="이모님 예약하셨나요? 꿀팁을 알려주세요!" reward="답변하고 포인트 받기" />
                <h4 className="font-bold text-sm text-gray-700 mt-6 mb-2 ml-1">관련 게시판</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <BoardCard icon="👼" title="좋은 이모님 추천/후기" desc="우리 동네 프리미엄 이모님 정보" onClick={() => onOpenBoard('이모님 추천 후기')} />
                  <BoardCard icon="📝" title="정부지원 바우처 꿀팁" desc="바우처 신청부터 결제까지 총정리" onClick={() => onOpenBoard('바우처 꿀팁 공유')} />
                </div>
              </section>
            );
          })()}

          {/* ✨ 7. 육아템 탭 */}
          {activeMomTab === 'baby' && (
            <section className="space-y-4 animate-fade-in">
              {/* 🚀 [신규 대시보드] 기존 핑크 배너 대체 */}
              {(() => {
                const regData = displayUser.registryData || {};
                const total = 21;
                const done = Object.values(regData).filter((v:any) => v.isPrepared).length;
                const percent = Math.round((done / total) * 100) || 0;
                
                return (
                  <div className="bg-gray-900 rounded-[24px] p-5 text-white shadow-lg relative overflow-hidden mb-6">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-[10px] text-orange-400 font-bold mb-1">우리 부부의 베페 동선 맵</p>
                        <h3 className="text-lg font-black tracking-tight leading-snug">
                          {done === 0 ? "지금부터 하나씩\n차근차근 준비해볼까요?" : `21개 필수템 중\n${done}개를 완료했어요!`}
                        </h3>
                      </div>
                      {/* 원형 게이지 차트 */}
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path className="text-gray-700" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path className="text-orange-500 transition-all duration-1000 ease-out" strokeDasharray={`${percent}, 100`} strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <span className="absolute text-sm font-black text-white">{percent}%</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowRegistryReport(true)}
                      className="w-full mt-4 py-3 rounded-xl border border-white/20 text-xs font-bold active:bg-white/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ListChecks size={16}/> 내 전체 준비 현황 리포트 보기
                    </button>
                  </div>
                );
              })()}

              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {Object.keys(BABY_FAIR_CATEGORIES).map((key) => {
                  const isActive = babyL1 === key;
                  return (
                    <button key={key} onClick={() => { setBabyL1(key); setBabyL2(BABY_FAIR_CATEGORIES[key].filters[0]); }} className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                      {BABY_FAIR_CATEGORIES[key].title}
                    </button>
                  )
                })}
              </div>

              <p className="text-[11px] font-bold text-rose-500 ml-1">
                💡 {BABY_FAIR_CATEGORIES[babyL1].rationale}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                {BABY_FAIR_CATEGORIES[babyL1].filters.map((filter: string) => (
                  <button key={filter} onClick={() => setBabyL2(filter)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${babyL2 === filter ? 'bg-rose-500 text-white border-rose-500 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {filter}
                  </button>
                ))}
              </div>

              {/* 🎯 [토스 UX] 준비 완료 인터랙티브 카드 */}
              {babyL2 && (() => {
                const status = displayUser.registryData?.[babyL2] || { isPrepared: false };
                
                const handleToggle = () => {
                  const newData = { ...displayUser.registryData };
                  if (status.isPrepared) {
                    newData[babyL2] = { isPrepared: false, brandName: '' }; // 해제
                  } else {
                    newData[babyL2] = { isPrepared: true, brandName: '' }; // 완료
                    addToast('success', '준비 리스트에 추가되었습니다! 🎉');
                  }
                  onUpdateUser({ ...displayUser, registryData: newData });
                };

                const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const newData = { ...displayUser.registryData };
                  newData[babyL2] = { ...status, brandName: e.target.value };
                  onUpdateUser({ ...displayUser, registryData: newData });
                };

                // ✅ 명시적인 저장 버튼 클릭 핸들러 추가
                const handleSaveClick = () => {
                  addToast('success', '브랜드 정보가 꼼꼼하게 저장되었어요! 💾');
                };

                return (
                  <div className="mb-6 animate-fade-in">
                    <div 
                      onClick={handleToggle}
                      className={`relative overflow-hidden cursor-pointer rounded-2xl p-4 transition-all duration-300 border-2 active:scale-[0.98] ${status.isPrepared ? 'bg-orange-50 border-orange-500 shadow-md' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${status.isPrepared ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'}`}>
                            {status.isPrepared && <Check size={14} className="text-white" strokeWidth={3}/>}
                          </div>
                          <div>
                            <h4 className={`font-bold text-sm ${status.isPrepared ? 'text-orange-900' : 'text-gray-800'}`}>
                              {status.isPrepared ? `${babyL2} 준비 완료! 🎉` : `${babyL2} 준비하셨나요?`}
                            </h4>
                            {!status.isPrepared && <p className="text-[11px] text-gray-500 mt-0.5">터치해서 나의 진행률을 올려보세요!</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 완료 시 스르륵 나타나는 브랜드 입력창 (+ 저장 버튼 추가) */}
                    {status.isPrepared && (
                      <div className="mt-2 bg-orange-50/50 rounded-xl p-3 border border-orange-100 flex items-center gap-2 animate-fade-in">
                        <span className="text-[11px] font-bold text-orange-800 whitespace-nowrap pl-1">결정 브랜드</span>
                        <div className="flex-1 flex gap-1.5">
                          <input 
                            type="text" 
                            value={status.brandName || ''}
                            onChange={handleBrandChange}
                            placeholder="예) 부가부 폭스5 (선택사항)" 
                            className="flex-1 w-full bg-white px-3 py-2 rounded-lg text-xs outline-none border border-orange-200 text-gray-800 placeholder-gray-300 focus:border-orange-500 transition-colors shadow-inner"
                          />
                          <button 
                            onClick={handleSaveClick}
                            className="px-3 py-2 bg-orange-500 text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-transform whitespace-nowrap hover:bg-orange-600"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-4 overflow-hidden">
                <div className="flex bg-gray-50 p-1 border-b border-gray-100">
                  <button onClick={() => setBabyTab('naver')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${babyTab === 'naver' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>
                    📈 검색 트렌드 Top
                  </button>
                  <button onClick={() => { setBabyTab('coupang'); addToast('info', '현재 쿠팡 API 승인 대기 중입니다.'); }} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${babyTab === 'coupang' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-400'}`}>
                    🛒 판매 Top (오픈준비중)
                  </button>
                </div>

                <div className="p-4 space-y-3 min-h-[150px]">
                  {babyTab === 'coupang' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <ShoppingBag size={32} className="text-gray-300 mb-2"/>
                      <p className="text-sm font-bold text-gray-500">실제 판매 랭킹 연동 준비 중!</p>
                      <p className="text-xs text-gray-400 mt-1">곧 가장 저렴한 핫딜 정보를 가져올게요.</p>
                    </div>
                  ) : isBabyLoading ? (
                    <div className="text-center py-10 text-xs text-gray-400">트렌드 데이터를 분석 중입니다...</div>
                  ) : (
                    babyData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.rank}
                          </span>
                          <span className="text-sm font-bold text-gray-800">{item.name}</span>
                        </div>
                        <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md border ${
                          item.rank <= 3 ? 'text-rose-600 bg-rose-50 border-rose-100 shadow-sm' :
                          item.rank <= 6 ? 'text-orange-600 bg-orange-50 border-orange-100' :
                          'text-emerald-600 bg-emerald-50 border-emerald-100'
                        }`}>
                          {item.trend}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <SeniorPrompt currentWeek={currentWeek} targetWeek={32} question={`${babyL2} 졸업하신 선배님들! 꿀팁 좀 남겨주세요.`} reward="답변하고 포인트 받기" />
              
              <h4 className="font-bold text-sm text-gray-700 mt-6 mb-2 ml-1">관련 게시판</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <BoardCard icon="👜" title="출산가방 싸기 공유방" desc="병원/조리원 갈 때 이거 꼭 챙기세요" onClick={() => onOpenBoard('출산가방 공유방')} />
                <BoardCard icon="🥕" title="당근마켓 꿀템/핫딜방" desc="이건 무조건 중고로 사세요!" onClick={() => onOpenBoard('당근마켓 꿀팁방')} />
              </div>
            </section>
          )}

          {/* ✨ 8. 이름짓기 탭 */}
          {activeMomTab === 'realname' && (
            <RealNameSection user={displayUser} onUpdateUser={onUpdateUser} addToast={addToast} onGoGarden={onGoGarden} />
          )}
          
          {/* 🔥 [추가] 맘스픽 띠 배너 광고 삽입 (모든 탭 하단에 공통 노출!) */}
          <KakaoAdBanner unit="DAN-vbDQdij118vDjjFh" width="320" height="100" />
        </div>
      </div>
    </div> {/* 🔥 메인 컨테이너 닫기. 팝업들을 이 밖으로 빼서 무조건 화면 위를 덮게 만듭니다! */}

    {/* 🏆 [안전지대 팝업 1] 국민행복카드 테스트 모달 */}
    {showWorldCup && (
      <HappinessCardTest 
        user={displayUser}
        onCancel={() => setShowWorldCup(false)}
        onComplete={async (top1: string, top2: string, answers: any[]) => {
          const newResult = { top1, top2, answers, completedAt: new Date().toISOString() };
          
          // 🔥 [에러 원인 완벽 제거] 여기서 직접 유저 정보에서 꺼내서 배열을 만들어 줍니다!
          const currentList = displayUser.completedMissions ? String(displayUser.completedMissions).split(',').filter(Boolean) : [];
          const newList = currentList.includes('국민행복카드 발급') ? currentList : [...currentList, '국민행복카드 발급'];
          
          onUpdateUser({ 
            ...displayUser, 
            completedMissions: newList.join(','), 
            cardTestResult: newResult 
          });
          setShowWorldCup(false);
          addToast('success', '카드 분석 완료! 40주 미션이 클리어되었습니다 🎉');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        addToast={addToast}
      />
    )}

    {/* 📋 [안전지대 팝업 2] 전체 비교표 바텀시트 팝업 */}
    {showCompareTable && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999 }} className="bg-black/70 flex flex-col justify-end animate-fade-in p-4 pb-safe backdrop-blur-sm">
        <div className="bg-white w-full rounded-3xl p-6 relative shadow-2xl max-h-[85vh] flex flex-col">
          <button onClick={() => setShowCompareTable(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <h3 className="text-lg font-black text-gray-900 mb-1">💳 주요 카드사 혜택 요약표</h3>
          <p className="text-[11px] text-gray-500 mb-3 font-medium">(2026년 최신 기준)</p>
          
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 mb-4 flex gap-2 items-start shrink-0 shadow-sm">
            <span className="text-[14px] mt-0.5">⚠️</span>
            <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium leading-relaxed break-keep">
              본 표는 예비맘님들의 빠른 비교를 위해 <b className="text-gray-700">핵심 혜택만 요약</b>한 자료입니다.<br/>
              정확한 실적 조건 및 상세 혜택 내용은 반드시 <b className="text-gray-700">각 카드사 공식 홈페이지</b>를 확인해 주세요!
            </p>
          </div>
          
          <div className="flex-1 overflow-x-auto overflow-y-auto border border-gray-200 rounded-2xl no-scrollbar shadow-inner">
            <table className="w-full text-[11px] text-left border-collapse min-w-[400px]">
              <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-3">카드사</th>
                  <th className="px-3 py-3">핵심 혜택 (할인/적립)</th>
                  <th className="px-3 py-3">예상 최대 혜택</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-3 py-4 font-bold text-gray-800 bg-white">롯데카드</td>
                  <td className="px-3 py-4 text-gray-600 bg-white leading-relaxed">쇼핑/육아 10%<br/>병의원 5%<br/>넷플릭스 등 할인</td>
                  <td className="px-3 py-4 font-black text-rose-500 bg-white">최대 37만원 상당</td>
                </tr>
                <tr>
                  <td className="px-3 py-4 font-bold text-gray-800 bg-white">삼성 V2</td>
                  <td className="px-3 py-4 text-gray-600 bg-white leading-relaxed">병원/조리원 7%<br/>쇼핑/온라인 7%<br/>스트리밍 할인</td>
                  <td className="px-3 py-4 font-black text-rose-500 bg-white">최대 31.7만원 상당</td>
                </tr>
                <tr>
                  <td className="px-3 py-4 font-bold text-gray-800 bg-white">KB국민</td>
                  <td className="px-3 py-4 text-gray-600 bg-white leading-relaxed">온라인/마트 5%<br/>키즈카페 5%<br/>단체 상해보험 무료</td>
                  <td className="px-3 py-4 font-black text-rose-500 bg-white">최대 24만원 상당</td>
                </tr>
                <tr>
                  <td className="px-3 py-4 font-bold text-gray-800 bg-white">신한카드</td>
                  <td className="px-3 py-4 text-gray-600 bg-white leading-relaxed">배달앱 10%<br/>유튜브/넷플 50%<br/>의료비 5%</td>
                  <td className="px-3 py-4 font-black text-rose-500 bg-white">최대 55만원 상당</td>
                </tr>
                <tr>
                  <td className="px-3 py-4 font-bold text-gray-800 bg-white">NH농협</td>
                  <td className="px-3 py-4 text-gray-600 bg-white leading-relaxed">온라인몰/조리원 5%<br/>놀이공원 50%<br/>커피/외식 10~20%</td>
                  <td className="px-3 py-4 font-black text-rose-500 bg-white">최대 22만원 상당</td>
                </tr>
                <tr>
                  <td className="px-3 py-4 font-bold text-gray-800 bg-white">IBK기업</td>
                  <td className="px-3 py-4 text-gray-600 bg-white leading-relaxed">온라인쇼핑 5%<br/>커피 20%<br/>외식 10%</td>
                  <td className="px-3 py-4 font-black text-rose-500 bg-white">최대 24만원 상당</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button onClick={() => setShowCompareTable(false)} className="w-full mt-4 py-4 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-black transition-colors active:scale-95 shrink-0">닫기</button>
        </div>
      </div>
    )}

    {/* 🏆 [안전지대 팝업 3] 태아보험 AI 정밀 진단 테스트 모달 */}
    {showInsTest && (
      <InsuranceMatchingTest 
        user={displayUser}
        onCancel={() => setShowInsTest(false)}
        onComplete={async (typeId: string, answers: any[]) => {
          const newResult = { typeId, answers, completedAt: new Date().toISOString() };
          const currentList = displayUser.completedMissions ? String(displayUser.completedMissions).split(',').filter(Boolean) : [];
          const newList = currentList.includes('태아보험 가입') ? currentList : [...currentList, '태아보험 가입'];
          
          onUpdateUser({ 
            ...displayUser, 
            completedMissions: newList.join(','), 
            insTestResult: newResult 
          });
          setShowInsTest(false);
          setShowInsDetail(true);
          addToast('success', '태아보험 분석 완료! 40주 미션이 클리어되었습니다 🎉');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    )}

    {/* 📝 [안전지대 팝업 4] 태아보험 상세 리포트 모달 */}
    {showInsDetail && displayUser.insTestResult && (() => {
      
      // 🔥 [빨간줄 해결] 태그 안쪽에 꼬여있던 데이터를 안전한 변수(Record)로 예쁘게 빼냈습니다!
      const INS_PERSONAS: Record<string, any> = {
        TYPE1: { title: "초가성비 실속형", desc: "불필요한 특약은 싹 다이어트! 신생아 시기 핵심 방어에만 집중한 가장 똑똑한 플랜입니다.", tags: ["30세만기", "무해지", "가성비"] },
        TYPE2: { title: "국민 표준 안심형", desc: "대한민국 산모 10명 중 6명이 선택! 자잘하게 병원 갈 일이 많은 영유아기를 완벽하게 커버합니다.", tags: ["30세만기", "풀담보", "인기"] },
        TYPE3: { title: "평생 든든 철벽형", desc: "화폐가치 하락보다 안전이 우선! 성인이 되어서도 아플 걱정 없이 평생 지켜주는 철벽 방어 플랜입니다.", tags: ["100세만기", "최대보장", "철벽방어"] },
        TYPE4: { title: "고위험군 집중 방어형", desc: "다태아/시험관 산모님을 위한 맞춤형! 니큐 입원일당과 선천이상 보장을 최대치로 설정했습니다.", tags: ["니큐집중", "쌍둥이맞춤", "선천이상"] },
        TYPE5: { title: "전문가 픽! 하이브리드형", desc: "가성비와 든든함을 모두 잡은 고난도 설계! 큰 병은 100세, 자잘한 병은 30세로 효율을 극대화했습니다.", tags: ["복층설계", "효율끝판왕", "전문가추천"] },
      };
      
      const myResult = INS_PERSONAS[displayUser.insTestResult.typeId] || INS_PERSONAS['TYPE2'];

      return (
        <div className="fixed inset-0 z-[99999] bg-white flex flex-col animate-fade-in overflow-hidden font-pretendard">
          <header className="px-4 py-4 flex items-center justify-between border-b border-gray-100 bg-white z-10 shrink-0">
            <button onClick={() => setShowInsDetail(false)} className="p-1 -ml-1 text-gray-600"><ArrowLeft size={24}/></button>
            <h2 className="font-bold text-lg text-gray-900">AI 정밀 분석 리포트</h2>
            <div className="w-6"></div>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-6 bg-gray-50">
            <div className="max-w-md mx-auto space-y-6">
              
              {/* 🔥 결과 화면이 훨씬 짧고 깔끔해졌습니다! */}
              <div className="bg-blue-600 rounded-3xl p-8 text-white text-center shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full"></div>
                <p className="text-blue-200 text-[11px] font-black mb-2 uppercase tracking-widest">Analysis Result</p>
                <h3 className="text-2xl font-black mb-3">{myResult.title}</h3>
                <p className="text-xs text-blue-50 leading-relaxed break-keep opacity-90">{myResult.desc}</p>
                <div className="flex justify-center gap-2 mt-5">
                  {myResult.tags.map((t: string) => (
                    <span key={t} className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">#{t}</span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h4 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><CheckCircle2 size={18} className="text-blue-500"/> 산모님의 세부 답변 내역</h4>
                <div className="space-y-4">
                  {displayUser.insTestResult.answers.map((a: any) => (
                    <div key={a.qId} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                      <p className="text-[10px] font-black text-gray-400 mb-1.5 leading-snug">Q{a.qId}. {a.question.split('\n')[0]}</p>
                      <p className="text-xs font-bold text-blue-600 bg-blue-50 p-2.5 rounded-lg border border-blue-100">👉 {a.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 p-5 rounded-2xl border border-yellow-200 shadow-sm text-center">
                 <span className="text-2xl mb-2 block">💡</span>
                 <p className="text-xs text-yellow-800 leading-relaxed font-medium break-keep">
                   <b>설계사 상담 팁:</b> 실제 상담 시 이 리포트 화면을 설계사님께 보여주세요. 산모님의 가치관에 딱 맞는 불필요한 특약 없는 완벽한 맞춤 견적을 받으실 수 있습니다.
                 </p>
              </div>

              <button onClick={() => { setShowInsDetail(false); addToast('info', '봄이옴이 엄선한 태아보험 전문가 그룹을 곧 연결해 드릴게요! ⏳'); }} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-transform mb-10 text-sm">
                이 리포트대로 무료 견적 받기 🚀
              </button>
            </div>
          </main>
        </div>
      );
    })()}

    {/* 🍼 [안전지대 팝업 5] 산후도우미 바우처 계산기 팝업 */}
    {showHelperVoucher && (
      <HelperMatchingTest 
        mode="VOUCHER"
        onCancel={() => setShowHelperVoucher(false)}
        onComplete={(type: string, data: any) => {
          const currentResult = displayUser.helperTestResult || { voucher: null, requestText: '' };
          onUpdateUser({ 
            ...displayUser, 
            // 🔥 바우처 결과이므로 'voucher: data' 에 저장합니다! (퀘스트 완료 처리 없음)
            helperTestResult: { ...currentResult, voucher: data, completedAt: new Date().toISOString() } as any
          });
          
          // 🔥 바우처 팝업을 닫고 알림을 띄웁니다!
          setShowHelperVoucher(false);
          addToast('success', '바우처 견적이 저장되었습니다! 💰');
        }}
      />
    )}

    {/* 📋 [안전지대 팝업 6] 산후도우미 AI 매칭 요청서 테스트 팝업 */}
    {showHelperAi && (
      <HelperMatchingTest 
        mode="AI"
        onCancel={() => setShowHelperAi(false)}
        onComplete={(type: string, data: any) => {
          const currentResult = displayUser.helperTestResult || { voucher: null, requestText: '' };
          
          // 🔥 AI 요청서를 작성하면 퀘스트 완료 도장을 찍어줍니다!
          const currentList = displayUser.completedMissions ? String(displayUser.completedMissions).split(',').filter(Boolean) : [];
          const newList = currentList.includes('산후도우미 예약') ? currentList : [...currentList, '산후도우미 예약'];
          
          onUpdateUser({ 
            ...displayUser, 
            completedMissions: newList.join(','), // 👈 미션 완료 업데이트
            // 🔥 AI 결과이므로 'requestText: data' 에 저장합니다!
            helperTestResult: { ...currentResult, requestText: data, completedAt: new Date().toISOString() } as any
          });
          
          // 🔥 AI 팝업을 닫고 알림을 띄웁니다!
          setShowHelperAi(false);
          addToast('success', '요청서 완료! 40주 미션이 클리어되었습니다 🎉');
        }}
      />
    )}

    {/* 📋 [안전지대 팝업 6] 산후도우미 AI 요청서 테스트 팝업 */}
    {showHelperAi && (
      <HelperMatchingTest 
        mode="AI"
        onCancel={() => setShowHelperAi(false)}
        onComplete={(type: string, data: any) => {
          const currentResult = displayUser.helperTestResult || { voucher: null, requestText: '' };
          onUpdateUser({ 
            ...displayUser, 
            helperTestResult: { ...currentResult, requestText: data, completedAt: new Date().toISOString() } as any
          });
          setShowHelperAi(false);
          addToast('success', '요청서 작성이 완료되었습니다! 복사해서 전송해 보세요 🎉');
        }}
      />
    )}

    {/* ✨ [신규 팝업] 산후도우미 바우처 계산 결과 보기 */}
    {showVoucherResultModal && displayUser.helperTestResult?.voucher && (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 relative shadow-2xl text-center">
          <button onClick={() => setShowVoucherResultModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <span className="text-5xl mb-3 block">💰</span>
          <h3 className="text-xl font-black text-gray-900 mb-5 tracking-tight">나의 바우처 견적</h3>
          
          <div className="bg-emerald-50 rounded-2xl p-5 mb-6 border border-emerald-100 shadow-inner">
            <p className="text-xs font-bold text-emerald-600 mb-1">예상 본인부담금</p>
            <p className="text-3xl font-black text-emerald-700 mb-2">{displayUser.helperTestResult.voucher.myCost.toLocaleString()}원</p>
            <p className="text-[11px] text-emerald-600/80 font-bold bg-white inline-block px-3 py-1 rounded-lg shadow-sm">
              {displayUser.helperTestResult.voucher.type} ({displayUser.helperTestResult.voucher.period})
            </p>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => { setShowVoucherResultModal(false); setShowVoucherDetailModal(true); }} 
              className="flex-1 py-4 bg-gray-900 text-white font-bold rounded-xl text-[13px] shadow-md hover:bg-black transition-colors"
            >
              상세보기 📋
            </button>
            <button 
              onClick={() => { setShowVoucherResultModal(false); setShowHelperVoucher(true); }} 
              className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl text-[13px] hover:bg-gray-200 transition-colors shadow-sm"
            >
              다시 계산하기 🔄
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ✨ [신규 팝업] 산후도우미 AI 매칭 요청서 결과 보기 */}
    {showAiResultModal && displayUser.helperTestResult?.requestText && (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 relative shadow-2xl">
          <button onClick={() => setShowAiResultModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <h3 className="text-xl font-black text-gray-900 mb-2 flex items-center gap-1.5"><CheckCircle2 className="text-blue-500"/> 업체 전송용 요청서</h3>
          <p className="text-[11px] text-gray-500 mb-5 break-keep">아래 내용을 복사해서 업체 상담원에게 바로 전송해 보세요!</p>
          
          <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200 text-[11px] text-gray-700 font-medium leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto shadow-inner text-left">
            {/* 🔥 [에러 방어 핵심!!] 이전 버그로 인해 꼬여버린 객체 데이터가 들어오면 앱이 터지지 않게 막아줍니다. */}
            {typeof displayUser.helperTestResult.requestText === 'string' 
              ? displayUser.helperTestResult.requestText 
              : "요청서 내용이 초기화되었습니다. 하단의 '다시 하기' 버튼을 눌러 나에게 맞는 요청서를 새롭게 만들어주세요."}
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => { setShowAiResultModal(false); setShowHelperAi(true); }} 
              className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl text-[13px] hover:bg-gray-200 transition-colors shadow-sm"
            >
              다시 하기 🔄
            </button>
            <button 
              onClick={() => { 
                // 복사할 때도 에러 안 나게 방어
                const txt = typeof displayUser.helperTestResult.requestText === 'string' ? displayUser.helperTestResult.requestText : '';
                if(txt) {
                  navigator.clipboard.writeText(txt); 
                  addToast('success', '요청서가 복사되었습니다! 카톡에 붙여넣어 보세요 ✂️'); 
                }
              }} 
              className="flex-[1.5] py-4 bg-blue-500 text-white font-black rounded-xl text-[14px] hover:bg-blue-600 transition-transform active:scale-95 shadow-md"
            >
              텍스트 복사하기 ✂️
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ✨ [신규 팝업] 바우처 상세 리포트 (그래프 포함) */}
    {showVoucherDetailModal && displayUser.helperTestResult?.voucher && (() => {
      const v = displayUser.helperTestResult.voucher;
      // 지원금 비율 계산
      const subPct = Math.round((v.sub / v.total) * 100);
      const myPct = 100 - subPct;

      return (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 relative shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setShowVoucherDetailModal(false)} className="absolute top-5 right-5 text-gray-400"><X size={24}/></button>
            
            <header className="text-center mb-8">
              <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full mb-3 inline-block border border-emerald-100">Voucher Report</span>
              <h3 className="text-xl font-black text-gray-900">바우처 견적 상세 리포트</h3>
            </header>

            <div className="bg-[#FCFAF2] border border-[#EBE5D3] p-6 rounded-2xl shadow-sm mb-6">
              <h4 className="text-[13px] font-bold text-gray-800 mb-1">{v.type} ({v.period}) 기준</h4>
              <p className="text-3xl font-black text-[#B08D38] mb-4">{v.myCost.toLocaleString()}원</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-3 rounded-xl border border-[#EBE5D3]"><p className="text-[10px] text-gray-400 mb-1">총 서비스가격</p><p className="font-bold text-gray-800">{v.total.toLocaleString()}원</p></div>
                <div className="bg-white p-3 rounded-xl border border-[#EBE5D3]"><p className="text-[10px] text-gray-400 mb-1">정부 지원금</p><p className="font-bold text-emerald-600">{v.sub.toLocaleString()}원</p></div>
              </div>
            </div>

            {/* 비교 그래프 */}
            <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm mb-6">
              <p className="text-[11px] font-bold text-gray-700 mb-5 flex items-center gap-1"><PieChart size={14}/> 서비스 비용 구성 비율</p>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-[10px] text-gray-500 text-right">정부지원</span>
                  <div className="flex-1 h-5 bg-gray-50 rounded-r-md overflow-hidden"><div className="h-full bg-emerald-400 transition-all duration-1000" style={{width: `${subPct}%`}}></div></div>
                  <span className="w-8 text-[10px] font-bold text-emerald-600">{subPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-[10px] text-gray-500 text-right">본인부담</span>
                  <div className="flex-1 h-5 bg-gray-50 rounded-r-md overflow-hidden"><div className="h-full bg-rose-400 transition-all duration-1000" style={{width: `${myPct}%`}}></div></div>
                  <span className="w-8 text-[10px] font-bold text-rose-500">{myPct}%</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => { setShowVoucherDetailModal(false); setShowHelperVoucher(true); }} 
              className="w-full py-4 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors"
            >
              정보 수정하고 다시 계산하기 🔄
            </button>
            <button 
              onClick={() => setShowVoucherDetailModal(false)} 
              className="w-full py-4 bg-gray-900 text-white font-black rounded-xl text-sm shadow-md mt-2 active:scale-95 transition-transform"
            >
              확인 완료
            </button>
          </div>
        </div>
      );
    })()}

    {/* 🚀 [마스터키 팝업 1] 산부인과 팝업 (완벽한 화면 덮기 & 중앙 정렬) */}
    {hospFormType !== 'NONE' && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999 }} className={`bg-black/70 flex flex-col items-center p-4 animate-fade-in backdrop-blur-sm transition-all duration-300 ${isHospFocused ? 'pt-16 sm:pt-24' : 'justify-center'}`}>
        <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col items-center text-center">
          <button onClick={() => setHospFormType('NONE')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <span className="text-4xl mb-3 block">{hospFormType === 'LOOKING' ? '🎁' : '🏥'}</span>
          <h3 className="font-extrabold text-lg text-gray-900 mb-2">
            {hospFormType === 'LOOKING' ? '출산 예정일을 알려주세요!' : '다니시는 산부인과를 알려주세요!'}
          </h3>
          <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">
            {hospFormType === 'LOOKING' ? '예정일을 입력하시면 맞춤형 대시보드가 열립니다!' : '병원을 입력하시면 100% 리얼 동네 랭킹이 열립니다!'}
          </p>

          <div className="w-full space-y-4 text-left">
            {/* 🔥 산부인과 탭에서 들어왔을 때 (병원만 물어봄) */}
            {hospFormType === 'ATTENDING' && (
              <div className="relative w-full text-left">
                <div className="flex items-center justify-end mb-1.5 mr-1 mt-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={isOtherHospRegion} onChange={e=>setIsOtherHospRegion(e.target.checked)} className="w-3.5 h-3.5 accent-rose-500"/>
                    <span className="text-[10px] text-gray-500 font-bold">주민등록지와 다른지역 병원에 다녀요</span>
                  </label>
                </div>
                {isOtherHospRegion && (
                  <div className="flex gap-2 mb-2">
                    <select value={hSido} onChange={e => {setHSido(e.target.value); setHSigugun('');}} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-300">
                        <option value="">시/도</option>{Object.keys(REGION_DATA).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {hSido && (
                      <select value={hSigugun} onChange={e => setHSigugun(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-300">
                          <option value="">시/군/구</option>{Object.keys(REGION_DATA[hSido] || {}).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </div>
                )}
                
                {/* ✅ 검색창과 자동완성을 하나의 박스로 묶어 가림(z-index) 현상 완벽 해결! */}
                <div className="relative w-full">
                  <input 
                    type="text" 
                    disabled={isHospLooking} 
                    placeholder={isHospLooking ? "알아보는 중입니다" : "병원명 검색 (예: 미즈메디)"} 
                    value={searchTerm} 
                    onChange={e => handleSearch(e.target.value)} 
                    onFocus={() => setIsHospFocused(true)}
                    onBlur={() => setTimeout(() => setIsHospFocused(false), 200)} // 리스트 터치를 위해 살짝 지연
                    className={`w-full p-4 rounded-xl text-sm outline-none border focus:border-rose-300 transition-colors ${isHospLooking ? 'bg-gray-100 text-gray-400' : 'bg-gray-50'}`}
                  />
                  
                  {hospitals.length > 0 && !selectedHospital && !isHospLooking && (
                    <div className="w-full bg-white border border-gray-200 rounded-xl mt-2 shadow-inner max-h-48 overflow-y-auto text-left">
                      {hospitals.map(h => (
                        <div key={h.id} onClick={() => { setSelectedHospital(h); setSearchTerm(h.name); setHospitals([]); }} className="p-4 hover:bg-rose-50 border-b last:border-0 cursor-pointer">
                          <p className="font-bold text-sm text-gray-800">{h.name}</p>
                          <p className="text-[11px] text-gray-400">{h.address}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ✅ 체크박스는 검색창 밑으로 안전하게 배치 */}
                <label className="flex items-center gap-1.5 cursor-pointer mt-3 ml-1 mb-2 w-fit">
                  <input type="checkbox" checked={isHospLooking} onChange={e => { setIsHospLooking(e.target.checked); if(e.target.checked) { setSelectedHospital(null); setSearchTerm(''); } }} className="w-4 h-4 accent-rose-500"/>
                  <span className="text-[11px] font-bold text-gray-600">아직 알아보고 있어요</span>
                </label>

                {selectedHospital && !isHospLooking && (
                  <div className="mt-3 animate-fade-in border border-rose-200 rounded-xl overflow-hidden shadow-sm relative z-0">
                    <div className="bg-rose-50 p-3 flex justify-between items-center border-b border-rose-100">
                      <div>
                          <p className="text-sm font-bold text-gray-900">{selectedHospital.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{selectedHospital.address}</p>
                      </div>
                      <button onClick={() => { setSelectedHospital(null); setSearchTerm(''); }} className="text-[10px] text-gray-400 underline shrink-0 whitespace-nowrap ml-2 relative z-10">다른 병원 찾기</button>
                    </div>
                    <div className="h-40 w-full bg-gray-100 relative z-0">
                      <KakaoMapWrapper address={selectedHospital.address} name={selectedHospital.name} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 🔥 대시보드에서 들어왔을 때 (예정일, 성별 물어봄) */}
            {hospFormType === 'LOOKING' && (
              <>
                <div className="pt-2">
                  <label className="text-xs font-bold text-gray-400 ml-1 mb-1 block">출산 예정일</label>
                  <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl text-sm outline-none border focus:border-rose-300"/>
                </div>

                {!isPreMom && (
                  <div className="pt-2 mt-2">
                    <label className="text-xs font-bold text-gray-400 ml-1 mb-2 block">우리아이 성별 (선택)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {GENDER_OPTIONS.map(g => (
                        <button key={g.label} onClick={() => setBabyGender(g.emoji + ' ' + g.label)} className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-colors ${babyGender === (g.emoji + ' ' + g.label) ? 'bg-rose-50 border-rose-200 text-rose-500 shadow-sm' : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                          <span className={`${g.label === '세쌍둥이+' ? 'text-xs sm:text-sm tracking-tighter' : 'text-lg'} mb-0.5 whitespace-nowrap`}>{g.emoji}</span>
                          <span className="text-[9px] break-keep leading-tight text-center">{g.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* ✅ 병원 선택했거나 알아보고 있어요 체크 시에만 버튼 활성화! */}
            <button disabled={hospFormType === 'ATTENDING' && !selectedHospital && !isHospLooking} onClick={() => { handleHospSubmit(); setHospFormType('NONE'); }} className="w-full py-4 mt-4 bg-rose-500 text-white rounded-xl font-bold shadow-md hover:bg-rose-600 transition-colors disabled:bg-gray-300">
              정보 저장하고 잠금 풀기 🚀
            </button>
            
            {/* 🔥 대시보드에서 들어왔을 때 띄우는 예비맘 패스 버튼! */}
            {hospFormType === 'LOOKING' && (
              <button onClick={() => { handlePreMomSubmit(); setHospFormType('NONE'); }} className="w-full py-3 mt-2 bg-gray-100 text-gray-500 rounded-xl font-bold shadow-sm hover:bg-gray-200 transition-colors text-xs">
                아직 출산 예정일을 몰라요 (예비맘)
              </button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* 🚀 [마스터키 팝업 2] 태아보험 팝업 */}
    {insStatus === 'FORM' && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999 }} className="bg-black/70 flex flex-col items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col items-center text-center">
          <button onClick={() => setInsStatus('NONE')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <span className="text-4xl mb-3 block">🛡️</span>
          <h3 className="font-extrabold text-lg text-gray-900 mb-2">후배 맘들을 위해 공유해주세요!</h3>
          <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">간단한 정보만으로 큰 도움이 됩니다.<br/>입력 시 태아보험 랭킹이 즉시 해제됩니다.</p>
          
          <div className="w-full space-y-6 text-left">
            <div>
              <label className="text-xs font-bold text-gray-600 mb-2 block">어떤 보험에 가입하셨나요?</label>
              <select value={insCompany} onChange={e=>setInsCompany(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-300">
                <option value="">보험사 선택</option>{insTop5.map(i=><option key={i.name} value={i.name}>{i.name}</option>)}<option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-4 block">월 납입액은 어느 정도인가요?</label>
              <p className="text-[10px] text-blue-500 font-bold text-center mb-2 animate-pulse">👇 동그라미를 좌우로 스르륵 움직여보세요!</p>
              <div className="relative px-2">
                <input type="range" min="0" max="4" value={insPriceIdx} onChange={(e) => setInsPriceIdx(Number(e.target.value))} className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 shadow-inner"/>
                <div className="flex justify-between text-[8px] text-gray-400 px-1 mt-1">
                  <span>미만</span><span>~7만</span><span>~10만</span><span>~12만</span><span>이상</span>
                </div>
                <div className="text-center font-black text-blue-600 mt-4 bg-blue-50 py-3 rounded-xl border border-blue-100 shadow-sm text-base transition-all">{INS_PRICE_LABELS[insPriceIdx]}</div>
              </div>
            </div>
            <button disabled={!insCompany} onClick={handleInsSubmit} className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl text-sm disabled:bg-gray-300 mt-4 shadow-md">
              공유 완료하고 통계 보기 🚀
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 🚀 [마스터키 팝업 3] 산후조리원 팝업 */}
    {careStatus === 'FORM' && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999999 }} className="bg-black/70 flex flex-col items-center pt-16 sm:pt-24 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col items-center text-center">
          <button onClick={() => setCareStatus('NONE')} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <span className="text-4xl mb-3 block">🏨</span>
          <h3 className="font-extrabold text-lg text-gray-900 mb-2">어디로 예약하셨나요?</h3>
          <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">예약하신 조리원을 공유해주시면<br/>동네 조리원 랭킹이 즉시 해제됩니다.</p>
          
          <div className="w-full space-y-4 text-left">
            <div className="flex items-center justify-end mb-1.5 mr-1 gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input type="checkbox" checked={isOtherCareRegion} onChange={e=>setIsOtherCareRegion(e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500 shrink-0"/>
                <span className="text-[10px] text-gray-500 font-bold tracking-tighter whitespace-nowrap">주민등록지와 다른지역 조리원에 다녀요</span>
              </label>
            </div>
            {isOtherCareRegion && (
              <div className="flex gap-2 mb-2">
                <select value={cSido} onChange={e => {setCSido(e.target.value); setCSigugun('');}} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-300">
                    <option value="">시/도</option>{Object.keys(REGION_DATA).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {cSido && (
                  <select value={cSigugun} onChange={e => setCSigugun(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-300">
                      <option value="">시/군/구</option>{Object.keys(REGION_DATA[cSido] || {}).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="relative w-full text-left">
              <input 
                type="text" 
                disabled={isCareLooking} 
                placeholder={isCareLooking ? "알아보는 중입니다" : "조리원명 검색 (예: 트리니티)"} 
                value={careSearchTerm} 
                onChange={e => handleCareSearch(e.target.value)} 
                onFocus={() => setIsCareFocused(true)}
                onBlur={() => setTimeout(() => setIsCareFocused(false), 200)}
                className={`w-full p-4 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-300 transition-colors ${isCareLooking ? 'bg-gray-100 text-gray-400' : 'bg-gray-50'}`}
              />
              
              {/* 🔥 리스트를 '알아보는 중' 체크박스 위로 올리고 absolute를 제거! */}
              {careHospitals.length > 0 && !selectedCare && !isCareLooking && (
                <div className="w-full bg-white border border-gray-200 rounded-xl mt-2 shadow-inner max-h-48 overflow-y-auto">
                  {careHospitals.map(h => (
                    <div key={h.id} onClick={() => { setSelectedCare(h); setCareSearchTerm(h.name); setCareHospitals([]); }} className="p-4 hover:bg-emerald-50 border-b last:border-0 cursor-pointer">
                      <p className="font-bold text-sm text-gray-800">{h.name}</p>
                      <p className="text-[11px] text-gray-400">{h.address}</p>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-1.5 cursor-pointer mt-3 ml-1 mb-2 w-fit">
                <input type="checkbox" checked={isCareLooking} onChange={e => { setIsCareLooking(e.target.checked); if(e.target.checked) { setSelectedCare(null); setCareSearchTerm(''); } }} className="w-4 h-4 accent-emerald-500"/>
                <span className="text-[11px] font-bold text-gray-600">아직 알아보고 있어요</span>
              </label> 

              {selectedCare && !isCareLooking && (
                <div className="mt-3 animate-fade-in border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-emerald-50 p-3 flex justify-between items-center border-b border-emerald-100">
                    <div>
                        <p className="text-sm font-bold text-gray-900">{selectedCare.name}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{selectedCare.address}</p>
                    </div>
                    <button onClick={() => { setSelectedCare(null); setCareSearchTerm(''); }} className="text-[10px] text-gray-400 underline shrink-0 whitespace-nowrap ml-2">다른 조리원 찾기</button>
                  </div>
                  <div className="h-32 w-full bg-gray-100 relative z-0">
                    <KakaoMapWrapper address={selectedCare.address} name={selectedCare.name} />
                  </div>
                </div>
              )}
            </div>
            
            {/* ✅ 4. 조리원을 선택했거나 OR 알아보고 있어요 체크 시에만 버튼 핑크색 활성화! */}
            <button disabled={!isCareLooking && !selectedCare} onClick={handleCareSubmit} className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl text-sm disabled:bg-gray-300 shadow-md mt-4 transition-colors">공유 완료하고 랭킹 보기 🚀</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}; // 🔥 여기서 로그인 전용 컴포넌트 끝!

// 🔥 2-3. 진짜 LocalMomsSection (여기서 분기 처리만 깔끔하게 담당합니다!)
const LocalMomsSection = (props: any) => {
  if (!props.user) {
    return <LocalMomsSectionLoggedOut onLoginClick={props.onLoginClick} />;
  }
  return <LocalMomsSectionLoggedIn {...props} />;
};

// 🔥 [최종 업데이트] 40주 여정 (오류 완벽 해결본)
const MomJourneySection = ({ user, onUpdateUser, onLoginClick, onGoToMoms, onGoToMall, setMallSource, addToast, onGoToMustHave, onGoGarden }: any) => {
  const currentWeek = user ? calculatePregnancyWeek(user.dueDate) : 0;
  const isPreMom = user?.myHospitalName === '예비맘';
  const hasData = user && ((user.myHospitalName && user.dueDate) || user.myHospitalName === '예비맘');
  
  const [filter, setFilter] = useState<'주차별미션' | '아기발달' | '권장영양제' | '산모검사' | '아빠퀘스트'>('주차별미션');

  // 히든 미션 & 웰컴키트 폭죽 팝업용 상태
  const [showHiddenModal, setShowHiddenModal] = useState(false);
  const [isExploding, setIsExploding] = useState(false);

  // 🔥 [신규] 아빠 시뮬레이션용 상태 추가
  const [showSimModal, setShowSimModal] = useState(false);
  const [simActualDate, setSimActualDate] = useState(user?.actualDeliveryDate || '');
  const [simSkipCare, setSimSkipCare] = useState(user?.skipCareCenter || false);
  const [simEntryDate, setSimEntryDate] = useState(user?.careEntryDate || '');
  const [simExitDate, setSimExitDate] = useState(user?.careExitDate || '');
  const [showGovPopup, setShowGovPopup] = useState(false);
  const [showThermometerPopup, setShowThermometerPopup] = useState(false); // 🔥 온습도계 팝업 상태

  const completedList = user?.completedMissions ? user.completedMissions.split(',').filter(Boolean) : [];
  const registryItems = user?.registryItems ? user.registryItems.split('||').filter(Boolean) : [];
  const verifiedCats = user?.verifiedCategories ? user.verifiedCategories.split(',').filter(Boolean) : [];

  // 🔥 [핵심] 특수문자나 띄어쓰기 인식 오류 원천 차단! (키워드 포함 방식으로 개선)
  // 3. [복구] 40주 여정 동기화 로직 (터짐 방지 완벽 보호막 추가!)
  const checkAutoCompletion = (title: string) => {
    if (!user || !title) return false;
    try {
      const completedList = user.completedMissions ? String(user.completedMissions).split(',').filter(Boolean) : [];
      const registryItems = user.registryItems ? String(user.registryItems).split(',').filter(Boolean) : [];
      const verifiedCats = user.verifiedCategories ? String(user.verifiedCategories).split(',').filter(Boolean) : [];

      if (title.includes('태명')) return !!user.babyName && user.babyName !== '아직 고민중이에요';
      if (title.includes('국민행복카드')) return !!user.cardTestResult || !!user.cardRecommendation; // 🔥 신규 추가
      if (title.includes('산부인과')) return !!user.myHospitalName && user.myHospitalName !== '예비맘' && user.myHospitalName !== '알아보는 중';
      if (title.includes('태아보험')) return !!user.insCompany;
      if (title.includes('조리원')) return !!user.myCareCenter && user.myCareCenter !== '알아보는 중';
      if (title.includes('태교여행')) return !!user.myBabymoon;
      if (title.includes('도우미')) return completedList.includes('산후도우미 예약');
      if (title.includes('육아템')) return verifiedCats.length >= 3 || registryItems.length >= 5; 
      if (title.includes('아기 이름')) return !!user.realName && String(user.realName).startsWith('[확정]');
      if (title.includes('히든')) return completedList.includes('히든미션');
      return false;
    } catch (e) {
      console.error('퀘스트 체크 에러 방어 완료:', e);
      return false;
    }
  };

  const LOUNGE_JOURNEY_DATA = [
    { title: '태명 짓기', start: 1, end: 5, tab: 'babyname' },
    { title: '산부인과 결정', start: 5, end: 8, tab: 'hospital' },
    { title: '태아보험 가입', start: 8, end: 12, tab: 'insurance' },
    { title: '산후조리원 예약', start: 12, end: 16, tab: 'care' },
    { title: '튼살 관리 & 임부복', start: 16, end: 20, tab: 'maternity' },
    { title: '태교여행 계획', start: 20, end: 27, tab: 'babymoon' },
    { title: '산후도우미 예약', start: 28, end: 32, tab: 'helper' },
    { title: '출산·육아템 준비', start: 32, end: 38, tab: 'baby' },
    { title: '아기 이름 짓기', start: 34, end: 40, tab: 'realname' }
  ];
  const currentMissions = LOUNGE_JOURNEY_DATA.filter(m => m.start <= (currentWeek || 0) && m.end >= (currentWeek || 0));

  const WEEKLY_MISSIONS = ['태명 짓기', '국민행복카드 발급', '산부인과 결정', '태아보험 가입', '산후조리원 예약', '튼살 관리 & 임부복', '태교여행(베이비문) 계획', '산후도우미 예약', '출산·육아템 준비', '아기 이름 짓기', '🕵️‍♂️ 히든 미션을 찾아라!'];
  const clearedCount = WEEKLY_MISSIONS.filter(m => checkAutoCompletion(m)).length;
  const isAllWeeklyCleared = clearedCount === WEEKLY_MISSIONS.length;
  const isMallCleared = verifiedCats.length >= 3;

  const handleUnlockWelcomeKit = () => {
    if (!isAllWeeklyCleared || !isMallCleared) return;
    setIsExploding(true);
    addToast('info', '미션 올클리어 축하해요! 🎉 엄청난 선물을 열심히 기획 중이니 조금만 기다려주세요 (봄이옴 열일중 💦)');
    setTimeout(() => setIsExploding(false), 3000);
  };

  const completeHiddenMission = () => {
    // 1. 미션 완료 처리 (달성률 바에 즉시 반영됨!)
    if (!completedList.includes('히든미션')) {
      const newList = [...completedList, '히든미션'];
      onUpdateUser({ ...user, completedMissions: newList.join(',') });
      addToast('success', '히든 미션 완료! 웰컴키트에 한 발짝 다가갔어요 🎉');
    }
    setShowHiddenModal(false);

    // 2. 요청해주신 예스24 제휴 링크를 새 창으로 열기
    openExternalLink('https://newtip.net/click.php?m=yes24&a=A100702971&l=9999&l_cd1=3&l_cd2=0&tu=https%3A%2F%2Fm.yes24.com%2Fgoods%2Fdetail%2F257533');
  };

  const FILTER_DESCRIPTIONS = {
    '주차별미션': '✅ 임신부터 출산까지, 시기별로 잊지 말고 꼭 챙겨야 할 필수 미션들이에요.',
    '아기발달': '👼 우리 아기가 엄마 뱃속에서 매주 어떻게 쑥쑥 자라고 있는지 확인해 보세요.',
    '권장영양제': '💊 산모와 태아의 건강을 위해 꼭 챙겨 먹어야 하는 주차별 영양제 가이드입니다.',
    '산모검사': '🏥 시기별로 병원에서 진행되는 필수 산전 검사 일정과 목적을 미리 알아두세요.',
    '아빠퀘스트': '💪 든든한 남편이자 아빠가 되기 위해 시기별로 짝꿍을 위해 꼭 챙겨야 할 필수 퀘스트예요!'
  };

  const JOURNEY_DATA: any = {
    '주차별미션': [
      { title: '태명 짓기', start: 1, end: 5, desc: '우리아이의 첫 번째 이름, 예쁜 태명을 지어주세요.', tab: 'babyname', color: 'from-orange-300 to-orange-500' },
      { title: '국민행복카드 발급', start: 5, end: 7, desc: '임신 바우처 100만원 혜택! 나에게 딱 맞는 카드를 찾아보세요.', tab: 'happinesscard', color: 'from-blue-400 to-indigo-500' },
      { title: '산부인과 결정', start: 5, end: 8, desc: '안심하고 다닐 산부인과를 정하고 임신을 확인해요.', tab: 'hospital', color: 'from-orange-300 to-orange-500' },
      { title: '태아보험 가입', start: 8, end: 12, desc: '필수 특약 가입 시기! 늦지 않게 태아보험을 준비해요.', tab: 'insurance', color: 'from-orange-300 to-orange-500' },
      { title: '산후조리원 예약', start: 12, end: 16, desc: '인기 있는 조리원은 일찍 마감되니 서둘러 예약해요.', tab: 'care', color: 'from-orange-300 to-orange-500' },
      { title: '튼살 관리 & 임부복', start: 16, end: 20, desc: '배가 본격적으로 나오는 시기! 편안한 옷과 튼살크림을 꼼꼼히 발라요.', tab: 'maternity', color: 'from-orange-300 to-orange-500', noButton: true },
      { title: '태교여행(베이비문) 계획', start: 20, end: 27, desc: '컨디션이 가장 좋은 안정기! 무리하지 않는 선에서 힐링 여행을 다녀와요.', tab: 'babymoon', color: 'from-orange-300 to-orange-500' },
      { title: '산후도우미 예약', start: 28, end: 32, desc: '정부지원 바우처 신청 시기에 맞춰 좋은 이모님을 알아봐요.', tab: 'helper', color: 'from-orange-300 to-orange-500' },
      
      /* 🔥 히든 미션 위치 이동 & 주차 변경(30~35주) */
      { title: '🕵️‍♂️ 히든 미션을 찾아라!', start: 30, end: 35, desc: '아빠 퀘스트 탭 어딘가에 숨겨진 미션을 찾아 완수하세요!', crossTab: '아빠퀘스트', color: 'from-purple-500 to-indigo-600' },
      
      { title: '출산·육아템 준비', start: 32, end: 38, desc: '대형 가전부터 소모품까지 필수템 위주로 차근차근 준비해요.', isMall: true, mallAction: 'REGISTRY', color: 'from-orange-300 to-orange-500' },
      { title: '아기 이름 짓기', start: 34, end: 40, desc: '출생신고에 들어갈 평생 불릴 진짜 이름을 정해요.', tab: 'realname', color: 'from-orange-300 to-orange-500' }
    ],
    '아빠퀘스트': [
      { title: '집안일 100% 전담', start: 1, end: 40, desc: '무거운 짐 들기, 화장실 청소 등 힘쓰고 냄새나는 일은 무조건 아빠 몫이에요.', color: 'from-blue-400 to-blue-600' },
      { title: '산부인과 동행하기', start: 1, end: 40, desc: '검진 날엔 연차를 써서라도 함께 가서, 초음파로 아기를 만나고 설명을 같이 들어요.', color: 'from-blue-400 to-blue-600' },
      { title: '입덧 간식 셔틀', start: 6, end: 15, desc: '새벽이든 밤이든, 아내가 먹고 싶어 하는 음식을 즉각 대령하세요!', color: 'from-blue-400 to-blue-600' },
      { title: '매일 밤 튼살 크림 마사지', start: 16, end: 40, desc: '배가 나오며 허리가 아파요. 매일 밤 아내의 배와 다리를 부드럽게 마사지해 주세요.', color: 'from-blue-400 to-blue-600' },
      { title: '당근마켓 직거래 전담', start: 20, end: 35, desc: '유모차, 아기 침대 등 부피가 크고 무거운 육아템 중고 거래는 아빠가 다녀오세요.', color: 'from-blue-400 to-blue-600' },
      { title: '태담 동화 읽어주기', start: 20, end: 40, desc: '아기는 아빠의 중저음 목소리를 훨씬 더 잘 들어요. 매일 밤 5분씩 아기에게 동화책을 읽어주세요.', isHidden: true, color: 'from-blue-400 to-blue-600' },
      { title: '아빠 백일해 주사 맞기', start: 27, end: 36, desc: '신생아와 밀접 접촉하는 아빠는 백일해 예방접종이 필수예요.', color: 'from-blue-400 to-blue-600' },
      { title: '육아 가구 조립하기', start: 30, end: 35, desc: '아기 침대, 기저귀 갈이대 등 십자드라이버와 힘이 필요한 가구 조립을 전담해요.', color: 'from-blue-400 to-blue-600' },
      { title: '응급실·주차장 경로 파악', start: 35, end: 39, desc: '새벽 응급상황을 대비해 야간 응급실 위치와 주차장 최단 경로를 미리 숙지하세요.', color: 'from-blue-400 to-blue-600' },
      { title: '아빠용 출산 가방 싸기', start: 36, end: 39, desc: '보호자용 침구, 세면도구, 긴 줄 충전기 등 병원에서 아빠가 쓸 짐을 미리 챙겨두세요.', color: 'from-blue-400 to-blue-600' }
    ],
      // 🔥 [신규] D-Day 이후 실전 시뮬레이션용 3단계 분리 배열
    '아빠실전퀘스트': [
      { stage: 1, title: '입원 수속 및 동의 서명', desc: '진통 중인 아내를 대신해 입원 수속을 밟고, 각종 동의서를 꼼꼼히 읽고 서명하세요.' },
      { stage: 1, title: '신생아 첫 사진 & 양가 알리기', desc: '정신없이 누워있는 아내를 대신해, 갓 태어난 아기 사진/영상과 함께 양가 어른들께 출산 소식을 전해드려요.' },
      { stage: 1, title: '조리원·도우미 업체 연락', desc: '아기가 태어나면 미리 예약해 둔 산후조리원과 산후도우미 업체에 즉시 연락해 입소/시작 일자를 확정하세요.' },
      { stage: 1, title: '출생증명서 및 실비 서류 챙기기', desc: '퇴원할 때 병원에서 출생증명서를 꼭 발급받고(사진 찰칵!), 아내의 병원비/수술비 실비 청구용 서류도 잊지 말고 챙기세요.' },

      // 🔥 [신규 추가] 2단계: 아내 케어 및 실전 육아 훈련 미션
      { stage: 2, title: '💆‍♂️ 아내 젖몸살 마사지 & 멘탈 케어', desc: '미역국만 먹어 지친 아내를 다독여주세요. 특히 젖몸살로 가슴이 돌덩이처럼 뭉쳐 아파할 때, 부드럽게 가슴과 어깨 마사지를 해주세요.' },
      { stage: 2, title: '🍼 조리원 실전 아빠 수업 마스터', desc: '집에 가면 바로 실전입니다! 간호사님들께 신생아 안는 법, 기저귀 갈고 속싸개 싸는 법, 트림 시키는 법을 확실하게 전수받으세요.' },
      { stage: 2, title: '🍰 아내를 위한 특별 간식 조공', desc: '모유 수유와 유축으로 밤낮없이 고생하는 아내를 위해, 조리원 반입이 가능한 선에서 디카페인 커피나 좋아하는 간식을 깜짝 선물해 보세요!' },

      { stage: 2, title: '💰 행복출산 원스톱 서비스 신청', desc: '출생신고, 첫만남 바우처, 부모급여, 아동수당, 한전 전기요금 감면까지 한 번에 싹쓸이 신청하세요!', isGovPopup: true },
      { stage: 2, title: '보험 업데이트 (태아 & 자동차)', desc: '태아보험에 전화해 \'신생아\'로 등재하고, 아빠 자동차보험에 \'자녀 할인 특약\'을 추가해 보험료를 환급받으세요.' },
      { stage: 2, title: '아이사랑 어린이집 대기 걸기', desc: '상반기 출생이라면 스피드가 생명! 잊지 말고 \'아이사랑\' 앱에서 서둘러 어린이집 대기를 걸어두세요.' },
      { stage: 2, title: '아빠 회사 퀘스트 싹쓸이', desc: '회사에 배우자 출산휴가/육아휴직을 신청하고, 건강보험 피부양자 등록, 회사 복지포인트(출산지원금)를 확인해 생필품을 사두세요.' },
      { stage: 2, title: '예방접종 & 영유아 검진 알아보기', desc: '지역 보건소 혜택이나 근처 소아과를 알아보고 1차 영유아 검진과 예방접종(BCG 등) 일정을 미리 체크해 두세요.' },

      { stage: 3, title: '아기방 세팅 및 대청소 & 곰팡이 체크', desc: '스팀 대청소와 화장실 청소 완료! 커튼 뒤나 구석에 숨은 겨울철 곰팡이는 없는지 무조건 확인하고 박멸하세요.' },
      { stage: 3, title: '쾌적한 온습도 & 맘마존 세팅', desc: '실내 온도 21~24도, 습도 45~60% 맞추기! 분유포트는 45도로 데워두고, 세척해 둔 젖병과 홈캠 세팅을 끝내세요.', isThermometerPopup: true },
      { stage: 3, title: '육아템 실전 배치 완료', desc: '세탁해둔 손수건/옷 정리, 기저귀 갈이대에 기저귀 채우기, 아기 침대와 역류방지쿠션 등을 바로 쓸 수 있게 세팅해 두세요.' },
      { stage: 3, title: '차량 내부 세차 & 카시트 설치', desc: '조리원에서 아기를 안전하게 데려올 수 있도록 차량 내부 세차 후 뒷좌석에 카시트를 단단히 설치하세요.' }
    ],
    '권장영양제': [
      { title: '엽산', start: 1, end: 15, desc: '태아 신경관 결손 예방을 위해 필수예요.', color: 'from-green-300 to-green-500' },
      { title: '비타민D', start: 1, end: 40, desc: '칼슘 흡수와 뼈 형성을 도와줘요.', color: 'from-amber-300 to-amber-500' },
      { title: '유산균', start: 1, end: 40, desc: '임산부 면역력 증가와 변비 예방에 좋아요.', color: 'from-blue-300 to-blue-500' },
      { title: '오메가3', start: 16, end: 36, desc: '태아 두뇌 발달! (지혈을 위해 출산 한 달 전엔 중단해요)', color: 'from-cyan-300 to-cyan-500' },
      { title: '철분제', start: 16, end: 40, desc: '혈액량 증가로 인한 빈혈을 예방해요. (비타민C와 함께!)', color: 'from-rose-400 to-rose-600' },
      { title: '칼슘제', start: 20, end: 40, desc: '태아 골격 형성 (철분제와 최소 2시간 간격을 두고 드세요)', color: 'from-purple-300 to-purple-500' }
    ],
    '산모검사': [
      { title: '임신 확인 및 산전검사', start: 4, end: 7, desc: '초음파로 아기집을 확인하고 기본 혈액/소변 검사를 해요.', color: 'from-pink-300 to-pink-500' },
      { title: '1차 기형아 검사', start: 11, end: 13, desc: '태아 목투명대 두께를 측정해요.', color: 'from-pink-300 to-pink-500' },
      { title: '2차 기형아 검사', start: 15, end: 18, desc: '쿼드 검사로 염색체 이상 여부를 확인해요.', color: 'from-pink-300 to-pink-500' },
      { title: '정밀 초음파 검사', start: 20, end: 22, desc: '태아의 장기와 외형을 아주 정밀하게 확인해요.', color: 'from-pink-300 to-pink-500' },
      { title: '임당 검사 및 입체초음파', start: 24, end: 28, desc: '시약을 먹고 임신성 당뇨를 검사해요.', color: 'from-pink-300 to-pink-500' },
      { title: '막달 검사 (분만 준비)', start: 34, end: 36, desc: '심전도, 엑스레이 등으로 출산 가능 여부를 체크해요.', color: 'from-pink-300 to-pink-500' },
      { title: '태동 및 내진 검사', start: 37, end: 40, desc: '매주 병원에 방문해 출산 징후를 확인해요.', color: 'from-pink-300 to-pink-500' }
    ],
    '아기발달': [
      { title: '세포분열 및 아기집', start: 4, end: 5, desc: '초음파로 작고 귀여운 아기집이 보여요.', color: 'from-indigo-300 to-indigo-500' },
      { title: '심장박동 시작', start: 6, end: 7, desc: '콩닥콩닥! 우렁찬 심장 소리를 들을 수 있어요.', color: 'from-indigo-300 to-indigo-500' },
      { title: '귀여운 젤리곰 형태', start: 8, end: 10, desc: '팔다리가 뾱뾱 나와서 젤리곰처럼 보여요.', color: 'from-indigo-300 to-indigo-500' },
      { title: '성별 확인 시기', start: 12, end: 16, desc: '빠르면 12주, 보통 16주에 성별 힌트를 얻어요.', color: 'from-indigo-300 to-indigo-500' },
      { title: '첫 태동의 감동', start: 17, end: 20, desc: '뱃속에서 뽀글뽀글 거리는 첫 태동을 느껴요!', color: 'from-indigo-300 to-indigo-500' },
      { title: '청각 발달 (태교 시작)', start: 21, end: 24, desc: '엄마 아빠의 목소리를 듣고 기억할 수 있어요.', color: 'from-indigo-300 to-indigo-500' },
      { title: '눈뜨기 및 빛 감지', start: 25, end: 28, desc: '눈을 뜨고 양수 밖의 빛을 감지하기 시작해요.', color: 'from-indigo-300 to-indigo-500' },
      { title: '폭풍 성장 및 호흡 연습', start: 29, end: 40, desc: '피하지방이 붙고 세상에 나올 호흡 연습을 해요.', color: 'from-indigo-300 to-indigo-500' }
    ]
  };

  const renderJourneyItem = (item: any, idx: number, isHiddenArea: boolean = false) => {
    if (item.isDivider) {
      return (
        <div key={`divider-${idx}`} className="relative py-6 my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-dashed border-red-300"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-red-50 text-red-600 text-[11px] font-extrabold px-4 py-1.5 rounded-full border border-red-200 shadow-sm flex items-center gap-1.5">
              🚨 D-Day & 출산 직후 실전 미션
            </span>
          </div>
        </div>
      );
    }

    const leftPercent = Math.max(0, ((item.start - 1) / 40) * 100);
    const widthPercent = Math.min(100 - leftPercent, ((item.end - item.start + 1) / 40) * 100);
    const isCurrentActive = user && !isPreMom && currentWeek >= item.start && currentWeek <= item.end;
    const isDone = filter === '주차별미션' ? checkAutoCompletion(item.title) : false;

    return (
      <div key={idx} className={`relative ${isCurrentActive ? 'opacity-100' : 'opacity-80'} transition-opacity p-1.5`}>
        <div className="flex justify-between items-end mb-2 pr-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h4 className={`font-bold text-sm truncate ${isCurrentActive ? 'text-gray-900' : 'text-gray-700'} ${item.start === 40 ? 'text-red-700' : ''}`}>
              {item.title}
            </h4>
            {!isHiddenArea && filter === '아빠퀘스트' && item.isHidden && !completedList.includes('히든미션') && (
              <button onClick={() => setShowHiddenModal(true)} className="shrink-0 bg-yellow-100 text-yellow-700 border border-yellow-300 px-2 py-1 rounded-md text-[10px] font-black shadow-sm animate-bounce-short">❓히든</button>
            )}
            {!isHiddenArea && filter === '아빠퀘스트' && item.isHidden && completedList.includes('히든미션') && (
              <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200"><Check size={12}/> 완료</span>
            )}
          </div>
          <span className="shrink-0 ml-2 text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
            {item.start === 40 ? '출산 & 조리원' : `${item.start}주 ~ ${item.end}주`}
          </span>
        </div>
        
        <div className="relative w-full h-3 sm:h-4 mb-2">
          <div className="absolute inset-0 bg-gray-100 rounded-full shadow-inner overflow-hidden">
            <div className="absolute left-1/4 w-px h-full bg-white z-0 opacity-50"></div>
            <div className="absolute left-2/4 w-px h-full bg-white z-0 opacity-50"></div>
            <div className="absolute left-3/4 w-px h-full bg-white z-0 opacity-50"></div>
            <div className={`absolute h-full rounded-full ${isDone ? 'bg-emerald-200' : `bg-gradient-to-r ${item.color}`} z-10 transition-all duration-1000`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}></div>
          </div>
          
          {user && !isPreMom && currentWeek > 0 && currentWeek <= 40 && (
            <div className="absolute -top-1 -bottom-1 w-[2px] bg-gray-800 z-20 shadow-sm rounded-full pointer-events-none" style={{ left: `${(currentWeek / 40) * 100}%` }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-[2.5px] border-gray-800 rounded-full"></div>
            </div>
          )}
        </div>
        <p className={`text-xs leading-relaxed pl-1 ${isDone ? 'text-gray-400' : item.start === 40 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
          {item.desc}
        </p>

        {!isHiddenArea && filter === '주차별미션' && !item.noButton && (
          <div className="mt-2 pl-1">
            {isDone ? (
              <span className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm">
                미션 클리어 ✅
              </span>
            ) : (
              <button onClick={() => {
                if (item.isMall) {
                  if (setMallSource) setMallSource(item.mallAction);
                  if (onGoToMall) onGoToMall();
                } else if (item.crossTab) {
                  setFilter(item.crossTab);
                } else {
                  if (onGoToMoms) onGoToMoms(item.tab);
                }
              }} className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors shadow-sm">
                미션 수행하기 🚀
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // 🔥 신규 추가: 주차별 미션 달성률 계산 로직
  const expectedMissions = JOURNEY_DATA['주차별미션'].filter((m: any) => m.start <= currentWeek && m.title !== '🕵️‍♂️ 히든 미션을 찾아라!' && !m.noButton);
  const completedExpected = expectedMissions.filter((m: any) => checkAutoCompletion(m.title));
  const progressPct = expectedMissions.length === 0 ? 100 : Math.round((completedExpected.length / expectedMissions.length) * 100);
  
  let progressMsg = "";
  if (progressPct === 100) progressMsg = "훌륭해요! 주차에 맞게 완벽하게 준비하고 있어요 ✨";
  else if (progressPct >= 50) progressMsg = "잘하고 있어요! 남은 미션도 하나씩 클리어해봐요 🏃‍♀️";
  else progressMsg = "조금 더 힘내보세요! 맘's pick 데이터를 보고 같이 준비해볼까요? 🔥";

  const isMissionTab = filter === '주차별미션';
  const showFullList = !!user || isMissionTab;
  const visibleItems = showFullList ? JOURNEY_DATA[filter] : JOURNEY_DATA[filter].slice(0, 2);
  const hiddenItems = showFullList ? [] : JOURNEY_DATA[filter].slice(2);

  return (
    <>
    <section className="animate-fade-in px-4 sm:px-0 pb-10">
      
      {user && (
        hasData ? (
          <>
            {/* 🔥 [신규 추가] 40주 여정 상단 이벤트 배너 */}
            <div 
              onClick={onGoToMustHave}
              className="mb-4 relative overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-4 sm:p-5 shadow-sm cursor-pointer active:scale-95 transition-transform animate-fade-in"
            >
              <div className="relative z-10 flex flex-col justify-center">
                <span className="text-blue-100 text-[11px] font-semibold mb-1 tracking-tight">봄이옴이 드리는 선물</span>
                <h3 className="text-white text-base font-extrabold tracking-tight mb-0.5 drop-shadow-sm">무료 웰컴키트 정보 총정리</h3>
                <span className="text-blue-100 text-[10px] mt-1 font-medium">눌러서 바로 확인하기 &gt;</span>
              </div>
              <div className="absolute -right-3 -bottom-5 text-[80px] opacity-20 transform -rotate-12 pointer-events-none">🎁</div>
            </div>

            {/* 🚀 [쿠팡 배너] 모바일에서만 얇고 깔끔하게 노출 (PC 숨김) */}
            <div className="mt-4 flex flex-col items-center animate-fade-in w-full sm:hidden">
              <a href="https://link.coupang.com/a/d7mvpy" target="_blank" rel="noreferrer" className="block w-full hover:opacity-95 transition-opacity">
                <img 
                  src="https://ads-partners.coupang.com/banners/973731?subId=&traceId=V0-301-5f4982b43e2b4522-I973731&w=320&h=50" 
                  alt="국민육아템 특가" 
                  className="w-full h-auto min-h-[50px] object-cover rounded-2xl shadow-sm border border-gray-100" 
                />
              </a>
              <p className="text-[9px] text-gray-400 mt-2 opacity-70 font-light tracking-tighter text-center">
                ※ 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
              </p>
            </div>

            </> /* 🔥 에러의 원인! 이 닫는 태그를 빼먹었었습니다 ㅠㅠ */
        ) : (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-indigo-900 text-sm mb-1"><span className="animate-pulse">📝</span> 출산 예정일을 알려주세요!</h3>
              <p className="text-[11px] text-indigo-700 break-keep leading-snug">정보를 입력하시면 내 주차 위치가<br/>타임라인에 정확하게 표시됩니다!</p>
            </div>
            {/* 🔥 onClick 시 명확하게 'dashboard' 탭으로 이동하라고 지시합니다! */}
            <button onClick={() => onGoToMoms && onGoToMoms('dashboard')} className="shrink-0 bg-gray-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-sm hover:bg-black transition-transform active:scale-95">
              바로 등록 🚀
            </button>
          </div>
        )
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mb-4">
        {(['주차별미션', '아기발달', '권장영양제', '산모검사', '아빠퀘스트'] as const).map(f => (
          <button
            key={f} 
            onClick={() => setFilter(f)} 
            className={`relative px-4 py-2 rounded-full text-[11px] sm:text-xs font-bold border flex items-center shrink-0 transition-colors shadow-sm ${filter === f ? (f === '아빠퀘스트' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-rose-50 text-rose-600 border-rose-200') : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            {f === '주차별미션' ? '✅ 주차별 미션' : f === '아빠퀘스트' ? '💪 아빠 퀘스트' : f === '아기발달' ? '👼 아기 발달' : f === '권장영양제' ? '💊 권장 영양제' : '🏥 산모 검사'}
          </button>
        ))}
      </div>

      {/* 1. 필터 설명 박스 (가볍고 얇게 분리) */}
      <div className="bg-gray-50 px-4 py-3.5 rounded-xl border border-gray-200 shadow-sm mb-4 animate-fade-in">
        <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed font-medium break-keep">
          {FILTER_DESCRIPTIONS[filter]}
        </p>
      </div>

      {/* 2. 나의 40주 여정 현황 배너 (예쁜 단독 박스로 분리) */}
      {user && hasData && (
        <div className="bg-white px-5 py-5 rounded-2xl border border-gray-100 shadow-sm mb-5 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-rose-100">
              <span className="text-xl">{isPreMom ? '🌱' : '🏃‍♀️'}</span>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold">나의 40주 여정 현황</p>
              <p className="text-sm font-bold text-rose-600">
                {isPreMom ? '새 생명을 기다리며 준비 중이에요!' : `현재 ${currentWeek}주차 여정을 걷고 있어요!`}
              </p>
            </div>
          </div>
          
          {/* 주차별 미션일 때만 하단에 미션 달성률 게이지 표시 */}
          {filter === '주차별미션' && !isPreMom && (() => {
            // 🔥 전체 10개 미션 (히든 미션도 30주차에 시작하는 정규 미션 포함!)
            const totalMissions = JOURNEY_DATA['주차별미션'].length;
            
            // 현재 주차(currentWeek)에 도달한 권장 미션 개수 
            // (히든 미션을 뺄 필요가 없습니다! 30주가 넘으면 알아서 권장 범위에 들어옵니다)
            const expectedMissions = JOURNEY_DATA['주차별미션'].filter((m: any) => m.start <= currentWeek);
            
            const actualCount = clearedCount; // 상단에서 이미 계산한 전체 10개 중 내 완료 개수
            const expectedCount = expectedMissions.length;
            
            const actualPct = Math.min(100, Math.round((actualCount / totalMissions) * 100));
            const expectedPct = Math.min(100, Math.round((expectedCount / totalMissions) * 100));

            let progressMsg = "";
            if (actualCount >= expectedCount) progressMsg = "🎉 아주 훌륭해요! 권장 진도를 완벽하게 따라가고 있어요.";
            else progressMsg = "🔥 조금 더 힘내보세요! 맘's pick 데이터를 보고 같이 준비해볼까요?";

            return (
              <div className="pt-4 border-t border-gray-100 mt-4">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[11px] sm:text-xs font-bold text-gray-800">나의 40주 미션 달성률</span>
                  <div className="flex items-center gap-2">
                    {/* 🔥 100% 달성 시 웰컴키트 해제 버튼 노출 */}
                    {actualCount === totalMissions && (
                      <button onClick={() => document.getElementById('welcome-kit-section')?.scrollIntoView({ behavior: 'smooth' })} className="bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-bounce shadow-sm flex items-center gap-1">
                        🎁 웰컴키트 열러 가기
                      </button>
                    )}
                    <span className="text-[10px] font-bold text-rose-600">{actualCount} / {totalMissions} 완료 <span className="text-gray-400 ml-1">({actualPct}%)</span></span>
                  </div>
                </div>
                
                {/* 🔥 이중 게이지 바 (러닝 맘 아이콘 적용) */}
                <div className="relative w-full h-3 bg-gray-100 rounded-full mt-6 mb-2 shadow-inner">
                   <div className="absolute top-0 left-0 h-full bg-rose-100 rounded-full transition-all duration-1000" style={{ width: `${expectedPct}%` }}></div>
                   <div className="absolute top-0 left-0 h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${actualPct}%` }}>
                     {actualPct > 0 && actualPct < 100 && (
                       <div className="absolute right-0 -top-5 translate-x-1/2 text-sm animate-bounce drop-shadow-md z-10">
                         <div style={{ transform: 'scaleX(-1)' }}>🏃‍♀️</div>
                       </div>
                     )}
                   </div>
                </div>
                
                <div className="flex justify-between items-start mt-2">
                   <p className="text-[10px] font-bold text-gray-500 break-keep">{progressMsg}</p>
                   <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold shrink-0 ml-2">
                     <span className="flex items-center gap-0.5"><div className="w-2 h-2 bg-rose-100 rounded-sm"></div> 현재 권장</span>
                     <span className="flex items-center gap-0.5"><div className="w-2 h-2 bg-rose-500 rounded-sm"></div> 내 진도</span>
                   </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 3. 나의 현재 주차 위치 (기존 위치 핀) */}
      {user && hasData && !isPreMom && currentWeek > 0 && currentWeek <= 40 && (
        <div className="flex items-center justify-end gap-1.5 mb-3 px-1 animate-fade-in">
          <div className="relative w-2.5 h-4 flex justify-center items-center">
            <div className="w-0.5 h-full bg-gray-800 rounded-full"></div>
            <div className="absolute top-0 w-2 h-2 bg-white border-2 border-gray-800 rounded-full"></div>
          </div>
          <span className="text-[10px] font-bold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md shadow-sm border border-gray-200">나의 현재 주차 위치</span>
        </div>
      )}

      {!user && isMissionTab && (
        <div className="mb-5 animate-fade-in">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <span className="absolute -right-4 -top-2 text-6xl opacity-20">🎁</span>
            <div className="relative z-10">
              <h4 className="font-extrabold text-orange-900 text-[15px] sm:text-base mb-2 tracking-tight">
                아래 퀘스트, 어떻게 할지 막막하신가요?
              </h4>
              <p className="text-xs text-orange-800/80 mb-5 leading-relaxed break-keep font-medium">
                로그인을 하시면 <b>각 미션별 중요 가이드</b>와<br/>
                <b>내 동네 예비맘들의 실제 선택 데이터</b>를 한눈에 보실 수 있어요!
              </p>
              <button onClick={onLoginClick} className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-black flex items-center justify-center gap-2 shadow-sm hover:brightness-95 transition-all text-sm">
                <MessageCircle size={18} fill="currentColor" /> 카카오톡으로 3초 만에 확인하기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
        
        <div className="space-y-6 relative z-10">
          {visibleItems.map((item: any, idx: number) => renderJourneyItem(item, idx, false))}
        </div>

        {hiddenItems.length > 0 && (
          <div className="relative mt-4">
            <div className="space-y-6 opacity-60 blur-[3px] pointer-events-none select-none">
              {hiddenItems.slice(0, 4).map((item: any, idx: number) => renderJourneyItem(item, idx + 2, true))}
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/50 to-white/95 flex flex-col justify-center items-center z-30 pt-10">
              <div className="bg-white/95 p-6 rounded-3xl border border-gray-200 shadow-xl text-center w-[90%] max-w-[300px] backdrop-blur-md animate-fade-in mt-10">
                <span className="text-3xl block mb-3">🔒</span>
                <h4 className="font-extrabold text-gray-900 text-[15px] mb-2 tracking-tight">이후의 40주 여정이 궁금하신가요?</h4>
                <p className="text-xs text-gray-500 mb-5 leading-relaxed break-keep">
                  로그인하고 아빠 퀘스트, 권장 영양제 등<br/><b>전체 40주 가이드 데이터</b>를 확인해보세요!
                </p>
                <button onClick={onLoginClick} className="w-full py-3.5 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm hover:brightness-95 transition-all text-sm">
                  <MessageCircle size={18} fill="currentColor" /> 로그인하고 전체 확인하기
                </button>
              </div>
            </div>
          </div>
        )}
      
        {/* 🔥 [신규] 아빠 퀘스트 실전 시뮬레이션 영역 (넓은 하얀 배경 버전) */}
        {filter === '아빠퀘스트' && user && (
          <div className="mt-10 pt-8 border-t-2 border-dashed border-blue-200 animate-fade-in">
            <div className="flex flex-col mb-6">
              <div className="flex justify-center mb-4">
                <span className="bg-blue-50 text-blue-600 text-[11px] font-extrabold px-4 py-1.5 rounded-full border border-blue-200 shadow-sm">
                  🚨 D-Day & 출산 직후 실전 미션
                </span>
              </div>
              
              {!user?.actualDeliveryDate ? (
                <div className="text-center px-2">
                  <h3 className="text-lg font-black text-gray-900 mb-2 tracking-tight">출산 직후, 아빠는 무엇을 해야 할까요?</h3>
                  <p className="text-[12px] text-gray-500 mb-5 break-keep leading-relaxed font-medium">
                    출산(예정)일을 입력하시면, 병원/조리원 체류 날짜에 맞춰 지금 당장 마무리해야 할 미션과 <b>정확한 실전 타임라인</b>을 띄워드려요!
                  </p>
                  <button onClick={() => setShowSimModal(true)} className="w-full max-w-sm mx-auto py-4 bg-gray-900 text-white font-black rounded-xl shadow-md hover:bg-black transition-transform active:scale-95 flex justify-center items-center gap-2">
                    <span className="animate-bounce-short">🎮</span> 실제 출산일 넣고 아빠 퀘스트 시뮬레이션!
                  </button>
                </div>
              ) : (
                <div className="w-full text-left">
                  <div className="flex justify-between items-center mb-5 px-1">
                    <h3 className="text-[15px] sm:text-base font-black text-gray-900 flex items-center gap-1.5 tracking-tight">
                      <span className="text-xl">⏱️</span> 아빠 실전 타임라인
                    </h3>
                    <button onClick={() => setShowSimModal(true)} className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200 shadow-sm hover:bg-gray-100 transition-colors flex items-center gap-1">
                      일정 수정 ✏️
                    </button>
                  </div>

                  {/* 1. 상단 동적 타임라인 바 */}
                  {(() => {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const deliveryDate = new Date(user.actualDeliveryDate);
                    deliveryDate.setHours(0,0,0,0);
                    
                    const entryDate = user.careEntryDate ? new Date(user.careEntryDate) : deliveryDate;
                    // 조리원을 안 가면 입소일(퇴원일)이 곧 퇴소일이 됨
                    const exitDate = user.skipCareCenter ? entryDate : (user.careExitDate ? new Date(user.careExitDate) : entryDate);
                    
                    const totalDuration = Math.max(1, exitDate.getTime() - deliveryDate.getTime());
                    let progressPct = 0;
                    let currentStatus = "";

                    if (today < deliveryDate) {
                      const daysLeft = Math.ceil((deliveryDate.getTime() - today.getTime())/(1000*3600*24));
                      currentStatus = `👶 출산까지 D-${daysLeft}`;
                      progressPct = 5; 
                    } else if (today >= deliveryDate && today < entryDate) {
                      const day = Math.floor((today.getTime() - deliveryDate.getTime())/(1000*3600*24)) + 1;
                      currentStatus = `🏥 병원 입원 ${day}일차`;
                      progressPct = ((today.getTime() - deliveryDate.getTime()) / totalDuration) * 100;
                    } else if (!user.skipCareCenter && today >= entryDate && today <= exitDate) {
                      const day = Math.floor((today.getTime() - entryDate.getTime())/(1000*3600*24)) + 1;
                      currentStatus = `🏢 조리원 입소 ${day}일차`;
                      progressPct = ((today.getTime() - deliveryDate.getTime()) / totalDuration) * 100;
                    } else {
                      currentStatus = "🏡 웰컴 홈! 실전 육아 시작";
                      progressPct = 100;
                    }

                    const midPct = user.skipCareCenter ? null : ((entryDate.getTime() - deliveryDate.getTime()) / totalDuration) * 100;

                    return (
                      <div className="mb-8 animate-fade-in px-2 sm:px-1">
                        <div className="flex justify-between items-end mb-3">
                          <p className="text-[11px] font-bold text-blue-600">나의 현재 위치</p>
                          <h4 className="font-black text-gray-900 text-sm">{currentStatus}</h4>
                        </div>
                        
                        {/* 0-40주 형태를 응용한 3-Step 노드형 게이지 바 */}
                        <div className="relative w-full h-2.5 sm:h-3 bg-gray-100 rounded-full overflow-visible shadow-inner mb-2">
                          {/* 배경 점(노드) */}
                          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-3 h-3 bg-blue-200 rounded-full z-0"></div>
                          {!user.skipCareCenter && midPct !== null && (
                            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-200 rounded-full z-0" style={{ left: `${midPct}%`, transform: 'translate(-50%, -50%)' }}></div>
                          )}
                          <div className="absolute top-1/2 -translate-y-1/2 right-0 w-3 h-3 bg-gray-200 rounded-full z-0"></div>

                          {/* 색상이 채워지는 게이지 */}
                          <div className={`absolute top-0 left-0 h-full transition-all duration-1000 rounded-full z-10 ${user.skipCareCenter ? 'bg-gradient-to-r from-rose-400 to-red-500' : 'bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-500'}`} style={{ width: `${Math.max(3, Math.min(100, progressPct))}%` }}>
                            
                            {/* 🏃‍♂️ 러닝 마커 (좌우반전 적용: style로 scaleX) */}
                            {progressPct < 100 && (
                              <div className="absolute right-0 -top-5 translate-x-1/2 text-base sm:text-lg drop-shadow-md z-20">
                                <div style={{ transform: 'scaleX(-1)' }}>🏃‍♂️</div>
                              </div>
                            )}
                            {progressPct >= 100 && (
                              <div className="absolute right-0 -top-5 translate-x-1/2 text-base sm:text-lg drop-shadow-md z-20">
                                🎉
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between relative mt-2 px-0.5">
                          <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">출산</span>
                          {!user.skipCareCenter && midPct !== null && (
                            <span className="text-[9px] text-gray-400 font-bold absolute whitespace-nowrap" style={{ left: `${midPct}%`, transform: 'translateX(-50%)' }}>조리원 입소</span>
                          )}
                          <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">퇴원(집)</span>
                        </div>

                        {/* 조리원 생략 시 경고 배너 */}
                        {user.skipCareCenter && (
                          <div className="mt-5 bg-red-50 border border-red-200 p-3.5 rounded-xl shadow-sm animate-pulse text-left relative overflow-hidden">
                            <div className="absolute -right-2 -top-2 text-4xl opacity-10 pointer-events-none">🚨</div>
                            <p className="text-[11px] sm:text-xs font-bold text-red-600 leading-relaxed break-keep relative z-10">
                              🚨 [긴급] 조리원 기간이 생략되었습니다!<br/>
                              아내와 아기가 곧바로 집에 오기 때문에, 아래의 행정/서류 미션과 집안 세팅 미션을 <span className="underline underline-offset-2">퇴원 전까지 모두 완료</span>해야 합니다!
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* 2. 테마별 넓은 미션 리스트 (모바일 공간 100% 활용) */}
                  <div className="w-full text-left space-y-6 relative px-0 sm:px-1">
                    {/* 🔥 컴퓨터(PC)에서만 보이는 왼쪽 타임라인 보조선 */}
                    <div className="hidden sm:block absolute left-[15px] top-4 bottom-4 w-px bg-gray-100 z-0"></div>
                    
                    {[1, 2, 3].map(stage => {
                      const stageItems = JOURNEY_DATA['아빠실전퀘스트'].filter((i:any) => i.stage === stage);
                      
                      let stageTitle = '';
                      let stageColor = '';
                      let mobileBorderColor = '';
                      
                      if (stage === 1) {
                         stageTitle = '🏥 [1단계] 입원/퇴원 (아내 회복 집중)';
                         stageColor = 'bg-pink-500';
                         mobileBorderColor = 'border-l-pink-400';
                      } else if (stage === 2) {
                         stageTitle = '🏢 [2단계] 조리원 기간 (아내 케어 & 실전 훈련!)'; // 타이틀 변경!
                         stageColor = 'bg-blue-500';
                         mobileBorderColor = 'border-l-blue-400';
                      } else {
                         stageTitle = '🏡 [3단계] 웰컴 홈 (아기 맞이 세팅)';
                         stageColor = 'bg-emerald-500';
                         mobileBorderColor = 'border-l-emerald-400';
                      }
                      
                      const isUrgent = user.skipCareCenter && stage >= 2;

                      return (
                        <div key={stage} className="relative z-10 animate-fade-in">
                          {/* 테마 제목 (모바일은 좌측 여백 축소) */}
                          <div className="flex items-center gap-2 sm:gap-3 mb-3 bg-white py-1">
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-white text-[9px] sm:text-[10px] font-bold shadow-sm ring-4 ring-white shrink-0 ${stageColor}`}>{stage}</div>
                            <h4 className={`font-extrabold text-[13px] sm:text-sm tracking-tight ${isUrgent ? 'text-red-700' : 'text-gray-800'}`}>{stageTitle}</h4>
                            <div className="flex-1 h-px bg-gray-100"></div>
                          </div>
                          
                          {/* 미션 카드들 (모바일은 좌측 선을 박스 테두리로 합침!) */}
                          <div className="pl-0 sm:pl-9 space-y-3">
                            {stageItems.map((item: any, idx: number) => (
                              <div key={idx} className={`p-3.5 rounded-xl border transition-all shadow-sm ${isUrgent ? 'border-red-100 bg-red-50/40 border-l-[4px] border-l-red-400 sm:border-l-[1px] sm:border-l-red-100' : `border-gray-100 bg-white hover:border-gray-300 border-l-[4px] ${mobileBorderColor} sm:border-l-[1px] sm:border-l-gray-100`}`}>
                                <div className="flex justify-between items-start mb-1.5">
                                  <h5 className={`font-bold text-[12px] sm:text-[13px] ${isUrgent ? 'text-red-900' : 'text-gray-800'}`}>{item.title}</h5>
                                  {item.isGovPopup && (
                                    <button onClick={() => setShowGovPopup(true)} className="shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1.5 rounded-md text-[10px] font-black shadow-sm transition-transform active:scale-95 ml-2">미션 수행 🚀</button>
                                  )}
                                  {/* 🔥 온습도계 비교 팝업 띄우기 버튼 */}
                                  {item.isThermometerPopup && (
                                    <button onClick={() => setShowThermometerPopup(true)} className="shrink-0 bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1.5 rounded-md text-[10px] font-black shadow-sm transition-transform active:scale-95 ml-2">국민템 비교 🛒</button>
                                  )}
                                </div>
                                <p className={`text-[11px] leading-relaxed break-keep ${isUrgent ? 'text-red-700/80' : 'text-gray-500'}`}>{item.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🎁 [대망의 웰컴키트 영역] */}
      {filter === '주차별미션' && user && (
        <div id="welcome-kit-section" className="mt-8 scroll-mt-20">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden text-center z-10">
            {isExploding && <div className="absolute inset-0 z-0 flex items-center justify-center text-6xl animate-ping">🎉🎊🎁✨</div>}
            
            <div className="relative z-10">
              {/* 🔥 버튼 우측 상단으로 이동 */}
              {!isMallCleared && (
                <button onClick={() => { 
                  if (setMallSource) setMallSource('VERIFY'); 
                  if (onGoToMall) onGoToMall(); 
                }} className="absolute -top-2 -right-2 sm:top-0 sm:right-0 text-[10px] bg-rose-500 text-white px-3 py-1.5 rounded-full font-bold shadow-md animate-pulse z-20">
                  구매인증 하러가기 🚀
                </button>
              )}

              <div className="text-4xl mb-3 mt-2">{isAllWeeklyCleared && isMallCleared ? '🎁' : '🔒'}</div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight">
                봄이옴 출산 웰컴키트 <span className="text-yellow-400 text-[11px] ml-1 tracking-normal font-bold align-middle">(오픈 준비 중 🚧)</span>
              </h3>
              
              <div className="text-xs text-gray-400 mb-6 break-keep leading-relaxed">
                <p className="mb-4">
                  주차별 미션을 모두 완료하고 봄이옴 몰에서 구매인증을 완료하시면 출산 웰컴키트를 드리려고 해요. <b>열심히 준비 중</b>이에요! (봄이옴 열일중 🏃‍♀️💨)
                </p>
                {/* 🔥 가이드를 박스 안쪽으로 합침 */}
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl text-left text-[11px] text-gray-300 leading-relaxed">
                  <span className="text-rose-400 font-bold block mb-1">🚀 웰컴키트 해제 가이드</span>
                  • 각 항목의 <b>[미션 수행하기]</b>를 눌러 미션을 완료해요.<br/>
                  • 40주 미션을 모두 완료하고 <b>봄이옴 몰에서 구매인증(3건)</b>을 마치면 자물쇠가 열립니다!
                </div>
              </div>

              <div className="bg-white/10 p-4 sm:p-5 rounded-2xl border border-white/10 text-left space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className={`text-[13px] font-bold flex items-center gap-2 ${isAllWeeklyCleared ? 'text-emerald-400' : 'text-white'}`}>
                    {isAllWeeklyCleared ? <CheckCircle2 size={16}/> : <div className="w-3.5 h-3.5 border-2 border-gray-400 rounded-full"/>} 
                    1단계: 40주 미션 올클리어
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold bg-white/10 px-2 py-1 rounded">{clearedCount} / {WEEKLY_MISSIONS.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[13px] font-bold flex items-center gap-2 ${isMallCleared ? 'text-emerald-400' : 'text-white'}`}>
                    {isMallCleared ? <CheckCircle2 size={16}/> : <div className="w-3.5 h-3.5 border-2 border-gray-400 rounded-full"/>} 
                    2단계: 봄이옴 몰 구매 인증
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold bg-white/10 px-2 py-1 rounded">{verifiedCats.length} / 3</span>
                </div>
              </div>

              {isAllWeeklyCleared && isMallCleared ? (
                <button onClick={handleUnlockWelcomeKit} className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-black text-[15px] shadow-[0_0_20px_rgba(254,229,0,0.4)] hover:scale-105 transition-transform flex items-center justify-center gap-2">
                  <Unlock size={18}/> 미션 올클리어! (선물 기획 중 🎁)
                </button>
              ) : (
                <button disabled className="w-full py-4 bg-gray-700 text-gray-500 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                  <Lock size={14}/> 예쁜 선물을 꽉꽉 채워 기획하고 있어요!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 [추가] 40주 여정 띠 배너 광고 삽입 (남편 공유 버튼 바로 위!) */}
      <KakaoAdBanner unit="DAN-robYqaZIrYR9cB6k" width="320" height="100" />

      {user && (
        <div className="mt-6 animate-fade-in">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 sm:p-6 rounded-3xl border border-blue-100 text-center shadow-sm relative overflow-hidden">
            <span className="absolute -left-3 -bottom-3 text-6xl opacity-20 transform -rotate-12">💌</span>
            <div className="relative z-10">
              <h4 className="font-extrabold text-blue-900 text-[15px] sm:text-base mb-2 tracking-tight">남편과 이 40주 여정을 함께할까요?</h4>
              <p className="text-xs text-blue-800/80 mb-5 leading-relaxed break-keep font-medium">
                캡처 대신 링크로 싹- 편하게 공유해 보세요!<br/>남편도 <b>'아빠 퀘스트'</b>를 보며 든든하게 준비할 수 있어요.
              </p>
              <button 
                onClick={() => {
                  const kakao = (window as any).Kakao;
                  
                  // 1. 카카오 스크립트 자체가 안 불러와졌을 때만 튕겨냄
                  if (!kakao) {
                    addToast('error', '카카오 도구를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
                    return;
                  }

                  // 2. 🚨 핵심: 자동 로그인 유저를 위해 여기서도 초기화를 강제로 해줍니다!
                  if (!kakao.isInitialized()) {
                    kakao.init('cef1d01b84acf6b64cabac2fc6c3df18');
                  }

                  // 3. 무조건 초기화가 보장되므로 시원하게 쏩니다!
                  kakao.Share.sendCustom({
                    templateId: 132064,
                    templateArgs: {
                      PARTNER_ID: user.id
                    }
                  });
                }}
                className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-black flex items-center justify-center gap-2 shadow-sm hover:brightness-95 transition-all text-sm"
              >
                <MessageCircle size={18} fill="currentColor" /> 남편에게 카톡으로 초대장 보내기 💌
              </button>
            </div>
          </div>
        </div>
      )}
    </section>

    {/* 🔥 팝업을 섹션 밖으로 빼내서 음영과 위치 버그 완벽 해결 */}
    {showHiddenModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
          <span className="text-5xl mb-4 block">📖</span>
          <h3 className="text-xl font-black text-gray-900 mb-3">히든 미션 발견!</h3>
          <p className="text-[13px] text-gray-600 leading-relaxed mb-6 break-keep bg-rose-50 p-4 rounded-xl border border-rose-100">
            아빠의 묵직한 중저음 목소리는 양수를 뚫고 태아에게 가장 잘 전달된대요! 아빠가 읽어주는 동화책은 최고의 태교랍니다. 🥰<br/><br/>
            {/* 🔥 세 줄로 분리하고 간격을 살짝 주었습니다 */}
            <span className="text-[10px] text-gray-400 flex flex-col gap-0.5">
              <span>* 집에 있는 책을 읽어주셔도 좋아요.</span>
              <span>* 링크에 접속하면 미션이 완료됩니다!</span>
              <span className="text-[9px] text-gray-400 mt-1 opacity-80">
                ※ 제휴마케팅이 포함된 광고로 커미션을 지급 받습니다.
              </span>
            </span>
          </p>
          <button onClick={completeHiddenMission} className="w-full py-4 bg-rose-500 text-white font-bold rounded-xl shadow-md mb-3 hover:bg-rose-600 transition-colors">
            태담 동화책 준비하기 🚀
          </button>
          <button onClick={() => setShowHiddenModal(false)} className="text-[11px] text-gray-400 underline hover:text-gray-600">다음에 할게요</button>
        </div>
      </div>
    )}

    {/* 🔥 [신규] 아빠 시뮬레이션 날짜 입력 모달 */}
    {showSimModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full relative shadow-2xl">
          <button onClick={() => setShowSimModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <h3 className="text-xl font-black text-gray-900 mb-2 flex items-center gap-2">🎮 실전 일정 세팅</h3>
          <p className="text-xs text-gray-500 mb-6 break-keep">실제 출산일과 퇴소일을 입력하면<br/>맞춤형 아빠 퀘스트가 생성됩니다!</p>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">출산(예정)일</label>
              <input type="date" value={simActualDate} onChange={e=>setSimActualDate(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-300"/>
            </div>
            
            <div className="flex items-center gap-2 mt-2 bg-rose-50 p-3 rounded-xl border border-rose-100">
              <input type="checkbox" checked={simSkipCare} onChange={e=>setSimSkipCare(e.target.checked)} className="w-4 h-4 accent-rose-500 shrink-0"/>
              <span className="text-[11px] font-bold text-rose-700 tracking-tight">저희는 조리원에 안 가요! (바로 집으로 퇴원)</span>
            </div>

            {simSkipCare ? (
              <div className="animate-fade-in">
                <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">병원 퇴원일 (집에 오는 날)</label>
                <input type="date" value={simEntryDate} onChange={e=>setSimEntryDate(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-300"/>
              </div>
            ) : (
              <div className="flex gap-2 animate-fade-in">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">조리원 입소일</label>
                  <input type="date" value={simEntryDate} onChange={e=>setSimEntryDate(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-300"/>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-gray-600 mb-1.5 block">조리원 퇴소일</label>
                  <input type="date" value={simExitDate} onChange={e=>setSimExitDate(e.target.value)} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-300"/>
                </div>
              </div>
            )}
            
            <button onClick={() => {
              if(!simActualDate) { addToast('error', '출산일을 입력해주세요.'); return; }
              if(simSkipCare && !simEntryDate) { addToast('error', '병원 퇴원일을 입력해주세요.'); return; }
              if(!simSkipCare && (!simEntryDate || !simExitDate)) { addToast('error', '조리원 입소/퇴소일을 입력해주세요.'); return; }
              
              onUpdateUser({
                ...user,
                actualDeliveryDate: simActualDate,
                skipCareCenter: simSkipCare,
                careEntryDate: simEntryDate,
                careExitDate: simExitDate
              });
              setShowSimModal(false);
              addToast('success', '실전 시뮬레이션 세팅 완료! 🔥');
            }} className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl shadow-md hover:bg-blue-600 transition-colors mt-2">
              시뮬레이션 시작하기 🚀
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 🔥 [신규] 정부24 행복출산원스톱 이동 팝업 */}
    {showGovPopup && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
          <span className="text-5xl mb-4 block">💰</span>
          <h3 className="text-xl font-black text-gray-900 mb-3">행복출산 원스톱 서비스</h3>
          <p className="text-[13px] text-gray-600 leading-relaxed mb-6 break-keep bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-left">
            정부24 사이트에서 아래 혜택을 한 번에 신청할 수 있어요!<br/><br/>
            <span className="font-bold text-emerald-700">✓ 출생신고 & 가족관계증명서<br/>✓ 첫만남이용권 바우처<br/>✓ 부모급여 & 아동수당<br/>✓ 한전 전기요금 감면 (30%)</span>
          </p>
          <button onClick={() => {
            openExternalLink('https://www.gov.kr/portal/onestopSvc/happyBirth');
            setShowGovPopup(false);
          }} className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl shadow-md mb-3 hover:bg-emerald-600 transition-colors">
            정부24로 이동해서 신청하기 🚀
          </button>
          <button onClick={() => setShowGovPopup(false)} className="text-[11px] text-gray-400 underline hover:text-gray-600">다음에 할게요</button>
        </div>
      </div>
    )}

    {/* 🔥 [신규] 온습도계 팝업 (마더케이 vs 휴비딕) */}
    {showThermometerPopup && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-2xl">
          <button onClick={() => setShowThermometerPopup(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
          <span className="text-4xl mb-3 block">🌡️</span>
          <h3 className="text-[17px] font-black text-gray-900 mb-1 tracking-tight">실내 온습도계 국민템 2대장!</h3>
          <p className="text-[12px] text-gray-500 mb-5 break-keep">맘카페에서 가장 많이 추천하는 두 제품이에요.<br/>디자인을 보고 취향껏 골라보세요!</p>
          
          {/* iframe 좌우 나란히 배치 */}
          <div className="flex justify-center gap-4 mb-4">
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-gray-700 mb-2 bg-gray-100 px-2 py-1 rounded-md">마더케이</span>
              <iframe src="https://coupa.ng/clXZzt" width="120" height="240" frameBorder="0" scrolling="no" referrerPolicy="unsafe-url" className="rounded-xl shadow-md border border-gray-100"></iframe>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-gray-700 mb-2 bg-gray-100 px-2 py-1 rounded-md">휴비딕</span>
              <iframe src="https://coupa.ng/clXY6k" width="120" height="240" frameBorder="0" scrolling="no" referrerPolicy="unsafe-url" className="rounded-xl shadow-md border border-gray-100"></iframe>
            </div>
          </div>
          
          {/* 합법적 방어 문구 (아주 작고 연하게) */}
          <p className="text-[9px] text-gray-400 opacity-80 font-light tracking-tighter">
            ※ 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </p>
        </div>
      </div>
    )}

    </>
  );
};

// 🔥 [최종 완성] 봄이옴 몰 (레지스트리 5개 임무, 영수증 인증 업로드 포함)
const BomiomMallSection = ({ user, onUpdateUser, addToast, mallSource, onBack }: any) => {
  const currentWeek = user ? calculatePregnancyWeek(user.dueDate) : 0;
  const isPreMom = user?.myHospitalName === '예비맘';
  const [activeFilter, setActiveFilter] = useState<string>('전체');
  const [showRegistryModal, setShowRegistryModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedMallItem, setSelectedMallItem] = useState<any>(null);
  
  // 🔥 [추가] 몰 진입 시 미션 가이드 팝업 (mallSource가 REGISTRY로 넘어올 때만 켜짐)
  const [showMallGuide, setShowMallGuide] = useState(mallSource === 'REGISTRY');
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [verifyCategory, setVerifyCategory] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const registryItemsRaw = user?.registryItems || '';
  const registryItems = registryItemsRaw.split(',').filter(Boolean).map((s: string) => s.trim());
  const verifiedCats = user?.verifiedCategories ? user.verifiedCategories.split(',').filter(Boolean) : [];

  const handleToggleRegistry = (safeTitle: string) => {
    let newList;
    if (registryItems.includes(safeTitle)) {
      newList = registryItems.filter((i: string) => i !== safeTitle);
      addToast('info', '장바구니에서 뺐습니다.');
    } else {
      newList = [...registryItems, safeTitle];
      addToast('success', '🛒 장바구니에 쏙 담았어요!');
      if (newList.length === 5) {
        addToast('success', '🎉 축하합니다! 육아템 준비 미션 클리어!');
      }
    }
    onUpdateUser({ ...user, registryItems: newList.join(',') });
  };

  const handleUploadReceipt = async () => {
    if (!uploadFile || !verifyCategory) { addToast('error', '카테고리와 사진을 모두 등록해주세요!'); return; }
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `receipts/${user.id}_${Date.now()}_${uploadFile.name}`);
      await uploadBytes(storageRef, uploadFile);
      const url = await getDownloadURL(storageRef);

      await fetch(import.meta.env.VITE_GOOGLE_SHEET_API_URL, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({ type: 'VERIFY_RECEIPT', userId: user.id, nickname: user.nickname, category: verifyCategory, imageUrl: url })
      });

      const newCats = [...verifiedCats, verifyCategory];
      onUpdateUser({ ...user, verifiedCategories: newCats.join(',') });
      
      addToast('success', '📸 영수증 인증 완료! 웰컴키트에 한 발짝 다가갔어요!');
      setShowVerifyModal(false);
      setUploadFile(null);
      setVerifyCategory('');
    } catch (e) {
      addToast('error', '업로드 실패. 다시 시도해주세요.');
    } finally {
      setIsUploading(false);
    }
  };

  const FILTERS = ['전체', '산모 영양소 관리', '산모 필수품', '아빠 필수품', '육아용품 (대형/안전)', '육아용품 (의류/패브릭)', '육아용품 (가전)', '육아용품 (수유/위생)'];
  const MALL_ITEMS = [
    { id: 1, title: '엽산', start: 1, end: 15, desc: '태아 신경관 결손 예방을 위해 필수예요.', category: '산모 영양소 관리', icon: '💊' },
    { id: 2, title: '비타민D', start: 1, end: 40, desc: '칼슘 흡수와 뼈 형성을 도와줘요.', category: '산모 영양소 관리', icon: '☀️' },
    { id: 3, title: '유산균', start: 1, end: 40, desc: '임산부 면역력 증가와 변비 예방에 좋아요.', category: '산모 영양소 관리', icon: '🦠' },
    { id: 4, title: '입덧 캔디/간식', start: 6, end: 15, desc: '입덧 지옥을 버티게 해줄 새콤달콤 구원템!', category: '산모 필수품', icon: '🍬' },
    { id: 5, title: '오메가3', start: 16, end: 36, desc: '태아 두뇌 발달! (지혈을 위해 출산 한 달 전엔 중단해요)', category: '산모 영양소 관리', icon: '🐟' },
    { id: 6, title: '철분제', start: 16, end: 40, desc: '혈액량 증가로 인한 빈혈을 예방해요. (비타민C와 함께!)', category: '산모 영양소 관리', icon: '🩸' },
    { id: 8, title: '튼살 크림', start: 16, end: 40, desc: '배가 나오기 시작할 때 아침저녁으로 듬뿍 발라주세요.', category: '산모 필수품', icon: '🧴' },
    { id: 9, title: '튼살 오일', start: 16, end: 40, desc: '크림과 섞어 바르면 보습력이 2배로 올라가요.', category: '산모 필수품', icon: '💧' },
    { id: 10, title: '임산부 속옷', start: 16, end: 40, desc: '가슴과 배를 압박하지 않는 편안한 심리스 소재가 좋아요.', category: '산모 필수품', icon: '🩱' },
    { id: 11, title: '임부복', start: 16, end: 40, desc: '조이지 않는 원피스나 임산부용 레깅스를 준비해요.', category: '산모 필수품', icon: '👗' },
    { id: 12, title: '칼슘제', start: 20, end: 40, desc: '태아 골격 형성 (철분제와 최소 2시간 간격을 두고 드세요)', category: '산모 영양소 관리', icon: '🦴' },
    { id: 13, title: '바디필로우', start: 20, end: 40, desc: '배가 불러 똑바로 눕기 힘들 때 수면의 질을 높여줘요.', category: '산모 필수품', icon: '🛌' },
    { id: 14, title: '태담 동화책', start: 20, end: 40, desc: '아빠의 중저음 목소리로 매일 밤 다정하게 읽어주세요.', category: '아빠 필수품', icon: '📖' },
    { id: 15, title: '유모차', start: 32, end: 38, desc: '가장 비싸고 배송이 오래 걸려요! 미리 시승해보고 결정하세요.', category: '육아용품 (대형/안전)', icon: '🛒' },
    { id: 16, title: '카시트', start: 32, end: 38, desc: '퇴원할 때 없으면 차에 태울 수 없어요. 안전제일 필수템!', category: '육아용품 (대형/안전)', icon: '💺' },
    { id: 17, title: '아기 침대', start: 32, end: 38, desc: '아기의 안전한 수면 공간과 엄마의 관절을 지켜줄 가구예요.', category: '육아용품 (대형/안전)', icon: '🛏️' },
    { id: 18, title: '기저귀 갈이대', start: 32, end: 38, desc: '하루 10번 넘게 기저귀를 갈아야 해요. 허리 보호 필수템!', category: '육아용품 (대형/안전)', icon: '🧺' },
    { id: 19, title: '아기 매트', start: 32, end: 38, desc: '층간 소음 방지 및 아기 안전을 위해 거실에 미리 깔아둬요.', category: '육아용품 (대형/안전)', icon: '🧩' },
    { id: 20, title: '아기 의자', start: 32, end: 38, desc: '이유식 시작할 때 바른 자세를 잡아주는 하이체어예요.', category: '육아용품 (대형/안전)', icon: '🪑' },
    { id: 21, title: '배냇저고리', start: 32, end: 38, desc: '신생아 체온 유지를 위한 첫 옷, 부드러운 순면으로 준비해요.', category: '육아용품 (의류/패브릭)', icon: '👕' },
    { id: 22, title: '손수건', start: 32, end: 38, desc: '수유, 침 닦기, 목욕 등 다다익선! 30~40장은 넉넉히 필요해요.', category: '육아용품 (의류/패브릭)', icon: '🧣' },
    { id: 23, title: '속싸개', start: 32, end: 38, desc: '모로반사를 막아 아기가 안정감 있게 푹 잘 수 있게 해줘요.', category: '육아용품 (의류/패브릭)', icon: '🌯' },
    { id: 24, title: '아기 이불', start: 32, end: 38, desc: '태열이 오르지 않도록 통기성이 좋은 얇은 소재가 좋아요.', category: '육아용품 (의류/패브릭)', icon: '🛌' },
    { id: 25, title: '젖병소독기', start: 32, end: 38, desc: '육아의 질을 수직 상승시켜주는 필수 맘마존 가전이에요.', category: '육아용품 (가전)', icon: '✨' },
    { id: 26, title: '분유포트', start: 32, end: 38, desc: '분유 타기 딱 좋은 온도로 물을 유지해 주는 효자 가전!', category: '육아용품 (가전)', icon: '🫖' },
    { id: 27, title: '홈캠', start: 32, end: 38, desc: '분리 수면을 하거나 집안일 할 때 아기 상태를 확인할 수 있어요.', category: '육아용품 (가전)', icon: '📷' },
    { id: 28, title: '가습기', start: 32, end: 38, desc: '신생아의 코와 목이 건조해지지 않도록 적정 습도를 유지해요.', category: '육아용품 (가전)', icon: '💨' },
    { id: 29, title: '젖병', start: 32, end: 38, desc: '배앓이 방지 기능이 있는 것으로 최소 4~6개 정도 미리 챙겨요.', category: '육아용품 (수유/위생)', icon: '🍼' },
    { id: 30, title: '기저귀', start: 32, end: 38, desc: '아기 피부에 직접 닿는 소모품! 신생아용으로 핫딜 때 쟁여요.', category: '육아용품 (수유/위생)', icon: '👶' },
    { id: 31, title: '물티슈', start: 32, end: 38, desc: '성분이 순하고 도톰한 평량의 물티슈를 박스째로 준비해요.', category: '육아용품 (수유/위생)', icon: '🧻' },
    { id: 32, title: '아기 욕조', start: 32, end: 38, desc: '씻는 용, 헹굼 용으로 2개가 필요해요. 물 빠짐 기능이 있으면 편해요.', category: '육아용품 (수유/위생)', icon: '🛁' },
    { id: 33, title: '바디워시', start: 32, end: 38, desc: '눈에 들어가도 따갑지 않은 탑투토(올인원) 워시를 추천해요.', category: '육아용품 (수유/위생)', icon: '🧼' },
    { id: 34, title: '세탁세제', start: 32, end: 38, desc: '잔여물이 남지 않는 순한 아기 전용 세탁 세제를 사용해요.', category: '육아용품 (수유/위생)', icon: '🧴' },
    { id: 35, title: '주방세제', start: 32, end: 38, desc: '젖병과 장난감을 씻을 때 쓸 1종 안심 세정제를 준비해요.', category: '육아용품 (수유/위생)', icon: '🧽' }
  ];

  const scrollToCategory = (categoryName: string) => {
    setActiveFilter(categoryName);
    if (categoryName === '전체') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const element = document.getElementById(`mall-cat-${categoryName}`);
    if (element) {
      const y = element.getBoundingClientRect().top + window.pageYOffset - 130;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const mallData = getMallItems() || [];

  // 🌟 1. 상품 상세 리스트 페이지 (오버레이)
  if (selectedMallItem) {
    const filteredProducts = mallData.filter((p: any) => p.subCategory === selectedMallItem.title && p.isActive !== 'X' && p.isActive !== 'x').sort((a: any, b: any) => a.rank - b.rank);
    // 🔥 [추가] 모달(팝업)이 하나라도 켜져 있는지 확인하는 변수 추가
    const isModalOpen = showRegistryModal || showVerifyModal;
    return (
      // 🔥 [핵심 수정] 평소에는 하단바(z-100) 밑인 z-[90]에 두고, 팝업이 켜지면 z-[150]으로 솟아올라 하단바를 완벽히 덮도록 수정!
      <div className={`fixed inset-0 bg-gray-50 flex flex-col animate-fade-in items-center ${isModalOpen ? 'z-[150]' : 'z-[90]'}`}>
        <header className="w-full border-b bg-white shadow-sm sticky top-0 z-10 flex justify-center">
          <div className="w-full max-w-5xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedMallItem(null)} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full"><ArrowLeft size={24} /></button>
              <h2 className="font-bold text-lg leading-tight text-gray-900">{selectedMallItem.icon} {selectedMallItem.title} 추천</h2>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                {mallSource === 'REGISTRY' && <div className="absolute -bottom-10 right-0 bg-gray-900 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-bounce shadow-lg after:content-[''] after:absolute after:-top-1 after:right-4 after:w-2 after:h-2 after:bg-gray-900 after:rotate-45">🛒 5개 담고 미션 완료!</div>}
                <button onClick={() => setShowRegistryModal(true)} className="relative p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition-colors">
                  <ShoppingCart size={20} className="text-gray-700"/>
                  {registryItems.length > 0 && <span className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white">{registryItems.length}</span>}
                </button>
              </div>
              <div className="relative">
                {mallSource === 'VERIFY' && <div className="absolute -bottom-10 right-0 bg-rose-500 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-bounce shadow-lg after:content-[''] after:absolute after:-top-1 after:right-4 after:w-2 after:h-2 after:bg-rose-500 after:rotate-45">📸 여기서 영수증 올려주세요!</div>}
                <button onClick={() => setShowVerifyModal(true)} className="bg-gray-900 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm hover:bg-black">
                  <Camera size={14}/> 구매인증
                </button>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto w-full flex justify-center">
          <div className="w-full max-w-5xl p-4 pb-24">
            <div className="mb-5">
              <p className="text-xs text-rose-700 bg-rose-50 p-4 rounded-xl shadow-sm border border-rose-100 leading-relaxed break-keep">
                💡 {selectedMallItem.desc}
              </p>
              <p className="text-[10px] text-gray-500 mt-2 px-1 break-keep leading-relaxed">
                * 해당 제품들은 네이버 쇼핑 커넥트 활동의 일환으로 판매 발생 시 수수료를 제공받아요. 가격 비교를 잘 해보면서 필요한 제품을 구입해보세요.
              </p>
            </div>
            <h3 className="font-bold text-gray-800 text-sm mb-3">🔥 봄이옴 추천 상품</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pb-32">
              {filteredProducts.length > 0 ? filteredProducts.map((prod: any, idx: number) => {
                // 🔥 상품명에 있는 쉼표(,)를 싹 제거해서 에러를 원천 차단합니다.
                const safeTitle = prod.title.replace(/,/g, '').trim();
                const isReg = registryItems.includes(safeTitle);
                return (
                  <div key={prod.id || idx} className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full hover:border-gray-300 transition-colors">
                    <div className="w-full aspect-square bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden relative mb-3">
                      {prod.imageUrl ? <img src={prod.imageUrl} alt={prod.title} className="w-full h-full object-cover" /> : <span className="text-3xl sm:text-4xl">{selectedMallItem.icon}</span>}
                    </div>
                    <div className="flex flex-col flex-1 justify-between min-w-0">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5 overflow-hidden">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm shrink-0 ${idx < 3 ? 'text-rose-500 bg-rose-50 border border-rose-100' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>{prod.badge || `${idx + 1}위`}</span>
                          <span className="text-[10px] text-gray-400 font-bold truncate">{prod.brand}</span>
                        </div>
                        <h4 className="font-bold text-xs sm:text-[13px] text-gray-800 line-clamp-2 leading-snug">{prod.title}</h4>
                        {prod.priceDesc && (
                          // 🔥 gap-1로 여백을 줄이고, 모바일에서 글자가 삐져나가지 않게 꽉 잡아줍니다.
                          <div className="flex items-baseline gap-1 sm:gap-1.5 mt-2 flex-wrap sm:flex-nowrap">
                            {prod.discountRate && <span className="text-rose-500 font-extrabold text-[11px] sm:text-sm">{prod.discountRate}%</span>}
                            
                            {/* 🔥 모바일 9px, PC 11px / 자간(tracking-tighter) 축소 / '원' 글자 제거로 공간 확보! */}
                            {prod.originalPrice && <span className="text-gray-400 text-[9px] sm:text-[11px] line-through tracking-tighter">{Number(prod.originalPrice).toLocaleString()}</span>}
                            
                            {/* 🔥 모바일 12px(xs), PC 16px(base)로 반응형 적용 */}
                            <span className="font-black text-gray-900 text-xs sm:text-base tracking-tight">{Number(prod.priceDesc).toLocaleString()}원</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        <button onClick={() => handleToggleRegistry(safeTitle)} className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 ${isReg ? 'bg-rose-50 text-rose-500 border-rose-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}><ShoppingCart size={14} className={isReg ? 'fill-rose-500 text-rose-500' : ''}/> {isReg ? '담음' : '담기'}</button>
                        <button onClick={() => window.open(prod.link, '_blank')} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-[11px] font-bold hover:bg-black transition-colors shadow-sm">보러가기</button>
                      </div>
                    </div>
                  </div>
                );
              }) : <div className="col-span-full py-12 text-center text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">추천 상품을 열심히 선별 중입니다! 🙇‍♀️</div>}
            </div>
          </div>
        </div>

        {/* 오버레이 내부 레지스트리 모달 */}
        {showRegistryModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
              <button onClick={() => setShowRegistryModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
              <h3 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2"><ShoppingCart className="text-rose-500 fill-rose-500"/> 나의 장바구니</h3>
              <p className="text-[11px] text-gray-500 mb-4">현재 <b className="text-rose-500">{registryItems.length}</b>개의 상품이 담겨있어요.</p>
              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar bg-gray-50 p-3 rounded-xl">
                {registryItems.length > 0 ? registryItems.map((item: string, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 text-xs">
                    <span className="font-bold text-gray-700 truncate mr-2">{item}</span>
                    <button onClick={() => handleToggleRegistry(item)} className="text-gray-400 hover:text-rose-500"><X size={14}/></button>
                  </div>
                )) : <div className="text-center py-5 text-gray-400 text-xs">아직 담은 상품이 없습니다.</div>}
              </div>
            </div>
          </div>
        )}

        {/* 🔥 [추가] 상세페이지용 영수증 인증 모달 추가! */}
        {showVerifyModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
              <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
              <h3 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2"><Camera className="text-rose-500"/> 구매 인증하기</h3>
              <p className="text-[11px] text-gray-500 mb-5 break-keep leading-relaxed bg-gray-50 p-3 rounded-lg">
                봄이옴 몰에서 물건을 구매하셨나요? 결제 내역 화면을 캡처해서 올려주세요!<br/>
                <span className="text-rose-500 font-bold mt-2 block tracking-tight">💡 현재 웰컴키트 보상 이벤트는 기획 중이에요! (봄이옴 열일중 💦) 미리 인증해 두시면 추후 오픈 시 가장 먼저 혜택을 챙겨드릴게요!</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block">어떤 상품을 구매하셨나요?</label>
                  <select value={verifyCategory} onChange={e=>setVerifyCategory(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400">
                    <option value="">카테고리 선택</option><option value="유모차">유모차</option><option value="스킨케어">임산부 스킨케어</option><option value="영양제">영양제</option><option value="기저귀">기저귀</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block">영수증(결제내역) 첨부</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                    {uploadFile ? <span className="text-sm font-bold text-emerald-600">✅ {uploadFile.name}</span> : <><Upload className="text-gray-400 mb-2"/> <span className="text-xs text-gray-500">클릭해서 사진 선택</span></>}
                    <input type="file" accept="image/*" onChange={(e) => { if(e.target.files) setUploadFile(e.target.files[0]); }} className="hidden"/>
                  </label>
                </div>
                <button onClick={handleUploadReceipt} disabled={!uploadFile || !verifyCategory || isUploading} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-md disabled:bg-gray-300 transition-colors mt-2">
                  {isUploading ? '업로드 중...' : '인증 완료하고 도장 받기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 🌟 2. 메인 타임라인 화면
  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-24 font-pretendard relative w-full flex flex-col items-center">
      <header className="w-full flex justify-center bg-white sticky top-0 z-40 border-b border-rose-100 shadow-sm animate-fade-in">
        <div className="w-full max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
            <h2 className="font-bold text-lg leading-tight text-rose-600 flex items-center gap-1.5"><ShoppingBag size={20}/> 봄이옴 몰</h2>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              {mallSource === 'REGISTRY' && <div className="absolute -bottom-10 right-0 bg-gray-900 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-bounce shadow-lg after:content-[''] after:absolute after:-top-1 after:right-4 after:w-2 after:h-2 after:bg-gray-900 after:rotate-45">🛒 5개 담고 미션 완료!</div>}
              <button onClick={() => setShowRegistryModal(true)} className="relative p-2 bg-gray-50 rounded-full hover:bg-rose-50 transition-colors">
                <ShoppingCart size={20} className="text-gray-700"/>
                {registryItems.length > 0 && <span className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white">{registryItems.length}</span>}
              </button>
            </div>
            <div className="relative">
              {mallSource === 'VERIFY' && <div className="absolute -bottom-10 right-0 bg-rose-500 text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-bounce shadow-lg after:content-[''] after:absolute after:-top-1 after:right-4 after:w-2 after:h-2 after:bg-rose-500 after:rotate-45">📸 여기서 영수증 올려주세요!</div>}
              <button onClick={() => setShowVerifyModal(true)} className="bg-gray-900 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm hover:bg-black">
                <Camera size={14}/> 구매인증
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto px-4 pt-6 pb-10 animate-fade-in">
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-rose-100 shadow-sm text-center mb-6">
          <span className="text-4xl mb-3 block">🛍️</span>
          <h3 className="font-extrabold text-gray-900 text-lg mb-2 tracking-tight">임신 주차별 구매 필수 가이드</h3>
          <p className="text-xs text-gray-500 leading-relaxed break-keep">지금 내 주차에 꼭 사야 할 영양제와 육아용품!<br/>초보 엄빠의 결정 고민을 덜어드리기 위해 시기별로 정리했어요.</p>
        </div>

        {isPreMom ? (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs p-4 rounded-xl mb-6 shadow-sm text-center break-keep leading-relaxed">👼 예비맘님, 나중에 아기 천사가 찾아오면 주차별로 필요한 아이템을 꼼꼼히 챙겨드릴게요! 지금은 미리 가볍게 구경해 보세요.</div>
        ) : (!currentWeek || currentWeek <= 0) ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-4 rounded-xl mb-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
            <span className="break-keep leading-relaxed text-center sm:text-left">💡 <b>출산 예정일</b>을 입력하시면 지금 산모님께 꼭 필요한 쇼핑 리스트를 짚어드려요!</span>
            <button onClick={onBack} className="bg-white text-rose-600 px-4 py-2 rounded-lg font-bold shadow-sm border border-rose-100 hover:bg-rose-100 whitespace-nowrap">예정일 입력하기</button>
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto py-2 pb-3 mb-6 sticky top-[53px] z-30 bg-[#f8f9fa] border-y border-gray-100 shadow-sm px-1 w-full no-scrollbar">
          {FILTERS.map(f => (
            <button key={f} onClick={() => scrollToCategory(f)} className={`px-4 py-2.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all border shadow-sm shrink-0 ${activeFilter === f ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{f}</button>
          ))}
        </div>

        {!isPreMom && currentWeek > 0 && currentWeek <= 40 && (
          <div className="flex items-center justify-end gap-1.5 mb-4 px-1">
            <div className="relative w-2.5 h-4 flex justify-center items-center">
              <div className="w-0.5 h-full bg-rose-500 rounded-full"></div>
              <div className="absolute top-0 w-2 h-2 bg-white border-2 border-rose-500 rounded-full"></div>
            </div>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md shadow-sm border border-rose-100">나의 현재 주차</span>
          </div>
        )}

        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            {MALL_ITEMS.map((item, index) => {
              const isHighlighted = activeFilter === '전체' || activeFilter === item.category;
              
              // 🔥 [핵심 추가] 필터에 맞지 않으면 아예 화면에서 빼버립니다! (빈자리는 자동으로 위로 당겨짐)
              if (!isHighlighted) return null;

              const leftPercent = Math.max(0, ((item.start - 1) / 40) * 100);
              const widthPercent = Math.min(100 - leftPercent, ((item.end - item.start + 1) / 40) * 100);
              const isCurrentActive = !isPreMom && currentWeek >= item.start && currentWeek <= item.end;
              const isFirstOfCategory = index === 0 || MALL_ITEMS[index - 1].category !== item.category;

              // 🔥 [클래스 정리] 이제 무조건 보일 때만 렌더링되므로, 흐릿하게 만드는 코드를 지우고 깔끔하게 뒀습니다.
              return (
                <div key={item.id} id={isFirstOfCategory ? `mall-cat-${item.category}` : undefined} onClick={() => setSelectedMallItem(item)} className="relative transition-all duration-500 pt-2 opacity-100 scale-100 cursor-pointer group">
                  <div className="flex justify-between items-end mb-2 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{item.icon}</span>
                      <h4 className={`font-bold text-sm ${isCurrentActive ? 'text-gray-900' : 'text-gray-700'} group-hover:text-rose-500 transition-colors`}>{item.title}</h4>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${isCurrentActive ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>{item.start}주 ~ {item.end}주</span>
                  </div>
                  <div className="relative w-full h-3 mb-2">
                    <div className="absolute inset-0 bg-gray-100 rounded-full shadow-inner overflow-hidden">
                      <div className="absolute left-1/4 w-px h-full bg-white z-0 opacity-50"></div>
                      <div className="absolute left-2/4 w-px h-full bg-white z-0 opacity-50"></div>
                      <div className="absolute left-3/4 w-px h-full bg-white z-0 opacity-50"></div>
                      <div className={`absolute h-full rounded-full bg-gradient-to-r ${isCurrentActive ? 'from-rose-400 to-pink-500' : 'from-gray-300 to-gray-400'} z-10 transition-all duration-1000`} style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}></div>
                    </div>
                    {!isPreMom && currentWeek > 0 && currentWeek <= 40 && (
                      <div className="absolute -top-1 -bottom-1 w-[2px] bg-rose-500 z-20 shadow-sm rounded-full pointer-events-none" style={{ left: `${(currentWeek / 40) * 100}%` }}>
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-[2.5px] border-rose-500 rounded-full shadow-sm"></div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-1 break-keep mb-2">{item.desc}</p>
                  <div className="pl-1 text-left">
                    <button className="inline-block bg-white border border-gray-200 text-gray-600 text-[10px] sm:text-[11px] font-bold py-1.5 px-3 rounded-lg group-hover:bg-rose-50 group-hover:text-rose-600 group-hover:border-rose-200 transition-all shadow-sm">{item.title} 추천 상품 확인하기 &gt;</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 영수증 인증 모달 */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
            <h3 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2"><Camera className="text-rose-500"/> 구매 인증하기</h3>
            <p className="text-[11px] text-gray-500 mb-5 break-keep leading-relaxed bg-gray-50 p-3 rounded-lg">
              봄이옴 몰에서 물건을 구매하셨나요? 결제 내역 화면을 캡처해서 올려주세요!<br/>
              <span className="text-rose-500 font-bold mt-2 block tracking-tight">💡 현재 웰컴키트 보상 이벤트는 기획 중이에요! (봄이옴 열일중 💦) 미리 인증해 두시면 추후 오픈 시 가장 먼저 혜택을 챙겨드릴게요!</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">어떤 상품을 구매하셨나요?</label>
                <select value={verifyCategory} onChange={e=>setVerifyCategory(e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400">
                  <option value="">카테고리 선택</option><option value="유모차">유모차</option><option value="스킨케어">임산부 스킨케어</option><option value="영양제">영양제</option><option value="기저귀">기저귀</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">영수증(결제내역) 첨부</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                  {uploadFile ? <span className="text-sm font-bold text-emerald-600">✅ {uploadFile.name}</span> : <><Upload className="text-gray-400 mb-2"/> <span className="text-xs text-gray-500">클릭해서 사진 선택</span></>}
                  <input type="file" accept="image/*" onChange={(e) => { if(e.target.files) setUploadFile(e.target.files[0]); }} className="hidden"/>
                </label>
              </div>
              <button onClick={handleUploadReceipt} disabled={!uploadFile || !verifyCategory || isUploading} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-md disabled:bg-gray-300 transition-colors mt-2">
                {isUploading ? '업로드 중...' : '인증 완료하고 도장 받기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 화면 레지스트리 목록 모달 */}
      {showRegistryModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl">
            <button onClick={() => setShowRegistryModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
            <h3 className="text-lg font-black text-gray-900 mb-1 flex items-center gap-2"><Heart className="text-rose-500 fill-rose-500"/> 나의 레지스트리</h3>
            <p className="text-[11px] text-gray-500 mb-4">현재 <b className="text-rose-500">{registryItems.length}</b>개의 상품이 담겨있어요.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar bg-gray-50 p-3 rounded-xl">
              {registryItems.length > 0 ? registryItems.map((item: string, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 text-xs">
                  <span className="font-bold text-gray-700 truncate mr-2">{item}</span>
                  <button onClick={() => handleToggleRegistry(item)} className="text-gray-400 hover:text-rose-500"><X size={14}/></button>
                </div>
              )) : <div className="text-center py-5 text-gray-400 text-xs">아직 담은 상품이 없습니다.</div>}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 [추가] 봄이옴 몰 진입 시 최초 1회 뜨는 미션 가이드 팝업 */}
      {showMallGuide && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <span className="text-5xl mb-4 block animate-bounce-short">🛒</span>
            <h3 className="text-xl font-black text-gray-900 mb-3">장바구니 미션!</h3>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-6 break-keep bg-rose-50 p-4 rounded-xl border border-rose-100">
              봄이옴 몰 내에서 마음에 드는 <br/><b>5개 이상의 상품</b>을 장바구니(찜)에 담아보세요.<br/>5개 상품을 담는 순간, 미션이 완료됩니다!
            </p>
            <button onClick={() => setShowMallGuide(false)} className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-black transition-colors">
              확인완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 1. [데이터 복구] 주차별 질문 리스트 (컴포넌트 외부 배치)
const LOUNGE_WEEKLY_QUESTIONS: { [key: number]: string } = {
  4: "아기 천사가 찾아왔어요! 임신 소식을 처음 들었을 때 여보의 솔직한 기분은 어땠어?",
  5: "우리 아기 태명 후보들 중에서 여보가 가장 마음이 가는 이름과 그 이유는 뭐야?",
  6: "요즘 여보 몸 컨디션은 어때? 내가 가장 신경 써줬으면 하는 부분이 있다면 말해줘.",
  7: "초음파로 아기집을 처음 봤을 때, 부모가 된다는 게 실감이 났어?",
  8: "콩닥콩닥 아기 심장 소리를 처음 들은 날! 여보가 느낀 감동을 한 줄로 표현한다면?",
  9: "젤리곰처럼 귀여워진 우리 아기! 여보의 외모 중 아기가 이건 꼭 닮았으면 하는 게 있어?",
  10: "입덧이나 식성 변화 때문에 힘들진 않아? 여보가 지금 가장 먹고 싶은 음식이 뭐야?",
  11: "앞으로 우리 세 가족이 함께 살 집에서 가장 행복하게 웃고 있는 모습은 어떤 모습일까?",
  12: "1차 기형아 검사를 마친 이번 주, 긴장했을 서로에게 고생했다고 한마디 해줄까?",
  13: "아기용품을 하나둘 구경하기 시작했어! 여보가 가장 먼저 사주고 싶은 첫 선물은 뭐야?",
  14: "안정기에 접어들고 있어. 우리 아기랑 같이 가고 싶은 첫 번째 가족 여행지는 어디야?",
  15: "여보가 생각하는 '좋은 부모'란 어떤 모습이야? 우리 어떤 엄마 아빠가 될까?",
  16: "성별 힌트를 들은 이번 주! 아들이든 딸이든 우리 아기에게 처음 건네고 싶은 인사는?",
  17: "부쩍 배가 나오기 시작했어. 변화하는 여보의 모습이 내 눈에는 세상에서 제일 아름다워. 여보는 어때?",
  18: "태동을 느낄 수도 있는 시기야! 아기가 뱃속에서 처음으로 여보에게 신호를 보낸다면 어떨 것 같아?",
  19: "아빠가 태담 동화를 읽어줄 때, 여보랑 아기 기분은 어떤 것 같아?",
  20: "임신의 절반이 지났어! 지난 20주 동안 여보에게 가장 고마웠던 순간은 언제였어?",
  21: "아기의 청각이 발달했대. 여보가 아기에게 가장 자주 들려주고 싶은 노래나 말은 뭐야?",
  22: "정밀 초음파로 본 아기 얼굴! 신기하게도 여보랑 닮은 구석을 찾았어?",
  23: "여보는 우리 아기가 커서 어떤 성격을 가진 사람이 되었으면 좋겠어?",
  24: "임당 검사를 앞두고 긴장되지? 검사 끝나면 내가 여보가 제일 좋아하는 간식 사줄게. 뭐가 좋아?",
  25: "입체 초음파로 본 아기 모습! 여보는 아기가 누구를 더 닮은 것 같아?",
  26: "아기가 뱃속에서 꼬물거릴 때마다 여보는 어떤 생각을 해?",
  27: "출산 후에 여보가 가장 하고 싶은 것(음식, 여행, 취미 등) 1순위는 뭐야?",
  28: "만삭 촬영을 앞둔 시기! 우리 부부의 가장 행복한 순간을 어떤 분위기로 남기고 싶어?",
  29: "숨이 차고 잠자리가 불편해지는 시기야. 여보를 위해 내가 오늘 밤 해줄 수 있는 최고의 서비스는?",
  30: "드디어 앞자리가 3으로 바뀌었어! 아기가 태어나면 여보랑 나, 우리 둘만의 시간은 어떻게 지킬까?",
  31: "출산 가방을 싸기 시작했어. 짐을 챙기면서 여보가 느낀 가장 설레는 마음은 뭐야?",
  32: "태동이 아주 힘차졌어! 여보가 느낀 아기의 발차기 점수는 10점 만점에 몇 점?",
  33: "조리원 예약을 확인하며 실감이 나기 시작해. 우리 아기랑 처음 만나는 날, 여보는 울 것 같아?",
  34: "아기 이름을 확정해야 할 시기! 우리가 지은 이름이 아기에게 어떤 선물이 되었으면 좋겠어?",
  35: "아기 침대를 조립하고 아기방을 꾸미면서, 여보는 어떤 상상을 했어?",
  36: "막달 검사를 마친 이번 주, 곧 만날 아기를 위해 여보가 쓴 편지 한 구절만 미리 들려줘.",
  37: "언제 아기가 나와도 이상하지 않은 시기! 우리 긴급 상황일 때 대처법 다시 한번 체크해볼까?",
  38: "무거운 몸으로 열 달을 버텨낸 여보. 여보의 인내심과 사랑에 내가 해줄 수 있는 최고의 칭찬은?",
  39: "예정일이 코앞이야. 아기가 세상에 나오면 여보가 가장 먼저 안아주고 싶어, 아니면 내가 먼저 안아줄까?",
  40: "드디어 D-Day! 여기까지 함께해줘서 고마워. 우리 아기랑 같이 만들 미래가 기대되지 않아?"
};

// 🔥 [신규 컴포넌트] 부부 라운지 (봄이옴 2.0 찐 최종 완결판 - UI 복구 및 최적화 완료)
const CoupleLoungeSection = ({ user, onUpdateUser, addToast, onBack, onGoToMoms, setShowRegistryReport }: any) => {
  // 1. 상태 관리 (기존 유지)
  const [inviteCode, setInviteCode] = useState(user?.inviteCode || '');
  const [inputCode, setInputCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const [showCodeInput, setShowCodeInput] = useState(false);

  const currentWeek = calculatePregnancyWeek(user?.dueDate);
  const exactDDay = user?.dueDate ? calculateDDay(user.dueDate) : 0;
  const babySize = getBabySize(currentWeek);

  const [familyData, setFamilyData] = useState<any>({ missions: {}, pokes: [], weightLogs: {}, kickLogs: [], emotionLogs: [], symptomLogs: [], photos: [], sosLogs: [], couponGauge: 0, dadCoupons: 0, diaryNotes: {} });
  const [activeLoungeTab, setActiveLoungeTab] = useState<'HOME' | 'QUEST' | 'DIARY' | 'ALBUM'>('HOME');
  
  const [sosType, setSosType] = useState('🍔 야식셔틀');
  const [sosText, setSosText] = useState('');
  
  // 🔥 [신규] SOS 채팅 및 아빠 결재 상태
  const [replyingSosId, setReplyingSosId] = useState<number | null>(null);
  const [sosReplyText, setSosReplyText] = useState('');
  const [approvalReason, setApprovalReason] = useState('');
  const [couponCountToUse, setCouponCountToUse] = useState(1);

  // 🔥 [신규] 캘린더 전용 상태 및 헬퍼 함수
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [showCalendarAddModal, setShowCalendarAddModal] = useState(false);
  const [showCalendarListModal, setShowCalendarListModal] = useState(false);
  const [eventText, setEventText] = useState('');
  const [eventEmoji, setEventEmoji] = useState('🏥');
  const [notifyHusband, setNotifyHusband] = useState(true);

  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  const handleDeleteCalendarEvent = async (eventId: number) => {
    if (!window.confirm('정말로 이 일정을 삭제하시겠습니까?')) return;
    
    try {
      const currentEvents = familyData.calendarEvents || [];
      // 1. 삭제할 일정이 무엇인지 먼저 찾습니다 (알림에 쓰기 위해)
      const eventToDelete = currentEvents.find((ev: any) => {
        if (!ev) return false;
        // ev.id가 존재한다면 비교하고, 혹시 필드명이 다를 것을 대비해 유연하게 체크합니다.
        const targetId = ev.id || ev._id || ev.uid;
        return String(targetId) === String(eventId);
      });
      
      if (!eventToDelete) {
        // 💡 디버깅용 팁: 만약 그래도 못 찾으면 콘솔로 데이터 형태를 찍어줍니다.
        console.log("현재 일정 목록들:", currentEvents, "지우려는 ID:", eventId);
        addToast('error', '삭제할 일정을 찾을 수 없습니다.');
        return;
      }

      const updatedEvents = currentEvents.filter((ev: any) => String(ev.id) !== String(eventId));
      
      // 3. 🔥 봄봄톡에 띄울 '삭제 알림' 메시지를 만듭니다.
      const deleteNotifySos = {
        id: Date.now(),
        type: '📅 일정 삭제',
        text: `[일정이 삭제되었습니다]\n\n일정: ${eventToDelete.text} ${eventToDelete.emoji}\n삭제자: ${user.nickname || (user.coupleRole === 'MOM' ? '봄이맘' : '봄이빠')}`,
        status: '알림',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        isReadByDad: user.coupleRole === 'MOM' ? false : true,
        isReadByMom: user.coupleRole === 'DAD' ? false : true
      };

      // 4. DB에 반영 (일정 목록 교체 + 알림 로그 추가)
      // 🔥 arrayUnion을 쓰기 위해 'sosLogs: arrayUnion(deleteNotifySos)'를 추가했습니다.
      await setDoc(doc(db, 'families', user.familyId), { 
        calendarEvents: updatedEvents,
        sosLogs: arrayUnion(deleteNotifySos) 
      }, { merge: true });

      addToast('success', '일정이 삭제되었습니다! ✨');
      setShowCalendarListModal(false); // 팝업 닫기
    } catch (e) {
      console.error("삭제 에러:", e);
      addToast('error', '삭제 중 오류가 발생했습니다.');
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const formatDateStr = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getEventsForDate = (dateStr: string) => {
    const events = [];

    // 1. 첫 태동 기록만 가져오기 (배열의 0번째 요소 딱 1개만 검사)
    if (familyData?.kickLogs && Array.isArray(familyData.kickLogs) && familyData.kickLogs.length > 0) {
      const firstKick = familyData.kickLogs[0];
      if (firstKick.date) {
        const match = firstKick.date.match(/\d+/g);
        if (match && match.length >= 3) {
          const normalizedLogDate = `${match[0]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
          if (normalizedLogDate === dateStr) {
            events.push({ type: 'auto', text: '우리 아기 첫 태동을 느꼈어요!', time: firstKick.time, emoji: '👣', uploader: '시스템' });
          }
        }
      }
    }

    // 2. 앨범 기록 (PHOTO)
    if (familyData?.photos && Array.isArray(familyData.photos)) {
      const photosOnDate = familyData.photos.filter((photo: any) => {
        if (!photo.date) return false;
        const match = photo.date.match(/\d+/g);
        if (match && match.length >= 3) {
          const normalizedPhotoDate = `${match[0]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
          return normalizedPhotoDate === dateStr;
        }
        return false;
      });

      if (photosOnDate.length > 0) {
        photosOnDate.forEach((photo: any) => {
          events.push({ type: 'photo', emoji: '📸', img: photo.url, text: photo.memo || '우리의 소중한 추억', uploader: photo.uploader });
        });
      }
    }

    // 🔥 3. [복구 완료] 사용자가 직접 달력에 추가한 일정 (이게 빠져있었습니다!)
    if (familyData?.calendarEvents && Array.isArray(familyData.calendarEvents)) {
      const customEvents = familyData.calendarEvents.filter((ev: any) => ev.date === dateStr);
      customEvents.forEach((ev: any) => {
        // 🔥 [핵심 수정] 앞부분에 id: ev.id를 꼭 추가해 줘야 삭제/수정 버튼이 ID를 알아먹습니다!
        events.push({ id: ev.id, type: 'custom', emoji: ev.emoji || '📅', text: ev.text, uploader: ev.uploader, time: '' });
      });
    }

    return events;
  };

  const handleSaveCalendarEvent = async () => {
    if (!user?.familyId || !selectedDateStr || !eventText.trim()) return;

    let updatedEvents = [];
    if (editingEventId) {
      // 🔥 수정 모드
      updatedEvents = (familyData.calendarEvents || []).map((ev: any) => 
        ev.id === editingEventId ? { ...ev, emoji: eventEmoji, text: eventText } : ev
      );
    } else {
      // 🔥 신규 모드
      const newEvent = { id: Date.now(), date: selectedDateStr, emoji: eventEmoji, text: eventText, uploader: myName };
      updatedEvents = [...(familyData.calendarEvents || []), newEvent];
    }

    let updates: any = { calendarEvents: updatedEvents };
    
    // 신규 모드일 때만 알림 전송
    if (notifyHusband && !editingEventId) {
      const notifySos = {
        id: Date.now() + 1, type: '📅 일정 공유', 
        text: `[새로운 일정이 캘린더에 등록되었어요!]\n\n날짜: ${selectedDateStr}\n일정: ${eventText} ${eventEmoji}`, 
        status: '알림', time: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}),
        isReadByDad: user.coupleRole === 'MOM' ? false : true, isReadByMom: user.coupleRole === 'DAD' ? false : true 
      };
      updates.sosLogs = arrayUnion(notifySos);
    }

    try {
      await setDoc(doc(db, 'families', user.familyId), updates, { merge: true });
      setEventText(''); setEditingEventId(null); setShowCalendarAddModal(false); setShowCalendarListModal(false);
      addToast('success', editingEventId ? '일정이 수정되었습니다! ✨' : '달력에 일정이 등록되었어요! 🗓️');
    } catch (e) {
      addToast('error', '저장 중 오류가 발생했습니다.');
    }
  };

  const [diarySubTab, setDiarySubTab] = useState<'NOTE'|'WEIGHT'|'KICK'|'EMOTION'|'SYMPTOM'|'LEDGER'>('NOTE');
  const [noteInput, setNoteInput] = useState('');

  // 🔥 [신규 추가] 가계부 전용 상태값 및 함수
  const [ledgerType, setLedgerType] = useState<'지출' | '수입'>('지출');
  const [ledgerDate, setLedgerDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [ledgerTitle, setLedgerTitle] = useState('');
  const [ledgerCategory, setLedgerCategory] = useState('');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerMemo, setLedgerMemo] = useState('');

  const handleSaveLedger = async () => {
    if (!ledgerTitle || !ledgerAmount || !user?.familyId) {
      addToast('error', '항목과 금액을 모두 입력해주세요!');
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      date: ledgerDate,
      type: ledgerType,
      title: ledgerTitle,
      category: ledgerCategory || '미분류',
      amount: Number(ledgerAmount),
      memo: ledgerMemo,
      writer: myName, // 현재 로그인한 사람 (남편 or 아내)
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'families', user.familyId), { ledger: arrayUnion(newItem) }, { merge: true });
      setLedgerTitle(''); setLedgerAmount(''); setLedgerCategory(''); setLedgerMemo('');
      addToast('success', '가계부에 기록되었습니다! 💰');
    } catch (e) {
      addToast('error', '저장 실패. 다시 시도해주세요.');
    }
  };

  const handleDeleteLedger = async (itemToDelete: any) => {
    if (!window.confirm('이 내역을 삭제하시겠습니까?')) return;
    try {
      // 🔥 import 에러를 방지하기 위해 arrayRemove 대신 직접 배열을 필터링해서 덮어씌웁니다.
      const currentLedger = familyData.ledger || [];
      const updatedLedger = currentLedger.filter((l: any) => l.id !== itemToDelete.id);
      
      await setDoc(doc(db, 'families', user.familyId), { ledger: updatedLedger }, { merge: true });
      addToast('success', '내역이 삭제되었습니다.');
    } catch (e) {
      addToast('error', '삭제 실패');
    }
  };
  
  // 📸 체중 입력 주차 선택 모달 상태 (과거 데이터 입력용)
  const [showWeightWeekModal, setShowWeightWeekModal] = useState(false);
  const [tempWeightWeek, setTempWeightWeek] = useState(currentWeek > 0 ? currentWeek.toString() : '1');
  const [weightInput, setWeightInput] = useState('');

  const [emotionEmoji, setEmotionEmoji] = useState('😄');
  const [emotionText, setEmotionText] = useState('');
  const [symptomText, setSymptomText] = useState('');

  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [uploadPhoto, setUploadPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoMemo, setPhotoMemo] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [albumComments, setAlbumComments] = useState<{[key:string]: string}>({});

  const [optimisticPhoto, setOptimisticPhoto] = useState<any>(null);
  const [bomTalkInput, setBomTalkInput] = useState(''); // 🔥 이 줄이 빠져서 터졌습니다! 꼭 추가해 주세요!

  // 🔥 [신규] 3대 그래프 스크롤 Ref & 기준 체중 상태
  const weightScrollRef = useRef<HTMLDivElement>(null);
  const emotionScrollRef = useRef<HTMLDivElement>(null);
  const kickScrollRef = useRef<HTMLDivElement>(null);
  const [baseWeightInput, setBaseWeightInput] = useState('');

  const [selectedDiaryWeek, setSelectedDiaryWeek] = useState<number | null>(null);
  const [modalNoteInput, setModalNoteInput] = useState('');

  const checkAutoCompletion = (title: string) => {
    if (!user || !title) return false;
    try {
      const completedList = user.completedMissions ? String(user.completedMissions).split(',').filter(Boolean) : [];
      const registryItems = user.registryItems ? String(user.registryItems).split(',').filter(Boolean) : [];
      const verifiedCats = user.verifiedCategories ? String(user.verifiedCategories).split(',').filter(Boolean) : [];

      if (title.includes('태명')) return !!user.babyName && user.babyName !== '아직 고민중이에요';
      if (title.includes('산부인과')) return !!user.myHospitalName && user.myHospitalName !== '예비맘' && user.myHospitalName !== '알아보는 중';
      if (title.includes('태아보험')) return !!user.insCompany;
      if (title.includes('조리원')) return !!user.myCareCenter;
      if (title.includes('튼살')) return !!user.myStretchMark && !!user.myMaternityWear;
      if (title.includes('태교여행')) return !!user.myBabymoon;
      if (title.includes('도우미')) return completedList.includes('산후도우미 예약');
      if (title.includes('육아템')) return verifiedCats.length >= 3 || registryItems.length >= 5; 
      if (title.includes('아기 이름')) return !!user.realName && String(user.realName).startsWith('[확정]');
      return false;
    } catch (e) { return false; }
  };

  const LOUNGE_JOURNEY_DATA = [
    { title: '태명 짓기', start: 1, end: 5, tab: 'babyname' }, { title: '국민행복카드 발급', start: 5, end: 7, tab: 'happinesscard' }, { title: '산부인과 결정', start: 5, end: 8, tab: 'hospital' },
    { title: '태아보험 가입', start: 8, end: 12, tab: 'insurance' }, { title: '산후조리원 예약', start: 12, end: 16, tab: 'care' },
    { title: '튼살 관리 & 임부복', start: 16, end: 20, tab: 'maternity' }, { title: '태교여행 계획', start: 20, end: 27, tab: 'babymoon' },
    { title: '산후도우미 예약', start: 28, end: 32, tab: 'helper' }, { title: '출산·육아템 준비', start: 32, end: 38, tab: 'baby' },
    { title: '아기 이름 짓기', start: 34, end: 40, tab: 'realname' }
  ];
  const currentMissions = LOUNGE_JOURNEY_DATA.filter(m => m.start <= (currentWeek || 0) && m.end >= (currentWeek || 0));

  // 2. 실시간 동기화 (기존 유지)
  useEffect(() => {
    if (!user?.familyId || !db) return;
    const familyRef = doc(db, 'families', user.familyId);
    const unsub = onSnapshot(familyRef, (docSnap) => {
      if (docSnap.exists()) setFamilyData(docSnap.data());
      else setDoc(familyRef, { createdAt: serverTimestamp() }, { merge: true });
    });
    return () => unsub();
  }, [user?.familyId]);

  // 🔥 [신규] 다이어리 서브탭 전환 시 현재 주차로 자동 스르륵~ 포커싱!
  useEffect(() => {
    if (activeLoungeTab === 'DIARY') {
      setTimeout(() => {
        if (diarySubTab === 'WEIGHT' && weightScrollRef.current) {
          const targetX = (currentWeek / 40) * 1200 - (weightScrollRef.current.clientWidth / 2);
          weightScrollRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        } else if (diarySubTab === 'EMOTION' && emotionScrollRef.current) {
          const targetX = (currentWeek / 40) * 1400 - (emotionScrollRef.current.clientWidth / 2);
          emotionScrollRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        } else if (diarySubTab === 'KICK' && kickScrollRef.current) {
          const targetX = (currentWeek / 40) * kickScrollRef.current.scrollWidth - (kickScrollRef.current.clientWidth / 2);
          kickScrollRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
        }
      }, 150); // 렌더링 후 살짝 여유를 두고 부드럽게 이동
    }
  }, [diarySubTab, activeLoungeTab, currentWeek]);

  const myName = user?.coupleRole === 'MOM' ? '아내' : '남편';

  // 3. 액션 함수들 (기존 유지)
  const handleSaveDiaryNote = async () => {
    if (!noteInput.trim() || !user?.familyId) return;
    const roleKey = user.coupleRole === 'MOM' ? 'mom' : 'dad';
    await setDoc(doc(db, 'families', user.familyId), {
      [`diaryNotes.${currentWeek}.${roleKey}`]: noteInput.trim(),
      [`diaryNotes.${currentWeek}.${roleKey}Time`]: new Date().toLocaleDateString('ko-KR')
    }, { merge: true });
    setNoteInput('');
    addToast('success', '교환일기를 금고에 넣었어요! 🔐');
  };

  // 🔥 [신규] 봄봄톡(일상대화) 발송 로직
  const handleSendBomTalk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomTalkInput.trim() || !user?.familyId) return;
    const newChat = {
      id: Date.now(), type: '일상', text: bomTalkInput, senderRole: user.coupleRole,
      time: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'})
    };
    await setDoc(doc(db, 'families', user.familyId), { sosLogs: arrayUnion(newChat) }, { merge: true });
    setBomTalkInput('');
  };

  // 🔥 [수정] 분리된 아빠 출동 SOS & 결재 (봄봄톡 연동)
  const handleSendSos = async () => {
    if (!sosText || !user?.familyId) return;
    const newSos = { 
      id: Date.now(), type: sosType, text: sosText, status: '대기중', 
      time: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}),
      isReadByDad: false, isReadByMom: true 
    };
    await setDoc(doc(db, 'families', user.familyId), { sosLogs: arrayUnion(newSos) }, { merge: true });
    setSosText(''); addToast('success', '아빠에게 임무를 하달했습니다! 🚨');
  };

  const handleReadSos = async (sos: any) => {
    if (!user?.familyId || sos.type === '일상') return;
    let needsUpdate = false;
    const updated = familyData.sosLogs.map((s: any) => {
      if (s.id === sos.id) {
        if (user.coupleRole === 'DAD' && !s.isReadByDad) { needsUpdate = true; return { ...s, isReadByDad: true }; }
        if (user.coupleRole === 'MOM' && !s.isReadByMom) { needsUpdate = true; return { ...s, isReadByMom: true }; }
      }
      return s;
    });
    if (needsUpdate) {
      await setDoc(doc(db, 'families', user.familyId), { sosLogs: updated }, { merge: true });
    }
  };

  const handleReplySos = async (id: number) => {
    if (!user?.familyId) return;
    const targetSos = familyData.sosLogs.find((s:any) => s.id === id);
    const isRealMission = targetSos && targetSos.type !== '📅 일정 공유' && targetSos.type !== '🎫 결재 요청';
    
    let newGauge = familyData.couponGauge || 0;
    let newDadCoupons = familyData.dadCoupons || 0;
    
    if (user.coupleRole === 'DAD' && isRealMission) {
      newGauge += 1;
      if (newGauge >= 3) {
        newGauge = 0; newDadCoupons += 1;
        addToast('success', '🎉 임무 완수! 3시간 자유권 1장 획득!');
      } else {
        addToast('success', `임무 완수! (자유권 게이지: ${newGauge}/3) 🦸‍♂️`);
      }
    }
    const updated = familyData.sosLogs.map((s: any) => 
      s.id === id ? { ...s, status: '완료', replyText: '임무 완료했습니다! 🦸‍♂️', replyTime: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}), isReadByMom: false } : s
    );
    await setDoc(doc(db, 'families', user.familyId), { 
      sosLogs: updated, couponGauge: newGauge, dadCoupons: newDadCoupons 
    }, { merge: true });
  };

  const handleRequestCouponApproval = async (reason: string, count: number = 1) => {
    if (!user?.familyId || (familyData.dadCoupons || 0) < count || !reason.trim()) return;
    const newSos = { 
      id: Date.now(), type: '🎫 결재 요청', text: `[남편의 자유권 ${count}장 사용 요청]\n"${reason}"`, status: '결재대기', 
      time: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}),
      isReadByDad: true, isReadByMom: false, usedCoupons: count // 🔥 몇 장 썼는지 기록!
    };
    await setDoc(doc(db, 'families', user.familyId), { 
      sosLogs: arrayUnion(newSos), dadCoupons: (familyData.dadCoupons || 1) - count 
    }, { merge: true });
    addToast('success', `아내에게 ${count}장 결재를 올렸습니다! 두근두근... 🥺`);
  };

  const handleProcessApproval = async (id: number, isApproved: boolean) => {
    if (!user?.familyId || user.coupleRole !== 'MOM') return;
    const targetSos = familyData.sosLogs.find((s:any) => s.id === id);
    const refundCount = targetSos?.usedCoupons || 1; // 🔥 썼던 갯수만큼 다시 파악
    
    const replyText = isApproved ? "승인 🟢 재미있게 놀다 와요!" : "반려 🔴 오늘은 안 돼 나랑 놀아!";
    const updatedLogs = familyData.sosLogs.map((s: any) => 
      s.id === id ? { ...s, status: isApproved ? '승인됨' : '반려됨', replyText, replyTime: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}), isReadByDad: false } : s
    );
    // 반려되면 썼던 갯수만큼 그대로 환불!
    const newCoupons = isApproved ? familyData.dadCoupons : (familyData.dadCoupons || 0) + refundCount;
    await setDoc(doc(db, 'families', user.familyId), { 
      sosLogs: updatedLogs, dadCoupons: newCoupons 
    }, { merge: true });
    addToast(isApproved ? 'success' : 'info', isApproved ? '쿨하게 승인했습니다! ✨' : '단호하게 반려했습니다! 🙅‍♀️');
  };

  // 🔥 [신규] 기준 체중 최초 저장
  const handleSaveBaseWeight = async () => {
    if (!baseWeightInput || !user?.familyId) return;
    await setDoc(doc(db, 'families', user.familyId), { baseWeight: Number(baseWeightInput) }, { merge: true });
    addToast('success', '기준 체중 설정 완료! 이제 변화 추이를 확인해보세요 🌱');
  };

  // 체중 저장 (과거 데이터 입력 가능하도록 수정)
  const handleSaveWeight = async () => {
    if (!weightInput || !user?.familyId) return;
    // 과거 데이터 입력을 위해 선택한 주차(tempWeightWeek)를 사용합니다.
    await setDoc(doc(db, 'families', user.familyId), { 
      [`weightLogs.${tempWeightWeek}`]: Number(weightInput) 
    }, { merge: true });
    setWeightInput(''); addToast('success', `${tempWeightWeek}주차 체중 기록 완료!`);
    setShowWeightWeekModal(false);
  };

  const handleSaveModalDiaryNote = async (week: number) => {
    if (!modalNoteInput.trim() || !user?.familyId) return;
    const roleKey = user.coupleRole === 'MOM' ? 'mom' : 'dad';
    
    // 날짜 밀림 방지 포맷 (YYYY-MM-DD 고정)
    const today = new Date();
    const safeDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    await setDoc(doc(db, 'families', user.familyId), {
      [`diaryNotes.${week}.${roleKey}`]: modalNoteInput.trim(),
      [`diaryNotes.${week}.${roleKey}Time`]: safeDateStr
    }, { merge: true });
    setModalNoteInput('');
    addToast('success', `${week}주차 일기를 예쁘게 채워 넣었어요! 💌`);
  };

  const handleLogKick = async () => {
    if (!user?.familyId) return;

    // 🔥 [핵심] 남편이 클릭하면 팝업만 띄우고 함수 즉시 종료!
    if (user.coupleRole === 'DAD') {
      addToast('info', '정확한 기록을 위해 태동 기록은 산모님만 누를 수 있어요! 🤰');
      return;
    }

    const kickLogs = familyData.kickLogs || [];
    const isFirstKick = kickLogs.length === 0;

    const today = new Date();
    const safeDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    await setDoc(doc(db, 'families', user.familyId), { 
      kickLogs: arrayUnion({ date: safeDateStr, time: today.toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}), week: currentWeek }) 
    }, { merge: true });
    
    if (isFirstKick) {
      addToast('info', '👣 첫 태동을 축하해요! 기념 발자국을 쾅 찍었어요!');
    } else {
      addToast('success', '앗! 태동 블럭이 하나 더 쌓였어요! 👣');
    }
  };
  
  // 🔥 [신규] 주차별 고정 질문 생성기 (팝업용)
  const getDiaryQuestion = (week: number) => {
    const questions: Record<number, string> = {
      1: "우리에게 아기 천사가 찾아왔다는 걸 처음 알았을 때, 내 마음은 어땠어?",
      2: "테스트기 두 줄을 처음 확인했던 순간, 가장 먼저 든 생각은?",
      3: "임신 사실을 양가 부모님께 알렸을 때의 반응 기억나?",
      4: "처음 초음파로 작은 점(아기집)을 봤을 때, 무슨 생각이 들었어?",
      5: "요즘 내 몸에 나타난 가장 큰 변화는 뭐야?",
      6: "콩닥콩닥! 아기 심장 소리를 처음 들었던 날의 감동을 적어보자.",
      7: "우리 아기 태명은 어떻게 지었어? 그 이름에 담긴 뜻은?",
      8: "임신 후 가장 먹고 싶거나, 반대로 피하게 된 음식은 뭐야?",
      9: "나중에 아기와 함께 가장 해보고 싶은 것은?",
      10: "아기가 엄마 아빠 중 누구의 어떤 모습을 닮았으면 좋겠어?",
      11: "입덧이나 피로감으로 힘들 때, 서로 어떻게 도와주면 좋을까?",
      12: "1차 기형아 검사를 앞두고, 우리 부부의 마음은 어때?",
      13: "임신 초기를 무사히 보낸 우리 스스로에게 칭찬 한마디 해줄까?",
      14: "안정기에 접어들었어! 가장 가보고 싶은 태교 여행지는?",
      15: "배가 조금씩 나오기 시작했어. 이 변화를 느낄 때의 기분은?",
      16: "우리가 진짜 부모가 된다는 게 가장 실감 났던 순간은?",
      17: "우리 아기 방은 어떤 색깔, 어떤 분위기로 꾸며주고 싶어?",
      18: "아직 성별을 모를 때(혹은 알았을 때), 아들일까 딸일까 상상해보자!",
      19: "아기가 배 속에서 듣기 좋은 태명이나 노래를 자주 불러주고 있어?",
      20: "첫 태동을 기다리며, 혹은 처음 느꼈을 때의 짜릿한 기분은?",
      21: "정밀 초음파로 아기 얼굴을 자세히 봤어! 누구를 더 닮은 것 같아?",
      22: "요즘 가장 자주 꾸는 꿈이나, 인상 깊었던 태몽이 있어?",
      23: "출산 후 내 삶에서 절대 포기하고 싶지 않은 한 가지는?",
      24: "임신 기간 동안 나를 가장 든든하게 해주는 사람에게 고마움을 전하자.",
      25: "아기가 태어나면 꼭 사주고 싶은 첫 장난감이나 옷은?",
      26: "배 속 아기에게 편지 한 통을 써볼까? '안녕, 우리 아가!'",
      27: "임신 중기를 마무리하며, 가장 행복했던 순간 하나를 꼽자면?",
      28: "배가 제법 많이 나왔어. 요즘 잠자리는 편안한지, 컨디션은 어때?",
      29: "아기가 태어나면 우리 부부의 역할 분담은 어떻게 할까?",
      30: "우리 아기가 커서 어떤 성격, 어떤 가치관을 가진 사람이 되면 좋겠어?",
      31: "출산 준비물을 하나둘씩 챙기면서 느끼는 기분은?",
      32: "백일해 주사도 맞고, 점점 막달이 다가와! 긴장되지 않아?",
      33: "부모가 된다는 것, 설레면서도 가장 두려운 부분은 무엇일까?",
      34: "아기와 함께 찍고 싶은 첫 가족사진의 컨셉을 상상해 보자!",
      35: "진통이 올 때, 남편(아내)이 내 곁에서 꼭 해줬으면 하는 행동은?",
      36: "출산 가방을 싸면서 가장 신경 써서 넣은 물건은 뭐야?",
      37: "언제 신호가 올지 몰라! 우리만의 출산 당일 비상 연락망과 계획은?",
      38: "38주차! 이제 진짜 언제 만나도 이상하지 않아. 지금 내 마음은?",
      39: "길었던 280일, 나 자신과 서로에게 가장 칭찬해주고 싶은 점은?",
      40: "드디어 D-Day! 뱃속의 아기와 만날 준비를 마친 우리, 파이팅 한마디!"
    };
    return questions[week] || `${week}주차의 우리, 오늘 하루는 어땠나요?`;
  };

  const handleSaveEmotion = async () => {
    if (!emotionText || !user?.familyId) return;
    await setDoc(doc(db, 'families', user.familyId), { 
      emotionLogs: arrayUnion({ date: new Date().toLocaleDateString('ko-KR'), emoji: emotionEmoji, text: emotionText, writer: myName, week: currentWeek }) 
    }, { merge: true });
    setEmotionText('');
  };

  const handleSaveSymptom = async () => {
    if (!symptomText || !user?.familyId) return;
    await setDoc(doc(db, 'families', user.familyId), { 
      symptomLogs: arrayUnion({ date: new Date().toLocaleDateString('ko-KR'), text: symptomText, week: currentWeek, writer: myName }) 
    }, { merge: true });
    setSymptomText('');
    addToast('success', '오늘의 증상이 꼼꼼하게 기록되었습니다! 🩺');
  };

  const handlePhotoSelect = (e: any) => { if (e.target.files?.[0]) { setUploadPhoto(e.target.files[0]); const reader = new FileReader(); reader.onloadend = () => setPhotoPreview(reader.result as string); reader.readAsDataURL(e.target.files[0]); } };
  
  // 🔥 [수정] 앨범 0.1초 업로드 (크기 축소 없이 선반영 UI만 유지)
  const handleUploadPhoto = async () => {
    if (!uploadPhoto || !user?.familyId) return;
    
    const tempUrl = URL.createObjectURL(uploadPhoto);
    const newPhoto = { id: 'temp', url: tempUrl, memo: photoMemo, date: new Date().toLocaleDateString('ko-KR'), uploader: myName, isUploading: true };
    setOptimisticPhoto(newPhoto);
    
    setShowAlbumModal(false);
    addToast('success', '사진을 앨범에 예쁘게 꽂았어요! 📸');
    
    try {
      const storageRef = ref(storage, `families/${user.familyId}/album_${Date.now()}`);
      await uploadBytes(storageRef, uploadPhoto);
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(db, 'families', user.familyId), { 
        photos: arrayUnion({ id: Date.now().toString(), url, memo: photoMemo, date: new Date().toLocaleDateString('ko-KR'), uploader: myName }) 
      }, { merge: true });
    } catch(e) {
      addToast('error', '앗, 사진 업로드에 실패했어요. 다시 시도해주세요!');
    } finally {
      setOptimisticPhoto(null);
      setUploadPhoto(null); setPhotoPreview(''); setPhotoMemo('');
    }
  };
  
  const handleAddPhotoComment = async (id: string) => {
    const text = albumComments[id]; 
    if (!text || !user?.familyId) return;
    const updated = familyData.photos.map((p: any) => p.id === id ? { ...p, comments: [...(p.comments || []), { text, uploader: myName }] } : p);
    await setDoc(doc(db, 'families', user.familyId), { photos: updated }, { merge: true });
    setAlbumComments({ ...albumComments, [id]: '' });
  };

  // 🔥 [신규 추가] 카카오톡 자동 연동 초대 함수
  const handleKakaoInvite = async () => {
    let currentFamilyId = user?.familyId;
    let myRole = user?.coupleRole;

    // 1. 방이 없으면 즉시 나홀로 방(familyId) 생성
    if (!currentFamilyId) {
      try {
        const isMom = user?.who === '산모' || user?.who === '임산부(산모)';
        myRole = isMom ? 'MOM' : 'DAD';
        await updateDoc(doc(db, 'users', user.id), { familyId: user.id, coupleRole: myRole });
        onUpdateUser({ ...user, familyId: user.id, coupleRole: myRole });
        currentFamilyId = user.id;
      } catch (e) {
        addToast('error', '초대 준비 중 오류가 발생했습니다.');
        return;
      }
    }

    // 2. 초대 코드가 없으면 새로 발급해서 파이어베이스에 저장!
    let currentInviteCode = user?.inviteCode;
    if (!currentInviteCode) {
      setIsGenerating(true);
      const newCode = await generateInviteCode(user.id);
      if (newCode) {
        currentInviteCode = newCode;
        setInviteCode(newCode);
        onUpdateUser({ ...user, inviteCode: newCode });
        await updateDoc(doc(db, 'users', user.id), { inviteCode: newCode });
      }
      setIsGenerating(false);
    }

    // 3. 카카오톡 공유창 띄우기
    const kakao = (window as any).Kakao;
    if (!kakao) {
      addToast('error', '카카오 도구를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!kakao.isInitialized()) {
      kakao.init('cef1d01b84acf6b64cabac2fc6c3df18');
    }
    
    kakao.Share.sendCustom({
      templateId: 132064,
      templateArgs: { 
        PARTNER_ID: user.id,
        INVITE_CODE: currentInviteCode || '' // 🔥 카톡 템플릿으로 코드 전송!
      }
    });
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    const code = await generateInviteCode(user.id);
    if (code) { setInviteCode(code); onUpdateUser({ ...user, inviteCode: code }); addToast('success', '초대 코드 발급!'); }
    setIsGenerating(false);
  };

  const handleLinkAccount = async () => {
    if (inputCode.trim().length !== 6) return;
    setIsLinking(true);
    const isMom = user.who === '산모' || user.who === '임산부(산모)';
    const myRole = isMom ? 'MOM' : 'DAD';
    const partnerRole = isMom ? 'DAD' : 'MOM';
    const res = await linkCoupleAccount(user.id, inputCode.trim().toUpperCase(), myRole, partnerRole);
    
    if (res.ok) {
      // 🔥 [핵심 수정] DB(users 컬렉션)에 가족ID를 영구적으로 저장! (로그아웃해도 안 풀림)
      await updateDoc(doc(db, 'users', user.id), { 
        familyId: res.familyId, 
        partnerId: res.partnerId, 
        coupleRole: myRole 
      });

      try {
        await setDoc(doc(db, 'users', res.partnerId), { partnerId: user.id }, { merge: true });
      } catch(e) {}
      
      onUpdateUser({ ...user, familyId: res.familyId, partnerId: res.partnerId, coupleRole: myRole });
      addToast('success', '부부 연결이 완벽하게 완료되었습니다! 👩‍❤️‍👨');
    } else {
      addToast('error', '앗, 코드가 맞지 않아요. 다시 확인해 주세요!');
    }
    setIsLinking(false);
  };

  // 4-1. 비로그인 유저 방어 (예쁜 잠금 화면 & 하얀 화면 크래시 방지 🛡️)
  if (!user || !user.id) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-24 font-pretendard relative w-full flex flex-col items-center justify-center px-5">
        <div className="bg-white p-8 rounded-3xl shadow-lg text-center max-w-sm w-full border border-gray-100 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-300 to-indigo-400"></div>
          <span className="text-6xl mb-4 block animate-bounce-short">🔒</span>
          <h2 className="text-xl font-black text-gray-900 mb-3">부부 라운지는<br/>로그인 후 이용할 수 있어요!</h2>
          <p className="text-xs text-gray-500 leading-relaxed font-medium mb-6 break-keep">우리 부부만의 캘린더, 교환일기, 태동 기록!<br/>아래 버튼을 눌러 바로 시작해볼까요?</p>
          <button onClick={onLoginClick} className="w-full py-4 bg-[#FEE500] text-black rounded-xl font-black shadow-md hover:bg-[#FDD800] transition-transform active:scale-95 flex items-center justify-center gap-2">
            카카오로 3초 만에 시작하기
          </button>
        </div>
      </div>
    );
  }

  // 4-2. 온보딩 UI (연동 전)
  if (!user?.familyId) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] pb-24 font-pretendard relative w-full flex flex-col items-center">
        <header className="w-full flex justify-center bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm animate-fade-in">
          <div className="w-full max-w-md px-4 py-3 flex items-center justify-between">
            <button onClick={onBack} className="p-1 -ml-1 text-gray-600 rounded-full transition-colors"><ArrowLeft size={24} /></button>
            <h2 className="font-bold text-lg leading-tight text-gray-900">👨‍👩‍👦 우리 가족 라운지</h2>
          </div>
        </header>
        <div className="w-full max-w-md mx-auto px-5 pt-8 animate-fade-in space-y-6">
          <div className="text-center">
            <span className="text-6xl mb-4 block animate-bounce-short">💌</span>
            <h2 className="text-2xl font-black text-gray-900 mb-2">혼자 하는 임신은 없어요!</h2>
            <p className="text-xs text-gray-500 leading-relaxed font-medium">배우자와 계정을 연결하고 임신 여정을 함께 공유해 보세요.</p>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-300 to-pink-400"></div>
            <h3 className="font-bold text-gray-900 mb-2 text-[15px]">배우자 초대하고 함께 쓰기</h3>
            <p className="text-[11px] text-gray-500 mb-5 break-keep">카카오톡으로 초대장을 보내면<br/>배우자와 자동으로 연결됩니다!</p>

            <button onClick={handleKakaoInvite} disabled={isGenerating} className="w-full py-4 bg-[#FEE500] text-[#3c1e1e] rounded-xl font-black flex items-center justify-center gap-2 shadow-md hover:brightness-95 transition-transform active:scale-95 text-sm">
              <MessageCircle size={18} fill="currentColor" /> {isGenerating ? '초대장 생성 중...' : '카톡으로 초대장 보내기 🚀'}
            </button>

            {/* 🚨 비상구: 자동 연결 실패 시 띄우는 직접 입력칸 */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              {!showCodeInput ? (
                <button onClick={() => setShowCodeInput(true)} className="text-[11px] text-gray-400 underline hover:text-gray-600 transition-colors">
                  혹시 자동 연결이 안 되셨나요? (직접 입력)
                </button>
              ) : (
                <div className="animate-fade-in text-left">
                  <label className="text-[11px] font-bold text-gray-600 mb-2 block">배우자 카톡에 적힌 코드 6자리 입력</label>
                  <div className="flex gap-2">
                    <input type="text" value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="코드 입력" className="flex-1 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-sm outline-none focus:border-rose-300 uppercase tracking-widest box-border" />
                    <button onClick={handleLinkAccount} disabled={inputCode.length !== 6 || isLinking} className="shrink-0 px-5 bg-gray-900 text-white rounded-xl font-bold shadow-md hover:bg-black transition-colors disabled:bg-gray-300 text-xs">
                      {isLinking ? '연결중' : '연결'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-gray-400 mb-3">아직 배우자와 연결하기 어렵다면?</p>
            <button onClick={async () => {
              if (!user?.id) return;
              try {
                // 🔥 [수정] 내가 산모인지 남편인지 파악해서 내 역할을 정확히 부여합니다!
                const isMom = user?.who === '산모' || user?.who === '임산부(산모)';
                const myRole = isMom ? 'MOM' : 'DAD';
                
                await updateDoc(doc(db, 'users', user.id), { familyId: user.id, coupleRole: myRole });
                onUpdateUser({ ...user, familyId: user.id, coupleRole: myRole });
                addToast('success', '나홀로 라운지가 생성되었습니다! 🎉 나중에 언제든 배우자를 초대할 수 있어요.');
              } catch(e) {
                addToast('error', '라운지 생성에 실패했습니다.');
              }
            }} className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm shadow-sm active:scale-95">
              일단 혼자 시작하기 🙋‍♀️
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. 메인 UI (연동 후)
  return (
    <div className="min-h-screen bg-[#f4f6f9] pb-24 font-pretendard relative w-full flex flex-col items-center">
      <header className="w-full flex flex-col items-center bg-white sticky top-0 z-40 border-b border-rose-100 shadow-sm animate-fade-in">
        <div className="w-full max-w-md px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-600 rounded-full transition-colors"><ArrowLeft size={24} /></button>
          <h2 className="font-bold text-lg leading-tight text-gray-900 flex items-center gap-1.5">👨‍👩‍👦 우리 가족 라운지</h2>
        </div>
        <div className="w-full max-w-md flex border-t border-gray-50 bg-white">
          <button onClick={() => setActiveLoungeTab('HOME')} className={`flex-1 py-3 text-[11px] font-bold border-b-2 transition-all ${activeLoungeTab === 'HOME' ? 'border-rose-500 text-rose-600' : 'text-gray-400 border-transparent'}`}>💬 홈</button>
          <button onClick={() => setActiveLoungeTab('DIARY')} className={`flex-1 py-3 text-[11px] font-bold border-b-2 transition-all ${activeLoungeTab === 'DIARY' ? 'border-emerald-500 text-emerald-600' : 'text-gray-400 border-transparent'}`}>📖 다이어리</button>
          <button onClick={() => setActiveLoungeTab('ALBUM')} className={`flex-1 py-3 text-[11px] font-bold border-b-2 transition-all ${activeLoungeTab === 'ALBUM' ? 'border-indigo-500 text-indigo-600' : 'text-gray-400 border-transparent'}`}>📸 앨범</button>
          <button onClick={() => setActiveLoungeTab('QUEST')} className={`flex-1 py-3 text-[11px] font-bold border-b-2 transition-all ${activeLoungeTab === 'QUEST' ? 'border-blue-500 text-blue-600' : 'text-gray-400 border-transparent'}`}>⚔️ 퀘스트</button>
        </div>
      </header>

      <div className="w-full max-w-md mx-auto px-4 pt-4 space-y-6 box-border">
        {/* --- 탭 1: HOME --- */}
        {/* --- 탭 1: HOME --- */}
        {activeLoungeTab === 'HOME' && (
          <div className="space-y-5 animate-fade-in pb-10">
            {/* 👨‍👩‍👦 D-Day & 부부 모습 & 아기의 한마디 복구! */}
            {user?.dueDate ? (
              <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden text-center relative">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-300 to-pink-400"></div>
                
                {/* 상단: 부부 모습 & D-Day */}
                <div className="p-6 bg-rose-50 border-b border-rose-100 flex flex-col items-center">
                  <span className="text-4xl mb-3 animate-bounce-short">👨‍👩‍👦</span>
                  <h3 className="font-extrabold text-rose-600 text-lg tracking-tight leading-snug break-keep">
                    여보, 우리 {user?.babyName && user.babyName !== '아직 고민중이에요' ? user.babyName : '아기'}와 만날 날<br/>D-{exactDDay}일 남았어!
                  </h3>
                </div>

                {/* 하단: 아기 크기 & 💌 아기의 한마디 말풍선 */}
                <div className="p-5 flex flex-col items-center gap-4">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-4xl">{babySize.emoji}</span>
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-rose-400 mb-0.5 tracking-tight">이번 주 우리 아기는</p>
                      <h4 className="font-extrabold text-[15px] text-gray-800 tracking-tight leading-none">
                        [{babySize.name}] <span className="text-sm font-bold text-gray-600">만해요!</span>
                      </h4>
                    </div>
                  </div>

                  {/* 💬 [복구 완료] 아기의 따뜻한 한마디 말풍선 */}
                  <div className="relative bg-white border-2 border-rose-100 px-5 py-3 rounded-2xl shadow-sm max-w-[90%] group">
                    {/* 말풍선 꼬리 */}
                    <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l-2 border-t-2 border-rose-100 rotate-45"></div>
                    
                    <p className="text-[13px] font-bold text-rose-700 leading-relaxed break-keep relative z-10">
                      {currentWeek <= 4 ? "엄마, 아빠! 저 여기 있어요! 이제 막 여행을 시작했어요. ✨" :
                       currentWeek <= 8 ? "콩닥콩닥! 제 심장 소리 들리시나요? 엄마 사랑해요! ❤️" :
                       currentWeek <= 12 ? "이제 손발이 생겨서 꼼지락거리고 있어요! 아빠 목소리 들려주세요 🎵" :
                       currentWeek <= 16 ? "엄마, 오늘은 맛있는 게 먹고 싶어요! 냠냠 😋" :
                       currentWeek <= 20 ? "영차! 뱃속에서 기지개를 켜봤어요. 제 움직임이 느껴지시나요? 👣" :
                       currentWeek <= 24 ? "세상 밖 소리가 잘 들려요! 엄마 아빠의 다정한 목소리가 제일 좋아요 💛" :
                       currentWeek <= 28 ? "조금 좁긴 하지만, 엄마 뱃속이 세상에서 제일 따뜻하고 안락해요 🏠" :
                       currentWeek <= 32 ? "이제 눈을 떴다 감았다 할 수 있어요! 빨리 보고 싶어요 엄마! 👀" :
                       currentWeek <= 36 ? "세상에 나갈 준비 완료! 머리를 아래로 쏙 내리고 기다리고 있을게요 👶" :
                       "엄마, 아빠! 이제 곧 만나요. 열 달 동안 저를 지켜주셔서 고마워요. 사랑해요! 🌸"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden text-center relative p-8">
                <span className="text-5xl mb-3 block animate-bounce-short">👼</span>
                <h3 className="font-extrabold text-lg text-gray-900 mb-2">우리 아기, 언제 세상에 나오나요?</h3>
                <p className="text-xs text-gray-500 mb-5 leading-relaxed break-keep">출산 예정일을 알려주시면 매주 쑥쑥 자라는<br/>아기 크기와 D-Day를 보여드릴게요!</p>
                <button onClick={() => {
                  if (onGoToMoms) onGoToMoms('dashboard');
                }} className="w-full py-4 bg-rose-500 text-white rounded-xl font-bold shadow-md hover:bg-rose-600 active:scale-95 transition-transform text-sm">
                  출산 예정일 입력하러 가기 🚀
                </button>
              </div>
            )}

            {/* 🔥 [신규] 나홀로 모드일 때 남편 초대 배너 노출 (카톡 공유로 변경) */}
            {user?.familyId === user?.id && !user?.partnerId && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between mt-4">
                <div>
                  <h3 className="font-bold text-indigo-900 text-sm mb-1 flex items-center gap-1.5"><span className="animate-pulse">💌</span> 남편 초대하기</h3>
                  <p className="text-[11px] text-indigo-700 break-keep leading-snug">나홀로 라운지를 즐기고 계시군요!<br/>카톡으로 간편하게 초대장을 보내세요.</p>
                </div>
                <button onClick={handleKakaoInvite} className="shrink-0 bg-[#FEE500] text-[#3c1e1e] text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-md hover:brightness-95 transition-transform active:scale-95 flex items-center gap-1">
                  <MessageCircle size={14} fill="currentColor"/> 카톡 초대
                </button>
              </div>
            )}

            {/* 🚨 아빠 출동 SOS 상황판 (리모컨 패널) */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mt-5 animate-fade-in">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5"><span className="text-lg">🚨</span> 아빠 출동 SOS</h4>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-700 tracking-tight">아빠 자유시간</span>
                  <div className="flex gap-1">
                    {[1,2,3].map(n => <div key={n} className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${n <= (familyData.couponGauge||0) ? 'bg-blue-500 text-white' : 'bg-white border border-blue-200 text-transparent'}`}>👑</div>)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] font-bold text-blue-600 mb-4 tracking-tight leading-relaxed">🦸‍♂️ 남편이 아내의 SOS를 3번 해결하면 3시간 자유시간권이 생겨요!</p>
              
              {/* 🔥 엄마만 SOS 보낼 수 있게 분기 처리 */}
              {user?.coupleRole === 'MOM' ? (
                <div className="shrink-0 mb-2">
                  <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                    {['🍔 야식셔틀', '💆‍♀️ 안마요청', '🏃‍♂️ 잔심부름', '🧹 집안일 헬프', '🥰 칭찬해줘요', '💬 그냥 심심해', '🙋‍♀️ 긴급호출'].map(t => (
                      <button key={t} onClick={()=>setSosType(t)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border shrink-0 transition-all ${sosType === t ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-inner' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>{t}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={sosText} onChange={e=>setSosText(e.target.value)} placeholder="우리만의 메시지를 적어보세요!" className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-300 box-border" />
                    <button onClick={handleSendSos} disabled={!sosText.trim()} className="shrink-0 whitespace-nowrap px-4 bg-gray-900 text-white rounded-xl font-bold text-xs shadow-md hover:bg-black transition-transform active:scale-95 disabled:bg-gray-300">요청 🚀</button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center mb-2">
                  <span className="text-2xl mb-1 block">🦸‍♂️</span>
                  <p className="text-[11px] font-bold text-blue-800">아내의 긴급 호출을 대기하는 중입니다!</p>
                  <p className="text-[10px] text-blue-600 mt-1">호출을 완료하면 자유시간 게이지가 올라가요.</p>
                </div>
              )}

              {/* 🎟️ 아빠 쿠폰 여러 개 사용 UI (아빠일 때만 노출) */}
              {user?.coupleRole === 'DAD' && (familyData.dadCoupons || 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold text-gray-800 flex items-center gap-1"><span className="text-base">🎟️</span> 내 쿠폰함</p>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">보유: {familyData.dadCoupons}장</span>
                  </div>
                  <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-inner">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm shrink-0">
                        <button onClick={() => setCouponCountToUse(Math.max(1, couponCountToUse - 1))} className="px-2.5 py-1.5 text-gray-500 font-bold bg-gray-50 hover:bg-gray-100">-</button>
                        <span className="text-[11px] font-black text-gray-800 w-6 text-center">{couponCountToUse}</span>
                        <button onClick={() => setCouponCountToUse(Math.min(familyData.dadCoupons, couponCountToUse + 1))} className="px-2.5 py-1.5 text-gray-500 font-bold bg-gray-50 hover:bg-gray-100">+</button>
                      </div>
                      <span className="text-[10px] text-gray-500 font-bold shrink-0">장 사용</span>
                    </div>
                    <div className="flex gap-1.5 w-full">
                      <input type="text" value={approvalReason} onChange={e=>setApprovalReason(e.target.value)} placeholder="어디에 쓸까요? 예: 저녁 모임" className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[11px] outline-none focus:border-indigo-400 min-w-0 shadow-sm" />
                      <button onClick={() => { handleRequestCouponApproval(approvalReason, couponCountToUse); setApprovalReason(''); setCouponCountToUse(1); }} disabled={!approvalReason.trim()} className="shrink-0 bg-indigo-500 text-white px-3 py-2 rounded-lg text-[11px] font-bold shadow-md hover:bg-indigo-600 disabled:bg-gray-400 transition-all">결재 올리기 🚀</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 💬 봄봄톡 (부부 전용 카톡방) */}
            <div className="bg-[#b2c7d9] p-4 rounded-3xl shadow-inner mt-5 flex flex-col h-[550px] relative overflow-hidden animate-fade-in border border-gray-300">
              
              {/* 🔥 대표님이 요청하신 세련된 흰색 알약 형태의 타이틀! */}
              <div className="bg-white rounded-full py-2.5 px-5 mb-2 mx-auto shadow-sm inline-flex items-center gap-2 border border-gray-100 z-10">
                <span className="text-lg">🌸</span>
                <h4 className="font-black text-gray-800 text-[13px] tracking-tight">봄봄톡</h4>
              </div>
              <p className="text-center text-[10px] text-gray-600/80 mb-4 font-bold tracking-tight z-10 leading-snug">
                우리 부부만의 프라이빗 메신저 💌<br/>일상 대화도 나누고 미션 알림도 확인해요!
              </p>

              <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col-reverse gap-3 pb-2 relative z-10">
                {familyData.sosLogs && familyData.sosLogs.length > 0 ? (
                  (() => {
                    let lastDate = "";
                    return [...familyData.sosLogs].reverse().map((sos: any, idx: number) => {
                      // 🔥 타임스탬프(id)로 날짜 텍스트 만들기
                      const msgDate = new Date(sos.id).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                      const isNewDate = msgDate !== lastDate;
                      lastDate = msgDate;

                      return (
                        <React.Fragment key={sos.id || idx}>
                          {/* 🔥 다음 메시지 블럭 시작 */}
                          <div className={`flex w-full animate-fade-in ${sos.senderRole === user?.coupleRole ? 'justify-end' : 'justify-start'}`}>
                            {sos.type === '일상' ? (
                              // 💬 일반 일상 대화 말풍선
                              <div className={`flex items-end gap-1.5 max-w-[75%] ${sos.senderRole === user?.coupleRole ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`p-3 rounded-2xl text-[13px] font-medium shadow-sm leading-relaxed break-keep ${sos.senderRole === user?.coupleRole ? 'bg-[#FEE500] text-[#3c1e1e] rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'}`}>
                                  {sos.text}
                                </div>
                                <span className="text-[9px] text-gray-500 font-bold shrink-0 opacity-80">{sos.time}</span>
                              </div>
                            ) : (
                              // 🚨 특수 미션 / 알림 말풍선 (가운데 정렬된 카드 형태)
                              <div className="flex flex-col items-center w-full my-2 animate-fade-in" onClick={() => handleReadSos(sos)}>
                                <div className="bg-white/95 backdrop-blur-sm border border-white/50 p-4 rounded-2xl shadow-sm w-[90%] flex flex-col gap-2 relative">
                                  {user?.coupleRole === 'DAD' && !sos.isReadByDad && sos.type !== '일상' && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">N</span>}
                                  {user?.coupleRole === 'MOM' && !sos.isReadByMom && sos.type !== '일상' && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">N</span>}
                                  
                                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-1">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${sos.type === '🎫 결재 요청' ? 'bg-indigo-50 text-indigo-600' : sos.type === '📅 일정 공유' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{sos.type}</span>
                                    <span className="text-[9px] text-gray-400 font-bold">{sos.time}</span>
                                  </div>
                                  <p className="text-xs font-bold text-gray-800 whitespace-pre-wrap leading-relaxed">{sos.text}</p>
                                  
                                  {sos.status === '대기중' && user?.coupleRole === 'DAD' && sos.type !== '📅 일정 공유' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleReplySos(sos.id); }} className="mt-2 w-full py-2.5 bg-blue-500 text-white rounded-xl text-[11px] font-bold shadow-sm hover:bg-blue-600 transition-colors active:scale-95">임무 완료 🦸‍♂️</button>
                                  )}
                                  {sos.status === '결재대기' && user?.coupleRole === 'MOM' && (
                                    <div className="flex gap-2 mt-2 w-full">
                                      <button onClick={(e) => { e.stopPropagation(); handleProcessApproval(sos.id, true); }} className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-[11px] font-bold shadow-sm active:scale-95">🟢 승인</button>
                                      <button onClick={(e) => { e.stopPropagation(); handleProcessApproval(sos.id, false); }} className="flex-1 bg-rose-500 text-white py-2.5 rounded-xl text-[11px] font-bold shadow-sm active:scale-95">🔴 반려</button>
                                    </div>
                                  )}
                                  {(sos.status === '완료' || sos.status === '승인됨' || sos.status === '반려됨') && (
                                    <div className={`mt-2 p-2.5 rounded-xl text-[11px] font-bold text-center ${sos.status === '승인됨' || sos.status === '완료' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                      {sos.replyText || '임무 완수! ✨'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* 🔥 이전 메시지와 날짜가 다를 때만 렌더링 (날짜 구분선) */}
                          {isNewDate && (
                            <div className="flex justify-center my-3 animate-fade-in w-full">
                              <div className="bg-black/10 backdrop-blur-sm text-white text-[10px] px-3 py-1 rounded-full font-bold">
                                {msgDate}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-white opacity-60 h-full">
                    <span className="text-4xl mb-2">💬</span>
                    <span className="text-xs font-bold text-center">자유롭게 일상 대화도 나누고<br/>미션도 확인해 보세요!</span>
                  </div>
                )}
              </div>
              
              {/* 봄봄톡 하단 일반 채팅 입력창 */}
              <form onSubmit={handleSendBomTalk} className="mt-3 flex gap-2 items-center bg-white p-1.5 rounded-full shadow-sm shrink-0 relative z-10">
                <input value={bomTalkInput} onChange={e=>setBomTalkInput(e.target.value)} placeholder="우리 부부만의 대화를 나눠보세요!" className="flex-1 min-w-0 bg-transparent px-3 text-sm outline-none" />
                <button type="submit" disabled={!bomTalkInput.trim()} className="shrink-0 w-9 h-9 rounded-full bg-[#FEE500] text-[#3c1e1e] flex items-center justify-center disabled:opacity-50 transition-opacity active:scale-95"><Send size={14} className="ml-0.5"/></button>
              </form>
            </div>

            {/* 🗓️ 부부 공유 만능 이모티콘 캘린더 */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mt-5 mb-5 relative overflow-hidden">
              <div className="flex justify-between items-center mb-1">
                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5"><span className="text-lg">🗓️</span> 우리 부부 캘린더</h4>
                <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 shadow-inner">
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-gray-400 hover:text-rose-500 font-black px-1">&lt;</button>
                  <span className="text-[11px] font-bold text-gray-700 w-16 text-center">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-gray-400 hover:text-rose-500 font-black px-1">&gt;</button>
                </div>
              </div>
              <p className="text-[9px] text-gray-500 mb-4 italic tracking-tight break-keep">💡 날짜를 클릭해 일정을 추가해보세요! 첫 태동과 앨범 사진은 자동으로 찍힙니다.</p>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div key={d} className={`text-[10px] font-black pb-1 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square bg-transparent"></div>
                ))}
                {Array.from({ length: getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth()) }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = formatDateStr(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                  const isToday = dateStr === formatDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                  const dayEvents = getEventsForDate(dateStr);
                  
                  return (
                    <div key={day} onClick={() => { 
                      setSelectedDateStr(dateStr); 
                      setEventText(''); 
                      setEventEmoji('🏥'); 
                      setEditingEventId(null); 
                      dayEvents.length > 0 ? setShowCalendarListModal(true) : setShowCalendarAddModal(true); 
                    }} className={`aspect-square relative flex flex-col items-center border rounded-xl cursor-pointer hover:bg-rose-50 transition-colors ${isToday ? 'bg-rose-50 border-rose-200' : 'bg-white border-gray-100'} p-1 box-border active:scale-95`}>
                      <span className={`text-[9px] font-black z-10 ${isToday ? 'text-rose-600' : 'text-gray-500'}`}>{day}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex-1 flex items-center justify-center w-full relative">
                          <span className="text-xl drop-shadow-sm">{dayEvents[0].emoji}</span>
                          {dayEvents.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-rose-500 text-white text-[8px] font-black px-1 rounded-full shadow-sm">+{dayEvents.length - 1}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- 탭 2: DIARY --- */}
        {activeLoungeTab === 'DIARY' && (
          <div className="space-y-4 animate-fade-in pb-10">
            {/* 다이어리 서브 네비게이션 */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 border-b border-gray-100 mb-4 px-1">
              <button onClick={() => setDiarySubTab('NOTE')} className={`px-4 py-2 rounded-full text-[11px] font-bold shrink-0 transition-all border shadow-sm ${diarySubTab === 'NOTE' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>💌 교환일기</button>
              <button onClick={() => setDiarySubTab('KICK')} className={`px-4 py-2 rounded-full text-[11px] font-bold shrink-0 transition-all border shadow-sm ${diarySubTab === 'KICK' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>👣 태동 기록</button>
              <button onClick={() => setDiarySubTab('EMOTION')} className={`px-4 py-2 rounded-full text-[11px] font-bold shrink-0 transition-all border shadow-sm ${diarySubTab === 'EMOTION' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>💛 감정 일기</button>
              <button onClick={() => setDiarySubTab('SYMPTOM')} className={`px-4 py-2 rounded-full text-[11px] font-bold shrink-0 transition-all border shadow-sm ${diarySubTab === 'SYMPTOM' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>🩺 증상 기록</button>
              <button onClick={() => setDiarySubTab('WEIGHT')} className={`px-4 py-2 rounded-full text-[11px] font-bold shrink-0 transition-all border shadow-sm ${diarySubTab === 'WEIGHT' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>⚖️ 체중 변화</button>
              <button onClick={() => setDiarySubTab('LEDGER')} className={`px-4 py-2 rounded-full text-[11px] font-bold shrink-0 transition-all border shadow-sm ${diarySubTab === 'LEDGER' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>💰 육아 가계부</button>
            </div>

            {/* 교환일기 문구 및 ✨ 복구 복구 */}
            {diarySubTab === 'NOTE' && (
              <div className="animate-fade-in space-y-4">
                <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Week {currentWeek} Mission</span>
                      <span className="animate-pulse text-xs">✨</span>
                    </div>
                    <h4 className="font-extrabold text-[15px] leading-relaxed break-keep drop-shadow-md">
                      "{LOUNGE_WEEKLY_QUESTIONS[currentWeek] || "이번 주, 서로에게 하고 싶은 따뜻한 한마디를 자유롭게 남겨보세요!"}"
                    </h4>
                  </div>
                  <span className="absolute -right-4 -bottom-4 text-[100px] opacity-10 rotate-12 pointer-events-none">✍️</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-1 h-4 bg-rose-500 rounded-full"></span>
                    <h4 className="font-bold text-gray-800 text-sm">여보의 답변 남기기</h4>
                  </div>
                  <div className="flex gap-2">
                    <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="여보의 솔직한 마음을 적어주세요..." className="flex-1 min-w-0 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-rose-300 resize-none h-24 transition-all box-border" />
                    <button onClick={handleSaveDiaryNote} className="shrink-0 whitespace-nowrap px-6 bg-rose-500 text-white rounded-2xl font-black text-sm hover:bg-rose-600 shadow-md h-24 transition-transform active:scale-95">저장</button>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100 mt-6 animate-fade-in">
                  <div className="flex items-center justify-between px-1 mb-6">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><span className="text-sm">📮</span> Our 280 Days Time Capsule</p>
                  </div>
                  
                  {/* 🔥 임신 주기별(Trimester)로 섹션 분리 */}
                  {[
                    { title: '🍎 만남을 준비하며 (28~40주)', start: 28, end: 40, emoji: '🍎' },
                    { title: '🌿 태동과 교감 (14~27주)', start: 14, end: 27, emoji: '🌿' },
                    { title: '🌱 설렘과 기다림 (1~13주)', start: 1, end: 13, emoji: '🌱' }
                  ].map((trimester) => {
                    if (currentWeek < trimester.start) return null;

                    return (
                      <div key={trimester.title} className="mb-10">
                        <h4 className="text-sm font-black text-gray-800 mb-4 px-1 flex items-center gap-1.5">
                          {trimester.title}
                        </h4>
                        
                        {/* 🔥 넷플릭스형 가로 스와이프 컨테이너 (snap 적용으로 앱 같은 스크롤감) */}
                        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-4 pl-1 pr-6">
                          {Array.from({ length: trimester.end - trimester.start + 1 }).map((_, i) => {
                            const w = trimester.end - i; 
                            if (w >= currentWeek || w < 1) return null; 
                            
                            const c = familyData.diaryNotes?.[w] || {};
                            const isMomDone = !!c.mom;
                            const isDadDone = !!c.dad;
                            const isBothDone = isMomDone && isDadDone;
                            const isNone = !isMomDone && !isDadDone;
                            
                            return (
                              <div 
                                key={w} 
                                onClick={() => setSelectedDiaryWeek(w)} 
                                // 🔥 모바일 화면의 85%를 차지하는 1단 넓은 카드 + snap-center
                                className={`min-w-[85%] sm:min-w-[300px] snap-center shrink-0 p-6 rounded-[24px] cursor-pointer transition-transform active:scale-95 flex flex-col justify-between h-48 relative overflow-hidden ${
                                  isBothDone 
                                    ? 'bg-[#fcfaf8] border border-stone-200 shadow-md' // 완성된 엽서
                                    : !isNone 
                                      ? 'bg-rose-50/50 border border-rose-100 shadow-sm' // 대기중
                                      : 'bg-white border-2 border-dashed border-gray-200 opacity-80 hover:opacity-100' // 미작성
                                }`}
                              >
                                <div>
                                  <div className="flex justify-between items-center mb-3">
                                    <span className={`text-xs font-black tracking-wider uppercase ${isBothDone ? 'text-stone-400' : 'text-gray-400'}`}>WEEK {w}</span>
                                    <span className="text-xl opacity-20">{trimester.emoji}</span>
                                  </div>
                                  
                                  <p className={`text-[13px] sm:text-sm font-bold break-keep leading-relaxed ${isBothDone ? 'text-stone-700 border-l-2 border-stone-300 pl-3' : 'text-gray-700 line-clamp-3'}`}>
                                    {getDiaryQuestion(w)}
                                  </p>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-gray-100/50 pt-3">
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${
                                    isBothDone ? 'bg-stone-100 text-stone-600' : !isNone ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {isBothDone ? '기록 완성 💌' : !isNone ? '답변 대기중 🔒' : '편지 쓰기 ✍️'}
                                  </span>
                                  {isBothDone && <span className="text-[10px] text-stone-400 font-bold">눌러서 열어보기</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 📝 다이어리 열람 & 보충 팝업 모달 */}
                {selectedDiaryWeek !== null && (
                  <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 animate-fade-in backdrop-blur-sm" onClick={() => { setSelectedDiaryWeek(null); setModalNoteInput(''); }}>
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-7 relative max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setSelectedDiaryWeek(null); setModalNoteInput(''); }} className="absolute top-5 right-5 text-gray-400 hover:text-gray-800 font-bold transition-colors z-10">✕</button>
                      
                      <div className="mb-6 pr-4 shrink-0">
                        <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-md mb-2 inline-block">WEEK {selectedDiaryWeek}</span>
                        <h3 className="text-[15px] font-bold text-gray-900 leading-relaxed break-keep mt-1">{getDiaryQuestion(selectedDiaryWeek)}</h3>
                      </div>

                      <div className="space-y-4 shrink-0">
                        {/* 엄마 답변 영역 */}
                        <div>
                          <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mb-1">엄마의 기록</span>
                          <div className={`p-3.5 rounded-xl text-xs leading-relaxed break-keep ${familyData?.diaryNotes?.[selectedDiaryWeek]?.mom ? 'bg-rose-50 text-gray-800' : 'bg-gray-50 text-gray-400'}`}>
                            {familyData?.diaryNotes?.[selectedDiaryWeek]?.mom || '아직 기록을 남기지 않았어요.'}
                          </div>
                        </div>
                        
                        {/* 아빠 답변 영역 (자물쇠 블러 처리 로직 포함) */}
                        <div>
                          <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mb-1">아빠의 기록</span>
                          <div className={`p-3.5 rounded-xl text-xs leading-relaxed break-keep ${familyData?.diaryNotes?.[selectedDiaryWeek]?.dad ? 'bg-blue-50 text-gray-800' : 'bg-gray-50 text-gray-400'}`}>
                            {(() => {
                              const note = familyData?.diaryNotes?.[selectedDiaryWeek];
                              const myRole = user?.coupleRole;
                              if (!note?.dad) return '아직 기록을 남기지 않았어요.';
                              if (myRole === 'MOM' && !note?.mom) return <span className="flex items-center gap-1.5"><span className="text-base">🔒</span> 내가 먼저 답변을 남겨야 열려요!</span>;
                              return note.dad;
                            })()}
                          </div>
                        </div>

                        {/* 내 답변 추가 입력창 */}
                        {((user?.coupleRole === 'MOM' && !familyData?.diaryNotes?.[selectedDiaryWeek]?.mom) || 
                          (user?.coupleRole === 'DAD' && !familyData?.diaryNotes?.[selectedDiaryWeek]?.dad)) && (
                          <div className="pt-4 mt-2 border-t border-gray-100 animate-fade-in">
                            <p className="text-[10px] font-bold text-gray-500 mb-2">과거 일기 보충하기 ✍️</p>
                            <div className="flex gap-2">
                              <input type="text" value={modalNoteInput} onChange={e => setModalNoteInput(e.target.value)} placeholder="지금이라도 마음을 적어주세요!" className="flex-1 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400 box-border" />
                              <button onClick={() => handleSaveModalDiaryNote(selectedDiaryWeek)} disabled={!modalNoteInput.trim()} className="shrink-0 bg-gray-900 text-white px-4 rounded-xl font-bold text-xs shadow-md active:scale-95 disabled:bg-gray-300">저장</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {diarySubTab === 'KICK' && (
              <div className="animate-fade-in space-y-4 pb-10">
                <button onClick={handleLogKick} className="w-full bg-gradient-to-r from-orange-400 to-rose-500 p-6 rounded-3xl shadow-md transform active:scale-95 transition-all text-white flex flex-col items-center gap-1 border border-rose-200">
                  <span className="text-4xl animate-bounce-short">👣</span>
                  <span className="font-black text-lg tracking-tight">앗! 방금 아기가 찼어요!</span>
                  <span className="text-[10px] font-medium opacity-80 whitespace-nowrap">시간 기록 & 남편에게 긴급 알림 전송 🚨</span>
                </button>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 text-4xl opacity-10 rotate-12 pointer-events-none">🧱</div>
                  <h4 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">📖 우리의 280일 태동 블럭 타임라인</h4>
                  
                  {/* 🔥 [수정] 태동 스크롤 ref 및 현재 주차 마커 연동 */}
                  <div ref={kickScrollRef} className="h-56 w-full bg-gray-50 rounded-xl pt-12 p-4 overflow-x-auto border border-gray-100 flex items-end no-scrollbar scroll-smooth relative">
                    <div className="flex items-end gap-2.5 min-w-max h-full border-b border-gray-200/50 pb-1">
                      {Array.from({ length: 41 }).map((_, week) => {
                        const kicksInWeekLog = familyData?.kickLogs?.filter((log: any) => parseInt(log.week) === week) || [];
                        const kicksCount = kicksInWeekLog.length;
                        const bigBlocks = Math.floor(kicksCount / 5);
                        const smallBlocks = kicksCount % 5;
                        const isFirstKickWeek = familyData?.kickLogs && familyData.kickLogs.length > 0 && kicksInWeekLog.includes(familyData.kickLogs[0]);
                        const isCurrent = week === currentWeek; // 📍 현재 주차 여부

                        return (
                          <div key={week} className={`flex flex-col-reverse items-center w-7 gap-1 group relative h-full rounded-t-xl transition-colors ${isCurrent ? 'bg-rose-50/50' : ''}`}>
                            {isCurrent && (
                              <div className="absolute -top-1 whitespace-nowrap z-20 flex flex-col items-center animate-bounce-short">
                                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md">📍 현재 {week}주</span>
                                <div className="w-1.5 h-1.5 bg-rose-500 rotate-45 -mt-1"></div>
                              </div>
                            )}
                            <span className={`text-[8px] mt-1.5 font-black tracking-tight ${isCurrent ? 'text-rose-500' : 'text-gray-400'}`}>{week}주</span>
                            {Array.from({ length: smallBlocks }).map((_, i) => (
                              <div key={`s-${i}`} className="w-4 h-2 bg-orange-300 rounded-sm shadow-inner shrink-0 transition-all group-hover:bg-orange-400"></div>
                            ))}
                            {Array.from({ length: bigBlocks }).map((_, i) => (
                              <div key={`b-${i}`} className="w-4 h-7 bg-orange-600 rounded-sm shadow-md border-t border-white/30 relative flex items-center justify-center shrink-0 transition-all group-hover:bg-orange-700">
                                <span className="text-[8px] text-white font-black">5</span>
                              </div>
                            ))}
                            {isFirstKickWeek && (
                              <div className="text-lg animate-pulse drop-shadow-md mb-1">👣</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-3 text-center italic leading-relaxed break-keep tracking-tight">"첫 태동은 봄이옴 꽃이 찍혀요! 블럭이 5개가 되면 대왕 블럭으로 변신!"</p>
                  
                  {familyData?.kickLogs && familyData.kickLogs.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Kick Logs</p>
                      {[...familyData.kickLogs].reverse().slice(0, 10).map((log: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-orange-50 p-3.5 rounded-xl border border-orange-100 shadow-sm animate-fade-in">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-orange-500 bg-white px-1.5 py-0.5 rounded shadow-sm">{log.week}주차</span>
                            <span className="text-xs font-bold text-gray-800">{log.date}</span>
                          </div>
                          <span className="text-xs font-black text-orange-600 tracking-tight">{log.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {diarySubTab === 'EMOTION' && (
              <div className="animate-fade-in space-y-5">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 text-4xl opacity-10 rotate-12 pointer-events-none">📈</div>
                  <h4 className="font-bold text-gray-800 text-sm mb-4 flex justify-between items-center relative z-10">
                    <span>📉 우리의 280일 감정 흐름</span>
                    <div className="flex gap-2 text-[9px] font-bold">
                      <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-rose-400"></i> 아내</span>
                      <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-gray-900"></i> 남편</span>
                    </div>
                  </h4>
                  
                  {/* 🔥 [수정] 감정 스크롤 ref, Sticky Y축, 점 중앙 정렬, 선 연결 */}
                  <div ref={emotionScrollRef} className="relative border border-gray-100 rounded-xl h-52 overflow-x-auto bg-white/50 backdrop-blur-sm shadow-inner no-scrollbar scroll-smooth flex">
                    
                    {/* 🔥 1. 스크롤해도 왼쪽에 찰싹 붙어있는 Y축 (Sticky) */}
                    <div className="sticky left-0 top-0 bottom-0 w-10 bg-white/90 backdrop-blur-md z-30 border-r border-gray-100 shrink-0 shadow-[2px_0_5px_rgba(0,0,0,0.02)] h-full">
                      {['😄','🥰','🤢','😢','😡'].map((e, i) => (
                        <span key={e} className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl" style={{ top: `${10 + i * 20}%` }}>{e}</span>
                      ))}
                    </div>

                    {/* 🔥 2. 스크롤 되는 그래프 영역 */}
                    <div className="relative h-full box-border" style={{ width: '1400px', flexShrink: 0 }}>
                      
                      {/* 세로선 (주차) */}
                      {Array.from({ length: 41 }).map((_, i) => {
                        const isCurrent = i === currentWeek;
                        return (
                          <div key={i} className={`absolute top-0 bottom-0 border-l ${isCurrent ? 'border-rose-300 border-dashed bg-rose-50/40' : i%5===0?'border-gray-300/60':'border-gray-200/50'} z-0`} style={{ left: `${(i / 40) * 100}%`, width: `${100/40}%` }}>
                            {isCurrent && (
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 whitespace-nowrap z-20">
                                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md">📍 현재</span>
                              </div>
                            )}
                            <span className={`text-[8px] font-bold absolute bottom-1 ml-1 ${isCurrent ? 'text-rose-500' : 'text-gray-300'}`}>{i}주</span>
                          </div>
                        );
                      })}

                      {/* 🔥 3. 점과 점을 잇는 얇은 선 (SVG) */}
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {(() => {
                          const mappedLogs = (familyData?.emotionLogs || []).map((log: any, idx: number) => {
                            const x = (parseInt(log.week) / 40) * 100 + (idx % 10 * 0.15);
                            const y = 10 + ['😄','🥰','🤢','😢','😡'].indexOf(log.emoji) * 20;
                            return { ...log, x, y };
                          });
                          const wifePoints = mappedLogs.filter((l:any) => l.writer === '아내').map((l:any) => `${l.x},${l.y}`).join(' ');
                          const husbandPoints = mappedLogs.filter((l:any) => l.writer === '남편').map((l:any) => `${l.x},${l.y}`).join(' ');
                          return (
                            <>
                              {wifePoints && <polyline points={wifePoints} fill="none" stroke="#fb7185" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />}
                              {husbandPoints && <polyline points={husbandPoints} fill="none" stroke="#111827" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />}
                            </>
                          );
                        })()}
                      </svg>

                      {/* 🔥 4. 정확히 이모티콘 중앙에 꽂히는 점 (-translate-x-1/2, -translate-y-1/2 적용) */}
                      {familyData?.emotionLogs?.map((log: any, idx: number) => {
                        const x = (parseInt(log.week) / 40) * 100 + (idx % 10 * 0.15);
                        const y = 10 + ['😄','🥰','🤢','😢','😡'].indexOf(log.emoji) * 20;
                        return <div key={idx} className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-md z-20 transition-transform hover:scale-150 ${log.writer === '아내' ? 'bg-rose-400' : 'bg-gray-900'}`} style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}></div>;
                      })}
                    </div>
                  </div>
                </div>

                {/* --- 감정 입력 폼 영역 (기존 유지) --- */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-5">
                  <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1.5"><span className="text-lg">💛</span> 오늘 하루, 기분이 어땠나요?</h4>
                  <div className="flex justify-between px-2 mb-4 gap-1">
                    {['😄', '🥰', '🤢', '😢', '😡'].map(emoji => (
                      <button key={emoji} onClick={() => setEmotionEmoji(emoji)} className={`text-4xl transition-all ${emotionEmoji === emoji ? 'scale-125 drop-shadow-md' : 'opacity-30 grayscale'}`}>{emoji}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 w-full box-border">
                    <input type="text" value={emotionText} onChange={e => setEmotionText(e.target.value)} placeholder="오늘 기분, 왜 그랬어? 🥺" className="flex-1 min-w-0 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none box-border" />
                    <button onClick={handleSaveEmotion} className="shrink-0 whitespace-nowrap px-5 bg-yellow-400 text-yellow-900 rounded-xl font-black text-sm shadow-md transition-transform active:scale-95">저장</button>
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <p className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-widest">Emotion Diary Logs</p>
                  {familyData?.emotionLogs?.length > 0 ? [...familyData.emotionLogs].reverse().map((log: any, idx: number) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-3 animate-fade-in">
                      <span className="text-4xl">{log.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-black ${log.writer === '아내' ? 'text-rose-500' : 'text-gray-900'}`}>{log.writer}의 감정</span>
                          <span className="text-[9px] text-gray-400 font-medium">{log.date} ({log.week}주차)</span>
                        </div>
                        <p className="text-xs text-gray-700 font-medium leading-relaxed break-keep leading-tight">{log.text}</p>
                      </div>
                    </div>
                  )) : <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-100 text-gray-400 text-xs">아직 기록된 감정 일기가 없어요!</div>}
                </div>
              </div>
            )}

            {/* 🩺 증상 기록 (작성자 구분 배지 추가 완료!) */}
            {diarySubTab === 'SYMPTOM' && (
              <div className="animate-fade-in space-y-4 pb-10 mt-2 px-1">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <h4 className="font-bold text-gray-800 text-sm mb-3">🩺 오늘 몸에 어떤 변화가 있었나요?</h4>
                  <div className="flex gap-2 w-full box-border">
                    <input 
                      value={symptomText} 
                      onChange={e=>setSymptomText(e.target.value)} 
                      placeholder={user?.coupleRole === 'DAD' ? "예: 아내가 허리가 아프다고 함" : "예: 갈비뼈 통증, 소화불량 등"} 
                      className="flex-1 min-w-0 w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none box-border focus:border-indigo-300" 
                    />
                    <button 
                      onClick={async () => {
                        if (!symptomText || !user?.familyId) return;
                        await setDoc(doc(db, 'families', user.familyId), { 
                          symptomLogs: arrayUnion({ 
                            date: new Date().toLocaleDateString('ko-KR'), 
                            text: symptomText, 
                            week: currentWeek,
                            writer: myName // 🔥 [핵심] 아내인지 남편인지 저장!
                          }) 
                        }, { merge: true });
                        setSymptomText('');
                        addToast('success', '오늘의 증상이 꼼꼼하게 기록되었습니다! 🩺');
                      }} 
                      className="shrink-0 whitespace-nowrap px-5 bg-indigo-500 text-white rounded-xl font-black text-sm shadow-md transition-transform active:scale-95"
                    >
                      기록
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-widest">Symptom Logs</p>
                  {familyData?.symptomLogs?.length > 0 ? [...familyData.symptomLogs].reverse().map((log: any, idx: number) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-3 animate-fade-in">
                      <span className="text-2xl mt-1">🩺</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {/* 🔥 [핵심] 누가 썼는지 색깔 배지로 완벽하게 구분! */}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${log.writer === '남편' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
                            {log.writer || '아내'}의 기록
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shadow-sm border border-indigo-100">
                            {log.week}주차
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium">{log.date}</span>
                        </div>
                        <p className="text-xs text-gray-800 font-bold leading-relaxed break-keep">
                          {log.text}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs">
                      아직 기록된 증상이 없어요!<br/>사소한 변화라도 짧게 남겨보세요.
                    </div>
                  )}
                </div>
              </div>
            )}

            {diarySubTab === 'WEIGHT' && (
              <div className="animate-fade-in space-y-4 pb-10 mt-2 px-1">
                {/* 🔥 [신규] 기준 체중이 없을 때 나타나는 온보딩 폼 */}
                {!familyData?.baseWeight ? (
                  <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm text-center animate-fade-in">
                    <span className="text-4xl mb-3 block animate-bounce-short">🌱</span>
                    <h4 className="font-bold text-gray-900 text-base mb-2">임신 전(또는 초기) 체중을 알려주세요!</h4>
                    <p className="text-[11px] text-gray-500 mb-6 break-keep leading-relaxed bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      임신 후 체중 변화는 아기가 잘 자라고 있다는 아주 건강한 증거예요!<br/>
                      정확한 변화 추이를 그래프로 보기 위해 <b>기준 체중</b>을 먼저 입력해주세요.
                    </p>
                    <div className="flex gap-2">
                      <input type="number" value={baseWeightInput} onChange={e=>setBaseWeightInput(e.target.value)} placeholder="00.0 kg" className="flex-1 min-w-0 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-black text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-200 text-center" />
                      <button onClick={handleSaveBaseWeight} disabled={!baseWeightInput} className="shrink-0 px-6 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 disabled:bg-gray-300">시작하기</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm animate-fade-in">
                    {/* 🔥 [신규] 다이내믹 체중 변화 배너 */}
                    {(() => {
                      const weightKeys = Object.keys(familyData.weightLogs || {});
                      if (weightKeys.length === 0) {
                        return (
                          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] p-3.5 rounded-xl mb-5 font-bold shadow-sm flex items-center gap-2 break-keep">
                            <span className="text-lg">🌿</span> 체중 변화는 아주 자연스러운 현상이에요! 오늘 체중을 입력하고 변화를 기록해 보세요.
                          </div>
                        );
                      }
                      const latestWeek = Math.max(...weightKeys.map(Number));
                      const latestWeight = familyData.weightLogs[latestWeek];
                      const diff = latestWeight - familyData.baseWeight;
                      
                      let bannerMsg = "";
                      let bannerColor = "bg-emerald-50 border-emerald-100 text-emerald-700";
                      let bannerIcon = "🌿";
                      
                      if (diff <= 12) {
                        bannerMsg = "건강하게 잘 유지하고 계시네요! 지금의 페이스를 응원해요.";
                      } else if (diff <= 20) {
                        bannerMsg = "아기가 쑥쑥 크고 있나 봐요! 가벼운 산책을 병행해 볼까요?";
                        bannerColor = "bg-orange-50 border-orange-100 text-orange-700";
                        bannerIcon = "🚶‍♀️";
                      } else {
                        bannerMsg = "권장 체중 증가량을 조금 넘었어요! 가벼운 식단 상담을 추천해요.";
                        bannerColor = "bg-rose-50 border-rose-100 text-rose-700";
                        bannerIcon = "🩺";
                      }
                      
                      return (
                        <div className={`${bannerColor} text-[11px] p-3.5 rounded-xl mb-5 font-bold shadow-sm flex items-center gap-2 break-keep leading-relaxed`}>
                          <span className="text-xl shrink-0">{bannerIcon}</span> 
                          <span><b className="text-sm">{diff > 0 ? `+${diff.toFixed(1)}kg! ` : ''}</b>{bannerMsg}</span>
                        </div>
                      );
                    })()}

                    <h4 className="font-bold text-gray-800 text-sm mb-4">📈 280일 체중 변화 곡선</h4>
                    
                    {/* 🔥 [신규] 체중 스크롤 ref 및 현재 주차 & Y축 가이드라인 연동 */}
                    <div ref={weightScrollRef} className="h-60 w-full bg-gray-50 rounded-xl mb-4 relative overflow-x-auto border border-gray-100 no-scrollbar box-border scroll-smooth">
                      {/* 🔥 위쪽 Padding 여백 확보 (pt-10) */}
                      <div className="h-full relative pt-10 pb-6 box-border" style={{ width: '1200px' }}>
                        
                        {/* Y축 가이드라인 (Sticky 레이블 적용) */}
                        {[0, 5, 10, 15, 20].map(add => {
                          const hPct = ((add + 5) / 30) * 100;
                          return (
                            <div key={add} className="absolute left-0 w-full border-t border-dashed border-gray-300/60 z-10 flex items-center" style={{ bottom: `${hPct}%` }}>
                              {/* 🔥 스크롤해도 화면 왼쪽에 찰싹 붙어있는 Sticky 뱃지 */}
                              <span className="sticky left-2 inline-block text-[8px] font-bold text-emerald-600 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-emerald-100 shadow-sm -mt-2.5 z-30">
                                {add === 0 ? '기준' : `+${add}kg`} ({familyData.baseWeight + add}kg)
                              </span>
                            </div>
                          );
                        })}

                        {/* 세로선 (주차) */}
                        {Array.from({ length: 41 }).map((_, i) => {
                          const isCurrent = i === currentWeek;
                          return (
                            <div key={i} className={`absolute top-0 bottom-0 border-l ${isCurrent ? 'border-emerald-300 border-dashed bg-emerald-50/40' : 'border-gray-200/50'} z-0`} style={{ left: `${(i / 40) * 100}%`, width: `${100/40}%` }}>
                              {isCurrent && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 animate-bounce-short">
                                  <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md">📍 현재</span>
                                </div>
                              )}
                              <span className={`text-[8px] absolute bottom-1 ml-1 font-bold ${isCurrent ? 'text-emerald-600' : 'text-gray-300'}`}>{i}주</span>
                            </div>
                          );
                        })}

                        {/* 🔥 선 연결 (SVG) */}
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-10">
                          {(() => {
                            const sortedWeeks = Object.keys(familyData?.weightLogs || {}).map(Number).sort((a,b)=>a-b);
                            if (sortedWeeks.length < 2) return null;
                            const points = sortedWeeks.map(week => {
                              const x = (week / 40) * 100;
                              const weight = familyData.weightLogs[week];
                              const base = familyData.baseWeight;
                              const hPct = Math.min(Math.max(((weight - (base - 5)) / 30) * 100, 0), 100);
                              const y = 100 - hPct;
                              return `${x},${y}`;
                            }).join(' ');
                            return <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
                          })()}
                        </svg>
                        
                        {/* 점 찍기 (완벽한 중앙 정렬) */}
                        {Object.entries(familyData?.weightLogs || {}).map(([week, weight]: any, idx) => {
                          const x = (parseInt(week) / 40) * 100;
                          const base = familyData.baseWeight;
                          const hPct = Math.min(Math.max(((weight - (base - 5)) / 30) * 100, 0), 100);
                          return (
                            <div key={idx} className="absolute flex flex-col items-center z-20 transition-transform hover:scale-150" style={{ left: `${x}%`, bottom: `${hPct}%`, transform: 'translate(-50%, 50%)' }}>
                              <span className="absolute bottom-3 text-[8px] font-bold text-emerald-700 bg-white/90 px-1 rounded shadow-sm border border-emerald-100 whitespace-nowrap">{weight}</span>
                              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-md border border-white"></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 w-full box-border items-center">
                      <input type="number" value={weightInput} onChange={e=>setWeightInput(e.target.value)} placeholder="00.0kg" className="flex-1 min-w-0 w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-black text-emerald-600 outline-none box-border focus:ring-2 focus:ring-emerald-200" />
                      <div className="flex flex-col gap-1.5 shrink-0 whitespace-nowrap">
                          <button onClick={handleSaveWeight} disabled={!weightInput} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md transition-transform active:scale-95 whitespace-nowrap flex items-center gap-1.5 disabled:bg-gray-300"><i className="w-1 h-1 bg-white rounded-full"></i> 오늘 기록</button>
                          <button onClick={()=>setShowWeightWeekModal(true)} className="px-3.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold text-[10px] whitespace-nowrap hover:bg-gray-200">과거 데이터?</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 🔥 [신규] 육아 가계부 렌더링 영역 (엑셀 폼) */}
            {diarySubTab === 'LEDGER' && (() => {
              const totalIncome = familyData?.ledger?.filter((l:any)=>l.type==='수입').reduce((sum:number, item:any)=>sum+item.amount, 0) || 0;
              const totalExpense = familyData?.ledger?.filter((l:any)=>l.type==='지출').reduce((sum:number, item:any)=>sum+item.amount, 0) || 0;

              return (
                <div className="animate-fade-in space-y-4 pb-10 mt-2 px-1">
                  {/* 상단: 수입/지출 요약 대시보드 */}
                  <div className="bg-gray-900 p-5 rounded-3xl shadow-lg flex justify-around items-center text-white">
                    <div className="text-center w-full flex-1">
                      <p className="text-[10px] text-gray-400 mb-1 font-bold">정부지원/기타 수입</p>
                      <p className="text-sm font-black text-blue-400">+{totalIncome.toLocaleString()}원</p>
                    </div>
                    <div className="w-px h-10 bg-gray-700"></div>
                    <div className="text-center w-full flex-1">
                      <p className="text-[10px] text-gray-400 mb-1 font-bold">병원/육아 총 지출</p>
                      <p className="text-sm font-black text-rose-400">-{totalExpense.toLocaleString()}원</p>
                    </div>
                  </div>

                  {/* 중단: 엑셀 형태의 데이터 입력 폼 */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2 w-full box-border">
                  {/* 1열: 날짜 / 수입지출 */}
                  <div className="flex gap-2 w-full">
                    <input type="date" value={ledgerDate} onChange={e=>setLedgerDate(e.target.value)} className="flex-1 w-1/2 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400 box-border" />
                    <select value={ledgerType} onChange={(e:any)=>setLedgerType(e.target.value)} className={`flex-1 w-1/2 min-w-0 p-3 border rounded-xl text-xs font-bold outline-none focus:border-gray-400 box-border ${ledgerType === '수입' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      <option value="지출">지출 (-)</option>
                      <option value="수입">수입 (+)</option>
                    </select>
                  </div>
                  
                  {/* 2열: 항목명 / 카테고리 */}
                  <div className="flex gap-2 w-full">
                    <input value={ledgerTitle} onChange={e=>setLedgerTitle(e.target.value)} placeholder="항목명 (예: 산부인과)" className="flex-1 w-1/2 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400 box-border" />
                    <input value={ledgerCategory} onChange={e=>setLedgerCategory(e.target.value)} placeholder="카테고리" className="flex-1 w-1/2 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400 box-border" />
                  </div>
                  
                  {/* 3열: 금액 / 메모 */}
                  <div className="flex gap-2 w-full">
                    <input type="number" value={ledgerAmount} onChange={e=>setLedgerAmount(e.target.value)} placeholder="금액 (숫자만)" className="flex-1 w-1/2 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-gray-400 box-border" />
                    <input value={ledgerMemo} onChange={e=>setLedgerMemo(e.target.value)} placeholder="메모 (선택)" className="flex-1 w-1/2 min-w-0 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-gray-400 box-border" />
                  </div>
                  
                  <button onClick={handleSaveLedger} className="w-full mt-2 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-transform box-border">
                    장부에 기록하기 ✍️
                  </button>
                </div>

                  {/* 하단: 가로 스크롤이 가능한 엑셀 리스트 (Table) */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-4">
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-left whitespace-nowrap min-w-[600px] border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase">날짜</th>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase">구분</th>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase">항목명</th>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase">카테고리</th>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase text-right">금액</th>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase text-center">작성자</th>
                            <th className="px-4 py-3 text-[10px] text-gray-500 font-black tracking-wider uppercase">메모</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-xs">
                          {familyData?.ledger?.length > 0 ? (
                            [...familyData.ledger].sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any) => (
                              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-gray-500 font-medium">{item.date.substring(5)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-md text-[9px] font-black ${item.type === '수입' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>{item.type}</span>
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-800">{item.title}</td>
                                <td className="px-4 py-3 text-gray-500">{item.category}</td>
                                <td className={`px-4 py-3 text-right font-black ${item.type === '수입' ? 'text-blue-500' : 'text-rose-500'}`}>
                                  {item.type === '수입' ? '+' : '-'}{item.amount.toLocaleString()}원
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-[9px] font-bold border ${item.writer === '아내' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-blue-50 text-blue-500 border-blue-100'}`}>{item.writer}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-[11px] truncate max-w-[120px]">{item.memo}</td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => handleDeleteLedger(item)} className="text-gray-300 hover:text-rose-500 p-1 transition-colors"><X size={14}/></button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="text-center py-10 text-gray-400 text-xs italic">
                                아직 등록된 수입/지출 내역이 없습니다.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* --- 탭 3: ALBUM --- - 기존 유지 */}
        {activeLoungeTab === 'ALBUM' && (
          <div className="animate-fade-in mt-2 space-y-6 pb-10 px-1">
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📸</span>
                <p className="text-xs text-indigo-800 leading-relaxed font-medium break-keep">우리 부부만의 소중한 40주 추억을 타임라인으로 길게 남겨보세요.</p>
              </div>
              <button onClick={() => setShowAlbumModal(true)} className="shrink-0 bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-transform">+ 사진올리기</button>
            </div>
            <div className="relative pl-6 sm:pl-8 border-l-[3px] border-dashed border-indigo-200 space-y-8 pb-10">
              
              {/* 🔥 업로드 0.1초 반응 UI (낙관적 업데이트) */}
              {optimisticPhoto && (
                <div className="relative bg-white p-3 rounded-3xl shadow-sm border border-indigo-200 box-border animate-pulse">
                  <div className="absolute -left-[32px] sm:-left-[40px] w-5 h-5 bg-indigo-300 rounded-full border-4 border-[#f4f6f9]"></div>
                  <img src={optimisticPhoto.url} alt="추억" className="w-full aspect-square object-cover rounded-2xl mb-3 shadow-inner opacity-70" />
                  <div className="px-1 text-center">
                    <p className="font-bold text-sm text-indigo-500 leading-tight mb-1">서버에 안전하게 저장하는 중... ⏳</p>
                  </div>
                </div>
              )}

              {familyData.photos && familyData.photos.length > 0 ? (
                [...familyData.photos].reverse().map((photo: any, idx: number) => (
                  <div key={photo.id || idx} className="relative bg-white p-3 rounded-3xl shadow-sm border border-gray-200 box-border animate-fade-in">
                    <div className="absolute -left-[32px] sm:-left-[40px] w-5 h-5 bg-indigo-500 rounded-full border-4 border-[#f4f6f9] shadow-sm"></div>
                    <img src={photo.url} alt="추억" className="w-full aspect-square object-cover rounded-2xl mb-3 shadow-inner" />
                    <div className="px-1">
                      <p className="font-bold text-sm text-gray-900 leading-tight mb-1">{photo.memo || '우리의 소중한 순간 ✨'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{photo.date} • {photo.uploader}</p>
                    </div>
                    {/* 댓글 섹션 - 모바일 최적화 */}
                    <div className="space-y-2 mt-3 bg-gray-50 p-2 rounded-xl border border-gray-100 w-full box-border">
                      {photo.comments?.map((c: any, i: number) => (
                        <div key={i} className="text-[10px] flex gap-1.5"><span className={`font-black whitespace-nowrap ${c.uploader === '아내' ? 'text-rose-500' : 'text-blue-500'}`}>{c.uploader}</span><span className="text-gray-700 leading-relaxed break-keep leading-snug">{c.text}</span></div>
                      ))}
                      <div className="flex gap-2 mt-2 w-full box-border items-center">
                        <input type="text" value={albumComments[photo.id] || ''} onChange={(e) => setAlbumComments({...albumComments, [photo.id]: e.target.value})} placeholder="댓글 남기기" className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[10px] outline-none focus:border-indigo-300 min-w-0 box-border"/>
                        <button onClick={() => handleAddPhotoComment(photo.id)} className="shrink-0 whitespace-nowrap px-3 py-1.5 bg-indigo-500 text-white rounded-lg font-bold text-[10px]">등록</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="relative mt-8">
                    <div className="absolute -left-[32px] sm:-left-[40px] w-5 h-5 bg-gray-300 rounded-full border-4 border-[#f4f6f9]"></div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-center">
                        <span className="text-4xl opacity-50 mb-2 block">🫙</span>
                        <p className="text-xs text-gray-400 font-medium">아직 등록된 사진이 없어요.</p>
                    </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- 탭 4: QUEST --- */}
        {activeLoungeTab === 'QUEST' && (
          <> {/* 🔥 리액트 에러를 막아주는 투명 껍데기 열기! */}
            {/* 👨‍👩‍👦 부부 공유 출산 준비 레포트 진입점 */}
            <div 
              onClick={() => setShowRegistryReport(true)}
              className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer active:scale-95 transition-transform shadow-md"
            >
              <div>
                <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-bold">부부 공유 데이터</span>
                <h3 className="text-white font-bold text-sm mt-1.5">우리가 준비해야 할 육아템 현황 📝</h3>
                <p className="text-gray-400 text-[11px] mt-0.5">베페 가기 전, 아내가 체크한 리스트를 확인하세요!</p>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white">
                <ChevronRight size={20}/>
              </div>
            </div>
            
            <div className="space-y-4 animate-fade-in pb-10 mt-2 px-1">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl shadow-sm flex items-center gap-3">
                  <span className="text-3xl">⚔️</span>
                  <p className="text-xs text-blue-800 leading-relaxed font-medium break-keep">우리 부부의 필수 미션을 확인하세요.<br/>완료 후 혜택 40주 여정에서 자동 연동됩니다.</p>
              </div>
              {currentMissions.map((mission: any, idx: number) => {
                 const isDone = checkAutoCompletion(mission.title);
                 return (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-3 animate-fade-in">
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border mb-1.5 inline-block ${mission.noButton ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : 'text-blue-500 bg-blue-50 border-blue-100'}`}>
                        {mission.noButton ? '권장 사항' : '필수 퀘스트'}
                      </span>
                      <h4 className={`font-black text-sm break-keep leading-relaxed ${isDone ? 'text-gray-300 line-through' : 'text-gray-900'}`}>{mission.title}</h4>
                    </div>
                    {mission.noButton ? (
                      <span className="shrink-0 text-gray-400 text-[11px] font-bold whitespace-nowrap">자율 점검 🌿</span>
                    ) : isDone ? (
                      <span className="shrink-0 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-[11px] font-bold border border-emerald-100 whitespace-nowrap">완료된 미션 ✅</span>
                    ) : (
                      <button onClick={() => { if (onGoToMoms) onGoToMoms(mission.tab); }} className="shrink-0 whitespace-nowrap bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold text-[11px] shadow-md hover:bg-black transition-transform active:scale-95">수행하기</button>
                    )}
                  </div>
                 );
              })}
            </div>
          </>
        )}
      </div>

      {/* 📸 사진 업로드 모달 - 기존 유지 */}
      {showAlbumModal && (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative shadow-2xl text-center">
            <button onClick={() => { setShowAlbumModal(false); setUploadPhoto(null); setPhotoPreview(''); setPhotoMemo(''); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"><X size={24}/></button>
            <div className="flex flex-col items-center justify-center mb-5">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">📸 추억 저장하기</h3>
            </div>
            <div className="space-y-4 text-left">
              <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden relative shadow-inner">
                {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-500">클릭해서 사진 선택</span>}
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden"/>
              </label>
              <input type="text" value={photoMemo} onChange={e => setPhotoMemo(e.target.value)} placeholder="짧은 메모 (최대 20자)" maxLength={20} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none box-border"/>
              <button onClick={handleUploadPhoto} disabled={!uploadPhoto || isUploadingPhoto} className="w-full py-4 bg-indigo-500 text-white rounded-xl font-black shadow-md disabled:bg-gray-300 transition-transform active:scale-95">
                {isUploadingPhoto ? '저장 중...' : '앨범에 예쁘게 꽂기 ✨'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚖️ 과거 체중 주차 선택 모달 ✨ */}
      {showWeightWeekModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-5 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 relative w-full max-w-sm box-border shadow-2xl">
            <button onClick={()=>setShowWeightWeekModal(false)} className="absolute top-4 right-4 text-gray-400"><X size={20}/></button>
            <h3 className="font-bold text-gray-900 text-base mb-4">⚖️ 과거 데이터 입력하기</h3>
            <p className="text-[11px] text-gray-500 mb-4 leading-relaxed tracking-tight">기록하고 싶은 주차를 선택하고,<br/>상단의 입력창에 체중을 적은 뒤 저장해주세요!</p>
            <select value={tempWeightWeek} onChange={e=>setTempWeightWeek(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-gray-800 outline-none box-border focus:ring-2 focus:ring-emerald-200 mb-5">
              {Array.from({length: 40}, (_, i) => i + 1).map(w => <option key={w} value={w.toString()}>{w}주차</option>)}
            </select>
            <button onClick={handleSaveWeight} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-md active:scale-95">이 주차로 기록하기</button>
          </div>
        </div>
      )}

      {/* 🔥 [수정 4] 팝업 화면 중앙 고정 */}
      {/* 🗓️ 팝업 1: 선택한 날짜의 이벤트 리스트 보기 */}
      {showCalendarListModal && selectedDateStr && (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 relative w-full max-w-sm box-border shadow-2xl max-h-[80vh] flex flex-col">
            <button onClick={()=>setShowCalendarListModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="font-black text-gray-900 text-lg mb-1">{selectedDateStr.split('-')[1]}월 {selectedDateStr.split('-')[2]}일의 기록 💌</h3>
            <p className="text-[11px] text-gray-500 mb-5 font-medium">우리 부부의 소중한 일정이 모여있어요.</p>
            
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar mb-4">
              {getEventsForDate(selectedDateStr).map((ev: any, idx: number) => (
                <div key={idx} className={`p-4 rounded-2xl border flex gap-3 items-center ${ev.type === 'photo' ? 'bg-indigo-50 border-indigo-100' : ev.type === 'auto' ? 'bg-pink-50 border-pink-100' : 'bg-gray-50 border-gray-100'}`}>
                  <span className="text-3xl">{ev.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 leading-snug break-keep">{ev.text}</p>
                    <p className="text-[9px] text-gray-400 mt-1">{ev.uploader}</p>
                  </div>
                  {ev.img && <img src={ev.img} alt="추억" className="w-12 h-12 object-cover rounded-xl border border-black/10 shadow-sm shrink-0" />}
                  
                  {/* 🔥 [신규 추가] 사용자가 추가한 일정(custom)일 때만 수정/삭제 버튼 노출 */}
                  {ev.type === 'custom' && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { 
                        setEditingEventId(ev.id); // 수정 모드 ON
                        setEventText(ev.text); 
                        setEventEmoji(ev.emoji); 
                        setShowCalendarListModal(false); 
                        setShowCalendarAddModal(true); 
                      }} className="p-1.5 text-gray-400 hover:text-blue-500 bg-white rounded-md shadow-sm border border-gray-100">
                        <Edit3 size={14}/>
                      </button>
                      <button onClick={() => handleDeleteCalendarEvent(ev.id)} className="p-1.5 text-gray-400 hover:text-rose-500 bg-white rounded-md shadow-sm border border-gray-100">
                        <X size={14}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { 
              setEventText(''); 
              setEventEmoji('🏥'); 
              setEditingEventId(null); 
              setShowCalendarListModal(false); 
              setShowCalendarAddModal(true); 
            }} className="w-full py-3.5 bg-rose-100 text-rose-600 rounded-xl font-black text-xs shadow-inner hover:bg-rose-200 transition-colors">+ 이 날짜에 새 일정 추가하기</button>
          </div>
        </div>
      )}

      {/* 🗓️ 팝업 2: 새 캘린더 일정 추가하기 */}
      {showCalendarAddModal && selectedDateStr && (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center animate-fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 relative w-full max-w-sm box-border shadow-2xl">
            <button onClick={()=>setShowCalendarAddModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h3 className="font-black text-gray-900 text-lg mb-1">{selectedDateStr.split('-')[1]}월 {selectedDateStr.split('-')[2]}일 ✏️</h3>
            <p className="text-[11px] text-gray-500 mb-5 font-medium">달력에 표시될 귀여운 이모티콘을 선택하세요!</p>
            
            {/* 🔥 이모티콘 테두리 짤림 방지를 위해 p-1 부여 */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar p-1 pb-3 mb-2">
              {['🏥','✈️','🎉','🎂','🚗','👶','🛒','🍽️','📝'].map(emoji => (
                <button key={emoji} onClick={()=>setEventEmoji(emoji)} className={`text-2xl w-12 h-12 flex items-center justify-center shrink-0 rounded-2xl transition-all ${eventEmoji === emoji ? 'bg-rose-100 border-2 border-rose-500 shadow-md scale-110' : 'bg-gray-50 border border-transparent grayscale opacity-50'}`}>{emoji}</button>
              ))}
            </div>
            
            <input type="text" value={eventText} onChange={e=>setEventText(e.target.value)} placeholder="일정 내용을 적어주세요 (예: 10시 정밀초음파)" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-rose-400 mb-4 box-border shadow-inner" />
            
            <label className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl mb-5 cursor-pointer border border-gray-100 hover:bg-gray-100">
              <input type="checkbox" checked={notifyHusband} onChange={e => setNotifyHusband(e.target.checked)} className="w-4 h-4 accent-rose-500 shrink-0" />
              {/* 🔥 알림 톡 문구 성별 통합 및 이모티콘 변경 */}
              <span className="text-[11px] font-bold text-gray-700">💬 배우자에게 채팅방으로 알림 톡 쏘기</span>
            </label>

            <button onClick={handleSaveCalendarEvent} disabled={!eventText.trim()} className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-sm shadow-md disabled:bg-gray-300 transition-transform active:scale-95">일정 저장하기 🚀</button>
          </div>
        </div>
      )}
    </div>
  );
};

// 🔥 ResultPage 컴포넌트 교체 (버튼 위치 조정 및 봄이옴 몰 버튼 추가)
const ResultPage: React.FC<any> = ({ region, activeTab, setActiveTab, onBack, user, onUpdateUser, onLoginClick, benefits, onShowNationwide, onShowMall, setMallSource, userActions, loading, addToast, openInquiry, onOpenBoard, helpers, setShowRegistryReport, onGoGarden, onGoCare, onGoFinch }) => {
  const [subTab, setSubTab] = useState<'NATIONAL' | 'LOCAL' | 'MUST_HAVE'>('NATIONAL'); 
  
  // 🔥 [신규 추가] '학습모드 전환' 버튼 전용 5연타 이스터에그 상태 로직
  const [eduClickCount, setEduClickCount] = useState(0);

  const handleEduModeClick = () => {
    if (eduClickCount >= 4) {
      setEduClickCount(0);
      if (onGoFinch) onGoFinch(); // 5번째 연속 클릭 시 듀오링고 사관학교 샌드박스로 순간이동!
    } else {
      setEduClickCount(prev => prev + 1);
      addToast('info', '학습 모드 오픈 준비 중입니다! 🚧');
    }
  };

  // 3초 동안 타자가 없으면 누적 클릭 횟수 리셋
  useEffect(() => {
    if (eduClickCount > 0) {
      const timer = setTimeout(() => setEduClickCount(0), 3000);
      return () => clearTimeout(timer);
    }
  }, [eduClickCount]);

  const topRef = useRef<HTMLDivElement>(null);
  const localSectionRef = useRef<HTMLDivElement>(null);

  const hasNewItem = (list: Benefit[]) => list.some(b => b.updateType === 'NEW');

  const nationalList = useMemo(() => benefits.filter((b: Benefit) => b.source === 'GOV_NATIONAL').sort((a: Benefit, b: Benefit) => (b.appliedCount || 0) - (a.appliedCount || 0)), [benefits]);
  const localList = useMemo(() => {
    const targetAddress = user?.address || region || '';
    const parts = targetAddress.split(' '); 
    const userSido = parts[0] || '';
    const userSigugun = parts[1] || '';
    const userDetail = parts[2] || '';

    return benefits.filter((b: Benefit) => {
      if (b.source !== 'GOV_LOCAL') return false;
      return checkRegionMatch(b, userSido, userSigugun, userDetail);
    }).sort((a: Benefit, b: Benefit) => (b.appliedCount || 0) - (a.appliedCount || 0));
  }, [benefits, user, region]);
  const mustHaveList = useMemo(() => benefits.filter(b => b.source === 'PRIVATE'), [benefits]);
  
  const nationalAdIndex = useMemo(() => {
    const max = Math.min(nationalList.length - 1, 5); // 최대 6번째 (인덱스 5)
    const min = Math.min(nationalList.length - 1, 2); // 최소 3번째 (인덱스 2)
    if (max < 0) return -1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, [nationalList.length]);

  const nationalAdIndex2 = useMemo(() => {
    if (nationalAdIndex < 0) return -1;
    const second = nationalAdIndex + Math.floor(Math.random() * 4) + 12; // 12~15 사이 랜덤
    return second < nationalList.length ? second : -1;
  }, [nationalAdIndex, nationalList.length]);

  const localAdIndex = useMemo(() => {
    const max = Math.min(localList.length - 1, 5);
    const min = Math.min(localList.length - 1, 2);
    if (max < 0) return -1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }, [localList.length, region]);

  const showN_National = useMemo(() => hasNewItem(nationalList), [nationalList]);
  const showN_Local = useMemo(() => hasNewItem(localList), [localList]);
  const showN_MustHave = useMemo(() => hasNewItem(mustHaveList), [mustHaveList]);

  const scrollToTop = () => { setSubTab('NATIONAL'); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const scrollToLocal = () => { setSubTab('LOCAL'); localSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const handleMustHaveClick = () => { setSubTab('MUST_HAVE'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20 font-pretendard">
      <header className="bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="px-4 py-3 flex items-center justify-between">
             <div className="flex items-center gap-2 min-w-0 pr-2">
               <button onClick={onBack} className="p-1.5 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-full shrink-0"><ArrowLeft size={22} /></button>
               <div className="flex flex-col min-w-0 ml-1">
                 <span className="text-[10px] text-gray-400 font-bold uppercase leading-tight">검색된 거주지</span>
                 <span className="font-bold text-gray-900 flex items-center gap-0.5 text-[13px] truncate"><MapPin size={12} className="text-rose-500 shrink-0" />{region}</span>
               </div>
             </div>
             
             {/* 🛍️ 몰 버튼 소멸 -> 🎓 이스터에그 5연타가 내장된 학습모드 전환 버튼으로 전면 교체 */}
             <button 
                onClick={handleEduModeClick} 
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-1 shadow-md active:scale-95 transition-all shrink-0"
              >
               🎓 학습모드 전환
             </button>
          </div>
          
          <div className="px-4 py-2 flex gap-2 border-b border-gray-50 pb-3">
            <button onClick={() => {setActiveTab('GOV'); setSubTab('NATIONAL');}} className={`flex-1 py-3 rounded-xl text-[12px] sm:text-sm font-bold transition-all border shadow-sm tracking-tight flex items-center justify-center gap-1 ${activeTab === 'GOV' ? 'bg-white border-rose-500 text-gray-900 ring-1 ring-rose-500' : 'bg-gray-100 border-transparent text-gray-400 hover:bg-gray-50'}`}>🏡 거주지 혜택</button>
            <button onClick={() => setActiveTab('JOURNEY')} className={`flex-1 py-3 rounded-xl text-[12px] sm:text-sm font-bold transition-all border shadow-sm tracking-tight flex items-center justify-center gap-1 ${activeTab === 'JOURNEY' ? 'bg-white border-rose-500 text-gray-900 ring-1 ring-rose-500' : 'bg-gray-100 border-transparent text-gray-400 hover:bg-gray-50'}`}>👣 40주 여정</button>
            <button onClick={() => setActiveTab('MOMS')} className={`flex-1 py-3 rounded-xl text-[12px] sm:text-sm font-bold transition-all border shadow-sm tracking-tight flex items-center justify-center gap-1 ${activeTab === 'MOMS' ? 'bg-white border-rose-500 text-gray-900 ring-1 ring-rose-500' : 'bg-gray-100 border-transparent text-gray-400 hover:bg-gray-50'}`}>👩 맘's pick</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-0 sm:px-5 py-4">
        {loading ? <SkeletonList count={6} /> : (
          <>
            {/* 🔥 [신규 추가] 거주지 혜택 메인 배너 및 40주 여정 스타일의 필터 */}
            {activeTab === 'GOV' && (
              <div className="px-4 sm:px-0 mb-4 animate-fade-in">
                {/* 🔥 수정된 1. 비밀정원 유입 띠 배너 (쿠팡 배너는 아래에 그대로 유지됨) */}
                <div 
                  onClick={() => {
                    if (!user) {
                      addToast('info', '카카오 로그인 후 비밀정원을 산책할 수 있어요! 🌸');
                      return;
                    }
                    onGoGarden(); 
                  }}
                  className="mb-4 relative overflow-hidden bg-gray-900 rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer active:scale-95 transition-all flex items-center justify-between group"
                >
                  <div className="relative z-10 flex flex-col text-left">
                    <span className="text-rose-400 text-[10px] font-black mb-1 tracking-widest uppercase">Secret Garden Open</span>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <h3 className="text-white text-[15px] font-black leading-tight">실전 육아 모의고사</h3>
                        <p className="text-gray-400 text-[9px] mt-0.5 font-bold">내 육아 상식은 몇 점?</p>
                      </div>
                      <div className="w-px h-8 bg-gray-700 mx-1"></div>
                      <div className="flex flex-col">
                        <h3 className="text-white text-[15px] font-black leading-tight">봄이옴 작명 연구소</h3>
                        <p className="text-gray-400 text-[9px] mt-0.5 font-bold">사주 맞춤 프리미엄 작명</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative z-10 bg-white/10 p-2 rounded-full group-hover:bg-rose-500 transition-colors">
                    <ArrowRight size={18} className="text-white"/>
                  </div>
                  <span className="absolute -right-2 -bottom-4 text-6xl opacity-10 rotate-12">🌸</span>
                </div>

                {/* 🚀 [쿠팡 배너] 모바일에서만 얇고 깔끔하게 노출 (PC 숨김) */}
                <div className="mt-4 flex flex-col items-center animate-fade-in w-full sm:hidden">
                  <div onClick={() => openExternalLink('https://link.coupang.com/a/d7mvpy')} className="block w-full hover:opacity-95 transition-opacity cursor-pointer">
                    <img 
                      src="https://ads-partners.coupang.com/banners/973731?subId=&traceId=V0-301-5f4982b43e2b4522-I973731&w=320&h=50" 
                      alt="국민육아템 특가" 
                      className="w-full h-auto min-h-[50px] object-cover rounded-2xl shadow-sm border border-gray-100" 
                    />
                  </div>
                  <p className="text-[9px] text-gray-400 mt-2 opacity-70 font-light tracking-tighter text-center">
                    ※ 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                  </p>
                </div>

                {/* 2. 40주 여정 스타일의 둥근 필터 버튼 */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  <button onClick={scrollToTop} className={`relative px-4 py-2.5 rounded-full text-[11px] sm:text-xs font-bold border flex items-center shrink-0 gap-1.5 transition-colors shadow-sm ${subTab === 'NATIONAL' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    {showN_National && <span className="absolute -top-1.5 -right-0.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white">N</span>}
                    <CheckCircle2 size={14}/> 공통 혜택
                  </button>
                  <button onClick={scrollToLocal} className={`relative px-4 py-2.5 rounded-full text-[11px] sm:text-xs font-bold border flex items-center shrink-0 gap-1.5 transition-colors shadow-sm ${subTab === 'LOCAL' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    {showN_Local && <span className="absolute -top-1.5 -right-0.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white">N</span>}
                    <Building2 size={14}/> 지자체 혜택
                  </button>
                  <button onClick={handleMustHaveClick} className={`relative px-4 py-2.5 rounded-full text-[11px] sm:text-xs font-bold border flex items-center shrink-0 gap-1.5 transition-colors shadow-sm ${subTab === 'MUST_HAVE' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    {showN_MustHave && <span className="absolute -top-1.5 -right-0.5 bg-rose-500 text-white text-[8px] font-black w-3.5 h-3.5 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white">N</span>}
                    <Gift size={14}/> 안 받으면 손해
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'GOV' && subTab !== 'MUST_HAVE' && (
              <div className="space-y-8 sm:space-y-10 animate-fade-in pb-10">
                <section ref={topRef} className="scroll-mt-40 bg-[#f4f6f9] py-8 px-4 sm:p-6 rounded-none sm:rounded-2xl border-y sm:border border-blue-100/50">
                   {/* 🔥 [변경 3] 모바일에서만 노출되는 '전국 혜택' 버튼을 H3 옆으로 이동! */}
                   <div className="flex justify-between items-end mb-4">
                     <div>
                       <h3 className="font-bold text-xl text-blue-900 mb-1 leading-tight">대한민국 임산부 공통 혜택</h3>
                       <p className="text-xs text-blue-600 font-medium">인기 신청 순으로 정리해 보았어요</p>
                     </div>
                     {/* 🔥 PC에서도 보이도록 sm:hidden 삭제 + 버튼 크기 반응형 조절 */}
                     <button onClick={onShowNationwide} className="bg-white text-gray-600 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-bold border border-gray-200 shadow-sm flex items-center gap-0.5 shrink-0 whitespace-nowrap hover:bg-gray-50 transition-colors">
                       전국 혜택 <ChevronRight size={12}/>
                     </button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {nationalList.map((b: Benefit, index: number) => (
                       <React.Fragment key={b.id}>
                         <BenefitCard benefit={b} userId={user?.id} initialApplied={userActions?.applied?.includes(b.id)} showApply={true} />
                         {index === nationalAdIndex && (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3">
                             <KakaoAdFit unit="DAN-Nx6FiDTR0QT08Er7" />
                           </div>
                         )}
                         {index === nationalAdIndex2 && (
                           <div className="col-span-1 md:col-span-2 lg:col-span-3">
                             <KakaoAdFit unit="DAN-oHfi3fA5BFJWYfzl" />
                           </div>
                         )}
                       </React.Fragment>
                     ))}
                   </div>
                </section>
                
                <section ref={localSectionRef} className="scroll-mt-40 bg-[#f0f9f6] py-8 px-4 sm:p-6 rounded-none sm:rounded-2xl border-y sm:border border-emerald-100/50">
                   {/* 🔥 [변경 4] 여기도 모바일용 '전국 혜택' 버튼 우측 끝에 추가! */}
                   <div className="flex justify-between items-end mb-4">
                     <div>
                       <h3 className="font-bold text-xl text-emerald-900 mb-1 leading-tight">{region} 혜택</h3>
                       <p className="text-xs text-emerald-600 font-medium">가장 많은 분들이 선택한 혜택 순서입니다</p>
                     </div>
                     {/* 🔥 PC에서도 보이도록 sm:hidden 삭제 + 버튼 크기 반응형 조절 */}
                     <button onClick={onShowNationwide} className="bg-white text-gray-600 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] font-bold border border-gray-200 shadow-sm flex items-center gap-0.5 shrink-0 whitespace-nowrap hover:bg-gray-50 transition-colors">
                       전국 혜택 <ChevronRight size={12}/>
                     </button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {localList.map((b: Benefit, index: number) => (
                        <React.Fragment key={b.id}>
                          <BenefitCard benefit={b} userId={user?.id} initialApplied={userActions?.applied?.includes(b.id)} showApply={true} />
                          {/* 🔥 새로 발급받은 지자체 전용 ID 적용 완료! */}
                          {index === localAdIndex && <KakaoAdFit unit="DAN-78XUIOOn96bsg8XJ" />}
                        </React.Fragment>
                      ))}
                   </div>
                   {localList.length === 0 && <div className="py-10 bg-white rounded-2xl text-center text-gray-400 text-sm border border-emerald-100 mt-4">등록된 지자체 혜택이 없습니다.</div>}

                   <div className="flex flex-col items-center mt-8">
                      <button onClick={onShowNationwide} className="w-full max-w-sm px-6 py-4 bg-white text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm">
                        <ListFilter size={16}/> 다른 지역 혜택 둘러보기 <ChevronRight size={14}/>
                      </button>
                   </div>
                   
                   <div className="mt-8 pt-6 border-t border-dashed border-emerald-200">
                      <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1"><MessageCircle size={16}/> 임산부 혜택 정보 공유</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <BoardCard icon="📢" title="전국 혜택 정보 공유방" desc="어떤 혜택 신청하셨나요? 궁금한 점 물어보세요!" onClick={() => user ? onOpenBoard('전국 혜택 정보 공유방') : onLoginClick()} />
                        <BoardCard icon="💡" title={`${region.split(' ')[1] || '동네'} 혜택 꿀팁 나눔방`} desc="우리 동네 산모들과 혜택 받는 팁을 공유해요" onClick={() => user ? onOpenBoard('지역 혜택 나눔방') : onLoginClick()} />
                      </div>
                   </div>
                </section>
              </div>
            )}
            
            {activeTab === 'GOV' && subTab === 'MUST_HAVE' && <MustHaveSection benefits={benefits} user={user} userActions={userActions} openInquiry={openInquiry} onLoginClick={onLoginClick} />}
            
            {activeTab === 'JOURNEY' && (
              <MomJourneySection 
                user={user} 
                onUpdateUser={onUpdateUser} 
                onLoginClick={onLoginClick} 
                onGoToMustHave={() => {
                  setActiveTab('GOV');
                  setSubTab('MUST_HAVE');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onGoToMoms={(tabName: string) => {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('targetMomTab', tabName);
                    window.scrollTo({ top: 0, behavior: 'smooth' }); // 🔥 스크롤 최상단 이동 추가!
                  }
                  setActiveTab('MOMS'); 
                }} 
                onGoToMall={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' }); // 🔥 스크롤 최상단 이동 추가!
                  onShowMall();
                }}
                setMallSource={setMallSource}
                addToast={addToast} 
                onGoGarden={onGoGarden}
              />
            )}

            {activeTab === 'MOMS' && <LocalMomsSection user={user} region={region} onUpdateUser={onUpdateUser} addToast={addToast} onOpenBoard={onOpenBoard} onLoginClick={onLoginClick} helpers={helpers} setActiveTab={setActiveTab} setShowRegistryReport={setShowRegistryReport} onGoGarden={onGoGarden} onGoCare={onGoCare} />}
          </>
        )}
      </div>
      
      {activeTab === 'GOV' && subTab !== 'MUST_HAVE' && <FooterSection onShowMustHave={() => setSubTab('MUST_HAVE')} addToast={addToast} />}
    </div>
  );
};


// 🔥 onBack 프롭스 추가
const MyPageSection = ({ user, onLogout, onChangeAddress, addToast, onBack, onGoFinch }: any) => { 
  const currentWeek = calculatePregnancyWeek(user.dueDate);
  const isPreMom = user.myHospitalName === '예비맘';
  const statusText = isPreMom ? '임신 준비 중' : (currentWeek > 40 ? '선배맘' : `현재 ${currentWeek}주차`);
  const refCount = (user as any).referralCount || 0; 

  return (
    // 🔥 1. 배경을 감싸는 최상단 div에 w-full과 flex 중앙 정렬 속성 추가
    <div className="min-h-screen bg-gray-50 pb-24 font-pretendard animate-fade-in relative w-full flex flex-col items-center">
       
       {/* 🔥 2. 헤더를 w-full로 넓게 잡고 안쪽 내용물을 max-w-5xl로 제한하여 다른 페이지와 통일 */}
       <header className="w-full flex justify-center bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
         <div className="w-full max-w-5xl px-4 py-3 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <button onClick={onBack} className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={24} /></button>
             <h2 className="font-bold text-lg leading-tight text-gray-900">나의 봄이옴</h2>
           </div>
           <div className="w-6"></div> {/* 가운데 정렬용 여백 */}
         </div>
       </header>

       {/* 🔥 3. 내부 프로필 카드가 쪼그라들지 않도록 w-full 추가 (max-w-md는 유지해 프로필 카드 폭 고정) */}
       <div className="w-full max-w-md mx-auto p-6 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center border border-gray-100 relative">
             {/* 🔥 기존 유형 뱃지 아래에 '선배맘' 칭호 강조 표시 */}
             <div className="absolute top-6 left-6 flex flex-col gap-1.5 items-start">
               {user.who && (
                 <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-md border border-gray-200 shadow-sm">
                   {user.who}
                 </span>
               )}
               {currentWeek > 40 && (
                 <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-extrabold px-2.5 py-1 rounded-md shadow-sm">
                   👑선배맘
                 </span>
               )}
             </div>
             <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl border border-rose-100 shadow-inner mt-4">
               {getUserAvatar(user.id)}
             </div>
             <h3 className="text-2xl font-bold text-gray-900 mb-2">{user.nickname}님</h3>
             <p className="text-sm font-bold text-rose-500 bg-rose-50 border border-rose-100 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full mb-8 shadow-sm">
               My Status : {statusText} {user.babyGender && <span className="text-lg leading-none">{user.babyGender.split(' ')[0]}</span>}
             </p>
             
             <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 text-left border border-blue-100 shadow-sm">
                <p className="text-[11px] font-bold text-blue-500 mb-2 flex items-center gap-1">📢 나의 초대 현황</p>
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-sm font-bold text-gray-800">내 링크로 가입한 산모</p>
                      <p className="text-3xl font-black text-blue-600 mt-1">{refCount}<span className="text-base font-bold text-blue-400 ml-1">명</span></p>
                   </div>
                   <button onClick={() => {
                       navigator.clipboard.writeText(`https://bomiom.co.kr/?ref=${user.id}`);
                       addToast('success', '초대 링크가 복사되었습니다!');
                   }} className="bg-blue-500 text-white text-xs font-bold px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors shadow-md shrink-0">
                      링크 복사
                   </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-4 leading-relaxed bg-white/50 p-2 rounded-lg">
                  흩어진 정보들을 모아 선명한 기준을 세울 수 있도록 산모들을 초대해 주세요. 참여하는 분들이 많아질수록 맘들의 정보가 더 정확해집니다.
                </p>
             </div>

             <div className="space-y-3">
               <button onClick={onChangeAddress} className="w-full py-4 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">🏠 거주지 변경</button>
               <button onClick={onLogout} className="w-full py-4 bg-gray-50 rounded-xl text-sm font-bold text-gray-400 hover:bg-gray-100 transition-colors border border-gray-100">로그아웃</button>
             </div>
             
          </div>
       </div>
    </div>
  );
};

const BottomNav = ({ activeView, onGoHome, onGoLounge, onGoGarden, onGoMall, onGoMyPage }: any) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 z-[100] max-w-6xl mx-auto shadow-[0_-5px_15px_rgba(0,0,0,0.03)] px-1 sm:px-6">
    
    {/* 1. 홈 버튼 */}
    <button onClick={onGoHome} className={`flex flex-col items-center justify-center w-[20%] h-full space-y-1 transition-colors ${['HOME', 'RESULT', 'NATIONWIDE'].includes(activeView) ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
      <Home size={20} className={['HOME', 'RESULT', 'NATIONWIDE'].includes(activeView) ? 'fill-rose-50' : ''} />
      <span className="text-[10px] font-bold">홈</span>
    </button>
    
    {/* 2. 부부 라운지 버튼 (일반 사각형 플랫 버튼 형태로 완벽 원상복귀) */}
    <button onClick={onGoLounge} className={`flex flex-col items-center justify-center w-[20%] h-full space-y-1 transition-colors ${activeView === 'LOUNGE' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
      <Users size={20} className={activeView === 'LOUNGE' ? 'fill-rose-50' : ''} />
      <span className="text-[10px] font-bold">부부 라운지</span>
    </button>

    {/* 3. 비밀정원 버튼 (중앙에서 통통 튀는 입체 원형 플로팅 디자인 단독 유지!) */}
    <div className="relative -top-5 w-[20%] flex justify-center">
      <button 
        onClick={onGoGarden} 
        className={`w-14 h-14 flex flex-col items-center justify-center rounded-full shadow-[0_4px_20px_rgba(244,63,94,0.4)] transition-transform active:scale-95 ${activeView === 'GARDEN' ? 'bg-rose-600' : 'bg-rose-500'}`}
      >
        <Flower2 size={28} className="text-white drop-shadow-md" />
      </button>
      <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-black w-max ${activeView === 'GARDEN' ? 'text-rose-500' : 'text-gray-400'}`}>
        비밀정원
      </span>
    </div>

    {/* 4. 봄이옴 몰 버튼 (하단 네비 플랫 버튼으로 이사 완료 🛍️) */}
    <button onClick={onGoMall} className={`flex flex-col items-center justify-center w-[20%] h-full space-y-1 transition-colors ${activeView === 'MALL' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
      <ShoppingBag size={20} className={activeView === 'MALL' ? 'fill-rose-50' : ''} />
      <span className="text-[10px] font-bold">봄이옴 몰</span>
    </button>

    {/* 5. 나의 봄이옴 버튼 */}
    <button onClick={onGoMyPage} className={`flex flex-col items-center justify-center w-[20%] h-full space-y-1 transition-colors ${activeView === 'MYPAGE' ? 'text-rose-500' : 'text-gray-400 hover:text-gray-600'}`}>
      <UserIcon size={20} className={activeView === 'MYPAGE' ? 'fill-rose-50' : ''} />
      <span className="text-[10px] font-bold">나의 봄이옴</span>
    </button>

  </div>
);

// ==========================================
// 🏥 [신규] 산후조리원 예약 전용 페이지 (캐치테이블 스타일)
// ==========================================
// ==========================================
// 🏥 [찐최종] 산후조리원 예약 전용 페이지 (캐치테이블 + SaaS 연동 로직)
// ==========================================
const CareReservationPage = ({ onBack, addToast, activeView, onGoHome, onGoLounge, onGoGarden, onGoCare, onGoMyPage, user, onLoginClick }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetState, setSheetState] = useState<'HIDDEN' | 'HALF' | 'FULL'>('HALF');
  const [selectedCareDetail, setSelectedCareDetail] = useState<any>(null);

  const [showDemandPopup, setShowDemandPopup] = useState(true);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false); // 🔥 지역 필터 모달
  const [isRequested, setIsRequested] = useState(false);
  const [showAlarmPopup, setShowAlarmPopup] = useState(false);

  const [savedCenters, setSavedCenters] = useState<string[]>(user?.savedCenters || []);
  const [showRegistry, setShowRegistry] = useState(false);
  const [centers, setCenters] = useState<any[]>([
  {
    id: "care_gangnam_01",
    name: "🌸 봄이옴 데모 산후조리원",
    address: "서울 강남구 테헤란로 123",
    lat: 37.4979,
    lng: 127.0276,
    
    // 🚩 [수정 1] 'REGISTERED'를 'FLEX'로 바꿔야 합니다! 
    // 그래야 아래쪽 {selectedCareDetail.status === 'FLEX' && (...)} 조건문에 걸려 버튼이 뜹니다.
    status: "FLEX", 

    rating: 4.9,
    review: 128,
    일반실가격: "350만원",
    특실가격: "550만원",
    
    // 🚩 [수정 2] features 항목을 아래와 같이 정확히 맞춰주세요.
    features: {
      isConfirmedReservationEnabled: true,
      isFlexReservationEnabled: true,
      isConsultingEnabled: true
    },
    
    images: ["https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=500"],
    introduction: {
      greeting: "안녕하세요! 봄이옴 시연을 위한 데모 조리원입니다.",
      facilities: "최고급 모션베드와 신생아실 24시간 캠이 설치되어 있습니다.",
      meals: "미슐랭 출신 셰프가 제공하는 건강한 식단을 경험하세요.",
      programs: "매일 진행되는 산후 요가와 전문 마사지 프로그램이 준비되어 있습니다."
    }
  },
  ...initialCareData
]);
  
  // 🔥 지도 줌 & 좌표 상태
  const [mapCenter, setMapCenter] = useState({ lat: 36.3, lng: 127.8 });
  const [mapLevel, setMapLevel] = useState(13);

  // 🔥 심플해진 1단 필터 상태
  const [filterSido, setFilterSido] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // 🚀 [신규 추가] 찜하기 파이어베이스 영구 동기화 함수
  const syncSavedCenters = async (newSavedList: string[]) => {
    setSavedCenters(newSavedList); // 앱 화면에 하트 즉시 반영
    onUpdateUser({ ...user, savedCenters: newSavedList }); // 🔥 [핵심 추가] 내 전역 정보(App.tsx)에도 즉시 저장!
    if (user?.id) {
      try {
        await updateDoc(doc(db, "users", user.id), { savedCenters: newSavedList });
      } catch (e) {
        console.error("찜하기 파이어베이스 저장 실패:", e);
      }
    }
  };

  const handleHeartClick = () => {
    if (!user) {
      addToast('info', '로그인 후 이용 가능합니다 🔒');
      return;
    }
    const isSaved = savedCenters.includes(selectedCareDetail.id);
    if (isSaved) {
      // 이미 찜한 상태면 해제하고 파이어베이스에 저장!
      syncSavedCenters(savedCenters.filter(id => id !== selectedCareDetail.id));
      addToast('info', '레지스트리에서 삭제되었습니다 💔');
    } else {
      // 찜하지 않은 상태면 알림 팝업 띄우기
      setShowAlarmPopup(true);
    }
  };

  // =========================================================================
  // 🚀 [여기서부터 복사해서 추가!] 예약/상담 모달 상태 및 파이어베이스 전송 함수
  // =========================================================================
  const [reservationModal, setReservationModal] = useState<{isOpen: boolean, type: 'CONSULT' | 'DIRECT' | 'FLEX'}>({ isOpen: false, type: 'CONSULT' });
  const [resStep, setResStep] = useState(1); // 🔥 1: 일정/등급 선택, 2: 결제 및 정보입력
  const [resType, setResType] = useState<'DIRECT'|'FLEX'|''>(''); // 확정인지 플렉스인지
  const [resName, setResName] = useState(''); // 🔥 예약자 이름
  const [resDate, setResDate] = useState('');
  const [resPhone, setResPhone] = useState(''); // 원장님이 연락할 수 있게 번호 받기
  const [resEdd, setResEdd] = useState(user?.dueDate || ''); // 🔥 출산예정일(EDD) 추가 (가입 정보로 자동 세팅)
  const [resTime, setResTime] = useState(''); // 🔥 예약 시간 상태 추가
  const [resDuration, setResDuration] = useState('2주');
  const [resRoomGrade, setResRoomGrade] = useState('');
  const [isSubmittingRes, setIsSubmittingRes] = useState(false);
  const [isFlexModalOpen, setIsFlexModalOpen] = useState(false);

  const [centerReviews, setCenterReviews] = useState<any[]>([]);
  const [myStayRecord, setMyStayRecord] = useState<any>(null); // 나의 예약(숙박) 기록
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewType, setReviewType] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const REVIEW_TAG_LIST = ['🍱 밥이 맛있어요', '💆‍♀️ 마사지 최고', '👩‍⚕️ 전문적인 신생아 케어', '🧹 시설이 청결해요', '🤱 모유수유 적극 권장', '🌳 주변 환경이 조용해요'];
  const RATING_GUIDES = [
    '',
    '다른 산모들은 방문하지 않았으면 좋겠어요.',
    '기대보다 아쉬운 점이 많았어요.',
    '무난했어요. 특별히 좋거나 나쁜 점은 없었어요.',
    '전반적으로 만족스러워요. 주변에 추천할 만해요.',
    '어떤 산모도 만족할 거예요! 자신 있게 추천해요.'
  ];

  // 조리원을 클릭해서 상세페이지가 열릴 때마다 리뷰와 내 숙박 기록을 가져옵니다.
  useEffect(() => {
    if (selectedCareDetail?.id && user?.id) {
      const fetchReviewsAndRecord = async () => {
        try {
          // 1. 해당 조리원의 리뷰 긁어오기 (승인완료된 것만)
          const reviewQ = query(collection(db, 'care_reviews'), where('centerId', '==', selectedCareDetail.id));
          const reviewSnap = await getDocs(reviewQ);
          const reviews = reviewSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'APPROVED' || r.type === 'AUTO');
          setCenterReviews(reviews);

          // 2. 나의 예약 기록 찾기 (이용 완료 여부 확인용)
          const resQ = query(collection(db, 'reservations'), where('centerId', '==', selectedCareDetail.id), where('userId', '==', user.id));
          const resSnap = await getDocs(resQ);
          const records = resSnap.docs.map(d => d.data());
          // 예약 확정(CONFIRMED) 상태이면서, 퇴소일이 지났는지 확인
          const completedRecord = records.find(r => r.status === 'CONFIRMED' && new Date(r.careExitDate) < new Date());
          setMyStayRecord(completedRecord || null);
        } catch(e) { console.error("리뷰 로드 실패", e); }
      };
      fetchReviewsAndRecord();
    }
  }, [selectedCareDetail?.id, user?.id]);

  // 🔥 선택한 날짜부터 N주 뒤의 날짜를 계산해주는 함수 (은은한 녹색 바 렌더링용)
  const getEndDate = (start: string, durationStr: string) => {
    if (!start) return null;
    const weeks = parseInt(durationStr.replace('주', ''));
    const d = new Date(start);
    d.setDate(d.getDate() + (weeks * 7) - 1); // 시작일 포함 N주
    return d;
  };

  const handleSubmitReservation = async (overrideType?: string) => {
    const finalType = overrideType || reservationModal.type;

    if (finalType === 'CONSULT' && (!resDate || !resTime || !resPhone || !resEdd)) {
      addToast('error', '날짜, 시간, 연락처, 출산예정일을 모두 입력해주세요.');
      return;
    }
    // 🔥 확정/플렉스 예약 시 이름(resName)과 폰번호 필수 체크
    if (finalType !== 'CONSULT' && (!resDate || !resName || !resPhone)) {
      addToast('error', '날짜, 성함, 연락처를 모두 입력해주세요.');
      return;
    }

    setIsSubmittingRes(true);
    try {
      const collectionName = finalType === 'CONSULT' ? 'consultations' : 'reservations';
      await addDoc(collection(db, collectionName), {
        centerId: selectedCareDetail.id,
        centerName: selectedCareDetail.name,
        userId: user.id,
        userName: finalType === 'CONSULT' ? user.nickname : resName, // 🔥 예약 폼에 적은 실명 전송!
        userPhone: resPhone,
        date: resDate,
        time: resTime || '',
        edd: resEdd || '',
        duration: resDuration,
        roomGrade: resRoomGrade || '', // 🔥 객실 등급(일반실/특실) 전송!
        type: finalType === 'RESERVE' ? 'DIRECT' : finalType,
        status: 'PENDING', // 🔥 무조건 '가계약금 입금 대기(PENDING)' 상태로 전송!
        createdAt: serverTimestamp()
      });
      
      addToast('success', '성공적으로 접수되었습니다! 조리원에서 곧 연락드릴 예정입니다 📞');
      setReservationModal({ isOpen: false, type: 'CONSULT' });
      setIsFlexModalOpen(false);
      setResDate('');
      setResTime('');
      setResPhone('');
    } catch (error) {
      console.error("예약 전송 실패:", error);
      addToast('error', '요청 중 문제가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmittingRes(false);
    }
  };

  // 🔥 지도 화면에 보이는 조리원만 담을 바구니
  const [visibleCenters, setVisibleCenters] = useState<any[]>([]);

  // (스와이프 함수는 그대로 두시면 됩니다!)
  const [touchStartY, setTouchStartY] = useState(0);
  const handleTouchStart = (e: any) => setTouchStartY(e.touches[0].clientY);
  const handleTouchEnd = (e: any) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    if (diff > 50) { 
      if (sheetState === 'HALF') setSheetState('FULL');
      if (sheetState === 'HIDDEN') setSheetState('HALF');
    } else if (diff < -50) { 
      if (sheetState === 'FULL') setSheetState('HALF');
      if (sheetState === 'HALF') setSheetState('HIDDEN');
    }
  };

  const filteredCenters = useMemo(() => {
    return centers.filter(c => {
      // 1. 데모 조리원은 검색어가 '데모' 혹은 '봄이옴' 일 때만 나타남
      if (c.id === "care_gangnam_01") {
        return searchQuery.includes("데모") || searchQuery.includes("봄이옴");
      }
      // 2. 나머지는 일반 검색 로직
      return !searchQuery || c.name.includes(searchQuery) || (c.address && c.address.includes(searchQuery));
    });
  }, [centers, searchQuery]);

  // 🚀 [마법 1] 카카오 공식 도구로 에러(경고) 없이 백그라운드에서 스크립트 로딩!
  const [isScriptLoading] = useKakaoLoader({
    appkey: 'cef1d01b84acf6b64cabac2fc6c3df18', // 대표님 키 자동 삽입!
    libraries: ['clusterer', 'services'],
  });

  // 🚀 [마법 2] "회색 지도 짤림 버그" 완벽 차단!
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useEffect(() => {
    // 스크립트 로딩이 끝나면, 화면(CSS)이 쫙 펴질 수 있도록 딱 0.1초만 기다렸다가 지도를 그립니다.
    if (!isScriptLoading) {
      const timer = setTimeout(() => setIsLayoutReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isScriptLoading]);

  // 🔥 [신규 추가] 수익(Yield) 관리 쿼터 계산용 예약 현황 바구니
  const [currentReservations, setCurrentReservations] = useState<any[]>([]);

  // 🚀 [업그레이드] 파이어베이스에서 최신 조리원 설정(객실/수익/상담) 및 예약 현황 불러오기!
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centerRef = doc(db, "care_centers", "care_gangnam_01");
        const centerSnap = await getDoc(centerRef);
        if (centerSnap.exists()) {
          const remoteData = centerSnap.data();
          // 🔥 id: "care_gangnam_01" 이 덮어씌워져 날아가는 것을 완벽하게 방지합니다!
          setCenters(prev => prev.map(c => c.id === "care_gangnam_01" ? { ...c, ...remoteData, id: "care_gangnam_01" } : c));
          setSelectedCareDetail(prev => prev?.id === "care_gangnam_01" ? { ...prev, ...remoteData, id: "care_gangnam_01" } : prev);
        }

        // 수익 관리(플렉스 쿼터) 계산을 위해 현재 예약 현황도 긁어옵니다.
        const resQuery = query(collection(db, "reservations"), where("centerId", "==", "care_gangnam_01"));
        const resSnap = await getDocs(resQuery);
        setCurrentReservations(resSnap.docs.map(d => d.data()));
      } catch(e) { console.error("조리원 데이터 연동 실패:", e); }
    };
    fetchCenters();
  }, []);

  // 🌟 A. 조리원 상세 페이지
  if (selectedCareDetail) {
    const isSaved = savedCenters.includes(selectedCareDetail.id); // 🔥 찜 여부 확인

    // 🔥 [여기 수정!] 로그인을 안 한 유저가 탭을 누르면 캡처 화면과 똑같은 예쁜 카드가 뜹니다
    if (!user) {
      return (
        <div className="fixed inset-0 bg-gray-50 z-[200] flex flex-col items-center justify-center p-4 font-pretendard">
          
          {/* 하얀색 카드 영역 */}
          <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8 w-full max-w-[320px] flex flex-col items-center text-center animate-fade-in">
            
            {/* 자물쇠 아이콘 (캡처 화면 느낌 살림) */}
            <div className="text-5xl mb-5">🔒</div>
            
            {/* 제목 */}
            <h2 className="text-[17px] font-black text-gray-900 mb-3 leading-snug">
              조리원 예약은 로그인 후<br />이용할 수 있어요!
            </h2>
            
            {/* 설명 */}
            <p className="text-[13px] text-gray-500 mb-8 leading-relaxed">
              우리 동네 산후조리원을 찾고<br />실시간으로 예약해 보세요 🌸
            </p>
            
            {/* 캡처 화면과 동일한 핑크/레드 버튼 */}
            <button 
              onClick={onLoginClick}
              className="w-full py-4 bg-[#F7405F] text-white font-bold rounded-2xl shadow-sm active:scale-95 transition-transform text-sm"
            >
              로그인 / 3초만에 가입하기
            </button>
          </div>

          {/* 하단 닫기/뒤로가기 버튼 */}
          <button onClick={onBack} className="mt-6 text-sm font-bold text-gray-400 underline underline-offset-4 active:scale-95 transition-transform">
            이전 화면으로 돌아가기
          </button>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-white z-[200] flex flex-col animate-fade-in overflow-hidden">
        {/* 상세페이지 헤더 */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={() => {setSelectedCareDetail(null); setIsRequested(false);}} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"><ArrowLeft size={24}/></button>
          {/* 🔥 찜 상태에 따라 하트 색상(fill) 실시간 변경 */}
          <button 
            onClick={handleHeartClick} 
            className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <Heart size={20} fill={isSaved ? "currentColor" : "none"} className={isSaved ? "text-rose-500" : "text-white"}/>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          
          {/* 🔥 1. 최상단 대형 스와이프 갤러리 (가로로 촥촥 넘어갑니다) */}
          <div className="w-full h-72 flex overflow-x-auto snap-x snap-mandatory no-scrollbar bg-gray-100">
            {Array.isArray(selectedCareDetail.images) && selectedCareDetail.images.length > 0 ? (
              selectedCareDetail.images.map((imgUrl: string, idx: number) => (
                <div key={idx} className="w-full h-full shrink-0 snap-center relative">
                  <img src={imgUrl} alt={`조리원 갤러리 ${idx + 1}`} className={`w-full h-full object-cover ${selectedCareDetail.status === 'UNREGISTERED' ? 'opacity-70 grayscale' : ''}`} />
                  {/* 우측 하단에 [1 / 5] 사진 번호 표시 */}
                  <div className="absolute bottom-10 right-4 bg-black/50 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm z-10 shadow-sm">
                    {idx + 1} / {selectedCareDetail.images.length}
                  </div>
                </div>
              ))
            ) : (
              <img src={selectedCareDetail.img} alt="조리원" className={`w-full h-full object-cover shrink-0 snap-center ${selectedCareDetail.status === 'UNREGISTERED' ? 'opacity-70 grayscale' : ''}`} />
            )}
          </div>

          <div className="p-6 bg-white -mt-6 rounded-t-3xl relative z-10 min-h-[500px]">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md mb-2 inline-block ${selectedCareDetail.status === 'UNREGISTERED' ? 'bg-gray-100 text-gray-500' : 'bg-rose-50 text-rose-500'}`}>{selectedCareDetail.tag || '신규'}</span>
            <h2 className="text-2xl font-black text-gray-900 mb-1">{selectedCareDetail.name}</h2>
            <p className="text-xs text-gray-500 mb-4 flex items-center gap-1"><MapPin size={14}/> {selectedCareDetail.address || selectedCareDetail.region}</p>
            
            {/* 평점 및 리뷰 영역 */}
            <div className="flex items-center gap-4 py-4 mb-4">
              <div className="flex-1 text-center"><p className="text-[10px] text-gray-400 mb-1">평점</p><p className="text-sm font-bold text-gray-800">{selectedCareDetail.rating > 0 ? `⭐ ${selectedCareDetail.rating}` : '-'}</p></div>
              <div className="w-px h-8 bg-gray-100"></div>
              <div className="flex-1 text-center"><p className="text-[10px] text-gray-400 mb-1">리뷰</p><p className="text-sm font-bold text-gray-800">{selectedCareDetail.review || 0}개</p></div>
            </div>

            {/* 🔥 파이어베이스 연동: 일반실/특실 상세 가격 박스 */}
            <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] font-bold text-gray-700">일반실 (2주 평균)</span>
                <span className="text-sm font-black text-rose-500">{selectedCareDetail.일반실가격 || '가격 문의'}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[13px] font-bold text-gray-700">특실 (2주 평균)</span>
                <span className="text-sm font-black text-rose-500">{selectedCareDetail.특실가격 || '가격 문의'}</span>
              </div>
              <p className="text-[11px] text-gray-500 text-center bg-gray-200/50 py-1.5 rounded-lg flex items-center justify-center gap-1">
                💡 정확한 가격은 상담을 통해 정해집니다.
              </p>
            </div>

            {/* ✍️ 파이어베이스 연동: 카테고리별 상세 소개글 (안전장치 100% 장착!) */}
            {selectedCareDetail.status === 'UNREGISTERED' ? (
              <>
                <h3 className="font-bold text-gray-800 mb-3">조리원 소개</h3>
                <p className="text-sm text-gray-600 leading-relaxed break-keep bg-gray-50 p-4 rounded-2xl">
                  아직 봄이옴과 제휴되지 않은 조리원입니다. 하단 버튼을 눌러 예약을 요청해 주시면, 저희가 원장님께 직접 달려가겠습니다! 🏃‍♂️
                </p>
              </>
            ) : (typeof selectedCareDetail.introduction === 'object' && selectedCareDetail.introduction !== null) ? (
              <div className="space-y-6">
                {selectedCareDetail.introduction.greeting && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">👋 원장님 인사말</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed break-keep bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">
                      {selectedCareDetail.introduction.greeting}
                    </p>
                  </div>
                )}
                {selectedCareDetail.introduction.facilities && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">🏨 시설 안내</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed break-keep bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">
                      {selectedCareDetail.introduction.facilities}
                    </p>
                  </div>
                )}
                {selectedCareDetail.introduction.meals && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">🍽️ 식단 및 영양</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed break-keep bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">
                      {selectedCareDetail.introduction.meals}
                    </p>
                  </div>
                )}
                {selectedCareDetail.introduction.programs && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-1.5">💆‍♀️ 마사지 및 프로그램</h3>
                    <p className="text-[13px] text-gray-600 leading-relaxed break-keep bg-gray-50 p-4 rounded-2xl whitespace-pre-wrap">
                      {selectedCareDetail.introduction.programs}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <h3 className="font-bold text-gray-800 mb-3">조리원 소개</h3>
                <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-2xl">아직 상세 정보가 등록되지 않았습니다.</p>
              </>
            )}

            <div className="mt-10 pt-8 border-t border-gray-100 pb-10">
              {/* 🔥 여기 flex 정렬과 gap, shrink-0, whitespace-nowrap이 핵심입니다! */}
              <div className="flex justify-between items-start mb-6 gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 text-base flex items-center gap-1.5 break-keep">
                    📝 실제 이용 후기 <span className="text-rose-500">{centerReviews.length}</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed break-keep">
                    인증된 산모님들만 남긴 100% 찐 후기입니다.
                  </p>
                </div>
                
                <button 
                  onClick={() => {
                    if (myStayRecord) {
                      setReviewType('AUTO'); setIsReviewModalOpen(true);
                    } else {
                      setReviewType('MANUAL'); setIsReviewModalOpen(true);
                    }
                  }}
                  // 🔥 shrink-0(크기 축소 방지), whitespace-nowrap(줄바꿈 방지) 추가 완료!
                  className="shrink-0 whitespace-nowrap text-[11px] font-bold text-rose-500 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 shadow-sm active:scale-95 transition-transform mt-0.5"
                >
                  {myStayRecord ? '✅ 이용 완료 후기 쓰기' : '📸 영수증 인증 후기 쓰기'}
                </button>
              </div>

              {/* 리뷰 목록 뿌려주기 */}
              <div className="space-y-4">
                {centerReviews.length > 0 ? centerReviews.map((rev: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400 text-sm">{'⭐'.repeat(rev.rating)}</span>
                        <span className="text-[11px] font-bold text-gray-600">{rev.userName.substring(0,1)}*맘</span>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm ${rev.type === 'AUTO' ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
                        {rev.type === 'AUTO' ? '✅ 봄이옴 인증맘' : '🧾 영수증 인증'}
                      </span>
                    </div>
                    {/* 장점 키워드 태그 */}
                    {rev.tags && rev.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {rev.tags.map((t: string) => <span key={t} className="text-[9px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{t}</span>)}
                      </div>
                    )}
                    <p className="text-xs text-gray-700 leading-relaxed break-keep">{rev.text}</p>
                    <p className="text-[9px] text-gray-400 mt-3 text-right">{rev.createdAt?.toDate ? rev.createdAt.toDate().toLocaleDateString() : '최근'}</p>
                  </div>
                )) : (
                  <div className="bg-gray-50 p-6 rounded-2xl text-center border border-dashed border-gray-200">
                    <span className="text-3xl mb-2 block opacity-50">✨</span>
                    <p className="text-xs text-gray-500 font-medium">아직 등록된 후기가 없어요.<br/>첫 번째 인증 리뷰를 남겨주세요!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 🔥 상태에 따라 다르게 나타나는 하단 고정 스마트 CTA 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.05)] flex gap-2 z-20">
          
          {/* 🔥 1. 제휴 조리원일 경우: 2버튼 체제 (방문상담 / 실시간 예약) */}
          {selectedCareDetail.status !== 'UNREGISTERED' && (
            <>
              <button onClick={() => setReservationModal({ isOpen: true, type: 'CONSULT' })} className="flex-1 py-4 bg-rose-50 text-rose-600 font-bold rounded-xl text-[14px] border border-rose-200 tracking-tight flex items-center justify-center gap-1.5">
                🗓️ 방문 상담
              </button>

              <button onClick={() => setReservationModal({ isOpen: true, type: 'RESERVE' })} className="flex-[1.5] py-4 bg-gray-900 text-white font-black rounded-xl text-[15px] shadow-md active:scale-95 transition-transform tracking-tight flex items-center justify-center gap-1.5">
                ⚡ 실시간 예약
              </button>
            </>
          )}

          {/* 🔥 2. 미제휴 조리원 영업용 버튼 (기존 코드 그대로 유지) */}
          {selectedCareDetail.status === 'UNREGISTERED' && (
             <button 
               onClick={async () => { 
                 if (isRequested) {
                   addToast('info', '이미 제휴 신청이 접수되었습니다! 조금만 기다려주세요 💌');
                   return;
                 }
                 
                 try {
                   await addDoc(collection(db, 'partnership_requests'), {
                     centerId: selectedCareDetail.id,
                     centerName: selectedCareDetail.name,
                     centerAddress: selectedCareDetail.address || selectedCareDetail.region,
                     userId: user.id,
                     userNickname: user.nickname,
                     userFcmToken: user.fcmToken || "", 
                     isNotified: false, 
                     createdAt: serverTimestamp() 
                   });

                   setIsRequested(true); 
                   addToast('success', '요청이 접수되었습니다! 원장님께 산모님의 마음을 꼭 전달할게요 💌'); 
                 } catch (error) {
                   console.error("제휴 요청 저장 실패:", error);
                   addToast('error', '요청 중 문제가 발생했습니다. 다시 시도해주세요.');
                 }
               }} 
               className={`w-full py-4 font-black rounded-xl text-[15px] shadow-md active:scale-95 transition-all ${isRequested ? 'bg-rose-100 text-rose-500' : 'bg-rose-500 text-white'}`}
             >
               {isRequested ? '✅ 제휴 요청 완료!' : '🙋‍♀️ 해당 업체도 제휴해 주세요!'}
             </button>
          )}
        </div>

        {/* 🔔 찜 & 알림 동의 팝업 */}
        {showAlarmPopup && (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-5 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative">
              <span className="text-5xl block mb-3 animate-bounce-short">❤️</span>
              <h3 className="font-black text-gray-900 text-lg mb-2">관심 조리원으로 등록 완료!</h3>
              <p className="text-[12px] text-gray-600 leading-relaxed mb-6 break-keep bg-rose-50 p-4 rounded-xl border border-rose-100">
                출산 예정일 전후로 방이 <b className="text-rose-500">딱 2개 이하</b> 남았을 때, 실시간 마감 임박 알림을 보내드릴까요?<br/>다른 분들보다 빠르게 기회를 잡으세요!
              </p>
              <div className="space-y-2">
                <button onClick={() => { 
                  syncSavedCenters([...savedCenters, selectedCareDetail.id]); // 🔥 파이어베이스에 찜 목록 추가!
                  setShowAlarmPopup(false); 
                  addToast('success', '마감 임박 시 푸시 알림을 보내드릴게요! 🔔'); 
                }} className="w-full py-3.5 bg-rose-500 text-white font-bold rounded-xl shadow-md">알림까지 받을게요! 🔔</button>
                
                <button onClick={() => { 
                  syncSavedCenters([...savedCenters, selectedCareDetail.id]); // 🔥 파이어베이스에 찜 목록 추가!
                  setShowAlarmPopup(false); 
                  addToast('info', '조리원 레지스트리에 담아두었습니다 ❤️'); 
                }} className="w-full py-3.5 bg-gray-50 text-gray-500 font-bold rounded-xl border border-gray-200 hover:bg-gray-100">그냥 찜만 해둘게요</button>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* 🚀 [신규 추가] 방문 상담 및 예약 팝업 (모달) */}
        {/* ========================================================================= */}
        {/* 🚀 방문 상담 및 실시간 예약 팝업 */}
        {/* 🚀 방문 상담 및 실시간 예약 팝업 */}
        {reservationModal.isOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/70 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-5 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-y-auto max-h-[90vh] no-scrollbar pb-safe">
              <button onClick={() => { setReservationModal({isOpen: false, type: 'CONSULT'}); setResDate(''); setResTime(''); setResPhone(''); }} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={24}/></button>
              
              <h3 className="font-black text-gray-900 text-xl mb-2">
                {reservationModal.type === 'CONSULT' ? '🗓️ 방문 상담 신청' : '⚡ 실시간 조리원 예약'}
              </h3>
              
              <p className="text-xs text-gray-500 mb-6 break-keep bg-gray-50 p-3.5 rounded-xl leading-relaxed font-medium">
                {reservationModal.type === 'CONSULT' 
                  ? '원하시는 방문 날짜를 선택하시면, 원장님이 열어둔 상담 가능 시간대가 나타납니다.' 
                  : '입소 예정일과 이용 주차를 입력하시면 현재 조리원 공실에 따른 예약 가능 여부를 실시간으로 계산해 드립니다.'}
              </p>
              
              {/* ======================= [ 방문상담 계단식 UI ] ======================= */}
              {reservationModal.type === 'CONSULT' && (
                <div className="space-y-6 pb-4">
                  
                  {/* STEP 1. 날짜 선택 */}
                  <div>
                    <label className="text-[13px] font-bold text-gray-800 mb-2 block">1. 방문하실 날짜를 선택해주세요</label>
                    <input 
                      type="date" 
                      value={resDate} 
                      onChange={e => {setResDate(e.target.value); setResTime('');}} 
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-rose-400 transition-colors shadow-inner" 
                    />
                  </div>

                  {/* 🚀 STEP 2. 시간 선택 (원장님이 파트너스에서 설정한 휴무/시간표 실시간 반영!) */}
                  {resDate && (() => {
                    const daysArr = ['일', '월', '화', '수', '목', '금', '토'];
                    const targetDay = daysArr[new Date(resDate).getDay()];
                    
                    // 1. 원장님이 예외 차단한 날짜 검사
                    const isBlocked = selectedCareDetail?.consultConfig?.blockedDates?.includes(resDate);
                    if (isBlocked) {
                      return <div className="animate-fade-in p-4 bg-rose-50 text-rose-600 rounded-xl font-bold text-center border border-rose-100 text-sm mt-4">🚫 원장님 사정으로 이 날은 상담이 불가능합니다.</div>;
                    }

                    // 2. 요일별 휴무 검사
                    const dayConfig = selectedCareDetail?.consultConfig?.schedule?.find((d: any) => d.day === targetDay);
                    if (dayConfig && !dayConfig.active) {
                      return <div className="animate-fade-in p-4 bg-gray-50 text-gray-500 rounded-xl font-bold text-center border border-gray-200 text-sm mt-4">해당 요일은 방문 상담 휴무일입니다.</div>;
                    }

                    const slots = dayConfig?.slots || [];

                    return (
                      <div className="animate-fade-in border-t border-gray-100 pt-5 mt-2">
                        <label className="text-[13px] font-bold text-gray-800 mb-3 flex justify-between items-center">
                          <span>2. 상담 가능 시간</span>
                          <span className="text-[10px] text-rose-500 font-normal bg-rose-50 px-2 py-0.5 rounded border border-rose-100 shadow-sm">파트너스 실시간 연동</span>
                        </label>
                        {slots.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {slots.map((s: any) => (
                              <button 
                                key={s.time} onClick={() => setResTime(s.time)} 
                                className={`py-3.5 rounded-xl text-[13px] font-bold transition-all shadow-sm ${resTime === s.time ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                              >
                                {s.time}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 bg-gray-50 rounded-xl text-xs text-gray-500 font-bold border border-gray-100">등록된 상담 시간이 없습니다.</div>
                        )}
                      </div>
                    );
                  })()}

                  {/* STEP 3. 정보 입력 폼 (시간까지 선택해야 짠! 하고 나타남) */}
                  {resTime && (
                    <div className="animate-fade-in bg-gray-50 p-5 rounded-2xl border border-gray-200 shadow-inner mt-4">
                      <label className="text-[13px] font-black text-gray-900 mb-4 block flex items-center gap-1.5"><span className="text-rose-500">📝</span> 3. 예약자 정보 확인</label>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">출산 예정일</label>
                          <input type="date" value={resEdd} onChange={e => setResEdd(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-400" />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">연락받으실 번호 (- 없이)</label>
                          <input type="tel" placeholder="01012345678" value={resPhone} onChange={e => setResPhone(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-400" />
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleSubmitReservation('CONSULT')} 
                        disabled={!resPhone || !resEdd || isSubmittingRes} 
                        className="w-full py-4 bg-gray-900 text-white font-black rounded-xl shadow-md hover:bg-black transition-transform active:scale-95 mt-5 disabled:bg-gray-300 text-[14px]"
                      >
                        {isSubmittingRes ? '전송 중...' : '상담 예약 신청하기 🚀'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ======================= [ 실시간 예약 끝판왕 UX ] ======================= */}
              {reservationModal.type === 'RESERVE' && (
                <div className="space-y-6 pb-4">
                  
                  {/* 🚀 STEP 1: 일정 및 등급 선택 화면 */}
                  {resStep === 1 && (
                    <div className="space-y-6 animate-fade-in">
                      {/* 1. 이용 주차 선택 */}
                      <div>
                        <label className="text-[13px] font-bold text-gray-800 mb-2 block">1. 조리원 이용 기간을 선택해주세요</label>
                        <div className="flex gap-2">
                          {['1주', '2주', '3주'].map(d => (
                            <button key={d} onClick={() => setResDuration(d)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${resDuration === d ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border border-gray-200'}`}>{d}</button>
                          ))}
                        </div>
                      </div>

                      {/* 2. 에어비앤비 스타일 달력 (은은한 바 표시) */}
                      <div>
                        <label className="text-[13px] font-bold text-gray-800 mb-2 block flex items-center justify-between">
                          <span>2. 입소 희망일 (초록색 점이 예약 가능일)</span>
                        </label>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 mb-2">
                            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
                          </div>
                          <div className="grid grid-cols-7 gap-y-2 text-center text-sm relative">
                            {Array.from({length: 14}).map((_, i) => {
                              const d = new Date(); d.setDate(d.getDate() + i + 1);
                              const dateStr = d.toISOString().split('T')[0];
                              const dayNum = d.getDate();
                              const isAvailable = dayNum % 2 !== 0; // 데모용: 홀수일만 초록점
                              
                              const startD = resDate ? new Date(resDate) : null;
                              const endD = resDate ? getEndDate(resDate, resDuration) : null;
                              startD?.setHours(0,0,0,0); endD?.setHours(0,0,0,0); d.setHours(0,0,0,0);
                              
                              const isSelected = resDate === dateStr;
                              const isInRange = startD && endD && d >= startD && d <= endD;
                              const isEnd = endD && d.getTime() === endD.getTime();

                              return (
                                <div key={i} onClick={() => setResDate(dateStr)} className={`relative flex justify-center items-center h-10 cursor-pointer ${isInRange ? 'bg-emerald-50' : ''} ${isSelected ? 'rounded-l-full' : ''} ${isEnd ? 'rounded-r-full' : ''}`}>
                                  {isSelected && <div className="absolute inset-1 bg-emerald-500 rounded-full z-10"></div>}
                                  <span className={`relative z-20 font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{dayNum}</span>
                                  {isAvailable && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-emerald-400 rounded-full"></div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 3. 객실 등급 선택 및 결과 버튼 */}
                      {resDate && (
                        <div className="animate-fade-in border-t border-gray-100 pt-5">
                          <label className="text-[13px] font-bold text-gray-800 mb-3 flex items-center justify-between">
                            <span>3. 희망 객실 등급</span>
                            <span className="text-[10px] text-emerald-500 font-normal bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm">가격 정보 실시간 연동됨</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2 mb-5">
                            
                            {/* 🚀 [업그레이드] 실시간 파이어베이스 연동된 객실 및 가격 버튼 */}
                            {selectedCareDetail.rooms && selectedCareDetail.rooms.length > 0 ? (
                              selectedCareDetail.rooms.map((room: any, idx: number) => (
                                <button 
                                  key={idx} 
                                  onClick={() => setResRoomGrade(room.name)} 
                                  className={`p-4 rounded-2xl text-xs font-bold transition-all shadow-sm flex flex-col items-center justify-center gap-1.5 ${resRoomGrade === room.name ? 'bg-orange-50 border-orange-400 text-orange-600 border-2' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                  <span className="text-[13px]">{room.name}</span>
                                  <span className={resRoomGrade === room.name ? 'text-orange-500' : 'text-gray-400'}>
                                    {room.price ? (room.price % 10000 === 0 ? `${(room.price/10000).toLocaleString()}만원` : `${room.price.toLocaleString()}원`) : '가격 문의'}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="col-span-full py-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">조리원 객실 정보를 불러오는 중입니다...</div>
                            )}
                          </div>

                          {resRoomGrade && (() => {
                            let isFlexAllowed = true;
                            let flexBlockMessage = "";
                            const isDirectAvailable = resRoomGrade !== 'VIP실'; // VIP실 확정 불가 로직은 영업용으로 유지

                            // 🚀 [업그레이드] Yield(수익) 비율 기반 플렉스 예약 자동 차단 로직
                            if (selectedCareDetail?.yieldConfig && resDate) {
                              const { flexRatio, appliedFrom } = selectedCareDetail.yieldConfig;
                              
                              if (appliedFrom && new Date(resDate) >= new Date(appliedFrom)) {
                                // 파이어베이스에서 가져온 '현재 예약 현황'을 바탕으로 플렉스 비율 초과 여부를 검사!
                                const flexCount = currentReservations.filter(r => r.type === 'FLEX' && r.date === resDate).length;
                                const flexLimit = 2; // (데모 영업용: 해당 날짜에 2명 이상이면 플렉스 마감)
                                
                                if (flexCount >= flexLimit) {
                                  isFlexAllowed = false;
                                  flexBlockMessage = `선택하신 날짜는 플렉스 쿼터가 마감되었습니다 (현재 설정: ${flexRatio}%)`;
                                }
                              }
                            }

                            return (
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                  <button disabled={!isDirectAvailable} onClick={() => { setResType('DIRECT'); setResStep(2); }} className={`flex-1 py-4 rounded-xl text-sm font-bold shadow-md transition-all tracking-tight ${isDirectAvailable ? 'bg-gray-900 text-white hover:bg-black active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>⚡ 확정 예약</button>
                                  <button disabled={!isFlexAllowed} onClick={() => { setResType('FLEX'); setResStep(2); }} className={`flex-1 py-4 rounded-xl text-sm font-bold shadow-md transition-all tracking-tight flex items-center justify-center gap-1 ${isFlexAllowed ? 'bg-orange-500 text-white active:scale-95 hover:bg-orange-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                    🌊 플렉스 예약 {!isFlexAllowed && '마감'}
                                  </button>
                                </div>
                                {!isFlexAllowed && <p className="text-[11px] font-bold text-red-500 text-center mt-1 animate-pulse">{flexBlockMessage}</p>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 🚀 STEP 2: 정보 입력 및 결제(가계약금) 폼 */}
                  {resStep === 2 && (
                    <div className="space-y-5 animate-fade-in">
                      <button onClick={() => setResStep(1)} className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-1">← 뒤로가기</button>
                      
                      {resType === 'FLEX' && (
                        <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl mb-4">
                          <h4 className="font-black text-orange-600 text-[14px] mb-2">🌊 플렉스 예약 필수 안내</h4>
                          <p className="text-[12px] text-gray-700 leading-relaxed break-keep">
                            플렉스 예약은 조기 출산 등 예기치 못한 상황으로 조리원 호실이 즉시 확보되지 못할 경우, <b>병원에서 2~3일 대기(연장)해주시는 것을 동의</b>하는 조건부 예약입니다.<br/><br/>
                            동의해 주신 산모님께는 대기 발생 시 <b>우선 배정 권한 및 특별 페이백/마사지 업그레이드 혜택</b>을 조리원과 별도 소통하여 제공해 드립니다.
                          </p>
                        </div>
                      )}

                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 shadow-inner">
                        <div className="mb-4">
                          <p className="text-[11px] font-bold text-gray-500 mb-1">선택 내역</p>
                          <p className="font-black text-gray-900">{resDate} 입소 • {resRoomGrade} ({resDuration})</p>
                          
                          {/* 🔥 진짜 가격 로직: 가격 데이터가 있으면 금액을, 없으면 '조리원 별도 안내'를 띄웁니다! */}
                          {(() => {
                            const roomsList = selectedCareDetail.rooms || selectedCareDetail.roomTypes || [];
                            const selectedRoomData = roomsList.find((r:any) => (typeof r === 'string' ? r : r.name) === resRoomGrade);
                            
                            // 🔥 UX 최적화: 만원 단위로 딱 떨어지면 '300만원', 아니면 '3,001,000원'으로 똑똑하게 표기!
                            const displayPrice = selectedRoomData?.price 
                                ? (selectedRoomData.price % 10000 === 0 
                                    ? `${(selectedRoomData.price / 10000).toLocaleString()}만원` 
                                    : `${selectedRoomData.price.toLocaleString()}원`)
                                : '조리원 별도 안내';
                            
                            return (
                              <p className="text-rose-500 font-bold text-sm mt-1">예상 이용 금액: {displayPrice}</p>
                            );
                          })()}
                        </div>

                        <div className="space-y-3 mb-5">
                          <input type="text" placeholder="예약자 성함 (실명)" value={resName} onChange={e => setResName(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-400" />
                          <input type="tel" placeholder="연락처 (- 없이)" value={resPhone} onChange={e => setResPhone(e.target.value)} className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-400" />
                        </div>

                        <div className="border-t border-gray-200 pt-4 mb-4">
                          <h4 className="font-bold text-[13px] text-gray-900 mb-2">가계약금(20만 원) 입금 안내</h4>
                          <p className="text-[11px] text-gray-600 leading-relaxed break-keep mb-3">해당 일정의 객실 확보를 위해 우선 가계약금을 결제해 주세요. 입금 확인 시 SaaS와 연동되어 확정 문자가 발송됩니다.</p>
                          <div className="bg-white p-3 rounded-xl border border-gray-200 font-mono text-[13px] font-bold text-center text-gray-800">
                            신한은행 110-123-456789<br/><span className="text-gray-500 text-[11px]">예금주: 봄이옴 데모 조리원</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-gray-200 text-[10px] text-gray-500 leading-relaxed mb-5">
                          [위약금 안내] 입소 예정일 31일 전까지 취소 시 가계약금 전액 환불 가능합니다. 이후 취소 시 규정에 따라 위약금이 발생할 수 있습니다.
                        </div>

                        <button 
                          onClick={() => {
                            handleSubmitReservation(resType);
                          }} 
                          disabled={!resName || !resPhone || isSubmittingRes} 
                          className="w-full py-4 bg-rose-500 text-white font-black rounded-xl shadow-md hover:bg-rose-600 transition-transform active:scale-95 disabled:bg-gray-300 text-[14px]"
                        >
                          {isSubmittingRes ? '처리 중...' : '위약금 규정 확인 및 예약 완료 🚀'}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}

        {/* 🔥 플렉스 전용 주의사항 전체 음영 팝업 */}
        {isFlexModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
            <div style={{ backgroundColor: 'white', width: '90%', maxWidth: '340px', padding: '30px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚠️</div>
              <h3 style={{ fontWeight: '900', fontSize: '18px', color: '#333', marginBottom: '12px' }}>봄이옴 플렉스 필독사항</h3>
              <div style={{ textAlign: 'left', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '12px', fontSize: '13px', color: '#666', lineHeight: '1.6', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#f59e0b' }}>📌 출산일 변동 시 대기 안내</p>
                플렉스 예약은 조리원 만실 시 <b>병원에서 2~3일 대기</b>할 수 있음을 인지하고 신청하는 유연 예약 서비스입니다.<br/><br/>
                대기 발생 시, 조리원에서 <b>가장 우선적으로 입실</b>을 도와드립니다.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={() => handleSubmitReservation('FLEX')} 
                  disabled={isSubmittingRes}
                  style={{ width: '100%', padding: '16px', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isSubmittingRes ? '처리 중...' : '내용 확인, 플렉스 예약하기'}
                </button>
                <button onClick={() => setIsFlexModalOpen(false)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '13px', marginTop: '5px', cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          </div>
        )}
        {/* 📝 클린 리뷰 작성 모달 */}
        {isReviewModalOpen && (
          <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
              <button onClick={() => { setIsReviewModalOpen(false); setReviewRating(0); setReviewText(''); setReviewTags([]); setReceiptFile(null); }} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600"><X size={24}/></button>
              
              <h3 className="font-black text-gray-900 text-lg mb-1 flex items-center gap-1.5"><span className="text-2xl">✍️</span> 찐 산모 리뷰 작성</h3>
              <p className="text-[11px] text-gray-500 mb-5 break-keep bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                {reviewType === 'AUTO' ? '봄이옴 예약 내역이 확인되었습니다! 솔직한 후기를 남겨주세요.' : '실제 이용객 확인을 위해 영수증(계약서) 첨부가 필요합니다. 사진은 관리자만 확인 후 파기됩니다.'}
              </p>

              <div className="space-y-5 text-left">
                {/* 1. 별점 입력 (가이드 문구 포함) */}
                <div className="flex flex-col items-center border-b border-gray-100 pb-5">
                  <div className="h-6 mb-2">
                    {reviewRating > 0 && (
                      <span className="text-[11px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 animate-fade-in break-keep leading-relaxed block text-center">
                        💡 {RATING_GUIDES[reviewRating]}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setReviewRating(star)} className="text-3xl transition-transform active:scale-90">
                        <span className={star <= reviewRating ? "text-yellow-400 drop-shadow-sm" : "text-gray-200 grayscale"}>⭐</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. 장점 키워드 선택 */}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-2 block">조리원의 장점은 무엇인가요? (최대 3개)</label>
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_TAG_LIST.map(tag => {
                      const isSelected = reviewTags.includes(tag);
                      return (
                        <button 
                          key={tag} 
                          onClick={() => {
                            if (isSelected) setReviewTags(reviewTags.filter(t => t !== tag));
                            else if (reviewTags.length < 3) setReviewTags([...reviewTags, tag]);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${isSelected ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 텍스트 리뷰 */}
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-2 block flex justify-between">
                    상세 후기 작성 <span className="text-[9px] text-gray-400 font-normal">*최소 50자</span>
                  </label>
                  <textarea 
                    value={reviewText} onChange={e => setReviewText(e.target.value)} 
                    placeholder="후배 산모들을 위해 좋았던 점, 아쉬웠던 점을 50자 이상 자세히 남겨주세요!" 
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-rose-400 resize-none h-28 leading-relaxed box-border"
                  />
                  <p className="text-[9px] text-gray-400 text-right mt-1">{reviewText.length} / 500자</p>
                </div>

                {/* 4. 영수증 첨부 (MANUAL일 때만) */}
                {reviewType === 'MANUAL' && (
                  <div className="animate-fade-in bg-rose-50 p-4 rounded-xl border border-rose-100">
                    <label className="text-xs font-bold text-rose-700 mb-2 block flex items-center gap-1"><Camera size={14}/> 결제 영수증 또는 계약서 첨부</label>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-rose-200 rounded-xl bg-white hover:bg-rose-50 cursor-pointer transition-colors shadow-inner">
                      {receiptFile ? <span className="text-[11px] font-bold text-rose-600 break-all px-2 text-center">✅ {receiptFile.name}</span> : <><Upload className="text-rose-300 mb-1" size={20}/> <span className="text-[10px] text-rose-500 font-medium">사진 선택하기</span></>}
                      <input type="file" accept="image/*" onChange={(e) => { if(e.target.files) setReceiptFile(e.target.files[0]); }} className="hidden"/>
                    </label>
                  </div>
                )}

                <button 
                  onClick={async () => {
                    if (reviewRating === 0) { addToast('error', '별점을 선택해주세요!'); return; }
                    if (reviewText.length < 50) { addToast('error', '상세 후기를 50자 이상 작성해주세요!'); return; }
                    if (reviewType === 'MANUAL' && !receiptFile) { addToast('error', '영수증(계약서) 사진을 첨부해주세요!'); return; }

                    setIsSubmittingReview(true);
                    try {
                      let imageUrl = '';
                      // 진짜 파이어베이스 Storage 연동 시 아래 주석 해제 (지금은 데모 텍스트로 대체)
                      /*
                      if (receiptFile) {
                        const storageRef = ref(storage, `receipts/${user.id}_${Date.now()}`);
                        await uploadBytes(storageRef, receiptFile);
                        imageUrl = await getDownloadURL(storageRef);
                      }
                      */

                      await addDoc(collection(db, 'care_reviews'), {
                        centerId: selectedCareDetail.id,
                        userId: user.id,
                        userName: user.nickname,
                        rating: reviewRating,
                        tags: reviewTags,
                        text: reviewText,
                        receiptUrl: imageUrl || '데모_영수증_URL',
                        type: reviewType,
                        status: reviewType === 'AUTO' ? 'APPROVED' : 'PENDING',
                        createdAt: serverTimestamp()
                      });

                      addToast('success', reviewType === 'AUTO' ? '리뷰가 등록되었습니다! ✨' : '인증 요청이 완료되었습니다. 승인 후 노출됩니다 ⏳');
                      setIsReviewModalOpen(false);
                      setReviewRating(0); setReviewText(''); setReviewTags([]); setReceiptFile(null);
                    } catch (e) {
                      addToast('error', '리뷰 등록에 실패했습니다.');
                    } finally {
                      setIsSubmittingReview(false);
                    }
                  }}
                  disabled={isSubmittingReview || reviewRating === 0 || reviewText.length < 50 || (reviewType === 'MANUAL' && !receiptFile)}
                  className="w-full py-4 bg-gray-900 text-white font-black rounded-xl shadow-md disabled:bg-gray-300 transition-transform active:scale-95 text-sm"
                >
                  {isSubmittingReview ? '등록 중...' : '리뷰 등록하기 🚀'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 🔥 [여기 추가!] 마커 & 하단 리스트 클릭 시 상세페이지를 띄워주는 통합 함수
  const handleMarkerClick = (center: any) => {
    setSelectedCareDetail(center); // 상세페이지에 해당 조리원 데이터 넣기
    setSheetState('HIDDEN');       // 지도를 가리지 않도록 하단 리스트는 밑으로 숨기기
    setIsRequested(false);         // 제휴 요청 버튼 상태 초기화
  };

  // 🔥 [여기 추가] 지역 필터 적용 시 지도를 해당 지역으로 쓩! 날려주는 함수
  // 🔥 큰 지역(시/도) 단위로만 지도를 쓩! 날려주는 함수
  const handleApplyRegionFilter = () => {
    setShowRegionModal(false);

    if (!filterSido) {
      setMapCenter({ lat: 36.3, lng: 127.8 }); // 초기 전국 뷰
      setMapLevel(12);
      return;
    }

    if ((window as any).kakao && (window as any).kakao.maps && (window as any).kakao.maps.services) {
      const geocoder = new (window as any).kakao.maps.services.Geocoder();
      
      // 💡 "광주"가 경기도 광주로 가는 현상 방지! 명확한 행정구역명으로 변환
      let searchKeyword = filterSido;
      if (filterSido === '광주') searchKeyword = '광주광역시';
      else if (filterSido === '대구') searchKeyword = '대구광역시';
      else if (filterSido === '대전') searchKeyword = '대전광역시';
      else if (filterSido === '부산') searchKeyword = '부산광역시';
      else if (filterSido === '울산') searchKeyword = '울산광역시';
      else if (filterSido === '인천') searchKeyword = '인천광역시';
      else if (filterSido === '서울') searchKeyword = '서울특별시';

      geocoder.addressSearch(searchKeyword, function(result: any, status: any) {
        if (status === (window as any).kakao.maps.services.Status.OK) {
          setMapCenter({ lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) });
          setMapLevel(10);
        }
      });
    }
  };

  const isAnyModalOpen = showDemandPopup || showFilterModal || showRegionModal || showRegistry || reservationModal.isOpen || isFlexModalOpen || isReviewModalOpen || showAlarmPopup;

  // 🌟 B. 메인 지도 & 리스트 화면
  return (
    <div className={`fixed inset-0 bg-[#e8f0f4] flex flex-col overflow-hidden font-pretendard ${isAnyModalOpen ? 'z-[150]' : 'z-[90]'}`}>
      
      {/* 🔥 [신규] 수요 조사 안내 모달 (가장 최상단에 렌더링) */}
      {showDemandPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <span className="text-5xl mb-4 block animate-bounce-short">🚀</span>
            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">조리원 실시간 예약 오픈 준비 중!</h3>
            <p className="text-[13px] text-gray-600 leading-relaxed mb-6 break-keep bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              현재 해당 기능의 정식 오픈을 위해 수요 조사를 진행하고 있어요.<br/><br/>
              원하시는 조리원을 검색하신 후 <b>[제휴 신청]</b> 버튼을 꾹 눌러주시면, 봄이옴 팀이 원장님께 직접 달려가겠습니다! 🏃‍♂️💨
            </p>
            <button onClick={() => setShowDemandPopup(false)} className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl shadow-md hover:bg-emerald-600 transition-colors">
              확인했습니다!
            </button>
          </div>
        </div>
      )}

      {/* 1. 상단 스마트 검색 & 2단 필터 */}
      <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-4 pb-6 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto w-full max-w-md mx-auto relative z-50">
          {/* 검색창 라인 */}
          <div className="flex items-start gap-2 w-full">
            <button onClick={onBack} className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center text-gray-700 shadow-md shrink-0"><ArrowLeft size={20} /></button>
            <div className="relative flex-1">
              <div className="h-10 bg-white/95 backdrop-blur-md rounded-full flex items-center px-4 shadow-md border border-gray-100 min-w-0 box-border">
                <Search size={16} className="text-gray-400 mr-2 shrink-0" />
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="조리원명/지역 검색" 
                  className="flex-1 bg-transparent text-sm outline-none text-gray-800 w-full" 
                />
              </div>

              {/* 🔥 네이버식 자동완성 드롭다운 (검색어가 1글자라도 있을 때만 나타남!) */}
              {searchQuery.trim().length > 0 && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[100] max-h-60 overflow-y-auto animate-fade-in">
                  {filteredCenters.length > 0 ? (
                    // 너무 많으면 화면을 가리니까 상위 10개만 보여줍니다 (.slice(0, 10))
                    filteredCenters.slice(0, 10).map((care) => (
                      <div 
                        key={care.id} 
                        onClick={() => {
                          setSelectedCareDetail(care); // 누르는 즉시 상세페이지 팝업 띄우기!
                          setSearchQuery(''); // 팝업 떴으니 검색창 글씨는 비워주기
                        }}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 flex items-center gap-2 last:border-0"
                      >
                        <Search size={12} className="text-gray-300 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-800 truncate">{care.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{care.address ? care.address.split(' ').slice(0,2).join(' ') : care.region}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-5 text-center text-sm text-gray-400 font-bold">
                      검색 결과가 없습니다 😢
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* 🔥 [바로 여기입니다!] 검색창 덩어리 우측에 하트 버튼 쏙 추가 */}
            <button onClick={() => setShowRegistry(true)} className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-md shrink-0 active:scale-95 transition-transform relative">
              <Heart size={20} fill={savedCenters.length > 0 ? "currentColor" : "none"} className={savedCenters.length > 0 ? "text-rose-500" : "text-gray-400"} />
              {savedCenters.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 border-2 border-white rounded-full"></span>}
            </button>
          </div>
          {/* 스마트 필터 버튼 (가로 스크롤) */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pl-12 pr-4 pb-1">
            <button 
              onClick={() => setShowRegionModal(true)}
              className={`h-8 px-3.5 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center gap-1.5 text-[11px] font-bold border shrink-0 active:scale-95 transition-transform ${filterSido ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white/95 text-gray-700 border-gray-100'}`}
            >
              <MapPin size={12} className={filterSido ? "text-rose-600" : "text-rose-500"} /> 
              {filterSido || '전체 지역'} <ChevronDown size={12} />
            </button>
            <button 
              onClick={() => setShowFilterModal(true)}
              className={`h-8 px-3.5 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center gap-1.5 text-[11px] font-bold border shrink-0 active:scale-95 transition-transform ${filterDate ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white/95 text-gray-700 border-gray-100'}`}
            >
              <Calendar size={12} className={filterDate ? "text-blue-600" : "text-blue-500"} /> 
              {filterDate ? filterDate.substring(5) : '입소 희망일'} <ChevronDown size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. 지도 영역 (화면 연동 + 줌 레벨 조절) */}
      <div className="absolute inset-0 z-0" onClick={() => setSheetState('HIDDEN')}>
        {isLayoutReady ? (
          <Map
            center={mapCenter}
            level={mapLevel}
            style={{ width: '100%', height: '100%' }}
            // 🔥 [수정 1] 지도가 켜질 때 한 번만 조용히 실행되도록 setTimeout 적용 (무한루프 방지)
            onCreate={(map) => {
              setTimeout(() => {
                const bounds = map.getBounds();
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();
                
                const inView = filteredCenters.filter(c => 
                  c.lat >= sw.getLat() && c.lat <= ne.getLat() &&
                  c.lng >= sw.getLng() && c.lng <= ne.getLng()
                );
                setVisibleCenters(inView);
              }, 150); // 0.15초 뒤에 한 번만 딱 계산!
            }}
            // 🔥 [수정 2] onBoundsChanged 대신 onIdle 사용! (지도가 '멈췄을 때만' 계산해서 앱 튕김 완벽 방지)
            onIdle={(map) => {
              setMapLevel(map.getLevel());
              const bounds = map.getBounds();
              const sw = bounds.getSouthWest();
              const ne = bounds.getNorthEast();
              
              const inView = filteredCenters.filter(c => 
                c.lat >= sw.getLat() && c.lat <= ne.getLat() &&
                c.lng >= sw.getLng() && c.lng <= ne.getLng()
              );
              setVisibleCenters(inView);
            }}
          >
            <MarkerClusterer averageCenter={true} minLevel={8} gridSize={120}>
              {filteredCenters.map((center) => {
                if (center.id === "care_gangnam_01") return null; // 🔥 지도 위 핀은 무조건 숨김!
                return (
                  <CustomOverlayMap
                    key={center.id}
                    position={{ lat: center.lat, lng: center.lng }}
                  >
                    <div 
                      onClick={(e) => {
                        e.stopPropagation(); // 🚀 지도 클릭 이벤트 전파 방지
                        // 🚀 마커 클릭 시 상세 페이지로 이동!
                        setSelectedCareDetail(center); 
                        setSheetState('HIDDEN'); // 지도를 가리지 않게 바텀시트는 숨김
                        setIsRequested(false);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-xl cursor-pointer transition-transform hover:scale-110 active:scale-95 border-2 ${
                        center.status === 'REGISTERED' 
                        ? 'bg-[#FF7F50] text-white border-white' 
                        : 'bg-white text-gray-600 border-gray-200 opacity-90'
                      }`}
                    >
                      {center.status === 'REGISTERED' ? (center.price || '제휴') : center.name}
                    </div>
                  </CustomOverlayMap>
                );
              })}
            </MarkerClusterer>
          </Map>
        ) : (
          <div className="w-full h-full bg-[#f2f4f6] flex items-center justify-center">
            <p className="text-gray-400 font-bold text-sm animate-pulse">지도를 불러오는 중입니다...</p>
          </div>
        )}
      </div>

      {/* 3. 스마트 플로팅 버튼 (리스트 숨겼을 때 등장) */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40">
        {sheetState === 'HIDDEN' && (
          <button onClick={() => setSheetState('HALF')} className="bg-gray-900 text-white px-5 py-3.5 rounded-full shadow-2xl font-bold text-[13px] flex items-center gap-2 animate-bounce-short active:scale-95 transition-transform border border-gray-700">
            <ListFilter size={16}/> 목록 보기
          </button>
        )}
      </div>

      {/* 4. 드래그 가능한 바텀시트 */}
      <div 
        className={`absolute left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out z-30 flex flex-col mb-16
          ${sheetState === 'HIDDEN' ? 'top-[100%]' : sheetState === 'FULL' ? 'top-[12%] bottom-0' : 'top-[60%] bottom-0'}`}
      >
        <div 
          onTouchStart={handleTouchStart} 
          onTouchEnd={handleTouchEnd}
          className="w-full pt-4 pb-2 flex flex-col items-center cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-1"></div>
          <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">Swipe</span>
        </div>
        
        <div className="px-5 pb-3 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h3 className="font-black text-gray-800 text-[15px]">화면 안 조리원 <span className="text-rose-500">{visibleCenters.length}</span>곳</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-10">
          {visibleCenters.length > 0 ? visibleCenters.map((care) => (
            <div key={care.id} onClick={() => handleMarkerClick(care)} className="flex gap-4 p-2 bg-white rounded-2xl cursor-pointer hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors shadow-sm">
              <img src={care.img || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=500&q=80&blur=10'} className={`w-20 h-20 rounded-xl object-cover shrink-0 ${care.status === 'UNREGISTERED' ? 'grayscale opacity-80' : ''}`} />
              <div className="flex flex-col justify-center min-w-0">
                <p className="text-[10px] font-bold text-gray-400 mb-1">{care.address ? care.address.split(' ').slice(0,2).join(' ') : '전국'}</p>
                <h4 className="font-bold text-sm text-gray-900 truncate mb-1">{care.name}</h4>
                <p className="text-xs font-black text-rose-500">{care.price || '가격 문의'}</p>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 text-gray-400 text-sm">현재 보이는 지도 영역에 조리원이 없습니다.<br/>지도를 이동해보세요!</div>
          )}
        </div>
      </div>

      {/* 6. 날짜 필터 모달 */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-end animate-fade-in pb-safe">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-10 shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-gray-900">상세 필터</h3><button onClick={() => setShowFilterModal(false)} className="text-gray-400"><X size={24}/></button></div>
            <h4 className="text-sm font-bold text-gray-700 mb-3">🗓️ 입소 예정일 & 기간</h4>
            <div className="flex gap-2 mb-8">
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="flex-[1.5] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none box-border" />
              <select className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none box-border">
                <option>2주 (13박)</option><option>1주 (6박)</option><option>3주 (20박)</option>
              </select>
            </div>
            <button onClick={() => setShowFilterModal(false)} className="w-full py-4 bg-rose-500 text-white font-black rounded-xl text-sm shadow-md active:scale-95 transition-transform">필터 적용하기</button>
          </div>
        </div>
      )}

      {/* 7. 지역 필터 모달 */}
      {/* 지역 필터 모달 (세련된 버튼 Grid 방식) */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-end animate-fade-in pb-safe">
          <div className="bg-white w-full rounded-t-3xl p-6 pb-10 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-gray-900">어느 지역을 찾으시나요?</h3>
              <button onClick={() => setShowRegionModal(false)}><X size={24} className="text-gray-400"/></button>
            </div>
            
            {/* 🔥 최신 플랫폼 스타일: 지역 바둑판(Grid) 버튼 */}
            <div className="grid grid-cols-4 gap-2 mb-8">
              {['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'].map((region) => (
                <button
                  key={region}
                  onClick={() => setFilterSido(region)}
                  className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                    filterSido === region 
                    ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm' 
                    : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>

            {/* 🔥 버튼 높이(py-3), 글씨 크기(text-sm, font-bold)를 줄여 세련되게 변경! */}
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setFilterSido(''); setShowRegionModal(false); setMapCenter({ lat: 36.3, lng: 127.8 }); setMapLevel(13); }} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl active:scale-95 transition-transform">전국 보기</button>
              <button onClick={handleApplyRegionFilter} className="flex-[2] py-3 bg-gray-900 text-white font-bold text-sm rounded-xl shadow-md active:scale-95 transition-transform">이 지역으로 이동</button>
            </div>
          </div>
        </div>
      )}
      {/* 8. 찜한 조리원 레지스트리 모달 */}
      {showRegistry && (
        <div className="fixed inset-0 bg-gray-50 z-[400] flex flex-col animate-fade-in pb-safe">
          <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Heart size={20} className="text-rose-500" fill="currentColor"/> 나의 레지스트리</h2>
            <button onClick={() => setShowRegistry(false)} className="text-gray-400 p-2"><X size={24}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {savedCenters.length > 0 ? (
              centers.filter(c => savedCenters.includes(c.id)).map((care) => (
                <div key={care.id} onClick={() => { setSelectedCareDetail(care); setShowRegistry(false); }} className="flex gap-4 p-3 bg-white rounded-2xl shadow-sm cursor-pointer border border-transparent hover:border-rose-100">
                  <img src={care.img || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=500&q=80&blur=10'} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                  <div className="flex flex-col justify-center min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">{care.address ? care.address.split(' ').slice(0,2).join(' ') : '전국'}</p>
                    <h4 className="font-bold text-sm text-gray-900 truncate mb-1">{care.name}</h4>
                    <p className="text-xs font-black text-rose-500">{care.price || '가격 문의'}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center mt-20">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                  <Heart size={32} className="text-rose-300" />
                </div>
                <h3 className="font-bold text-gray-800 mb-2">아직 찜한 조리원이 없어요!</h3>
                <p className="text-sm text-gray-500 leading-relaxed">마음에 드는 조리원을 발견하면<br/>하트를 눌러 나만의 레지스트리를 채워보세요.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- 메인 App 실행부 ---
const App: React.FC = () => {
  const [view, setView] = useState<'HOME' | 'RESULT' | 'NATIONWIDE' | 'MYPAGE' | 'MALL' | 'LOUNGE' | 'CARE_RESERVATION' | 'ADMIN_REPORT' | 'GARDEN' | 'FINCH'>('HOME');
  const [activeBoardTitle, setActiveBoardTitle] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [helpersData, setHelpersData] = useState<any[]>([]); 
  const [savedCenters, setSavedCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔥 [신규 추가] 혜택별 실시간 신청자/부러워요 카운트를 파이어베이스에서 담아올 바구니
  const [benefitStats, setBenefitStats] = useState<Record<string, { appliedCount?: number, envyCount?: number }>>({});

  useEffect(() => {
    if (!db) return;
    // 파이어베이스 'benefit_stats' 방에서 실시간 카운트만 가볍게 읽어옵니다.
    const unsub = onSnapshot(collection(db, 'benefit_stats'), (snap) => {
      const stats: Record<string, any> = {};
      snap.forEach(doc => {
        stats[doc.id] = doc.data();
      });
      setBenefitStats(stats);
    });
    return () => unsub();
  }, []);

  // 🔥 [신규 추가] 구글시트 원본 데이터(benefits)에 실시간 카운트(benefitStats)를 스윽 덮어씌운 완성본!
  const mergedBenefits = useMemo(() => {
    return benefits.map(b => ({
      ...b,
      // 원본 구글시트 점수(b.appliedCount)에 파이어베이스 누적 점수(benefitStats)를 더해줍니다!
      appliedCount: (Number(b.appliedCount) || 0) + (benefitStats[b.id]?.appliedCount || 0),
      envyCount: (Number(b.envyCount) || 0) + (benefitStats[b.id]?.envyCount || 0),
    }));
  }, [benefits, benefitStats]);

  const [showAddressSetupModal, setShowAddressSetupModal] = useState(false);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [userActions, setUserActions] = useState<{ applied: string[], envy: string[] }>({ applied: [], envy: [] });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [isApp, setIsApp] = useState<boolean>(false);
  const [showRegistryReport, setShowRegistryReport] = useState(false);

  const [showAppPopup, setShowAppPopup] = useState(false);
  const [showSmartBanner, setShowSmartBanner] = useState(false);
  const [osType, setOsType] = useState<'ios' | 'android' | 'other'>('other');

  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  useEffect(() => {
    const isStoreLive = true;

    if (typeof window !== 'undefined' && isStoreLive) {
      // 🔥 injectedJavaScript 주입 완료될 때까지 잠깐 기다린 후 체크
      setTimeout(() => {
        const isWebView = !!(window as any).ReactNativeWebView;
        const hasBomiomBadge = navigator.userAgent.includes('BomiomApp');
        const isAppEnv = isWebView || hasBomiomBadge;
        const isOldVersion = !(window as any).isBomiomNewVersion;
        const ua = navigator.userAgent.toLowerCase();
        const isAndroid = /android/.test(ua);

        if (isAppEnv && isOldVersion) {
          setShowUpdatePopup(true);
        }
      }, 1000); // 1초 후 체크
    }
  }, []);

  useEffect(() => {
    // 1. 사용자가 아이폰인지 갤럭시인지 귀신같이 알아내는 로직 (OS 감지)
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setOsType('ios');
    else if (/android/.test(ua)) setOsType('android');

    // 2. 웹인지 우리 앱(웹뷰)인지 확인
    const isWebView = typeof window !== 'undefined' && (window as any).ReactNativeWebView;
    const hasBomiomBadge = navigator.userAgent.includes('BomiomApp');
    const currentPlatform = (isWebView || hasBomiomBadge) ? 'app' : 'web';

    // 3. 구글 애널리틱스에 접속 환경 전송
    if (analytics) logEvent(analytics, 'platform_check', { access_platform: currentPlatform });

    // 4. 앱으로 들어온 사람이면 배너와 팝업 모두 숨김!
    if (currentPlatform === 'app') return;

    // 5. 웹 유저라면? 상단 띠 배너는 항상 노출!
    setShowSmartBanner(true);

    // 6. 중앙 팝업은 딱 1번만 노출!
    const hasSeenPopup = localStorage.getItem('bomiom_app_popup_seen');
    if (!hasSeenPopup && view === 'RESULT') {
      const timer = setTimeout(() => setShowAppPopup(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [view]);

  const handleAppPopupClick = (actionType: string) => {
    if (analytics) logEvent(analytics, 'app_download_click', { button_type: actionType, os: osType });
    setShowAppPopup(false);
    localStorage.setItem('bomiom_app_popup_seen', 'true');
  };

  // 기기별 다운로드 링크 (안드로이드는 나중에 진짜 주소로 바꾸시면 됩니다!)
  const APP_DOWNLOAD_LINK = osType === 'android' 
    ? 'https://play.google.com/store/apps/details?id=com.bomiom.app' // 👈 안드로이드 임시 링크
    : 'https://apps.apple.com/kr/app/봄이옴-예비-엄마아빠의-임신-출산-가이드/id6762029788'; // 👈 아이폰 찐 링크

  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.userAgent.includes('BomiomApp')) {
      setIsApp(true);
    }
  }, []);

  // 🔥 [변경] 초기값이 아니라, 현재 탭 상태 자체를 App에서 직접 관리합니다!
  const [resultActiveTab, setResultActiveTab] = useState<'GOV'|'JOURNEY'|'MOMS'>('GOV'); 
  const [showMomspickHint, setShowMomspickHint] = useState(false);
  const [mallSource, setMallSource] = useState<'NONE' | 'REGISTRY' | 'VERIFY'>('NONE'); 

  useEffect(() => {
    const checkLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');

      if (uid || localStorage.getItem('bomiom_user')) {
        const userId = uid || JSON.parse(localStorage.getItem('bomiom_user')!).id;
        
        // 🔥 파이어베이스에서 유저 정보(찜 목록 포함)를 진짜로 가져옵니다.
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          setUser(userData);
          localStorage.setItem('bomiom_user', JSON.stringify(userData));
          
          // 🔥 서버에 저장된 찜 목록(savedCenters)이 있으면 상태에 넣어줍니다.
          if (userData.savedCenters) {
            setSavedCenters(userData.savedCenters);
          }
          if (userData.nickname && userData.address) {
            setView('RESULT'); 
          } else {
            setView('HOME'); // 정보가 덜 입력된 분들만 홈으로
          }
        }
      }
    };
    checkLogin();
  }, []);

  const addToast = (type: ToastType, message: string) => setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);

  const handleKakaoLogin = () => {
    let kakao = (window as any).Kakao;
    
    const loginWithKakao = () => {
      // 💡 반드시 맨 앞글자를 대문자 'K' (또는 window.Kakao)로 써야 합니다!
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init('cef1d01b84acf6b64cabac2fc6c3df18');
      }
      window.Kakao.Auth.authorize({ redirectUri: 'https://bomiom.co.kr' });
    };

    if (!kakao) {
      addToast('info', '카카오 로그인을 안전하게 준비 중입니다 ⏳');
      const script = document.createElement('script');
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      script.onload = () => {
        kakao = (window as any).Kakao;
        loginWithKakao();
      };
      document.head.appendChild(script);
      return;
    }
    
    try {
      loginWithKakao();
    } catch (e) {
      console.error('Login Error:', e);
    }
  };
  
  // 🍏 껍데기 앱이 던져준 애플 토큰을 받아서 파이어베이스에 로그인하는 전역 함수 세팅
  useEffect(() => {
    (window as any).handleAppleLoginResponse = async (token: string, name: string) => {
      try {
        const provider = new OAuthProvider('apple.com');
        const credential = provider.credential({ idToken: token });
        
        const auth = getAuth();
        const result = await signInWithCredential(auth, credential);
        const firebaseUser = result.user;

        const appleId = `apple_${firebaseUser.uid}`;
        const nickname = name || firebaseUser.displayName || '애플산모'; 

        // 파이어베이스 로그인 완료 후 기존 로직(홈 화면)으로 이동!
        window.location.href = `/?login_success=true&uid=${appleId}&nickname=${encodeURIComponent(nickname)}`;
      } catch (error) {
        alert("애플 로그인(Firebase) 실패: " + error);
      }
    };
  }, []);

  const handleGuestLogin = () => {
    // 1. 정확히 9주차로 세팅되는 출산 예정일 자동 계산!
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + (280 - 9 * 7));
    const calculatedDueDate = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;

    const guestUser: User = { 
      id: "store_reviewer_999", 
      nickname: "심사관",        
      address: "서울 강남구",
      who: "산모",
      dueDate: calculatedDueDate, // 👈 9주차 자동 세팅
      partnerId: "dummy_husband_999", // 👈 남편이 연동된 상태로 세팅
      familyId: "reviewer_demo_family", 
      coupleRole: "MOM", 
      applied: [], 
      envy: [] 
    };
    
    // 2. 부부 라운지에 보여줄 그럴싸한 가짜 데이터를 DB에 즉시 주입!
    if (db) {
       setDoc(doc(db, 'families', 'reviewer_demo_family'), {
         diaryNotes: {
           "9": { mom: "우리 아기 심장소리 듣고 왔어! 너무 감동이야 ㅠㅠ", dad: "진짜 아빠가 된 기분이야. 우리 세 식구 행복하자!" }
         },
         sosLogs: [
           { id: Date.now(), type: '🍔 야식셔틀', text: '여보 나 갑자기 매운 떡볶이가 너무 땡겨!!', status: '완료', replyText: '대령했습니다 마마님! 🦸‍♂️', time: new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}), senderRole: 'MOM' }
         ],
         couponGauge: 1,
         dadCoupons: 2,
         baseWeight: 55,
         weightLogs: { "8": 55.5, "9": 56.1 }
       }, { merge: true });
    }

    setUser(guestUser);
    localStorage.setItem('bomiom_user', JSON.stringify(guestUser));
    setView('RESULT'); 
  };

  // 🔥 [신규 추가] 화면이 바뀔 때마다 브라우저 방문 기록(History) 남기기
  useEffect(() => {
    if (window.history.state?.page !== view) {
      window.history.pushState({ page: view }, '');
    }
  }, [view]);

  // 🔥 [신규 추가] 안드로이드 뒤로가기(물리 버튼) 완벽 대응 로직
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. 게시판 팝업이 열려있을 때 뒤로가기를 누르면? -> 앱이 안 꺼지고 게시판만 스르륵 닫힘!
      if (activeBoardTitle) {
        setActiveBoardTitle(null);
        window.history.pushState({ page: view }, ''); // 현재 뷰 상태 유지
        return;
      }
      
      // 2. 다른 페이지(예: 몰 -> 결과창)에서 뒤로가기를 누르면? -> 이전 페이지로 정상 이동!
      if (e.state && e.state.page) {
        setView(e.state.page);
      } else {
        setView('HOME');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, activeBoardTitle]);

  useEffect(() => {
    if (analytics) {
      logEvent(analytics, 'page_view', {
        page_title: view,
        page_path: `/${view.toLowerCase()}`
      });
    }
  }, [view]);

  // 🔥 [핵심] 결과 페이지(RESULT) 진입 시 10초 뒤에 말풍선 띄우는 타이머 로직
  useEffect(() => {
    // 로그인 안 한 유저가 혜택 결과(RESULT) 화면에 있을 때 작동
    if (!user && view === 'RESULT') {
      const timer = setTimeout(() => setShowMomspickHint(true), 10000); // 10초 대기
      return () => clearTimeout(timer);
    } else {
      setShowMomspickHint(false);
    }
  }, [user, view]);

  // 🔥 [완벽 수정 완료] 파이어베이스 전용 초기화 로직
  useEffect(() => {
    const init = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get('admin') === 'true') {
          setView('ADMIN_REPORT');
        }
        
        // ====================================================================
        // 🚀 [리다이렉트 로그인 처리] 카카오 암호 가로채기
        const kakaoCode = urlParams.get('code');
        
        if (kakaoCode) {
          // 🚨 [무한루프 방지] 주소창의 꼬리표(?code=...)를 즉시 지워줍니다.
          window.history.replaceState({}, '', '/');

          try {
            // 🔥 window.location.origin 대신 "https://bomiom.co.kr"을 직접 박아버립니다!
            // 🔥 /api 대신 "https://bomiom.co.kr/api" 풀 주소로 강제 연결합니다!
            const targetUrl = `https://bomiom.co.kr/api/auth/kakao?code=${kakaoCode}&redirectUri=${encodeURIComponent('https://bomiom.co.kr')}`;
            
            const response = await fetch(targetUrl, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              cache: 'no-store'
            });

            const data = await response.json(); 

            if (data.ok && data.user) {
              const kakaoId = `kakao_${data.user.id}`;
              const nickname = data.user.properties?.nickname || '이름없음';
              // 로그인 성공 시 홈으로 리다이렉트
              window.location.href = `/?login_success=true&uid=${kakaoId}&nickname=${encodeURIComponent(nickname)}`;
              return; 
            } else {
              // 💡 서버가 거절했을 때의 이유를 정확히 띄웁니다.
              alert("🚨 로그인 실패: " + JSON.stringify(data));
            }
          } catch (error: any) {
             // 💡 통신이 끊겼을 때의 '진짜 원인'을 화면에 띄웁니다.
             alert("🚨 통신 에러 상세 원인:\n" + error.message);
          }
        }
        
        // 1. 추천인 코드 저장
        const referrer = urlParams.get('ref');
        if (referrer) localStorage.setItem('bomiom_referrer', referrer);

        // ====================================================================
        // 🚀 [속도 개선 핵심 1] 구글 시트를 기다리지 않고, 폰에 저장된 옛날 데이터를 먼저 띄웁니다!
        const cachedBenefits = localStorage.getItem('bomiom_benefits');
        if (cachedBenefits) {
          setBenefits(JSON.parse(cachedBenefits));
        }
        
        // 🚀 [속도 개선 핵심 2] await를 빼서, 구글 시트 통신은 뒷단에서 조용히 돌아가게 던져둡니다.
        loadBenefitsSmart().then((data) => {
          if (data && data.length > 0) {
            setBenefits(data); // 최신 데이터가 도착하면 조용히 갈아끼움
            localStorage.setItem('bomiom_benefits', JSON.stringify(data));
          }
          
          const loadedHelpers = getHelpers();
          if (loadedHelpers && loadedHelpers.length > 0) {
            setHelpersData(loadedHelpers);
          }
        });
        // ====================================================================

        // 🚨 URL에서 파트너 초대 코드를 발견하면 임시 저장합니다!
        const partnerIdParam = urlParams.get('partnerId');
        if (partnerIdParam) localStorage.setItem('bomiom_partner_id', partnerIdParam);

        // 3. 유저 상태 확인 및 로그인 처리
        if (urlParams.get('login_success') === 'true') {
          const uid = urlParams.get('uid');
          let nickname = urlParams.get('nickname') || '';

          if (uid) {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            const storedPartnerId = localStorage.getItem('bomiom_partner_id');
            
            // 🔥 중복된 partnerAddr 선언을 하나로 합치고 변수들을 깔끔하게 정리합니다!
            let partnerAddr = '';
            let partnerFamilyId = '';
            let partnerRole = 'MOM'; // 기본값

            // 🔥 초대자가 있다면, 초대자의 거주지 주소, 금고(familyId), 역할을 파이어베이스에서 몰래 빼옵니다!
            if (storedPartnerId && db) {
                const pSnap = await getDoc(doc(db, 'users', storedPartnerId));
                if (pSnap.exists()) {
                  partnerAddr = pSnap.data().address || '';
                  partnerFamilyId = pSnap.data().familyId || '';
                  partnerRole = pSnap.data().coupleRole || 'MOM'; // 🔥 초대한 사람의 역할 확인!
                }
            }
            
            // 🔥 초대한 사람이 엄마면 나는 아빠, 초대한 사람이 아빠면 나는 엄마!
            const myAssignedRole = partnerRole === 'MOM' ? 'DAD' : 'MOM';

            if (userSnap.exists()) {
              const existing = userSnap.data() as User;
              
              // 💡 [기존 가입 유저]가 링크를 누른 경우! 자동 연동 처리
              if (storedPartnerId && !existing.partnerId && storedPartnerId !== uid) {
                  if (window.confirm('배우자님의 초대장이 도착했습니다! 부부로 연동하시겠습니까? 💕')) {
                      existing.partnerId = storedPartnerId;
                      // 🔥 상대방의 금고로 편입시키고, 역할은 반대로 부여!
                      if (partnerFamilyId) {
                        existing.familyId = partnerFamilyId;
                        existing.coupleRole = myAssignedRole;
                      }
                      await setDoc(userRef, { 
                        partnerId: storedPartnerId, 
                        familyId: partnerFamilyId || existing.familyId,
                        coupleRole: myAssignedRole 
                      }, { merge: true });

                      try {
                          await setDoc(doc(db, 'users', storedPartnerId), { partnerId: uid }, { merge: true });
                      } catch(e) { console.error("배우자 DB 업데이트 실패", e); }
                  }
              }
              localStorage.removeItem('bomiom_partner_id');

              setUserActions({ applied: existing.applied || [], envy: existing.envy || [] });
              setUser(existing);
              localStorage.setItem('bomiom_user', JSON.stringify(existing));
              
              if (!existing.nickname || !existing.address) {
                setShowAddressSetupModal(true);
                setView('RESULT');
              } else {
                setRegion(existing.address);
                setView('RESULT');
              }
            } else {
              // 🚀 [신규 가입 유저] - 무조건 파이어베이스에 빈 껍데기부터 강제 저장! (이탈자 추적용)
              try { nickname = decodeURIComponent(nickname); } catch(e) {}
              
              const newUser = {
                id: uid,
                nickname: '', 
                address: partnerAddr, // 초대자의 주소가 자동 세팅됨!
                partnerId: storedPartnerId || null,
                // 🔥 초대자의 금고 번호가 있으면 그 방으로, 역할은 반대로 부여!
                familyId: partnerFamilyId || null,
                coupleRole: storedPartnerId ? myAssignedRole : null,
                hasUsedFreeLookalike: false,
                createdAt: serverTimestamp()
              };
              
              await setDoc(userRef, newUser); // DB에 냅다 박아버리기!

              if (storedPartnerId) {
                  try {
                      await setDoc(doc(db, 'users', storedPartnerId), { partnerId: uid }, { merge: true });
                  } catch(e) { console.error("배우자 DB 업데이트 실패", e); }
              }

              setUser(newUser as any);
              localStorage.removeItem('bomiom_partner_id');

              setView('RESULT'); 
              setShowAddressSetupModal(true);
            }
          }
        } else {
          // 👉 [기존 접속 유지 유저]
          let u = getCurrentUser();
          if (u && u.id) {
            setUser(u); // 1. 로컬 데이터로 0.1초만에 화면 먼저 띄움
            
            if (db) {
              // 2. 백그라운드에서 파이어베이스 최신 데이터로 업데이트 (찜하기 포함)
              getDoc(doc(db, 'users', u.id)).then(userSnap => {
                if (userSnap.exists()) {
                  const serverData = userSnap.data() as User;
                  u = { ...u, ...serverData };
                  setUser(u);
                  localStorage.setItem('bomiom_user', JSON.stringify(u));
                  if (u.address) setRegion(u.address);
                  setUserActions({ applied: serverData.applied || [], envy: serverData.envy || [] });
                }
              });
            }

            if (!u.nickname || !u.address) {
              setView('RESULT');
              setShowAddressSetupModal(true);
            } else {
              setRegion(u.address);
              setView('RESULT'); 
            }
          }
        }
        
        // 4. URL 꼬리표 정리 (튕김 방지)
        if (urlParams.has('login_success') || urlParams.has('ref')) {
          window.history.replaceState({}, '', '/');
        }

      } catch (err) { 
        console.error("초기화 에러 발생:", err); 
      } finally { 
        setLoading(false); // 로딩 해제!
      }
    };
    
    init();
  }, []);

  // 🔥 상태 이름 변경 적용
  const handleSearch = (r: string) => { setRegion(r); setResultActiveTab('GOV'); setView('RESULT'); window.scrollTo(0,0); };
  
  const handleLogout = () => { logoutUser(); setUser(null); setView('HOME'); };
  
  // 🔥 [업그레이드] 회원 탈퇴(계정 삭제) 함수 - 애플 심사 통과용
  const handleDeleteAccount = async () => {
    if (!window.confirm('정말로 탈퇴하시겠습니까? 지금까지의 모든 기록이 영구적으로 삭제되며 복구할 수 없습니다.')) return;
    
    try {
      // 1. 파이어베이스 DB(Firestore)에서 유저 문서 완전 삭제 (기존 로직)
      if (user?.id && db) {
        await deleteDoc(doc(db, 'users', user.id));
      }

      // 2. 🚨 [핵심 추가] 파이어베이스 인증(Auth) 계정 자체를 영구 삭제! (애플이 가장 깐깐하게 보는 부분)
      const auth = getAuth();
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }

      // 3. 로컬(폰)에 저장된 정보 날리고 로그아웃 처리
      logoutUser();
      localStorage.removeItem('bomiom_user');
      setUser(null);
      setView('HOME');
      window.scrollTo(0, 0);
      
      addToast('success', '회원 탈퇴가 완료되었습니다. 그동안 봄이옴과 함께해주셔서 감사합니다!');
    } catch (e: any) {
      console.error("탈퇴 에러:", e);
      // 🔥 애플/구글 로그인의 경우, 보안상 로그인한 지 오래되면 삭제를 막습니다. 재로그인 유도!
      if (e.code === 'auth/requires-recent-login') {
        addToast('error', '보안을 위해 다시 한 번 로그인하신 후 탈퇴를 진행해주세요.');
      } else {
        addToast('error', '탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    }
  };

  const handleUpdateUser = async (updated: any) => {
    setUser(updated);
    localStorage.setItem('bomiom_user', JSON.stringify(updated));

    // 파이어베이스에 즉시 저장 (구글 시트 완전 제거 완료!)
    if (updated.id && db) {
      try {
        const userRef = doc(db, 'users', updated.id);
        await setDoc(userRef, updated, { merge: true });
      } catch (e) {
        console.error("서버 저장 에러:", e);
      }
    }
  };

  const handleGoHome = () => {
    if (user) {
      setResultActiveTab('GOV');
      setView('RESULT'); 
    } else {
      setView('HOME');
    }
    window.scrollTo(0, 0);
  };

  const handleGoMyPage = () => {
    if (user) setView('MYPAGE'); else window.location.href = 'https://bomiom.co.kr/auth/kakao';
    window.scrollTo(0, 0);
  };

  return (
    <>
      {/* 🔥 [여기서부터 복사] 스마트 띠 배너 (웹 유저 화면 최상단에 찰싹 붙음) */}
      {showSmartBanner && (
        // z-[50]으로 낮춰서 중요 팝업(z-[100] 이상) 밑에 깔리도록 안전하게 수정!
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between sticky top-0 z-[50] shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm shrink-0">🌸</div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold leading-tight mb-0.5">봄이옴 공식 앱</span>
              <span className="text-white text-xs font-black tracking-tight">자동 로그인으로 더 편하게!</span>
            </div>
          </div>
          <button 
            onClick={() => { 
              if (analytics) logEvent(analytics, 'smart_banner_click', { os: osType }); 
              if (osType === 'android') {
                window.open('https://play.google.com/store/apps/details?id=com.dannypark.bomiomapp', '_blank');
              } else {
                window.open('https://apps.apple.com/kr/app/봄이옴-예비-엄마아빠의-임신-출산-가이드/id6762029788', '_blank');
              }
            }}
            className="shrink-0 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-4 py-2 rounded-lg shadow-sm active:scale-95 transition-transform"
          >
            {osType === 'android' ? 'Google Play' : 'App Store'}
          </button>
        </div>
      )}

      {view === 'ADMIN_REPORT' && (
        <AdminReportPage onBack={() => setView('HOME')} />
      )}

      {view === 'HOME' && <HomePage onSearch={handleSearch} user={user} onLoginClick={handleKakaoLogin} onGuestLogin={handleGuestLogin} benefits={mergedBenefits} />}
      
      {view === 'RESULT' && (
        <ResultPage 
          region={region}
          setShowRegistryReport={setShowRegistryReport}
          activeTab={resultActiveTab}
          setActiveTab={setResultActiveTab}
          benefits={mergedBenefits}
          user={user} 
          onUpdateUser={handleUpdateUser} 
          onLoginClick={handleKakaoLogin}
          onBack={() => setView('HOME')} 
          onShowNationwide={() => setView('NATIONWIDE')} 
          onShowMall={() => setView('MALL')} 
          setMallSource={setMallSource} // 🔥 GPT의 조언대로 추가 완료!
          userActions={userActions} 
          loading={loading} 
          addToast={addToast}
          onLogin={handleKakaoLogin}
          openInquiry={() => setIsInquiryOpen(true)} 
          onOpenBoard={setActiveBoardTitle} 
          helpers={helpersData}
          onGoGarden={() => { setView('GARDEN'); window.scrollTo(0, 0); }}
          onGoCare={() => { setView('CARE_RESERVATION'); window.scrollTo(0, 0); }}
          onGoFinch={() => { setView('FINCH'); window.scrollTo(0, 0); }}
        />
      )}
      
      {/* 🔥 [신규 추가] 봄이옴 몰 화면 렌더링 */}
      {view === 'MALL' && (
        <BomiomMallSection user={user} onUpdateUser={handleUpdateUser} addToast={addToast} mallSource={mallSource} onBack={() => {setView('RESULT'); setMallSource('NONE');}} />
      )}

      {view === 'NATIONWIDE' && (
        <NationwidePage benefits={mergedBenefits} user={user} onLoginClick={handleKakaoLogin} onBack={() => setView('RESULT')} userActions={userActions} userId={user?.id} addToast={addToast} />  // 👈 여기도 mergedBenefits로 교체!
      )}

      {view === 'MYPAGE' && user && (
        <MyPageSection user={user} onLogout={handleLogout} onChangeAddress={() => setShowAddressSetupModal(true)} addToast={addToast} onBack={() => handleGoHome()} onGoGarden={() => { setView('GARDEN'); window.scrollTo(0,0); }} 
          onGoFinch={() => { setView('FINCH'); window.scrollTo(0, 0); }}
        />
      )}

      {view === 'GARDEN' && (
        <GardenPage 
          user={user} 
          onBack={() => { 
            setResultActiveTab('GOV'); // 🔥 1. 거주지 혜택 탭으로 세팅
            setView('RESULT');         // 🔥 2. 메인 화면으로 이동
            window.scrollTo(0, 0);     // 🔥 3. 스크롤 최상단으로 올리기
          }} 
          onUpdateUser={handleUpdateUser}
          addToast={addToast}
        />
      )}

      {view === 'FINCH' && user && (
        <div className="min-h-screen bg-slate-50 relative z-[200]">
          <FinchMain 
            user={user} 
            onUpdateUser={handleUpdateUser} 
            addToast={addToast} 
            onBack={() => { 
              setResultActiveTab('GOV'); // 🔥 1. 탭을 '거주지 혜택'으로 강제 세팅
              setView('RESULT');         // 🔥 2. 메인 화면으로 이동
              window.scrollTo(0, 0);     // 🔥 3. 스크롤 최상단으로 올리기
            }} 
          />
        </div>
      )}
      
      {/* 🔥 2. 하단바 (라운지 포함 모든 서브페이지에서 유지) */}
      {view !== 'HOME' && view !== 'FINCH' && !showAddressSetupModal && (
        <BottomNav 
          activeView={view} 
          onGoHome={handleGoHome} 
          onGoMyPage={handleGoMyPage}
          onGoLounge={() => {
            setView('LOUNGE'); 
            window.scrollTo(0, 0);
          }}
          onGoCare={() => {
            // 🔥 이제 맘스픽이 아니라 별도 페이지 상태로 완전히 전환합니다!
            setView('CARE_RESERVATION'); 
            window.scrollTo(0, 0);
          }} 
          onGoGarden={() => { 
            if (!user) {
              addToast('info', '카카오 로그인 후 비밀정원을 산책할 수 있어요! 🌸');
              return;
            }
            setView('GARDEN'); 
            window.scrollTo(0, 0); 
          }}
          onGoMall={() => { if (!user) { addToast('info', '로그인 후 이용이 가능합니다 🔒'); return; } setView('MALL'); window.scrollTo(0, 0); }}
        />
      )}

      {/* 🔥 비로그인 유저 자물쇠 화면 (터짐 방지) */}
      {view === 'LOUNGE' && !user && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-6 text-center animate-fade-in pb-20 pt-10">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm w-full max-w-sm flex flex-col items-center">
            <span className="text-6xl mb-5">🔒</span>
            <h2 className="text-lg font-black text-gray-800 mb-2 break-keep">부부 라운지는 로그인 후<br/>이용할 수 있어요!</h2>
            <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">
              남편과 연결하여<br/>우리 아기의 280일을 함께 기록해 보세요 💌
            </p>
            
            {/* 🔥 [여기 수정됨!] setView('LOGIN')을 지우고 진짜 로그인 함수로 교체! */}
            <button 
              onClick={handleKakaoLogin} 
              className="w-full bg-rose-500 text-white px-6 py-3.5 rounded-2xl font-bold shadow-md hover:bg-rose-600 active:scale-95 transition-all"
            >
              로그인 / 3초만에 가입하기
            </button>
            
          </div>
        </div>
      )}

      {/* 🔥 1-A. 비로그인 상태일 때 (자물쇠 화면 띄우기) */}
      {view === 'CARE_RESERVATION' && !user && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-6 text-center animate-fade-in pb-20 pt-10">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm w-full max-w-sm flex flex-col items-center">
            <span className="text-6xl mb-5">🔒</span>
            <h2 className="text-lg font-black text-gray-800 mb-2 break-keep">조리원 예약은 로그인 후<br/>이용할 수 있어요!</h2>
            <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">
              우리 동네 산후조리원을 찾고<br/>실시간으로 예약해 보세요 🌸
            </p>
            <button 
              onClick={handleKakaoLogin}
              className="w-full bg-rose-500 text-white px-6 py-3.5 rounded-2xl font-bold shadow-md hover:bg-rose-600 active:scale-95 transition-all"
            >
              로그인 / 3초만에 가입하기
            </button>
          </div>
        </div>
      )}

      {view === 'CARE_RESERVATION' && user && (
        <CareReservationPage 
          user={user}                 /* 👈 로그인 데이터 넘겨주기 추가! */
          onLoginClick={handleKakaoLogin} /* 👈 로그인 함수 넘겨주기 추가! */
          
          // 🔥 하단 네비게이터 작동을 위한 프롭스 추가
          activeView={view}
          onGoHome={handleGoHome}
          onGoLounge={() => { setView('LOUNGE'); window.scrollTo(0, 0); }}
          onGoCare={() => { setView('CARE_RESERVATION'); window.scrollTo(0, 0); }}
          onGoGarden={() => { 
            if (!user) {
              addToast('info', '카카오 로그인 후 비밀정원을 산책할 수 있어요! 🌸');
              return;
            }
            setView('GARDEN'); 
            window.scrollTo(0, 0); 
          }}
          onGoMyPage={handleGoMyPage}
          
          // 기존 프롭스
          onBack={() => {
            setResultActiveTab('GOV'); 
            setView('RESULT');         
          }} 
          addToast={addToast} 
        />
      )}

      {/* 🔥 부부 라운지 컴포넌트 렌더링! */}
      {view === 'LOUNGE' && user && (
        <CoupleLoungeSection 
          setShowRegistryReport={setShowRegistryReport}
          user={user}
          onUpdateUser={handleUpdateUser} 
          addToast={addToast} 
          onBack={() => setView('RESULT')} 
          onGoToMoms={(tabName: string) => {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('targetMomTab', tabName);
            }
            setResultActiveTab('MOMS'); // 맘스픽 탭으로 전환!
            setView('RESULT');          // 메인 화면으로 이동!
            window.scrollTo(0, 0);
          }}
        />
      )}
      
      {activeBoardTitle && <BoardOverlay title={activeBoardTitle} onClose={() => setActiveBoardTitle(null)} user={user} />}

      {showAddressSetupModal && user && <AddressSetupModal user={user} onClose={user.nickname ? () => setShowAddressSetupModal(false) : undefined} onComplete={(n:any, w:any, a:any) => { const updated = {...user, nickname: n, who: w, address: a}; handleUpdateUser(updated); setShowAddressSetupModal(false); setRegion(a); setView('RESULT'); addToast('success', '정보가 업데이트되었습니다!'); }} addToast={addToast} />}
      
      {isInquiryOpen && <InquiryModal onClose={() => setIsInquiryOpen(false)} addToast={addToast} />}

      {view === 'MYPAGE' && (
        <div className="mt-auto mb-20 py-8 flex flex-col justify-center items-center text-xs text-gray-400 gap-4 font-normal">
          
          {/* 🔥 1. 회원 탈퇴 버튼 (윗줄, 글자 크기 xs로 키움) */}
          <button 
            onClick={handleDeleteAccount} 
            className="underline hover:text-gray-600 transition-colors"
          >
            회원 탈퇴 (계정 삭제)
          </button>
          
          {/* 🔥 2. 이용약관 & 개인정보처리방침 (아랫줄, 글자 크기 xs로 키움) */}
          {/* 🔥 2. 이용약관 & 개인정보처리방침 */}
          <div className="flex justify-center items-center">
            <a 
              href="https://royal-moat-af2.notion.site/33d636a27d9b8063b8ebd3d4d84dc693?pvs=143" // 👈 여기를 진짜 주소로 변경!
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 px-3"
            >
              이용약관
            </a>
            <span className="text-gray-300">|</span>
            <a 
              href="https://royal-moat-af2.notion.site/33d636a27d9b80c18a69c7076de777d7?pvs=143" // 👈 여기를 진짜 주소로 변경!
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-gray-600 px-3"
            >
              개인정보처리방침
            </a>
          </div>

        </div>
      )}         

      {/* 📊 [최종 해결책] 팝업창을 모든 방의 바깥(최상단)에 딱 하나만 배치합니다! */}
      {showRegistryReport && (
        <RegistryReportModal 
          registryData={user?.registryData || {}} 
          onClose={() => setShowRegistryReport(false)} 
        />
      )}

      {showAppPopup && (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl p-8 relative overflow-hidden text-center">
            <button 
              onClick={() => handleAppPopupClick('close_button')} 
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24}/>
            </button>

            <div className="flex justify-center mb-4 mt-2">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-4xl shadow-sm border border-gray-100">
                {osType === 'android' ? '🤖' : '🍏'}
              </div>
            </div>

            <h4 className="font-extrabold text-gray-900 text-xl mb-2 tracking-tight">
              봄이옴 앱으로<br/>더 편하게 관리하세요!
            </h4>
            <p className="text-xs text-gray-500 mb-8 font-medium break-keep leading-relaxed bg-gray-50 py-2.5 px-4 rounded-xl">
              지자체 혜택부터 40주 여정까지,<br/>매번 로그인할 필요 없이 앱으로 편하게! ✨
            </p>

            <button 
              onClick={() => {
                handleAppPopupClick('download_button');
                if (osType === 'android') {
                  window.open('https://play.google.com/store/apps/details?id=com.dannypark.bomiomapp', '_blank');
                } else {
                  window.open('https://apps.apple.com/kr/app/봄이옴-예비-엄마아빠의-임신-출산-가이드/id6762029788', '_blank');
                }
              }}
              className={`flex items-center justify-center gap-2 w-full py-4 text-white rounded-2xl font-black text-[15px] active:scale-95 transition-transform shadow-lg ${osType === 'android' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-900 hover:bg-black'}`}
            >
              <span className="text-xl drop-shadow-sm">{osType === 'android' ? '🤖' : '🍎'}</span> 
              {osType === 'android' ? '안드로이드 다운받기' : 'App Store에서 열기'}
            </button>
          </div>
        </div>
      )}

      {/* 🚀 [신규 추가] 구버전 유저 전용 강제 업데이트 안내 팝업 */}
      {showUpdatePopup && (
        <div className="fixed inset-0 bg-black/70 z-[99999] backdrop-blur-sm flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-white text-slate-900 rounded-[2rem] p-6 max-w-sm w-full text-center shadow-2xl">
            <span className="text-4xl">🚀</span>
            <h2 className="text-2xl font-black mt-4 text-slate-800 tracking-tight">새로운 봄이옴 출시!</h2>
            <p className="text-slate-500 text-sm mt-2 break-keep font-medium leading-relaxed">
              더 강력해진 AI 사진관과 작명 연구소 기능이 업데이트 되었습니다! 안정적인 서비스 이용을 위해 꼭 업데이트 후 이용해 주세요. ✨
            </p>

            <div className="mt-6">
              {osType === 'android' ? (
                <button
                  onClick={() => window.location.href = "https://play.google.com/store/apps/details?id=com.dannypark.bomiomapp"}
                  className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-sm active:scale-95 transition-transform"
                >
                  🤖 안드로이드 업데이트
                </button>
              ) : (
                <button
                  onClick={() => window.location.href = "https://apps.apple.com/kr/app/봄이옴-예비-엄마아빠의-임신-출산-가이드/id6762029788"}
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-black text-sm active:scale-95 transition-transform"
                >
                  🍎 아이폰 업데이트
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </>
  );
};


export default App;
