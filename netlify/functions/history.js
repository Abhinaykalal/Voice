const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const serverless = require('serverless-http');

const app = express();

// Netlify serverless function handler
const handler = async (event, context) => {
  const server = serverless(app);
  return await server(event, context);
};

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://*.netlify.app', 'https://*.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Supabase Setup
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';
let supabase = null;

if (USE_SUPABASE) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized for history function');
  }
}

// GET /history - Retrieve emotion analysis history
app.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    if (!supabase) {
      return res.json({ 
        count: 0,
        limit,
        data: [] 
      });
    }

    const { data, error } = await supabase
      .from('emotion_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch history:', error.message);
      return res.json({ 
        count: 0,
        limit,
        data: [] 
      });
    }

    res.json({ 
      count: data.length,
      limit,
      data: data || [] 
    });
    
  } catch (error) {
    console.error('[History Function] Error:', error);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// DELETE /history - Clear emotion analysis history
app.delete('/history', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ message: 'History cleared successfully' });
    }

    const { error } = await supabase
      .from('emotion_analyses')
      .delete()
      .neq('id', 0);
      
    if (error) {
      console.error('Failed to clear history:', error.message);
    }
    
    res.json({ message: 'History cleared successfully' });
    
  } catch (error) {
    console.error('[History Function] Clear history error:', error);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'History API is running on Netlify' });
});

module.exports = handler;
