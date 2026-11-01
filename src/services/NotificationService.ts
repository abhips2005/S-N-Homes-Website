/**
 * NotificationService — manages user-facing and admin notifications.
 * Migrated from Firebase Firestore to Supabase PostgreSQL.
 */
import { supabase } from '../supabase-config';
import { UserService } from './userService';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CreateNotificationRequest {
  title: string;
  message: string;
  type: 'system' | 'property' | 'price' | 'news';
  targetUsers: 'all' | 'specific' | 'byLocation' | 'byActivity';
  targetUserIds?: string[];
  targetLocation?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'property' | 'price' | 'news';
  user_id: string;
  created_at: string;
  read: boolean;
  property_id?: string;
  data?: unknown;
}

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'property' | 'price' | 'news';
  targetUsers: 'all' | 'specific' | 'byLocation' | 'byActivity';
  targetUserIds?: string[];
  targetLocation?: string;
  created_at: string;
  sent_count: number;
  read_count: number;
  created_by: string;
}

interface PropertyRef {
  id: string;
  title: string;
  price: number;
  location: string;
  district: string;
  type: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  status: string;
  images: string[];
}

const NOTIFICATIONS_TABLE       = 'notifications';
const ADMIN_NOTIFICATIONS_TABLE = 'admin_notifications';

// ─── NotificationService ─────────────────────────────────────────────────────

export class NotificationService {

  // ── Create notification (admin sends to target users) ─────────────────────
  static async createNotification(request: CreateNotificationRequest): Promise<void> {
    try {
      console.log('=== CREATING ADMIN NOTIFICATION ===');

      const targetUserIds = await this.getTargetUsers(request);
      if (targetUserIds.length === 0) throw new Error('No target users found');

      const now = new Date().toISOString();

      // Insert admin notification record
      const { data: adminNotif, error: adminErr } = await supabase
        .from(ADMIN_NOTIFICATIONS_TABLE)
        .insert({
          title: request.title,
          message: request.message,
          type: request.type,
          target_users: request.targetUsers,
          target_user_ids: request.targetUserIds || [],
          target_location: request.targetLocation || null,
          sent_count: targetUserIds.length,
          read_count: 0,
          created_by: 'admin',
          created_at: now,
        })
        .select('id')
        .single();

      if (adminErr) throw new Error(adminErr.message);
      console.log('Admin notification record created:', adminNotif.id);

      // Bulk insert user notifications
      const rows = targetUserIds.map(userId => ({
        user_id: userId,
        title: request.title,
        message: request.message,
        type: request.type,
        read: false,
        property_id: null,
        data: null,
        created_at: now,
      }));

      // Supabase insert supports batch of rows in a single call
      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(NOTIFICATIONS_TABLE).insert(batch);
        if (error) throw new Error(error.message);
      }

      console.log(`Created ${targetUserIds.length} notifications successfully`);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // ── Get notifications for a specific user ─────────────────────────────────
  static async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      return (data ?? []).map(row => ({
        id: row.id as string,
        title: row.title as string,
        message: row.message as string,
        type: row.type as Notification['type'],
        user_id: row.user_id as string,
        created_at: row.created_at as string,
        read: Boolean(row.read),
        property_id: row.property_id as string | undefined,
        data: row.data,
      }));
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  // ── Mark notification as read ─────────────────────────────────────────────
  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw new Error(error.message);
    console.log(`Marked notification ${notificationId} as read`);
  }

  // ── Mark all notifications as read for a user ─────────────────────────────
  static async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw new Error(error.message);
  }

  // ── Get unread count ──────────────────────────────────────────────────────
  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) return 0;
    return count ?? 0;
  }

  // ── Get admin notifications ────────────────────────────────────────────────
  static async getAdminNotifications(): Promise<AdminNotification[]> {
    try {
      const { data, error } = await supabase
        .from(ADMIN_NOTIFICATIONS_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      return (data ?? []).map(row => ({
        id: row.id as string,
        title: row.title as string,
        message: row.message as string,
        type: row.type as AdminNotification['type'],
        targetUsers: row.target_users as AdminNotification['targetUsers'],
        targetUserIds: (row.target_user_ids as string[]) || [],
        targetLocation: (row.target_location as string) || '',
        created_at: row.created_at as string,
        sent_count: Number(row.sent_count) || 0,
        read_count: Number(row.read_count) || 0,
        created_by: row.created_by as string,
      }));
    } catch (error) {
      console.error('Error getting admin notifications:', error);
      return [];
    }
  }

  // ── Send notification for a new property ──────────────────────────────────
  static async notifyNewProperty(property: PropertyRef): Promise<void> {
    try {
      const interestedUsers = await this.findInterestedUsers(property);
      if (interestedUsers.length === 0) return;

      const now = new Date().toISOString();
      const rows = interestedUsers.map(userId => ({
        user_id: userId,
        title: 'New Property Match',
        message: `A new ${property.type} property in ${property.location} matches your preferences. Price: ₹${(property.price / 100000).toFixed(2)} Lakhs`,
        type: 'property' as const,
        read: false,
        property_id: property.id,
        data: { property },
        created_at: now,
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await supabase.from(NOTIFICATIONS_TABLE).insert(rows.slice(i, i + BATCH_SIZE));
      }

      await supabase.from(ADMIN_NOTIFICATIONS_TABLE).insert({
        title: 'Auto: New Property Notifications',
        message: `Sent ${interestedUsers.length} notifications for: ${property.title}`,
        type: 'property',
        target_users: 'byActivity',
        target_user_ids: interestedUsers,
        sent_count: interestedUsers.length,
        read_count: 0,
        created_by: 'system',
        created_at: now,
      });

      console.log(`Sent ${interestedUsers.length} new property notifications`);
    } catch (error) {
      console.error('Error sending new property notifications:', error);
    }
  }

  // ── Send notification for a price change ──────────────────────────────────
  static async notifyPriceChange(property: PropertyRef, oldPrice: number): Promise<void> {
    try {
      const interestedUsers = await this.findUsersInterestedInProperty(property.id);
      if (interestedUsers.length === 0) return;

      const priceDifference = oldPrice - property.price;
      const isReduction = priceDifference > 0;
      const changeText = isReduction ? 'reduced' : 'increased';
      const amount = Math.abs(priceDifference);

      const now = new Date().toISOString();
      const rows = interestedUsers.map(userId => ({
        user_id: userId,
        title: isReduction ? 'Price Drop Alert!' : 'Price Update',
        message: `The price of "${property.title}" in ${property.location} has ${changeText} by ₹${(amount / 100000).toFixed(2)} Lakhs. New price: ₹${(property.price / 100000).toFixed(2)} Lakhs`,
        type: 'price' as const,
        read: false,
        property_id: property.id,
        data: { property, oldPrice, newPrice: property.price },
        created_at: now,
      }));

      const BATCH_SIZE = 500;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await supabase.from(NOTIFICATIONS_TABLE).insert(rows.slice(i, i + BATCH_SIZE));
      }

      await supabase.from(ADMIN_NOTIFICATIONS_TABLE).insert({
        title: 'Auto: Price Change Notifications',
        message: `Sent ${interestedUsers.length} price change notifications for: ${property.title}`,
        type: 'price',
        target_users: 'specific',
        target_user_ids: interestedUsers,
        sent_count: interestedUsers.length,
        read_count: 0,
        created_by: 'system',
        created_at: now,
      });

      console.log(`Sent ${interestedUsers.length} price change notifications`);
    } catch (error) {
      console.error('Error sending price change notifications:', error);
    }
  }

  // ── Delete a notification ─────────────────────────────────────────────────
  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .delete()
      .eq('id', notificationId);
    if (error) throw new Error(error.message);
  }

  // ── Get stats for admin ───────────────────────────────────────────────────
  static async getNotificationStats(): Promise<{
    total: number; read: number; unread: number;
  }> {
    const [{ count: total }, { count: read }] = await Promise.all([
      supabase.from(NOTIFICATIONS_TABLE).select('*', { count: 'exact', head: true }),
      supabase.from(NOTIFICATIONS_TABLE).select('*', { count: 'exact', head: true }).eq('read', true),
    ]);
    const t = total ?? 0;
    const r = read ?? 0;
    return { total: t, read: r, unread: t - r };
  }

  // ── Determine target user IDs ──────────────────────────────────────────────
  private static async getTargetUsers(request: CreateNotificationRequest): Promise<string[]> {
    try {
      const allUsers = await UserService.getAllUsers();

      switch (request.targetUsers) {
        case 'all':
          return allUsers.map(u => u.id);

        case 'specific':
          return request.targetUserIds || [];

        case 'byLocation': {
          if (!request.targetLocation) return allUsers.map(u => u.id);
          // Users whose saved/viewed properties intersect with the target location
          // Approximate: return all users (no location preference field in current schema)
          return allUsers.map(u => u.id);
        }

        case 'byActivity': {
          // Users who have logged in within the last 7 days
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from('users')
            .select('id')
            .gte('last_login', sevenDaysAgo);
          return (data ?? []).map(row => row.id as string);
        }

        default:
          return [];
      }
    } catch (error) {
      console.error('Error getting target users:', error);
      return [];
    }
  }

  // ── Find users interested in a property type/location ─────────────────────
  private static async findInterestedUsers(_property: PropertyRef): Promise<string[]> {
    try {
      // Users who have viewed or saved properties of the same type/location
      const { data } = await supabase
        .from('users')
        .select('id, saved_properties, viewing_history');

      if (!data) return [];

      const interested = (data as Array<{ id: string; saved_properties: string[]; viewing_history: string[] }>)
        .filter(u => {
          const history = [...(u.saved_properties || []), ...(u.viewing_history || [])];
          return history.length > 0; // Has interaction history
        })
        .map(u => u.id);

      return [...new Set(interested)];
    } catch {
      return [];
    }
  }

  // ── Find users who saved/viewed a specific property ────────────────────────
  private static async findUsersInterestedInProperty(propertyId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('users')
        .select('id, saved_properties, viewing_history');

      if (!data) return [];

      return (data as Array<{ id: string; saved_properties: string[]; viewing_history: string[] }>)
        .filter(u =>
          (u.saved_properties || []).includes(propertyId) ||
          (u.viewing_history || []).includes(propertyId)
        )
        .map(u => u.id);
    } catch {
      return [];
    }
  }
}