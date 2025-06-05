from flask import Flask, request, jsonify
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.ensemble import  GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
from datetime import datetime, timedelta
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Directory for storing models
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'saved_models')
os.makedirs(MODEL_DIR, exist_ok=True)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/train', methods=['POST'])
def train_model():
    """Train a model based on historical expense data"""
    start_time = time.time()
    logger.info("Received training request")
    
    try:
        # Get data from request
        data = request.json
        expenses = data.get('expenses', [])
        user_id = data.get('user_id')
        category = data.get('category')
        
        logger.info(f"Training model for user {user_id}, category {category} with {len(expenses)} expenses")
        
        # Convert to DataFrame
        df = pd.DataFrame(expenses)
        df['date'] = pd.to_datetime(df['date'])
        df['amount'] = pd.to_numeric(df['amount'])
        
        logger.info(f"Data loaded: {df.shape}")
        
        # Check if we have enough data
        if len(df) < 5:
            logger.warning("Not enough data for ML model")
            result = {
                'prediction': round(float(df['amount'].mean()), 2),
                'accuracy': 50.0,  # Low accuracy due to limited data
                'max_amount': float(df['amount'].max()),
                'model_type': 'average',
                'next_month': (df['date'].max() + timedelta(days=30)).strftime('%B %Y'),
                'features_used': ['amount'],
                'error': 'Not enough data for advanced models',
                'training_time': round(time.time() - start_time, 2)
            }
            return jsonify(result)
        
        logger.info("Extracting features")
        # Extract features from date
        df['month'] = df['date'].dt.month
        df['year'] = df['date'].dt.year
        df['day_of_month'] = df['date'].dt.day
        df['day_of_week'] = df['date'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
        
        # Create time-based features
        df = df.sort_values('date')
        df['days_since_first'] = (df['date'] - df['date'].min()).dt.days
        
        # Add sequence features
        df['seq'] = range(len(df))
        
        # Create lag features (previous amounts)
        df['prev_amount'] = df['amount'].shift(1)
        df['prev_amount_2'] = df['amount'].shift(2)
        df['prev_amount_3'] = df['amount'].shift(3)
        
        # Rolling statistics
        df['rolling_mean_2'] = df['amount'].rolling(window=2).mean()
        df['rolling_mean_3'] = df['amount'].rolling(window=3).mean()
        df['rolling_std_3'] = df['amount'].rolling(window=3).std()
        
        # Trend and seasonality detection
        df['trend'] = df['seq'] / max(1, df['seq'].max())
        
        # Drop rows with NaN (first few rows due to lag features)
        df_clean = df.dropna().copy()
        
        if len(df_clean) < 3:
            logger.warning("Not enough data after feature engineering")
            # Not enough data after creating lag features
            result = {
                'prediction': round(float(df['amount'].mean()), 2),
                'accuracy': 60.0,
                'max_amount': float(df['amount'].max()),
                'model_type': 'average_with_trend',
                'next_month': (df['date'].max() + timedelta(days=30)).strftime('%B %Y'),
                'features_used': ['amount', 'trend'],
                'error': 'Limited data after feature engineering',
                'training_time': round(time.time() - start_time, 2)
            }
            return jsonify(result)
        
        # Features to use
        features = [
            'month', 'day_of_month', 'is_weekend',
            'days_since_first', 'seq', 'trend',
            'prev_amount', 'rolling_mean_3'
        ]
        
        # Remove features with too many NaNs
        features = [f for f in features if df_clean[f].isnull().sum() == 0]
        logger.info(f"Using features: {features}")
        
        # Prepare data for modeling
        X = df_clean[features]
        y = df_clean['amount']
        
        # Split data if we have enough samples
        has_test_data = True
        if len(df_clean) >= 5:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )
        else:
            # Not enough data for test split
            X_train, y_train = X, y
            X_test, y_test = X.iloc[:1], y.iloc[:1]  # Just use one sample for metrics
            has_test_data = False
        
        logger.info("Training models")
        # Choose model based on data size
        if len(df_clean) >= 10:
            # Try different models
            models = {
                'linear': LinearRegression(),
                'ridge': Ridge(alpha=1.0),
                'gradient_boosting': GradientBoostingRegressor(n_estimators=50, max_depth=3)
            }
            
            best_model_name = None
            best_model = None
            best_score = float('-inf')
            model_scores = {}
            
            for name, model in models.items():
                logger.info(f"Trying {name} model")
                pipeline = Pipeline([
                    ('scaler', StandardScaler()),
                    ('model', model)
                ])
                
                pipeline.fit(X_train, y_train)
                score = pipeline.score(X_test, y_test) if has_test_data else 0.7
                model_scores[name] = score
                logger.info(f"{name} model score: {score}")
                
                if score > best_score:
                    best_score = score
                    best_model_name = name
                    best_model = pipeline
                    
            # If all models perform poorly, use a simpler approach
            if best_score < 0:
                logger.warning("All models performed poorly, using robust linear model")
                best_model = Pipeline([
                    ('scaler', StandardScaler()),
                    ('model', LinearRegression())
                ])
                best_model.fit(X_train, y_train)
                best_model_name = 'robust_linear'
        else:
            logger.info("Using simple linear model due to limited data")
            # For small datasets, use a simple model
            best_model = Pipeline([
                ('scaler', StandardScaler()),
                ('model', LinearRegression())
            ])
            best_model.fit(X_train, y_train)
            best_model_name = 'simple_linear'
            best_score = 0.7  # Approximate score for small datasets
        
        # Evaluate model
        logger.info("Evaluating model")
        train_pred = best_model.predict(X_train)
        mae_train = mean_absolute_error(y_train, train_pred)
        
        if has_test_data:
            test_pred = best_model.predict(X_test)
            mae_test = mean_absolute_error(y_test, test_pred)
            rmse_test = np.sqrt(mean_squared_error(y_test, test_pred))
            r2 = r2_score(y_test, test_pred)
            accuracy = max(0, min(100, 100 * (1 - mae_test / y_test.mean())))
        else:
            mae_test = mae_train
            rmse_test = np.sqrt(mean_squared_error(y_train, train_pred))
            r2 = r2_score(y_train, train_pred)
            accuracy = max(0, min(100, 100 * (1 - mae_train / y_train.mean())))
        
        # Save the model if user_id and category are provided
        if user_id is not None and category is not None:
            model_filename = f'model_{user_id}_{category.replace(" ", "_")}.joblib'
            model_path = os.path.join(MODEL_DIR, model_filename)
            logger.info(f"Saving model to {model_path}")
            # Save the entire pipeline
            joblib.dump(best_model, model_path)
        
        # Get next month data
        last_date = df['date'].max()
        next_month_date = last_date + timedelta(days=30)
        
        # Prepare features for prediction
        last_row = df_clean.iloc[-1].copy()
        
        # Create next month features
        next_month_features = {
            'month': next_month_date.month,
            'day_of_month': next_month_date.day,
            'is_weekend': 1 if next_month_date.weekday() >= 5 else 0,
            'days_since_first': (next_month_date - df['date'].min()).days,
            'seq': df_clean['seq'].max() + 1,
            'trend': (df_clean['seq'].max() + 1) / (df_clean['seq'].max() + 1),
            'prev_amount': df_clean['amount'].iloc[-1],
            'rolling_mean_3': df_clean['amount'].tail(3).mean()
        }
        
        # Filter only the features we're using
        next_month_features = {k: v for k, v in next_month_features.items() if k in features}
        
        # Create a DataFrame for prediction
        pred_df = pd.DataFrame([next_month_features])
        
        # Make prediction
        logger.info("Making prediction")
        prediction = best_model.predict(pred_df)[0]
        
        # Ensure prediction is reasonable (not negative, not extreme)
        min_amount = df['amount'].min()
        max_amount = df['amount'].max()
        avg_amount = df['amount'].mean()
        
        # If prediction seems unreasonable, adjust it
        if prediction < 0 or prediction > max_amount * 2:
            logger.warning(f"Prediction {prediction} seems unreasonable, adjusting")
            # Use a weighted average of prediction and recent values
            adjusted_prediction = 0.5 * avg_amount + 0.5 * df_clean['amount'].tail(3).mean()
            prediction = max(min_amount * 0.5, min(adjusted_prediction, max_amount * 1.5))
            logger.info(f"Adjusted prediction to {prediction}")

        # Calculate confidence based on model performance and data consistency
        confidence_score = min(100, max(0, accuracy))
        
        # Format next month
        next_month = next_month_date.strftime('%B %Y')
        
        # Return results
        metrics = {
            'mae_train': round(float(mae_train), 2),
            'mae_test': round(float(mae_test), 2) if has_test_data else None,
            'rmse_test': round(float(rmse_test), 2) if has_test_data else None,
            'r2': round(float(r2), 4)
        }
        
        # Filter out None values
        metrics = {k: v for k, v in metrics.items() if v is not None}
        
        result = {
            'prediction': round(float(prediction), 2),
            'accuracy': round(float(confidence_score), 2),
            'max_amount': float(max_amount),
            'model_type': best_model_name,
            'next_month': next_month,
            'features_used': features,
            'metrics': metrics,
            'training_time': round(time.time() - start_time, 2)
        }
        
        logger.info(f"Training complete in {round(time.time() - start_time, 2)} seconds")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in training: {str(e)}", exc_info=True)
        return jsonify({
            'prediction': 0,
            'accuracy': 50.0,
            'max_amount': 0,
            'error': str(e),
            'next_month': 'Error',
            'training_time': round(time.time() - start_time, 2)
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Make a prediction using a saved model or statistical methods"""
    start_time = time.time()
    logger.info("Received prediction request")
    
    try:
        data = request.json
        recent_expenses = data.get('recent_expenses', [])
        user_id = data.get('user_id')
        category = data.get('category')
        
        logger.info(f"Predicting for user {user_id}, category {category} with {len(recent_expenses)} recent expenses")
        
        # Check if we have a saved model
        model = None
        model_path = None
        
        if user_id is not None and category is not None:
            model_filename = f'model_{user_id}_{category.replace(" ", "_")}.joblib'
            model_path = os.path.join(MODEL_DIR, model_filename)
            if os.path.exists(model_path):
                logger.info(f"Loading saved model from {model_path}")
                try:
                    model = joblib.load(model_path)
                    logger.info("Model loaded successfully")
                except Exception as e:
                    logger.error(f"Error loading model: {str(e)}", exc_info=True)
        
        # Convert expenses to DataFrame
        df = pd.DataFrame(recent_expenses)
        df['date'] = pd.to_datetime(df['date'])
        df['amount'] = pd.to_numeric(df['amount'])
        
        # If we have a saved model, use it for prediction
        if model is not None:
            logger.info("Using saved model for prediction")
            # Extract features
            df['month'] = df['date'].dt.month
            df['day_of_month'] = df['date'].dt.day
            df['day_of_week'] = df['date'].dt.dayofweek
            df['is_weekend'] = df['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)
            
            # Sort by date
            df = df.sort_values('date')
            
            # Calculate days since first expense
            first_date = df['date'].min()
            df['days_since_first'] = (df['date'] - first_date).dt.days
            
            # Add sequence
            df['seq'] = range(len(df))
            
            # Add rolling statistics
            df['rolling_mean_3'] = df['amount'].rolling(window=min(3, len(df))).mean()
            df['prev_amount'] = df['amount'].shift(1)
            
            # Fill missing values due to rolling calculations
            df = df.fillna(method='bfill').fillna(method='ffill')
            
            # Get next month date
            last_date = df['date'].max()
            next_month_date = last_date + timedelta(days=30)
            
            # Create features for prediction
            next_month_features = {
                'month': next_month_date.month,
                'day_of_month': next_month_date.day,
                'is_weekend': 1 if next_month_date.weekday() >= 5 else 0,
                'days_since_first': (next_month_date - first_date).days,
                'seq': df['seq'].max() + 1,
                'trend': (df['seq'].max() + 1) / (df['seq'].max() + 1),
                'prev_amount': df['amount'].iloc[-1],
                'rolling_mean_3': df['amount'].tail(min(3, len(df))).mean()
            }
            
            # Get feature names from the model pipeline
            model_features = []
            try:
                # For sklearn pipelines
                if hasattr(model, 'named_steps'):
                    model_step = model.named_steps.get('model')
                    if hasattr(model_step, 'feature_names_in_'):
                        model_features = list(model_step.feature_names_in_)
                        logger.info(f"Features from model: {model_features}")
            except Exception as e:
                logger.warning(f"Could not get feature names from model: {str(e)}")
                # Default feature set
                model_features = [
                    'month', 'day_of_month', 'is_weekend',
                    'days_since_first', 'seq', 'trend',
                    'prev_amount', 'rolling_mean_3'
                ]
            
            # Filter only the features the model expects
            pred_features = {k: v for k, v in next_month_features.items() if k in model_features}
            logger.info(f"Using features for prediction: {pred_features.keys()}")
            
            # Create DataFrame for prediction
            pred_df = pd.DataFrame([pred_features])
            
            # Handle missing features by adding zeros
            for feature in model_features:
                if feature not in pred_df.columns:
                    logger.info(f"Adding missing feature {feature}")
                    pred_df[feature] = 0
            
            # Ensure columns are in the correct order
            if model_features:
                logger.info("Reordering features")
                pred_df = pred_df[model_features]
            
            # Make prediction
            logger.info("Making prediction with model")
            prediction = model.predict(pred_df)[0]
            logger.info(f"Raw prediction: {prediction}")
            
            # Get stats for confidence and bounds check
            avg_amount = df['amount'].mean()
            max_amount = df['amount'].max()
            min_amount = df['amount'].min()
            std_dev = df['amount'].std()
            
            # Ensure prediction is reasonable
            if prediction < 0 or prediction > max_amount * 2:
                logger.warning(f"Prediction {prediction} seems unreasonable, adjusting")
                # Use a weighted average of prediction and recent values
                adjusted_prediction = 0.5 * avg_amount + 0.5 * df['amount'].tail(3).mean()
                prediction = max(min_amount * 0.5, min(adjusted_prediction, max_amount * 1.5))
                logger.info(f"Adjusted prediction to {prediction}")
            
            # Calculate confidence based on model accuracy and data variability
            coefficient_of_variation = std_dev / avg_amount if avg_amount > 0 else 1
            confidence = max(0, min(100, 100 * (1 - coefficient_of_variation)))
            
            # Get next month string
            next_month = next_month_date.strftime('%B %Y')
            
            result = {
                'prediction': round(float(prediction), 2),
                'confidence': round(float(confidence), 2),
                'next_month': next_month,
                'model_type': 'saved_model',
                'features_used': list(pred_features.keys()) if pred_features else ['amount'],
                'prediction_time': round(time.time() - start_time, 2)
            }
            
        else:
            logger.info("No saved model found, using statistical approach")
            # Use statistical approach
            # Sort by date
            df = df.sort_values('date')
            
            # Calculate basic statistics
            avg_amount = df['amount'].mean()
            max_amount = df['amount'].max()
            min_amount = df['amount'].min()
            
            # Weighted average (more recent expenses have higher weight)
            weights = np.linspace(0.5, 1.0, len(df))
            weighted_avg = np.average(df['amount'], weights=weights)
            
            # Simple trend analysis
            if len(df) >= 3:
                x = np.arange(len(df))
                y = df['amount'].values
                coeffs = np.polyfit(x, y, 1)
                trend = coeffs[0]  # Slope indicates trend
            else:
                trend = 0
            
            # Prediction with trend adjustment
            prediction = 0.7 * weighted_avg + 0.3 * avg_amount
            
            # Add trend effect (limited to prevent extreme predictions)
            trend_effect = min(0.2 * avg_amount, abs(trend * len(df))) * (1 if trend > 0 else -1)
            prediction += trend_effect
            
            # Ensure prediction is within reasonable bounds
            prediction = max(min_amount * 0.5, min(prediction, max_amount * 1.5))
            
            # Calculate confidence
            std_dev = df['amount'].std()
            coefficient_of_variation = std_dev / avg_amount if avg_amount > 0 else 1
            confidence = max(0, min(100, 100 * (1 - coefficient_of_variation)))
            
            # Get next month date
            last_date = df['date'].max()
            next_month_date = last_date + timedelta(days=30)
            next_month = next_month_date.strftime('%B %Y')
            
            result = {
                'prediction': round(float(prediction), 2),
                'confidence': round(float(confidence), 2),
                'next_month': next_month,
                'model_type': 'statistical',
                'features_used': ['amount', 'weights', 'trend'],
                'prediction_time': round(time.time() - start_time, 2)
            }
        
        logger.info(f"Prediction complete in {round(time.time() - start_time, 2)} seconds")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}", exc_info=True)
        return jsonify({
            'prediction': 0,
            'confidence': 50.0,
            'error': str(e),
            'next_month': 'Error',
            'prediction_time': round(time.time() - start_time, 2)
        }), 500

if __name__ == '__main__':
    # Load scikit-learn in advance to speed up first prediction
    from sklearn import ensemble, linear_model
    logger.info("Pre-loading scikit-learn models")
    
    # Preload some common models to speed up first prediction
    _ = LinearRegression()
    _ = Ridge()
    _ = GradientBoostingRegressor(n_estimators=10)
    
    logger.info("Starting Flask server")
    # Run the app with debug disabled in production
    app.run(host='0.0.0.0', port=5000, debug=False)