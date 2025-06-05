#!/usr/bin/env python3
import sys
import json
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import joblib

# Directory for storing models
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'saved_models')

def predict_next_expense():
    try:
        # Read input data
        input_data = sys.argv[1]
        data = json.loads(input_data)
        
        # Get additional params if available
        user_id = None
        category = None
        if len(sys.argv) > 2:
            params = json.loads(sys.argv[2])
            user_id = params.get('user_id')
            category = params.get('category')
        
        recent_expenses = data['recent_expenses']
        model_data = data['model']
        
        # Try to load a saved model first if user_id and category are provided
        model = None
        if user_id and category:
            model_path = os.path.join(MODEL_DIR, f'model_{user_id}_{category.replace(" ", "_")}.joblib')
            if os.path.exists(model_path):
                try:
                    model = joblib.load(model_path)
                except Exception as e:
                    print(f"Error loading model: {str(e)}", file=sys.stderr)
        
        # Convert expenses to DataFrame
        df = pd.DataFrame(recent_expenses)
        df['date'] = pd.to_datetime(df['date'])
        df['amount'] = pd.to_numeric(df['amount'])
        
        # If we have a saved model, use it for prediction
        if model:
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
                model_step = model.named_steps.get('model')
                if hasattr(model_step, 'feature_names_in_'):
                    model_features = model_step.feature_names_in_
            except:
                # If can't determine features, use a default set
                model_features = [
                    'month', 'day_of_month', 'is_weekend',
                    'days_since_first', 'seq', 'trend',
                    'prev_amount', 'rolling_mean_3'
                ]
            
            # Filter only the features the model expects
            pred_features = {k: v for k, v in next_month_features.items() if k in model_features}
            
            # Create DataFrame for prediction
            pred_df = pd.DataFrame([pred_features])
            
            # Handle missing features by adding zeros
            for feature in model_features:
                if feature not in pred_df.columns:
                    pred_df[feature] = 0
            
            # Ensure columns are in the correct order
            pred_df = pred_df[model_features]
            
            # Make prediction
            prediction = model.predict(pred_df)[0]
            
            # Calculate confidence based on model accuracy and data variability
            avg_amount = df['amount'].mean()
            std_dev = df['amount'].std()
            coefficient_of_variation = std_dev / avg_amount if avg_amount > 0 else 1
            confidence = max(0, min(100, 100 * (1 - coefficient_of_variation)))
            
            # Get next month string
            next_month = next_month_date.strftime('%B %Y')
            
            # Return result
            result = {
                'prediction': round(float(prediction), 2),
                'confidence': round(float(confidence), 2),
                'next_month': next_month,
                'model_type': 'saved_model',
                'features_used': list(model_features)
            }
            
        else:
            # Use a fallback statistical approach if no model is available
            # Sort by date
            df = df.sort_values('date')
            
            # Calculate basic statistics
            avg_amount = df['amount'].mean()
            max_amount = float(model_data.get('max_amount', df['amount'].max()))
            
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
            min_amount = df['amount'].min()
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
                'features_used': ['amount', 'weights', 'trend']
            }
        
        # Convert NaN to null for JSON compatibility
        for key, value in result.items():
            if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
                result[key] = None
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'prediction': 0,
            'confidence': 50.0,
            'error': str(e),
            'next_month': 'Error'
        }))

if __name__ == "__main__":
    predict_next_expense()