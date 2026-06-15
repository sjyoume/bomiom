import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, BookOpen, Zap, Users, User as UserIcon, 
  ChevronRight, Check, Lock, Gift, Bell, Play, Award, Heart
} from 'lucide-react';

// =========================================================================
// 🎉 [온보딩] 폭죽 파티클 (Framer Motion)
// =========================================================================
const Confetti = () => (
  <div className="absolute inset-0 pointer-events-none z-[1000] overflow-hidden">
    {Array.from({ length: 60 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-3 h-3 rounded-full"
        style={{
          backgroundColor: ['#4ecdc4', '#FF6B6B', '#FFD700', '#6C5CE7', '#FFAAA6'][Math.floor(Math.random() * 5)],
          left: '50%',
          top: '40%',
        }}
        initial={{ x: 0, y: 0, scale: 0 }}
        animate={{
          x: (Math.random() - 0.5) * window.innerWidth * 1.5,
          y: (Math.random() - 0.5) * window.innerHeight * 1.5 - 100,
          scale: [0, 1.5, 0],
        }}
        transition={{ duration: 2.5, ease: "easeOut" }}
      />
    ))}
  </div>
);

// =========================================================================
// 📱 메인 APP 컴포넌트
// =========================================================================
export default function BomiomV2() {
  // 1. 전역 상태 관리
  const [isOnboarding, setIsOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // 5개의 메인 네비게이션 탭 상태
  const [activeTab, setActiveTab] = useState<'TODAY' | 'ACADEMY' | 'ACTION' | 'LOUNGE' | 'MY'>('TODAY');
  
  const [user, setUser] = useState({ nickname: '', role: '', edd: '' });
  const currentWeek = 12; // 데모용 현재 주차
  const currentPoints = 350;

  // =========================================================================
  // 🚀 [뷰 1] 토스 스타일 초깔끔 온보딩
  // =========================================================================
  const finishOnboarding = () => {
    setShowConfetti(true);
    setTimeout(() => {
      setIsOnboarding(false);
      setShowConfetti(false);
    }, 2500); 
  };

  if (isOnboarding) {
    return (
      <div className="w-full h-[100dvh] bg-[#f4f6f9] text-slate-800 flex flex-col justify-between overflow-hidden font-pretendard">
        {showConfetti && <Confetti />}
        
        <div className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full relative z-10">
          <AnimatePresence mode="wait">
            {onboardingStep === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center">
                <motion.div animate={{ y: [-10, 10, -10] }} transition={{ repeat: Infinity, duration: 3 }} className="text-[100px] mb-6 drop-shadow-xl">🐥</motion.div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-4">반가워요! 봄이옴입니다</h2>
                <p className="text-[15px] font-medium text-slate-500 leading-relaxed break-keep">
                  수많은 정보 속에서 헤매지 않도록,<br/>40주간의 임신 여정을 게임처럼 즐겁게<br/>봄이옴이 든든하게 가이드해 드릴게요!
                </p>
              </motion.div>
            )}
            
            {onboardingStep === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
                <h2 className="text-2xl font-black text-slate-900 mb-8 text-center tracking-tight">어떤 이름으로 불러드릴까요?</h2>
                <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
                  <input type="text" placeholder="예) 튼튼맘, 봄이아빠" autoFocus value={user.nickname} onChange={e => setUser({...user, nickname: e.target.value})} className="w-full bg-transparent p-5 text-center text-lg font-bold outline-none text-slate-800" />
                </div>
              </motion.div>
            )}

            {onboardingStep === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">역할을 선택해 주세요</h2>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setUser({...user, role: 'mom'})} className={`flex-1 py-8 rounded-3xl font-bold flex flex-col items-center justify-center gap-3 transition-all border-2 ${user.role === 'mom' ? 'border-[#4ecdc4] bg-[#4ecdc4]/10 text-[#4ecdc4] shadow-md' : 'border-transparent bg-white text-slate-400 shadow-sm'}`}>
                    <span className="text-5xl">🤰</span> 엄마예요
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setUser({...user, role: 'dad'})} className={`flex-1 py-8 rounded-3xl font-bold flex flex-col items-center justify-center gap-3 transition-all border-2 ${user.role === 'dad' ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-md' : 'border-transparent bg-white text-slate-400 shadow-sm'}`}>
                    <span className="text-5xl">🙋‍♂️</span> 아빠예요
                  </motion.button>
                </div>
              </motion.div>
            )}

            {onboardingStep === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
                <h2 className="text-2xl font-black text-slate-900 mb-3 text-center tracking-tight">출산 예정일이 언제인가요?</h2>
                <p className="text-center text-xs text-slate-500 mb-8 font-medium">정확한 주차별 미션을 배달해 드릴게요!</p>
                <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
                  <input type="date" value={user.edd} onChange={e => setUser({...user, edd: e.target.value})} className="w-full bg-transparent p-5 text-center text-lg font-bold outline-none text-slate-700" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 shrink-0 max-w-md mx-auto w-full z-20 pb-safe">
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (onboardingStep === 0) setOnboardingStep(1);
              else if (onboardingStep === 1 && user.nickname) setOnboardingStep(2);
              else if (onboardingStep === 2 && user.role) setOnboardingStep(3);
              else if (onboardingStep === 3 && user.edd) finishOnboarding();
            }}
            className={`w-full py-4.5 rounded-2xl font-black flex items-center justify-center gap-2 text-[15px] shadow-lg transition-colors ${
              (onboardingStep === 1 && !user.nickname) || (onboardingStep === 2 && !user.role) || (onboardingStep === 3 && !user.edd)
              ? 'bg-slate-200 text-slate-400' 
              : 'bg-slate-900 text-white hover:bg-black'
            }`}
          >
            {onboardingStep === 0 ? '봄이옴 시작하기' : onboardingStep === 3 ? '여정 출발하기 🚀' : '다음'}
            <ChevronRight size={18} strokeWidth={3} />
          </motion.button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 🚀 [뷰 2] 메인 5-Tabs UI (The App)
  // =========================================================================
  return (
    <div className="w-full h-[100dvh] bg-[#f4f6f9] text-slate-800 font-pretendard flex flex-col antialiased relative">
      
      {/* --- 공통 헤더 --- */}
      <header className="px-5 pt-12 pb-3 flex justify-between items-center bg-[#f4f6f9] shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-rose-100 rounded-full flex items-center justify-center text-lg shadow-inner">
            {user.role === 'dad' ? '👨' : '👩'}
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-black text-slate-900 leading-tight">{user.nickname || '봄이맘'}님</span>
            <span className="text-[11px] font-bold text-[#4ecdc4]">Lv.3 (꼼꼼한 부모)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-full shadow-sm border border-slate-100">
            <Zap size={14} className="fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-black text-slate-700">{currentPoints} XP</span>
          </div>
          <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-500 hover:text-slate-800"><Bell size={16}/></button>
        </div>
      </header>

      {/* --- 컨텐츠 스크롤 영역 --- */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar pb-[90px] px-5 pt-2">
        
        {/* 탭 1. 🏠 TODAY (오늘 집중할 것) */}
        {activeTab === 'TODAY' && (
          <div className="animate-fade-in space-y-6">
            
            {/* 마일스톤 배너 */}
            <motion.div whileTap={{ scale: 0.98 }} className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-5 shadow-lg flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-widest">This Week's Milestone</p>
                <h3 className="text-base font-black text-white leading-tight">1차 기형아 검사 무사히 받기 🏥</h3>
              </div>
              <div className="bg-[#4ecdc4] text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm">
                D-2
              </div>
            </motion.div>

            {/* 부모 캐릭터 레벨업 섹션 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-4 left-4 bg-gray-50 px-3 py-1 rounded-full text-[10px] font-bold text-gray-500 border border-gray-100">임신 12주차</div>
              
              {/* 토스식 원형 게이지 */}
              <div className="relative w-36 h-36 mt-6 mb-4 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="50%" cy="50%" r="46%" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                  <circle cx="50%" cy="50%" r="46%" fill="none" stroke="#4ecdc4" strokeWidth="6" strokeLinecap="round" strokeDasharray="290" strokeDashoffset="120" className="transition-all duration-1000" />
                </svg>
                <motion.div animate={{ y: [-5, 5, -5] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="text-6xl drop-shadow-lg z-10">
                  🦸‍♀️
                </motion.div>
                {/* 꾸미기 아이템 예시 */}
                <span className="absolute top-2 right-2 text-2xl z-20 drop-shadow-md rotate-12">🕶️</span>
              </div>
              
              <h3 className="text-[15px] font-black text-slate-800">폭풍 성장 중인 초보 엄마!</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">오늘의 퀘스트를 깨고 다음 레벨로 가볼까요?</p>
            </div>

            {/* 오늘의 포커스 3 */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <h3 className="text-[15px] font-black text-slate-900">🔥 오늘의 포커스</h3>
                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">3개 남음</span>
              </div>
              
              <div className="space-y-3">
                {/* 카드 1 (학습 유도) */}
                <motion.div whileTap={{ scale: 0.98 }} onClick={() => setActiveTab('ACADEMY')} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-2xl border border-purple-100 shrink-0">📖</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-purple-500 mb-0.5 block">필수 지식</span>
                    <h4 className="font-bold text-sm text-slate-800 truncate">12주차 산전 검사의 모든 것</h4>
                  </div>
                  <button className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><Play size={16} className="ml-0.5 fill-gray-400"/></button>
                </motion.div>

                {/* 카드 2 (실전 유도) */}
                <motion.div whileTap={{ scale: 0.98 }} onClick={() => setActiveTab('ACTION')} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl border border-blue-100 shrink-0">🛡️</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-blue-500 mb-0.5 block">실전 미션</span>
                    <h4 className="font-bold text-sm text-slate-800 truncate">나에게 맞는 태아보험 찾기</h4>
                  </div>
                  <button className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><ChevronRight size={18}/></button>
                </motion.div>

                {/* 카드 3 (루틴) */}
                <motion.div whileTap={{ scale: 0.98 }} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-2xl border border-emerald-100 shrink-0">💊</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-emerald-500 mb-0.5 block">일일 루틴</span>
                    <h4 className="font-bold text-sm text-slate-800 truncate">엽산 + 비타민D 챙겨먹기</h4>
                  </div>
                  <button className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-[#4ecdc4] hover:text-white transition-colors"><Check size={18} strokeWidth={3}/></button>
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* 탭 2. 🎓 ACADEMY (듀오링고식 40주 학습 맵) */}
        {activeTab === 'ACADEMY' && (
          <div className="animate-fade-in flex flex-col items-center pb-20 pt-2">
            
            <div className="bg-white w-full rounded-3xl p-5 mb-8 shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-[15px] font-black text-slate-900 mb-1">부모 학기 진척률</h2>
                <p className="text-[11px] font-bold text-slate-400">전체 40주 중 12주차 완료</p>
              </div>
              <div className="text-2xl font-black text-[#4ecdc4]">30%</div>
            </div>

            {/* 듀오링고 스타일 버티컬 맵 */}
            <div className="relative w-full flex flex-col items-center gap-10">
              {/* 중앙 연결선 */}
              <div className="absolute top-10 bottom-10 w-3 bg-gray-200 rounded-full z-0">
                {/* 진행된 선 */}
                <div className="w-full bg-[#4ecdc4] rounded-full" style={{ height: '35%' }}></div>
              </div>

              {/* 노드들 */}
              {[
                { week: 14, icon: '✈️', title: '태교여행 준비', status: 'LOCKED', offset: -60 },
                { week: 13, icon: '🦷', title: '임산부 치과 진료', status: 'LOCKED', offset: 60 },
                { week: 12, icon: '🏥', title: '1차 기형아 검사', status: 'CURRENT', offset: -40 },
                { week: 11, icon: '🤰', title: '체중 관리 기초', status: 'DONE', offset: 50 },
                { week: 10, icon: '🧠', title: '태아 두뇌 발달', status: 'DONE', offset: -50 },
              ].map((node, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center" style={{ transform: `translateX(${node.offset}px)` }}>
                  {/* 말풍선 타이틀 */}
                  <div className={`mb-2 px-3 py-1.5 rounded-2xl shadow-sm text-[11px] font-bold ${node.status === 'CURRENT' ? 'bg-white border-2 border-[#4ecdc4] text-[#4ecdc4]' : 'bg-white border border-gray-100 text-gray-500'}`}>
                    {node.title}
                  </div>
                  
                  {/* 3D 둥근 버튼 */}
                  <motion.button 
                    whileTap={node.status !== 'LOCKED' ? { scale: 0.9, y: 4 } : {}}
                    className={`w-[70px] h-[70px] rounded-full flex items-center justify-center text-3xl border-b-[6px] transition-all relative ${
                      node.status === 'DONE' ? 'bg-[#4ecdc4] border-[#319795] text-white' :
                      node.status === 'CURRENT' ? 'bg-white border-gray-200 ring-4 ring-[#4ecdc4]/30' :
                      'bg-gray-200 border-gray-300 grayscale opacity-50'
                    }`}
                  >
                    {node.status === 'LOCKED' ? <Lock size={24} className="text-gray-400" /> : node.icon}
                    
                    {/* 별 뱃지 */}
                    {node.status === 'DONE' && (
                      <div className="absolute -bottom-2 -right-2 bg-amber-400 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                        <Star size={12} className="fill-white"/>
                      </div>
                    )}
                  </motion.button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 탭 3. 💡 ACTION (실전 / V1 기능 연동) */}
        {activeTab === 'ACTION' && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="text-[18px] font-black text-slate-900 mb-1 px-1">실전 혜택 & 도구 🛠️</h2>
              <p className="text-[12px] font-medium text-slate-500 px-1 mb-4">아카데미에서 배운 지식을 여기서 써먹어보세요!</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* 카드 1 */}
              <motion.div whileTap={{ scale: 0.95 }} className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-5 text-white shadow-md aspect-square flex flex-col justify-between relative overflow-hidden cursor-pointer">
                <div className="absolute -right-4 -bottom-4 text-7xl opacity-20">🛡️</div>
                <div className="bg-white/20 w-fit p-2 rounded-xl backdrop-blur-sm"><Shield size={20}/></div>
                <div>
                  <h3 className="font-black text-[15px] mb-1 leading-tight">태아보험<br/>AI 정밀 진단</h3>
                  <p className="text-[10px] text-blue-100 font-bold">내게 맞는 특약 찾기</p>
                </div>
              </motion.div>

              {/* 카드 2 */}
              <motion.div whileTap={{ scale: 0.95 }} className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl p-5 text-white shadow-md aspect-square flex flex-col justify-between relative overflow-hidden cursor-pointer">
                <div className="absolute -right-4 -bottom-4 text-7xl opacity-20">🏨</div>
                <div className="bg-white/20 w-fit p-2 rounded-xl backdrop-blur-sm"><Building2 size={20}/></div>
                <div>
                  <h3 className="font-black text-[15px] mb-1 leading-tight">우리 동네<br/>조리원 랭킹</h3>
                  <p className="text-[10px] text-emerald-50 font-bold">100% 리얼 맘스픽</p>
                </div>
              </motion.div>

              {/* 카드 3 */}
              <motion.div whileTap={{ scale: 0.95 }} className="bg-gradient-to-br from-rose-400 to-pink-500 rounded-3xl p-5 text-white shadow-md aspect-square flex flex-col justify-between relative overflow-hidden cursor-pointer">
                <div className="absolute -right-4 -bottom-4 text-7xl opacity-20">💳</div>
                <div className="bg-white/20 w-fit p-2 rounded-xl backdrop-blur-sm"><Gift size={20}/></div>
                <div>
                  <h3 className="font-black text-[15px] mb-1 leading-tight">국민행복카드<br/>찰떡 매칭</h3>
                  <p className="text-[10px] text-rose-100 font-bold">100만원 + 최대 사은품</p>
                </div>
              </motion.div>

              {/* 카드 4 */}
              <motion.div whileTap={{ scale: 0.95 }} className="bg-white border-2 border-gray-100 rounded-3xl p-5 text-slate-800 shadow-sm aspect-square flex flex-col justify-between relative overflow-hidden cursor-pointer hover:border-[#4ecdc4]">
                <div className="absolute -right-4 -bottom-4 text-7xl opacity-10">🏛️</div>
                <div className="bg-gray-50 w-fit p-2 rounded-xl text-gray-500"><MapPin size={20}/></div>
                <div>
                  <h3 className="font-black text-[15px] mb-1 leading-tight text-gray-800">정부/지자체<br/>지원금 찾기</h3>
                  <p className="text-[10px] text-gray-400 font-bold">놓치면 후회하는 돈</p>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* 탭 4. 👨‍👩‍👦 LOUNGE (팀워크/기록) */}
        {activeTab === 'LOUNGE' && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
            <span className="text-6xl mb-4">👫</span>
            <h2 className="text-lg font-black text-gray-900 mb-2">부부 라운지</h2>
            <p className="text-xs text-gray-500 font-medium">아빠의 퀘스트 기록과<br/>우리 부부만의 교환일기가 담길 공간입니다.</p>
          </div>
        )}

        {/* 탭 5. 📊 MY (스탯/보관함) */}
        {activeTab === 'MY' && (
          <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center">
            <span className="text-6xl mb-4">🏆</span>
            <h2 className="text-lg font-black text-gray-900 mb-2">나의 부모 스탯</h2>
            <p className="text-xs text-gray-500 font-medium">레이더 차트와 육아템 찜 목록(레지스트리)이<br/>정리될 공간입니다.</p>
          </div>
        )}

      </div>

      {/* =========================================================================
          🚀 하단 고정 플랫 네비게이션 (5 Tabs)
      ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center h-[72px] z-[300] px-2 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] pb-safe rounded-t-3xl">
        {[
          { id: 'TODAY', icon: Home, label: '투데이' },
          { id: 'ACADEMY', icon: BookOpen, label: '아카데미' },
          { id: 'ACTION', icon: Zap, label: '실전(혜택)' },
          { id: 'LOUNGE', icon: Users, label: '라운지' },
          { id: 'MY', icon: UserIcon, label: '마이' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`relative flex flex-col items-center justify-center w-[20%] h-full space-y-1 transition-colors ${
                isActive ? 'text-[#4ecdc4]' : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              {isActive && (
                <motion.div layoutId="activeNavTab" className="absolute top-2 w-12 h-12 bg-[#4ecdc4]/10 rounded-[1.2rem] -z-10" />
              )}
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive && tab.id === 'ACTION' ? 'fill-[#4ecdc4]/20' : ''} />
              <span className={`text-[9px] font-black ${isActive ? 'text-[#4ecdc4]' : 'text-slate-400'}`}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
} 