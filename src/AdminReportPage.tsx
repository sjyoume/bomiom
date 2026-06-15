import React, { useState, useMemo } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase'; 
import { ArrowLeft, Printer, Sparkles, Camera, Footprints, ShoppingBag, ShieldCheck, MapPin, Quote, Heart, BarChart3 } from 'lucide-react';

// --- 한국어 조사 처리 함수 ---
const getJosa = (name: string) => {
  if (!name) return '아기야';
  const lastChar = name.charCodeAt(name.length - 1);
  const hasBatchim = (lastChar - 0xac00) % 28 !== 0;
  return hasBatchim ? `${name}아` : `${name}야`;
};

const AdminReportPage = ({ onBack }: { onBack: () => void }) => {
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const fetchFamilyReport = async () => {
    if (!searchId.trim()) return;
    setLoading(true);
    try {
      const familySnap = await getDoc(doc(db, 'families', searchId.trim()));
      const familyData = familySnap.exists() ? familySnap.data() : null;
      const q = query(collection(db, 'users'), where('familyId', '==', searchId.trim()));
      const usersSnap = await getDocs(q);
      const coupleUsers = usersSnap.docs.map(d => d.data());
      if (!familyData || coupleUsers.length === 0) {
        alert('데이터를 찾을 수 없습니다.');
        return;
      }
      const mom = coupleUsers.find(u => u.coupleRole === 'MOM') || coupleUsers[0];
      const dad = coupleUsers.find(u => u.coupleRole === 'DAD');
      setReportData({ familyData, mom, dad });
    } catch (error) { alert('에러 발생'); } finally { setLoading(false); }
  };

  // 📝 다이어리 데이터를 주차별로 정렬하여 렌더링하기 위한 전처리
  const diaryEntries = useMemo(() => {
    if (!reportData?.familyData?.diaryNotes) return [];
    const notes = reportData.familyData.diaryNotes;
    return Object.keys(notes).map(Number).sort((a, b) => a - b).map(week => ({
      week,
      mom: notes[week]?.mom,
      dad: notes[week]?.dad,
      emotion: reportData.familyData.emotionLogs?.filter((e:any) => e.week === week),
      symptom: reportData.familyData.symptomLogs?.filter((s:any) => s.week === week),
    }));
  }, [reportData]);

  return (
    <div className="min-h-screen bg-[#e8eae6] font-pretendard pb-20 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Gamja+Flower&family=Nanum+Myeongjo:wght@400;700;800&display=swap');
        
        /* B5 인쇄 규격 및 다이내믹 페이징 설정 */
        @media print {
          @page {
            size: 182mm 257mm; /* B5 Size */
            margin: 0;
          }
          body { background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          
          .b5-page {
            width: 182mm;
            min-height: 257mm; 
            margin: 0 !important;
            padding: 25mm 20mm !important; /* 제본을 고려한 넉넉한 여백 */
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
          /* 글이 반으로 뚝 잘리는 것 방지 */
          .avoid-break { page-break-inside: avoid; }
        }
        
        /* 웹 화면 미리보기용 설정 */
        .b5-page {
          width: 182mm;
          min-height: 257mm;
          background: #fff;
          margin: 40px auto;
          padding: 25mm 20mm;
          box-shadow: 0 15px 50px rgba(0,0,0,0.1);
          box-sizing: border-box;
          position: relative;
          background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
          background-size: 25px 25px;
        }

        .font-hand { font-family: 'Gaegu', cursive; }
        .font-cute { font-family: 'Gamja Flower', cursive; }
        .font-serif { font-family: 'Nanum Myeongjo', serif; }
      `}</style>

      {/* 헤더 */}
      <div className="no-print bg-white/90 backdrop-blur-md p-4 sticky top-0 z-50 flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-stone-100 text-stone-600 rounded-full"><ArrowLeft size={20}/></button>
          <h1 className="font-serif text-2xl text-stone-800 font-bold">Bomiom Diary Editor</h1>
        </div>
        <div className="flex gap-2">
          <input type="text" value={searchId} onChange={e=>setSearchId(e.target.value)} placeholder="Family ID" className="px-4 py-2 rounded-xl bg-gray-100 border-none text-sm w-64 focus:ring-2 focus:ring-stone-300" />
          <button onClick={fetchFamilyReport} className="bg-stone-700 text-white px-6 py-2 rounded-xl font-bold text-sm">{loading ? '...' : '불러오기'}</button>
          <button onClick={() => window.print()} className="bg-rose-500 text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md hover:bg-rose-600"><Printer size={16}/> PDF 저장</button>
        </div>
      </div>

      {reportData && (
        <div className="print-area">
          
          {/* ==========================================
              [PAGE 1] 커버
          ========================================== */}
          <div className="b5-page flex flex-col items-center justify-center bg-[#fdfbf7] !bg-none border-8 border-white outline outline-1 outline-stone-200">
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className="w-48 h-48 bg-white p-3 shadow-xl -rotate-3 border border-stone-100 mb-12 flex items-center justify-center text-7xl">
                 {reportData.mom?.babyGender?.includes('딸') ? '👧' : '👦'}
              </div>
              <h1 className="font-serif text-3xl text-stone-800 mb-6 text-center leading-snug font-extrabold tracking-tighter">
                우리의 소중한 {reportData.mom?.babyName || '아기'},<br/>
                널 기다린 280일의 기록
              </h1>
              <div className="w-12 h-px bg-rose-300 my-6"></div>
              <p className="font-serif text-lg text-stone-500 italic">
                엄마 {reportData.mom?.nickname} & 아빠 {reportData.dad?.nickname} 지음
              </p>
            </div>
          </div>

          {/* ==========================================
              [PAGE 2] 프롤로그 (처음 만난 날)
          ========================================== */}
          <div className="b5-page bg-white">
            <div className="text-center mb-10 mt-10">
              <h2 className="font-serif text-2xl font-bold text-stone-800 mb-2">프롤로그. 너와 처음 만난 날</h2>
              <p className="font-hand text-lg text-stone-400">두 줄을 확인했던 그날의 떨림을 기억하며</p>
            </div>
            
            <div className="flex flex-col items-center gap-8 px-6">
              <div className="w-full aspect-[4/3] bg-stone-50 rounded-lg border border-stone-200 shadow-inner flex items-center justify-center overflow-hidden">
                {reportData.familyData?.photos?.[0] ? (
                  <img src={reportData.familyData.photos[0].url} className="w-full h-full object-cover opacity-90" alt="첫 만남" />
                ) : (
                  <span className="text-stone-300 font-hand text-xl">이곳에 너의 첫 초음파 사진을 붙여줄게.</span>
                )}
              </div>

              <div className="w-full bg-rose-50/50 p-8 rounded-2xl border border-rose-100 relative">
                <Quote size={24} className="text-rose-200 mb-4" />
                <p className="font-serif text-[13px] leading-loose text-stone-700 whitespace-pre-wrap">
                  {reportData.familyData?.diaryNotes?.['4']?.mom || reportData.familyData?.diaryNotes?.['5']?.mom || "네가 우리에게 찾아왔다는 걸 처음 알았을 때, 말로는 다 표현 못 할 만큼 가슴이 벅차올랐어. 앞으로 펼쳐질 열 달의 여정이 두렵기도 하지만, 엄마 아빠가 널 위해 세상에서 가장 따뜻한 준비를 해볼게."}
                </p>
              </div>
            </div>
          </div>

          {/* ==========================================
              [PAGE 3] 태명 스토리
          ========================================== */}
          <div className="b5-page bg-[#fefaf9]">
            <h2 className="font-cute text-3xl text-rose-400 mb-12 mt-8 text-center">우리의 첫 번째 선물, 태명</h2>
            <div className="relative w-full h-64 flex flex-col items-center justify-center mb-10 bg-white rounded-[40px] shadow-sm border border-rose-100 overflow-hidden">
              <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-4 p-6 opacity-20">
                {reportData.mom?.candidateNames?.split(',').map((name:string, i:number) => (
                  <span key={i} className="font-hand text-2xl text-rose-300">{name}</span>
                ))}
              </div>
              <p className="font-hand text-lg text-rose-300 mb-2 relative z-10">세상에서 가장 다정한 이름</p>
              <h3 className="font-serif text-5xl font-black text-rose-600 relative z-10">{reportData.mom?.babyName}</h3>
            </div>
            <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-stone-200 shadow-sm">
              <h4 className="font-bold text-sm text-stone-800 mb-4 flex items-center gap-2">💡 태명 짓기 가이드: 우리가 고민한 흔적</h4>
              <ul className="space-y-4 font-serif text-[12px] text-stone-600 leading-relaxed">
                <li className="flex gap-2"><span>✔</span> <b>된소리의 울림:</b> 'ㄲ, ㄸ, ㅃ, ㅆ, ㅉ' 같은 된소리는 양수를 뚫고 너에게 가장 선명하게 전달된단다.</li>
                <li className="flex gap-2"><span>✔</span> <b>존재 그 자체의 사랑:</b> 성별을 알기 전부터 너를 온전히 사랑하기 위해 가장 중성적이고 편안한 이름을 고민했어.</li>
                <li className="flex gap-2"><span>✔</span> <b>다정한 부름:</b> "00엄마~" 하고 부를 때마다 우리 부부가 가장 미소 지을 수 있는 이름이야.</li>
              </ul>
            </div>
          </div>

          {/* ==========================================
              [PAGE 4] 산부인과 단독 페이지
          ========================================== */}
          <div className="b5-page bg-white">
            <div className="mt-12 mb-16 text-center">
              <h2 className="font-serif text-3xl font-bold text-stone-800 mb-4 tracking-tight">우리가 처음 너를 만난 곳</h2>
              <p className="font-hand text-xl text-stone-400">네가 건강하게 자라고 있음을 확인하던 안식처</p>
            </div>
            <div className="bg-stone-50 rounded-[40px] p-10 border border-stone-100 shadow-inner text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-md mx-auto mb-6">🏥</div>
              <h3 className="font-serif text-2xl font-black text-stone-800 mb-3">{reportData.mom?.myHospitalName}</h3>
              <p className="text-stone-400 text-xs mb-8">{reportData.mom?.myHospitalAddress}</p>
              <p className="font-serif text-[13px] text-stone-600 leading-loose break-keep">
                엄마 아빠는 너를 안전하게 만나기 위해 이곳을 선택했어. <br/>
                때로는 긴장되는 검사 결과에 가슴 졸이기도 했지만, <br/>
                화면 속 콩닥거리는 너의 심장 소리를 듣고 나면 <br/>
                세상 무엇보다 큰 안도감을 느끼며 돌아오곤 했단다.
              </p>
            </div>
          </div>

          {/* ==========================================
              [다이내믹 페이지] 주간 교환일기
          ========================================== */}
          <div className="b5-page bg-white p-0">
             <div className="p-[25mm_20mm] w-full h-full">
                <h2 className="font-cute text-4xl text-stone-700 mb-10 text-center underline decoration-stone-100 underline-offset-8">✍️ 280일의 다정한 대화</h2>
                <div className="space-y-12">
                  {diaryEntries.map((entry: any) => {
                    if (!entry.mom && !entry.dad) return null;
                    return (
                      <div key={entry.week} className="avoid-break group">
                        <div className="flex items-center gap-4 mb-6">
                          <span className="bg-gray-800 text-white px-4 py-1 rounded-lg text-xs font-black tracking-widest uppercase">Week {entry.week}</span>
                          <div className="flex-1 h-px bg-stone-100"></div>
                        </div>
                        
                        <div className="space-y-8 pl-4 border-l-2 border-stone-50">
                          {entry.mom && (
                            <div className="relative">
                              <span className="absolute -left-7 top-0 text-xl">👩</span>
                              <p className="font-serif text-[13px] leading-loose text-stone-700 whitespace-pre-wrap pl-2">
                                {entry.mom}
                              </p>
                            </div>
                          )}
                          {entry.dad && (
                            <div className="relative">
                              <span className="absolute -left-7 top-0 text-xl">👨</span>
                              <p className="font-serif text-[13px] leading-loose text-blue-800/80 whitespace-pre-wrap pl-2 italic">
                                {entry.dad}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2 pl-4">
                          {entry.emotion?.map((e:any, i:number) => (
                            <span key={`e-${i}`} className="bg-yellow-50 text-yellow-700 text-[10px] px-2 py-1 rounded border border-yellow-100 font-serif shadow-sm">
                              {e.emoji} {e.writer}는 이 날 {e.text}
                            </span>
                          ))}
                          {entry.symptom?.map((s:any, i:number) => (
                            <span key={`s-${i}`} className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-1 rounded border border-emerald-100 font-serif shadow-sm">
                              🩺 {s.writer}: {s.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>

          {/* ==========================================
              [PAGE 5] 태동 스페셜
          ========================================== */}
          <div className="b5-page bg-[#fdfdf9]">
            <h2 className="font-cute text-3xl text-emerald-500 mb-12 mt-8 text-center">너의 첫 번째 인사, 태동</h2>
            
            {reportData.familyData?.kickLogs?.[0] && (
              <div className="bg-white p-10 rounded-full aspect-square flex flex-col items-center justify-center shadow-xl border border-stone-100 max-w-[260px] mx-auto mb-12 relative overflow-hidden">
                 <div className="absolute inset-0 bg-emerald-50 opacity-20"></div>
                 <span className="text-7xl mb-3 relative z-10">👣</span>
                 <p className="font-hand text-xl text-emerald-600 mb-1 relative z-10">안녕? 나 여기 있어요!</p>
                 <p className="font-bold text-stone-800 text-sm relative z-10">
                   {reportData.familyData.kickLogs[0].date} {reportData.familyData.kickLogs[0].time}
                 </p>
              </div>
            )}

            <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm mt-8">
              <p className="text-[10px] font-bold text-emerald-500 mb-4 flex items-center gap-1"><Footprints size={12}/> 40주간 네가 보낸 신호들</p>
              <div className="h-32 flex items-end justify-between gap-1 px-2 border-b border-stone-100 pb-2">
                {Array.from({ length: 41 }).map((_, i) => {
                  const kickCount = reportData.familyData?.kickLogs?.filter((k:any) => k.week === i).length || 0;
                  const height = Math.min(100, kickCount * 15);
                  return (
                    <div key={i} className={`w-full rounded-t-sm transition-all duration-1000 ${kickCount > 0 ? 'bg-emerald-400' : 'bg-emerald-50'}`} style={{ height: `${height}%`, minHeight: kickCount > 0 ? '4px' : '0' }}></div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[8px] text-stone-300 mt-2 font-bold px-1">
                <span>0주</span><span>10주</span><span>20주</span><span>30주</span><span>40주</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-4 text-center italic">"네가 꼬물거릴 때마다 엄마 아빠의 행복도 쑥쑥 자라났어."</p>
            </div>
          </div>

          {/* ==========================================
              [PAGE 6] 태아보험 단독
          ========================================== */}
          <div className="b5-page bg-white">
            <h2 className="font-serif text-2xl font-bold text-stone-800 mb-12 text-center mt-8">너를 지켜줄 첫 번째 울타리</h2>
            
            <div className="space-y-6">
               <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-center mb-6">
                  <ShieldCheck size={40} className="text-blue-500 mx-auto mb-3"/>
                  <h3 className="font-serif text-xl font-black text-blue-900">{reportData.mom?.insCompany || '우리 아이 첫 보험'}</h3>
                  <p className="text-xs text-blue-600 mt-1">AI 정밀 진단 플랜: {reportData.mom?.insTestResult?.typeId || '안심 표준형'}</p>
               </div>

               <div className="bg-white p-8 rounded-[32px] border-2 border-stone-100 shadow-sm relative">
                  <div className="absolute -top-3 left-8 bg-white px-3 text-[10px] font-black text-stone-400 uppercase tracking-widest">Our Decision Process</div>
                  <h4 className="font-bold text-sm text-stone-800 mb-6 flex items-center gap-2">📝 엄마 아빠는 이런 마음으로 준비했어</h4>
                  
                  <div className="space-y-5">
                    {reportData.mom?.insTestResult?.answers ? reportData.mom.insTestResult.answers.map((a:any, i:number) => (
                      <div key={i} className="border-b border-stone-50 pb-4 last:border-0 avoid-break">
                        <p className="text-[11px] font-bold text-stone-400 mb-1.5">Q. {a.question.split('\n')[0]}</p>
                        <p className="text-xs font-bold text-stone-800 flex items-start gap-1.5">
                          <span className="text-blue-500">A.</span> {a.answer}
                        </p>
                      </div>
                    )) : (
                      <p className="text-center py-10 text-stone-300 font-hand text-xl">너를 향한 우리의 가장 든든한 약속이야.</p>
                    )}
                  </div>
               </div>
            </div>
          </div>

          {/* ==========================================
              [PAGE 7] 육아템 레지스트리 및 조리원
          ========================================== */}
          <div className="b5-page bg-white">
            <h2 className="font-cute text-4xl text-emerald-500 mb-8 text-center mt-6">
              <ShoppingBag size={28} className="inline-block mr-2 -mt-2"/> 널 맞이할 완벽한 준비
            </h2>
            <p className="text-center font-serif text-xs text-stone-500 mb-8 leading-relaxed">
              유모차부터 작은 손수건 하나까지,<br/>엄마 아빠가 밤새워 비교하고 정성껏 고른 것들이야.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-10">
               {Object.entries(reportData.mom?.registryData || {}).map(([name, v]: any) => {
                 if (!v.isPrepared) return null;
                 return (
                  <div key={name} className="p-4 rounded-2xl border border-emerald-100 flex items-center justify-between bg-stone-50/30 avoid-break">
                    <div className="min-w-0">
                      <p className="font-serif text-[12px] font-bold text-stone-800 truncate mb-0.5">{name}</p>
                      <p className="text-[9px] font-black text-emerald-500 uppercase truncate">{v.brandName || '준비완료'}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0">✔</div>
                  </div>
                 );
               })}
            </div>

            <div className="mt-auto bg-stone-50 p-6 rounded-2xl border border-stone-200 avoid-break">
              <p className="font-bold text-stone-800 mb-2 flex items-center gap-2">🏥 우리가 함께 머물 산후조리원</p>
              <p className="text-sm text-stone-600 font-serif">{reportData.mom?.myCareCenter || '아직 결정되지 않았어요'}</p>
            </div>
          </div>

          {/* ==========================================
              [PAGE 8] 산후도우미 & 진짜 이름
          ========================================== */}
          <div className="b5-page bg-[#fcfaf8]">
            <h2 className="font-serif text-2xl font-bold text-stone-800 mb-8 mt-6 text-center">우리를 도와줄 든든한 지원군</h2>
            
            <div className="bg-white p-8 rounded-sm shadow-md border border-stone-200 relative mb-12 avoid-break">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(transparent 95%, #000 100%)', backgroundSize: '100% 2.4em' }}></div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-hand text-2xl text-stone-800">To. 산후도우미 원장님께 💌</h3>
                  <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Helper Request</span>
                </div>
                <div className="font-serif text-[13px] leading-[2.4em] text-stone-600 whitespace-pre-wrap">
                  {reportData.mom?.helperTestResult?.requestText || "아직 작성된 요청사항이 없지만, \n엄마 아빠는 네가 태어난 후 가장 편안한 케어를 받을 수 있도록 \n최고의 도움을 준비하고 있단다."}
                </div>
              </div>
              <div className="mt-auto pt-10 text-right">
                <p className="font-hand text-xl text-rose-300">사랑을 가득 담아, 엄마 {reportData.mom?.nickname} 올림</p>
              </div>
            </div>

            <div className="bg-stone-900 rounded-[40px] p-10 text-center text-white relative overflow-hidden mt-auto mb-6 avoid-break">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full"></div>
               <p className="font-hand text-2xl text-stone-400 mb-4">평생 불릴 너의 진짜 이름</p>
               <h3 className="font-serif text-6xl font-black tracking-[0.2em] mb-4 text-white">
                 {reportData.mom?.realName?.replace(/\[.*?\]/g, '').trim() || '축복'}
               </h3>
               <p className="text-[10px] text-stone-500 font-serif">Bomiom Digital Family Archive</p>
            </div>
          </div>

          {/* ==========================================
              [부록 1] 감정 파도 & 체중 곡선 (🔥 복구 성공!)
          ========================================== */}
          <div className="b5-page bg-white">
            <h2 className="font-cute text-4xl text-orange-400 mb-10 text-center mt-6 flex justify-center items-center gap-2">
              <BarChart3 size={30}/> 너를 품은 몸과 마음의 변화
            </h2>

            {/* 체중 곡선 */}
            <div className="bg-[#f8f9fa] p-6 rounded-3xl border border-stone-200 mb-8 relative h-64 flex items-end shadow-inner">
              <span className="absolute top-4 left-6 text-xs font-bold text-stone-500">📈 체중 변화 곡선</span>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none p-6">
                {(() => {
                  const sortedWeeks = Object.keys(reportData.familyData?.weightLogs || {}).map(Number).sort((a,b)=>a-b);
                  if (sortedWeeks.length < 2) return null;
                  const points = sortedWeeks.map(week => {
                    const x = (week / 40) * 100;
                    const weight = reportData.familyData.weightLogs[week];
                    const base = reportData.familyData.baseWeight || weight;
                    const hPct = Math.min(Math.max(((weight - (base - 5)) / 30) * 100, 0), 100);
                    return `${x},${100 - hPct}`;
                  }).join(' ');
                  return <polyline points={points} fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
                })()}
              </svg>
              <div className="w-full border-b border-stone-300"></div>
            </div>

            {/* 감정 파도 */}
            <div className="bg-[#fffdf9] p-6 rounded-3xl border border-stone-200 relative h-64 flex flex-col justify-end shadow-inner">
              <span className="absolute top-4 left-6 text-xs font-bold text-stone-500">💛 감정의 파도</span>
              <div className="absolute right-6 top-4 flex gap-3 text-[9px] font-bold text-stone-500">
                 <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-rose-400"></i> 엄마</span>
                 <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-blue-400"></i> 아빠</span>
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none p-6">
                {(() => {
                  const mappedLogs = (reportData.familyData?.emotionLogs || []).map((log: any, idx: number) => {
                    const x = (parseInt(log.week) / 40) * 100 + (idx % 10 * 0.15);
                    const y = 10 + ['😄','🥰','🤢','😢','😡'].indexOf(log.emoji) * 20;
                    return { ...log, x, y };
                  });
                  const wifePoints = mappedLogs.filter((l:any) => l.writer === '아내').map((l:any) => `${l.x},${l.y}`).join(' ');
                  const husbandPoints = mappedLogs.filter((l:any) => l.writer === '남편').map((l:any) => `${l.x},${l.y}`).join(' ');
                  return (
                    <>
                      {wifePoints && <polyline points={wifePoints} fill="none" stroke="#fb7185" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />}
                      {husbandPoints && <polyline points={husbandPoints} fill="none" stroke="#60a5fa" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="4 2" />}
                    </>
                  );
                })()}
              </svg>
              <div className="w-full flex justify-between text-[8px] text-stone-400 font-bold border-t border-stone-300 pt-2">
                <span>0w</span><span>10w</span><span>20w</span><span>30w</span><span>40w</span>
              </div>
            </div>
          </div>

          {/* ==========================================
              [부록 2] 아빠 퀘스트
          ========================================== */}
          <div className="b5-page bg-white">
            <h2 className="font-serif text-2xl font-bold text-stone-800 mb-10 text-center mt-6">부록. 아빠의 고군분투 🦸‍♂️</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-blue-50 p-6 rounded-3xl text-center border border-blue-100">
                <p className="text-[10px] font-bold text-blue-400 mb-2">아빠가 완수한 SOS 미션</p>
                <p className="font-cute text-4xl text-blue-600 font-black">
                  {reportData.familyData?.sosLogs?.filter((s:any) => s.status === '완료').length || 0}회
                </p>
              </div>
              <div className="bg-orange-50 p-6 rounded-3xl text-center border border-orange-100">
                <p className="text-[10px] font-bold text-orange-400 mb-2">아빠가 획득한 자유시간 쿠폰</p>
                <p className="font-cute text-4xl text-orange-600 font-black">
                  {reportData.familyData?.dadCoupons || 0}장
                </p>
              </div>
            </div>

            <div className="bg-stone-50 p-6 rounded-3xl border border-stone-200 mb-12 avoid-break">
              <h4 className="font-bold text-sm text-stone-800 mb-4 flex items-center gap-2"><ShieldCheck size={16} className="text-stone-500"/> 가장 많이 해결한 긴급 임무</h4>
              <div className="space-y-3">
                {reportData.familyData?.sosLogs?.filter((s:any) => s.status === '완료').slice(-5).map((sos:any, i:number) => (
                  <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-stone-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-blue-500">{sos.type}</span>
                      <span className="text-xs font-serif text-stone-700 mt-1">{sos.text}</span>
                    </div>
                    <span className="text-[10px] text-stone-400">{sos.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ==========================================
              [에필로그] 안녕, 나의 우주
          ========================================== */}
          <div className="b5-page flex flex-col items-center justify-center bg-[#fdfbf7] !bg-none border-8 border-white outline outline-1 outline-stone-200">
            <h2 className="font-serif text-3xl font-black text-stone-800 mb-10 text-center tracking-widest">
              안녕, 나의 우주
            </h2>
            
            <div className="w-64 h-64 border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center justify-center bg-white/50 mb-12">
              <Camera size={32} className="text-stone-300 mb-2"/>
              <p className="font-hand text-sm text-stone-400 text-center">
                이곳에 네가 태어난 날의 첫 사진이나<br/>작은 발도장을 직접 붙여주세요.
              </p>
            </div>

            <p className="font-serif text-sm text-stone-500 text-center leading-loose max-w-[80%]">
              280일간의 기다림 끝에 드디어 너를 만났어.<br/>
              앞으로 우리가 함께 써 내려갈 더 크고 아름다운 이야기를 기대해.<br/>
              사랑한다, 우리 아기.
            </p>

            <div className="mt-16 pt-8 border-t border-stone-200 w-1/2 mx-auto text-center">
              <p className="text-[9px] font-bold text-stone-400 tracking-[0.3em] uppercase">Bomiom Digital Family Book</p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default AdminReportPage;