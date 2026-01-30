# AMA Chat Application

A professional chat application that provides expertise through an MCP server. Built with React, TypeScript, and Vite.

## Features

- Clean, modern chat interface
- Real-time communication with MCP server
- Mobile-responsive design
- Professional styling suitable for production deployment
- TypeScript for type safety
- Optimized build for production deployment

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn
- MCP server running on http://localhost:3000

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3001 in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Production Deployment

### Building for Production

```bash
npm run build
```

This creates a `dist/` folder with optimized static files ready for deployment.

### Bluehost Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Upload contents of `dist/` folder to your Bluehost subdomain directory:
   - Via File Manager: Upload all files from `dist/` to `/public_html/ama/`
   - Via FTP: Upload to the appropriate subdomain folder

3. Configure subdomain:
   - In Bluehost cPanel, go to "Subdomains"
   - Create subdomain: `ama.yourdomain.com`
   - Point document root to folder containing the uploaded files

4. Update production API endpoint:
   - In `src/App.tsx`, update the production URL:
   ```typescript
   const API_BASE_URL = process.env.NODE_ENV === 'production' 
     ? 'https://your-mcp-server-domain.com'  // Update this
     : 'http://localhost:3000';
   ```

### Environment Variables

For production deployment, you may want to use environment variables:

Create `.env.production`:
```
VITE_API_BASE_URL=https://your-production-mcp-server.com
```

Then update `App.tsx` to use:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

## Architecture

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Modern CSS with Inter font
- **API**: Connects to existing MCP server at `/cv-question` endpoint
- **Responsive**: Mobile-first design with media queries

## API Integration

The app connects to the existing MCP server endpoints:
- `POST /cv-question` - Send questions and receive responses
- Expects JSON format: `{ question: string, jobDescription?: string }`
- Returns: `{ success: boolean, response: string }`

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License
```
