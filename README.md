# Lightweight NLP Resource Search Backend

A lightweight Node.js backend for NLP-based resource search, optimized for Render's free tier (0.5GB RAM).

## Features

- **Lightweight NLP**: No heavy ML models - uses efficient text matching algorithms
- **Low Memory Usage**: Optimized for 0.5GB RAM on Render free tier
- **Fast Performance**: Simple scoring algorithms for quick responses
- **RESTful API**: Clean API endpoints compatible with existing frontend
- **CORS Enabled**: Ready for frontend integration

## Tech Stack

- **Node.js**: Runtime environment
- **Express**: Lightweight web framework
- **No ML Dependencies**: Uses simple text matching and scoring

## API Endpoints

### Health Check
```
GET /api/health
```

### Resources
```
GET /api/resources
GET /api/resources/:id
Query params: availability, skill, expertise_level, department
```

### Tasks
```
GET /api/tasks
Query params: status, priority
POST /api/tasks/:taskId/assign
POST /api/tasks/:taskId/unassign
```

### Search & Recommendations
```
POST /api/search
Body: { query: string, top_k: number }

POST /api/recommend
Body: { 
  task_description: string,
  task_title?: string,
  task_id?: number,
  top_k?: number,
  use_ai?: boolean
}
```

### Statistics
```
GET /api/stats
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The server will start on `http://localhost:5000`

## Deployment to Render

1. Push your code to GitHub
2. Connect your repository to Render
3. Create a new Web Service
4. Use these settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free

The `render.yaml` file is included for easy deployment.

## Environment Variables

- `PORT`: Server port (default: 5000, Render uses 10000)
- `NODE_ENV`: Environment (production/development)

## Memory Optimization

This backend is designed to use minimal memory:
- No heavy ML model loading
- Simple in-memory data structures
- Efficient text matching algorithms
- No external API dependencies for core functionality

## Frontend Integration

Update your frontend `.env.local` file:
```
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

Remove HuggingFace token requirements from frontend API service.

