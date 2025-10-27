# GazePlotter Survey Endpoint

Simple PHP endpoint for receiving survey data from the GazePlotter application.

## Setup

1. Upload the `GazePlotterSurveyEndpoint.php` file to your web server
2. The endpoint will automatically create the `data/` directory if it doesn't exist
3. Set the endpoint URL in your `endpointService` configuration:
   ```typescript
   const endpointConfig: EndpointConfig = {
     endpoint: 'https://your-domain.com/survey/GazePlotterSurveyEndpoint.php'
   };
   ```

## Features

- **CORS support**: Only accepts requests from allowed domains (gazeplotter.com, eyetracking.upol.cz, and localhost variants)
- **Auto-creates directories**: Automatically creates the data directory and session-specific subdirectories
- **Session-based organization**: Creates separate folders for each sessionId
- **JSON storage**: Each submission is saved as a separate JSON file
- **Simple and lightweight**: No database required

## Directory Structure

```
data/
├── session_1234567890_abc123/
│   ├── 1234567890_uniqueId1.json
│   ├── 1234567890_uniqueId2.json
│   └── ...
└── session_9876543210_def456/
    ├── 9876543210_uniqueId1.json
    └── ...
```

## Security Notes

- Only POST requests are accepted
- Origin validation for CORS
- SessionId is sanitized to prevent directory traversal attacks
- Submissions are saved with highly restrictive file permissions (0600 for files, 0700 for directories)
- Maximum payload size of 1 MB
- Path traversal protection with realpath validation

