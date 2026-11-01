import { supabase } from '../supabase-config';
import type { User } from '../types';
import { cacheService } from './cacheService';

const USERS_TABLE = 'users';

export interface UserProfile extends Omit<User, 'id'> {
  phoneVerified?: boolean;
  lastLogin?: string;
  profileImageUrl?: string;
}

export class UserService {

  // ── Create user profile in Supabase (called after sign-up) ────────────────
  static async createUserProfile(userId: string, userData: Partial<UserProfile>): Promise<void> {
    try {
      const userProfile = {
        id: userId,                               // Supabase UUID = auth.users.id
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        phone_verified: userData.phoneVerified || false,
        role: userData.role || 'user',
        verified: true,
        saved_properties: [],
        viewing_history: [],
        last_login: new Date().toISOString(),
        profile_image_url: userData.profileImageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from(USERS_TABLE).insert(userProfile);
      if (error) throw new Error(error.message);
      console.log('User profile created:', userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  // ── Get user profile by Supabase UUID ─────────────────────────────────────
  static async getUserProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;   // no rows
        throw new Error(error.message);
      }

      return data ? UserService._rowToUser(data) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile');
    }
  }

  // ── Update user profile ────────────────────────────────────────────────────
  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      // Map camelCase JS fields to snake_case DB columns
      const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined)             dbUpdates.name = updates.name;
      if (updates.email !== undefined)            dbUpdates.email = updates.email;
      if (updates.phone !== undefined)            dbUpdates.phone = updates.phone;
      if (updates.role !== undefined)             dbUpdates.role = updates.role;
      if (updates.verified !== undefined)         dbUpdates.verified = updates.verified;
      if (updates.phoneVerified !== undefined)    dbUpdates.phone_verified = updates.phoneVerified;
      if (updates.savedProperties !== undefined)  dbUpdates.saved_properties = updates.savedProperties;
      if (updates.viewingHistory !== undefined)   dbUpdates.viewing_history = updates.viewingHistory;
      if (updates.profileImageUrl !== undefined)  dbUpdates.profile_image_url = updates.profileImageUrl;

      const { error } = await supabase.from(USERS_TABLE).update(dbUpdates).eq('id', userId);
      if (error) throw new Error(error.message);
      console.log('User profile updated:', userId);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  // ── Update last login timestamp ────────────────────────────────────────────
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await supabase.from(USERS_TABLE)
        .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw — login tracking is non-critical
    }
  }

  // ── Saved properties ───────────────────────────────────────────────────────
  static async addSavedProperty(userId: string, propertyId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) return;

      const savedProperties = userProfile.savedProperties || [];
      if (!savedProperties.includes(propertyId)) {
        await this.updateUserProfile(userId, { savedProperties: [...savedProperties, propertyId] });
        cacheService.invalidateOnChange('saved_properties', userId);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-user'));
          window.dispatchEvent(new CustomEvent('refresh-saved'));
        }, 100);
        console.log('Property saved for user:', userId);
      }
    } catch (error) {
      console.error('Error adding saved property:', error);
      throw new Error('Failed to save property');
    }
  }

  static async removeSavedProperty(userId: string, propertyId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) return;

      const savedProperties = (userProfile.savedProperties || []).filter(id => id !== propertyId);
      await this.updateUserProfile(userId, { savedProperties });
      cacheService.invalidateOnChange('saved_properties', userId);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refresh-user'));
        window.dispatchEvent(new CustomEvent('refresh-saved'));
      }, 100);
      console.log('Property removed for user:', userId);
    } catch (error) {
      console.error('Error removing saved property:', error);
      throw new Error('Failed to remove saved property');
    }
  }

  // ── Viewing history ────────────────────────────────────────────────────────
  static async addToViewingHistory(userId: string, propertyId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (!userProfile) return;

      const filtered = (userProfile.viewingHistory || []).filter(id => id !== propertyId);
      filtered.unshift(propertyId);
      await this.updateUserProfile(userId, { viewingHistory: filtered.slice(0, 50) });
    } catch (error) {
      console.error('Error adding to viewing history:', error);
      // Non-critical — don't throw
    }
  }

  // ── Phone verification ─────────────────────────────────────────────────────
  static async verifyPhoneNumber(userId: string): Promise<void> {
    await this.updateUserProfile(userId, { phoneVerified: true });
  }

  // ── Admin: list all users ──────────────────────────────────────────────────
  static async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []).map(UserService._rowToUser);
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get users');
    }
  }

  // ── Admin: get users by role ───────────────────────────────────────────────
  static async getUsersByRole(role: 'user' | 'agent' | 'admin'): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from(USERS_TABLE)
        .select('*')
        .eq('role', role)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []).map(UserService._rowToUser);
    } catch (error) {
      console.error('Error getting users by role:', error);
      throw new Error('Failed to get users by role');
    }
  }

  /**
   * Admin: create a user.
   * Note: Creating Supabase Auth users from the browser requires a backend call
   * because the service role key cannot be exposed to the client. This calls
   * the backend admin API endpoint POST /api/v1/admin/users.
   */
  static async createUser(userData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: 'user' | 'agent' | 'admin';
  }): Promise<string> {
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const json = await res.json() as { ok: boolean; data?: { id: string }; error?: string };
      if (!json.ok || !json.data?.id) throw new Error(json.error || 'Failed to create user');
      return json.data.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  // ── Admin: update role ─────────────────────────────────────────────────────
  static async updateUserRole(userId: string, newRole: 'user' | 'agent' | 'admin'): Promise<void> {
    await this.updateUserProfile(userId, { role: newRole });
  }

  // ── Admin: toggle verification ─────────────────────────────────────────────
  static async toggleUserVerification(userId: string): Promise<void> {
    const userProfile = await this.getUserProfile(userId);
    if (userProfile) {
      await this.updateUserProfile(userId, { verified: !userProfile.verified });
    }
  }

  // ── Admin: delete user (profile only — auth deletion needs backend) ────────
  static async deleteUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase.from(USERS_TABLE).delete().eq('id', userId);
      if (error) throw new Error(error.message);
      console.log('User profile deleted:', userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  // ── User statistics ────────────────────────────────────────────────────────
  static async getUserStats(): Promise<{
    totalUsers: number;
    totalAgents: number;
    totalAdmins: number;
    verifiedUsers: number;
    newUsersThisMonth: number;
  }> {
    try {
      const allUsers = await this.getAllUsers();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats = { totalUsers: 0, totalAgents: 0, totalAdmins: 0, verifiedUsers: 0, newUsersThisMonth: 0 };
      for (const u of allUsers) {
        if (u.role === 'user')  stats.totalUsers++;
        if (u.role === 'agent') stats.totalAgents++;
        if (u.role === 'admin') stats.totalAdmins++;
        if (u.verified)         stats.verifiedUsers++;
        if (new Date(u.created_at) >= startOfMonth) stats.newUsersThisMonth++;
      }
      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user statistics');
    }
  }

  // ── DB row → app User type mapper ─────────────────────────────────────────
  private static _rowToUser(row: Record<string, unknown>): User {
    return {
      id:              row.id as string,
      name:            (row.name as string) || '',
      email:           (row.email as string) || '',
      phone:           (row.phone as string) || '',
      role:            (row.role as User['role']) || 'user',
      created_at:      row.created_at as string,
      verified:        Boolean(row.verified),
      savedProperties: (row.saved_properties as string[]) || [],
      viewingHistory:  (row.viewing_history as string[]) || [],
      avatar_url:      (row.profile_image_url as string) || undefined,
    };
  }
}