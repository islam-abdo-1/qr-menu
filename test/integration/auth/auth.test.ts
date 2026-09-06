import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInAction, registerRestaurantAction, signOutAction } from '@/lib/actions/auth';
import { getSiteSettings } from '@/lib/actions/auth';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/prisma');
vi.mock('@/lib/supabase/server');

describe('Auth Actions - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSupabase = {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  describe('signInAction', () => {
    it('successfully signs in with valid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' }, session: { access_token: 'token' } },
        error: null,
      });
      vi.mocked(prisma.restaurant.findFirst).mockResolvedValue({ id: 'rest-1', ownerId: 'user-1', slug: 'test' });

      const res = await signInAction('test@example.com', 'password123');
      expect(res.ok).toBe(true);
      expect(res.data?.user?.email).toBe('test@example.com');
    });

    it('rejects invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const res = await signInAction('test@example.com', 'wrong');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Invalid login credentials');
    });

    it('rejects when no restaurant linked', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' }, session: { access_token: 'token' } },
        error: null,
      });
      vi.mocked(prisma.restaurant.findFirst).mockResolvedValue(null);

      const res = await signInAction('test@example.com', 'password123');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('لا يوجد مطعم مرتبط');
    });
  });

  describe('registerRestaurantAction', () => {
    it('creates restaurant with valid data', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'user-new', email: 'new@example.com' }, session: { access_token: 'token' } },
        error: null,
      });
      vi.mocked(prisma.restaurant.create).mockResolvedValue({
        id: 'rest-new',
        slug: 'new-restaurant',
        name: 'مطعم جديد',
        ownerId: 'user-new',
        settings: { restaurantName: 'مطعم جديد' },
      });

      const res = await registerRestaurantAction({
        email: 'new@example.com',
        password: 'password123',
        restaurantName: 'مطعم جديد',
        slug: 'new-restaurant',
      });

      expect(res.ok).toBe(true);
      expect(res.data?.slug).toBe('new-restaurant');
    });

    it('rejects duplicate slug', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: 'user-new', email: 'new@example.com' }, session: { access_token: 'token' } },
        error: null,
      });
      vi.mocked(prisma.restaurant.create).mockRejectedValue(new Error('Unique constraint failed'));

      const res = await registerRestaurantAction({
        email: 'new@example.com',
        password: 'password123',
        restaurantName: 'مطعم جديد',
        slug: 'existing',
      });

      expect(res.ok).toBe(false);
    });

    it('rejects invalid email', async () => {
      const res = await registerRestaurantAction({
        email: 'invalid-email',
        password: 'password123',
        restaurantName: 'مطعم',
        slug: 'test',
      });
      expect(res.ok).toBe(false);
    });

    it('rejects short password', async () => {
      const res = await registerRestaurantAction({
        email: 'test@example.com',
        password: '123',
        restaurantName: 'مطعم',
        slug: 'test',
      });
      expect(res.ok).toBe(false);
    });
  });

  describe('signOutAction', () => {
    it('successfully signs out', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      const res = await signOutAction();
      expect(res.ok).toBe(true);
    });

    it('handles sign out error', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: { message: 'Sign out failed' } });
      const res = await signOutAction();
      expect(res.ok).toBe(false);
    });
  });

  describe('getSiteSettings', () => {
    it('returns cached settings on subsequent calls', async () => {
      const mockSettings = {
        restaurantName: 'مطعم تجريبي',
        currency: 'EGP',
        themePrimary: '#C84C21',
        logoUrl: null,
        deliveryEnabled: true,
      };
      vi.mocked(prisma.setting.findUnique).mockResolvedValue(mockSettings);

      const res1 = await getSiteSettings('rest-1');
      const res2 = await getSiteSettings('rest-1');

      expect(res1).toEqual(mockSettings);
      expect(res2).toEqual(mockSettings);
      expect(prisma.setting.findUnique).toHaveBeenCalledTimes(1); // cached
    });

    it('returns defaults when no settings', async () => {
      vi.mocked(prisma.setting.findUnique).mockResolvedValue(null);
      const res = await getSiteSettings('rest-1');
      expect(res.restaurantName).toBe('');
      expect(res.currency).toBe('EGP');
      expect(res.deliveryEnabled).toBe(true);
    });
  });
});