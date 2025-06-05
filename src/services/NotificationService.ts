import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase-config';
import { UserService } from './userService';

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
  data?: any;
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

interface Property {
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

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  viewingHistory?: string[];
  savedProperties?: string[];
  preferences?: {
    location?: string;
    priceRange?: { min: number; max: number };
    propertyType?: string;
    bedrooms?: number;
  };
}

// Firebase collections
const NOTIFICATIONS_COLLECTION = 'notifications';
const ADMIN_NOTIFICATIONS_COLLECTION = 'admin_notifications';

export class NotificationService {
  
  // Create notification for admin panel
  static async createNotification(request: CreateNotificationRequest): Promise<void> {
    try {
      console.log('=== CREATING ADMIN NOTIFICATION ===');
      console.log('Request:', request);
      
      // Get target users based on criteria
      const targetUsers = await this.getTargetUsers(request);
      console.log('Target users determined:', targetUsers);
      
      if (targetUsers.length === 0) {
        throw new Error('No target users found');
      }

      // Create admin notification record in Firestore
      const adminNotificationData = {
        title: request.title,
        message: request.message,
        type: request.type,
        targetUsers: request.targetUsers,
        targetUserIds: request.targetUserIds || [],
        targetLocation: request.targetLocation || '',
        created_at: serverTimestamp(),
        sent_count: targetUsers.length,
        read_count: 0,
        created_by: 'admin'
      };

      const adminNotifRef = await addDoc(collection(db, ADMIN_NOTIFICATIONS_COLLECTION), adminNotificationData);
      console.log('Admin notification record created with ID:', adminNotifRef.id);

      // Create individual notifications for each target user using batch write
      const batch = writeBatch(db);
      const notificationIds: string[] = [];

      targetUsers.forEach(userId => {
        const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
        const notificationData = {
          title: request.title,
          message: request.message,
          type: request.type,
          user_id: userId,
          created_at: serverTimestamp(),
          read: false,
          property_id: null,
          data: null
        };
        
        batch.set(notifRef, notificationData);
        notificationIds.push(notifRef.id);
      });

      // Commit all notifications in a single batch
      await batch.commit();
      
      console.log(`Created ${targetUsers.length} notifications for users in Firestore`);
      console.log('Notification IDs:', notificationIds);
      console.log('=== END ADMIN NOTIFICATION CREATION ===');
      
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Get user notifications from Firestore
  static async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      console.log(`Getting notifications for user ${userId} from Firestore`);
      
      const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where('user_id', '==', userId),
        orderBy('created_at', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const notifications: Notification[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          title: data.title,
          message: data.message,
          type: data.type,
          user_id: data.user_id,
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          read: data.read,
          property_id: data.property_id,
          data: data.data
        });
      });
      
      console.log(`Found ${notifications.length} notifications for user ${userId} in Firestore:`, notifications);
      return notifications;
      
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  // Mark notification as read in Firestore
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
      await updateDoc(notifRef, {
        read: true
      });
      
      console.log(`Marked notification ${notificationId} as read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Get admin notifications from Firestore
  static async getAdminNotifications(): Promise<AdminNotification[]> {
    try {
      console.log('Getting admin notifications from Firestore');
      
      const q = query(
        collection(db, ADMIN_NOTIFICATIONS_COLLECTION),
        orderBy('created_at', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const adminNotifications: AdminNotification[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        adminNotifications.push({
          id: doc.id,
          title: data.title,
          message: data.message,
          type: data.type,
          targetUsers: data.targetUsers,
          targetUserIds: data.targetUserIds || [],
          targetLocation: data.targetLocation || '',
          created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
          sent_count: data.sent_count,
          read_count: data.read_count,
          created_by: data.created_by
        });
      });
      
      console.log(`Found ${adminNotifications.length} admin notifications in Firestore`);
      return adminNotifications;
      
    } catch (error) {
      console.error('Error getting admin notifications:', error);
      return [];
    }
  }

  // Get target users based on criteria
  private static async getTargetUsers(request: CreateNotificationRequest): Promise<string[]> {
    try {
      console.log('Getting target users for request:', request);
      
      // Get real users from Firebase
      const realUsers = await UserService.getAllUsers();
      console.log('Real users from Firebase:', realUsers.map(u => ({ id: u.id, name: u.name })));
      
      const allUsers = realUsers.map(user => ({
        id: user.id,
        location: 'Kochi', // In a real app, this would come from user profile
        lastActive: Date.now() - 86400000 // Mock last active time
      }));

      // Add some mock users for testing (including current user)
      const mockUsers = [
        '0vA5woZ1IHcRZ57F070QxXEBvgD3', // Current user from logs
        'user1', 'user2', 'user3', 'user4', 'user5'
      ];
      
      // Combine real users with mock users, avoiding duplicates
      const combinedUsers = [
        ...allUsers,
        ...mockUsers
          .filter(mockId => !allUsers.some(real => real.id === mockId))
          .map(mockId => ({ id: mockId, location: 'Kochi', lastActive: Date.now() - 86400000 }))
      ];

      console.log('Combined users list:', combinedUsers.map(u => u.id));

      switch (request.targetUsers) {
        case 'all':
          return combinedUsers.map(u => u.id);
        
        case 'specific':
          return request.targetUserIds || [];
        
        case 'byLocation':
          return combinedUsers
            .filter(u => u.location.toLowerCase().includes(request.targetLocation?.toLowerCase() || ''))
            .map(u => u.id);
        
        case 'byActivity':
          // Users active in last 7 days
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return combinedUsers
            .filter(u => u.lastActive > sevenDaysAgo)
            .map(u => u.id);
        
        default:
          return [];
      }
    } catch (error) {
      console.error('Error getting target users:', error);
      // Fallback to mock data
      const mockUsers = ['0vA5woZ1IHcRZ57F070QxXEBvgD3', 'user1', 'user2', 'user3', 'user4', 'user5'];
      
      switch (request.targetUsers) {
        case 'all':
          return mockUsers;
        case 'specific':
          return request.targetUserIds || [];
        case 'byLocation':
          return mockUsers.slice(0, 3);
        case 'byActivity':
          return mockUsers.slice(0, 4);
        default:
          return [];
      }
    }
  }

  // Automatic notification for new properties
  static async notifyNewProperty(property: Property): Promise<void> {
    try {
      console.log('Creating new property notifications for:', property.title);
      
      // Find users interested in this type of property
      const interestedUsers = await this.findInterestedUsers(property);
      
      if (interestedUsers.length === 0) {
        console.log('No interested users found for new property');
        return;
      }

      // Create notifications using batch write
      const batch = writeBatch(db);
      
      interestedUsers.forEach(userId => {
        const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
        const notificationData = {
          title: 'New Property Match',
          message: `A new ${property.type} property in ${property.location} matches your preferences. Price: ₹${(property.price / 100000).toFixed(2)} Lakhs`,
          type: 'property',
          user_id: userId,
          created_at: serverTimestamp(),
          read: false,
          property_id: property.id,
          data: { property }
        };
        
        batch.set(notifRef, notificationData);
      });

      // Create admin notification record
      const adminNotifRef = doc(collection(db, ADMIN_NOTIFICATIONS_COLLECTION));
      const adminNotificationData = {
        title: 'Auto: New Property Notifications',
        message: `Sent ${interestedUsers.length} notifications for new property: ${property.title}`,
        type: 'property',
        targetUsers: 'byActivity',
        targetUserIds: interestedUsers,
        targetLocation: '',
        created_at: serverTimestamp(),
        sent_count: interestedUsers.length,
        read_count: 0,
        created_by: 'system'
      };
      
      batch.set(adminNotifRef, adminNotificationData);
      
      // Commit all at once
      await batch.commit();

      console.log(`Sent ${interestedUsers.length} new property notifications to Firestore`);
    } catch (error) {
      console.error('Error sending new property notifications:', error);
    }
  }

  // Automatic notification for price changes
  static async notifyPriceChange(property: Property, oldPrice: number): Promise<void> {
    try {
      console.log('Creating price change notifications for:', property.title);
      
      // Find users who have viewed or saved this property
      const interestedUsers = await this.findUsersInterestedInProperty(property.id);
      
      if (interestedUsers.length === 0) {
        console.log('No interested users found for price change');
        return;
      }

      const priceDifference = oldPrice - property.price;
      const isReduction = priceDifference > 0;
      const changeText = isReduction ? 'reduced' : 'increased';
      const amount = Math.abs(priceDifference);

      // Create notifications using batch write
      const batch = writeBatch(db);
      
      interestedUsers.forEach(userId => {
        const notifRef = doc(collection(db, NOTIFICATIONS_COLLECTION));
        const notificationData = {
          title: isReduction ? 'Price Drop Alert!' : 'Price Update',
          message: `The price of "${property.title}" in ${property.location} has ${changeText} by ₹${(amount / 100000).toFixed(2)} Lakhs. New price: ₹${(property.price / 100000).toFixed(2)} Lakhs`,
          type: 'price',
          user_id: userId,
          created_at: serverTimestamp(),
          read: false,
          property_id: property.id,
          data: { property, oldPrice, newPrice: property.price }
        };
        
        batch.set(notifRef, notificationData);
      });

      // Create admin notification record
      const adminNotifRef = doc(collection(db, ADMIN_NOTIFICATIONS_COLLECTION));
      const adminNotificationData = {
        title: 'Auto: Price Change Notifications',
        message: `Sent ${interestedUsers.length} price change notifications for: ${property.title}`,
        type: 'price',
        targetUsers: 'specific',
        targetUserIds: interestedUsers,
        targetLocation: '',
        created_at: serverTimestamp(),
        sent_count: interestedUsers.length,
        read_count: 0,
        created_by: 'system'
      };
      
      batch.set(adminNotifRef, adminNotificationData);
      
      // Commit all at once
      await batch.commit();

      console.log(`Sent ${interestedUsers.length} price change notifications to Firestore`);
    } catch (error) {
      console.error('Error sending price change notifications:', error);
    }
  }

  // Auto notification for properties in same area with similar price
  static async notifyRelatedProperties(userId: string, viewedProperty: Property): Promise<void> {
    try {
      console.log('Creating related property notification for user:', userId);
      
      // Find similar properties in the same area with similar price range
      const priceRange = {
        min: viewedProperty.price * 0.8, // 20% below
        max: viewedProperty.price * 1.2  // 20% above
      };

      const similarProperties = await this.findSimilarProperties(viewedProperty, priceRange);
      
      if (similarProperties.length === 0) {
        console.log('No similar properties found');
        return;
      }

      // Check if we already sent a similar notification recently (rate limiting)
      const recentNotifications = await this.getUserNotifications(userId);
      const recentSimilarNotif = recentNotifications.find(n => 
        n.title === 'Similar Properties Found' && 
        new Date(n.created_at).getTime() > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      );

      if (recentSimilarNotif) {
        console.log('Similar notification already sent recently, skipping');
        return;
      }

      // Create notification in Firestore
      const notificationData = {
        title: 'Similar Properties Found',
        message: `We found ${similarProperties.length} similar properties in ${viewedProperty.location} within your price range (₹${(priceRange.min / 100000).toFixed(1)}L - ₹${(priceRange.max / 100000).toFixed(1)}L)`,
        type: 'property',
        user_id: userId,
        created_at: serverTimestamp(),
        read: false,
        property_id: null,
        data: { similarProperties, viewedProperty }
      };

      await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notificationData);

      console.log(`Sent similar properties notification to user ${userId}`);
    } catch (error) {
      console.error('Error sending related property notifications:', error);
    }
  }

  // Find users interested in similar properties (mock implementation)
  private static async findInterestedUsers(property: Property): Promise<string[]> {
    // This would typically query your user database for:
    // 1. Users who have viewed similar properties (same location, type, price range)
    // 2. Users with saved search preferences matching this property
    // 3. Users who have saved properties in the same area
    
    // Mock implementation
    const mockUsers = ['0vA5woZ1IHcRZ57F070QxXEBvgD3', 'user1', 'user3']; // Current user + some mock users
    return property.location.toLowerCase().includes('kochi') ? mockUsers : ['user2', 'user4'];
  }

  // Find users who have interacted with a specific property (mock implementation)
  private static async findUsersInterestedInProperty(propertyId: string): Promise<string[]> {
    // This would query for users who have:
    // 1. Viewed this property
    // 2. Saved this property
    // 3. Inquired about this property
    
    // Mock implementation
    return ['0vA5woZ1IHcRZ57F070QxXEBvgD3', 'user1']; // Include current user for testing
  }

  // Find similar properties (mock implementation)
  private static async findSimilarProperties(
    property: Property, 
    priceRange: { min: number; max: number }
  ): Promise<Property[]> {
    // This would query your database for properties with:
    // - Same location/district
    // - Similar price range
    // - Same or similar type
    // - Available status
    
    // Mock implementation
    return [
      {
        id: 'similar-1',
        title: `Premium Villa in ${property.location}`,
        price: property.price * 0.9,
        location: property.location,
        district: property.district,
        type: property.type,
        status: 'available',
        images: []
      },
      {
        id: 'similar-2', 
        title: `Modern Home in ${property.location}`,
        price: property.price * 1.1,
        location: property.location,
        district: property.district,
        type: property.type,
        status: 'available',
        images: []
      }
    ];
  }

  // Get unread notification count for a user
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where('user_id', '==', userId),
        where('read', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Mark all notifications as read for a user
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where('user_id', '==', userId),
        where('read', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      console.log(`Marked all notifications as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  }

  // Send notification to specific user by ID (for debugging)
  static async sendToSpecificUser(userId: string, title: string, message: string): Promise<void> {
    try {
      const notificationData = {
        title: title,
        message: message,
        type: 'system',
        user_id: userId,
        created_at: serverTimestamp(),
        read: false,
        property_id: null,
        data: null
      };

      const notifRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), notificationData);
      
      // Also add to admin notifications for tracking
      const adminNotificationData = {
        title: `Direct: ${title}`,
        message: `Sent direct notification to specific user: ${message}`,
        type: 'system',
        targetUsers: 'specific',
        targetUserIds: [userId],
        targetLocation: '',
        created_at: serverTimestamp(),
        sent_count: 1,
        read_count: 0,
        created_by: 'admin'
      };

      await addDoc(collection(db, ADMIN_NOTIFICATIONS_COLLECTION), adminNotificationData);
      
      console.log(`Sent direct notification to user ${userId} with ID:`, notifRef.id);
    } catch (error) {
      console.error('Error sending direct notification:', error);
      throw error;
    }
  }
} 