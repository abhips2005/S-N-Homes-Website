import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
  type: string;
  importance: number;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, suggestion?: LocationSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter location",
  required = false,
  className = "",
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update input value when external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced search function
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (inputValue.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchLocations(inputValue);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue]);

  const searchLocations = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      // Prioritize Kerala locations by adding "Kerala, India" to the query
      const searchQuery = query.includes('Kerala') || query.includes('India') 
        ? query 
        : `${query}, Kerala, India`;

      // First try direct API call (works in production)
      let response;
      let data;

      try {
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(searchQuery)}&` +
          `format=json&` +
          `limit=10&` +
          `countrycodes=in&` +
          `addressdetails=1&` +
          `extratags=1`
        );

        if (response.ok) {
          data = await response.json();
        } else {
          throw new Error('Direct API call failed');
        }
      } catch (directError) {
        console.log('Direct API call failed, trying CORS proxy...');
        
        // Fallback to CORS proxy for development
        try {
          const proxyUrl = 'https://api.allorigins.win/get?url=';
          const targetUrl = `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(searchQuery)}&` +
            `format=json&` +
            `limit=10&` +
            `countrycodes=in&` +
            `addressdetails=1&` +
            `extratags=1`;

          response = await fetch(proxyUrl + encodeURIComponent(targetUrl));

          if (response.ok) {
            const proxyData = await response.json();
            data = JSON.parse(proxyData.contents);
          } else {
            throw new Error('Proxy API call failed');
          }
        } catch (proxyError) {
          console.log('Proxy API call also failed, using fallback data...');
          
          // Fallback to predefined Kerala locations
          data = getKeralaFallbackLocations(query);
        }
      }

      if (data && data.length > 0) {
        // Filter and sort results
        const filteredResults = data
          .filter((item: any) => {
            // Prefer results from Kerala
            return item.display_name.toLowerCase().includes('kerala') ||
                   item.display_name.toLowerCase().includes('india');
          })
          .map((item: any) => ({
            display_name: item.display_name,
            lat: item.lat,
            lon: item.lon,
            place_id: item.place_id || `fallback_${Date.now()}_${Math.random()}`,
            type: item.type || 'unknown',
            importance: item.importance || 0
          }))
          .sort((a: LocationSuggestion, b: LocationSuggestion) => {
            // Prioritize Kerala locations
            const aIsKerala = a.display_name.toLowerCase().includes('kerala');
            const bIsKerala = b.display_name.toLowerCase().includes('kerala');
            
            if (aIsKerala && !bIsKerala) return -1;
            if (!aIsKerala && bIsKerala) return 1;
            
            // Then sort by importance
            return b.importance - a.importance;
          });

        setSuggestions(filteredResults.slice(0, 8)); // Limit to 8 results
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      
      // Final fallback to Kerala locations
      const fallbackData = getKeralaFallbackLocations(query);
      if (fallbackData.length > 0) {
        setSuggestions(fallbackData.slice(0, 8));
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fallback function for Kerala locations when API is not available
  const getKeralaFallbackLocations = (query: string): LocationSuggestion[] => {
    const keralaLocations = [
      { name: 'Thiruvananthapuram', district: 'Thiruvananthapuram' },
      { name: 'Kochi', district: 'Ernakulam' },
      { name: 'Kozhikode', district: 'Kozhikode' },
      { name: 'Kottayam', district: 'Kottayam' },
      { name: 'Thrissur', district: 'Thrissur' },
      { name: 'Kollam', district: 'Kollam' },
      { name: 'Palakkad', district: 'Palakkad' },
      { name: 'Alappuzha', district: 'Alappuzha' },
      { name: 'Pathanamthitta', district: 'Pathanamthitta' },
      { name: 'Kannur', district: 'Kannur' },
      { name: 'Kasaragod', district: 'Kasaragod' },
      { name: 'Wayanad', district: 'Wayanad' },
      { name: 'Idukki', district: 'Idukki' },
      { name: 'Malappuram', district: 'Malappuram' },
      { name: 'Ernakulam', district: 'Ernakulam' },
      { name: 'Trivandrum', district: 'Thiruvananthapuram' }
    ];

    const queryLower = query.toLowerCase();
    return keralaLocations
      .filter(location => 
        location.name.toLowerCase().includes(queryLower) ||
        location.district.toLowerCase().includes(queryLower)
      )
      .map((location, index) => ({
        display_name: `${location.name}, ${location.district}, Kerala, India`,
        lat: '9.9312',
        lon: '76.2673',
        place_id: `kerala_${location.name.toLowerCase()}_${index}`,
        type: 'city',
        importance: 0.8
      }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    // Extract a cleaner location name
    const parts = suggestion.display_name.split(',');
    let cleanName = parts[0].trim();
    
    // If it's a detailed address, try to get a more readable format
    if (parts.length > 1) {
      // Try to include city/town if available
      for (let i = 1; i < Math.min(parts.length, 3); i++) {
        const part = parts[i].trim();
        if (part && !part.match(/^\d+$/) && part !== 'India') {
          cleanName = `${cleanName}, ${part}`;
          break;
        }
      }
    }

    setInputValue(cleanName);
    onChange(cleanName, suggestion);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" />
        <input
          ref={inputRef}
          type="text"
          required={required}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${className} ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.place_id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {suggestion.display_name.split(',')[0]}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {suggestion.display_name}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && !loading && suggestions.length === 0 && inputValue.trim().length > 1 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="px-4 py-3 text-gray-500 text-sm">
            No locations found. Try a different search term.
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete; 