#!/usr/bin/env node

// Railway entry point - redirects to backend server
const path = require('path');
const { spawn } = require('child_process');

console.log('Starting Voice Emotion Analysis API...');

// Start the backend server
const backendServer = spawn('node', [path.join(__dirname, 'backend', 'server.js')], {
  stdio: 'inherit',
  env: process.env
});

backendServer.on('error', (error) => {
  console.error('Failed to start backend server:', error);
  process.exit(1);
});

backendServer.on('close', (code) => {
  console.log(`Backend server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  backendServer.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  backendServer.kill('SIGTERM');
});
