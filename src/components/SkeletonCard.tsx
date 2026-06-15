import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 h-full flex flex-col animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
      </div>
      <div className="h-6 w-3/4 bg-gray-200 rounded mb-3"></div>
      <div className="h-4 w-full bg-gray-100 rounded mb-2"></div>
      <div className="h-4 w-5/6 bg-gray-100 rounded mb-2"></div>
      <div className="h-4 w-2/3 bg-gray-100 rounded mb-4 flex-grow"></div>
      <div className="flex gap-2 mt-auto pt-4 border-t border-gray-50">
        <div className="h-10 flex-1 bg-gray-100 rounded-xl"></div>
        <div className="h-10 flex-1 bg-gray-100 rounded-xl"></div>
      </div>
    </div>
  );
};

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
};