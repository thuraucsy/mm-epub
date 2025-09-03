<script setup>
import { ref, onMounted, computed } from "vue";
import axios from "axios";

const books = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedAuthor = ref("");
const selectedCategory = ref("");
const selectedBook = ref(null);
const showBookDetail = ref(false);

onMounted(async () => {
  try {
    const res = await axios.get("https://tanintharyi.github.io/myanmar-epub/v1/summary.json");
    books.value = res.data.book;
  } catch (err) {
    error.value = "Failed to load books.";
  } finally {
    loading.value = false;
  }

  // Handle browser back button
  window.addEventListener('popstate', handlePopState);
});

// Handle browser back/forward navigation
const handlePopState = (event) => {
  if (event.state && event.state.bookDetail) {
    // If state indicates book detail should be open
    const book = books.value.find(b => b.name === event.state.bookName);
    if (book) {
      selectedBook.value = book;
      showBookDetail.value = true;
    }
  } else {
    // Close book detail if no state or state doesn't indicate book detail
    showBookDetail.value = false;
    selectedBook.value = null;
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

// Filter books by selected author and category
const filteredBooks = computed(() => {
  let filtered = books.value;
  
  if (selectedAuthor.value) {
    filtered = filtered.filter(book => book.author === selectedAuthor.value);
  }
  
  if (selectedCategory.value) {
    filtered = filtered.filter(book => book.category === selectedCategory.value);
  }
  
  return filtered;
});

// helper function to build image URL from author + title
const getImageUrl = (author, filename) => {
  const encodedAuthor = encodeURIComponent(author);
  const encodedFilename = encodeURIComponent(filename);
  const imgUrl = `https://tanintharyi.github.io/myanmar-epub/v1/author/${encodedAuthor}/${encodedFilename}.jpg`;
  console.log("imgUrl", imgUrl);
  return imgUrl;
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
  
  // Go back in history if we're currently showing a book detail
  if (window.location.hash.startsWith('#book-')) {
    window.history.back();
  }
};
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-4">📚 Myanmar EPUB Book List</h1>

    <div v-if="loading">Loading books...</div>
    <div v-else-if="error" class="text-red-600">{{ error }}</div>

    <div v-else>
      <!-- Filters -->
      <div style="margin-bottom: 20px;">
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
        
        <!-- Results Info -->
        <div v-if="selectedAuthor || selectedCategory" class="results-info">
          Showing {{ filteredBooks.length }} books
          <span v-if="selectedAuthor"> by {{ selectedAuthor }}</span>
          <span v-if="selectedCategory"> in {{ selectedCategory }}</span>
        </div>
      </div>

      <!-- Books Grid -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <div v-for="(book, index) in filteredBooks" :key="index" 
             class="book-card"
             @click="showBookDetails(book)">
          <img
            v-if="book.isCoverImg"
            :src="getImageUrl(book.author, book.name)"
            alt="Book Cover"
            class="book-image"
          />
          <div class="book-title">{{ book.name }}</div>
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
                :src="getImageUrl(selectedBook.author, selectedBook.name)"
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
              
              <div class="book-description">
                <h3>Description</h3>
                <p v-if="selectedBook.description">{{ selectedBook.description }}</p>
                <p v-else-if="selectedBook.summary">{{ selectedBook.summary }}</p>
                <p v-else class="no-description">
                  Description မရှိပါ။
                </p>
              </div>
              
              <div class="book-actions">
                <button class="action-button primary">📖 Read Book</button>
                <button class="action-button secondary">💾 Download</button>
                <button class="action-button secondary">❤️ Add to Favorites</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

.results-info {
  color: #666;
  font-size: 14px;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.action-button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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
</style>
