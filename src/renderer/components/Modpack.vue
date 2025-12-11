<template>
    <div class="flex align-middle justify-center">
        <div class="card overflow-hidden  bg-gradient-to-r from-blue-600 to-violet-600 w-72 h-64 shadow-lg hover:shadow-xl cursor-pointer">
            <figure class="p-1">
                <img
                v-lazy="{
                    src: modpack_image_url,
                    loading: placeholderImage,
                    error: placeholderImage
                }"
                alt="Modpack logo"
                class="h-full w-full object-contain pointer-events-none select-none group-hover:select-none" />
            </figure>
            <div class="card-body backdrop-blur-sm bg-white/40 text-primary-content rounded-t-lg p-4">
                <h2 class="card-title pointer-events-none select-none group-hover:select-none">{{ modpack_name }}</h2>
                <p class="pointer-events-none select-none group-hover:select-none">{{modpack_desc}}</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modpack_id: String,
  modpack_name: String,
  modpack_desc: String,
  modpack_image_url: String
})

const placeholderImage = new URL('/modpack-logo-placeholder.png', import.meta.url).href

</script>