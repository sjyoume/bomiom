export interface Benefit {
  id: string;
  title: string;
  description: string;
  category: string;
  source: 'GOV_NATIONAL' | 'GOV_LOCAL' | 'PRIVATE';
  lastUpdated: string;
  updateType?: 'NEW' | 'UPDATE';
  envyCount?: number;
  appliedCount?: number;
  sido?: string;
  sigugun?: string;
  regionTarget?: string;
  tags?: string[];
  eligibility?: string;
  ctaLink?: string;
  usageTip?: string;
  updatedAt?: any; // 🔥 [Firebase] 데이터가 수정된 시간 (서버 타임스탬프)
}

// 🔥 [신규 추가] 파이어베이스에 저장될 사용 TIP 유저 댓글 구조
export interface BenefitComment {
  id: string;
  benefitId: string;
  userId: string;
  userNickname: string;
  content: string;
  likes: number;
  likedBy: string[];
  createdAt: any;
}

export type CategoryType = 'ALL' | 'FREE' | 'DISCOUNT' | 'PACKAGE' | 'LIFESTYLE' | 'SUBSCRIPTION' | 'FINANCE';

export interface NamingRecord {
  id: string;
  type: 'USER' | 'BOMIOM'; // 직접 지음(MY) vs 시스템 추천(BOMIOM)
  name: string;            // 한글 이름
  hanja: string;           // 한자 조합
  score: number;           // 종합 점수
  elements?: string[];     // 오행 뱃지 (태어나기 전이면 없을 수 있음)
  sajuSummary?: string;    // 사주 분석 요약 (태어나기 전이면 생략됨)
  desc: string;            // 81수리 등 종합 설명
  createdAt: any;          // 저장된 시간
}

export interface User {
  id: string;
  nickname: string;
  address?: string;
  
  who?: string;                     
  dueDate?: string;                 
  myHospitalName?: string;          
  myHospitalAddress?: string;       
  hospitalRegion?: string;          
  myCareCenter?: string;            
  myCareCenterAddress?: string;     
  careRegion?: string;              
  insCompany?: string;              
  insPrice?: string;                
  referralCount?: number;           
  referrerId?: string;              
  babyGender?: string; 
  admin?: string;

  babyName?: string;            
  candidateNames?: string;      
  realName?: string; 
  balanceCount?: number;        
  lastBalanceDate?: string;     
  lastBalanceAnswer?: string;   
  myStretchMark?: string;
  myMaternityWear?: string;
  myBabymoon?: string;
  myBabymoonThinking?: string;
  completedMissions?: string; 
  registryItems?: string;       
  verifiedCategories?: string;  

  actualDeliveryDate?: string;
  skipCareCenter?: boolean;
  careEntryDate?: string;
  careExitDate?: string;
  familyId?: string;
  partnerId?: string;
  coupleRole?: 'MOM' | 'DAD';
  sharedBenefits?: string;
  sharedMissions?: string;
  inviteCode?: string;

  // 🚀 [Firebase 최적화 핵심!] 기존 user_actions에서 흡수한 찜하기/신청 배열
  applied?: string[]; 
  envy?: string[];
  updatedAt?: any; // 🔥 [Firebase] 유저 정보 마지막 업데이트 시간

  savedCenters?: string[]; // 조리원 찜하기 리스트

  cardRecommendation?: string; // 국민행복카드 1순위 추천 (미션 완료 체크용)
  cardTestResult?: {           // 국민행복카드 찰떡 매칭 테스트 결과 데이터
    top1: string;
    top2: string;
    answers: any[];
    completedAt: string;
  };

  // 3. 태아보험 AI 맞춤 설계 결과
  insTestResult?: {
    typeId: string;
    answers: any[];
    completedAt: string;
  };

  helperTestResult?: {
    voucher: any; // 계산된 바우처 정보 (유형, 가격 등)
    requestText: string; // 완성된 요청서 텍스트
    completedAt: string;
  };

  registryData?: { [itemName: string]: { isPrepared: boolean; brandName?: string; } };

  // 🔥 [신규 추가] 50일 실전 육아 모의고사 랭킹 데이터
  quizIndex_1?: number;  quizScore_1?: number;  quizBestScore_1?: number; // 1단계 (조리원)
  quizIndex_2?: number;  quizScore_2?: number;  quizBestScore_2?: number; // 2단계 (야생 생존)
  quizIndex_3?: number;  quizScore_3?: number;  quizBestScore_3?: number; // 3단계 (50일 적응)
  quizNickname?: string;    
  quizLastUpdated?: any;

  // 🔥 [신규 추가] 찰떡 이름 연구소 데이터
  namingHistory?: NamingRecord[]; // 작명 보관함 (내가 지은/추천받은 이름 리스트)
  lastSajuAnalysis?: {            // 가장 최근 분석된 사주 정보 캐싱
    isBorn: boolean;              // 태어났는지 여부 (이거에 따라 UI 다르게 보여줌)
    missingElements?: string[];   // 부족한 오행
    description?: string;         // 사주 요약 텍스트
  };

  [key: string]: any;
}

export interface MallItem {
  id: string;
  category: string;
  subCategory: string;
  rank: number;
  brand: string;
  title: string;
  badge: string;
  priceDesc: string;
  originalPrice?: string;
  discountRate?: string;
  imageUrl: string;
  link: string;
  isActive: string;
  updatedAt?: any; // 🔥 [Firebase] 상품 정보 마지막 업데이트 시간
}

// 🔥 [신규 추가] 육아 가계부 데이터 구조
export interface LedgerItem {
  id: string;
  date: string;
  type: '수입' | '지출';
  title: string;
  category: string;
  amount: number;
  memo: string;
  writer: string;
  createdAt: any;
}

export interface FamilyData {
  createdAt?: any;
  baseWeight?: number;
  weightLogs?: Record<string, number>;
  kickLogs?: Array<{ date: string; time: string; week: number }>;
  emotionLogs?: Array<{ date: string; emoji: string; text: string; writer: string; week: number }>;
  symptomLogs?: Array<{ date: string; text: string; week: number; writer: string }>;
  photos?: Array<{ id: string; url: string; memo: string; date: string; uploader: string; comments?: any[] }>;
  sosLogs?: Array<any>;
  diaryNotes?: Record<string, any>;
  calendarEvents?: Array<any>;
  ledger?: Array<any>;
  couponGauge?: number;
  dadCoupons?: number;
}