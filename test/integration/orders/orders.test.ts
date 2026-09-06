import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrderAction, getOrdersAction, updateOrderStatusAction, staffUpdateOrderStatusAction, getStaffOrdersAction, loadOrders } from '@/lib/actions/orders';
import { prisma } from '@/lib/prisma';
import { getOwnerRestaurant } from '@/lib/data';
import { getStaffSession } from '@/lib/staff-session';
import { getBillingEnabled, getBillingInfo, isBillingExpired } from '@/lib/billing';

vi.mock('@/lib/prisma');
vi.mock('@/lib/data');
vi.mock('@/lib/staff-session');
vi.mock('@/lib/billing');

describe('Orders Actions - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRestaurant = {
    id: 'rest-1',
    slug: 'kafy',
    name: 'Kafy Restaurant',
    settings: {
      id: 'set-1',
      restaurantName: 'كافي',
      currency: 'EGP',
      themePrimary: '#C84C21',
      logoUrl: null,
      deliveryEnabled: true,
    },
    staffPin: '1234',
    blocked: false,
    trialEndsAt: new Date('2099-12-31'),
    paidUntil: null,
    billingExempt: false,
  };

  const mockMenuItems = [
    { id: 'item-1', name: 'شاورما', price: 100, discountPercentage: 0, sizes: [] },
    { id: 'item-2', name: 'بطاطس', price: 50, discountPercentage: 10, sizes: [] },
  ];

  const mockTables = [{ number: 1, reserved: false }, { number: 2, reserved: false }];

  describe('createOrderAction', () => {
    it('rejects dine-in without table number', async () => {
      const res = await createOrderAction({
        restaurantSlug: 'kafy',
        customerName: 'Test',
        type: 'dine-in',
        items: [{ itemId: 'item-1', qty: 1 }],
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('اختر رقم الطاولة');
    });

    it('rejects delivery without phone', async () => {
      const res = await createOrderAction({
        restaurantSlug: 'kafy',
        customerName: 'Test',
        type: 'delivery',
        items: [{ itemId: 'item-1', qty: 1 }],
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('رقم الهاتف');
    });

    it('rejects invalid phone format', async () => {
      const res = await createOrderAction({
        restaurantSlug: 'kafy',
        customerName: 'Test',
        type: 'delivery',
        phone: '123',
        items: [{ itemId: 'item-1', qty: 1 }],
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('رقم الهاتف غير صحيح');
    });

    it('calculates price from DB only (security)', async () => {
      vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(mockRestaurant);
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue(mockMenuItems);
      vi.mocked(prisma.table.findMany).mockResolvedValue(mockTables);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ nextval: 1 }]);
      vi.mocked(prisma.$transaction).mockResolvedValue([]);
      vi.mocked(prisma.order.deleteMany).mockResolvedValue({ count: 0 });

      const res = await createOrderAction({
        restaurantSlug: 'kafy',
        customerName: 'عميل',
        type: 'dine-in',
        tableNo: '1',
        items: [{ itemId: 'item-1', qty: 2 }, { itemId: 'item-2', qty: 1 }],
      });

      expect(res.ok).toBe(true);
      expect(res.data?.total).toBeGreaterThan(0);
      // item-1: 100 * 2 = 200, item-2: 50 * 0.9 = 45 * 1 = 45, total = 245
      expect(res.data?.total).toBe(245);
    });

    it('applies size pricing correctly', async () => {
      const itemsWithSizes = [
        { id: 'item-1', name: 'شاورما', price: 100, discountPercentage: 0, sizes: [{ sizeCode: 'L', price: 150 }] },
      ];
      vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(mockRestaurant);
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue(itemsWithSizes);
      vi.mocked(prisma.table.findMany).mockResolvedValue(mockTables);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ nextval: 1 }]);
      vi.mocked(prisma.$transaction).mockResolvedValue([]);
      vi.mocked(prisma.order.deleteMany).mockResolvedValue({ count: 0 });

      const res = await createOrderAction({
        restaurantSlug: 'kafy',
        customerName: 'عميل',
        type: 'dine-in',
        tableNo: '1',
        items: [{ itemId: 'item-1', qty: 1, sizeCode: 'L' }],
      });

      expect(res.ok).toBe(true);
      expect(res.data?.total).toBe(150);
    });

    it('rejects when items not available', async () => {
      vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(mockRestaurant);
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.table.findMany).mockResolvedValue(mockTables);

      const res = await createOrderAction({
        restaurantSlug: 'kafy',
        customerName: 'عميل',
        type: 'dine-in',
        tableNo: '1',
        items: [{ itemId: 'item-1', qty: 1 }],
      });

      expect(res.ok).toBe(false);
      expect(res.error).toContain('بعض العناصر غير متاحة');
    });
  });

  describe('loadOrders', () => {
    it('sorts orders by status then date', async () => {
      const mockOrders = [
        {
          id: 'o1', number: 1, type: 'dine-in', customerName: 'A', tableNo: '1', phone: null, address: null, notes: null,
          status: 'done', staffName: null, total: 100, createdAt: new Date('2024-01-01T10:00:00'),
          completedAt: new Date('2024-01-01T10:30:00'), items: [{ id: 'oi1', name: 'Item', price: 100, qty: 1, sizeCode: null, itemId: 'item-1' }],
        },
        {
          id: 'o2', number: 2, type: 'dine-in', customerName: 'B', tableNo: '2', phone: null, address: null, notes: null,
          status: 'new', staffName: null, total: 200, createdAt: new Date('2024-01-01T12:00:00'),
          completedAt: null, items: [{ id: 'oi2', name: 'Item', price: 200, qty: 1, sizeCode: null, itemId: 'item-1' }],
        },
        {
          id: 'o3', number: 3, type: 'dine-in', customerName: 'C', tableNo: '3', phone: null, address: null, notes: null,
          status: 'preparing', staffName: null, total: 300, createdAt: new Date('2024-01-01T11:00:00'),
          completedAt: null, items: [{ id: 'oi3', name: 'Item', price: 300, qty: 1, sizeCode: null, itemId: 'item-1' }],
        },
      ];

      vi.mocked(prisma.order.findMany)
        .mockResolvedValueOnce(mockOrders.filter(o => o.status !== 'done'))
        .mockResolvedValueOnce(mockOrders.filter(o => o.status === 'done'));
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue([{ id: 'item-1', imageUrl: 'https://supabase.co/img.jpg' }]);

      const result = await loadOrders('rest-1');

      expect(result[0].status).toBe('new');
      expect(result[1].status).toBe('preparing');
      expect(result[2].status).toBe('done');
      expect(result[0].number).toBe(2); // newest new first
      expect(result[2].number).toBe(1); // oldest done first
    });

    it('maps item images from MenuItem', async () => {
      const mockOrders = [{
        id: 'o1', number: 1, type: 'dine-in', customerName: 'A', tableNo: '1', phone: null, address: null, notes: null,
        status: 'new', staffName: null, total: 100, createdAt: new Date(),
        completedAt: null, items: [{ id: 'oi1', name: 'Item', price: 100, qty: 1, sizeCode: null, itemId: 'item-1' }],
      }];

      vi.mocked(prisma.order.findMany)
        .mockResolvedValueOnce(mockOrders)
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue([{ id: 'item-1', imageUrl: 'https://supabase.co/img.jpg' }]);

      const result = await loadOrders('rest-1');
      expect(result[0].items[0].imageUrl).toBe('https://supabase.co/img.jpg');
    });
  });

  describe('getOrdersAction (Admin)', () => {
    it('returns orders for authenticated owner', async () => {
      vi.mocked(getOwnerRestaurant).mockResolvedValue(mockRestaurant);
      vi.mocked(getBillingEnabled).mockResolvedValue(true);
      vi.mocked(getBillingInfo).mockReturnValue({ status: 'trial', trialEndsAt: mockRestaurant.trialEndsAt, paidUntil: null });
      vi.mocked(isBillingExpired).mockReturnValue(false);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue([]);

      const res = await getOrdersAction();
      expect(res.ok).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('rejects unauthenticated', async () => {
      vi.mocked(getOwnerRestaurant).mockResolvedValue(null);
      const res = await getOrdersAction();
      expect(res.ok).toBe(false);
      expect(res.error).toContain('غير مصرح');
    });

    it('rejects when billing expired', async () => {
      vi.mocked(getOwnerRestaurant).mockResolvedValue(mockRestaurant);
      vi.mocked(getBillingEnabled).mockResolvedValue(true);
      vi.mocked(getBillingInfo).mockReturnValue({ status: 'expired', trialEndsAt: new Date('2020-01-01'), paidUntil: null });
      vi.mocked(isBillingExpired).mockReturnValue(true);

      const res = await getOrdersAction();
      expect(res.ok).toBe(false);
      expect(res.error).toContain('انتهت الفترة المجانية');
    });
  });

  describe('updateOrderStatusAction', () => {
    it('updates order status and completedAt', async () => {
      vi.mocked(getOwnerRestaurant).mockResolvedValue(mockRestaurant);
      vi.mocked(getBillingEnabled).mockResolvedValue(true);
      vi.mocked(getBillingInfo).mockReturnValue({ status: 'trial', trialEndsAt: mockRestaurant.trialEndsAt, paidUntil: null });
      vi.mocked(isBillingExpired).mockReturnValue(false);
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 });

      const res = await updateOrderStatusAction('order-1', 'done');
      expect(res.ok).toBe(true);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', restaurantId: 'rest-1' },
        data: { status: 'done', completedAt: expect.any(Date) },
      });
    });

    it('rejects invalid status', async () => {
      const res = await updateOrderStatusAction('order-1', 'invalid' as any);
      expect(res.ok).toBe(false);
      expect(res.error).toContain('حالة غير صالحة');
    });

    it('returns not found when order does not exist', async () => {
      vi.mocked(getOwnerRestaurant).mockResolvedValue(mockRestaurant);
      vi.mocked(getBillingEnabled).mockResolvedValue(true);
      vi.mocked(getBillingInfo).mockReturnValue({ status: 'trial', trialEndsAt: mockRestaurant.trialEndsAt, paidUntil: null });
      vi.mocked(isBillingExpired).mockReturnValue(false);
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 });

      const res = await updateOrderStatusAction('order-1', 'done');
      expect(res.ok).toBe(false);
      expect(res.error).toContain('الطلب غير موجود');
    });
  });

  describe('getStaffOrdersAction', () => {
    it('returns orders for valid staff session', async () => {
      vi.mocked(getStaffSession).mockResolvedValue({ slug: 'kafy', name: 'أحمد' });
      vi.mocked(prisma.restaurant.findUnique).mockResolvedValue(mockRestaurant);
      vi.mocked(prisma.setting.findUnique).mockResolvedValue(mockRestaurant.settings);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.menuItem.findMany).mockResolvedValue([]);

      const res = await getStaffOrdersAction();
      expect(res.ok).toBe(true);
      expect(res.data?.restaurantName).toBe('كافي');
      expect(res.data?.staffName).toBe('أحمد');
      expect(res.data?.brand.currency).toBe('EGP');
    });

    it('rejects invalid session', async () => {
      vi.mocked(getStaffSession).mockResolvedValue(null);
      const res = await getStaffOrdersAction();
      expect(res.ok).toBe(false);
      expect(res.error).toContain('أعد الدخول');
    });

    it('rejects blocked restaurant', async () => {
      vi.mocked(getStaffSession).mockResolvedValue({ slug: 'kafy', name: 'أحمد' });
      vi.mocked(prisma.restaurant.findUnique).mockResolvedValue({ ...mockRestaurant, blocked: true });
      const res = await getStaffOrdersAction();
      expect(res.ok).toBe(false);
      expect(res.error).toContain('موقوف مؤقتًا');
    });
  });

  describe('staffUpdateOrderStatusAction', () => {
    it('updates status and records staff name', async () => {
      vi.mocked(getStaffSession).mockResolvedValue({ slug: 'kafy', name: 'أحمد' });
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 });

      const res = await staffUpdateOrderStatusAction('order-1', 'preparing');
      expect(res.ok).toBe(true);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', restaurant: { slug: 'kafy' } },
        data: { status: 'preparing', completedAt: null, staffName: 'أحمد' },
      });
    });

    it('sets completedAt when status is done', async () => {
      vi.mocked(getStaffSession).mockResolvedValue({ slug: 'kafy', name: 'أحمد' });
      vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 });

      const res = await staffUpdateOrderStatusAction('order-1', 'done');
      expect(res.ok).toBe(true);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', restaurant: { slug: 'kafy' } },
        data: { status: 'done', completedAt: expect.any(Date), staffName: 'أحمد' },
      });
    });
  });
});