import React from 'react';
import { CategoryType, CategoryOption } from '../types';

interface Props {
  selected: CategoryType;
  onSelect: (category: CategoryType) => void;
  badges?: Record<string, { hasNew: boolean; hasUpdate: boolean }>;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'ALL', label: '전체' },
  { id: 'FREE', label: '🎁 바로 받기' },
  { id: 'DISCOUNT', label: '💸 할인/쿠폰' },
  { id: 'PACKAGE', label: '📦 패키지' },
  { id: 'LIFESTYLE', label: '🧴 생활·뷰티' },
  { id: 'SUBSCRIPTION', label: '📱 가입형' },
  { id: 'FINANCE', label: '🧾 보험·금융' },
];

export const CategoryFilter: React.FC<Props> = ({ selected, onSelect, badges = {} }) => {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto">
        <div className="flex overflow-x-auto py-3 px-4 no-scrollbar gap-2">
          {CATEGORIES.map((cat) => {
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`relative whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${selected === cat.id ? 'bg-rose-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};