<script setup>
import { ref, onMounted, computed, nextTick, watch } from "vue";
import axios from "axios";
import ePub from "epubjs";

const books = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedAuthor = ref("");
const selectedCategory = ref("");
const showFavoritesOnly = ref(false);
const searchQuery = ref("");
const selectedBook = ref(null);
const showBookDetail = ref(false);
const favorites = ref([]);
const showEpubReader = ref(false);
const currentBook = ref(null);
const epubBook = ref(null);
const rendition = ref(null);
const showBackToTop = ref(false);
const imageCache = ref(new Map());
const cachedImageUrls = ref(new Map());

// Image caching functions
const getCacheKey = (author, filename) => {
  return `${author}|${filename}`;
};

const isImageCached = (author, filename) => {
  const cacheKey = getCacheKey(author, filename);
  return localStorage.getItem(`img-cache-${cacheKey}`) === 'true';
};

const markImageAsCached = (author, filename) => {
  const cacheKey = getCacheKey(author, filename);
  localStorage.setItem(`img-cache-${cacheKey}`, 'true');
};

const getCachedImageUrl = (author, filename) => {
  const cacheKey = getCacheKey(author, filename);
  return cachedImageUrls.value.get(cacheKey);
};

const cacheImage = async (author, filename) => {
  const cacheKey = getCacheKey(author, filename);
  
  // Check if already cached in memory
  if (cachedImageUrls.value.has(cacheKey)) {
    return cachedImageUrls.value.get(cacheKey);
  }
  
  // Check if marked as cached in localStorage
  if (isImageCached(author, filename)) {
    // Image was cached in a previous session, but blob URL is gone
    // We need to re-download and cache it
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL;
      const encodedAuthor = encodeURIComponent(author);
      const encodedFilename = encodeURIComponent(filename);
      const imgUrl = `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.jpg`;
      
      const response = await fetch(imgUrl);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        cachedImageUrls.value.set(cacheKey, blobUrl);
        return blobUrl;
      }
    } catch (error) {
      console.error('Error re-caching image:', error);
    }
  }
  
  // Download and cache the image for the first time
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const encodedAuthor = encodeURIComponent(author);
    const encodedFilename = encodeURIComponent(filename);
    const imgUrl = `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.jpg`;
    
    const response = await fetch(imgUrl);
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Cache in memory
      cachedImageUrls.value.set(cacheKey, blobUrl);
      
      // Mark as cached in localStorage
      markImageAsCached(author, filename);
      
      console.log(`Image cached for first time: ${author} - ${filename}`);
      return blobUrl;
    }
  } catch (error) {
    console.error('Error caching image:', error);
  }
  
  // Fallback to original URL if caching fails
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const encodedAuthor = encodeURIComponent(author);
  const encodedFilename = encodeURIComponent(filename);
  return `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.jpg`;
};

onMounted(async () => {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const res = await axios.get(`${baseUrl}/summary.json`);
    // Remove books with size_in_bytes <= 1407 from the source data
    books.value = res.data.book.filter(book => {
      return !book.size_in_bytes || book.size_in_bytes > 1407;
    });
  } catch (err) {
    error.value = "Failed to load books.";
  } finally {
    loading.value = false;
  }

  // Load favorites from localStorage
  loadFavorites();

  // Handle browser back button
  window.addEventListener('popstate', handlePopState);
  
  // Handle scroll for back to top button
  window.addEventListener('scroll', handleScroll);
});

// Handle browser back/forward navigation
const handlePopState = (event) => {
  if (event.state && event.state.epubReader) {
    // If state indicates EPUB reader should be open
    const book = books.value.find(b => b.name === event.state.bookName);
    if (book && !showEpubReader.value) {
      openEpubReader(book);
    }
  } else if (event.state && event.state.bookDetail) {
    // If state indicates book detail should be open
    const book = books.value.find(b => b.name === event.state.bookName);
    if (book) {
      selectedBook.value = book;
      showBookDetail.value = true;
    }
    // Close EPUB reader if it's open
    if (showEpubReader.value) {
      closeEpubReader(true); // Skip history back to prevent circular calls
    }
  } else {
    // Close both modals if no state or state doesn't indicate any modal
    if (showEpubReader.value) {
      closeEpubReader(true); // Skip history back to prevent circular calls
    }
    if (showBookDetail.value) {
      showBookDetail.value = false;
      selectedBook.value = null;
    }
  }
};

// Get unique authors for filter dropdown
const authors = computed(() => {
  const uniqueAuthors = [...new Set(books.value.map(book => book.author))];
  return uniqueAuthors.sort();
});

// Get unique categories for filter dropdown
const categories = computed(() => {
  const uniqueCategories = [...new Set(books.value.map(book => book.category).filter(Boolean))];
  return uniqueCategories.sort();
});

// Filter books by selected author, category, favorites, and search query
const filteredBooks = computed(() => {
  let filtered = books.value;
  
  // Search by book name
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(book => 
      book.name.toLowerCase().includes(query)
    );
  }
  
  if (selectedAuthor.value) {
    filtered = filtered.filter(book => book.author === selectedAuthor.value);
  }
  
  if (selectedCategory.value) {
    filtered = filtered.filter(book => book.category === selectedCategory.value);
  }
  
  if (showFavoritesOnly.value) {
    filtered = filtered.filter(book => isFavorite(book));
  }
  
  return filtered;
});
// Get count of favorite books
const favoriteCount = computed(() => {
  return books.value.filter(book => isFavorite(book)).length;
});

// Toggle favorites filter
const toggleFavoritesFilter = () => {
  showFavoritesOnly.value = !showFavoritesOnly.value;
};

// Clear all filters
const clearAllFilters = () => {
  selectedAuthor.value = "";
  selectedCategory.value = "";
  showFavoritesOnly.value = false;
  searchQuery.value = "";
};

// helper function to build image URL from author + title with caching
const getImageUrl = async (author, filename) => {
  const cacheKey = getCacheKey(author, filename);
  
  // Check if already cached in memory
  if (cachedImageUrls.value.has(cacheKey)) {
    return cachedImageUrls.value.get(cacheKey);
  }
  
  // Use the caching mechanism
  return await cacheImage(author, filename);
};

// Reactive function to get cached image URL for template
const getCachedImageUrlForTemplate = (author, filename) => {
  const cacheKey = getCacheKey(author, filename);
  return cachedImageUrls.value.get(cacheKey) || null;
};

// Preload images for visible books
const preloadVisibleImages = async () => {
  const visibleBooks = filteredBooks.value.slice(0, 20); // Load first 20 books
  
  for (const book of visibleBooks) {
    if (book.isCoverImg) {
      try {
        await cacheImage(book.author, book.name);
      } catch (error) {
        console.error('Error preloading image:', error);
      }
    }
  }
};

// Watch for changes in filtered books to preload images
watch(filteredBooks, () => {
  nextTick(() => {
    preloadVisibleImages();
  });
}, { immediate: true });

// Function to get fallback image URL
const getFallbackImageUrl = (author, filename) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const encodedAuthor = encodeURIComponent(author);
  const encodedFilename = encodeURIComponent(filename);
  return `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.jpg`;
};


// Show book detail modal
const showBookDetails = (book) => {
  selectedBook.value = book;
  showBookDetail.value = true;
  
  // Push state to browser history
  window.history.pushState(
    { bookDetail: true, bookName: book.name },
    `${book.name} - Myanmar EPUB Book List`,
    `#book-${encodeURIComponent(book.name)}`
  );
};

// Close book detail modal
const closeBookDetail = () => {
  showBookDetail.value = false;
  selectedBook.value = null;
  
  // Always clear the hash from URL when closing book detail
  if (window.location.hash) {
    // Use replaceState to clear the hash without adding to history
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
};

// Download book function with secure mobile support
const downloadBook = async (book) => {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const encodedAuthor = encodeURIComponent(book.author);
    const encodedFilename = encodeURIComponent(book.name);
    const downloadUrl = `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.epub`;
    
    // Show loading state (you could add a loading indicator here)
    console.log('Starting download for:', book.name);
    
    // Fetch the file as blob to avoid cross-origin issues
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/epub+zip, application/octet-stream, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    // Get the file as blob
    const blob = await response.blob();
    
    // Create object URL for the blob
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Create and trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${book.name}.epub`;
    link.style.display = 'none';
    
    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL after a short delay
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);
    
    console.log('Download completed for:', book.name);
    
  } catch (error) {
    console.error('Download error:', error);
    
    // Fallback to direct link method for older browsers or if fetch fails
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const encodedAuthor = encodeURIComponent(book.author);
    const encodedFilename = encodeURIComponent(book.name);
    const downloadUrl = `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.epub`;
    
    // Open in new tab as fallback
    window.open(downloadUrl, '_blank');
    
    // Show user-friendly message
    alert('Download started. If the file doesn\'t download automatically, please check your browser\'s download settings or try again.');
  }
};

// Favorites management functions
const getFavoriteKey = (book) => {
  return `${book.author}|${book.name}`;
};

const loadFavorites = () => {
  try {
    const savedFavorites = localStorage.getItem('epub-favorites');
    if (savedFavorites) {
      favorites.value = JSON.parse(savedFavorites);
    }
  } catch (error) {
    console.error('Error loading favorites:', error);
    favorites.value = [];
  }
};

const saveFavorites = () => {
  try {
    localStorage.setItem('epub-favorites', JSON.stringify(favorites.value));
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
};

const isFavorite = (book) => {
  const key = getFavoriteKey(book);
  return favorites.value.includes(key);
};

const toggleFavorite = (book) => {
  const key = getFavoriteKey(book);
  const index = favorites.value.indexOf(key);
  
  if (index > -1) {
    // Remove from favorites
    favorites.value.splice(index, 1);
  } else {
    // Add to favorites
    favorites.value.push(key);
  }
  
  // Save to localStorage
  saveFavorites();
};

// EPUB Reader functions
const openEpubReader = async (book) => {
  try {
    currentBook.value = book;
    showEpubReader.value = true;
    
    // Close book detail modal
    showBookDetail.value = false;
    
    // Push EPUB reader state to browser history
    window.history.pushState(
      { epubReader: true, bookName: book.name },
      `Reading: ${book.name} - Myanmar EPUB Book List`,
      `#reading-${encodeURIComponent(book.name)}`
    );
    
    // Get EPUB URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    const encodedAuthor = encodeURIComponent(book.author);
    const encodedFilename = encodeURIComponent(book.name);
    const epubUrl = `${baseUrl}/author/${encodedAuthor}/${encodedFilename}.epub`;
    
    // Wait for next tick to ensure DOM is updated
    await nextTick();
    
    // Initialize EPUB.js
    epubBook.value = ePub(epubUrl);
    
    // Render the book
    const viewerElement = document.getElementById('epub-viewer');
    if (viewerElement) {
      rendition.value = epubBook.value.renderTo(viewerElement, {
        width: '100%',
        height: '100%',
        spread: 'none'
      });
      
      // Display the book
      await rendition.value.display();
      
      // Add navigation event listeners
      document.addEventListener('keydown', handleEpubNavigation);
    }
  } catch (error) {
    console.error('Error opening EPUB:', error);
    alert('Error loading book. Please try again.');
    closeEpubReader();
  }
};

const closeEpubReader = (skipHistoryBack = false) => {
  showEpubReader.value = false;
  currentBook.value = null;
  
  // Clean up EPUB.js instances
  if (rendition.value) {
    rendition.value.destroy();
    rendition.value = null;
  }
  
  if (epubBook.value) {
    epubBook.value.destroy();
    epubBook.value = null;
  }
  
  // Remove event listeners
  document.removeEventListener('keydown', handleEpubNavigation);
  
  // Always clear the hash from URL when closing EPUB reader
  if (window.location.hash) {
    // Use replaceState to clear the hash without adding to history
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
};

const handleEpubNavigation = (event) => {
  if (!rendition.value) return;
  
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      rendition.value.prev();
      break;
    case 'ArrowRight':
      event.preventDefault();
      rendition.value.next();
      break;
    case 'Escape':
      event.preventDefault();
      closeEpubReader();
      break;
  }
};

const goToPrevPage = () => {
  if (rendition.value) {
    rendition.value.prev();
  }
};

const goToNextPage = () => {
  if (rendition.value) {
    rendition.value.next();
  }
};

// Back to top functionality
const handleScroll = () => {
  // Show back to top button when user scrolls down more than 300px
  showBackToTop.value = window.scrollY > 300;
};

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-lg font-bold mb-4">📚 Myanmar EPUB Books</h1>

    <div v-if="loading">Loading books...</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <div v-else>
      <!-- Filters -->
      <div style="margin-bottom: 20px;">
        <!-- Search Filter -->
        <div style="margin-bottom: 15px;">
          <label class="filter-label">Search by Book Name:</label>
          <input 
            v-model="searchQuery"
            type="text"
            placeholder="Enter book name..."
            class="search-input"
          />
        </div>
        
        <!-- Author Filter -->
        <div style="margin-bottom: 15px;">
          <label class="filter-label">Filter by Author:</label>
          <select 
            v-model="selectedAuthor" 
            class="filter-select">
            <option value="">All Authors ({{ books.length }} books)</option>
            <option v-for="author in authors" :key="author" :value="author">
              {{ author }} ({{ books.filter(b => b.author === author).length }} books)
            </option>
          </select>
        </div>
        
        <!-- Category Filter -->
        <div style="margin-bottom: 15px;">
          <label class="filter-label">Filter by Category:</label>
          <select 
            v-model="selectedCategory" 
            class="filter-select">
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }} ({{ books.filter(b => b.category === category).length }} books)
            </option>
          </select>
        </div>
        
        <!-- Favorites Filter -->
        <div style="margin-bottom: 15px;">
          <button 
            @click="toggleFavoritesFilter"
            class="favorites-filter-button"
            :class="{ 'favorites-active': showFavoritesOnly }">
            {{ showFavoritesOnly ? '💖' : '❤️' }} 
            {{ showFavoritesOnly ? 'Show All Books' : 'Show Favorites Only' }}
            <span v-if="favoriteCount > 0">({{ favoriteCount }})</span>
          </button>
        </div>
        
        <!-- Clear Filters Button -->
        <div v-if="selectedAuthor || selectedCategory || showFavoritesOnly || searchQuery.trim()" style="margin-bottom: 15px;">
          <button 
            @click="clearAllFilters"
            class="clear-filters-button">
            🗑️ Clear All Filters
          </button>
        </div>
        
        <!-- Results Info -->
        <div v-if="selectedAuthor || selectedCategory || showFavoritesOnly" class="results-info">
          Showing {{ filteredBooks.length }} books
          <span v-if="selectedAuthor"> by {{ selectedAuthor }}</span>
          <span v-if="selectedCategory"> in {{ selectedCategory }}</span>
          <span v-if="showFavoritesOnly"> from favorites</span>
        </div>
      </div>

      <!-- Books Grid -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <div v-for="(book, index) in filteredBooks" :key="index" 
             class="book-card"
             :class="{ 'book-card-favorite': isFavorite(book) }"
             @click="showBookDetails(book)">
          <div class="book-image-container">
            <img
              v-if="book.isCoverImg"
              :src="getCachedImageUrlForTemplate(book.author, book.name) || getFallbackImageUrl(book.author, book.name)"
              alt="Book Cover"
              class="book-image"
            />
            <div v-else class="book-image-placeholder">
              📚
            </div>
            <div v-if="isFavorite(book)" class="favorite-indicator">💖</div>
          </div>
          <div class="book-title">{{ books.length - books.findIndex(b => b === book) }}. {{ book.name }}</div>
          <div class="book-author">{{ book.author }}</div>
        </div>
      </div>
    </div>

    <!-- Book Detail Modal -->
    <div v-if="showBookDetail" class="modal-overlay" @click="closeBookDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <button class="close-button" @click="closeBookDetail">&times;</button>
        </div>
        
        <div class="modal-body" v-if="selectedBook">
          <div class="book-detail-layout">
            <!-- Book Cover -->
            <div class="book-cover-section">
              <img
                v-if="selectedBook.isCoverImg"
                :src="getCachedImageUrlForTemplate(selectedBook.author, selectedBook.name) || getFallbackImageUrl(selectedBook.author, selectedBook.name)"
                alt="Book Cover"
                class="detail-book-image"
              />
              <div v-else class="no-cover-placeholder">
                📚 No Cover Available
              </div>
            </div>
            
            <!-- Book Information -->
            <div class="book-info-section">
              <h2 class="detail-book-title">{{ selectedBook.name || selectedBook.title }}</h2>
              <p class="detail-book-author">by {{ selectedBook.author }}</p>
              
              <div class="book-metadata">
                <div v-if="selectedBook.category" class="metadata-item">
                  <strong>Category:</strong> {{ selectedBook.category }}
                </div>
                <div v-if="selectedBook.language" class="metadata-item">
                  <strong>Language:</strong> {{ selectedBook.language }}
                </div>
                <div v-if="selectedBook.publishedDate" class="metadata-item">
                  <strong>Published:</strong> {{ selectedBook.publishedDate }}
                </div>
                <div v-if="selectedBook.pages" class="metadata-item">
                  <strong>Pages:</strong> {{ selectedBook.pages }}
                </div>
              </div>
              
              <div class="book-actions">
                <button class="action-button primary" @click="openEpubReader(selectedBook)">📖 Read Book</button>
                <button class="action-button secondary" @click="downloadBook(selectedBook)">
                  💾 Download<span v-if="selectedBook.size"> ({{ selectedBook.size }})</span>
                </button>
                <button 
                  class="action-button secondary" 
                  @click="toggleFavorite(selectedBook)"
                  :class="{ 'favorite-active': isFavorite(selectedBook) }">
                  {{ isFavorite(selectedBook) ? '💖' : '❤️' }} 
                  {{ isFavorite(selectedBook) ? 'Remove from Favorites' : 'Add to Favorites' }}
                </button>
              </div>
              
              <div class="book-description">
                <h3>Description</h3>
                <p v-if="selectedBook.description">{{ selectedBook.description }}</p>
                <p v-else-if="selectedBook.summary">{{ selectedBook.summary }}</p>
                <p v-else class="no-description">
                  Description မရှိပါ။
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- EPUB Reader Modal -->
    <div v-if="showEpubReader" class="epub-reader-overlay">
      <div class="epub-reader-container">
        <!-- Reader Header -->
        <div class="epub-reader-header">
          <div class="epub-book-info">
            <h3 v-if="currentBook">{{ currentBook.name }}</h3>
            <p v-if="currentBook">by {{ currentBook.author }}</p>
          </div>
          <button class="epub-close-button" @click="closeEpubReader">&times;</button>
        </div>
        
        <!-- Reader Content -->
        <div class="epub-reader-content">
          <div id="epub-viewer" class="epub-viewer"></div>
        </div>
        
        <!-- Reader Controls -->
        <div class="epub-reader-controls">
          <button class="epub-nav-button" @click="goToPrevPage">← Previous</button>
          <div class="epub-controls-info">
            Use arrow keys to navigate • Press ESC to close
          </div>
          <button class="epub-nav-button" @click="goToNextPage">Next →</button>
        </div>
      </div>
    </div>

    <!-- Back to Top Button -->
    <button 
      v-if="showBackToTop" 
      @click="scrollToTop" 
      class="back-to-top-button"
      aria-label="Back to top">
      ↑
    </button>
  </div>
</template>

<style>
body {
  font-family: sans-serif;
}

/* Filter styles with dark mode support */
.filter-label {
  font-weight: bold;
  margin-right: 10px;
  color: #333;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  color: #333;
  min-width: 200px;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  color: #333;
  min-width: 300px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.search-input::placeholder {
  color: #999;
}

.results-info {
  color: #666;
  font-size: 14px;
}

/* Favorites filter button styles */
.favorites-filter-button {
  padding: 10px 16px;
  border: 2px solid #ff6b6b;
  border-radius: 8px;
  background: white;
  color: #d63031;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.favorites-filter-button:hover {
  background: #ffe6e6;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

.favorites-filter-button.favorites-active {
  background: #ff6b6b;
  color: white;
  border-color: #e55656;
}

.favorites-filter-button.favorites-active:hover {
  background: #e55656;
  box-shadow: 0 2px 8px rgba(229, 86, 86, 0.4);
}

.favorites-filter-button span {
  font-size: 12px;
  opacity: 0.8;
}

/* Clear filters button styles */
.clear-filters-button {
  padding: 8px 14px;
  border: 1px solid #6c757d;
  border-radius: 6px;
  background: white;
  color: #6c757d;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.clear-filters-button:hover {
  background: #f8f9fa;
  border-color: #5a6268;
  color: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(108, 117, 125, 0.2);
}

/* Book card styles */
.book-card {
  display: inline-block;
  width: 90px;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  vertical-align: top;
  background: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.book-image-container {
  position: relative;
}

.book-image {
  width: 75px;
  height: 95px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 6px;
  display: block;
  margin-left: auto;
  margin-right: auto;
}

.favorite-indicator {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.book-image-placeholder {
  width: 75px;
  height: 95px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  margin-left: auto;
  margin-right: auto;
}

.book-title {
  font-size: 9px;
  font-weight: bold;
  line-height: 1.2;
  margin-bottom: 3px;
  width: 75px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}

.book-author {
  font-size: 9px;
  color: #666;
  line-height: 1.2;
  width: 75px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Dark mode styles */
@media (prefers-color-scheme: dark) {
  .filter-label {
    color: #e5e5e5;
  }
  
  .filter-select {
    background: #2a2a2a;
    color: #e5e5e5;
    border-color: #555;
  }
  
  .filter-select option {
    background: #2a2a2a;
    color: #e5e5e5;
  }
  
  .results-info {
    color: #aaa;
  }
  
  .book-card {
    background: #1a1a1a;
    border-color: #444;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  
  .book-title {
    color: #e5e5e5;
  }
  
  .book-author {
    color: #aaa;
  }
  
  /* Dark mode favorites filter button */
  .favorites-filter-button {
    background: #2a2a2a;
    border-color: #ff6b6b;
    color: #ff6b6b;
  }
  
  .favorites-filter-button:hover {
    background: #333;
  }
  
  .favorites-filter-button.favorites-active {
    background: #ff6b6b;
    color: white;
  }
  
  .favorites-filter-button.favorites-active:hover {
    background: #e55656;
  }
  
  /* Dark mode clear filters button */
  .clear-filters-button {
    background: #2a2a2a;
    border-color: #6c757d;
    color: #aaa;
  }
  
  .clear-filters-button:hover {
    background: #333;
    border-color: #5a6268;
    color: #ccc;
  }
  
  /* Dark mode search input */
  .search-input {
    background: #2a2a2a;
    color: #e5e5e5;
    border-color: #555;
  }
  
  .search-input:focus {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }
  
  .search-input::placeholder {
    color: #aaa;
  }
}

/* Custom styles for text truncation */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  position: relative;
}

.modal-header {
  padding: 20px 20px 0 20px;
  display: flex;
  justify-content: flex-end;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: #f0f0f0;
}

.modal-body {
  padding: 0 20px 20px 20px;
}

.book-detail-layout {
  display: flex;
  gap: 30px;
  flex-wrap: wrap;
}

.book-cover-section {
  flex: 0 0 200px;
  text-align: center;
}

.detail-book-image {
  width: 200px;
  height: 280px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.no-cover-placeholder {
  width: 200px;
  height: 280px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
}

.book-info-section {
  flex: 1;
  min-width: 300px;
}

.detail-book-title {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
  line-height: 1.3;
}

.detail-book-author {
  font-size: 18px;
  color: #666;
  margin-bottom: 20px;
  font-style: italic;
}

.book-metadata {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.metadata-item {
  margin-bottom: 8px;
  font-size: 14px;
}

.metadata-item:last-child {
  margin-bottom: 0;
}

.metadata-item strong {
  color: #333;
  margin-right: 8px;
}

.book-description {
  margin-bottom: 30px;
}

.book-description h3 {
  font-size: 20px;
  color: #333;
  margin-bottom: 12px;
}

.book-description p {
  font-size: 16px;
  line-height: 1.6;
  color: #555;
}

.no-description {
  font-style: italic;
  color: #888;
}

.book-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-button {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-button.primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.action-button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.action-button.secondary {
  background: #f8f9fa;
  color: #333;
  border: 1px solid #dee2e6;
}

.action-button.secondary:hover {
  background: #e9ecef;
  transform: translateY(-1px);
}

.action-button.favorite-active {
  background: #ffe6e6;
  border-color: #ff6b6b;
  color: #d63031;
}

.action-button.favorite-active:hover {
  background: #ffd3d3;
  border-color: #e55656;
}


/* Dark mode modal styles */
@media (prefers-color-scheme: dark) {
  .modal-content {
    background: #1a1a1a;
  }
  
  .close-button {
    color: #aaa;
  }
  
  .close-button:hover {
    background-color: #333;
  }
  
  .detail-book-title {
    color: #e5e5e5;
  }
  
  .detail-book-author {
    color: #aaa;
  }
  
  .book-metadata {
    background: #2a2a2a;
  }
  
  .metadata-item strong {
    color: #e5e5e5;
  }
  
  .book-description h3 {
    color: #e5e5e5;
  }
  
  .book-description p {
    color: #ccc;
  }
  
  .action-button.secondary {
    background: #2a2a2a;
    color: #e5e5e5;
    border-color: #444;
  }
  
  .action-button.secondary:hover {
    background: #333;
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }
  
  .book-detail-layout {
    flex-direction: column;
    gap: 20px;
  }
  
  .book-cover-section {
    flex: none;
  }
  
  .detail-book-image,
  .no-cover-placeholder {
    width: 150px;
    height: 210px;
  }
  
  .detail-book-title {
    font-size: 24px;
  }
  
  .book-actions {
    justify-content: center;
  }
}

/* Ensure consistent card heights */
.grid > div {
  display: flex;
  flex-direction: column;
}

.grid > div img {
  flex-shrink: 0;
}

/* EPUB Reader Styles */
.epub-reader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  z-index: 2000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.epub-reader-container {
  width: 95%;
  height: 95%;
  max-width: 1200px;
  max-height: 900px;
  background: white;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.epub-reader-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
  border-radius: 12px 12px 0 0;
}

.epub-book-info h3 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.epub-book-info p {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #666;
  font-style: italic;
}

.epub-close-button {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #666;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.epub-close-button:hover {
  background-color: #e9ecef;
}

.epub-reader-content {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  position: relative;
}

.epub-viewer {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
}

.epub-reader-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-top: 1px solid #e5e5e5;
  background: #f8f9fa;
  border-radius: 0 0 12px 12px;
}

.epub-nav-button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.epub-nav-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.epub-nav-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.epub-controls-info {
  font-size: 12px;
  color: #666;
  text-align: center;
  flex: 1;
  margin: 0 20px;
}

/* Dark mode EPUB reader styles */
@media (prefers-color-scheme: dark) {
  .epub-reader-container {
    background: #1a1a1a;
  }
  
  .epub-reader-header {
    background: #2a2a2a;
    border-bottom-color: #444;
  }
  
  .epub-book-info h3 {
    color: #e5e5e5;
  }
  
  .epub-book-info p {
    color: #aaa;
  }
  
  .epub-close-button {
    color: #aaa;
  }
  
  .epub-close-button:hover {
    background-color: #333;
  }
  
  .epub-reader-controls {
    background: #2a2a2a;
    border-top-color: #444;
  }
  
  .epub-controls-info {
    color: #aaa;
  }
}

/* Mobile responsive for EPUB reader */
@media (max-width: 768px) {
  .epub-reader-container {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
  
  .epub-reader-header {
    border-radius: 0;
    padding: 12px 16px;
  }
  
  .epub-book-info h3 {
    font-size: 16px;
  }
  
  .epub-book-info p {
    font-size: 12px;
  }
  
  .epub-reader-content {
    padding: 16px;
  }
  
  .epub-reader-controls {
    border-radius: 0;
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
  }
  
  .epub-controls-info {
    margin: 0;
    order: -1;
  }
  
  .epub-nav-button {
    flex: 1;
    max-width: 120px;
  }
  
  .epub-nav-button:first-of-type {
    order: 2;
  }
  
  .epub-nav-button:last-of-type {
    order: 1;
  }
}

/* Back to Top Button Styles */
.back-to-top-button {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transition: all 0.3s ease;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-to-top-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.back-to-top-button:active {
  transform: translateY(-1px);
}

/* Dark mode back to top button */
@media (prefers-color-scheme: dark) {
  .back-to-top-button {
    background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .back-to-top-button:hover {
    background: linear-gradient(135deg, #718096 0%, #4a5568 100%);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  }
}

/* Mobile responsive for back to top button */
@media (max-width: 768px) {
  .back-to-top-button {
    bottom: 20px;
    right: 20px;
    width: 45px;
    height: 45px;
    font-size: 18px;
  }
}
</style>
