import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser as deleteAuthUser
} from 'firebase/auth';
import { db, auth } from '../firebase-config';
import type { User } from '../types';
import { cacheService } from './cacheService';

// Collections
const USERS_COLLECTION = 'users';

export interface UserProfile extends Omit<User, 'id'> {
  phoneVerified?: boolean;
  lastLogin?: string;
  profileImageUrl?: string;
}

export class UserService {
  
  // Create user profile in Firestore (called after Firebase Auth registration)
  static async createUserProfile(userId: string, userData: Partial<UserProfile>): Promise<void> {
    try {
      const userProfile: UserProfile = {
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        phoneVerified: userData.phoneVerified || false,
        role: userData.role || 'user',
        created_at: serverTimestamp() as any,
        verified: true, // Email is verified through Firebase Auth
        savedProperties: [],
        viewingHistory: [],
        lastLogin: new Date().toISOString(),
        profileImageUrl: userData.profileImageUrl || ''
      };

      const docRef = doc(db, USERS_COLLECTION, userId);
      await setDoc(docRef, userProfile);
      console.log('User profile created:', userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw new Error('Failed to create user profile');
    }
  }

  // Get user profile by ID
  static async getUserProfile(userId: string): Promise<User | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile');
    }
  }

  // Update user profile
  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      
      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      await updateDoc(docRef, cleanUpdates);
      console.log('User profile updated:', userId);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw new Error('Failed to update user profile');
    }
  }

  // Update last login time
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await updateDoc(docRef, {
        lastLogin: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw error for login tracking failures
    }
  }

  // Add property to saved properties
  static async addSavedProperty(userId: string, propertyId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (userProfile) {
        const savedProperties = userProfile.savedProperties || [];
        if (!savedProperties.includes(propertyId)) {
          savedProperties.push(propertyId);
                  await this.updateUserProfile(userId, { savedProperties });
        
        // Invalidate saved properties cache
        cacheService.invalidateOnChange('saved_properties', userId);
        
        // Trigger global refresh events for real-time updates with slight delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-user'));
          window.dispatchEvent(new CustomEvent('refresh-saved'));
        }, 100);
        
        console.log('Property saved and cache invalidated for user:', userId);
        }
      }
    } catch (error) {
      console.error('Error adding saved property:', error);
      throw new Error('Failed to save property');
    }
  }

  // Remove property from saved properties
  static async removeSavedProperty(userId: string, propertyId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (userProfile) {
        const savedProperties = (userProfile.savedProperties || []).filter(id => id !== propertyId);
        await this.updateUserProfile(userId, { savedProperties });
        
        // Invalidate saved properties cache
        cacheService.invalidateOnChange('saved_properties', userId);
        
        // Trigger global refresh events for real-time updates with slight delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-user'));
          window.dispatchEvent(new CustomEvent('refresh-saved'));
        }, 100);
        
        console.log('Property removed and cache invalidated for user:', userId);
      }
    } catch (error) {
      console.error('Error removing saved property:', error);
      throw new Error('Failed to remove saved property');
    }
  }

  // Add property to viewing history
  static async addToViewingHistory(userId: string, propertyId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (userProfile) {
        const viewingHistory = userProfile.viewingHistory || [];
        
        // Remove if already exists to avoid duplicates
        const filteredHistory = viewingHistory.filter(id => id !== propertyId);
        
        // Add to beginning of array (most recent first)
        filteredHistory.unshift(propertyId);
        
        // Keep only last 50 viewed properties
        const limitedHistory = filteredHistory.slice(0, 50);
        
        await this.updateUserProfile(userId, { viewingHistory: limitedHistory });
      }
    } catch (error) {
      console.error('Error adding to viewing history:', error);
      // Don't throw error for history tracking failures
    }
  }

  // Verify phone number
  static async verifyPhoneNumber(userId: string): Promise<void> {
    try {
      await this.updateUserProfile(userId, { phoneVerified: true });
    } catch (error) {
      console.error('Error verifying phone number:', error);
      throw new Error('Failed to verify phone number');
    }
  }

  // Admin functions
  
  // Get all users (admin only)
  static async getAllUsers(): Promise<User[]> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        orderBy('created_at', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const users: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
        } as User);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get users');
    }
  }

  // Get users by role
  static async getUsersByRole(role: 'user' | 'agent' | 'admin'): Promise<User[]> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('role', '==', role),
        orderBy('created_at', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const users: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          id: doc.id,
          ...data,
          created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
        } as User);
      });
      
      return users;
    } catch (error) {
      console.error('Error getting users by role:', error);
      throw new Error('Failed to get users by role');
    }
  }

  // Create user (admin function)
  static async createUser(userData: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: 'user' | 'agent' | 'admin';
  }): Promise<string> {
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );
      
      // Update display name
      await updateProfile(userCredential.user, {
        displayName: userData.name
      });
      
      // Create user profile in Firestore
      await this.createUserProfile(userCredential.user.uid, {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        phoneVerified: false
      });
      
      return userCredential.user.uid;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  // Update user role (admin function)
  static async updateUserRole(userId: string, newRole: 'user' | 'agent' | 'admin'): Promise<void> {
    try {
      await this.updateUserProfile(userId, { role: newRole });
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new Error('Failed to update user role');
    }
  }

  // Toggle user verification status (admin function)
  static async toggleUserVerification(userId: string): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);
      if (userProfile) {
        await this.updateUserProfile(userId, { verified: !userProfile.verified });
      }
    } catch (error) {
      console.error('Error toggling user verification:', error);
      throw new Error('Failed to toggle user verification');
    }
  }

  // Delete user (admin function)
  static async deleteUser(userId: string): Promise<void> {
    try {
      // Delete user profile from Firestore
      const docRef = doc(db, USERS_COLLECTION, userId);
      await deleteDoc(docRef);
      
      // Note: Deleting from Firebase Auth requires the user to be currently signed in
      // In a real application, you'd typically use Firebase Admin SDK on the backend
      console.log('User profile deleted from Firestore:', userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  // Get user statistics
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
      
      const stats = {
        totalUsers: 0,
        totalAgents: 0,
        totalAdmins: 0,
        verifiedUsers: 0,
        newUsersThisMonth: 0
      };
      
      allUsers.forEach(user => {
        // Count by role
        switch (user.role) {
          case 'user':
            stats.totalUsers++;
            break;
          case 'agent':
            stats.totalAgents++;
            break;
          case 'admin':
            stats.totalAdmins++;
            break;
        }
        
        // Count verified users
        if (user.verified) {
          stats.verifiedUsers++;
        }
        
        // Count new users this month
        const userCreatedAt = new Date(user.created_at);
        if (userCreatedAt >= startOfMonth) {
          stats.newUsersThisMonth++;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user statistics');
    }
  }
} 