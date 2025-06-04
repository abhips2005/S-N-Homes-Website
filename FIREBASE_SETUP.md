# Firebase Setup Guide

Your application is currently trying to connect to a Firebase project that may not be yours. Follow these steps to connect to your own Firebase project:

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or select an existing project
3. Follow the setup wizard

## Step 2: Enable Required Services

In your Firebase project, enable these services:

### Authentication
1. Go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider
3. Save the changes

### Firestore Database
1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select a location close to your users
5. Click **Done**

### Storage
1. Go to **Storage**
2. Click **Get started**
3. Choose **Start in test mode** (for development)
4. Select a location (same as Firestore)
5. Click **Done**

## Step 3: Get Your Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps** section
3. Click **Add app** > **Web** (</>) 
4. Register your app with a nickname
5. Copy the `firebaseConfig` object

## Step 4: Create Environment File

1. Create a `.env` file in your project root
2. Add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## Step 5: Update Firestore Security Rules (Optional)

For development, you can use these permissive rules in **Firestore Database** > **Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

For Storage, go to **Storage** > **Rules**:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Important**: These rules allow anyone to read/write your database. Replace with proper security rules before deploying to production.

## Step 6: Restart Your Development Server

After creating the `.env` file:

```bash
npm run dev
```

## Troubleshooting

If you're still having issues:

1. **Check the browser console** for detailed error messages
2. **Verify your Firebase project** is active and billing is enabled (if required)
3. **Check your internet connection**
4. **Make sure all Firebase services are enabled** in your project
5. **Verify your `.env` file** is in the project root and properly formatted

## Production Deployment

Before deploying to production:

1. **Set up proper Firestore security rules**
2. **Set up proper Storage security rules**
3. **Configure your production environment variables**
4. **Enable Firebase App Check** for additional security 