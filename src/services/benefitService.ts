import { collection, doc, getDoc, getDocs, setDoc, updateDoc, increment, arrayUnion, arrayRemove, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase'; 
import { Benefit, User, MallItem } from '../types';

// 🔥 환경 변수에서 구글 시트 API 주소 로드
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwD8AsPgUUXk8vDz0hfMVpGqSRaD_-QRqViWWO4x2UdlVOZK_YSeVd9Z983YWk42RYX/exec";
const CACHE_KEY = 'bomiom_cache_v8'; // 캐시 꼬임 방지를 위해 버전 업

// ==========================================
// 📦 [데이터 장바구니] 구글 시트에서 한 번에 받아와서 여기에 평생 보관합니다.
// ==========================================
let cachedStats: any = { totalUsers: 168, hospitals: [], cares: [], genders: [], balance: { A: 0, B: 0 } };
let cachedMallItems: MallItem[] = [];
let cachedHelpers: any[] = [];
let cachedBabyTrends: string[] = [];
let cachedNameRank: { boys: string[], girls: string[] } = { boys: [], girls: [] }; // 🔥 대법원 이름 바구니 신규 추가!

export const getStatsData = () => cachedStats;
export const getMallItems = () => cachedMallItems;
export const getHelpers = () => cachedHelpers;
export const getBabyTrends = () => cachedBabyTrends;
export const getNameRankings = () => cachedNameRank; // 🔥 이름 바구니에서 바로 꺼내주는 함수 추가!

const safeStr = (v: any) => (v === null || v === undefined ? '' : String(v));

// ==========================================
// 1. 실시간 통계 집계 엔진 (Firebase Users DB 활용)
// ==========================================
const fetchFirebaseStats = async () => {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const users = snap.docs.map(d => d.data() as User);
    
    let totalUsers = users.length;
    const hospMap: any = {};
    const careMap: any = {};
    const genderMap: any = {};
    let balA = 0; let balB = 0;

    users.forEach(u => {
      // 🚨 [수정 1] 병원/조리원 집계 시 '지역 정보(region)'도 함께 묶어서 보관합니다!
      if (u.myHospitalName && !['예비맘', '알아보는 중'].includes(u.myHospitalName)) {
         if (!hospMap[u.myHospitalName]) {
             hospMap[u.myHospitalName] = { count: 0, region: u.hospitalRegion || u.address || '' };
         }
         hospMap[u.myHospitalName].count += 1;
      }
      
      if (u.myCareCenter && !['알아보는 중', '안감', '안 가기로 했어요'].includes(u.myCareCenter)) {
         if (!careMap[u.myCareCenter]) {
             careMap[u.myCareCenter] = { count: 0, region: u.careRegion || u.address || '' };
         }
         careMap[u.myCareCenter].count += 1;
      }
      
      if (u.babyGender) genderMap[u.babyGender] = (genderMap[u.babyGender] || 0) + 1;
      
      // 밸런스 게임 실시간 집계
      if (u.lastBalanceAnswer === 'A') balA++;
      if (u.lastBalanceAnswer === 'B') balB++;
    });

    cachedStats = {
      totalUsers: totalUsers > 168 ? totalUsers : 168,
      // 🚨 [수정 2] 장바구니 배열로 만들 때 name, count와 함께 'region' 필드도 내보냅니다!
      hospitals: Object.entries(hospMap).map(([name, data]: any) => ({ name, count: data.count, region: data.region })).sort((a, b) => b.count - a.count),
      cares: Object.entries(careMap).map(([name, data]: any) => ({ name, count: data.count, region: data.region })).sort((a, b) => b.count - a.count),
      genders: Object.entries(genderMap).map(([name, count]) => ({ name, count: count as number })).sort((a, b) => b.count - a.count),
      balance: { A: balA, B: balB }
    };
  } catch (e) {
    console.error("실시간 통계 집계 에러:", e);
  }
};

// ==========================================
// 2. 통합 데이터 로드 (GAS 혜택/몰 + Firebase 통계)
// ==========================================
export const loadBenefitsSmart = async (): Promise<Benefit[]> => {
  try {
    const url = `${GOOGLE_SHEET_API_URL}?action=FETCH_ALL_DATA&t=${Date.now()}`;
    
    // 🔥 원래 일반 fetch를 쓰던 곳에, 방금 만든 '안전한 방탄 함수'를 적용!
    const json = await safeFetchJSON(url);
    
    if (!json || !json.ok) throw new Error('GAS 응답 실패 또는 권한 막힘');

    // 2. 각 장바구니에 데이터 예쁘게 나눠 담기
    if (json.mall) {
      cachedMallItems = json.mall.map((x: any) => ({
        id: safeStr(x.id), category: safeStr(x.category), subCategory: safeStr(x.subCategory),
        rank: Number(x.rank) || 99, brand: safeStr(x.brand), title: safeStr(x.title),
        badge: safeStr(x.badge), priceDesc: safeStr(x.priceDesc), originalPrice: safeStr(x.originalPrice),
        discountRate: safeStr(x.discountRate), imageUrl: safeStr(x.imageUrl), link: safeStr(x.link), isActive: safeStr(x.isActive)
      }));
    }
    if (json.care) cachedHelpers = json.care;
    if (json.babyTrends) cachedBabyTrends = json.babyTrends;
    
    // 대법원 이름 순위 바구니에 저장!
    if (json.nameRank) cachedNameRank = json.nameRank; 

    // 3. 혜택 데이터 규격화
    const gov = (json.gov || []).map((x: any) => normalizeBenefit(x, false));
    const priv = (json.private || []).map((x: any) => normalizeBenefit(x, true));
    
    // 4. 파이어베이스 실시간 통계 백그라운드 실행
    fetchFirebaseStats();

    const allBenefits = [...gov, ...priv];
    localStorage.setItem(CACHE_KEY, JSON.stringify(allBenefits));
    return allBenefits;
  } catch (e) {
    console.error("데이터 로드 중 에러 발생:", e);
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  }
};

const normalizeBenefit = (raw: any, isPrivate: boolean): Benefit => ({
  id: safeStr(raw.ID || raw.id || ''),
  title: safeStr(raw.Title || raw.제목 || ''),
  description: isPrivate && raw.Condition 
    ? `[필수미션: ${raw.Condition}] ${safeStr(raw.Description)}` 
    : safeStr(raw.Description || raw.내용 || ''),
  source: isPrivate ? 'PRIVATE' : (safeStr(raw.Source).includes('NATIONAL') ? 'GOV_NATIONAL' : 'GOV_LOCAL'),
  category: safeStr(raw.Category || raw.카테고리 || 'ALL'),
  sido: safeStr(raw["시/도"] || ''),
  sigugun: safeStr(raw["시/군/구"] || ''),
  regionTarget: safeStr(raw["상세 구"] || ''),
  tags: safeStr(raw.Tags || raw.태그 || '').split(',').map((t: string) => t.trim()).filter(Boolean),
  eligibility: isPrivate 
    ? safeStr(raw["Eligibility (참여 조건)"] || '') 
    : safeStr(raw["Eligibility (지원 자격 요약)"] || ''),
  ctaLink: safeStr(raw.CTALink || raw.link || ''),
  usageTip: safeStr(raw.usageTip || raw.UsageTip || raw['사용TIP'] || ''),
  lastUpdated: safeStr(raw.LastUpdated || ''),
  updateType: safeStr(raw.UpdateType || raw.updateType || '').trim().toUpperCase(),
  appliedCount: Number(raw.AppliedCount || 0),
  envyCount: Number(raw.EnvyCount || 0),
});

// ==========================================
// 3. 네이버 / 유튜브 통신 (트래픽 분산 로직 적용)
// ==========================================
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// 🔥 JSON이 아니면 튕겨내는 안전한 Fetch 도우미 함수
const safeFetchJSON = async (url: string) => {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    
    // 만약 구글이 에러나서 HTML 웹페이지(<!DOCTYPE html> 등)를 보냈다면?
    if (text.trim().startsWith('<')) {
      console.error("❌ 구글 시트가 데이터 대신 HTML을 반환했습니다. (권한 설정이나 URL을 확인하세요!)");
      // 🚨 앱이 터지지 않도록 가짜 빈 데이터를 반환합니다!
      return { ok: false, data: [] }; 
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error("🔥 통신 중 아예 연결이 끊겼습니다:", error);
    // 와이파이가 끊겼거나 서버가 죽었을 때도 안전하게 가짜 데이터를 반환!
    return { ok: false, data: [] }; 
  }
};

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '';

// ==========================================
// 3. 외부 API 통신 (우리의 튼튼한 Cloud Run 서버로 보냅니다!)
// ==========================================

export const fetchNameRankingsFromSheet = async (): Promise<{ boys: string[], girls: string[] }> => {
  // 🔥 1. 이미 앱 켤 때 loadBenefitsSmart가 바구니에 담아뒀다면 즉시 반환! (로딩 뺑뺑이 해결)
  if (cachedNameRank && cachedNameRank.boys && cachedNameRank.boys.length > 0) {
    return cachedNameRank;
  }
  
  // 🔥 2. 혹시 바구니가 비어있다면, 안전한 safeFetchJSON으로 구글 시트에 직접 요청!
  try {
    const url = `${GOOGLE_SHEET_API_URL}?action=FETCH_NAME_RANK`;
    const data = await safeFetchJSON(url);
    if (data && data.ok) {
      return { boys: data.boys || [], girls: data.girls || [] };
    }
    return { boys: [], girls: [] };
  } catch (error) {
    console.error("이름 순위 구글시트 통신 실패:", error);
    return { boys: [], girls: [] };
  }
};

// 📈 네이버 쇼핑 트렌드 (구글 시트로 직접 요청!)
export const fetchNaverTrend = async (keyword: string) => {
  try {
    const url = `${GOOGLE_SHEET_API_URL}?action=FETCH_NAVER_TREND&keyword=${encodeURIComponent(keyword)}`;
    const res = await safeFetchJSON(url);
    // 구글 시트(GAS)는 ok: true 형태로 응답합니다.
    return res && res.ok ? res.data : [];
  } catch (error) { 
    console.error("네이버 연동 실패", error);
    return []; 
  }
};

// 📺 유튜브 영상 큐레이션 (구글 시트로 직접 요청!)
export const fetchYoutubeVideos = async (query: string) => {
  const CACHE_KEY = `yt_cache_${query}`;
  const cached = localStorage.getItem(CACHE_KEY);
  
  // 1. 폰에 저장된 캐시가 있고, 24시간(86400000ms)이 안 지났다면 서버 안 찌르고 바로 반환!
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return data;
      }
    } catch (e) {
      console.error("캐시 읽기 에러", e);
    }
  }

  // 2. 캐시가 없거나 너무 오래됐다면 기존처럼 서버(GAS)에 요청
  try {
    const url = `${GOOGLE_SHEET_API_URL}?action=FETCH_YOUTUBE&query=${encodeURIComponent(query)}`;
    const res = await safeFetchJSON(url);
    
    if (res && res.status === 'success') {
      // 3. 성공적으로 가져왔으면 다음을 위해 폰(캐시)에 몰래 저장해둡니다.
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: res.data, timestamp: Date.now() }));
      return res.data;
    }
    return [];
  } catch (error) { 
    console.error("유튜브 연동 실패", error);
    return []; 
  }
};

// ==========================================
// 4. 유저 정보 및 액션 관리 (Firebase 전용)
// ==========================================
export const getUserFromSheet = async (userId: string): Promise<User | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
  } catch (e) { return null; }
};

// 🔥 누락되었던 찜하기 이력 불러오기 복구
export const fetchUserActionHistory = async (userId: string) => {
  try {
    const docSnap = await getDoc(doc(db, 'users', userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { applied: data.applied || [], envy: data.envy || [] };
    }
    return { applied: [], envy: [] };
  } catch (e) {
    return { applied: [], envy: [] };
  }
};

export const recordUserAction = async (userId: string, benefitId: string, actionType: 'APPLY' | 'ENVY', isAdd: boolean) => { 
  const fieldName = actionType === 'APPLY' ? 'applied' : 'envy';
  await updateDoc(doc(db, 'users', userId), { [fieldName]: isAdd ? arrayUnion(benefitId) : arrayRemove(benefitId) });
};

export const registerUserToSheet = async (user: Partial<User>) => { 
  if (!user.id) return;
  await setDoc(doc(db, 'users', user.id), { ...user, updatedAt: serverTimestamp() }, { merge: true });
};

// ==========================================
// 5. 기타 보조 기능 (이름 순위 / 문의사항)
// ==========================================

export const incrementAppliedCount = async (id: string) => { 
  await updateDoc(doc(db, 'benefits', id), { appliedCount: increment(1) }).catch(()=>{}); 
};
export const incrementEnvyCount = async (id: string) => { 
  await updateDoc(doc(db, 'benefits', id), { envyCount: increment(1) }).catch(()=>{}); 
};
export const saveInquiryToSheet = async (data: any) => { 
  await setDoc(doc(collection(db, 'inquiries')), { ...data, timestamp: serverTimestamp() });
};

// ==========================================
// 6. 부부 연동 시스템 (Firebase 기반)
// ==========================================
export const generateInviteCode = async (userId: string) => {
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  await updateDoc(doc(db, 'users', userId), { inviteCode });
  return inviteCode;
};

export const linkCoupleAccount = async (userId: string, inviteCode: string, myRole: string, partnerRole: string) => {
  const q = query(collection(db, 'users'), where('inviteCode', '==', inviteCode));
  const snap = await getDocs(q);
  if (snap.empty) return { ok: false, message: '유효하지 않은 코드입니다.' };
  
  const partnerDoc = snap.docs[0];
  const partnerId = partnerDoc.id;
  const partnerData = partnerDoc.data(); // 🔥 배우자의 기존 데이터를 끄집어냅니다.
  
  if (userId === partnerId) return { ok: false, message: '본인 코드는 안 돼요.' };

  // 🔥 [핵심 수정] 배우자가 혼자 쓰던 금고(familyId)가 있다면 무조건 거기로 합류! 없으면 새로 생성!
  const familyId = partnerData.familyId || `family_${Date.now()}`;
  
  const batch = writeBatch(db);
  // 🔥 확실한 저장을 위해 updateDoc 대신 setDoc + merge 옵션 사용
  batch.set(doc(db, 'users', userId), { partnerId, familyId, coupleRole: myRole }, { merge: true });
  batch.set(doc(db, 'users', partnerId), { partnerId: userId, familyId, coupleRole: partnerRole }, { merge: true });
  await batch.commit();
  
  // 🔥 App.tsx에서 사용할 수 있도록 partnerId도 같이 뱉어줍니다.
  return { ok: true, familyId, partnerId };
};