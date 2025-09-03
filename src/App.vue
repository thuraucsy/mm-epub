<script setup>
import { ref, onMounted, computed } from "vue";
import axios from "axios";

const books = ref([]);
const loading = ref(true);
const error = ref(null);
const selectedAuthor = ref("");
const selectedCategory = ref("");

onMounted(async () => {
  try {
    const res = await axios.get("https://tanintharyi.github.io/myanmar-epub/v1/summary.json");
    books.value = res.data.book;
  } catch (err) {
    error.value = "Failed to load books.";
  } finally {
    loading.value = false;
  }
});

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
             class="book-card">
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

/* Ensure consistent card heights */
.grid > div {
  display: flex;
  flex-direction: column;
}

.grid > div img {
  flex-shrink: 0;
}
</style>
