// Utility functions for finding and executing commands
import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Cache for command paths
const commandPaths = new Map();

// Find the full path to a command
export function findCommand(command) {
  // Check cache first
  if (commandPaths.has(command)) {
    return commandPaths.get(command);
  }
  
  try {
    // Use 'which' to find the command
    const path = execSync(`which ${command}`, { encoding: 'utf8' }).trim();
    commandPaths.set(command, path);
    return path;
  } catch (error) {
    // Try common locations
    const commonPaths = [
      `/usr/local/bin/${command}`,
      `/usr/bin/${command}`,
      `/bin/${command}`,
      `/opt/homebrew/bin/${command}`,
    ];
    
    for (const path of commonPaths) {
      try {
        execSync(`test -x ${path}`, { encoding: 'utf8' });
        commandPaths.set(command, path);
        return path;
      } catch {
        // Continue to next path
      }
    }
    
    return null;
  }
}

// Execute a command with proper path resolution
export function spawnCommand(command, args = [], options = {}) {
  // Find the full path to the command
  const commandPath = findCommand(command);
  
  if (!commandPath) {
    throw new Error(`Command not found: ${command}`);
  }
  
  // Use the full path
  return spawn(commandPath, args, {
    ...options,
    env: {
      ...process.env,
      ...options.env
    }
  });
}

// Async wrapper for spawn
export function spawnAsync(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawnCommand(command, args, options);
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        const error = new Error(`Command failed with code ${code}: ${stderr}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
    
    proc.on('error', reject);
  });
}