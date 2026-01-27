/**
 * ESG News Filter with Pagination
 * Client-side filtering and pagination for ESG news articles.
 */

(function () {
  "use strict";

  const ARTICLES_PER_PAGE = 20;

  // Wait for DOM to be ready
  function init() {
    // DOM elements
    const brandFilter = document.getElementById("brandFilter");
    const categoryFilter = document.getElementById("categoryFilter");
    const sentimentFilter = document.getElementById("sentimentFilter");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const datePresetButtons = document.querySelectorAll(".date-preset");
    const clearFiltersBtn = document.getElementById("clearFilters");
    const resultsCount = document.getElementById("resultsCount");
    const noResults = document.getElementById("noResults");
    const paginationContainer = document.getElementById("pagination");

    // Check if we're on the ESG news page
    if (!brandFilter || !categoryFilter) {
      return;
    }

    // Get all article cards
    const allArticles = Array.from(document.querySelectorAll(".esg-news-card"));
    const totalArticles = allArticles.length;

    // State
    let currentPage = 1;
    let filteredArticles = [...allArticles];

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
      return arr1.some((val) => arr2.includes(val));
    }

    /**
     * Parse a date string (YYYY-MM-DD) to Date object at start of day
     */
    function parseDate(dateStr) {
      if (!dateStr) return null;
      const [year, month, day] = dateStr.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    /**
     * Format a Date object to YYYY-MM-DD string
     */
    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    /**
     * Get filtered articles based on current selections
     */
    function getFilteredArticles() {
      const selectedBrands = getSelectedValues(brandFilter);
      const selectedCategories = getSelectedValues(categoryFilter);
      const selectedSentiment = sentimentFilter.value;
      const startDate = parseDate(startDateInput?.value);
      const endDate = parseDate(endDateInput?.value);

      return allArticles.filter((article) => {
        const articleBrands = article.dataset.brands ? article.dataset.brands.split(",") : [];
        const articleCategories = article.dataset.categories ? article.dataset.categories.split(",") : [];
        const articleSentiments = article.dataset.sentiments ? article.dataset.sentiments.split(",").filter((s) => s) : [];
        const articleDate = parseDate(article.dataset.date);

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

        // Date range filter
        if (startDate && articleDate) {
          show = show && articleDate >= startDate;
        }
        if (endDate && articleDate) {
          show = show && articleDate <= endDate;
        }

        return show;
      });
    }

    /**
     * Calculate total pages for filtered articles
     */
    function getTotalPages() {
      return Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE);
    }

    /**
     * Display articles for current page
     */
    function displayArticles() {
      const totalPages = getTotalPages();
      const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
      const endIndex = startIndex + ARTICLES_PER_PAGE;

      // Hide all articles first
      allArticles.forEach((article) => {
        article.style.display = "none";
      });

      // Show only articles for current page
      filteredArticles.slice(startIndex, endIndex).forEach((article) => {
        article.style.display = "";
      });

      // Update results count
      if (filteredArticles.length === totalArticles) {
        resultsCount.textContent = `Showing ${Math.min(startIndex + 1, filteredArticles.length)}-${Math.min(endIndex, filteredArticles.length)} of ${
          filteredArticles.length
        } articles`;
      } else {
        resultsCount.textContent = `Showing ${Math.min(startIndex + 1, filteredArticles.length)}-${Math.min(endIndex, filteredArticles.length)} of ${
          filteredArticles.length
        } filtered articles (${totalArticles} total)`;
      }

      // Show/hide no results message
      noResults.style.display = filteredArticles.length === 0 ? "" : "none";

      // Update pagination
      renderPagination();
    }

    /**
     * Render pagination controls
     */
    function renderPagination() {
      const totalPages = getTotalPages();

      if (totalPages <= 1) {
        paginationContainer.innerHTML = "";
        return;
      }

      let html = '<nav aria-label="ESG news pagination"><ul class="pagination justify-content-center">';

      // Previous button
      html += `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
          <span aria-hidden="true">&laquo;</span>
        </a>
      </li>`;

      // Page numbers with ellipsis for large page counts
      const maxVisiblePages = 7;
      let startPage = 1;
      let endPage = totalPages;

      if (totalPages > maxVisiblePages) {
        const halfVisible = Math.floor(maxVisiblePages / 2);
        startPage = Math.max(1, currentPage - halfVisible);
        endPage = Math.min(totalPages, currentPage + halfVisible);

        if (currentPage <= halfVisible) {
          endPage = maxVisiblePages;
        } else if (currentPage >= totalPages - halfVisible) {
          startPage = totalPages - maxVisiblePages + 1;
        }
      }

      // First page and ellipsis
      if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
        if (startPage > 2) {
          html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        }
      }

      // Page numbers
      for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === currentPage ? "active" : ""}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`;
      }

      // Last page and ellipsis
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
        }
        html += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
      }

      // Next button
      html += `<li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
        <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
          <span aria-hidden="true">&raquo;</span>
        </a>
      </li>`;

      html += "</ul></nav>";

      paginationContainer.innerHTML = html;

      // Add click handlers for pagination links
      paginationContainer.querySelectorAll(".page-link[data-page]").forEach((link) => {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          const page = parseInt(this.dataset.page);
          if (page >= 1 && page <= totalPages && page !== currentPage) {
            currentPage = page;
            displayArticles();
            // Scroll to top of articles
            document.getElementById("articlesContainer").scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }

    /**
     * Filter articles and reset to page 1
     */
    function filterArticles() {
      filteredArticles = getFilteredArticles();
      currentPage = 1;
      displayArticles();
    }

    /**
     * Set date range based on number of days from today
     */
    function setDateRange(days) {
      if (days === "all") {
        startDateInput.value = "";
        endDateInput.value = "";
      } else {
        const today = new Date();
        const startDate = new Date();
        startDate.setDate(today.getDate() - parseInt(days));
        startDateInput.value = formatDate(startDate);
        endDateInput.value = formatDate(today);
      }

      // Update active state on preset buttons
      datePresetButtons.forEach((btn) => {
        btn.classList.remove("active");
        if (btn.dataset.days === String(days)) {
          btn.classList.add("active");
        }
      });

      filterArticles();
    }

    /**
     * Clear preset button active state when custom dates are entered
     */
    function clearPresetActive() {
      datePresetButtons.forEach((btn) => {
        btn.classList.remove("active");
      });
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
      sentimentFilter.value = "";

      // Clear date filters and set "All" as active
      if (startDateInput) startDateInput.value = "";
      if (endDateInput) endDateInput.value = "";
      datePresetButtons.forEach((btn) => {
        btn.classList.remove("active");
        if (btn.dataset.days === "all") {
          btn.classList.add("active");
        }
      });

      // Re-filter (show all)
      filterArticles();
    }

    /**
     * Setup evidence toggle buttons with manual collapse handling
     */
    function setupEvidenceToggles() {
      const toggleButtons = document.querySelectorAll(".evidence-toggle");

      toggleButtons.forEach((button) => {
        const targetId = button.getAttribute("data-bs-target");
        const target = document.querySelector(targetId);

        if (target) {
          // Remove Bootstrap's data attributes to prevent conflicts
          button.removeAttribute("data-bs-toggle");

          // Add click handler for manual toggle
          button.addEventListener("click", function (e) {
            e.preventDefault();

            const isVisible = target.classList.contains("show");

            if (isVisible) {
              // Hide
              target.classList.remove("show");
              target.style.display = "none";
              button.textContent = "Show Evidence";
              button.setAttribute("aria-expanded", "false");
            } else {
              // Show
              target.classList.add("show");
              target.style.display = "block";
              button.textContent = "Hide Evidence";
              button.setAttribute("aria-expanded", "true");
            }
          });

          // Initialize hidden state
          target.style.display = "none";
        }
      });
    }

    // Event listeners
    brandFilter.addEventListener("change", filterArticles);
    categoryFilter.addEventListener("change", filterArticles);
    sentimentFilter.addEventListener("change", filterArticles);
    clearFiltersBtn.addEventListener("click", clearFilters);

    // Date filter event listeners
    if (startDateInput) {
      startDateInput.addEventListener("change", function () {
        clearPresetActive();
        filterArticles();
      });
    }
    if (endDateInput) {
      endDateInput.addEventListener("change", function () {
        clearPresetActive();
        filterArticles();
      });
    }

    // Date preset button event listeners
    datePresetButtons.forEach((btn) => {
      btn.addEventListener("click", function () {
        setDateRange(this.dataset.days);
      });
    });

    // Initialize evidence toggles
    setupEvidenceToggles();

    // Initial display
    filteredArticles = [...allArticles];
    displayArticles();
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
