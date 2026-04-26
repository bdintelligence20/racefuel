// Mirror of the SPA's GpsPoint / NutritionPoint shapes — kept here so the renderer
// can be deployed without depending on the SPA's source tree at runtime.

export interface GpsPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface ProductInfo {
  id: string;
  name: string;
  brand: string;
  image: string;
  carbs: number;
  sodium: number;
  calories: number;
}

export interface NutritionPoint {
  id: string;
  distanceKm: number;
  product: ProductInfo;
}
