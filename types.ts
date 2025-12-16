export interface BusinessLead {
  id: string;
  name: string;
  phone: string;
  address: string;
  rating?: string;
  website?: string;
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
    uri: string;
    title: string;
  };
  maps?: {
    placeId?: string;
    uri?: string;
    title?: string;
  };
}