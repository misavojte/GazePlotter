<?php
/**
 * GazePlotter Survey Endpoint
 * 
 * Simple PHP endpoint that receives survey data via HTTPS POST requests
 * and organizes them by sessionId into folders.
 * 
 * Usage:
 * - Set this endpoint URL in your endpointService configuration
 * - The endpoint creates a folder for each sessionId
 * - Each submission is saved as a separate JSON file
 */

// Security: Prevent execution timeout for large files
set_time_limit(30);

// Security: Maximum JSON payload size (1 MB)
define('MAX_PAYLOAD_SIZE', 1 * 1024 * 1024);

// Security: Maximum length for any field value (sanity check)
define('MAX_FIELD_LENGTH', 65536);

// Set headers to allow CORS from specific domains
header('Content-Type: application/json');

// Get the origin of the request
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Define allowed origins (exact matches only for security)
$allowedOrigins = [
    'https://gazeplotter.com',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];

// Security: Check if origin is allowed (exact match only)
$isAllowed = in_array($origin, $allowedOrigins);

// Set CORS headers for allowed origins
if ($isAllowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
} else {
    // Log unauthorized access attempt
    error_log("Unauthorized CORS origin: $origin");
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit;
}

// Security: Check content length
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int)$_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > MAX_PAYLOAD_SIZE) {
    http_response_code(413);
    echo json_encode([
        'success' => false,
        'error' => 'Payload too large'
    ]);
    exit;
}

// Read the JSON payload from the request body
$jsonInput = file_get_contents('php://input');
$data = json_decode($jsonInput, true);

// Validate that JSON was parsed correctly considering depth and size limits
if (json_last_error() !== JSON_ERROR_NONE || $data === null) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid request data'
    ]);
    exit;
}

// Validate required fields
if (!isset($data['sessionId'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required field: sessionId'
    ]);
    exit;
}

// Get sessionId from the data
$sessionId = $data['sessionId'];

// Security: Additional sanitization - remove potentially dangerous characters including underscores
// and limit length to prevent excessively long directory names
$sessionId = preg_replace('/[^a-zA-Z0-9-]/', '', substr($sessionId, 0, 50));

// Security: Ensure sessionId is not empty after sanitization
if (empty($sessionId)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid sessionId'
    ]);
    exit;
}

// Base directory where we'll store the data
$baseDir = __DIR__ . '/data/' . $sessionId;

// Security: Prevent path traversal attempts (even though we sanitize, double-check)
$realBaseDir = realpath(__DIR__ . '/data');
if ($realBaseDir === false || !is_dir($realBaseDir)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server configuration error'
    ]);
    exit;
}

$realCurrentDir = realpath(dirname($baseDir));
if ($realCurrentDir !== $realBaseDir) {
    error_log("Potential path traversal attempt: $sessionId");
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid session ID'
    ]);
    exit;
}

// Create the session directory if it doesn't exist
if (!file_exists($baseDir)) {
    // Security: Use more restrictive permissions (0700 = owner only)
    if (!mkdir($baseDir, 0700, true)) {
        error_log("Failed to create directory: $baseDir");
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Server error'
        ]);
        exit;
    }
}

// Security: Ensure directory has correct permissions
@chmod($baseDir, 0700);

// Generate a unique filename based on timestamp
$timestamp = isset($data['timestamp']) ? $data['timestamp'] : time();
// Security: Limit timestamp to reasonable values (year 2000 to year 3000)
$timestamp = max(946684800, min(32503680000, $timestamp));
$filename = $timestamp . '_' . uniqid() . '.json';

// Security: Additional filename sanitization (prevent special characters)
$filename = preg_replace('/[^a-zA-Z0-9._-]/', '', $filename);

$filepath = $baseDir . '/' . $filename;

// Security: Limit data size and sanitize before storing
$dataToSave = $data;
$dataSize = strlen(json_encode($dataToSave));
if ($dataSize > MAX_PAYLOAD_SIZE) {
    http_response_code(413);
    echo json_encode([
        'success' => false,
        'error' => 'Data too large'
    ]);
    exit;
}

// Convert to JSON with pretty formatting for readability
$jsonOutput = json_encode($dataToSave, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

// Security: Check if JSON encoding was successful
if ($jsonOutput === false) {
    error_log("JSON encoding failed for sessionId: $sessionId");
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error'
    ]);
    exit;
}

// Write the JSON to file
if (file_put_contents($filepath, $jsonOutput, LOCK_EX) === false) {
    error_log("Failed to write file: $filepath");
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error'
    ]);
    exit;
}

// Security: Set restrictive file permissions (owner read/write only)
@chmod($filepath, 0600);

// Return success response (SECURITY: do not expose filepath)
http_response_code(200);
echo json_encode([
    'success' => true,
    'key' => $filename,
    'message' => 'Data saved successfully',
    'sessionId' => $sessionId
]);

?>
