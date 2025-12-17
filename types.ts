export interface BusinessLead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  rating?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  winnerScore: number; // 0 a 100
}

export interface SearchState {
  niche: string;
  location: string;
  isLocating: boolean;
}

export interface SearchResponse {
  rawText: string;
  groundingChunks: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  maps?: {
    placeId?: string;
    uri?: string;
    title?: string;
  };
}

export interface SearchHistoryItem {
  niche: string;
  location: string;
  date: string;
}