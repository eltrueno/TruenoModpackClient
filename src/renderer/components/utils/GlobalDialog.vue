<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop con blur -->
        <div 
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="handleBackdropClick"
        ></div>
        
        <!-- Dialog Card -->
        <div class="relative card shadow-2xl w-full max-w-md mx-4 z-10" 
        :class="{'bg-base-100': !bgColor,
          'bg-info': bgColor && type==='info',
          'bg-success': bgColor && type ==='success',
          'bg-warning': bgColor && type==='warning',
          'bg-error': bgColor && type==='error',
          'bg-primary': bgColor && type==='primary',
        }">
          <div class="card-body p-4">
            <!-- Icon & Title -->
            <div class="flex items-start gap-4 mb-2  p-2 justify-center">
              <!-- Info Icon -->
              <div v-if="type === 'info'" class="flex-shrink-0">
                <div class="rounded-full" :class="{'bg-info/20 text-info': !bgColor, 'text-info-content': bgColor}">
                  <svg class="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
              
              <!-- Success Icon -->
              <div v-if="type === 'success'" class="flex-shrink-0">
                <div class="rounded-full" :class="{'bg-success/20 text-success': !bgColor, 'text-success-content': bgColor}">
                  <svg class="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
              
              <!-- Warning Icon -->
              <div v-if="type === 'warning'" class="flex-shrink-0">
                <div class="rounded-full" :class="{'bg-warning/20 text-warning': !bgColor, 'text-warning-content': bgColor}">
                  <svg class="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </div>
              </div>
              
              <!-- Error Icon -->
              <div v-if="type === 'error'" class="flex-shrink-0">
                <div class="rounded-full" :class="{'bg-error/20 text-error': !bgColor, 'text-error-content': bgColor}">
                  <svg class="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
              
              <!-- Confirm Icon -->
              <div v-if="type === 'primary'" class="flex-shrink-0">
                <div class="rounded-full" :class="{'bg-primary/20 text-primary': !bgColor, 'text-primary-content': bgColor}">
                  <svg class="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
              </div>
              
              <!-- Title -->
              <div class="flex-1 min-w-0">
                <h2 class="card-title" :class="{'text-base-content': !bgColor, 
                'text-primary-content': bgColor && type === 'primary',
                'text-info-content': bgColor && type === 'info',
                'text-warning-content': bgColor && type === 'warning',
                'text-error-content': bgColor && type === 'error',
                'text-success-content': bgColor && type === 'success'
                }">{{ title }}</h2>
              </div>
            </div>
            
            <!-- Message -->
            <div class="p-1">
              <p class="whitespace-pre-line" :class="{'text-base-content': !bgColor, 
                'text-primary-content': bgColor && type === 'primary',
                'text-info-content': bgColor && type === 'info',
                'text-warning-content': bgColor && type === 'warning',
                'text-error-content': bgColor && type === 'error',
                'text-success-content': bgColor && type === 'success',
                'text-accent-content': bgColor && type === 'accent'
                }">{{ message }}</p>
            </div>
            
            <!-- Actions -->
            <div class="card-actions justify-end mt-6">
              <!-- Cancel button (only for confirm type) -->
              <button 
                v-if="confirmable"
                class="btn btn-sm btn-ghost"
                :class="{
                'text-primary-content': bgColor && type === 'primary',
                'text-info-content': bgColor && type === 'info',
                'text-warning-content': bgColor && type === 'warning',
                'text-error-content': bgColor && type === 'error',
                'text-success-content': bgColor && type === 'success',
                'text-accent-content': bgColor && type === 'accent'
                }"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              
              <!-- Confirm button -->
              <button 
                class="btn btn-sm"
                :class="{
                  'btn-outline btn-info': type === 'info' && !bgColor,
                  'btn-outline btn-success': type === 'success'&& !bgColor,
                  'btn-outline btn-warning': type === 'warning'&& !bgColor,
                  'btn-outline btn-error': type === 'error'&& !bgColor,
                  'btn-outline btn-primary': type === 'primary'&& !bgColor,
                  'btn-neutral' : bgColor
                }"
                @click="handleConfirm"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

// Estado del diálogo
const isOpen = ref(false);
const title = ref('');
const message = ref('');
const type = ref('info'); // 'info', 'success', 'warning', 'error', 'confirm'
//const typeColor = ref('info'); // 'info', 'success', 'warning', 'error', 'primary'
const bgColor = ref(false);
const confirmable = ref(false)
const confirmText = ref('Aceptar');
const cancelText = ref('Cancelar');
let resolvePromise = null;

// Método para mostrar el diálogo
const show = (options) => {
  return new Promise((resolve) => {
    isOpen.value = true;
    title.value = options.title || 'Información';
    message.value = options.message || '';
    type.value = options.type || 'info';
    //typeColor.value = options.typeColor || 'info';
    confirmable.value = options.confirmable || false;
    bgColor.value = options.bgColor || false;
    confirmText.value = options.confirmText || 'Aceptar';
    cancelText.value = options.cancelText || 'Cancelar';
    resolvePromise = resolve;
  });
};

const handleConfirm = () => {
  isOpen.value = false;
  if (resolvePromise) resolvePromise(true);
};

const handleCancel = () => {
  isOpen.value = false;
  if (resolvePromise) resolvePromise(false);
};

const handleBackdropClick = () => {
  // Solo cerrar al hacer click fuera si NO es un confirm
  if (!confirmable.value) {
    handleCancel();
  }
};

// Exponer el método show para que se pueda llamar desde fuera
defineExpose({ show });
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-active .card,
.dialog-fade-leave-active .card {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-fade-enter-from .card {
  transform: scale(0.9) translateY(-20px);
}

.dialog-fade-leave-to .card {
  transform: scale(0.95);
}
</style>