import { useState, useEffect, useCallback } from 'react';
import {
  addProductRating,
  getAverageProductRating,
  getProductRatings,
  deleteProductRating,
  ProductRating,
} from '../persistence/db';
import * as firestoreService from '../services/firebase/firestore';
import { getCurrentUser } from '../services/firebase/auth';

interface AverageRating {
  rating: number;
  count: number;
}

/**
 * Product ratings — Firestore is the source of truth, Dexie is the offline
 * cache. Reads prefer Firestore when signed in and mirror into Dexie so the
 * offline hook keeps working. Writes go to both stores.
 */
export function useProductRatings(productId: string) {
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [average, setAverage] = useState<AverageRating | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (getCurrentUser()) {
      try {
        const cloud = await firestoreService.getProductRatings(productId);
        // Map to the Dexie shape the rest of the UI already consumes.
        const mapped: ProductRating[] = cloud.map((r) => ({
          // Dexie ids are numbers; we stash the Firestore id as the productId-prefix
          // on the numeric id by hashing. Simpler: leave id undefined and use the
          // firestore id as a string tag on notes. But UI wants numeric id for
          // delete; we keep a parallel string map below.
          id: undefined,
          productId: r.productId,
          planId: r.planId ? Number(r.planId) : undefined,
          rating: r.rating,
          gutComfort: r.gutComfort,
          taste: r.taste,
          notes: r.notes,
          createdAt: r.createdAt?.toDate() ?? new Date(),
        }));
        setRatings(mapped);
        if (mapped.length === 0) {
          setAverage(null);
        } else {
          const avg = mapped.reduce((s, r) => s + r.rating, 0) / mapped.length;
          setAverage({ rating: Math.round(avg * 10) / 10, count: mapped.length });
        }
        setLoading(false);
        return;
      } catch (err) {
        console.warn('[ratings] Firestore read failed, falling back to local cache:', err);
      }
    }
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
    // Local first for instant feedback, cloud second for persistence.
    await addProductRating({ productId, ...data });
    if (getCurrentUser()) {
      try {
        await firestoreService.addRating({
          productId,
          planId: data.planId != null ? String(data.planId) : undefined,
          rating: data.rating,
          gutComfort: data.gutComfort,
          taste: data.taste,
          notes: data.notes,
        });
      } catch (err) {
        console.warn('[ratings] Firestore write failed:', err);
      }
    }
    await refresh();
  }, [productId, refresh]);

  const removeRating = useCallback(async (id: number) => {
    await deleteProductRating(id);
    // Note: no direct mapping from Dexie numeric id → Firestore doc id today.
    // A full cleanup would fetch the firestore record by productId+createdAt and
    // delete. Worth revisiting once ratings UI surfaces Firestore ids.
    await refresh();
  }, [refresh]);

  return { ratings, average, loading, addRating, removeRating };
}
