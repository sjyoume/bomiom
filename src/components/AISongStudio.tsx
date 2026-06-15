// src/components/AISongStudio.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Music, Play, Square, Mic2 } from 'lucide-react';
import { db, storage } from '../firebase'; 
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';

const AISongStudio = ({ user, onBack, addToast }: any) => {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [weeklyMr, setWeeklyMr] = useState({ theme: '불러오는 중...', url: '' });
  
  const [babyName, setBabyName] = useState('');
  const [charmPoints, setCharmPoints] = useState('');
  const [catchphrase, setCatchphrase] = useState('');

  const [generatedText, setGeneratedText] = useState('');
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null); // 가이드 음원용
  
  // 🎙️ [신규 추가] 녹음 관련 상태들
  const [recordingStep, setRecordingStep] = useState<'IDLE' | 'COUNTDOWN' | 'RECORDING' | 'UPLOADING' | 'FINISHED'>('IDLE');
  const [countdown, setCountdown] = useState(3);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null); // 유저가 녹음한 음원 주소

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // 💡 안드로이드 뚫어버리는 숨겨진 오디오 태그 연결고리
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const resultVocalRef = useRef<HTMLAudioElement>(null); 
  const resultMrRef = useRef<HTMLAudioElement>(null);

  // 🎙️ [신규 추가] 마이크 레코더 연결고리
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // 💡 중복 선언되었던 변수 두 줄을 깔끔하게 삭제했습니다!

  useEffect(() => {
    fetch(`/api/studio/weekly-mr?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => { 
        if(data.ok) setWeeklyMr(data.mr); 
      }).catch(()=>{});
  }, []);

  useEffect(() => {
    if (weeklyMr.url) {
      if (previewAudioRef.current) { 
        previewAudioRef.current.src = weeklyMr.url; 
        previewAudioRef.current.load(); 
      }
      if (resultMrRef.current) { 
        resultMrRef.current.src = weeklyMr.url; 
        resultMrRef.current.load(); 
      }
    }
  }, [weeklyMr.url]);

  useEffect(() => {
    if (generatedAudio && resultVocalRef.current) {
      resultVocalRef.current.src = generatedAudio;
      resultVocalRef.current.load();
    }
  }, [generatedAudio]);

  // 💡 1. Step 3 (완성 화면)으로 넘어갈 때만 미리듣기 끄기
  useEffect(() => {
    if (step === 3 && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }
  }, [step]); // isPreviewPlaying을 감시 대상에서 뺐습니다!

  // 💡 2. 화면을 완전히 나갈 때(뒤로 가기) 오디오 메모리 청소
  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      resultVocalRef.current?.pause();
      resultMrRef.current?.pause();
    };
  }, []);

  // 🎵 [수정] 미리듣기 버튼 (누르는 순간 주소 강제 주입!)
  const togglePreview = () => {
    const audio = previewAudioRef.current;
    if (!audio || !weeklyMr.url) return;

    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      audio.volume = 0.4; // 브금 볼륨
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPreviewPlaying(true))
          .catch((error: any) => {
            alert(`재생할 수 없습니다.\n(에러: ${error.message})`);
            setIsPreviewPlaying(false);
          });
      }
    }
  };

  useEffect(() => {
    const handleAdMessage = async (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'AD_REWARD_EARNED' && data.adType === 'STUDIO_PREMIUM') await triggerGeneration();
      } catch (e) {}
    };
    window.addEventListener('message', handleAdMessage);
    return () => window.removeEventListener('message', handleAdMessage);
  }, [babyName, charmPoints, catchphrase, weeklyMr]);

  // 1️⃣ 작사 버튼 눌렀을 때 실행
  const handleGenerateLyrics = async () => {
    setLoading(true);
    try {
      const wishesCombined = `매력포인트: ${charmPoints} / 유행어: ${catchphrase}`;
      const res = await fetch('/api/studio/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bomiom-secret': 'bomiom-super-secret-2024' },
        body: JSON.stringify({ babyName, theme: weeklyMr.theme, wishes: wishesCombined, uid: user?.id || 'guest' })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setGeneratedText(data.content);
      setStep(2); // 가사 확인 화면으로 이동
    } catch (err) { alert("작사 실패"); } finally { setLoading(false); }
  };

  // 2️⃣ 광고 시청 버튼 클릭 (광고 띄우기)
  const handleStartAd = () => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SHOW_REWARDED_AD', adType: 'STUDIO_PREMIUM' }));
    } else handleGenerateGuide(); // PC 테스트용 바로 넘어가기
  };

  // 3️⃣ 광고 다 보고 나면 실행되는 가이드 곡 생성
  const handleGenerateGuide = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/studio/generate-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bomiom-secret': 'bomiom-super-secret-2024' },
        body: JSON.stringify({ lyricsContent: generatedText, uid: user?.id || 'guest' })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setGeneratedAudio(data.audioUrl);
      setStep(3); // 최종 녹음 화면으로 이동
    } catch (err) { alert("가이드곡 생성 실패"); } finally { setLoading(false); }
  };

  // 💡 기존 useEffect의 광고 리스너도 handleGenerateGuide를 실행하도록 수정!
  useEffect(() => {
    const handleAdMessage = async (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // 🚨 여기를 triggerGeneration -> handleGenerateGuide 로 수정!
        if (data.type === 'AD_REWARD_EARNED' && data.adType === 'STUDIO_PREMIUM') await handleGenerateGuide();
      } catch (e) {}
    };
    window.addEventListener('message', handleAdMessage);
    return () => window.removeEventListener('message', handleAdMessage);
  }, [generatedText]);

  // =======================================================
  // 🎙️ [신규 추가] 여기서부터 새로운 녹음 기능입니다!
  // =======================================================
  const startRecordingFlow = () => {
    if (generatedAudio && resultVocalRef.current) resultVocalRef.current.pause(); // 가이드 곡 끄기
    setRecordingStep('COUNTDOWN');
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          startActualRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startActualRecording = async () => {
    setRecordingStep('RECORDING');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const vocalBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        stream.getTracks().forEach(track => track.stop()); 
        uploadUserRecording(vocalBlob); 
      };

      if (resultMrRef.current) {
        resultMrRef.current.currentTime = 0;
        resultMrRef.current.volume = 0.5; 
        resultMrRef.current.play();
      }

      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          resultMrRef.current?.pause();
        }
      }, 30000); 

    } catch (err) {
      alert("마이크 권한이 필요합니다. 설정에서 마이크를 허용해주세요!");
      setRecordingStep('IDLE');
    }
  };

  const uploadUserRecording = async (blob: Blob) => {
    setRecordingStep('UPLOADING');
    try {
      const storageRef = ref(storage, `ai_studio_audio/user_vocals_${Date.now()}.mp3`);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      
      setUserAudioUrl(downloadUrl); 
      setRecordingStep('FINISHED');
      addToast("✨ 우리 아기만의 특별한 동요가 완성되었습니다!");
    } catch (error) {
      alert("음원 저장에 실패했습니다. 다시 시도해주세요.");
      setRecordingStep('IDLE');
    }
  };

  const toggleFinalAudio = () => {
    const vocal = resultVocalRef.current;
    const mr = resultMrRef.current;
    if (!vocal || !mr || !userAudioUrl || !weeklyMr.url) return;

    if (isPlaying) {
      vocal.pause(); mr.pause(); setIsPlaying(false);
    } else {
      mr.volume = 0.4; vocal.volume = 1.0;
      mr.currentTime = 0; vocal.currentTime = 0;
      const playVocal = vocal.play(); const playMr = mr.play();

      Promise.all([playVocal, playMr]).then(() => {
        setIsPlaying(true);
        vocal.onended = () => { setIsPlaying(false); mr.pause(); mr.currentTime = 0; };
      }).catch(() => setIsPlaying(false));
    }
  };

  // 🔗 스마트폰 네이티브 공유 창 열기 (카톡 공유 및 파일 저장 가능)
  const handleShare = async () => {
    // 💡 [수정] generatedAudio 대신 유저가 녹음한 userAudioUrl 사용
    if (!userAudioUrl) return;

    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      alert("✅ 카카오톡/다운로드 창을 엽니다!"); // 디버깅용 확인창
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SHARE',
        url: userAudioUrl,
        title: `${babyName} 헌정송 💿`,
        text: `엄마 아빠가 직접 부른 ${babyName}의 동요입니다! 들어보세요.`
      }));
      return;
    }

    // 💻 2. 모바일 웹페이지 환경일 때: 웹 표준 공유 기능(Web Share API) 작동
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${babyName} 헌정송 💿`,
          text: `우리 아이만을 위한 AI 동요가 발매되었습니다! 지금 들어보세요.`,
          url: generatedAudio,
        });
      } catch (err) {
        // 공유 취소 시 에러 방지
      }
    } else {
      // 🖥️ PC 등 미지원 브라우저일 때는 클립보드 링크 복사로 대체
      try {
        await navigator.clipboard.writeText(generatedAudio);
        addToast("📋 음원 다운로드 링크가 복사되었습니다!");
      } catch (err) {
        alert("링크 복사에 실패했습니다. 주소를 직접 복사해주세요.");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F5F7FF] text-slate-900 z-[2000] overflow-y-auto font-sans break-keep">
      <nav className="px-5 py-4 flex items-center justify-between bg-white/90 backdrop-blur sticky top-0 border-b border-indigo-100 z-50">
        <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition-transform"><ChevronLeft size={28} className="text-indigo-600"/></button>
        <h1 className="font-black text-[17px] text-indigo-900">🎵 우리 아이 AI 동요</h1>
        <div className="w-8"></div>
      </nav>

      <div className="p-6 pb-32 max-w-md mx-auto">
        {loading ? (
          <div className="py-32 text-center animate-fade-in">
            <div className="w-20 h-20 bg-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce shadow-xl shadow-indigo-500/30">
                <Music size={40} className="text-white" />
            </div>
            {/* 💡 로딩 문구를 단계별로 다르게 보여주기 위한 꿀팁! */}
            <h2 className="text-xl font-black text-indigo-900 leading-snug">
              {step === 1 ? "AI 작사가가 고민 중입니다..." : "AI가 가이드 곡을 만들고 있습니다..."}
            </h2>
          </div>
        ) : step === 1 ? (

          <div className="space-y-6 animate-fade-in">
            {/* 1️⃣ 주간 테마 및 미리듣기 */}
            <div className="bg-indigo-900 text-white p-6 rounded-[1.5rem] shadow-xl relative overflow-hidden border border-indigo-400/30">
                <div className="absolute -right-4 -top-4 text-8xl opacity-10 rotate-12">🎹</div>
                <div className="flex items-center gap-2 mb-2 relative z-10">
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">LIMITED</span>
                    <span className="text-[11px] font-black text-indigo-300 tracking-widest uppercase">Weekly Special</span>
                </div>
                <h2 className="text-[18px] font-black leading-tight relative z-10 mb-4">
                    이번 주 테마:<br/> <span className="text-yellow-300">「 {weeklyMr.theme} 」</span>
                </h2>
                <button onClick={togglePreview} className={`relative z-10 flex items-center justify-center gap-2 w-full py-3 rounded-xl backdrop-blur-md transition-all active:scale-95 font-bold text-sm ${isPreviewPlaying ? 'bg-indigo-500 text-white border border-indigo-400' : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/20'}`}>
                  {isPreviewPlaying ? <Square fill="currentColor" size={16}/> : <Play fill="currentColor" size={16} className="ml-0.5"/>}
                  {isPreviewPlaying ? '미리듣기 정지' : '이 멜로디 틀어놓고 작사하기'}
                </button>
            </div>

            {/* 2️⃣ 태명 입력 */}
            <div className="bg-white p-5 rounded-[1.2rem] border border-indigo-100 shadow-sm mt-4">
                <h3 className="font-bold text-[15px] mb-3 text-slate-700 flex items-center gap-2"><span className="text-lg">👶</span> 주인공 태명은?</h3>
                <input type="text" placeholder="예) 스웨그 찰떡이" value={babyName} onChange={e=>setBabyName(e.target.value)} className="w-full p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 font-bold focus:border-indigo-500 outline-none text-[15px] transition-colors"/>
            </div>

            {/* 3️⃣ 매력 포인트 입력 */}
            <div className="bg-white p-5 rounded-[1.2rem] border border-indigo-100 shadow-sm">
              <h3 className="font-bold text-[15px] mb-1 text-slate-700 flex items-center gap-2"><span className="text-lg">✍️</span> 아기 매력포인트?</h3>
              <textarea value={charmPoints} onChange={e=>setCharmPoints(e.target.value)} placeholder="예) 오똑한 코, 발차기 대장" className="w-full h-24 p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 font-bold focus:border-indigo-500 outline-none resize-none text-[15px] leading-relaxed transition-colors"/>
            </div>

            {/* 4️⃣ 유행어 입력 */}
            <div className="bg-white p-5 rounded-[1.2rem] border border-indigo-100 shadow-sm mt-0">
              <h3 className="font-bold text-[15px] mb-1 text-slate-700">Q3. 후렴구에 반복될 '우리 유행어'는?</h3>
              <textarea value={catchphrase} onChange={e=>setCatchphrase(e.target.value)} placeholder="예) 둥기둥기, 으랏차차 내새끼" className="w-full h-24 p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 font-bold focus:border-indigo-500 outline-none resize-none text-[15px] leading-relaxed transition-colors"/>
            </div>
            
            {/* 💡 [핵심] 이제 이 버튼을 누르면 handleGenerateLyrics(작사 API)가 실행되고 Step 2로 넘어갑니다! */}
            <button 
              disabled={!babyName || !charmPoints || !catchphrase} 
              onClick={handleGenerateLyrics} 
              className="w-full p-5 bg-indigo-600 text-white rounded-xl font-black text-[16px] shadow-lg shadow-indigo-600/30 active:scale-95 disabled:bg-slate-300 transition-all"
            >
              ✍️ AI 동요 작사하기
            </button>
          </div>

        ) : step === 2 ? (
          
          <div className="space-y-6 animate-fade-in mt-4">
            <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-xl border border-slate-700">
              <h3 className="font-black text-lg mb-4 text-pink-400 flex items-center gap-2">📜 완성된 맞춤 가사</h3>
              <div className="max-h-60 overflow-y-auto pr-2">
                {generatedText.split('\n').filter(l=>l.trim()).map((line, i) => (
                  <p key={i} className="text-[16px] font-bold text-slate-200 leading-relaxed mb-2 break-keep">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
                <button onClick={()=>setStep(1)} className="flex-[1] py-5 bg-indigo-100 text-indigo-700 rounded-xl font-black text-[15px] active:scale-95 transition-transform">
                  다시 쓰기
                </button>
                {/* 💡 [핵심] 이 버튼을 누르면 handleStartAd가 실행되어 광고가 뜨고 가이드 곡을 만듭니다! */}
                <button onClick={handleStartAd} className="flex-[2.3] py-5 px-1 bg-indigo-600 text-white rounded-xl font-black text-[14px] sm:text-[15px] shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform">
                  🎥 30초 광고보고 노래 만들기
                </button>
            </div>
          </div>

        ) : (
          <div className="animate-fade-in text-center mt-4">
            
            {/* 1️⃣ 대기(가이드 듣기) 화면 */}
            {recordingStep === 'IDLE' && (
              <div className="space-y-6">
                <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                  <span className="bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded-full mb-3 inline-block">10초 가이드 곡</span>
                  <h3 className="text-xl font-black mb-2">아 이런 느낌의 동요구나! 🎧</h3>
                  <p className="text-sm text-indigo-200 mb-6 break-keep">AI가 만든 10초짜리 가이드 멜로디를 먼저 들어보시고, 분위기를 익혀보세요.</p>
                  
                  {generatedAudio && (
                    <audio controls src={generatedAudio} className="w-full rounded-xl" />
                  )}
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mic2 size={32} className="text-pink-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">직접 녹음할 준비 되셨나요?</h3>
                  <p className="text-sm text-slate-500 mb-6 break-keep">30초 동안 뒷배경에 신나는 MR이 깔립니다. 화면에 나오는 가사를 보고 노래방처럼 불러주세요!</p>
                  
                  <button onClick={startRecordingFlow} className="w-full p-4 bg-pink-500 text-white rounded-xl font-black text-lg shadow-lg shadow-pink-500/30 active:scale-95 transition-transform">
                    🔴 우리 아기를 위해 녹음 시작
                  </button>
                </div>
              </div>
            )}

            {/* 2️⃣ 카운트다운 화면 */}
            {recordingStep === 'COUNTDOWN' && (
              <div className="flex flex-col items-center justify-center py-20">
                <motion.div key={countdown} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} className="text-8xl font-black text-pink-500">
                  {countdown}
                </motion.div>
                <p className="text-slate-500 mt-10 font-bold">목청을 가다듬고 준비하세요! 🎤</p>
              </div>
            )}

            {/* 3️⃣ 녹음 중 (가사판) 화면 */}
            {recordingStep === 'RECORDING' && (
              <div className="w-full space-y-6 py-4">
                <div className="flex items-center justify-center gap-2 text-red-500 font-black animate-pulse text-xl bg-red-50 py-2 rounded-full w-48 mx-auto border border-red-100">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div> 녹음 중...
                </div>

                <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 max-h-80 overflow-y-auto shadow-inner text-center relative">
                  {generatedText.split('\n').filter(l=>l.trim()).map((line, i) => (
                    <p key={i} className="text-[17px] font-black text-white leading-relaxed mb-4 break-keep">
                      {line}
                    </p>
                  ))}
                </div>
                <p className="text-sm text-slate-500 font-bold">👶 반주에 맞춰 아기에게 사랑을 전해주세요 (최대 30초)</p>
                
                {/* 💡 일찍 끝내기 버튼 */}
                <button onClick={() => {
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                    mediaRecorderRef.current.stop();
                    resultMrRef.current?.pause();
                  }
                }} className="px-6 py-3 bg-slate-200 text-slate-600 rounded-full font-bold text-sm active:scale-95">
                  녹음 일찍 끝내기 ⏹️
                </button>
              </div>
            )}

            {/* 4️⃣ 업로드(믹싱) 중 화면 */}
            {recordingStep === 'UPLOADING' && (
              <div className="py-32 flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-6"></div>
                <h3 className="font-black text-lg text-slate-700">목소리와 반주를 예쁘게 합치는 중...</h3>
              </div>
            )}

            {/* 5️⃣ 최종 완성 화면 */}
            {recordingStep === 'FINISHED' && (
              <div className="bg-white p-6 rounded-[2rem] shadow-2xl border border-indigo-50 relative">
                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-black mb-4 inline-block">완성된 우리 아기 동요 💿</span>
                <h3 className="font-black text-2xl text-slate-800 mb-8">{babyName} 헌정송</h3>
                
                <div className="relative w-32 h-32 mx-auto mb-8">
                  <div className={`w-full h-full bg-slate-900 rounded-full flex items-center justify-center shadow-xl ${isPlaying ? 'animate-spin-slow' : ''}`}>
                      <div className="w-10 h-10 bg-pink-500 rounded-full border-4 border-slate-800 flex items-center justify-center"><Mic2 className="text-white" size={16}/></div>
                  </div>
                  <button onClick={toggleFinalAudio} className="absolute inset-0 m-auto w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/30 hover:scale-105 active:scale-95 transition-transform">
                    {isPlaying ? <Square size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-1"/>}
                  </button>
                </div>

                <button onClick={handleShare} className="w-full mt-2 p-4 bg-yellow-400 text-amber-950 rounded-xl font-black shadow-md text-[16px] flex items-center justify-center gap-2 active:scale-95 transition-transform">
                  💬 카카오톡 / 폰에 저장하기
                </button>
                
                <button onClick={()=>{setRecordingStep('IDLE'); setIsPlaying(false);}} className="w-full mt-3 p-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-[14px] active:scale-95 transition-transform">
                  다시 녹음하기 🎤
                </button>
              </div>
            )}

          </div>
        )}
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>

      <audio ref={previewAudioRef} preload="auto" playsInline />
      <audio ref={resultMrRef} preload="auto" playsInline />
      <audio ref={resultVocalRef} preload="auto" playsInline />
    </div>
  );
};
export default AISongStudio;