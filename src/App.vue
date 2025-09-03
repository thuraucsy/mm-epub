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

    <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div v-for="(book, index) in books" :key="index" class="border rounded p-2 shadow">
        <img
          v-if="book.isCoverImg"
          :src="getImageUrl(book.author, book.name)"
          alt="Book Cover"
          class="w-full h-48 object-cover rounded"
        />
        <div class="mt-2 font-semibold">{{ book.title }}</div>
        <div class="text-sm text-gray-600">{{ book.author }}</div>
      </div>
    </div>
  </div>
</template>

<style>
body {
  font-family: sans-serif;
}
</style>
