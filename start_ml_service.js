const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const PYTHON_PATH = 'python'; // Change to 'python3' for Unix/Linux
const SERVICE_SCRIPT = path.join(__dirname, 'ml_service.py');
const LOG_FILE = path.join(__dirname, 'ml_service.log');

// Create log directory if it doesn't exist
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

console.log(`Starting ML service: ${SERVICE_SCRIPT}`);
console.log(`Logs will be written to: ${LOG_FILE}`);

// Start the Python process
const pythonProcess = spawn(PYTHON_PATH, [SERVICE_SCRIPT]);

// Create a log file stream
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Pipe stdout and stderr to the log file
pythonProcess.stdout.pipe(logStream);
pythonProcess.stderr.pipe(logStream);

// Also log to console
pythonProcess.stdout.on('data', (data) => {
  console.log(`ML Service: ${data}`);
});

pythonProcess.stderr.on('data', (data) => {
  console.error(`ML Service Error: ${data}`);
});

// Handle process exit
pythonProcess.on('close', (code) => {
  console.log(`ML service exited with code ${code}`);
});

// Keep the script running
process.on('SIGINT', () => {
  console.log('Stopping ML service...');
  pythonProcess.kill();
  process.exit();
});

console.log('ML service started. Press Ctrl+C to stop.');