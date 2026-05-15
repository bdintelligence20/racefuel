import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

/* --------------------------- shared types --------------------------- */

export interface AdminCheckResult {
  isAdmin: boolean;
  email?: string;
}

export interface DayPoint { date: string; value: number }

export interface AdminMetrics {
  rangeDays: number;
  totals: {
    usersCount: number;
    ordersCount: number;
    plansCount: number;
    feedbackCount: number;
    customProductsCount: number;
    ratingsCount: number;
    earlyAccessCount: number;
    siteFeedbackCount: number;
    revenueZAR: number;
    paidOrders: number;
  };
  series: {
    signupsByDay: DayPoint[];
    revenueByDay: DayPoint[];
    plansByDay: DayPoint[];
    feedbackByDay: DayPoint[];
    ordersByDay: DayPoint[];
  };
}

export interface AdminUserRow {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number | null;
  lastLoginAt: number | null;
  loginCount: number;
  provider: string | null;
  plans: number;
  feedback: number;
  ratings: number;
  customProducts: number;
  ordersCount: number;
  revenueZAR: number;
}

export interface AdminListUsersResult {
  users: AdminUserRow[];
  nextCursor: number | null;
}

export interface AdminUserDetail {
  uid: string;
  meta: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  strava: Record<string, unknown> | null;
  plans: Array<Record<string, unknown> & { id: string }>;
  feedback: Array<Record<string, unknown> & { id: string }>;
  ratings: Array<Record<string, unknown> & { id: string }>;
  customProducts: Array<Record<string, unknown> & { id: string }>;
  orders: Array<Record<string, unknown> & { id: string }>;
}

export interface AdminOrderRow extends Record<string, unknown> {
  id: string;
  status?: string;
  customer?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  amount?: { currency?: string; total?: number };
  lineItems?: Array<{ title?: string; quantity?: number; unitPrice?: number }>;
  createdAt?: number;
  updatedAt?: number;
  shopify?: { name?: string; orderNumber?: number; adminUrl?: string };
  failureReason?: string;
}

export interface AdminListOrdersResult {
  orders: AdminOrderRow[];
  nextCursor: number | null;
}

export interface AdminEarlyAccessRow extends Record<string, unknown> {
  id: string;
  name?: string;
  email?: string;
  sports?: string[];
  notes?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  createdAt?: number;
}

export interface AdminListEarlyAccessResult {
  rows: AdminEarlyAccessRow[];
  sportCounts: Record<string, number>;
  nextCursor: number | null;
  total: number;
}

export interface AdminSiteFeedbackRow extends Record<string, unknown> {
  id: string;
  message?: string;
  email?: string | null;
  displayName?: string | null;
  uid?: string | null;
  path?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  createdAt?: number;
}

export interface AdminListSiteFeedbackResult {
  rows: AdminSiteFeedbackRow[];
  nextCursor: number | null;
  total: number;
}

export interface AdminProductInsights {
  ratingsCount: number;
  customProductsCount: number;
  ratingHistogram: number[];
  topRated: Array<{
    productId: string;
    count: number;
    avgRating: number;
    avgGut: number;
    avgTaste: number;
  }>;
  topCustom: Array<{ count: number; brand: string; name: string; category?: string }>;
}

export interface AdminActivityInsights {
  rangeDays: number;
  feedbackCount: number;
  plansCount: number;
  avgOverallFeel: number;
  avgExecutionQuality: number;
  bonkRateAny: number;
  bonkRateSevere: number;
  gutBuckets: Record<string, number>;
  plannedCarbsAvg: number;
  actualCarbsAvg: number;
  actualCarbsCount: number;
  recent: Array<Record<string, unknown>>;
  topRoutes: Array<{
    routeName: string;
    count: number;
    distanceKm: number;
    avgElevation: number;
  }>;
}

export interface AdminListAdminsResult {
  seedAdmins: string[];
  admins: Array<{ email: string; addedAt: number | null; addedBy: string | null }>;
}

export type CouponType = 'percent' | 'fixed' | 'freeShipping';

export interface AdminCouponRow {
  code: string;
  type: CouponType;
  value: number;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
  minSubtotalZAR: number | null;
  startsAt: number | null;
  expiresAt: number | null;
  description: string | null;
  createdAt: number | null;
  createdBy: string;
}

export interface AdminListCouponsResult {
  rows: AdminCouponRow[];
}

export interface ValidateCouponResult {
  ok: boolean;
  reason?: string;
  code?: string;
  discount?: {
    code: string;
    type: CouponType;
    value: number;
    amountOffSubtotalZAR: number;
    freeShipping: boolean;
    description: string | null;
  };
}

/* ----------------------------- callables ---------------------------- */

const callableUnwrap = <Args, Result>(name: string) => {
  const fn = httpsCallable<Args, Result>(functions, name);
  return async (args?: Args): Promise<Result> => {
    const res = await fn(args ?? ({} as Args));
    return res.data;
  };
};

export const adminCheck = callableUnwrap<void, AdminCheckResult>('adminCheck');

export const adminMetrics = callableUnwrap<{ rangeDays?: number }, AdminMetrics>('adminMetrics');

export const adminListUsers = callableUnwrap<
  { cursor?: number | null; limit?: number; search?: string; sortBy?: 'lastLoginAt' | 'createdAt' | 'loginCount' },
  AdminListUsersResult
>('adminListUsers');

export const adminGetUser = callableUnwrap<{ uid: string }, AdminUserDetail>('adminGetUser');

export const adminListOrders = callableUnwrap<
  { cursor?: number | null; limit?: number; status?: string; search?: string },
  AdminListOrdersResult
>('adminListOrders');

export const adminListEarlyAccess = callableUnwrap<
  { cursor?: number | null; limit?: number; search?: string },
  AdminListEarlyAccessResult
>('adminListEarlyAccess');

export const adminListSiteFeedback = callableUnwrap<
  { cursor?: number | null; limit?: number; search?: string },
  AdminListSiteFeedbackResult
>('adminListSiteFeedback');

export const adminProductInsights = callableUnwrap<void, AdminProductInsights>('adminProductInsights');

export const adminActivityInsights = callableUnwrap<{ rangeDays?: number }, AdminActivityInsights>(
  'adminActivityInsights'
);

export const adminListAdmins = callableUnwrap<void, AdminListAdminsResult>('adminListAdmins');

export const adminAddAdmin = callableUnwrap<{ email: string }, { ok: boolean }>('adminAddAdmin');

export const adminRemoveAdmin = callableUnwrap<{ email: string }, { ok: boolean }>('adminRemoveAdmin');

export const validateCoupon = callableUnwrap<
  { code: string; subtotalZar: number },
  ValidateCouponResult
>('validateCoupon');

export const adminListCoupons = callableUnwrap<
  { activeOnly?: boolean } | void,
  AdminListCouponsResult
>('adminListCoupons');

export const adminUpsertCoupon = callableUnwrap<
  {
    code: string;
    type: CouponType;
    value?: number;
    active?: boolean;
    usageLimit?: number | null;
    minSubtotalZAR?: number | null;
    startsAt?: number | null;
    expiresAt?: number | null;
    description?: string | null;
  },
  { ok: boolean; code: string }
>('adminUpsertCoupon');

export const adminDeleteCoupon = callableUnwrap<{ code: string }, { ok: boolean }>('adminDeleteCoupon');

export interface AdminPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  author: string;
  tags: string[];
  readingMinutes: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  publishedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export const adminListPosts = callableUnwrap<void, { rows: AdminPostRow[] }>('adminListPosts');

export const adminGetPost = callableUnwrap<{ id: string }, AdminPostRow>('adminGetPost');

export const adminUpsertPost = callableUnwrap<
  {
    id?: string | null;
    slug: string;
    title: string;
    excerpt?: string | null;
    body: string;
    coverImageUrl?: string | null;
    author?: string;
    tags?: string[];
    readingMinutes?: number | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    published?: boolean;
    publishedAt?: number | null;
  },
  { ok: boolean; id: string; slug: string }
>('adminUpsertPost');

export const adminDeletePost = callableUnwrap<{ id: string }, { ok: boolean }>('adminDeletePost');
