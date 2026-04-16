import type { ArtistId } from "./artists";
import type { ProductCategory } from "./product-options";

export type SizeQuantities = Record<string, number>;

export type Product = {
  id: string;
  artist: ArtistId;
  category: ProductCategory;
  name: string;
  image: string;
  priceCents: number;
  sizes: string[];
  sizeQuantities?: SizeQuantities;
  description?: string;
  quantity?: number;
  images?: string[];
  isPublished?: boolean;
};

export const products: Product[] = [];

export function formatMoney(priceCents: number) {
  return (priceCents / 100).toFixed(2);
}
