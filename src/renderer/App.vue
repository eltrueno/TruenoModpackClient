<script setup>
import Modpack from './components/Modpack.vue'
import ActionSection from './components/ActionSection.vue';
import { ref, onMounted, computed, provide, watch, watchEffect } from 'vue'

import TruenoModpackSvg from './components/utils/TruenoModpackSvg.vue';
import GlobalDialog from './components/utils/GlobalDialog.vue'
import GlobalToast from './components/utils/GlobalToast.vue'

import { useConfig } from './composables/useConfig';

const APP_VERSION = __APP_VERSION__


const { 
  config, 
  isLoading, 
  isSaving, 
  set, 
  get, 
  save, 
  reset, 
  init 
} = useConfig();

const svgHovered = ref(false)
const svgAnims = computed(() =>
  ({
    boltGlowAnimation: {
      enabled: svgHovered.value
    },
    gearsSpinAnimation: {
      enabled: updating.value || subprocessing.value || loading.value
    },
    boltPathTrailAnimation:{
      enabled: updating.value || subprocessing.value || loading.value,
      strokeColor: "#ffe073",
      strokeWidth: 2.5
    } 
  }))

const online = ref(false)
const loading = ref(true)
const subprocessing = ref(false)

// AutoUpdater
const updateStatus = ref({
  checking: false,
  downloading: false,
  ready: false,
  message: 'Cargando... Esto debería de ser rápido'
});


const updating = computed(() => updateStatus.value.checking || updateStatus.value.downloading);

const loadingMessage = computed(() => updateStatus.value.message)

// Referencia al diálogo global
const dialogRef = ref(null);

// Referencia al sistema de toasts global
const toastRef = ref(null);

// Proveer funciones de diálogo a todos los componentes hijos
provide('dialog', {
  show: (options) => dialogRef.value?.show(options),
  showInfo: (title, message) => dialogRef.value?.show({ title, message, type: 'info' }),
  showSuccess: (title, message, bgcolor) => dialogRef.value?.show({ title, message, type: 'success', bgColor: bgcolor}),
  showWarning: (title, message) => dialogRef.value?.show({ title, message, type: 'warning' }),
  showError: (title, message) => dialogRef.value?.show({ title, message, type: 'error' }),
  showConfirmable: (type, title, message, bgcolor, confirmText = 'Aceptar', cancelText = 'Cancelar') => 
    dialogRef.value?.show({ title, message, type: type, bgColor: bgcolor, confirmable: true, confirmText, cancelText })
});

onMounted(async () => {
  document.title = `Trueno Modpack - v${__APP_VERSION__}`;

  //Iniciar config
  await init();

  window.electron?.ipcRenderer?.on?.('app-closing', async () => {
    await save(); // Esto sincroniza todo antes de cerrar
  });

  // Escuchar eventos de toast desde el main process
  window.appAPI.onToast((_event, toastData) => {
    toastRef.value?.add(toastData);
  });

  window.appAPI.onStatus(async (_event, value) => {
    online.value = value;
    if(!value) loading.value = false;
  });
    
  const mustUpdate = await mustCheckForUpdates();
  const cfgJustUpdated = await get('justUpdated');

  if(!cfgJustUpdated && mustUpdate) {
    setTimeout(() => {
      checkForUpdates();
    }, 1500);
  }else{
    await set('justUpdated', false);
    loading.value = false;
    if(cfgJustUpdated){
      toastRef.value?.add({
        title: 'Actualización completada',
        message: 'Se ha finalizado correctamente la actualización de la aplicación',
        type: 'success',
        duration: 2500
      });
    }
  }

  // Escuchar eventos del auto-updater
  window.autoUpdater.onUpdateChecking((_event) => {
    updateStatus.value = {
      checking: true,
      downloading: false,
      ready: false,
      message: 'Comprobando actualizaciones...'
    };
  });
  window.autoUpdater.onUpdateAvailable((_event) => {
    toastRef.value?.add({
      title: 'Actualización disponible',
      message: 'Hay una actualización de la aplicación disponible. Se procederá a su descarga',
      type: 'info'
    });
    updateStatus.value = {
      checking: false,
      downloading: true,
      ready: false,
      message: 'Descargando actualización...'
    };
  });
  window.autoUpdater.onUpdateNotAvailable((_event) => {
    loading.value = false;
    updateStatus.value = {
      checking: false,
      downloading: false,
      ready: false,
      message: ''
    };
  });
  window.autoUpdater.onUpdateDownloaded(async (_event, info) => {
    updateStatus.value = {
      checking: false,
      downloading: false,
      ready: true,
      message: 'Actualización completada. Reiniciando en 5 segundos...'     
    };
    //Establecer justUpdated en cfg
    await set('justUpdated', true);
    let time = 5;
    const interval = setInterval(() => {
      time--;
      updateStatus.value.message = `Actualización completada. Reiniciando en ${time} segundos...`;
      if (time < 0) {
        clearInterval(interval);
      }
    }, 1000);

  });
  window.autoUpdater.onUpdateError((_event, error) => {
    console.error('Error en actualización:', error);
    toastRef.value?.add({
      title: 'Error en actualización',
      message: 'Ha ocurrido un error durante la actualización. Por favor, inténtalo de nuevo más tarde',
      type: 'error',
      duration: 3000
    }); 
    loading.value = false;
    updateStatus.value = {
      checking: false,
      downloading: false,
      ready: false,
      message: ''
    };
  });

})

async function checkForUpdates() {
  try {
    await window.autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Error al comprobar actualizaciones:', error);
    updateStatus.value = {
      checking: false,
      downloading: false,
      ready: true,
      message: ''
    };
    loading.value = false;
  }
}

async function mustCheckForUpdates() {
  const lastOpenedCfg = await get('lastOpened')
  const target = new Date(lastOpenedCfg);
  const now = new Date();

  const diffMs = now - target;
  const diffMinutes = diffMs / 1000 / 60;

  let updateCooldownMinutes = await get('updateCooldownMinutes')
  if(updateCooldownMinutes>720) updateCooldownMinutes = 720; //Max 12h
  return diffMinutes >= updateCooldownMinutes;
}

</script>

<template>
  <div v-if="loading || updating || config.loading" class="w-screen h-screen flex flex-col justify-center items-center gap-12">
    <TruenoModpackSvg class="w-60 h-60 p-2 overflow-visible" shadow :animations="{gearsSpinAnimation: {enabled: true}, boltGlowAnimation: {enabled: true}}" />
    <div class="flex flex-col gap-2 ustify-center items-center">
      <span class="font-semibold text-xl">{{ loadingMessage }}</span>
      <progress v-if="updateStatus.downloading" class="progress w-96"></progress>
    </div>
  </div>
  <div v-if="!loading &&!updating && !online" class="w-screen h-screen flex flex-col justify-center items-center pointer-events-none select-none group-hover:select-none">
    <span class="font-bold text-4xl">Oops..</span>
    <span class="font-medium text-xl">Parece que no tienes conexión a internet. Vuleve a abrir la aplicación cuando lo hayas solucionado</span>
    <img src="/no-connection.png" class="lg:w-10/12 pointer-events-none select-none group-hover:select-none" alt="An enderman disconnect the internet cable">
  </div>
  <div class="flex w-full flex-col p-1" v-else-if="!loading && !config.loading && !updating && online">
    <div class="flex align-middle justify-center p-2">
      <TruenoModpackSvg id="anim" class="w-36 p-1 overflow-visible mx-2" shadow :animations=svgAnims @mouseenter="svgHovered=true" @mouseleave="svgHovered=false"/>
      <div class="flex flex-col justify-start gap-8">
        <p class="font-black  drop-shadow-xl text-6xl text-[#ebc22f] "@mouseenter="svgHovered=true" @mouseleave="svgHovered=false">TRUENO</p>
        <p class="font-minecraft font-medium drop-shadow-lg text-4xl tracking-wide ml-1 w-fit max-w-fit"@mouseenter="svgHovered=true" @mouseleave="svgHovered=false">ModPack</p>
      </div>
    </div>
    <Modpack class="py-2" modpack_name="Depresivos 2K25" modpack_id="depresivos2k25" modpack_desc="Modpack fabric version 1.20.1" 
    modpack_image_url="https://eltrueno.github.io/truenomodpack/depresivos2k25/logo.png" />
    <ActionSection modpack_name="Depresivos 2K25" modpack_id="depresivos2k25" v-model:processing="subprocessing" />
  </div>
  <footer class="footer footer-center bg-base-300 text-base-content p-1 absolute bottom-0 z-50 text-xs">
    <aside>
      <p>Trueno Modpack v{{ APP_VERSION }} - Desarrollado con ❤️ por <a href="https://github.com/eltrueno">el_trueno</a></p>
    </aside>
  </footer>

  <GlobalDialog ref="dialogRef"/>
  <GlobalToast ref="toastRef"/>

</template>