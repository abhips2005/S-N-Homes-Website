import { chromium, Browser, Page } from 'playwright';
import { WebSocket } from 'ws';
import EventEmitter from 'events';
import type { Property } from '../types';

export class CustomWhatsAppService extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private ws: WebSocket | null = null;
  private isAuthenticated = false;
  private messageQueue: Map<string, (response: string) => void> = new Map();

  async initialize() {
    try {
      // Launch browser
      this.browser = await chromium.launch({ headless: true });
      this.page = await this.browser.newPage();
      
      // Navigate to WhatsApp Web
      await this.page.goto('https://web.whatsapp.com');
      
      // Wait for QR code or authenticated state
      await this.page.waitForSelector('canvas, #side', { timeout: 0 });
      
      // Check if authenticated
      this.isAuthenticated = await this.page.$('#side') !== null;
      
      if (this.isAuthenticated) {
        await this.setupMessageListener();
      } else {
        this.emit('qr-code', await this.getQRCode());
      }
    } catch (error) {
      console.error('Failed to initialize WhatsApp:', error);
      throw error;
    }
  }

  private async setupMessageListener() {
    if (!this.page) return;

    // Monitor incoming messages
    await this.page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          const messages = mutation.addedNodes;
          messages.forEach((message: any) => {
            if (message.classList?.contains('message-in')) {
              const text = message.querySelector('.selectable-text')?.textContent;
              const sender = message.querySelector('.text-token')?.textContent;
              window.dispatchEvent(new CustomEvent('whatsapp-message', {
                detail: { text, sender }
              }));
            }
          });
        });
      });

      observer.observe(document.querySelector('#main')!, {
        childList: true,
        subtree: true
      });
    });

    // Listen for messages
    await this.page.exposeFunction('onWhatsAppMessage', ({text, sender}: {text: string, sender: string}) => {
      this.handleIncomingMessage(text, sender);
    });

    await this.page.evaluate(() => {
      window.addEventListener('whatsapp-message', ((event: CustomEvent) => {
        // @ts-ignore
        window.onWhatsAppMessage(event.detail);
      }) as EventListener);
    });
  }

  private async handleIncomingMessage(text: string, sender: string) {
    // Process message with AI
    const response = await this.processAIQuery(text);
    
    // Send response
    await this.sendMessage(sender, response);
  }

  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    if (!this.page || !this.isAuthenticated) throw new Error('WhatsApp not initialized');

    try {
      // Format phone number
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      
      // Open chat
      await this.page.goto(`https://web.whatsapp.com/send?phone=${formattedNumber}`);
      await this.page.waitForSelector('#main', { timeout: 30000 });
      
      // Type and send message
      await this.page.type('div[contenteditable="true"]', message);
      await this.page.keyboard.press('Enter');
      
      // Wait for message to send
      await this.page.waitForSelector('span[data-icon="msg-check"]');
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async sendPropertyUpdate(phoneNumber: string, property: Property): Promise<void> {
    const message = `
🏠 *Property Update*
${property.title}

💰 Price: ₹${(property.price / 100000).toFixed(2)} Lakhs
📍 Location: ${property.location}
🏷️ Status: ${property.status}

🔍 View details: https://keralaestates.com/property/${property.id}

Reply with:
1️⃣ Schedule viewing
2️⃣ Contact agent
3️⃣ Save property
    `;

    await this.sendMessage(phoneNumber, message);
  }

  private async getQRCode(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const qrCanvas = await this.page.$('canvas');
    return qrCanvas ? await qrCanvas.screenshot() as unknown as string : '';
  }

  async processAIQuery(query: string): Promise<string> {
    const patterns = {
      price: /(?:price|cost|budget|worth)/i,
      location: /(?:where|location|place|area)/i,
      amenities: /(?:amenities|facilities|features)/i,
      loan: /(?:loan|finance|mortgage|payment)/i,
      viewing: /(?:view|visit|see|tour)/i,
      property_type: /(?:type|house|apartment|flat|villa)/i
    };

    const responses = {
      price: [
        "Our properties range from ₹20 Lakhs to ₹5 Crores. What's your budget range?",
        "We have properties in various price ranges. Would you like me to show you properties within a specific budget?",
        "Property prices vary based on location and features. Could you specify your budget range?"
      ],
      location: [
        "We have properties across Kerala. Popular locations include Kochi, Trivandrum, and Calicut. Which area interests you?",
        "Which part of Kerala are you looking to invest in?",
        "I can help you find properties in any part of Kerala. Which location do you prefer?"
      ],
      amenities: [
        "Our properties come with various amenities like swimming pools, gyms, gardens, and 24/7 security.",
        "What specific amenities are you looking for in your dream home?",
        "We can filter properties based on your preferred amenities. What features matter most to you?"
      ],
      loan: [
        "We have tie-ups with major banks offering home loans at competitive interest rates.",
        "Would you like to know about our home loan options? We can help you with the application process.",
        "Our banking partners offer loans up to 80% of property value. Shall I connect you with our finance team?"
      ],
      viewing: [
        "I can help you schedule a property viewing. When would you like to visit?",
        "Our agents are available for property tours. Would you like to schedule one?",
        "We offer both physical and virtual property tours. Which would you prefer?"
      ],
      property_type: [
        "We have a wide range of properties including apartments, villas, and independent houses.",
        "What type of property are you interested in? We can filter based on your preference.",
        "Are you looking for any specific type of property?"
      ]
    };

    // Find matching patterns
    const matchingTypes = Object.entries(patterns)
      .filter(([_, pattern]) => pattern.test(query))
      .map(([type]) => type);

    if (matchingTypes.length === 0) {
      return "I'm here to help you find your dream property. You can ask me about:\n\n" +
             "- Property prices and budgets\n" +
             "- Locations and areas\n" +
             "- Property types and amenities\n" +
             "- Home loans and financing\n" +
             "- Property viewings\n\n" +
             "What would you like to know?";
    }

    // Get random response for the first matching type
    const responseType = matchingTypes[0] as keyof typeof responses;
    const possibleResponses = responses[responseType];
    return possibleResponses[Math.floor(Math.random() * possibleResponses.length)];
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

export const customWhatsAppService = new CustomWhatsAppService();
