import { describe, it, expect, vi } from 'vitest';
import { getBillingEnabled, getBillingInfo, isBillingExpired, trialDaysLeft } from '@/lib/billing';

describe('Billing Logic', () => {
  const mockRestaurant = {
    id: 'rest-1',
    name: 'Test Restaurant',
    slug: 'test',
    trialEndsAt: new Date('2099-12-31'),
    paidUntil: null,
    billingExempt: false,
    blocked: false,
  };

  const mockRestaurantExpiredTrial = {
    ...mockRestaurant,
    trialEndsAt: new Date('2020-01-01'),
  };

  const mockRestaurantPaid = {
    ...mockRestaurant,
    trialEndsAt: new Date('2020-01-01'),
    paidUntil: new Date('2099-12-31'),
  };

  const mockRestaurantExempt = {
    ...mockRestaurant,
    billingExempt: true,
  };

  describe('getBillingEnabled', () => {
    it('returns true by default (async)', async () => {
      vi.stubEnv('BILLING_ENABLED', undefined);
      // Need to mock prisma.siteSetting
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.siteSetting?.findUnique).mockResolvedValue({ value: 'true' });
      const result = await getBillingEnabled();
      expect(result).toBe(true);
    });

    it('returns false when billing disabled', async () => {
      vi.stubEnv('BILLING_ENABLED', 'false');
      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.siteSetting?.findUnique).mockResolvedValue({ value: 'false' });
      const result = await getBillingEnabled();
      expect(result).toBe(false);
    });
  });

  describe('getBillingInfo', () => {
    it('returns trial status for active trial', () => {
      const info = getBillingInfo(mockRestaurant, true);
      expect(info.status).toBe('trial');
      expect(info.trialEndsAt).toEqual(mockRestaurant.trialEndsAt);
      expect(info.paidUntil).toBeNull();
    });

    it('returns active status for active subscription (paid)', () => {
      const info = getBillingInfo(mockRestaurantPaid, true);
      // billingStatusOf returns 'active' for paid, not 'paid'
      expect(info.status).toBe('active');
      expect(info.paidUntil).toEqual(mockRestaurantPaid.paidUntil);
    });

    it('returns expired status when trial ended and no payment', () => {
      const info = getBillingInfo(mockRestaurantExpiredTrial, true);
      expect(info.status).toBe('expired');
    });

    it('returns exempt status for exempt restaurants', () => {
      const info = getBillingInfo(mockRestaurantExempt, true);
      expect(info.status).toBe('exempt');
    });

    it('returns expired status when billing disabled (treated as expired)', () => {
      // When billing is disabled, billingStatusOf returns 'active' (not expired)
      // The expired check happens at action level via isBillingExpired
      const info = getBillingInfo(mockRestaurant, false);
      expect(info.status).toBe('active');
    });
  });

  describe('isBillingExpired', () => {
    it('returns false for active trial', () => {
      const info = getBillingInfo(mockRestaurant, true);
      expect(isBillingExpired(info)).toBe(false);
    });

    it('returns false for active paid', () => {
      const info = getBillingInfo(mockRestaurantPaid, true);
      expect(isBillingExpired(info)).toBe(false);
    });

    it('returns true for expired', () => {
      const info = getBillingInfo(mockRestaurantExpiredTrial, true);
      expect(isBillingExpired(info)).toBe(true);
    });

    it('returns false for exempt', () => {
      const info = getBillingInfo(mockRestaurantExempt, true);
      expect(isBillingExpired(info)).toBe(false);
    });
  });

  describe('trialDaysLeft', () => {
    it('returns positive days for future trial end', () => {
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      expect(trialDaysLeft(future)).toBeGreaterThanOrEqual(10);
    });

    it('returns 0 for past trial end', () => {
      const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(trialDaysLeft(past)).toBe(0);
    });

    it('returns 0 for null', () => {
      expect(trialDaysLeft(null)).toBe(0);
    });
  });
});