import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, MapPin, Heart, Camera, Shield, Building2, Plane, UserCheck, Baby, Smile, Sparkles, BookOpen } from 'lucide-react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const GardenPage = ({ user, onBack }: any) => {
  const [activeTab, setActiveTab] = useState<'MAGAZINE' | 'ROADMAP' | 'SCRAPBOOK'>('MAGAZINE');
  const [familyData, setFamilyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. 실시간 데이터 연동
  useEffect(() => {
    if (!user?.familyId) {
      setLoading(false);
      return;
    }
    const familyRef = doc(db, 'families', user.familyId);
    const unsub = onSnapshot(familyRef, (docSnap) => {
      if (docSnap.exists()) setFamilyData(docSnap.data());
      setLoading(false);
    });
    return () => unsub();
  }, [user?.familyId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white font-bold">
      우리의 소중한 기록을 모으는 중... ✨
    </div>
  );

  // 2. 앱 내 모든 데이터 긁어오기 (없을 경우 감성적인 대체 텍스트 적용)
  const safeStr = (str: any) => (str && str !== '알아보는 중' && str !== '예비맘' ? str : null);
  
  const d = {
    nickname: user?.nickname || '봄이맘',
    babyName: safeStr(user?.babyName) || '우리 아기',
    realName: safeStr(user?.realName)?.replace(/\[확정\]|\[고민\]/g, '').trim() || '아직 비밀',
    candidates: user?.candidateNames ? user.candidateNames.split(',').filter(Boolean) : [],
    
    // 맘스픽 데이터들
    hospital: safeStr(user?.myHospitalName) || '우리의 첫 만남 장소',
    insCompany: safeStr(user?.insCompany) || '든든한 울타리',
    careCenter: safeStr(user?.myCareCenter) || '우리의 첫 쉼터',
    babymoon: safeStr(user?.myBabymoon) || '바다 건너 태교여행',
    helper: user?.completedMissions?.includes('산후도우미') ? '든든한 산후도우미 이모님' : '가족들의 따뜻한 케어',
    maternity: safeStr(user?.myMaternityWear) || '가장 편안했던 옷',
    stretch: safeStr(user?.myStretchMark) || '매일 밤 발랐던 크림',
    
    // 육아템 준비율
    registryCount: user?.registryData ? Object.values(user.registryData).filter((v:any) => v.isPrepared).length : 0,
    
    // 라운지 데이터들
    dueDate: user?.dueDate || '2026.00.00',
    momDiaryCount: familyData?.diaryNotes ? Object.values(familyData.diaryNotes).filter((n: any) => n.mom).length : 0,
    dadQuestCount: familyData?.sosLogs ? familyData.sosLogs.filter((s: any) => s.status === '완료').length : 0,
    firstKick: familyData?.kickLogs?.length > 0 ? `${familyData.kickLogs[0].week}주차` : '기다리던 그 날',
    
    // 감정 분석 (가장 많이 느낀 감정)
    topEmotion: (() => {
      if (!familyData?.emotionLogs || familyData.emotionLogs.length === 0) return '🥰';
      const counts: any = {};
      familyData.emotionLogs.forEach((l:any) => { counts[l.emoji] = (counts[l.emoji] || 0) + 1; });
      return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    })(),
    emotionCount: familyData?.emotionLogs?.length || 0,
    
    bestPhoto: familyData?.photos?.length > 0 ? familyData.photos[familyData.photos.length - 1].url : null
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-32 font-pretendard flex flex-col items-center overflow-x-hidden">
      
      {/* 📱 상단 탭 컨트롤러 */}
      <header className="w-full max-w-md bg-gray-900/90 backdrop-blur-md sticky top-0 z-50 p-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-white p-1.5 bg-gray-800 rounded-full active:scale-90 transition-transform"><ArrowLeft size={20}/></button>
          <h2 className="font-bold text-white text-sm">우리의 280일 리포트 (통합본)</h2>
        </div>
        <div className="flex gap-1.5 bg-gray-800 p-1 rounded-2xl">
          {(['MAGAZINE', 'ROADMAP', 'SCRAPBOOK'] as const).map((t) => (
            <button 
              key={t}
              onClick={() => setActiveTab(t)} 
              className={`flex-1 py-2.5 text-[11px] font-black rounded-xl transition-all ${activeTab === t ? 'bg-white text-gray-900 shadow-lg scale-[1.02]' : 'text-gray-500'}`}
            >
              {t === 'MAGAZINE' ? '1. 매거진' : t === 'ROADMAP' ? '2. 로드맵' : '3. 스크랩북'}
            </button>
          ))}
        </div>
      </header>

      {/* 📄 리포트 메인 도화지 (스크롤 제한 없이 쭉쭉 늘어납니다) */}
      <div id="report-capture-area" className="w-full max-w-md bg-white shadow-2xl relative overflow-hidden animate-fade-in min-h-[1000px]">
        
        {/* ========================================================== */}
        {/* 🎨 컨셉 1. 매거진 인포그래픽 포스터 (데이터 총망라) */}
        {/* ========================================================== */}
        {activeTab === 'MAGAZINE' && (
          <div className="bg-[#FAFAF9] min-h-full pb-20">
            {/* 1. 커버 */}
            <div className="bg-stone-900 text-stone-100 p-10 text-center pt-20 pb-16 relative overflow-hidden">
              <span className="absolute -right-10 -bottom-10 text-[150px] opacity-10 leading-none">👶</span>
              <p className="text-[10px] font-black tracking-[0.3em] text-stone-400 mb-4 uppercase">Premium Edition</p>
              <h1 className="text-3xl font-black tracking-tighter leading-tight italic">
                {d.nickname.toUpperCase()}'S<br/>GREAT JOURNEY
              </h1>
              <p className="text-xs text-stone-400 mt-4 tracking-widest font-light">280 DAYS OF LOVE</p>
            </div>
            
            {/* 2. 네이밍 */}
            <div className="p-10 relative bg-white">
              <div className="absolute top-10 right-4 text-stone-100 text-5xl font-black tracking-tighter leading-none break-all w-full text-right pointer-events-none">
                {d.candidates.join(' ')}
              </div>
              <p className="text-[10px] font-black text-rose-500 mb-2 uppercase tracking-widest">Chapter 1. Naming</p>
              <h2 className="text-4xl font-black text-stone-800 mb-4 relative z-10 break-keep">"{d.babyName}"</h2>
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-stone-600 leading-relaxed break-keep relative z-10">
                  처음 너의 존재를 알게 된 날, 우리는 {d.candidates.length > 0 ? d.candidates.join(', ') : '수많은 예쁜 단어들'} 사이에서 치열하게 고민했단다. 
                </p>
                <div className="bg-stone-800 text-white text-[10px] font-black px-3 py-1.5 rounded-full inline-block mt-2">최종 선택된 이름</div>
              </div>
            </div>

            {/* 3. 장소 기록 (맘스픽 데이터 연동) */}
            <div className="px-10 py-12 bg-stone-100/50 border-y border-stone-200 grid grid-cols-2 gap-x-6 gap-y-8">
              <div className="col-span-2">
                <p className="text-[10px] font-black text-rose-500 mb-2 uppercase tracking-widest">Chapter 2. Footprints</p>
                <h3 className="text-lg font-black text-stone-800 tracking-tight">우리가 너를 준비한 곳들</h3>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 mb-1 flex items-center gap-1"><MapPin size={10}/> 산부인과</p>
                <p className="text-sm font-black text-stone-800 break-keep">{d.hospital}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 mb-1 flex items-center gap-1"><Shield size={10}/> 태아보험</p>
                <p className="text-sm font-black text-stone-800 break-keep">{d.insCompany}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 mb-1 flex items-center gap-1"><Plane size={10}/> 태교여행</p>
                <p className="text-sm font-black text-stone-800 break-keep">{d.babymoon}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 mb-1 flex items-center gap-1"><Building2 size={10}/> 산후조리원</p>
                <p className="text-sm font-black text-stone-800 break-keep">{d.careCenter}</p>
              </div>
            </div>

            {/* 4. 부부 라운지 기록 */}
            <div className="p-10 bg-white">
              <p className="text-[10px] font-black text-rose-500 mb-4 uppercase tracking-widest">Chapter 3. Our Memories</p>
              <div className="bg-stone-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
                <span className="absolute -right-4 -bottom-4 text-8xl opacity-10">📖</span>
                <div className="space-y-8 relative z-10">
                  <div className="flex justify-between items-center border-b border-stone-700 pb-4">
                    <span className="text-xs font-medium text-stone-400">엄마의 진심 다이어리</span>
                    <span className="text-2xl font-black text-stone-100">{d.momDiaryCount} <small className="text-[10px] font-bold text-stone-500">번</small></span>
                  </div>
                  <div className="flex justify-between items-center border-b border-stone-700 pb-4">
                    <span className="text-xs font-medium text-stone-400">아빠의 헌신 (퀘스트)</span>
                    <span className="text-2xl font-black text-stone-100">{d.dadQuestCount} <small className="text-[10px] font-bold text-stone-500">회</small></span>
                  </div>
                  <div className="flex justify-between items-center border-b border-stone-700 pb-4">
                    <span className="text-xs font-medium text-stone-400">네가 처음 발로 찬 날</span>
                    <span className="text-lg font-black text-rose-400">{d.firstKick}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-stone-400">우리가 가장 많이 느낀 감정</span>
                    <span className="text-3xl font-black">{d.topEmotion} <small className="text-[10px] font-bold text-stone-500 ml-1">({d.emotionCount}일)</small></span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 준비 완료 & 출생신고 */}
            <div className="px-10 py-10">
              <p className="text-[10px] font-black text-rose-500 mb-4 uppercase tracking-widest">Chapter 4. All Set</p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🛒</div>
                  <div>
                    <p className="text-[11px] text-stone-500 font-bold mb-0.5">육아템 완벽 준비율</p>
                    <p className="text-sm font-black text-stone-800">{d.registryCount}개의 필수템 완료</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">👩‍🍼</div>
                  <div>
                    <p className="text-[11px] text-stone-500 font-bold mb-0.5">너를 돌봐줄 손길</p>
                    <p className="text-sm font-black text-stone-800">{d.helper}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 에필로그 */}
            <div className="text-center pb-20 pt-6 px-10">
              <div className="bg-stone-800 text-stone-100 p-6 rounded-3xl shadow-inner">
                <p className="text-[10px] font-black text-stone-400 tracking-[0.2em] mb-2 uppercase">Your Real Name</p>
                <h2 className="text-3xl font-black tracking-tight mb-4">{d.realName}</h2>
                <p className="text-xs text-stone-400 leading-relaxed break-keep">
                  이 멋진 이름으로 평생 불리게 될 너를,<br/>세상에서 가장 사랑해.
                </p>
                <div className="mt-6 pt-6 border-t border-stone-700">
                  <p className="text-xl font-black text-rose-400 tracking-tighter">D-DAY {d.dueDate.replace(/-/g, '.')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* 🗺️ 컨셉 2. 280일의 동화책 로드맵 (세로형 스토리텔링) */}
        {/* ========================================================== */}
        {activeTab === 'ROADMAP' && (
          <div className="bg-[#F4F9F9] min-h-full pb-24 relative overflow-hidden">
            <div className="text-center pt-20 pb-12 z-10 relative">
              <span className="text-4xl mb-3 block drop-shadow-md">🛤️</span>
              <h1 className="text-2xl font-black text-teal-900 tracking-tight">우리가 함께 걸어온 길</h1>
              <p className="text-[11px] text-teal-600 font-bold mt-2 uppercase tracking-widest">280 Days Adventure</p>
            </div>

            {/* 세로 타임라인 선 */}
            <div className="absolute left-1/2 top-48 bottom-40 w-1.5 bg-teal-200/50 -translate-x-1/2 z-0 rounded-full"></div>

            <div className="relative z-10 px-6 space-y-16 mt-4">
              
              {/* 노드 1: 산부인과 & 태아보험 */}
              <div className="flex justify-start w-full pr-10">
                <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-teal-100 relative w-full">
                  <div className="absolute top-1/2 -right-3 w-6 h-6 bg-teal-500 border-4 border-white rounded-full -translate-y-1/2 shadow-sm"></div>
                  <span className="text-2xl mb-2 block">🩺</span>
                  <p className="text-[10px] font-black text-teal-500 mb-1 tracking-wider uppercase">Week 5~10</p>
                  <h3 className="text-sm font-black text-gray-800 mb-1">너의 첫 심장 소리</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed break-keep">
                    <b>{d.hospital}</b>에서 널 처음 만났고, 널 지켜주기 위해 <b>{d.insCompany}</b>도 가입했어.
                  </p>
                </div>
              </div>

              {/* 노드 2: 태명 & 튼살크림 */}
              <div className="flex justify-end w-full pl-10">
                <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-rose-100 relative w-full text-right">
                  <div className="absolute top-1/2 -left-3 w-6 h-6 bg-rose-500 border-4 border-white rounded-full -translate-y-1/2 shadow-sm"></div>
                  <span className="text-2xl mb-2 block">🏷️</span>
                  <p className="text-[10px] font-black text-rose-500 mb-1 tracking-wider uppercase">Week 16</p>
                  <h3 className="text-sm font-black text-gray-800 mb-1">우리가 지어준 첫 이름</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed break-keep">
                    이때부터 널 <b>'{d.babyName}'</b>(이)라고 불렀어. 아빠가 엄마 배에 <b>{d.stretch}</b>도 열심히 발라줬단다.
                  </p>
                </div>
              </div>

              {/* 노드 3: 태교여행 & 첫 태동 */}
              <div className="flex justify-start w-full pr-10">
                <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-amber-100 relative w-full">
                  <div className="absolute top-1/2 -right-3 w-6 h-6 bg-amber-500 border-4 border-white rounded-full -translate-y-1/2 shadow-sm"></div>
                  <span className="text-2xl mb-2 block">✈️</span>
                  <p className="text-[10px] font-black text-amber-500 mb-1 tracking-wider uppercase">Week 20~24</p>
                  <h3 className="text-sm font-black text-gray-800 mb-1">너와 함께한 첫 여행</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed break-keep">
                    <b>{d.babymoon}</b>에서 휴식을 즐기던 중, <b>{d.firstKick}</b>에 뱃속에서 꼬물거리는 너의 첫 태동을 느꼈어! 👣
                  </p>
                </div>
              </div>

              {/* 노드 4: 라운지 기록 (다이어리 & 퀘스트) */}
              <div className="flex justify-end w-full pl-10">
                <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-indigo-100 relative w-full text-right">
                  <div className="absolute top-1/2 -left-3 w-6 h-6 bg-indigo-500 border-4 border-white rounded-full -translate-y-1/2 shadow-sm"></div>
                  <span className="text-2xl mb-2 block">💌</span>
                  <p className="text-[10px] font-black text-indigo-500 mb-1 tracking-wider uppercase">Week 28</p>
                  <h3 className="text-sm font-black text-gray-800 mb-1">차곡차곡 쌓인 우리의 사랑</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed break-keep">
                    엄마는 <b>{d.momDiaryCount}번</b>의 일기를 썼고, 아빠는 <b>{d.dadQuestCount}번</b>이나 엄마의 SOS를 해결해 줬어 🦸‍♂️
                  </p>
                </div>
              </div>

              {/* 노드 5: 조리원 & 육아템 */}
              <div className="flex justify-start w-full pr-10">
                <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-blue-100 relative w-full">
                  <div className="absolute top-1/2 -right-3 w-6 h-6 bg-blue-500 border-4 border-white rounded-full -translate-y-1/2 shadow-sm"></div>
                  <span className="text-2xl mb-2 block">🛒</span>
                  <p className="text-[10px] font-black text-blue-500 mb-1 tracking-wider uppercase">Week 32~36</p>
                  <h3 className="text-sm font-black text-gray-800 mb-1">널 맞이할 준비 완료</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed break-keep">
                    <b>{d.careCenter}</b> 예약도 끝냈고, <b>{d.registryCount}개</b>의 육아템도 미리 다 사두었단다.
                  </p>
                </div>
              </div>

              {/* Final Node: D-DAY & Real Name */}
              <div className="flex flex-col items-center pt-8">
                <div className="w-20 h-20 bg-teal-800 rounded-full flex items-center justify-center z-10 shadow-xl border-[6px] border-white mb-5 animate-pulse">
                  <Baby size={36} className="text-white"/>
                </div>
                <p className="text-[11px] text-teal-600 font-black tracking-widest uppercase mb-1">D-DAY {d.dueDate.replace(/-/g, '.')}</p>
                <h3 className="font-black text-gray-900 text-2xl mb-2">"{d.realName}"</h3>
                <p className="text-xs text-gray-500 font-medium">드디어 이 예쁜 이름으로 널 만나게 됐어!</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* ✂️ 컨셉 3. 아날로그 코르크 스크랩보드 (콜라주) */}
        {/* ========================================================== */}
        {activeTab === 'SCRAPBOOK' && (
          <div className="bg-[#E7E5E4] min-h-full pb-32 relative overflow-hidden" style={{ backgroundImage: 'radial-gradient(#d6d3d1 1.5px, transparent 0)', backgroundSize: '24px 24px' }}>
            <div className="p-8 pt-16">
               <div className="bg-white/90 backdrop-blur-md p-6 rounded-xl shadow-sm border border-stone-300 transform -rotate-1 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-stone-300/40 backdrop-blur-sm shadow-inner rotate-2 border border-white/50"></div>
                  <h1 className="text-2xl font-black text-stone-800 text-center tracking-tighter">OUR MEMORY SCRAP</h1>
                  <p className="text-center text-[10px] font-mono text-stone-500 mt-2 uppercase tracking-widest">280 days record by bomiom</p>
               </div>
            </div>

            <div className="relative h-[1100px] w-full max-w-sm mx-auto">
              
              {/* 1. 폴라로이드 사진 (베스트 포토 연동) */}
              <div className="absolute top-4 left-6 bg-white p-3 pb-10 rounded-sm shadow-xl transform -rotate-3 w-48 border border-gray-200 z-10">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-5 bg-white/60 backdrop-blur-sm shadow-sm rotate-3 border border-white/40"></div>
                <div className="w-full aspect-square bg-stone-100 flex items-center justify-center text-4xl overflow-hidden relative border border-gray-100">
                  {d.bestPhoto ? (
                    <img src={d.bestPhoto} className="w-full h-full object-cover" alt="Best moment" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300 bg-stone-50">
                      <Camera size={32}/>
                      <span className="text-[10px] font-bold">Photo</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-[12px] text-stone-700 mt-4 font-black">우리의 가장 행복한 순간 📸</p>
              </div>

              {/* 2. 찢어진 노트 (이름 짓기) */}
              <div className="absolute top-20 right-4 bg-[#FEF9C3] p-5 rounded-sm shadow-lg transform rotate-6 w-44 border border-yellow-300 z-20">
                <h4 className="text-[11px] font-black text-yellow-800 border-b border-yellow-400 pb-2 mb-3 font-mono">BABY NAMING</h4>
                <ul className="text-[11px] text-yellow-900/70 space-y-1.5 font-mono italic">
                  {d.candidates.map(c => <li key={c} className="line-through decoration-rose-400/50">• {c}</li>)}
                  <li className="text-rose-600 font-black text-[14px] mt-3 bg-yellow-200 inline-block px-1.5 py-0.5 -rotate-2 border border-yellow-300 shadow-sm">👉 {d.babyName}!!</li>
                </ul>
              </div>

              {/* 3. 영수증 (맘스픽 데이터 쫙!) */}
              <div className="absolute top-[380px] left-8 bg-white p-5 shadow-xl w-56 border border-gray-200 z-30" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 95% 98%, 90% 100%, 85% 98%, 80% 100%, 75% 98%, 70% 100%, 65% 98%, 60% 100%, 55% 98%, 50% 100%, 45% 98%, 40% 100%, 35% 98%, 30% 100%, 25% 98%, 20% 100%, 15% 98%, 10% 100%, 5% 98%, 0 100%)' }}>
                <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 mb-4">
                  <h4 className="font-black text-[15px] text-gray-800 tracking-[0.2em] font-mono">BOMIOM RECEIPT</h4>
                </div>
                <div className="space-y-3 text-[11px] font-mono text-gray-600">
                  <div className="flex justify-between items-start"><span className="shrink-0">Hospital</span><span className="font-bold text-gray-900 text-right ml-2 break-keep leading-tight">{d.hospital}</span></div>
                  <div className="flex justify-between items-start"><span className="shrink-0">Insurance</span><span className="font-bold text-gray-900 text-right ml-2 break-keep leading-tight">{d.insCompany}</span></div>
                  <div className="flex justify-between items-start"><span className="shrink-0">Babymoon</span><span className="font-bold text-gray-900 text-right ml-2 break-keep leading-tight">{d.babymoon}</span></div>
                  <div className="flex justify-between items-start"><span className="shrink-0">CareCenter</span><span className="font-bold text-gray-900 text-right ml-2 break-keep leading-tight">{d.careCenter}</span></div>
                  <div className="flex justify-between items-start"><span className="shrink-0">Helper</span><span className="font-bold text-gray-900 text-right ml-2 break-keep leading-tight">{d.helper}</span></div>
                  <div className="flex justify-between border-t border-stone-200 pt-3 mt-1"><span>Items Ready</span><span className="font-bold text-gray-900">{d.registryCount} EA</span></div>
                </div>
                <div className="text-center border-t border-gray-800 pt-3 mt-4 mb-2">
                  <p className="text-[11px] font-black text-gray-900 uppercase">Total Memories: MAX</p>
                </div>
              </div>

              {/* 4. 감정 & 태동 포스트잇 */}
              <div className="absolute top-[480px] right-6 bg-[#FDF4FF] p-5 shadow-md transform rotate-2 w-40 border border-fuchsia-200 z-40">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-3 bg-fuchsia-200/50 backdrop-blur-sm -rotate-2"></div>
                <h4 className="text-[11px] font-black text-fuchsia-800 mb-2 font-mono border-b border-fuchsia-200 pb-1">💛 OUR EMOTIONS</h4>
                <p className="text-[10px] text-fuchsia-900 leading-relaxed break-keep font-medium">
                  엄마의 일기 <b className="text-fuchsia-600 text-sm">{d.momDiaryCount}번</b><br/>
                  아빠의 헌신 <b className="text-fuchsia-600 text-sm">{d.dadQuestCount}번</b>
                </p>
                <p className="text-[10px] text-fuchsia-900 leading-relaxed break-keep font-medium border-t border-fuchsia-200 mt-2 pt-2">
                  첫 태동: <b className="text-fuchsia-600">{d.firstKick}</b> 👣
                </p>
                <div className="absolute -bottom-6 -right-4 text-5xl opacity-50 -rotate-12">{d.topEmotion}</div>
              </div>

              {/* 5. 진짜 이름 네임택 */}
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-stone-800 text-white p-5 shadow-2xl transform -rotate-1 w-64 border border-stone-900 z-50 text-center rounded-sm">
                <p className="text-[10px] font-black text-stone-400 mb-1 tracking-widest font-mono uppercase">Hello, World!</p>
                <h2 className="text-2xl font-black tracking-tighter mb-2">"{d.realName}"</h2>
                <p className="text-[10px] text-stone-300">D-DAY {d.dueDate.replace(/-/g, '.')}</p>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/20 backdrop-blur-sm -rotate-1"></div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* 💳 하단 플로팅 결제 & 다운로드 바 (기능 구현 전 UI) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-gray-200 z-[100] flex justify-center pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
        <div className="w-full max-w-md flex flex-col gap-2">
           <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100 shadow-sm animate-pulse">PRO VERSION</span>
              <p className="text-[11px] text-gray-500 font-bold">워터마크 없는 고화질 이미지 소장하기</p>
           </div>
           <button 
             onClick={() => alert('곧 정식 출시됩니다! 잠시만 기다려주세요 🎁')}
             className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all text-base"
           >
            <Download size={20}/> 280일 리포트 다운로드 (1,100원)
          </button>
        </div>
      </div>
    </div>
  );
};

export default GardenPage;