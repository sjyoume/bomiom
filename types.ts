export type BenefitSource = 'GOV_NATIONAL' | 'GOV_LOCAL' | 'PRIVATE';

export type CategoryType = 
  | 'ALL' 
  | 'GOV' 
  | 'FREE' 
  | 'DISCOUNT' 
  | 'PACKAGE' 
  | 'LIFESTYLE' 
  | 'SUBSCRIPTION' 
  | 'FINANCE';

export interface Benefit {
  id: string;
  title: string;
  description: string;
  source: BenefitSource;
  tags: string[]; // e.g., "무료", "바우처", "할인"
  category: CategoryType;
  regionTarget?: string; // If undefined, it's national. If defined, it's local.
  ctaLink: string;
  isRecommended?: boolean; // For private benefits
  lastUpdated?: string; // Date string YYYY.MM.DD
  updateType?: 'NEW' | 'UPDATE'; // Explicitly mark as New or Updated
  likeCount?: number; // Count for "Likes" (My region)
  envyCount?: number; // Count for "Envy" (Other regions)
}

export interface CategoryOption {
  id: CategoryType;
  label: string;
  icon?: string;
}

export interface User {
  id: string;
  nickname: string;
  email?: string; // Mock email from social login
  dueDate?: string;
  address?: string; // Registered resident address
  privacyAgreed: boolean;
}