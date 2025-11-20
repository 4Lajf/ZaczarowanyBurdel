export interface TagCollection {
  character?: string[];
  copyright?: string[];
  artist?: string[];
  general?: string[];
  meta?: string[];
  [key: string]: string[] | undefined;
}

export interface ImageRecord {
  imagePath: string;
  author: string;
  reactors: string[];
  tags: TagCollection;
  source?: string;
  sourceUrl?: string;
  similarity?: number;
}

export type Category = 'character' | 'copyright' | 'artist' | 'general' | 'meta';

export const CATEGORIES: Category[] = ['character', 'copyright', 'artist', 'general'];

export interface UserInteraction {
  userId: string;
  image: ImageRecord;
}

export interface TagStats {
  tag: string;
  count: number;
  category: Category;
}

export interface UserStats {
  userId: string;
  totalInteractions: number;
  categoryAffinity: Record<Category, number>;
}

