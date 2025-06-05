const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Configuration for ML service
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

// Cache for prediction results
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const predictionCache = {};

// Add detailed logging for requests
router.use((req, res, next) => {
  console.log(`ML API Request: ${req.method} ${req.path}`);
  next();
});

// Test route (not protected)
router.get('/test', (req, res) => {
  console.log('Test route accessed');
  res.json({ message: 'ML routes are working!' });
});

// Health check for ML service
router.get('/health', async (req, res) => {
  try {
    console.log('Checking ML service health');
    const startTime = Date.now();
    const response = await axios.get(`${ML_SERVICE_URL}/health`);
    const responseTime = Date.now() - startTime;
    
    console.log(`ML service health check response time: ${responseTime}ms`);
    res.json({
      ml_service: 'healthy',
      response_time_ms: responseTime,
      ml_service_status: response.data
    });
  } catch (err) {
    console.error('ML service health check failed:', err.message);
    res.status(500).json({
      ml_service: 'unhealthy',
      error: err.message
    });
  }
});

// Protect all other routes with authentication
router.use(authMiddleware);

// POST endpoint to train a model
router.post('/train', async (req, res) => {
  try {
    const startTime = Date.now();
    const userId = req.user.id;
    const { category } = req.body;
    
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }
    
    console.log(`Training ML model for user ${userId} and category ${category}`);
    
    // Get expenses data for the specified category
    const result = await pool.query(
      'SELECT amount, date FROM expenses WHERE user_id = $1 AND category = $2 ORDER BY date',
      [userId, category]
    );
    
    console.log(`Found ${result.rows.length} expenses for category ${category}`);
    
    if (result.rows.length < 3) {
      return res.status(400).json({ 
        error: 'Not enough data to train model', 
        message: 'You need at least 3 expenses in this category to generate predictions' 
      });
    }
    
    // Prepare data for ML service
    const requestData = {
      expenses: result.rows,
      user_id: userId,
      category: category
    };
    
    console.log('Sending training request to ML service');
    
    try {
      // Send request to ML service
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/train`, requestData, {
        timeout: 30000 // 30 second timeout
      });
      
      const modelData = mlResponse.data;
      console.log('ML service training complete:', modelData);
      
      // Save model data to database
      try {
        // Check if model already exists
        const existingModel = await pool.query(
          'SELECT id FROM ml_models WHERE user_id = $1 AND model_type = $2',
          [userId, category]
        );
        
        const modelMetadata = {
          model_type: modelData.model_type || 'ml_model',
          features: modelData.features_used || ['amount'],
          metrics: modelData.metrics || {},
          training_time: modelData.training_time
        };
        
        if (existingModel.rows.length > 0) {
          // Update existing model
          await pool.query(
            'UPDATE ml_models SET categories = $1, max_amount = $2, metadata = $3, created_at = CURRENT_TIMESTAMP WHERE user_id = $4 AND model_type = $5',
            [JSON.stringify([category]), modelData.max_amount, JSON.stringify(modelMetadata), userId, category]
          );
          console.log('Updated existing model in database');
        } else {
          // Create new model
          await pool.query(
            'INSERT INTO ml_models (user_id, model_type, categories, max_amount, metadata) VALUES ($1, $2, $3, $4, $5)',
            [userId, category, JSON.stringify([category]), modelData.max_amount, JSON.stringify(modelMetadata)]
          );
          console.log('Created new model in database');
        }
        
        // Set cache
        const cacheKey = `${userId}_${category}`;
        predictionCache[cacheKey] = {
          data: {
            success: true,
            prediction: modelData.prediction,
            accuracy: modelData.accuracy,
            confidence: modelData.accuracy,
            category: category,
            next_month: modelData.next_month,
            model_type: modelData.model_type || 'ml_model'
          },
          timestamp: Date.now()
        };
        
        const totalTime = Date.now() - startTime;
        console.log(`Total training time: ${totalTime}ms (ML service: ${modelData.training_time * 1000}ms)`);
        
        res.json({ 
          success: true, 
          message: 'Model trained successfully',
          prediction: modelData.prediction,
          accuracy: modelData.accuracy,
          confidence: modelData.accuracy,
          next_month: modelData.next_month,
          model_type: modelData.model_type || 'ml_model',
          processing_time_ms: totalTime
        });
      } catch (dbErr) {
        console.error('Database error:', dbErr);
        res.status(500).json({ error: 'Database error', details: dbErr.message });
      }
    } catch (mlErr) {
      console.error('ML service error:', mlErr.message);
      
      // If ML service is down or times out, return an error
      return res.status(503).json({
        error: 'ML service unavailable',
        message: 'The prediction service is currently unavailable. Please try again later.',
        details: mlErr.message
      });
    }
  } catch (err) {
    console.error('Error in /ml/train:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET endpoint to predict next month's expense for a category
router.get('/predict/:category', async (req, res) => {
  try {
    const startTime = Date.now();
    const userId = req.user.id;
    const { category } = req.params;
    
    console.log(`Predicting expenses for user ${userId} and category ${category}`);
    
    // Check cache first
    const cacheKey = `${userId}_${category}`;
    if (predictionCache[cacheKey] && 
        (Date.now() - predictionCache[cacheKey].timestamp) < CACHE_DURATION) {
      console.log('Returning cached prediction');
      const cachedData = predictionCache[cacheKey].data;
      return res.json({
        ...cachedData,
        cached: true,
        cache_age_seconds: Math.floor((Date.now() - predictionCache[cacheKey].timestamp) / 1000)
      });
    }
    
    // Get the model for this category
    const modelResult = await pool.query(
      'SELECT * FROM ml_models WHERE user_id = $1 AND model_type = $2',
      [userId, category]
    );
    
    console.log(`Found ${modelResult.rows.length} models for category ${category}`);
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Model not found', 
        message: 'You need to train a model for this category first' 
      });
    }
    
    const model = modelResult.rows[0];
    
    // Get recent expenses for this category
    const expensesResult = await pool.query(
      'SELECT amount, date FROM expenses WHERE user_id = $1 AND category = $2 ORDER BY date DESC LIMIT 5',
      [userId, category]
    );
    
    console.log(`Found ${expensesResult.rows.length} recent expenses`);
    
    if (expensesResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No expenses found', 
        message: 'No recent expenses found for this category' 
      });
    }
    
    // Prepare data for ML service
    const requestData = {
      recent_expenses: expensesResult.rows,
      user_id: userId,
      category: category,
      model_info: {
        max_amount: model.max_amount,
        categories: model.categories,
        metadata: model.metadata
      }
    };
    
    console.log('Sending prediction request to ML service');
    
    try {
      // Send request to ML service with timeout
      const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict`, requestData, {
        timeout: 10000 // 10 second timeout
      });
      
      const predictionData = mlResponse.data;
      console.log('ML service prediction complete:', predictionData);
      
      // Prepare response
      const responseData = {
        success: true,
        prediction: predictionData.prediction,
        confidence: predictionData.confidence,
        category: category,
        next_month: predictionData.next_month,
        model_type: predictionData.model_type || 'ml_model',
        features_used: predictionData.features_used || ['amount'],
        processing_time_ms: Date.now() - startTime
      };
      
      // Cache the result
      predictionCache[cacheKey] = {
        data: responseData,
        timestamp: Date.now()
      };
      
      res.json(responseData);
    } catch (mlErr) {
      console.error('ML service error:', mlErr.message);
      
      // If ML service is down or times out, return an error
      return res.status(503).json({
        error: 'ML service unavailable',
        message: 'The prediction service is currently unavailable. Please try again later.',
        details: mlErr.message
      });
    }
  } catch (err) {
    console.error('Error in /ml/predict:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET expenses history for a specific category
router.get('/history/:category', async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.params;
    
    // Get recent expenses for this category
    const result = await pool.query(
      'SELECT id, title, amount, date FROM expenses WHERE user_id = $1 AND category = $2 ORDER BY date DESC LIMIT 10',
      [userId, category]
    );
    
    res.json({
      success: true,
      history: result.rows
    });
  } catch (err) {
    console.error('Error getting expense history:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET model details for a specific category
router.get('/model/:category', async (req, res) => {
  try {
    const userId = req.user.id;
    const { category } = req.params;
    
    // Get model for this category
    const result = await pool.query(
      'SELECT * FROM ml_models WHERE user_id = $1 AND model_type = $2',
      [userId, category]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Model not found', 
        message: 'No model found for this category' 
      });
    }
    
    const model = result.rows[0];
    
    // Return model details
    res.json({
      success: true,
      model: {
        id: model.id,
        category: category,
        created_at: model.created_at,
        metadata: model.metadata,
        max_amount: model.max_amount
      }
    });
  } catch (err) {
    console.error('Error getting model details:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Clear prediction cache for testing
router.post('/clear-cache', (req, res) => {
  const keysCleared = Object.keys(predictionCache).length;
  for (const key in predictionCache) {
    delete predictionCache[key];
  }
  console.log(`Cleared ${keysCleared} predictions from cache`);
  res.json({ 
    success: true, 
    message: `Cleared ${keysCleared} predictions from cache` 
  });
});

module.exports = router;