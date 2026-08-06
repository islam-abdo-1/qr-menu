export type AdminItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
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
  settings: AdminSettings;
  categories: AdminCategory[];
};