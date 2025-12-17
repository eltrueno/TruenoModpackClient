<template>
  <div>
    <!-- Botón toggle -->
    <button class="top-1 right-1 fixed btn btn-outline text-sm btn-sm" @click="toggleSnow" >
      <svg class="w-4" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <polyline style="fill:#9BFBFF;" points="311.652,478.609 311.652,411.826 345.043,411.826 345.043,445.217 411.826,445.217 411.826,411.826 445.217,411.826 445.217,345.043 411.826,345.043 411.826,311.652 478.609,311.652 478.609,278.261 478.609,278.26 478.609,278.261 512,278.261 512,233.739 478.609,233.739 478.609,200.348 411.826,200.348 411.826,166.957 445.217,166.957 445.217,100.174 411.826,100.174 411.826,66.783 345.043,66.783 345.043,100.174 311.652,100.174 311.652,33.391 278.261,33.391 278.259,33.391 278.261,33.391 278.261,0 233.739,0 233.739,33.391 233.737,33.391 200.348,33.391 200.348,100.174 166.957,100.174 166.957,66.783 100.174,66.783 100.174,100.174 66.783,100.174 66.783,166.957 100.174,166.957 100.174,200.348 33.391,200.348 33.391,233.739 0,233.739 0,278.261 33.391,278.261 33.391,278.26 33.391,278.261 33.391,311.652 100.174,311.652 100.174,345.043 66.783,345.043 66.783,411.826 100.174,411.826 100.174,445.217 166.957,445.217 166.957,411.826 200.348,411.826 200.348,478.609 233.737,478.609 233.739,478.609 233.739,512 278.261,512 278.261,478.609 278.259,478.609 "></polyline> <rect x="233.739" width="44.522" height="33.391"></rect> <rect x="100.174" y="66.783" width="66.783" height="33.391"></rect> <rect x="66.783" y="100.174" width="33.391" height="66.783"></rect> <polygon points="166.957,200.348 133.565,200.348 133.565,166.957 100.174,166.957 100.174,200.348 33.391,200.348 33.391,233.739 166.957,233.739 "></polygon> <polygon points="200.348,133.565 200.348,166.957 233.739,166.957 233.739,133.565 233.739,100.174 233.739,33.391 200.348,33.391 200.348,100.174 166.957,100.174 166.957,133.565 "></polygon> <rect x="345.043" y="66.783" width="66.783" height="33.391"></rect> <rect x="411.826" y="100.174" width="33.391" height="66.783"></rect> <polygon points="378.435,200.348 345.043,200.348 345.043,233.739 478.609,233.739 478.609,200.348 411.826,200.348 411.826,166.957 378.435,166.957 "></polygon> <polygon points="278.261,133.565 278.261,166.957 311.652,166.957 311.652,133.565 345.043,133.565 345.043,100.174 311.652,100.174 311.652,33.391 278.261,33.391 278.261,100.174 "></polygon> <rect x="233.739" y="478.609" width="44.522" height="33.391"></rect> <rect x="100.174" y="411.826" width="66.783" height="33.391"></rect> <rect x="66.783" y="345.043" width="33.391" height="66.783"></rect> <polygon points="133.565,311.652 166.957,311.652 166.957,278.261 33.391,278.261 33.391,311.652 100.174,311.652 100.174,345.043 133.565,345.043 "></polygon> <polygon points="233.739,378.435 233.739,345.043 200.348,345.043 200.348,378.435 166.957,378.435 166.957,411.826 200.348,411.826 200.348,478.609 233.739,478.609 233.739,411.826 "></polygon> <rect x="345.043" y="411.826" width="66.783" height="33.391"></rect> <rect x="411.826" y="345.043" width="33.391" height="66.783"></rect> <polygon points="345.043,311.652 378.435,311.652 378.435,345.043 411.826,345.043 411.826,311.652 478.609,311.652 478.609,278.261 345.043,278.261 "></polygon> <polygon points="311.652,378.435 311.652,345.043 278.261,345.043 278.261,378.435 278.261,411.826 278.261,478.609 311.652,478.609 311.652,411.826 345.043,411.826 345.043,378.435 "></polygon> <rect y="233.739" width="33.391" height="44.522"></rect> <rect x="478.609" y="233.739" width="33.391" height="44.522"></rect> </g></svg>
      Modo navideño: {{ isSnowActive ? 'Activo' : 'Inactivo' }}
    </button>

    <!-- Canvas para la nieve -->
    <canvas 
      ref="snowCanvas" 
      v-show="isSnowActive"
      class="snow-canvas"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const snowCanvas = ref(null)
const isSnowActive = ref(true)
const snowflakes = ref([])
const animationId = ref(null)
const maxSnowflakes = 50

const resizeCanvas = () => {
  if (!snowCanvas.value) return
  
  snowCanvas.value.width = window.innerWidth
  snowCanvas.value.height = window.innerHeight
}

const createSnowflakes = () => {
  if (!snowCanvas.value) return
  
  snowflakes.value = []
  const canvas = snowCanvas.value

  for (let i = 0; i < maxSnowflakes; i++) {
    snowflakes.value.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      radius: Math.random() * 4 + 2,
      speed: Math.random() * 1 + 0.5,
      drift: Math.random() * 0.5 - 0.25,
      opacity: Math.random() * 0.6 + 0.4
    })
  }
}

const updateSnowflakes = () => {
  if (!snowCanvas.value) return

  const canvas = snowCanvas.value

  snowflakes.value.forEach(flake => {
    flake.y += flake.speed
    flake.x += flake.drift

    if (flake.y > canvas.height) {
      flake.y = -10
      flake.x = Math.random() * canvas.width
    }

    if (flake.x > canvas.width) {
      flake.x = 0
    } else if (flake.x < 0) {
      flake.x = canvas.width
    }
  })
}

const drawSnowflakes = () => {
  if (!snowCanvas.value) return

  const canvas = snowCanvas.value
  const ctx = canvas.getContext('2d')
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  snowflakes.value.forEach(flake => {
    ctx.save()
    ctx.translate(flake.x, flake.y)
    ctx.strokeStyle = `rgba(255, 255, 255, ${flake.opacity})`
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'

    ctx.beginPath()
    // Dibujar 3 líneas cruzadas para formar una estrella de 6 puntas
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(0, -flake.radius)
      ctx.lineTo(0, flake.radius)
      ctx.rotate(Math.PI / 3)
    }
    ctx.stroke()
    ctx.restore()
  })
}

const animate = () => {
  if (!isSnowActive.value) return

  updateSnowflakes()
  drawSnowflakes()
  animationId.value = requestAnimationFrame(animate)
}

const initSnowfall = () => {
  if (!snowCanvas.value) return

  resizeCanvas()
  createSnowflakes()
  animate()
}

const stopSnowfall = () => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }
}

const toggleSnow = () => {
  isSnowActive.value = !isSnowActive.value
  localStorage.setItem('snowfall-enabled', isSnowActive.value)

  if (isSnowActive.value) {
    nextTick(() => {
      initSnowfall()
    })
  } else {
    stopSnowfall()
  }
}

const handleResize = () => {
  resizeCanvas()
}

onMounted(() => {
  // Cargar preferencia guardada
  const savedPreference = localStorage.getItem('snowfall-enabled')
  isSnowActive.value = savedPreference !== 'false'
  
  if (isSnowActive.value) {
    initSnowfall()
  }

  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  stopSnowfall()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.snow-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -5;
}

.snow-toggle {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  z-index: 10000;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.snow-toggle:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.snow-toggle.active {
  background: rgba(100, 200, 255, 0.2);
  border-color: rgba(100, 200, 255, 0.4);
}
</style>