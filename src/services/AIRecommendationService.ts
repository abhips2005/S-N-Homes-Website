import type { Property, User, AIRecommendation } from '../types';

export class AIRecommendationService {
  /**
   * Get property recommendations for a user
   */
  async getRecommendations(user: User, properties: Property[]): Promise<AIRecommendation[]> {
    try {
      // Simplified recommendation logic without external dependencies
      const recommendations: AIRecommendation[] = [];

      // Get user preferences if available
      const preferredTypes = user?.preferences?.propertyTypes || [];
      const preferredLocations = user?.preferences?.locations || [];
      const priceRange = user?.preferences?.priceRange || { min: 0, max: Infinity };

      // Score each property based on simple matching
      for (const property of properties) {
        // Calculate base match score
        let score = 0.5; // Default base score
        const matchingCriteria: string[] = [];
        
        // Type matching
        if (preferredTypes.length === 0 || preferredTypes.includes(property.type)) {
          score += 0.1;
          matchingCriteria.push(`Property type: ${property.type}`);
        }
        
        // Location matching
        if (preferredLocations.length === 0 || preferredLocations.includes(property.location)) {
          score += 0.1;
          matchingCriteria.push(`Location: ${property.location}`);
        }
        
        // Price matching
        if (property.price >= priceRange.min && property.price <= priceRange.max) {
          score += 0.1;
          matchingCriteria.push('Within budget');
        }
        
        // Features matching (bedrooms, bathrooms)
        if (property.bedrooms && property.bedrooms >= 2) {
          score += 0.05;
          matchingCriteria.push(`${property.bedrooms} bedrooms`);
        }
        
        if (property.bathrooms && property.bathrooms >= 2) {
          score += 0.05;
          matchingCriteria.push(`${property.bathrooms} bathrooms`);
        }
        
        // Premium property bonus
        if (property.is_premium) {
          score += 0.1;
          matchingCriteria.push('Premium property');
        }
        
        // Generate reasons based on matching criteria
        const reasons = this.generateRecommendationReasons(property, matchingCriteria);

        recommendations.push({
          propertyId: property.id,
          score,
          matchingCriteria,
          confidence: Math.min(score * 100, 98), // Convert to percentage, max 98%
          reasons
        });
      }

      return recommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Return top 5 recommendations
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  private generateRecommendationReasons(property: Property, criteria: string[]): string[] {
    const reasons: string[] = [];
    
    // Add reasons based on matching criteria
    if (criteria.length > 0) {
      reasons.push(`This ${property.type} matches your preferences`);
    }
    
    // Add location-based reason
    reasons.push(`Great property in ${property.location}, ${property.district}`);
    
    // Add price-based reason
    const priceInLakhs = (property.price / 100000).toFixed(2);
    reasons.push(`Competitively priced at ₹${priceInLakhs} Lakhs`);
    
    return reasons;
  }
}

export const aiRecommendationService = new AIRecommendationService();
