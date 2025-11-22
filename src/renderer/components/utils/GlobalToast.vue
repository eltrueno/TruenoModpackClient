/**
* Generado por IA
*/
<template>
  <Teleport to="body">
    <TransitionGroup name="toast-list" tag="div" 
      :class="['fixed bottom-16 left-1/2 -translate-x-1/2 z-40 stack pointer-events-none cursor-pointer w-80', { 'single-toast': toasts.length === 1 }]">
      <div
        v-for="(toast, index) in toasts"
        :key="toast.id"
        class="alert shadow-xl w-80 pointer-events-auto flex flex-col items-start rounded-2xl px-2 pt-2 pb-1 gap-1"
        @mouseenter="pauseToast(toast.id)"
        @mouseleave="resumeToast(toast.id)"
        :class="{
          'alert-info': toast.type === 'info',
          'alert-success': toast.type === 'success',
          'alert-warning': toast.type === 'warning',
          'alert-error': toast.type === 'error'
        }"
      >
        <!-- Flex container to align content and close button -->

      <!-- Toast header-->
      <div class="flex flex-row items-start justify-between w-full">
        <!-- Icon and Title container -->
        <div class="flex items-center gap-2">
          <div class="flex-shrink-0">
            <!-- Info Icon -->
            <svg v-if="toast.type === 'info'" class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <!-- Success Icon -->
            <svg v-if="toast.type === 'success'" class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>          
            <!-- Warning Icon -->
            <svg v-if="toast.type === 'warning'" class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>         
            <!-- Error Icon -->
            <svg v-if="toast.type === 'error'" class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>

          <!-- Title -->
          <div>
            <span class="text-base font-semibold break-words">{{ toast.title }}</span>
          </div>
        </div>
        <!-- Close button -->
        <button 
          class="btn btn-ghost btn-xs btn-circle"
          @click.stop="remove(toast.id)"
        >
          <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <!-- Toast body-->
      <div class="flex flex-row">
        <!-- Message -->
        <div class="flex-1 min-w-0">
          <span class="text-sm font-medium break-words">{{ toast.message }}</span>
        </div>
      </div>
      
      <!-- Progress bar (solo visible para el primer toast) -->
      <div v-if="index === 0" class="w-full">
        <progress 
          class="progress progress-accent progress-current w-full h-1" 
          :value="getProgressPercentage(toast)" 
          max="100"
        ></progress>
      </div>
    </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

// Array de toasts activos
const toasts = ref([]);

// Map para almacenar los timers de cada toast
const timers = new Map();

// Contador para IDs únicos
let toastIdCounter = 0;

// Duración por defecto según tipo (en ms)
const defaultDurations = {
  info: 3000,
  success: 3000,
  warning: 4000,
  error: 5000
};

/**
 * Añade un nuevo toast
 * @param {Object} options - Opciones del toast
 * @param {string} options.title - Titulo del toast 
 * @param {string} options.message - Mensaje a mostrar
 * @param {string} [options.type='info'] - Tipo: info, success, warning, error
 * @param {number} [options.duration] - Duración en ms (si no se especifica, usa la duración por defecto del tipo)
 */
const add = (options) => {
  const type = options.type || 'info';
  const duration = options.duration || defaultDurations[type];
  
  const toast = {
    id: toastIdCounter++,
    title: options.title || 'Notificación',
    message: options.message || 'Esto es una notificación',
    type: type,
    duration: duration,
    remainingTime: duration,
    paused: false
  };
  
  toasts.value.push(toast);
  
  // Iniciar el timer para este toast
  startTimer(toast.id);
};

/**
 * Inicia el timer para un toast específico
 * @param {number} id - ID del toast
 */
const startTimer = (id) => {
  const toast = toasts.value.find(t => t.id === id);
  if (!toast) return;
  
  const intervalTime = 100; // Verificar cada 100ms
  
  const interval = setInterval(() => {
    const currentToast = toasts.value.find(t => t.id === id);
    if (!currentToast) {
      clearInterval(interval);
      timers.delete(id);
      return;
    }
    
    // Solo contar tiempo si es el primer toast y no está pausado
    const isFirstToast = toasts.value[0]?.id === id;
    if (isFirstToast && !currentToast.paused) {
      currentToast.remainingTime -= intervalTime;
      
      if (currentToast.remainingTime <= 0) {
        clearInterval(interval);
        timers.delete(id);
        remove(id);
      }
    }
  }, intervalTime);
  
  timers.set(id, interval);
};

/**
 * Pausa el timer de un toast
 * @param {number} id - ID del toast
 */
const pauseToast = (id) => {
  const toast = toasts.value.find(t => t.id === id);
  if (toast) {
    toast.paused = true;
  }
};

/**
 * Reanuda el timer de un toast
 * @param {number} id - ID del toast
 */
const resumeToast = (id) => {
  const toast = toasts.value.find(t => t.id === id);
  if (toast) {
    toast.paused = false;
  }
};

/**
 * Calcula el porcentaje de progreso restante
 * @param {Object} toast - El toast
 * @returns {number} Porcentaje de 0-100
 */
const getProgressPercentage = (toast) => {
  if (!toast || !toast.duration) return 0;
  return (toast.remainingTime / toast.duration) * 100;
};

/**
 * Remueve un toast específico
 * @param {number} id - ID del toast a remover
 */
const remove = (id) => {
  const interval = timers.get(id);
  if (interval) {
    clearInterval(interval);
    timers.delete(id);
  }
  
  const index = toasts.value.findIndex(t => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
};

// Exponer el método add para que se pueda llamar desde fuera
defineExpose({ add });
</script>

<style scoped>
/* Animaciones para la lista de toasts */
.toast-list-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-list-leave-active {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
  position: relative;
  z-index: 100;
}

.toast-list-enter-from {
  opacity: 0;
  transform: translateY(60px) scale(0.95);
}

.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.toast-list-move {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Efecto hover en los toasts */
.alert {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.alert:hover {
  transform: scale(1.02);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

/* Opacidad basada en posición usando nth-child */
/* El primer toast (primero en el stack) tiene opacidad completa */
.alert:nth-child(1) {
  opacity: 1;
}

/* Los demás toasts tienen opacidad reducida */
.alert:nth-child(n+2) {
  opacity: 0.5;
}

/* Cuando solo hay un toast en el contenedor, permitir fade */
.single-toast .alert {
  opacity: 1;
}

/* Cuando hay múltiples toasts, NO aplicar transición de opacidad */
/* Solo transición para cuando hay un único toast */
.alert:nth-child(n+2) ~ .alert.toast-list-enter-from,
.alert:nth-child(n+2) ~ .alert.toast-list-leave-to {
  opacity: inherit;
}

/* Forzar que cuando NO es single-toast, mantenga la opacidad base */
:not(.single-toast) .toast-list-enter-from {
  opacity: inherit !important;
}

:not(.single-toast) .toast-list-leave-to {
  opacity: inherit !important;
}

.progress-current {
  background-color: transparent !important;
  color: currentColor !important;
}

/* Chrome, Safari, Edge */
.progress-current::-webkit-progress-value {
  background-color: currentColor !important;
}


</style>
