import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Optional: Set to true to expose the server on your local network
    strictPort: true, // Optional: Exits if the port is already in use instead of trying the next available one
  },
})
