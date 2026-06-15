import React from 'react';

export const Loading = () => (
  <div className="flex flex-col items-center justify-center py-20 min-h-[100dvh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mb-4"></div>
    <p className="text-gray-500 text-sm font-medium">혜택 정보를 불러오고 있습니다...</p>
  </div>
);