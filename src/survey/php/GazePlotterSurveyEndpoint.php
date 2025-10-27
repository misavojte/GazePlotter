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
    'https://eyetracking.upol.cz',
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
    error_log("JSON decode failed. Error: " . json_last_error_msg() . ", Input length: " . strlen($jsonInput));
    error_log("JSON input: " . $jsonInput);
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON request data',
        'debug' => [
            'json_error' => json_last_error(),
            'json_error_msg' => json_last_error_msg(),
            'input_length' => strlen($jsonInput),
            'json_input' => $jsonInput
        ]
    ]);
    exit;
}

// Debug logging for troubleshooting
error_log("Request data received: " . json_encode($data));

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
$originalSessionId = $data['sessionId'];
$sessionId = $data['sessionId'];

// Security: Additional sanitization - remove potentially dangerous characters including underscores
// and limit length to prevent excessively long directory names
$sessionId = preg_replace('/[^a-zA-Z0-9-]/', '', substr($sessionId, 0, 50));

// Security: Ensure sessionId is not empty after sanitization
if (empty($sessionId)) {
    error_log("SessionId became empty after sanitization. Original: '$originalSessionId'");
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid sessionId after sanitization',
        'debug' => [
            'originalSessionId' => $originalSessionId,
            'sanitizedSessionId' => $sessionId,
            'preg_replace_result' => preg_replace('/[^a-zA-Z0-9-]/', '', substr($originalSessionId, 0, 50))
        ]
    ]);
    exit;
}

// Debug logging for troubleshooting
error_log("Request received - Original SessionId: '$originalSessionId', Sanitized SessionId: '$sessionId'");

// Base directory where we'll store the data
$baseDir = __DIR__ . '/data/' . $sessionId;

// Security: Prevent path traversal attempts (even though we sanitize, double-check)
$realBaseDir = realpath(__DIR__ . '/data');
if ($realBaseDir === false || !is_dir($realBaseDir)) {
    error_log("Data directory does not exist or is not accessible: " . __DIR__ . '/data');
    error_log("realBaseDir result: " . ($realBaseDir === false ? 'false' : $realBaseDir));
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server configuration error - data directory not found',
        'debug' => [
            'baseDir' => __DIR__ . '/data',
            'realBaseDir' => $realBaseDir,
            'isDir' => is_dir(__DIR__ . '/data'),
            'sessionId' => $sessionId
        ]
    ]);
    exit;
}

$realCurrentDir = realpath(dirname($baseDir));
if ($realCurrentDir !== $realBaseDir) {
    error_log("Path traversal check failed. SessionId: $sessionId, realCurrentDir: $realCurrentDir, realBaseDir: $realBaseDir");
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid session ID - path traversal detected',
        'debug' => [
            'sessionId' => $sessionId,
            'baseDir' => $baseDir,
            'realCurrentDir' => $realCurrentDir,
            'realBaseDir' => $realBaseDir
        ]
    ]);
    exit;
}

// Create the session directory if it doesn't exist
if (!file_exists($baseDir)) {
    // Security: Use more restrictive permissions (0700 = owner only)
    // Suppress warnings for race condition where multiple requests try to create the same directory
    if (!@mkdir($baseDir, 0700, true) && !is_dir($baseDir)) {
        error_log("Failed to create directory: $baseDir");
        error_log("mkdir result: " . (!@mkdir($baseDir, 0700, true) ? 'failed' : 'success'));
        error_log("is_dir check: " . (is_dir($baseDir) ? 'true' : 'false'));
        error_log("file_exists check: " . (file_exists($baseDir) ? 'true' : 'false'));
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create session directory',
            'debug' => [
                'sessionId' => $sessionId,
                'baseDir' => $baseDir,
                'mkdir_result' => !@mkdir($baseDir, 0700, true),
                'is_dir_after' => is_dir($baseDir),
                'file_exists_after' => file_exists($baseDir)
            ]
        ]);
        exit;
    }
}

// Security: Ensure directory has correct permissions
if (!@chmod($baseDir, 0700)) {
    error_log("Warning: Failed to set directory permissions on: $baseDir");
}

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
    error_log("file_put_contents result: " . (file_put_contents($filepath, $jsonOutput, LOCK_EX) === false ? 'failed' : 'success'));
    error_log("File path: $filepath");
    error_log("File exists before write: " . (file_exists($filepath) ? 'true' : 'false'));
    error_log("Is writable: " . (is_writable(dirname($filepath)) ? 'true' : 'false'));
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to write data file',
        'debug' => [
            'sessionId' => $sessionId,
            'filepath' => $filepath,
            'file_exists_before' => file_exists($filepath),
            'dirname_writable' => is_writable(dirname($filepath)),
            'file_put_contents_result' => file_put_contents($filepath, $jsonOutput, LOCK_EX)
        ]
    ]);
    exit;
}

// Security: Set restrictive file permissions (owner read/write only)
if (!@chmod($filepath, 0600)) {
    error_log("Warning: Failed to set file permissions on: $filepath");
}

// Return success response (SECURITY: do not expose filepath)
http_response_code(200);
echo json_encode([
    'success' => true,
    'key' => $filename,
    'message' => 'Data saved successfully',
    'sessionId' => $sessionId
]);

?>
