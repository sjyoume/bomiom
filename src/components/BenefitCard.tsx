import React, { useState, useEffect } from 'react';
import { Benefit } from '../types';
import { ExternalLink, CheckCircle, Heart, MessageCircle, X } from 'lucide-react';
import { recordUserAction, incrementAppliedCount, incrementEnvyCount } from '../services/benefitService';
import confetti from 'canvas-confetti';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { getCurrentUser } from '../services/authService';
import { createPortal } from 'react-dom';

// 🔥 [신규 추가] 사용 TIP 팝업 모달 컴포넌트
const UsageTipModal = ({ benefit, onClose }: any) => {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = getCurrentUser(); // 로컬에 저장된 내 정보 가져오기

  // 파이어베이스 실시간 댓글 로드 (1.좋아요순 2.최신순)
  useEffect(() => {
    if (!benefit?.id || !db) return;
    const q = query(collection(db, 'benefit_comments'), where('benefitId', '==', benefit.id));
    const unsub = onSnapshot(q, (snap) => {
      let fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a: any, b: any) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      });
      setComments(fetched);
    });
    return () => unsub();
  }, [benefit?.id]);

  const handlePostComment = async () => {
    if (!currentUser) { alert('로그인 후 꿀팁을 남겨보세요! 🔒'); return; }
    if (newComment.trim().length < 5) { alert('5자 이상 유용한 팁을 적어주세요!'); return; }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'benefit_comments'), {
        benefitId: benefit.id,
        userId: currentUser.id,
        userNickname: currentUser.nickname || '봄이맘',
        content: newComment.trim(),
        likes: 0,
        likedBy: [], 
        createdAt: serverTimestamp()
      });
      setNewComment('');
      alert('산모님의 귀한 팁이 등록되었습니다! 💡');
    } catch (e) { alert('등록에 실패했습니다. 잠시 후 다시 시도해주세요.'); } 
    finally { setIsSubmitting(false); }
  };

  const handleToggleLike = async (commentId: string, currentLikes: number, likedBy: string[]) => {
    if (!currentUser) { alert('로그인 후 좋아요를 누를 수 있어요! 🔒'); return; }
    const commentRef = doc(db, 'benefit_comments', commentId);
    const hasLiked = likedBy.includes(currentUser.id);
    try {
      if (hasLiked) await updateDoc(commentRef, { likes: Math.max(0, currentLikes - 1), likedBy: likedBy.filter((id:string) => id !== currentUser.id) });
      else await updateDoc(commentRef, { likes: currentLikes + 1, likedBy: [...likedBy, currentUser.id] });
    } catch (e) { console.error("좋아요 에러", e); }
  };

  const bestComments = comments.filter(c => c.likes > 0).slice(0, 3);
  const normalComments = comments.filter(c => !bestComments.some(bc => bc.id === c.id));

  // 🔥 [수정] createPortal을 써서 카드의 애니메이션 감옥에서 팝업을 탈출시킵니다! 무조건 화면 정중앙 100% 보장!
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 z-20"><X size={24}/></button>
        
        {/* 상단: 구글 시트의 공식 팁 */}
        <div className="p-6 pb-4 bg-rose-50 border-b border-rose-100 shrink-0">
          <span className="text-[10px] font-black text-rose-500 bg-white px-2 py-1 rounded shadow-sm mb-2 inline-block">💡 이 혜택, 이렇게 써보세요!</span>
          <h3 className="font-black text-gray-900 text-base leading-snug break-keep mb-3 pr-6">{benefit.title}</h3>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-200">
            <p className="text-xs font-bold text-gray-800 leading-relaxed break-keep">
              <span className="text-rose-500 mr-1">"</span>
              {benefit.usageTip || "아직 공식 사용 팁이 등록되지 않았어요. 산모님만의 꿀팁을 먼저 남겨주세요!"}
              <span className="text-rose-500 ml-1">"</span>
            </p>
          </div>
        </div>

        {/* 중단: 실시간 유저 댓글 리스트 */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
          {bestComments.length > 0 && (
            <div>
              <h4 className="font-bold text-gray-800 text-[13px] mb-3 flex items-center gap-1.5"><span className="text-base">🏆</span> 베스트 꿀팁 Top 3</h4>
              <div className="space-y-3">
                {bestComments.map((c, i) => (
                  <div key={c.id} className="bg-yellow-50 p-3.5 rounded-2xl border border-yellow-200 shadow-sm relative">
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-yellow-400 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">{i+1}</div>
                    <div className="flex justify-between items-start mb-1.5 pl-3">
                      <span className="text-[11px] font-bold text-gray-700">{c.userNickname}</span>
                      <button onClick={() => handleToggleLike(c.id, c.likes, c.likedBy || [])} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${c.likedBy?.includes(currentUser?.id) ? 'bg-rose-500 text-white' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'}`}>
                        <Heart size={10} fill={c.likedBy?.includes(currentUser?.id) ? 'currentColor' : 'none'}/> {c.likes}
                      </button>
                    </div>
                    <p className="text-xs text-gray-800 leading-relaxed break-keep pl-3">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-bold text-gray-800 text-[13px] mb-3 flex items-center gap-1.5"><span className="text-base">💬</span> 실시간 유저 꿀팁</h4>
            <div className="space-y-3">
              {normalComments.map(c => (
                <div key={c.id} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[11px] font-bold text-gray-600">{c.userNickname}</span>
                    <button onClick={() => handleToggleLike(c.id, c.likes, c.likedBy || [])} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${c.likedBy?.includes(currentUser?.id) ? 'bg-rose-100 text-rose-500' : 'bg-white text-gray-400 border border-gray-200'}`}>
                      <Heart size={10} fill={c.likedBy?.includes(currentUser?.id) ? 'currentColor' : 'none'}/> {c.likes > 0 ? c.likes : '도움돼요'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed break-keep">{c.content}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">아직 작성된 꿀팁이 없어요.<br/>가장 먼저 팁을 공유해 보세요!</div>
              )}
            </div>
          </div>
        </div>

        {/* 하단: 댓글 입력창 */}
        <div className="p-4 border-t border-gray-100 bg-white shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.03)]">
          <div className="flex gap-2 w-full">
            <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="이 혜택, 어떻게 쓰면 좋을까요?" className="flex-1 min-w-0 w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-rose-400 box-border" />
            <button onClick={handlePostComment} disabled={!newComment.trim() || isSubmitting} className="shrink-0 whitespace-nowrap bg-gray-900 text-white px-4 rounded-xl font-bold text-xs shadow-md active:scale-95 disabled:bg-gray-300">
              {isSubmitting ? '...' : '팁 등록'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body // 🔥 이 부분이 포탈의 핵심입니다! 화면 최상단 body에 직접 박아버립니다.
  );
};

interface BenefitCardProps {
  benefit: Benefit;
  userId?: string;
  initialApplied?: boolean;
  initialEnvy?: boolean;
  showApply?: boolean;
  showEnvy?: boolean;
  rank?: number;
}

export const BenefitCard: React.FC<BenefitCardProps> = ({ 
  benefit, userId, initialApplied = false, initialEnvy = false, 
  showApply = true, showEnvy = false, rank 
}) => {
  const [isTipOpen, setIsTipOpen] = useState(false);
  const [isApplied, setIsApplied] = useState(initialApplied);
  const [isEnvy, setIsEnvy] = useState(initialEnvy);

  useEffect(() => {
    setIsApplied(initialApplied);
    setIsEnvy(initialEnvy);
  }, [initialApplied, initialEnvy]);

  const handleApply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !isApplied;
    if (newStatus) confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
    setIsApplied(newStatus);
    
    if (userId) await recordUserAction(userId, benefit.id, 'APPLY', newStatus);
    else {
      newStatus ? localStorage.setItem(`applied_${benefit.id}`, 'true') : localStorage.removeItem(`applied_${benefit.id}`);
    }
    
    // 🔥 파이어베이스 실시간 신청 카운트 업데이트 (누르면 +1, 취소하면 -1)
    if (benefit.id && db) {
      try {
        await setDoc(doc(db, 'benefit_stats', benefit.id), {
          appliedCount: increment(newStatus ? 1 : -1)
        }, { merge: true });
      } catch (error) {
        console.error('신청 카운트 업데이트 실패:', error);
      }
    }
  };

  const handleEnvy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !isEnvy;
    setIsEnvy(newStatus);
    setEnvyCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));
    
    if (userId) await recordUserAction(userId, benefit.id, 'ENVY', newStatus);
    else {
      newStatus ? localStorage.setItem(`envy_${benefit.id}`, 'true') : localStorage.removeItem(`envy_${benefit.id}`);
    }
    
    // 🔥 파이어베이스 실시간 부러워요 카운트 업데이트 (누르면 +1, 취소하면 -1)
    if (benefit.id && db) {
      try {
        await setDoc(doc(db, 'benefit_stats', benefit.id), {
          envyCount: increment(newStatus ? 1 : -1)
        }, { merge: true });
      } catch (error) {
        console.error('부러워요 카운트 업데이트 실패:', error);
      }
    }
  };

  const renderRankBadge = () => {
    if (!rank || rank > 3) return null;
    const colors = ['bg-[#FFD700] border-white', 'bg-[#C0C0C0] border-white', 'bg-[#CD7F32] border-white'];
    return (
      <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md z-20 border-2 ${colors[rank-1]}`}>
        {rank}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col relative transition-all hover:shadow-md h-full justify-between min-h-[220px]">
        {renderRankBadge()}
        
        <div>
          <div className="flex flex-wrap gap-1 mb-2">
            {benefit.source === 'GOV_NATIONAL' && <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded">전국 공통</span>}
            {benefit.source === 'PRIVATE' && <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-1 rounded">제휴/이벤트</span>}
            {benefit.source === 'GOV_LOCAL' && (
              <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded">
                {benefit.sido} {benefit.sigugun}
              </span>
            )}
            {benefit.tags.slice(0, 2).map((t, i) => (
              <span key={i} className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded">#{t}</span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            {benefit.updateType === 'NEW' && (
              <span className="shrink-0 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded shadow-sm leading-tight tracking-wider animate-pulse">
                NEW
              </span>
            )}
            {benefit.updateType === 'UPDATE' && (
              <span className="shrink-0 px-1.5 py-0.5 bg-blue-500 text-white text-[9px] font-black rounded shadow-sm leading-tight tracking-wider">
                UPDATE
              </span>
            )}
            <h3 className="font-bold text-gray-900 text-lg line-clamp-1 leading-tight">{benefit.title}</h3>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">{benefit.description}</p>
          
          <div className="bg-gray-50 rounded-xl p-3 mb-4">
            <p className="text-[10px] text-gray-600 font-bold mb-0.5">👤 지원 대상</p>
            <p className="text-[10px] text-gray-500 line-clamp-1">{benefit.eligibility || '상세 내용 확인'}</p>
          </div>
        </div>    

        <div className="flex gap-1.5 h-12 mt-auto pt-2">
          {/* 1. 공식 안내 버튼 (테두리 부활!) */}
          {benefit.ctaLink && (
            <button onClick={() => window.open(benefit.ctaLink, '_blank')} className="flex-1 bg-white text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold shadow-sm transition-colors">
              공식 안내 <ExternalLink size={14} />
            </button>
          )}

          {/* 2. 사용 TIP 버튼 (테두리 부활!) */}
          <button onClick={() => setIsTipOpen(true)} className="flex-1 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 hover:bg-rose-100 flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold shadow-sm transition-colors">
            <MessageCircle size={14} /> 사용TIP
          </button>

          {/* 3. 신청완료 버튼 (가운데 정렬 및 테두리 완벽 복구!) */}
          {showApply && (
            <button onClick={handleApply} className={`w-20 shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border ${isApplied ? 'bg-white border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
              <div className="flex items-center justify-center gap-1 w-full">
                <CheckCircle size={14} className={isApplied ? "text-green-500" : "text-gray-300"} />
                <span className={`text-xs font-bold ${isApplied ? "text-green-600" : "text-gray-400"}`}>
                  {benefit.appliedCount || 0}
                </span>
              </div>
              <span className={`text-[9px] w-full text-center ${isApplied ? "text-green-600" : "text-gray-400"}`}>신청완료</span>
            </button>
          )}

          {/* 4. 부러워요 버튼 (가운데 정렬 및 테두리 완벽 복구!) */}
          {showEnvy && (
            <button onClick={handleEnvy} className={`w-20 shrink-0 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border ${isEnvy ? 'bg-white border-rose-400 shadow-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
              <div className="flex items-center justify-center gap-1 w-full">
                <span className="text-xs">{isEnvy ? '💖' : '🤍'}</span>
                <span className={`text-xs font-bold ${isEnvy ? "text-rose-500" : "text-gray-400"}`}>
                  {benefit.envyCount || 0}
                </span>
              </div>
              <span className={`text-[9px] w-full text-center ${isEnvy ? "text-rose-500" : "text-gray-400"}`}>부러워요</span>
            </button>
          )}
        </div>
      </div>

      {isTipOpen && <UsageTipModal benefit={benefit} onClose={() => setIsTipOpen(false)} />}
    </>
  );
};