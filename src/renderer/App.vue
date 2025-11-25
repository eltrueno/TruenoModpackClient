<script setup>
import Modpack from './components/Modpack.vue'
import ActionSection from './components/ActionSection.vue';
import { ref, onMounted, computed, provide } from 'vue'

import TruenoModpackSvg from './components/utils/TruenoModpackSvg.vue';
import GlobalDialog from './components/utils/GlobalDialog.vue'
import GlobalToast from './components/utils/GlobalToast.vue'

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

onMounted(() => {
  document.title = `Trueno Modpack - v${__APP_VERSION__}`;

  // Escuchar eventos de toast desde el main process
  window.appAPI.onToast((_event, toastData) => {
    toastRef.value?.add(toastData);
  });

  window.appAPI.onStatus(async (_event, value) => {
    online.value = value;
    if(value){
      //await checkForUpdates();
    } else loading.value = false;
  });

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
    toastRef.value?.add({
      title: 'No hay actualizaciones',
      message: 'La aplicación se encuentra en la última versión',
      type: 'success'
    });
    loading.value = false;
    updateStatus.value = {
      checking: false,
      downloading: false,
      ready: false,
      message: ''
    };
  });
  window.autoUpdater.onUpdateDownloaded((_event, info) => {
    updateStatus.value = {
      checking: false,
      downloading: false,
      ready: true,
      message: 'Actualización lista. Reiniciando en 5 segundos...'
    };

  });
  window.autoUpdater.onUpdateError((_event, error) => {
    console.error('Error en actualización:', error);
    toastRef.value?.add({
      title: 'Error en actualización',
      message: 'Ha ocurrido un error durante la actualización. Por favor, inténtalo de nuevo más tarde',
      type: 'error'
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
    updating.value = false;
    loading.value = false;
  }
}

</script>

<template>
  <div v-if="loading || updating" class="w-screen h-screen flex flex-col justify-center items-center">
    <TruenoModpackSvg class="w-80 h-80 p-2 overflow-visible" shadow :animations="{gearsSpinAnimation: {enabled: true}, boltGlowAnimation: {enabled: true}}" />

    <span class="font-semibold text-xl mt-1">{{ loadingMessage }}</span>
  </div>
  <div v-if="!loading &&!updating && !online" class="w-screen h-screen flex flex-col justify-center items-center pointer-events-none select-none group-hover:select-none">
    <span class="font-bold text-4xl">Oops..</span>
    <span class="font-medium text-xl">Parece que no tienes conexión a internet. Vuleve a abrir la aplicación cuando lo hayas solucionado</span>
    <img src="/no-connection.png" class="lg:w-10/12 pointer-events-none select-none group-hover:select-none" alt="An enderman disconnect the internet cable">
  </div>
  <div class="flex w-full flex-col p-1" v-else-if="!loading && !updating && online">
    <div class="flex align-middle justify-center p-2">
      <TruenoModpackSvg id="anim" class="w-36 p-1 overflow-visible mx-2" shadow :animations=svgAnims @mouseenter="svgHovered=true" @mouseleave="svgHovered=false"/>
      <div class="flex flex-col justify-around ">
        <p class="font-black  drop-shadow-xl text-6xl text-[#ebc22f] "@mouseenter="svgHovered=true" @mouseleave="svgHovered=false">TRUENO</p>
        <p class="font-minecraft font-medium drop-shadow-lg text-4xl tracking-wide ml-2 w-fit max-w-fit"@mouseenter="svgHovered=true" @mouseleave="svgHovered=false">ModPack</p>
      </div>
    </div>
    <Modpack class="py-2" modpack_name="Depresivos 2K25" modpack_id="depresivos2k25" modpack_desc="Modpack fabric version 1.19.4" 
    modpack_image_url="https://eltrueno.github.io/truenomodpack/depresivos2k25/logo.png" />
    <ActionSection modpack_name="Depresivos 2K25" modpack_id="depresivos2k25" v-model:processing="subprocessing" />
  </div>
  <footer class="footer footer-center bg-base-300 text-base-content p-4 absolute bottom-0 z-50">
    <aside>
      <p>Desarrollado con ❤️ por <a href="https://github.com/eltrueno">el_trueno</a></p>
    </aside>
  </footer>

  <GlobalDialog ref="dialogRef"/>
  <GlobalToast ref="toastRef"/>

</template>