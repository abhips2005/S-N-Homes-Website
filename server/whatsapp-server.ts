import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { chromium } from 'playwright';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const whatsappNamespace = io.of('/whatsapp');

whatsappNamespace.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);

  let browser = null;
  let page = null;
  let isAuthenticated = false;

  const checkAuthStatus = async () => {
    try {
      if (!page) return false;
      const sidePanel = await page.$('#side');
      return !!sidePanel;
    } catch {
      return false;
    }
  };

  const emitStatus = (status: string) => {
    console.log(`Status [${socket.id}]:`, status);
    socket.emit('status', status);
  };

  try {
    emitStatus('Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    page = await browser.newPage();
    emitStatus('Browser launched');

    // Set up page error handling
    page.on('error', error => {
      console.error('Page error:', error);
      emitStatus(`Error: ${error.message}`);
    });

    // Set up message monitoring
    page.on('load', async () => {
      if (await checkAuthStatus()) {
        await page.evaluate(() => {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node: any) => {
                if (node.classList?.contains('message-in')) {
                  const text = node.querySelector('.selectable-text')?.textContent;
                  const sender = node.querySelector('.text-token')?.textContent;
                  if (text && sender) {
                    window.dispatchEvent(new CustomEvent('whatsapp-message', {
                      detail: { text, sender }
                    }));
                  }
                }
              });
            });
          });

          observer.observe(document.querySelector('#main')!, {
            childList: true,
            subtree: true
          });
        });

        // Handle incoming messages
        await page.exposeFunction('handleWhatsAppMessage', async ({ text, sender }) => {
          // Process message and auto-reply
          if (text === '1') {
            await page.type('div[contenteditable="true"]', 'Please select your preferred viewing time:\n1. Morning (9 AM - 12 PM)\n2. Afternoon (2 PM - 5 PM)');
            await page.keyboard.press('Enter');
          } else if (text === '2') {
            await page.type('div[contenteditable="true"]', 'Our agent will contact you shortly. You can also reach us at: +91 1234567890');
            await page.keyboard.press('Enter');
          } else if (text === '3') {
            await page.type('div[contenteditable="true"]', 'Property has been saved to your favorites! We\'ll notify you about any updates.');
            await page.keyboard.press('Enter');
          }
        });

        page.evaluate(() => {
          window.addEventListener('whatsapp-message', ((event: CustomEvent) => {
            // @ts-ignore
            window.handleWhatsAppMessage(event.detail);
          }) as EventListener);
        });
      }
    });

    // Monitor WhatsApp authentication
    setInterval(async () => {
      const authenticated = await checkAuthStatus();
      if (authenticated && !isAuthenticated) {
        isAuthenticated = true;
        socket.emit('authenticated');
        emitStatus('WhatsApp authenticated');
      } else if (!authenticated && isAuthenticated) {
        isAuthenticated = false;
        emitStatus('WhatsApp authentication lost');
      }
    }, 5000);

    socket.on('initialize', async () => {
      try {
        emitStatus('Connecting to WhatsApp...');
        await page.goto('https://web.whatsapp.com');
        
        const qrCode = await page.$('canvas');
        if (qrCode) {
          emitStatus('Waiting for QR code scan');
          const qrData = await qrCode.screenshot();
          socket.emit('qr-code', qrData.toString('base64'));
        }
      } catch (error) {
        console.error('Initialization error:', error);
        emitStatus(`Initialization failed: ${error.message}`);
        socket.emit('error', { message: 'Failed to initialize WhatsApp' });
      }
    });

    socket.on('send-message', async ({ phoneNumber, message }, callback) => {
      try {
        if (!page) throw new Error('Browser not initialized');

        await page.goto(`https://web.whatsapp.com/send?phone=${phoneNumber}`);
        await page.waitForSelector('#main', { timeout: 30000 });
        
        await page.type('div[contenteditable="true"]', message);
        await page.keyboard.press('Enter');
        
        await page.waitForSelector('span[data-icon="msg-check"]');
        
        callback({ success: true });
      } catch (error) {
        console.error('Send message error:', error);
        callback({ error: 'Failed to send message' });
      }
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      if (browser) {
        await browser.close();
        console.log('Browser closed for client:', socket.id);
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    emitStatus(`Server error: ${error.message}`);
    socket.emit('error', { message: 'Server initialization failed' });
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`WhatsApp server running on port ${PORT}`);
});
