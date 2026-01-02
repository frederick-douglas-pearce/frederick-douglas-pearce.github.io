/**
 * ESG News Filter
 * Client-side filtering for ESG news articles by brand, category, and sentiment.
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  function init() {
    // DOM elements
    const brandFilter = document.getElementById('brandFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const sentimentFilter = document.getElementById('sentimentFilter');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const resultsCount = document.getElementById('resultsCount');
    const noResults = document.getElementById('noResults');

    // Check if we're on the ESG news page
    if (!brandFilter || !categoryFilter) {
      return;
    }

    // Get all article cards
    const articles = document.querySelectorAll('.esg-news-card');
    const totalArticles = articles.length;

    /**
     * Get selected values from a multi-select element
     */
    function getSelectedValues(selectElement) {
      const selected = [];
      for (const option of selectElement.selectedOptions) {
        selected.push(option.value);
      }
      return selected;
    }

    /**
     * Check if any value in array1 exists in array2
     */
    function hasIntersection(arr1, arr2) {
      return arr1.some(val => arr2.includes(val));
    }

    /**
     * Filter articles based on current selections
     */
    function filterArticles() {
      const selectedBrands = getSelectedValues(brandFilter);
      const selectedCategories = getSelectedValues(categoryFilter);
      const selectedSentiment = sentimentFilter.value;

      let visibleCount = 0;

      articles.forEach(article => {
        const articleBrands = article.dataset.brands ? article.dataset.brands.split(',') : [];
        const articleCategories = article.dataset.categories ? article.dataset.categories.split(',') : [];
        const articleSentiments = article.dataset.sentiments ? article.dataset.sentiments.split(',').filter(s => s) : [];

        let show = true;

        // Brand filter (OR logic - show if article has any selected brand)
        if (selectedBrands.length > 0) {
          show = show && hasIntersection(selectedBrands, articleBrands);
        }

        // Category filter (OR logic - show if article has any selected category)
        if (selectedCategories.length > 0) {
          show = show && hasIntersection(selectedCategories, articleCategories);
        }

        // Sentiment filter
        if (selectedSentiment) {
          show = show && articleSentiments.includes(selectedSentiment);
        }

        // Show/hide article
        article.style.display = show ? '' : 'none';
        if (show) visibleCount++;
      });

      // Update results count
      if (selectedBrands.length === 0 && selectedCategories.length === 0 && !selectedSentiment) {
        resultsCount.textContent = '';
      } else {
        resultsCount.textContent = `Showing ${visibleCount} of ${totalArticles} articles`;
      }

      // Show/hide no results message
      noResults.style.display = visibleCount === 0 ? '' : 'none';
    }

    /**
     * Clear all filters
     */
    function clearFilters() {
      // Clear multi-selects
      for (const option of brandFilter.options) {
        option.selected = false;
      }
      for (const option of categoryFilter.options) {
        option.selected = false;
      }
      sentimentFilter.value = '';

      // Re-filter (show all)
      filterArticles();
    }

    /**
     * Setup evidence toggle buttons with manual collapse handling
     */
    function setupEvidenceToggles() {
      const toggleButtons = document.querySelectorAll('.evidence-toggle');

      toggleButtons.forEach(button => {
        const targetId = button.getAttribute('data-bs-target');
        const target = document.querySelector(targetId);

        if (target) {
          // Remove Bootstrap's data attributes to prevent conflicts
          button.removeAttribute('data-bs-toggle');

          // Add click handler for manual toggle
          button.addEventListener('click', function(e) {
            e.preventDefault();

            const isVisible = target.classList.contains('show');

            if (isVisible) {
              // Hide
              target.classList.remove('show');
              target.style.display = 'none';
              button.textContent = 'Show Evidence';
              button.setAttribute('aria-expanded', 'false');
            } else {
              // Show
              target.classList.add('show');
              target.style.display = 'block';
              button.textContent = 'Hide Evidence';
              button.setAttribute('aria-expanded', 'true');
            }
          });

          // Initialize hidden state
          target.style.display = 'none';
        }
      });
    }

    // Event listeners
    brandFilter.addEventListener('change', filterArticles);
    categoryFilter.addEventListener('change', filterArticles);
    sentimentFilter.addEventListener('change', filterArticles);
    clearFiltersBtn.addEventListener('click', clearFilters);

    // Initialize evidence toggles
    setupEvidenceToggles();

    // Initial count display
    resultsCount.textContent = '';
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
