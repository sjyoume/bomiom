import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ArrowLeft, Gift, ChevronRight, CheckCircle2, Building2, Calendar, User as UserIcon, LogOut, MessageCircle, Settings, Edit3, X, Star, List, Home, Trophy, AlertCircle, Filter, Info, Mail, ChevronDown, Flower2, Sprout } from 'lucide-react';
import { Benefit, CategoryType, User } from './types';
import { fetchBenefits, filterBenefitsByCategory, getAllLocalBenefits } from './services/benefitService';
import { loginWithKakao, saveUser, getCurrentUser, logoutUser, checkNicknameAvailability } from './services/authService';
import { CategoryFilter } from './components/CategoryFilter';
import { BenefitCard } from './components/BenefitCard';
import { Loading } from './components/Loading';

// --- Constants ---
const SIDO_LIST = [
  '전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충청', '전라', '경상', '제주'
];

// --- Helper Functions ---
const getLatestUpdateDate = (benefits: Benefit[]) => {
  if (!benefits || benefits.length === 0) return null;
  const sorted = [...benefits].sort((a, b) => {
    return (b.lastUpdated || '').localeCompare(a.lastUpdated || '');
  });
  return sorted[0].lastUpdated;
};

// Check if a benefit is recent (Last 30 days)
const isRecentUpdate = (dateString?: string) => {
  if (!dateString) return false;
  try {
    const parts = dateString.split('.');
    if (parts.length !== 3) return false;
    // YYYY.MM.DD
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const now = new Date();
    if (isNaN(date.getTime())) return false;
    const diffTime = now.getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 30;
  } catch (e) {
    return false;
  }
};

// Check if there are new or updated items in the list
const checkUpdateStatus = (benefits: Benefit[]) => {
  // A benefit is considered "New" or "Update" if it is recent AND has the corresponding flag
  const hasNew = benefits.some(b => isRecentUpdate(b.lastUpdated) && (b.updateType === 'NEW'));
  const hasUpdate = benefits.some(b => isRecentUpdate(b.lastUpdated) && (b.updateType === 'UPDATE'));
  return { hasNew, hasUpdate };
};

// Compute category stats
const computeCategoryBadges = (benefits: Benefit[]) => {
  const badges: Record<string, { hasNew: boolean; hasUpdate: boolean }> = {};
  
  benefits.forEach(b => {
    const cat = b.category;
    if (!badges[cat]) {
      badges[cat] = { hasNew: false, hasUpdate: false };
    }
    
    // Check global "ALL" category as well
    if (!badges['ALL']) {
      badges['ALL'] = { hasNew: false, hasUpdate: false };
    }

    const isRecent = isRecentUpdate(b.lastUpdated);
    if (isRecent) {
      if (b.updateType === 'NEW') {
        badges[cat].hasNew = true;
        badges['ALL'].hasNew = true;
      } else if (b.updateType === 'UPDATE') {
        badges[cat].hasUpdate = true;
        badges['ALL'].hasUpdate = true;
      }
    }
  });

  return badges;
};


// Component for Status Badge (Small Dot version)
const StatusBadge = ({ hasNew, hasUpdate }: { hasNew: boolean, hasUpdate: boolean }) => {
  if (!hasNew && !hasUpdate) return null;
  // Red for New, Blue for Update. New takes precedence.
  return (
    <span className={`absolute top-1 right-2 w-2 h-2 rounded-full ring-1 ring-white ${hasNew ? 'bg-red-500' : 'bg-blue-500'}`} />
  );
};

// Component for Data Accuracy Disclaimer
const DataDisclaimer = () => (
  <div className="mt-8 mb-4 p-4 rounded-xl bg-gray-100 text-gray-500 text-xs text-center leading-relaxed border border-gray-200">
     <div className="flex justify-center items-center gap-1 mb-1 text-gray-600 font-bold">
       <Info size={14} />
       <span>안내</span>
     </div>
     본 서비스는 혜택 정보를 수시로 업데이트하고 있으나,<br className="hidden md:block"/>
     정확한 신청 자격 및 최신 내용은 <strong>반드시 공식 안내 페이지</strong>를 통해<br className="hidden md:block"/>
     다시 한 번 확인해 주시기 바랍니다.
  </div>
);

// --- Page Components ---

/**
 * LOGIN PAGE
 */
const LoginPage = ({ onLoginSuccess, onCancel }: { onLoginSuccess: (baseInfo: any) => void, onCancel: () => void }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    try {
      const baseInfo = await loginWithKakao();
      onLoginSuccess(baseInfo);
    } catch (error) {
      alert('로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6 animate-fade-in relative">
      <button 
        onClick={onCancel}
        className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="w-full max-w-sm space-y-10 text-center">
        <div>
          <span className="inline-block px-3 py-1 bg-rose-50 text-rose-500 text-xs font-bold rounded-full mb-4">
            봄이옴
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
            3초 만에 시작하고<br />
            <span className="text-rose-500">우리 동네 혜택</span> 챙기기
          </h1>
          <p className="text-gray-500 mt-3 text-sm">
            회원가입하고 내 거주지 기반 맞춤 혜택을<br/>자동으로 확인하세요.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#3c1e1e] font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-sm"
          >
            {isLoading ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <MessageCircle fill="#3c1e1e" size={20} />
                카카오로 3초 만에 시작하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * SIGNUP PAGE (Extra Info)
 */
const SignupPage = ({ baseInfo, onComplete, onCancel }: { baseInfo: any, onComplete: (user: User) => void, onCancel: () => void }) => {
  // Inputs
  const [nickname, setNickname] = useState(baseInfo.nickname || '');
  const [address, setAddress] = useState('');
  
  // Date Inputs
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  
  // Not Pregnant State
  const [isNotPregnant, setIsNotPregnant] = useState(false);
  
  // Refs for Date Inputs
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);

  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nicknameError, setNicknameError] = useState('');

  // Auto-focus logic for Date Inputs
  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 4); // Limit to 4 chars
    setYear(val);
    if (val.length === 4) {
      monthRef.current?.focus();
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 2);
    setMonth(val);
    if (val.length === 2) {
      dayRef.current?.focus();
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.slice(0, 2);
    setDay(val);
  };
  
  // Handle Not Pregnant Checkbox
  const handleNotPregnantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsNotPregnant(checked);
    if (checked) {
      setYear('');
      setMonth('');
      setDay('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNicknameError('');
    
    if (!nickname.trim()) {
      setNicknameError('닉네임을 입력해주세요.');
      return;
    }

    if (!privacyAgreed) return alert('개인정보 수집 및 이용에 동의해주세요.');

    setSubmitting(true);

    try {
      // 1. Check Nickname Availability
      const isAvailable = await checkNicknameAvailability(nickname);
      if (!isAvailable) {
        setNicknameError('이미 사용 중인 닉네임입니다.');
        setSubmitting(false);
        return;
      }

      // 2. Format Date (Only if not marked as non-pregnant)
      let formattedDate = undefined;
      if (!isNotPregnant && year && month && day) {
        formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // 3. Complete Signup
      setTimeout(() => {
        const newUser: User = {
          id: baseInfo.id,
          nickname: nickname.trim(),
          email: baseInfo.email,
          dueDate: formattedDate,
          address: address || undefined,
          privacyAgreed: true,
        };
        saveUser(newUser);
        onComplete(newUser);
      }, 500);

    } catch (error) {
      alert('오류가 발생했습니다. 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col p-6 animate-fade-in relative">
      <button 
        onClick={onCancel}
        className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors z-10"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="w-full max-w-lg mx-auto flex-grow flex flex-col justify-center pt-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            반가워요! 👋<br/>
            추가 정보를 입력해주세요.
          </h2>
          <p className="text-gray-600 text-sm">
            입력해주신 정보를 바탕으로<br/>꼭 필요한 혜택만 골라서 알려드릴게요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Nickname Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              닉네임 <span className="text-rose-500">*</span>
            </label>
            <input 
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNicknameError('');
              }}
              placeholder="사용하실 닉네임을 입력하세요"
              className={`w-full p-4 bg-gray-50 border rounded-xl focus:ring-rose-500 outline-none transition-all
                ${nicknameError ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-rose-500'}
              `}
            />
            {nicknameError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {nicknameError}
              </p>
            )}
          </div>

          {/* Due Date - Split Inputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-700">
                출산 예정일 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
            </div>

            {/* Not Pregnant Checkbox */}
            <label className="flex items-center gap-2 py-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isNotPregnant}
                onChange={handleNotPregnantChange}
                className="w-4 h-4 text-rose-500 border-gray-300 rounded focus:ring-rose-500"
              />
              <span className="text-sm text-gray-600">임산부가 아닙니다 (건너뛰기)</span>
            </label>

            {!isNotPregnant && (
              <div className="flex gap-2 animate-fade-in">
                <div className="flex-1 relative">
                   <input 
                    type="tel"
                    maxLength={4}
                    value={year}
                    onChange={handleYearChange}
                    placeholder="YYYY"
                    className="w-full p-4 text-center bg-gray-50 border border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 outline-none transition-all"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">년</span>
                </div>
                <div className="flex-1 relative">
                   <input 
                    ref={monthRef}
                    type="tel"
                    maxLength={2}
                    value={month}
                    onChange={handleMonthChange}
                    placeholder="MM"
                    className="w-full p-4 text-center bg-gray-50 border border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 outline-none transition-all"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">월</span>
                </div>
                <div className="flex-1 relative">
                   <input 
                    ref={dayRef}
                    type="tel"
                    maxLength={2}
                    value={day}
                    onChange={handleDayChange}
                    placeholder="DD"
                    className="w-full p-4 text-center bg-gray-50 border border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 outline-none transition-all"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">일</span>
                </div>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">
              주민등록상 거주지 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <div className="relative">
               <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
               <input 
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울시 송파구 / 경기도 성남시 분당구"
                className="w-full pl-12 pr-4 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 outline-none transition-all"
              />
            </div>
            <p className="text-xs text-rose-500 mt-1">
              * 입력 시, 로그인할 때마다 혜택을 바로 보여드려요!
            </p>
          </div>

          {/* Privacy */}
          <div className="pt-4 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${privacyAgreed ? 'bg-rose-500 border-rose-500' : 'bg-white border-gray-300'}`}>
                {privacyAgreed && <CheckCircle2 size={14} className="text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
              />
              <span className="text-sm text-gray-600 select-none">
                [필수] 개인정보 수집 및 이용에 동의합니다.
                <br/>
                <span className="text-xs text-gray-400">입력하신 정보는 혜택 조회 목적으로만 사용됩니다.</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !privacyAgreed}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all mt-8
              ${privacyAgreed 
                ? 'bg-rose-500 text-white hover:bg-rose-600' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            {submitting ? '저장 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * MY INFO PAGE
 */
const MyInfoPage = ({ user, onUpdate, onBack }: { user: User, onUpdate: (updatedUser: User) => void, onBack: () => void }) => {
  const [dueDate, setDueDate] = useState(user.dueDate || '');
  const [address, setAddress] = useState(user.address || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API delay
    setTimeout(() => {
      const updatedUser: User = { ...user, dueDate, address };
      saveUser(updatedUser);
      onUpdate(updatedUser);
      setIsSaving(false);
      alert('정보가 수정되었습니다.');
      onBack();
    }, 600);
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-2 text-lg font-bold text-gray-900">내 정보 수정</h1>
      </header>

      <div className="p-6 max-w-lg mx-auto w-full flex-grow flex flex-col space-y-8 animate-fade-in">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-gray-900">{user.nickname}님</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>

        <div className="space-y-6 flex-grow">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">출산 예정일</label>
            <input 
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">주민등록상 거주지</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울시 송파구 / 경기도 성남시 분당구"
                className="w-full pl-12 pr-4 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-rose-500 focus:ring-rose-500 outline-none transition-all"
              />
            </div>
            <p className="text-xs text-rose-500">
              * 변경된 거주지를 저장하면 홈 화면에서 바로 해당 지역 혜택을 확인할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="pt-4 pb-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 rounded-xl bg-rose-500 text-white font-bold text-lg shadow-md hover:bg-rose-600 transition-all disabled:opacity-70"
          >
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ALL LOCAL BENEFITS PAGE (NEW)
 */
const AllLocalBenefitsPage = ({ onBack, user, onGoHome, onGoMyPage }: { onBack: () => void, user: User | null, onGoHome: () => void, onGoMyPage: () => void }) => {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'ENVY'>('ALL');
  
  // Filters
  const [selectedSido, setSelectedSido] = useState('전체');
  const [districtInput, setDistrictInput] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Fetch all local benefits (including user's region now)
      const data = await getAllLocalBenefits(user?.address);
      setBenefits(data);
      setLoading(false);
    };
    load();
  }, [user]);

  // Filtering Logic
  const filteredBenefits = benefits.filter(b => {
    // 1. Sido Filter
    if (selectedSido !== '전체') {
      // Check if regionTarget contains the selected Sido (e.g. "서울" in "서울")
      if (!b.regionTarget?.includes(selectedSido)) return false;
    }
    // 2. District Filter (Text Search)
    if (districtInput.trim().length > 0) {
      const query = districtInput.trim();
      const inTitle = b.title.includes(query);
      const inDesc = b.description.includes(query);
      const inRegion = b.regionTarget?.includes(query) || false;
      if (!inTitle && !inDesc && !inRegion) return false;
    }
    return true;
  });

  // Sorting logic for Envy tab
  const displayBenefits = tab === 'ENVY' 
    ? [...filteredBenefits].sort((a, b) => (b.envyCount || 0) - (a.envyCount || 0))
    : filteredBenefits;

  // Latest Updates - Updated to Emerald Style for "Local Benefits" theme
  const latestDate = getLatestUpdateDate(displayBenefits);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* Header with Navigation - Reorganized for Consistency */}
      <header className="px-4 py-3 border-b border-gray-100 flex items-center bg-white sticky top-0 z-30 shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full shrink-0">
          <ArrowLeft size={24} />
        </button>
        
        {/* Home & User Icons moved to left */}
        <div className="flex gap-0 ml-1 shrink-0">
          <button onClick={onGoHome} className="p-2 text-gray-400 hover:text-rose-500 rounded-full hover:bg-rose-50">
            <Home size={20} />
          </button>
          <button onClick={onGoMyPage} className="p-2 text-gray-400 hover:text-rose-500 rounded-full hover:bg-rose-50">
            <UserIcon size={20} />
          </button>
        </div>
        
        {/* Title with Emoji */}
        <h1 className="ml-3 text-lg font-bold text-gray-900 truncate flex items-center gap-1.5">
          <span>🏢</span> 전국 지자체 혜택
        </h1>
      </header>

      {/* Tabs */}
      <div className="bg-white">
        <div className="px-4 pt-2 pb-2">
          <div className="flex w-full bg-gray-100 p-1 rounded-xl shadow-sm">
            <button 
              onClick={() => setTab('ALL')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5
                ${tab === 'ALL' 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-400 hover:text-gray-600'}
              `}
            >
              👀 전체 보기
            </button>
            <button 
              onClick={() => setTab('ENVY')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold text-center transition-all flex items-center justify-center gap-1.5
                ${tab === 'ENVY' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-gray-600'}
              `}
            >
              🏆 부러워요 베스트
            </button>
          </div>
        </div>

        {/* --- REGION FILTERS (Visible on 'ALL' tab or both) --- */}
        <div className="px-4 pb-3 border-b border-gray-100 space-y-3">
          {/* Level 1: Sido Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {SIDO_LIST.map((sido) => (
              <button
                key={sido}
                onClick={() => setSelectedSido(sido)}
                className={`
                  whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border
                  ${selectedSido === sido 
                    ? 'bg-gray-800 text-white border-gray-800' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}
                `}
              >
                {sido}
              </button>
            ))}
          </div>

          {/* Level 2: District Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              value={districtInput}
              onChange={(e) => setDistrictInput(e.target.value)}
              placeholder={selectedSido === '전체' ? "지역명(시/군/구) 검색" : `${selectedSido} 내 지역명(구/군) 검색`}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="max-w-6xl mx-auto p-4 animate-fade-in">
          
          {tab === 'ENVY' && (
             <div className="mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100">
               <h2 className="text-lg font-bold text-purple-900 mb-1 flex items-center gap-2">
                 <Trophy className="text-purple-600" size={20} />
                 우와, 저쪽 지역은 이런 혜택도 주네?
               </h2>
               <p className="text-sm text-purple-700">
                 다른 지역 임산부들이 가장 부러워하는 혜택들이에요.
               </p>
             </div>
          )}

          {/* Latest Update Display for All Local Benefits - EMERALD STYLE */}
          <div className="flex justify-between items-center mb-4 px-1">
             <span className="text-sm font-bold text-gray-500">
               총 <span className="text-gray-900">{displayBenefits.length}</span>건
             </span>
             {latestDate && (
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                  <Calendar size={14} className="text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600">
                    신규 업데이트: {latestDate}
                  </span>
                </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayBenefits.map((b, index) => (
              <div key={b.id} className="relative">
                {tab === 'ENVY' && index < 3 && (
                   <div className="absolute -top-2 -left-2 z-20 w-8 h-8 flex items-center justify-center bg-yellow-400 text-white font-black rounded-full border-2 border-white shadow-md transform -rotate-12">
                     {index + 1}
                   </div>
                )}
                {/* Pass userRegion so the card can identify if it's "My Region" even in the national list */}
                <BenefitCard benefit={b} userRegion={user?.address} mode="ENVY" />
              </div>
            ))}
            
            {displayBenefits.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="inline-flex justify-center items-center w-12 h-12 bg-gray-100 rounded-full mb-3">
                  <Filter className="text-gray-400" size={24} />
                </div>
                <p className="text-gray-500 font-medium">검색된 혜택이 없습니다.</p>
                <p className="text-xs text-gray-400 mt-1">다른 지역이나 검색어를 입력해보세요.</p>
              </div>
            )}
          </div>
          
          {/* Data Disclaimer */}
          <DataDisclaimer />
        </div>
      )}
    </div>
  );
};


/**
 * HOME PAGE
 */
const HomePage = ({ 
  onSearch, 
  user, 
  onLogout, 
  onLoginClick, 
  onMyInfoClick 
}: { 
  onSearch: (region: string) => void, 
  user: User | null, 
  onLogout: () => void, 
  onLoginClick: () => void,
  onMyInfoClick: () => void
}) => {
  // Initialize input with user's address if available
  const [input, setInput] = useState(user?.address || '');
  const [showTooltip, setShowTooltip] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const searchSectionRef = useRef<HTMLDivElement>(null);

  // Update input when user info changes (e.g., after editing in My Info)
  useEffect(() => {
    if (user?.address) {
      setInput(user.address);
    } else if (!user) {
      setInput(''); // Clear input if user logs out
    }
  }, [user]);

  useEffect(() => {
    // Show tooltip after 1 second if not logged in
    if (!user) {
      const timer = setTimeout(() => setShowTooltip(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const validateSearchInput = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setErrorMsg('주소를 입력해주세요.');
      return false;
    }

    // Check for spaces
    if (!trimmed.includes(' ')) {
      setErrorMsg('띄어쓰기를 정확히 입력해주세요. (예: 경기도 성남시 수정구)');
      return false;
    }

    const parts = trimmed.split(/\s+/);
    
    // Check for concatenated typos (e.g. 성남시수정구, 경기도성남시)
    const typoRegex = /[가-힣]+(시|도)[가-힣]+(시|군|구)$/;
    for (const part of parts) {
      if (typoRegex.test(part)) {
        setErrorMsg('띄어쓰기를 정확히 입력해주세요. (예: 경기도 성남시 수정구)');
        return false;
      }
    }

    // Check for incomplete granularity (e.g. "경기도 성남시" needs "분당구" or similar if typically required, 
    // but simplified check: at least 2 parts are needed "Sido Sigungu")
    if (parts.length < 2) {
      setErrorMsg('시/도와 시/군/구를 모두 입력해주세요. (예: 서울시 송파구)');
      return false;
    }

    // Heuristic: If strict validation for 'Gu' is needed when ending with 'Si' (City)
    // Example: "경기도 성남시" -> warn to enter Gu.
    if (parts.length === 2 && parts[1].endsWith('시')) {
      setErrorMsg('구 단위까지 상세하게 입력해주세요. (예: 경기도 성남시 분당구)');
      return false;
    }

    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    // Clear error message when user starts typing
    if (errorMsg) {
      setErrorMsg('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateSearchInput(input)) {
      onSearch(input.trim());
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-x-hidden bg-white">
      {/* Top Bar (Login / User Info) - Absolute Positioned */}
      <div className="absolute top-0 left-0 right-0 flex justify-end z-20 h-14 items-start p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <button 
              onClick={onMyInfoClick}
              className="flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-all text-sm group"
            >
              <span className="font-bold text-rose-500 group-hover:text-rose-600">{user.nickname}</span>님
              <Settings size={16} className="text-gray-400 group-hover:text-gray-600" />
            </button>
            <button 
              onClick={onLogout}
              className="p-2 bg-white/60 backdrop-blur-sm rounded-full shadow-sm text-gray-400 hover:text-gray-600 hover:bg-white transition-all"
              title="로그아웃"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Login Incentive Tooltip */}
            {showTooltip && (
              <div className="absolute top-16 right-0 w-52 bg-white border border-rose-100 shadow-xl rounded-xl p-3 z-30 animate-bounce">
                 <button 
                   onClick={() => setShowTooltip(false)} 
                   className="absolute top-1 right-1 text-gray-300 hover:text-gray-500"
                 >
                   <X size={12} />
                 </button>
                 <div className="text-xs text-gray-700 leading-relaxed">
                   <strong>🏠 주소 저장하고 편하게!</strong><br/>
                   신규 혜택 알림도 드려요 🔔
                 </div>
                 {/* Arrow */}
                 <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-t border-l border-rose-100 transform rotate-45"></div>
              </div>
            )}
            
            <button 
              onClick={onLoginClick}
              className="px-4 py-2 bg-[#FEE500] rounded-full text-sm font-bold text-[#3c1e1e] shadow-sm hover:bg-[#FDD835] transition-all flex items-center gap-1.5"
            >
              <MessageCircle size={16} fill="#3c1e1e" /> 3초 로그인
            </button>
          </div>
        )}
      </div>

      {/* Hero Section - Fresh Spring Theme */}
      <div className="min-h-[55vh] flex flex-col items-center justify-center p-6 text-center relative bg-gradient-to-b from-emerald-50 via-yellow-50 to-rose-50">
         <div className="animate-float mb-6">
            <div className="w-20 h-20 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm ring-1 ring-emerald-100">
               <Flower2 className="text-emerald-500 w-10 h-10" />
            </div>
         </div>
         <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
           우리 집에<br/>
           <span className="text-emerald-500">봄이 왔어요</span>
         </h1>
         <p className="text-gray-600 text-lg md:text-xl font-medium leading-relaxed max-w-md mx-auto">
           새로운 가족을 맞이하는 설레는 마음,<br/>
           봄이옴이 든든한 혜택으로 함께할게요.
         </p>
      </div>

      {/* Main Content Container - Search Section - Distinct White Background */}
      <div ref={searchSectionRef} className="flex-grow flex flex-col items-center justify-start pt-16 p-6 pb-20 w-full bg-white rounded-t-[2.5rem] -mt-12 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] relative z-10">
        <div className="w-full max-w-lg md:max-w-3xl mx-auto space-y-10 animate-fade-in-up">
          
          {/* Header Text */}
          <div className="text-center space-y-3 w-full">
            <span className="inline-block px-3 py-1 bg-rose-50 text-rose-500 text-xs font-bold rounded-full shadow-sm mb-2 border border-rose-100">
              봄이옴 (Bomiom)
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight md:leading-snug break-keep">
              임산부 혜택,<br />
              <span className="text-rose-500">주민등록상 거주지</span>로 확인하세요!
            </h2>
            <p className="text-gray-500 text-sm md:text-lg pt-2 break-keep">
              정부와 지자체 혜택, 사는 곳에 따라 달라집니다.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="w-full relative group max-w-xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className={`h-6 w-6 transition-colors ${errorMsg ? 'text-red-400' : 'text-gray-400 group-focus-within:text-rose-500'}`} />
              </div>
              <input
                type="text"
                className={`block w-full pl-14 pr-4 py-4 md:py-6 bg-gray-50 border-2 rounded-2xl shadow-inner text-gray-900 placeholder-gray-400 focus:outline-none transition-all text-lg md:text-xl font-medium
                  ${errorMsg 
                    ? 'border-red-300 focus:border-red-500 bg-red-50' 
                    : 'border-transparent focus:border-rose-500 bg-gray-50'
                  }
                `}
                placeholder="예: 경기도 성남시 분당구"
                value={input}
                onChange={handleInputChange}
              />
            </div>
            
            {/* Inline Error Message */}
            {errorMsg && (
              <div className="mt-3 flex items-center gap-1.5 text-red-500 px-2 animate-fade-in">
                <AlertCircle size={16} />
                <span className="text-sm font-bold">{errorMsg}</span>
              </div>
            )}
            
            <div className="mt-6 md:mt-8 w-full">
              <button
                type="submit"
                disabled={input.length === 0}
                className={`w-full flex items-center justify-center py-4 md:py-5 rounded-xl text-white font-bold text-xl shadow-lg transition-all transform
                  ${input.length > 0 
                    ? 'bg-rose-500 hover:bg-rose-600 hover:-translate-y-1' 
                    : 'bg-gray-300 cursor-not-allowed'
                  }
                `}
              >
                혜택 조회하기
              </button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-xs md:text-sm text-gray-400">
              * 실제 주민등록상 주소(도/시/구)를 정확히 입력해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * RESULT PAGE (Unified with Tabs)
 */
const ResultPage = ({ 
  region, 
  onBack,
  user,
  onSearch,
  onViewAllLocal,
  onGoHome,
  onGoMyPage
}: { 
  region: string; 
  onBack: () => void; 
  user: User | null;
  onSearch: (region: string) => void;
  onViewAllLocal: () => void;
  onGoHome: () => void;
  onGoMyPage: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [activeTab, setActiveTab] = useState<'GOV' | 'MUST_HAVE'>('GOV');
  const [privateCategory, setPrivateCategory] = useState<CategoryType>('ALL');
  
  // Refs for scrolling
  const nationalSectionRef = useRef<HTMLDivElement>(null);
  const localSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchBenefits(region);
      setBenefits(data);
      setLoading(false);
    };
    load();
  }, [region]);

  // Data Filtering
  const nationalBenefits = benefits.filter(b => b.source === 'GOV_NATIONAL');
  const localBenefits = benefits.filter(b => b.source === 'GOV_LOCAL');
  const privateBenefits = benefits.filter(b => b.source === 'PRIVATE');
  const filteredPrivateBenefits = filterBenefitsByCategory(privateBenefits, privateCategory);

  // Status Checks
  const nationalStatus = checkUpdateStatus(nationalBenefits);
  const localStatus = checkUpdateStatus(localBenefits);
  const privateStatus = checkUpdateStatus(privateBenefits);
  
  // Compute Badge Status for Private Categories
  const privateCategoryBadges = computeCategoryBadges(privateBenefits);

  // Latest Updates
  const nationalLatestDate = getLatestUpdateDate(nationalBenefits);
  const localLatestDate = getLatestUpdateDate(localBenefits);
  
  // Calculate Private Latest Date
  const privateLatestDate = getLatestUpdateDate(filteredPrivateBenefits);

  const handleSwitchToMustHave = () => {
    setActiveTab('MUST_HAVE');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      // Offset for sticky header
      const yOffset = -180; 
      const y = ref.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Handle Report Click
  const handleReportClick = () => {
    if (!user) {
      alert("혜택 제보는 로그인 후 가능합니다.");
      return;
    }
    // Open Kakao Channel Chat (Example ID, replacing with a generic or placeholder)
    window.open('https://pf.kakao.com', '_blank');
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* 1. Header with Region Info */}
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          {/* Top Navbar */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 gap-2">
            <div className="flex items-center min-w-0 flex-1">
              <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full shrink-0">
                <ArrowLeft size={24} />
              </button>
              
              {/* Home & MyPage Icons next to Back button */}
              <div className="flex gap-0 ml-1 shrink-0">
                 <button onClick={onGoHome} className="p-2 text-gray-400 hover:text-rose-500 rounded-full hover:bg-rose-50">
                    <Home size={20} />
                 </button>
                 <button onClick={onGoMyPage} className="p-2 text-gray-400 hover:text-rose-500 rounded-full hover:bg-rose-50">
                    <UserIcon size={20} />
                 </button>
              </div>

              <div className="ml-2 flex flex-col min-w-0 flex-1 overflow-hidden">
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {user && user.address === region ? '내 거주지' : '검색된 거주지'}
                </span>
                <span className="font-bold text-gray-900 flex items-center gap-1 leading-tight whitespace-nowrap overflow-x-auto no-scrollbar">
                  <MapPin size={14} className="text-rose-500 shrink-0" /> 
                  {/* Font size adjusted as requested: text-xs on mobile */}
                  <span className="text-xs sm:text-sm md:text-xl">{region}</span>
                </span>
              </div>
            </div>
            
            {/* View All Local Benefits Button (Replaced Search) */}
            <button 
              onClick={onViewAllLocal}
              className="text-[11px] md:text-xs font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              전국 혜택 구경하기 <ChevronRight size={12} />
            </button>
          </div>

          {/* 2. Main Tab Navigation (Top) */}
          <div className="px-4 py-3 bg-white">
            <div className="flex w-full bg-gray-100 p-1 rounded-xl gap-1">
              <button 
                onClick={() => setActiveTab('GOV')}
                className={`flex-1 py-2.5 rounded-lg text-sm md:text-base font-bold text-center transition-all duration-200 flex items-center justify-center gap-1.5 relative
                  ${activeTab === 'GOV' 
                    ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                <span>🏡</span> 내 거주지 혜택
                {(nationalStatus.hasNew || nationalStatus.hasUpdate || localStatus.hasNew || localStatus.hasUpdate) && (
                   <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white"></span>
                )}
              </button>
              {/* Removed middle tab to save space as per user request */}
              <button 
                onClick={() => setActiveTab('MUST_HAVE')}
                className={`flex-1 py-2.5 rounded-lg text-sm md:text-base font-bold text-center transition-all duration-200 flex items-center justify-center gap-1.5 relative
                  ${activeTab === 'MUST_HAVE' 
                    ? 'bg-rose-500 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-700'}
                `}
              >
                <span>🎁</span> 안 받으면 손해
                {(privateStatus.hasNew || privateStatus.hasUpdate) && (
                   <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 ring-1 ring-white"></span>
                )}
              </button>
            </div>
          </div>
          
          {/* 3. Sub Filter (Only for Must Have tab) */}
          {activeTab === 'MUST_HAVE' && (
            <CategoryFilter 
              selected={privateCategory} 
              onSelect={setPrivateCategory} 
              badges={privateCategoryBadges} 
            />
          )}
        </div>
      </header>

      {/* Main Content Area - Expanded Width for PC */}
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        
        {/* --- TAB CONTENT: GOVERNMENT --- */}
        {activeTab === 'GOV' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Sub-Navigator for Government Tab */}
            <div className="flex gap-2 sticky top-[135px] md:top-[140px] z-20 py-2 bg-gray-50/95 backdrop-blur-sm -mx-4 px-4 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => scrollToSection(nationalSectionRef)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-full text-sm font-semibold shadow-sm hover:bg-blue-50 transition-colors whitespace-nowrap relative"
              >
                <CheckCircle2 size={14} />
                공통 혜택
                <StatusBadge hasNew={nationalStatus.hasNew} hasUpdate={nationalStatus.hasUpdate} />
              </button>
              <button 
                onClick={() => scrollToSection(localSectionRef)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-full text-sm font-semibold shadow-sm hover:bg-emerald-50 transition-colors whitespace-nowrap relative"
              >
                <Building2 size={14} />
                지자체별 혜택
                <StatusBadge hasNew={localStatus.hasNew} hasUpdate={localStatus.hasUpdate} />
              </button>
            </div>

            {/* National Section - Blue Theme */}
            <div ref={nationalSectionRef} className="scroll-mt-40">
              <section className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
                 <div className="bg-blue-50/50 px-5 py-5 border-b border-blue-100 flex justify-between items-start md:items-center flex-col md:flex-row gap-3">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-blue-900 flex items-center gap-2">
                        대한민국 임산부 공통 혜택
                      </h2>
                      <p className="text-sm md:text-base text-blue-600/80 mt-1">
                        거주지와 상관없이 누구나 받을 수 있어요
                      </p>
                    </div>
                    {nationalLatestDate && (
                      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                        <Calendar size={14} className="text-blue-500" />
                        <span className="text-xs font-medium text-blue-600">
                          신규 업데이트: {nationalLatestDate}
                        </span>
                      </div>
                    )}
                 </div>
                 <div className="p-4 md:p-6 bg-blue-50/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {nationalBenefits.map(b => <BenefitCard key={b.id} benefit={b} userRegion={user?.address} mode="LIKE" />)}
                    </div>
                 </div>
              </section>
            </div>

            {/* Local Section - Emerald/Green Theme */}
            <div ref={localSectionRef} className="scroll-mt-40">
              <section className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
                 <div className="bg-emerald-50/50 px-5 py-5 border-b border-emerald-100 flex justify-between items-start md:items-center flex-col md:flex-row gap-3">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-emerald-900 flex items-center gap-2">
                        <span className="underline decoration-emerald-300 decoration-4 underline-offset-2">{region}</span> 혜택
                      </h2>
                      <p className="text-sm md:text-base text-emerald-600/80 mt-1">
                        주민등록상 주소지 기준으로 제공됩니다
                      </p>
                    </div>
                    {localLatestDate && (
                       <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm">
                        <Calendar size={14} className="text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-600">
                          신규 업데이트: {localLatestDate}
                        </span>
                      </div>
                    )}
                 </div>
                 <div className="p-4 md:p-6 bg-emerald-50/20">
                    {localBenefits.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {localBenefits.map(b => <BenefitCard key={b.id} benefit={b} userRegion={user?.address} mode="LIKE" />)}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 text-sm md:text-base">
                        '{region}' 지역의 추가 지원 정보를 준비 중입니다.
                      </div>
                    )}
                 </div>

                 {/* BUTTON TO VIEW ALL LOCAL BENEFITS */}
                 <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex justify-center">
                    <button 
                      onClick={onViewAllLocal}
                      className="text-sm font-bold text-emerald-700 bg-white border border-emerald-200 px-6 py-3 rounded-xl shadow-sm hover:bg-emerald-50 transition-colors flex items-center gap-2"
                    >
                      <List size={16} />
                      다른 지역 혜택 둘러보기
                      <ChevronRight size={16} />
                    </button>
                 </div>
              </section>
            </div>

            {/* Footer Link to Must Have Benefits */}
            <section className="animate-fade-in delay-200 pt-4 pb-8">
               <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 md:p-10 text-center space-y-6">
                 <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-50 rounded-full text-rose-500 mb-1">
                   <Gift size={32} />
                 </div>
                 <div>
                   <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
                     정부 지원은 아니지만, <span className="text-rose-500">안 받으면 손해인 혜택</span>들이에요
                   </h3>
                   <p className="text-sm md:text-lg text-gray-500 leading-relaxed">
                     다양한 제휴처에서 임산부/육아 가정을 위해 준비한<br className="hidden md:block"/>
                     알짜배기 혜택들도 놓치지 말고 챙겨가세요.
                   </p>
                 </div>
                 <div className="pt-2 flex justify-center">
                   <button 
                     onClick={handleSwitchToMustHave}
                     className="w-full md:w-auto md:px-16 flex items-center justify-center gap-2 py-4 md:py-5 bg-rose-500 text-white font-bold rounded-xl shadow-md hover:bg-rose-600 transition-all text-lg"
                   >
                     안 받으면 손해 혜택 보러가기 <ChevronRight size={20} />
                   </button>
                 </div>
               </div>
             </section>

             {/* Combined Footer: Disclaimer & Report */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t border-gray-100 pb-8">
               {/* Left: Disclaimer */}
               <div className="p-5 rounded-2xl bg-gray-100 text-gray-500 text-xs leading-relaxed border border-gray-200 flex flex-col justify-center h-full text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-1.5 mb-2 text-gray-600 font-bold">
                    <Info size={14} />
                    <span>안내</span>
                  </div>
                  <p className="break-keep">
                    본 서비스는 혜택 정보를 수시로 업데이트하고 있으나, 정확한 신청 자격 및 최신 내용은 <strong>반드시 공식 안내 페이지</strong>를 통해 다시 한 번 확인해 주시기 바랍니다.
                  </p>
               </div>

               {/* Right: Report */}
               <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-gray-50 border border-gray-100 h-full text-center">
                   <p className="text-gray-400 text-xs mb-3">
                     혹시 여기에 없는 공통/지자체 혜택을 알고 계신가요?
                   </p>
                   <button
                     onClick={handleReportClick}
                     className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FEE500] text-[#3c1e1e] rounded-xl text-xs font-bold shadow-sm hover:bg-[#FDD835] transition-all"
                   >
                     <MessageCircle size={14} fill="currentColor" />
                     카카오톡으로 혜택 제보하기
                   </button>
               </div>
            </div>
          </div>
        )}

        {/* --- TAB CONTENT: MUST HAVE (PRIVATE) --- */}
        {activeTab === 'MUST_HAVE' && (
          <div className="space-y-4 animate-fade-in">
            {/* Added Flex Container for Tip and Update Date */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-sm md:text-base text-gray-700 flex items-start gap-2 flex-grow">
                  <span className="font-bold text-rose-600 shrink-0">Tip.</span> 
                  <span>정부 지원 외에도 챙길 수 있는 알짜배기 혜택들입니다. 놓치지 말고 받아가세요!</span>
                </div>
                {/* ROSE STYLE UPDATE BADGE FOR PRIVATE */}
                {privateLatestDate && (
                  <div className="self-end md:self-center flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-rose-100 shadow-sm shrink-0">
                    <Calendar size={14} className="text-rose-500" />
                    <span className="text-xs font-medium text-rose-600">
                      신규 업데이트: {privateLatestDate}
                    </span>
                  </div>
                )}
            </div>

            {filteredPrivateBenefits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredPrivateBenefits.map(b => <BenefitCard key={b.id} benefit={b} userRegion={user?.address} />)}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                해당 카테고리의 혜택이 없습니다.
              </div>
            )}

            {/* 2. Partnership Inquiry */}
            <div className="mt-8 mb-8 p-6 bg-gray-100 rounded-2xl text-center border border-gray-200">
              <h4 className="font-bold text-gray-800 mb-2">기업 제휴 문의</h4>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                봄이옴과 함께 임산부에게<br className="block md:hidden"/>
                가치 있는 혜택을 제공하고 싶으신가요?
              </p>
              <a
                href="mailto:danny@bomiom.co.kr"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors text-sm"
              >
                <Mail size={16} />
                제휴 제안서 보내기
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const App = () => {
  const [page, setPage] = useState<'HOME' | 'LOGIN' | 'SIGNUP' | 'RESULT' | 'MY_INFO' | 'ALL_LOCAL'>('HOME');
  const [user, setUser] = useState<User | null>(null);
  const [region, setRegion] = useState('');
  const [loginBaseInfo, setLoginBaseInfo] = useState<any>(null);

  useEffect(() => {
    const loadedUser = getCurrentUser();
    if (loadedUser) {
      setUser(loadedUser);
    }
  }, []);

  const handleSearch = (searchRegion: string) => {
    setRegion(searchRegion);
    setPage('RESULT');
  };

  const handleLoginClick = () => {
    setPage('LOGIN');
  };

  const handleLoginSuccess = (baseInfo: any) => {
    setLoginBaseInfo(baseInfo);
    setPage('SIGNUP');
  };

  const handleSignupComplete = (newUser: User) => {
    setUser(newUser);
    if (newUser.address) {
      setRegion(newUser.address);
      setPage('RESULT');
    } else {
      setPage('HOME');
    }
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setPage('HOME');
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <div className="font-sans text-gray-900 bg-white min-h-screen">
      {page === 'HOME' && (
        <HomePage 
          onSearch={handleSearch} 
          user={user} 
          onLogout={handleLogout}
          onLoginClick={handleLoginClick}
          onMyInfoClick={() => setPage('MY_INFO')}
        />
      )}

      {page === 'LOGIN' && (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess} 
          onCancel={() => setPage('HOME')}
        />
      )}

      {page === 'SIGNUP' && loginBaseInfo && (
        <SignupPage 
          baseInfo={loginBaseInfo} 
          onComplete={handleSignupComplete} 
          onCancel={() => setPage('HOME')}
        />
      )}

      {page === 'RESULT' && (
        <ResultPage 
          region={region} 
          onBack={() => setPage('HOME')} 
          user={user}
          onSearch={handleSearch}
          onViewAllLocal={() => setPage('ALL_LOCAL')}
          onGoHome={() => setPage('HOME')}
          onGoMyPage={() => user ? setPage('MY_INFO') : setPage('LOGIN')}
        />
      )}

      {page === 'MY_INFO' && user && (
        <MyInfoPage 
          user={user} 
          onUpdate={handleUpdateUser} 
          onBack={() => setPage('HOME')} 
        />
      )}

      {page === 'ALL_LOCAL' && (
        <AllLocalBenefitsPage 
          onBack={() => setPage('RESULT')} 
          user={user}
          onGoHome={() => setPage('HOME')}
          onGoMyPage={() => user ? setPage('MY_INFO') : setPage('LOGIN')}
        />
      )}
    </div>
  );
};

export default App;