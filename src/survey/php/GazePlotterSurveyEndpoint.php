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

// Set headers to allow CORS from specific domains
header('Content-Type: application/json');

// Get the origin of the request
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Define allowed origins
$allowedOrigins = [
    'https://gazeplotter.com',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];

// Check if origin is allowed
$isAllowed = false;
foreach ($allowedOrigins as $allowedOrigin) {
    if (strpos($origin, $allowedOrigin) === 0) {
        $isAllowed = true;
        break;
    }
}

// Set CORS headers for allowed origins
if ($isAllowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
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
        'error' => 'Method not allowed. Only POST requests are accepted.'
    ]);
    exit;
}

// Read the JSON payload from the request body
$jsonInput = file_get_contents('php://input');
$data = json_decode($jsonInput, true);

// Validate that JSON was parsed correctly
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON in request body: ' . json_last_error_msg()
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

// Sanitize sessionId to be a valid folder name (remove any dangerous characters)
$sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', $sessionId);

// Base directory where we'll store the data
$baseDir = __DIR__ . '/data/' . $sessionId;

// Create the session directory if it doesn't exist
if (!file_exists($baseDir)) {
    if (!mkdir($baseDir, 0755, true)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Failed to create session directory'
        ]);
        exit;
    }
}

// Generate a unique filename based on timestamp
$timestamp = isset($data['timestamp']) ? $data['timestamp'] : time();
$filename = $timestamp . '_' . uniqid() . '.json';
$filepath = $baseDir . '/' . $filename;

// Prepare the data to save (already flattened from the endpoint service)
// We'll store everything as-is since the endpoint service already flattens the data
$dataToSave = $data;

// Convert to JSON with pretty formatting for readability
$jsonOutput = json_encode($dataToSave, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

// Write the JSON to file
if (file_put_contents($filepath, $jsonOutput) === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to write data to file'
    ]);
    exit;
}

// Return success response with the generated filename
http_response_code(200);
echo json_encode([
    'success' => true,
    'key' => $filename,
    'message' => 'Data saved successfully',
    'sessionId' => $sessionId,
    'filepath' => $filepath
]);

?>

