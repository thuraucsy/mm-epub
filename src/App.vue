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
          <label style="font-weight: bold; margin-right: 10px;">Filter by Author:</label>
          <select 
            v-model="selectedAuthor" 
            style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background: white; min-width: 200px;">
            <option value="">All Authors ({{ books.length }} books)</option>
            <option v-for="author in authors" :key="author" :value="author">
              {{ author }} ({{ books.filter(b => b.author === author).length }} books)
            </option>
          </select>
        </div>
        
        <!-- Category Filter -->
        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; margin-right: 10px;">Filter by Category:</label>
          <select 
            v-model="selectedCategory" 
            style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background: white; min-width: 200px;">
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }} ({{ books.filter(b => b.category === category).length }} books)
            </option>
          </select>
        </div>
        
        <!-- Results Info -->
        <div v-if="selectedAuthor || selectedCategory" style="color: #666; font-size: 14px;">
          Showing {{ filteredBooks.length }} books
          <span v-if="selectedAuthor"> by {{ selectedAuthor }}</span>
          <span v-if="selectedCategory"> in {{ selectedCategory }}</span>
        </div>
      </div>

      <!-- Books Grid -->
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        <div v-for="(book, index) in filteredBooks" :key="index" 
             style="display: inline-block; width: 100px; border: 1px solid #ccc; border-radius: 8px; padding: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); vertical-align: top;">
          <img
            v-if="book.isCoverImg"
            :src="getImageUrl(book.author, book.name)"
            alt="Book Cover"
            style="width: 80px; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px; display: block;"
          />
          <div style="font-size: 10px; font-weight: bold; line-height: 1.2; margin-bottom: 4px; width: 80px; overflow: hidden; text-overflow: ellipsis;">{{ book.name }}</div>
          <div style="font-size: 10px; color: #666; line-height: 1.2; width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ book.author }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
body {
  font-family: sans-serif;
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
