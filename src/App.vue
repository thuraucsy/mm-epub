<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";

const books = ref([]);
const loading = ref(true);
const error = ref(null);

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

    <div v-else style="display: flex; flex-wrap: wrap; gap: 10px;">
      <div v-for="(book, index) in books" :key="index" 
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
