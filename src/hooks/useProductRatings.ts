import { useState, useEffect, useCallback } from 'react';
import { addProductRating, getAverageProductRating, getProductRatings, deleteProductRating, ProductRating } from '../persistence/db';

interface AverageRating {
  rating: number;
  count: number;
}

export function useProductRatings(productId: string) {
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [average, setAverage] = useState<AverageRating | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [allRatings, avg] = await Promise.all([
      getProductRatings(productId),
      getAverageProductRating(productId),
    ]);
    setRatings(allRatings);
    setAverage(avg);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRating = useCallback(async (data: { rating: number; gutComfort: number; taste: number; notes?: string; planId?: number }) => {
    await addProductRating({ productId, ...data });
    await refresh();
  }, [productId, refresh]);

  const removeRating = useCallback(async (id: number) => {
    await deleteProductRating(id);
    await refresh();
  }, [refresh]);

  return { ratings, average, loading, addRating, removeRating };
}
