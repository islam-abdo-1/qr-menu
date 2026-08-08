export type AdminItemSize = {
  sizeCode: string;
  price: number;
};

export type AdminItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discountPercentage: number | null;
  sizes: AdminItemSize[];
  imageUrl: string | null;
  isAvailable: boolean;
};

export type AdminCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: AdminItem[];
};

export type AdminSettings = {
  id: number;
  restaurantName: string;
  currency: string;
  themePrimary: string;
  logoUrl: string | null;
};

export type AdminData = {
  restaurant: { id: string; slug: string; staffPin: string | null };
  settings: AdminSettings;
  categories: AdminCategory[];
};