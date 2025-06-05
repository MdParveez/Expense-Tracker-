// Prediction Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const categorySelect = document.getElementById('category-select');
  const predictBtn = document.getElementById('predict-btn');
  const predictionResults = document.getElementById('prediction-results');
  const loadingSpinner = document.getElementById('loading-spinner');
  const resultContent = document.getElementById('result-content');
  const errorMessage = document.getElementById('error-message');
  const resultCategory = document.getElementById('result-category');
  const resultMonth = document.getElementById('result-month');
  const resultValue = document.getElementById('result-value');
  const resultConfidence = document.getElementById('result-confidence');
  const historyBody = document.getElementById('history-body');

  // Additional elements for model details
  const modelTypeElement = document.getElementById('model-type');
  const modelFeaturesElement = document.getElementById('model-features');

  // Get user from localStorage for greeting
  const user = JSON.parse(localStorage.getItem('user'));
  document.getElementById('greeting').textContent = `Welcome, ${user.name}`;

  // Disable predict button initially
  predictBtn.disabled = true;

  // Load categories when page loads
  loadCategories();

  // Add event listener to category select
  categorySelect.addEventListener('change', function() {
    predictBtn.disabled = !this.value;
  });

  // Add event listener to predict button
  predictBtn.addEventListener('click', function() {
    const selectedCategory = categorySelect.value;
    if (selectedCategory) {
      generatePrediction(selectedCategory);
    }
  });

  // Load categories from API
  async function loadCategories() {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/categories', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const categories = await response.json();

      // Filter only expense categories
      const expenseCategories = categories.filter(category => category.type === 'expense');

      // Clear existing options except the first one
      while (categorySelect.options.length > 1) {
        categorySelect.remove(1);
      }

      // Populate category dropdown
      expenseCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error loading categories:', err);
      showError('Failed to load categories. Please refresh the page and try again.');
    }
  }

  // Generate prediction for selected category
  async function generatePrediction(category) {
    try {
      // Show loading spinner
      predictionResults.style.display = 'block';
      loadingSpinner.style.display = 'block';
      resultContent.style.display = 'none';
      errorMessage.style.display = 'none';

      const token = localStorage.getItem('token');

      // Try to get model information first
      let modelInfo = null;
      try {
        const modelResponse = await fetch(`/api/ml/model/${category}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (modelResponse.ok) {
          const modelData = await modelResponse.json();
          modelInfo = modelData.model;
        }
      } catch (modelErr) {
        console.warn('Could not get model info:', modelErr);
      }

      // Try to get prediction
      let response = await fetch(`/api/ml/predict/${category}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // If model doesn't exist, train it first
      if (response.status === 404) {
        console.log('Model not found, training new model');

        // Train model
        const trainResponse = await fetch('/api/ml/train', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ category })
        });

        if (!trainResponse.ok) {
          const errorData = await trainResponse.json();
          throw new Error(errorData.message || 'Failed to train model');
        }

        // Get prediction data from training response
        const trainData = await trainResponse.json();
        displayPrediction(trainData, category, modelInfo);

        // Also load recent expenses
        loadRecentExpenses(category);
      } else if (!response.ok) {
        throw new Error('Failed to generate prediction');
      } else {
        // Model exists, display prediction
        const predictionData = await response.json();
        displayPrediction(predictionData, category, modelInfo);

        // Load recent expenses
        loadRecentExpenses(category);
      }
    } catch (err) {
      console.error('Error generating prediction:', err);
      showError(err.message || 'Failed to generate prediction. Please try again.');
    }
  }

  // Display prediction result
  function displayPrediction(data, category, modelInfo) {
    // Hide loading spinner
    loadingSpinner.style.display = 'none';
    resultContent.style.display = 'block';

    // Populate result data
    resultCategory.textContent = category;
    resultMonth.textContent = data.next_month || 'next month';
    resultValue.textContent = parseFloat(data.prediction).toLocaleString();
    resultConfidence.textContent = data.confidence || 75;

    // Display model details if available
    if (modelTypeElement) {
      const modelType = data.model_type || (modelInfo?.metadata?.model_type) || 'Statistical model';
      modelTypeElement.textContent = formatModelType(modelType);
    }

    if (modelFeaturesElement && (data.features_used || (modelInfo?.metadata?.features))) {
      const features = data.features_used || modelInfo?.metadata?.features || ['amount', 'date'];
      modelFeaturesElement.textContent = features.join(', ');
    }


  }

  // Format model type for display
  function formatModelType(modelType) {
    switch(modelType) {
      case 'linear':
        return 'Linear Regression';
      case 'ridge':
        return 'Ridge Regression';
      case 'gradient_boosting':
        return 'Gradient Boosting';
      case 'js_fallback':
        return 'Statistical Model';
      case 'saved_model':
        return 'Machine Learning Model';
      case 'robust_linear':
      case 'simple_linear':
        return 'Linear Regression';
      case 'average':
        return 'Average Model';
      case 'average_with_trend':
        return 'Trend Analysis';
      case 'statistical':
        return 'Weighted Statistical Model';
      default:
        return modelType.charAt(0).toUpperCase() + modelType.slice(1).replace('_', ' ');
    }
  }

  // Load recent expenses for the category
  async function loadRecentExpenses(category) {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/expenses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load expenses');
      }

      const expenses = await response.json();

      // Filter expenses by category and sort by date (newest first)
      const filteredExpenses = expenses
        .filter(exp => exp.category === category)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5); // Get only the 5 most recent

      // Clear history table
      historyBody.innerHTML = '';

      // Populate history table
      if (filteredExpenses.length > 0) {
        filteredExpenses.forEach(expense => {
          const row = document.createElement('tr');

          // Format date
          const date = new Date(expense.date);
          const formattedDate = date.toLocaleDateString();

          row.innerHTML = `
            <td>${formattedDate}</td>
            <td>₹${parseFloat(expense.amount).toLocaleString()}</td>
          `;
          historyBody.appendChild(row);
        });
      } else {
        // No recent expenses
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="2">No recent expenses found</td>';
        historyBody.appendChild(row);
      }
    } catch (err) {
      console.error('Error loading recent expenses:', err);
    }
  }

  // Show error message
  function showError(message) {
    loadingSpinner.style.display = 'none';
    resultContent.style.display = 'none';
    errorMessage.style.display = 'block';
    errorMessage.textContent = message;
  }

  // 🍔 Hamburger Menu Functionality
  const menuBtn = document.getElementById('menu-btn');
  const sideMenu = document.getElementById('side-menu');
  const menuOverlay = document.getElementById('menu-overlay');

  // Toggle menu when hamburger button is clicked
  menuBtn.addEventListener('click', function() {
    sideMenu.classList.toggle('open');
    menuOverlay.classList.toggle('open');
  });

  // Close menu when clicking outside
  menuOverlay.addEventListener('click', function() {
    sideMenu.classList.remove('open');
    menuOverlay.classList.remove('open');
  });
});

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}