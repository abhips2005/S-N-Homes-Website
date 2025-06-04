import type { User, UserBehavior } from '../types';

export class UserBehaviorService {
  async trackBehavior(userId: string, behavior: UserBehavior): Promise<void> {
    // In production, save to database
    console.log('Tracking behavior:', { userId, behavior });
  }

  async getUserBehaviors(userId: string): Promise<UserBehavior[]> {
    // In production, fetch from database
    return [];
  }

  async findSimilarUsers(userId: string): Promise<User[]> {
    // In production, implement user similarity algorithm
    return [];
  }

  calculateUserSimilarity(user1: User, user2: User): number {
    const preferences1 = user1.preferences;
    const preferences2 = user2.preferences;

    if (!preferences1 || !preferences2) return 0;

    // Calculate similarity based on preferences
    const typeOverlap = preferences1.propertyTypes.filter(type => 
      preferences2.propertyTypes.includes(type)
    ).length;

    const locationOverlap = preferences1.locations.filter(location =>
      preferences2.locations.includes(location)
    ).length;

    const priceRangeOverlap = this.calculatePriceRangeOverlap(
      preferences1.priceRange,
      preferences2.priceRange
    );

    return (typeOverlap + locationOverlap + priceRangeOverlap) / 3;
  }

  private calculatePriceRangeOverlap(range1: { min: number; max: number }, range2: { min: number; max: number }): number {
    const overlap = Math.min(range1.max, range2.max) - Math.max(range1.min, range2.min);
    const totalRange = Math.max(range1.max, range2.max) - Math.min(range1.min, range2.min);
    return Math.max(0, overlap / totalRange);
  }
}

export const userBehaviorService = new UserBehaviorService();
