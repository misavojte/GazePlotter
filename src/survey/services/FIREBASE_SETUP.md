# Firebase Setup
## Authentication

1. In the Firebase console, click on "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Anonymous" authentication:
   - Click on "Anonymous"
   - Toggle "Enable"
   - Click "Save"

## Get Your Firebase Configuration

1. In the Firebase console, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click "Add app" and select the web icon (</>)
5. Register your app with a nickname (e.g., "GazePlotter Survey")
6. Copy the configuration object

Your configuration should look like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
  databaseURL: "https://your-project.firebaseio.com"
};
```

## Configure Security Rules

1. In the Firebase console, go to "Realtime Database"
2. Click on the "Rules" tab
3. Replace the default rules with the following:

```json
{
  "rules": {
    "surveyData": {
      ".write": "auth != null",
      ".validate": "newData.hasChildren(['type', 'timestamp', 'data', 'userId', 'sessionId', 'createdAt'])",
      "$entryId": {
        ".validate": "newData.child('userId').val() == auth.uid"
      }
    }
  }
}
```

### Security Rules Explanation

- **`.write": "auth != null"`**: Only authenticated users can write data
- **`.validate"`**: Ensures required fields are present
- **`"$entryId"`**: Validates that users can only write data with their own user ID