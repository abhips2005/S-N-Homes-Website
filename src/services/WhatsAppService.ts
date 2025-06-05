import { io } from 'socket.io-client';
import type { Property } from '../types';

export class WhatsAppService {
  private socket = io('ws://localhost:3001/whatsapp');
  private isConnected = false;
  private connectionStatus: 'connecting' | 'connected' | 'authenticated' | 'error' = 'connecting';

  constructor() {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.connectionStatus = 'connected';
      console.log('Connected to WhatsApp service');
    });

    this.socket.on('authenticated', () => {
      this.connectionStatus = 'authenticated';
      console.log('WhatsApp authenticated');
    });

    this.socket.on('error', (error) => {
      this.connectionStatus = 'error';
      console.error('WhatsApp error:', error);
    });

    // Initialize WhatsApp connection
    this.socket.emit('initialize');
  }

  async sendPropertyUpdate(phoneNumber: string, property: Property): Promise<void> {
    // Format the message for WhatsApp with emojis and formatting
    const message = `🏠 *New Property Alert!*\n\n` +
      `*${property.title}*\n\n` +
      `💰 Price: ₹${(property.price / 100000).toFixed(2)} Lakhs\n` +
      `📍 Location: ${property.location}\n` +
      `🏷️ Status: ${property.status}\n\n` +
      `*Features:*\n` +
      `🛏️ ${property.bedrooms} Bedrooms\n` +
      `🚿 ${property.bathrooms} Bathrooms\n` +
      `📏 ${property.area} sq.ft\n\n` +
      `🌟 *Amenities:*\n${property.amenities.map(a => `• ${a}`).join('\n')}\n\n` +
              `🔍 View details: https://snhomes.com/property/${property.id}\n\n` +
      `Reply with:\n` +
      `1️⃣ Schedule viewing\n` +
      `2️⃣ Contact agent\n` +
      `3️⃣ Save property`;

    return this.sendMessage(phoneNumber, message);
  }

  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('send-message', { phoneNumber, message }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve();
        }
      });
    });
  }
}

export const whatsAppService = new WhatsAppService();
