// src/components/AIStoryStudio.tsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Sparkles, BookOpen } from 'lucide-react';
import { db } from '../firebase'; 
// 💡 유저 문서 업데이트를 위한 파이어베이스 함수 추가!
import { collection, addDoc, doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';

const AIStoryStudio = ({ user, onBack, addToast }: any) => {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  
  // 💡 [신규] 책꽂이 팝업 창과 동화 리스트를 관리하는 상태 변수
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  
  const [babyName, setBabyName] = useState('');
  const [mainEvent, setMainEvent] = useState('');
  const [babyAction, setBabyAction] = useState('');
  const [storyWish, setStoryWish] = useState('');
  const [generatedText, setGeneratedText] = useState('');

  useEffect(() => {
    const handleAdMessage = async (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'AD_REWARD_EARNED' && data.adType === 'STUDIO_PREMIUM') await triggerGeneration();
      } catch (e) {}
    };
    window.addEventListener('message', handleAdMessage);
    return () => window.removeEventListener('message', handleAdMessage);
  }, [babyName, mainEvent, babyAction, storyWish]);

  const triggerGeneration = async () => {
    setLoading(true);
    try {
      const prompt = `사건: ${mainEvent} / 아기반응: ${babyAction} / 부모님진심: ${storyWish}`;
      const res = await fetch('/api/studio/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bomiom-secret': 'bomiom-super-secret-2024' },
        body: JSON.stringify({ type: 'story', babyName, theme: '가족의 일상', wishes: prompt })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.msg);

      setGeneratedText(data.content);
      const expireDate = new Date(); expireDate.setDate(expireDate.getDate() + 30);
      
      const currentUid = user?.id || user?.uid;
      
      // 1. 기존 전체 결과 DB에 저장
      await addDoc(collection(db, "ai_results"), {
        uid: currentUid || 'unknown', type: 'eden-story',
        createdAt: new Date(), expireAt: expireDate, title: `${babyName} 동화책`, content: data.content
      });

      // 💡 2. [신규] 유저 개인 문서(users)의 'fairyTales' 배열에 동화책 꽂아넣기!
      if (currentUid) {
        const newStory = {
          id: Date.now().toString(),
          title: `${babyName}의 스펙타클 모험기`,
          content: data.content,
          date: new Date().toLocaleDateString()
        };
        const userRef = doc(db, "users", currentUid);
        // setDoc + merge: true 를 쓰면 문서가 없어도 에러 없이 생성해줍니다!
        await setDoc(userRef, { fairyTales: arrayUnion(newStory) }, { merge: true });
      }

      setStep(3); addToast("✨ 장편 동화책이 완성되었습니다!");
    } catch (err: any) { alert(`[오류] ${err.message}`); } finally { setLoading(false); }
  };

  // 💡 [신규] 우측 상단 책꽂이 버튼을 눌렀을 때 DB에서 내 동화책 불러오기
  const openBookshelf = async () => {
    const currentUid = user?.id || user?.uid;
    if (!currentUid) return alert("로그인이 필요합니다.");
    
    setShowHistory(true); // 모달 창 띄우기
    try {
      const userDoc = await getDoc(doc(db, "users", currentUid));
      if (userDoc.exists()) {
        setHistoryList(userDoc.data().fairyTales || []);
      }
    } catch (e) {}
  };

  const handleStart = () => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SHOW_REWARDED_AD', adType: 'STUDIO_PREMIUM' }));
    } else triggerGeneration();
  };

  return (
    <div className="fixed inset-0 bg-[#FFF9F5] text-slate-900 z-[2000] overflow-y-auto font-sans break-keep">
      <nav className="px-5 py-4 flex items-center justify-between bg-white/90 backdrop-blur sticky top-0 border-b border-orange-100 z-50">
        <button onClick={onBack} className="p-1 -ml-1"><ChevronLeft size={28} className="text-orange-600"/></button>
        <h1 className="font-black text-[17px] text-orange-900 ml-4">📖 맞춤형 태담 동화</h1>
        {/* 💡 [신규] 우측 상단 책꽂이 버튼 */}
        <button onClick={openBookshelf} className="font-black text-[13px] text-orange-600 bg-orange-100 px-3 py-1.5 rounded-full active:scale-95 transition-transform">
          📚 책꽂이
        </button>
      </nav>

      <div className="p-6 pb-32 max-w-md mx-auto">
        {loading ? (
          <div className="py-32 text-center">
            <Sparkles size={50} className="text-orange-400 animate-pulse mx-auto mb-6" />
            <h2 className="text-xl font-black text-orange-900 leading-snug">작가님이 영혼을 갈아넣어<br/>장편 동화를 쓰는 중입니다...</h2>
          </div>
        ) : step === 1 ? (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-[17px] font-black text-orange-900">우리 가족만의 이야기를 써볼까요? 📝</h2>
            
            <div className="bg-white p-5 rounded-[1.2rem] border border-orange-100 shadow-sm">
                <h3 className="font-bold text-[15px] mb-3 text-slate-700">Q1. 동화책 주인공, 아기 태명은?</h3>
                <input type="text" placeholder="예) 우주최강 찰떡이" value={babyName} onChange={e=>setBabyName(e.target.value)} className="w-full p-4 rounded-xl bg-orange-50/50 border border-orange-200 font-bold focus:border-orange-500 outline-none text-[15px]"/>
            </div>

            <div className="bg-white p-5 rounded-[1.2rem] border border-orange-100 shadow-sm">
              <h3 className="font-bold text-[15px] mb-1 text-slate-700">Q2. 오늘 동화의 '메인 사건'은 무엇인가요?</h3>
              <p className="text-[12px] text-orange-500 mb-3">소소할수록 더 재밌어요!</p>
              <textarea value={mainEvent} onChange={e=>setMainEvent(e.target.value)} placeholder="예) 엄마가 딸기 케이크 한 판을 몰래 다 먹어버린 사건" className="w-full h-24 p-4 rounded-xl bg-orange-50/50 border border-orange-200 font-bold focus:border-orange-500 outline-none resize-none text-[15px] leading-relaxed"/>
            </div>
            
            <button disabled={!babyName || !mainEvent} onClick={()=>setStep(2)} className="w-full p-5 bg-orange-500 text-white rounded-xl font-black text-[16px] shadow-lg shadow-orange-500/30 disabled:bg-slate-300">다음 질문으로 넘어가기</button>
          </div>
        ) : step === 2 ? (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-[1.2rem] border border-orange-100 shadow-sm">
              <h3 className="font-bold text-[15px] mb-1 text-slate-700">Q3. 사건이 일어났을 때 아기의 반응은?</h3>
              <p className="text-[12px] text-orange-500 mb-3">아기의 반응이 이야기의 재미를 살려줍니다!</p>
              <textarea value={babyAction} onChange={e=>setBabyAction(e.target.value)} placeholder="예) 신나서 뱃속에서 폭풍 탭댄스를 췄다" className="w-full h-24 p-4 rounded-xl bg-orange-50/50 border border-orange-200 font-bold focus:border-orange-500 outline-none resize-none text-[15px] leading-relaxed"/>
            </div>

            <div className="bg-white p-5 rounded-[1.2rem] border border-orange-100 shadow-sm">
              <h3 className="font-bold text-[15px] mb-2 text-slate-700">Q4. 동화 마지막에 달콤하게 전할 진심은?</h3>
              <textarea value={storyWish} onChange={e=>setStoryWish(e.target.value)} placeholder="예) 우리 튼튼아, 건강하게 엄마아빠한테 와줘!" className="w-full h-24 p-4 rounded-xl bg-orange-50/50 border border-orange-200 font-bold focus:border-orange-500 outline-none resize-none text-[15px] leading-relaxed"/>
            </div>

            <div className="flex gap-3">
                <button onClick={()=>setStep(1)} className="flex-[1] py-5 bg-orange-100 text-orange-700 rounded-xl font-black text-[15px] whitespace-nowrap">이전</button>
                <button disabled={!babyAction || !storyWish} onClick={handleStart} className="flex-[2.5] py-5 px-2 bg-orange-500 text-white rounded-xl font-black text-[15px] shadow-lg shadow-orange-500/30 disabled:bg-slate-300 whitespace-nowrap">🎥 30초 광고보고 출판하기</button>
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-orange-100 relative">
              <BookOpen size={24} className="text-orange-500 mx-auto mb-4"/>
              <h3 className="font-black text-lg text-center text-orange-800 mb-6 pb-4 border-b border-orange-100">✨ {babyName}의 스펙타클 모험기</h3>
              <div className="space-y-6">
                {generatedText.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-[15px] leading-[1.8] font-medium text-slate-700">{line}</p>
                ))}
              </div>
            </div>
            <button onClick={()=>{setStep(1); setGeneratedText('');}} className="w-full mt-8 p-5 bg-slate-900 text-white rounded-xl font-black shadow-xl text-[16px]">새로운 이야기 만들기</button>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 💡 [신규] 책꽂이 모달(팝업) 화면 */}
      {/* ==================================================== */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-5 animate-fade-in">
          <div className="bg-[#FFF9F5] p-6 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[18px] font-black text-orange-900 flex items-center gap-2">📚 우리 아기 책꽂이</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 font-bold text-2xl leading-none">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold text-sm">
                  아직 저장된 동화가 없어요!<br/>새로운 이야기를 만들어보세요.
                </div>
              ) : (
                // 최신순으로 보여주기 위해 배열을 뒤집습니다(reverse)
                historyList.slice().reverse().map((tale: any) => (
                  <div key={tale.id} className="p-5 bg-white rounded-2xl border border-orange-100 shadow-sm relative">
                    <h3 className="font-black text-[15px] text-orange-800 mb-1 break-keep">{tale.title}</h3>
                    <p className="text-[11px] text-slate-400 font-bold mb-3">{tale.date}</p>
                    {/* 긴 글은 스크롤 가능하게 처리 */}
                    <div className="text-[14px] text-slate-600 leading-relaxed max-h-32 overflow-y-auto pr-2 break-keep">
                      {tale.content.split('\n').map((line: string, i: number) => <p key={i} className="mb-1">{line}</p>)}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button onClick={() => setShowHistory(false)} className="mt-5 w-full p-4 bg-orange-100 text-orange-700 rounded-xl font-black text-[15px] active:scale-95 transition-transform">
              책꽂이 닫기
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
export default AIStoryStudio;