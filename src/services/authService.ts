import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
// 🔥 [주의] 프로젝트 환경에 맞게 firebase 초기화 파일을 import 해주세요 (예: '../firebase')
import { db } from '../firebase'; 
import { User } from '../types';

const USER_KEY = 'bomiom_user';

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const logoutUser = async () => { 
  localStorage.removeItem(USER_KEY);
  
  try {
    const auth = getAuth();
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (error) {
    console.error("파이어베이스 로그아웃 에러:", error);
  }

  window.location.reload();
};

// ✅ [수정] 브라우저(로컬) + 파이어베이스(서버) 동시 업데이트!
export const updateUserAddress = async (address: string) => {
  const user = getCurrentUser();
  if (user && user.id) {
    // 1. 화면에 즉시 반영되도록 브라우저 로컬 스토리지 업데이트 (체감 속도 0.01초)
    const updatedUser = { ...user, address };
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

    // 2. 백그라운드에서 파이어베이스 업데이트 (앱 삭제 후 다시 깔아도 주소 유지!)
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { address });
    } catch (error) {
      console.error("파이어베이스 주소 업데이트 실패:", error);
    }

    return updatedUser;
  }
  return null;
};

// ✅ [강력 추천 신규 기능] 파이어베이스에서 최신 유저 정보를 가져와서 로컬에 덮어쓰기
// (카카오 로그인 성공 직후나, 앱 첫 로딩 시 호출해주면 데이터가 절대 안 꼬입니다!)
export const syncUserWithFirebase = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const userData = { id: snap.id, ...snap.data() } as User;
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      return userData;
    }
  } catch (error) {
    console.error("유저 정보 파이어베이스 동기화 실패:", error);
  }
  return null;
};