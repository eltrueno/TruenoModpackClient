<template>
    <div class="flex align-middle justify-center">
        <div class="card overflow-hidden  bg-gradient-to-r from-blue-600 to-violet-600 w-80 h-80 shadow-lg hover:shadow-xl cursor-pointer">
            <figure class="p-1">
                <img
                :src=modpack_image_url
                @error="defaultTopImage"
                alt="Modpack logo"
                class="h-full w-full object-contain pointer-events-none select-none group-hover:select-none" />
            </figure>
            <div class="card-body backdrop-blur-sm bg-white/40 text-primary-content rounded-t-lg">
                <h2 class="card-title pointer-events-none select-none group-hover:select-none">{{ modpack_name }}</h2>
                <p class="pointer-events-none select-none group-hover:select-none">{{modpack_desc}}</p>
            </div>
        </div>
    </div>
</template>

<script setup>
const props = defineProps({
  modpack_id: String,
  modpack_name: String,
  modpack_desc: String,
  modpack_image_url: String
})

function defaultTopImage(e){
    e.target.src = '/modpack-logo-placeholder.png'
}

</script>