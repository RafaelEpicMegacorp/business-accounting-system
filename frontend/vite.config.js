import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git commit hash at build time
let commitHash = 'dev';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Could not get git commit hash');
}

export default defineConfig({
  plugins: [react()],
  define: {
    '__COMMIT_HASH__': JSON.stringify(commitHash),
  },
  server: {
    port: 5173
  }
})
