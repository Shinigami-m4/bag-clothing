import type { ArtistId } from "./artists";

export type Product = {
  id: string;
  artist: ArtistId;
  name: string;
  image: string;
  priceCents: number;
  sizes: string[];
  description?: string;
  quantity?: number;
  images?: string[];
  isPublished?: boolean;
};

export const products: Product[] = [];

export function formatMoney(priceCents: number) {
  return (priceCents / 100).toFixed(2);
}
