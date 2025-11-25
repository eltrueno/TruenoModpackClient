<template>
    <div class="flex align-middle justify-center w-full mt-4">
        <div class="flex flex-col w-full mx-48 space-y-4">
            
            <!-- Progress steps -->
            <div v-if="isInstalling" class="w-full flex justify-center align-middle">
                <ul class="steps w-full" v-if="modpackStatus=='outdated'">
                    <li class="step" :class="{ 'step-primary': currentStage >= 1 }">Comprobación</li>
                    <li class="step" :class="{ 'step-primary': currentStage >= 2 }">Descarga de archivos</li>
                    <li class="step" :class="{ 'step-primary': currentStage >= 3 }">Finalización</li>
                </ul>
                <ul class="steps w-full" v-else>
                    <li class="step" :class="{ 'step-primary': currentStage >= 1 }">Comprobación</li>
                    <li class="step" :class="{ 'step-primary': currentStage >= 2 }">Instalación de loader</li>
                    <li class="step" :class="{ 'step-primary': currentStage >= 3 }">Descarga</li>
                    <li class="step" :class="{ 'step-primary': currentStage >= 4 }">Creación de perfil</li>
                </ul>
            </div>

            <!-- Progress bar durante instalación -->
            <div v-if="isInstalling" class="w-full my-4 py-2">
                <div class="text-sm my-1">{{ progressMessage }}</div>
                <progress v-if="currentStage==1" class="progress progress-info w-full" style="height: 0.8rem;"></progress>
                <progress v-else class="progress progress-info w-full" :value="progressPercent" max="100" style="height: 0.8rem;"></progress>
                <div class="w-full flex justify-between items-center mt-1 text-xs">
                    <div>
                        {{ progressPercent }}% 
                        <span v-if="progressTotalSize>0">
                            - {{ formatBytes(progressLastSize) }} / {{ formatBytes(progressTotalSize) }}
                        </span>
                    </div>
                    <span v-if="progressData.currentFile">
                    Archivo {{ progressData.currentFile }} de {{ progressData.totalFiles }}
                    </span>
                </div>
            </div>

            <!-- Botón instalando -->
            <button class="btn btn-block btn-circle btn-primary no-animation cursor-wait shadow-md" v-if="isInstalling">
                <div class="radial-progress font-light text-sm" :aria-valuenow="progressPercent" role="progressbar" 
                :style="{ '--value': progressPercent, '--size': '2.7rem', '--thickness': '7%'}">{{progressPercent}}%</div>
                {{ currentStageStr }}
            </button>

            <!-- Botón cargando inicial -->
            <button class="btn btn-block btn-circle btn-primary no-animation cursor-wait" v-else-if="loading">
                <span class="loading loading-dots"></span>
                Verificando...
            </button>

            <!-- Botón descargar e instalar -->
            <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg" 
                    v-else-if="modpackStatus=='uninstalled'"
                    @click="handleInstall">
                <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/>
                </svg>
                Descargar e instalar
            </button>

            <!-- Botón abrir launcher -->
            <!--<button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg" 
                    v-else-if="modpackStatus=='updated'"
                    @click="handleLaunch">
                <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fill-rule="evenodd" d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z" clip-rule="evenodd"/>
                </svg>
                Abrir lanzador de Minecraft
            </button>-->

            <!-- Botón abrir launcher con menú desplegable -->
            <div v-else-if="modpackStatus=='updated'" class="relative">
                <div class="flex">
                    <!-- Botón principal -->
                    <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg flex-1 rounded-r-none" 
                            @click="handleLaunch">
                        <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z" clip-rule="evenodd"/>
                        </svg>
                        Abrir lanzador de Minecraft ({{ launchersNamesMap[selectedLauncher] }})
                    </button>
                    
                    <!-- Botón de opciones -->
                    <button class="btn btn-primary shadow-md hover:shadow-lg rounded-r-full rounded-l-none border-l border-primary-content/20 tooltip tooltip-top 
                    " :data-tip="showOptions ? 'Ocultar opciones' : 'Desplegar opciones'"
                            @click="showOptions = !showOptions" @mouseenter="hoverOptions = true" @mouseleave="hoverOptions = false">
                            <svg class="w-5 h-5 transition-transform duration-300" :class="{ 'rotate-90': showOptions }" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                <path fill-rule="evenodd" d="M9.586 2.586A2 2 0 0 1 11 2h2a2 2 0 0 1 2 2v.089l.473.196.063-.063a2.002 2.002 0 0 1 2.828 0l1.414 1.414a2 2 0 0 1 0 2.827l-.063.064.196.473H20a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.089l-.196.473.063.063a2.002 2.002 0 0 1 0 2.828l-1.414 1.414a2 2 0 0 1-2.828 0l-.063-.063-.473.196V20a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.089l-.473-.196-.063.063a2.002 2.002 0 0 1-2.828 0l-1.414-1.414a2 2 0 0 1 0-2.827l.063-.064L4.089 15H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h.09l.195-.473-.063-.063a2 2 0 0 1 0-2.828l1.414-1.414a2 2 0 0 1 2.827 0l.064.063L9 4.089V4a2 2 0 0 1 .586-1.414ZM8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
                            </svg>
                            <transition
                                mode="out-in"
                                enter-active-class="transition-all duration-200 ease-out"
                                enter-from-class="opacity-0 -translate-y-1"
                                enter-to-class="opacity-100 translate-y-0"
                                leave-active-class="transition-all duration-200 ease-in"
                                leave-from-class="opacity-100 translate-y-0"
                                leave-to-class="opacity-0 translate-y-1">
                                <div v-if="hoverOptions" class="ml-1">
                                    <svg v-if="!showOptions" key="down" class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7"/>
                                    </svg>
                                    <svg v-else key="up" class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 15 7-7 7 7"/>
                                    </svg>
                                </div>
                            </transition>
                    </button>
                </div>
                
                <transition
                    enter-active-class="transition-all duration-250 ease-in origin-top"
                    enter-from-class="scale-y-0"
                    enter-to-class="scale-y-100"
                    leave-active-class="transition-all duration-200 ease-in origin-top"
                    leave-from-class="scale-y-100"
                    leave-to-class="scale-y-0">
                    <div v-if="showOptions" class="absolute top-full left-0 right-0 mt-2 z-30">
                        <div class="bg-base-200 rounded-box shadow-xl p-4">
                            <!-- Opciones -->
                            <div class="space-y-2">
                                <div class="flex flex-col px-4 space-y-2">
                                    <span class="flex gap-3 place-items-center text-base font-semibold">
                                        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                                            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m10.051 8.102-3.778.322-1.994 1.994a.94.94 0 0 0 .533 1.6l2.698.316m8.39 1.617-.322 3.78-1.994 1.994a.94.94 0 0 1-1.595-.533l-.4-2.652m8.166-11.174a1.366 1.366 0 0 0-1.12-1.12c-1.616-.279-4.906-.623-6.38.853-1.671 1.672-5.211 8.015-6.31 10.023a.932.932 0 0 0 .162 1.111l.828.835.833.832a.932.932 0 0 0 1.111.163c2.008-1.102 8.35-4.642 10.021-6.312 1.475-1.478 1.133-4.77.855-6.385Zm-2.961 3.722a1.88 1.88 0 1 1-3.76 0 1.88 1.88 0 0 1 3.76 0Z"/>
                                        </svg>
                                        Selecciona el launcher deseado:
                                    </span>
                                    <div class="grid grid-cols-2 gap-3">
                                        <label class="flex items-center  justify-center gap-2  cursor-pointer hover:bg-base-300 p-2 rounded-lg" data-tip="¡No tienes instalado este launcher!"
                                        :class="{ 'tooltip tooltip-bottom': !installedLaunchers.includes('classic') }">
                                            <input type="radio" name="radioLauncher" class="radio radio-sm radio-primary" value="classic" 
                                            v-model="selectedLauncher"
                                            :disabled="!installedLaunchers.includes('classic')"

                                            />
                                            <span class="text-sm"
                                            :class="{ 'text-base-content/50': !installedLaunchers.includes('classic') }"
                                            >Oficial Clásico (exe)</span>
                                        </label>
                                        <label class="flex items-center justify-center gap-2 cursor-pointer hover:bg-base-300 p-2 rounded-lg" data-tip="¡No tienes instalado este launcher!"
                                        :class="{ 'tooltip tooltip-bottom': !installedLaunchers.includes('uwp') }">
                                            <span class="text-sm"
                                            :class="{ 'text-base-content/50': !installedLaunchers.includes('uwp') }"
                                            >Oficial Windows (uwp)</span>
                                            <input type="radio" name="radioLauncher" class="radio radio-sm radio-primary" value="uwp" 
                                            v-model="selectedLauncher"
                                            :disabled="!installedLaunchers.includes('uwp')"/>
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="divider my-1"></div>
                                <!--
                                <button @click="handleOption4" class="btn btn-ghost btn-block justify-start gap-3 text-error hover:bg-error/10 text-base font-semibold">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                    <span>Desinstalar</span>
                                </button>
                                -->
                            </div>
                        </div>
                    </div>
                </transition>
            </div>

            <!-- Botón actualizar -->
            <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg" 
                    v-else-if="modpackStatus=='outdated'"
                    @click="handleUpdate">
                <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"/>
                </svg>
                Instalar actualización ({{ remoteModpackVersion.string }})
            </button>

            <!-- Información de versión -->
            <div v-if="!loading && !isInstalling && modpackStatus != 'uninstalled'" class="alert relative shadow-md rounded-xl" :class="{
                'alert-info': modpackStatus == 'outdated',
                'alert-success': modpackStatus == 'updated'
            }">
                <svg v-if="modpackStatus == 'outdated'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-6 w-6 shrink-0 stroke-current">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <svg v-else class="" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 11.5 11 14l4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                </svg>

                <div>
                    <div class="text-lg font-semibold">Versión instalada: {{ localModpackVersion.string }}</div>
                    <div class="text-base" v-if="modpackStatus == 'outdated'">
                        Nueva versión disponible: {{ remoteModpackVersion.string }}
                        <div class="text-sm font-medium">Novedades: <span class="font-normal">{{ remoteModpackVersion.description }}</span></div>
                    </div>
                    <div class="text-base" v-else>
                        Estás usando la última versión :)
                    </div>
                    <div class="tooltip tooltip-left absolute top-0 right-0 p-1" data-tip="Verificar archivos">
                        <button v-if="modpackStatus != 'uninstalled' && !isInstalling && !loading" class="btn btn-circle btn-ghost"
                        @click="verifyIntegrity">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 7V2.221a2 2 0 0 0-.5.365L4.586 6.5a2 2 0 0 0-.365.5H9Z"/>
                            <path fill-rule="evenodd" d="M11 7V2h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9h5a2 2 0 0 0 2-2Zm4.707 5.707a1 1 0 0 0-1.414-1.414L11 14.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { reactive, ref, onBeforeMount, onUnmounted, inject } from "vue"

const props = defineProps({
  modpack_id: String,
  modpack_name: String,
  modpack_version: Number,
  processing: {
    type: Boolean,
    required: false
  }
})

const globalDialog = inject('dialog');

const emit = defineEmits(["update:processing"])

function startProcessing() {
  emit("update:processing", true)
}

function finishProcessing() {
  emit("update:processing", false)
}

const loading = ref(true)
const modpackStatus = ref('uninstalled') // 'uninstalled', 'updated', 'outdated'
const isInstalling = ref(false)
const error = ref(null)

const installedLaunchers = ref([])
const selectedLauncher = ref('')
const launchersNamesMap = {
    'classic': 'Oficial Clásico',
    'uwp': 'Oficial Windows App'
}

const progressPercent = ref(0)
const progressMessage = ref("")
const currentStageStr = ref("")
const currentStage = ref(0)
const progressData = ref({})
const progressLastSize = ref(0)
const progressTotalSize = ref(0)

const showOptions = ref(false)
const hoverOptions = ref(false)

const localModpackVersion = reactive({
    version: -1,
    string: "unknown"
})

const remoteModpackVersion = reactive({
    version: -1,
    string: "unknown",
    description: ""
})

// Formatear bytes a formato legible
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Actualizar progreso de instalación
const handleProgress = (data) => {
    progressData.value = data;
    progressPercent.value = data.progress || 0;
    progressMessage.value = data.message || "Procesando...";
    
    if(data.downloadedSize){
        progressLastSize.value = data.downloadedSize
        progressTotalSize.value = data.totalSize
    }

    // Actualizar stage actual
    switch(data.stage) {
        case 'calculating':
            currentStage.value = 1;
            currentStageStr.value = "Calculando...";
            break;
        case 'loader':
            currentStage.value = 2;
            currentStageStr.value = "Instalando Loader..."
            break;
        case 'deleting':
            currentStage.value = 2;
            currentStageStr.value = "Eliminando archivos obsoletos..."
            break;
        case 'downloading':
            currentStage.value = 2;
            currentStageStr.value = "Descargando..."
            if(modpackStatus.value=='uninstalled') currentStage.value = 3
            break;
        case 'finalizing':
            currentStage.value = 3;
            currentStageStr.value = "Finalizando..."
            if(modpackStatus.value=='uninstalled') currentStage.value = 4
            break;
        case 'complete':
            currentStage.value = 3;
            currentStageStr.value = "Completado"
            if(modpackStatus.value=='uninstalled') currentStage.value = 4
            break;
    }
}

// Verificar estado inicial del modpack
async function checkModpackStatus() {
    try {
        loading.value = true;
        startProcessing();
        error.value = null;

        const isInstalled = await window.appAPI.isModpackInstalled(props.modpack_id);
        
        if (!isInstalled) {
            modpackStatus.value = 'uninstalled';
            loading.value = false;
            finishProcessing();
            return;
        }

        // Obtener versiones local y remota
        const [localJson, remoteJson] = await Promise.all([
            window.appAPI.getLocalModpackJson(props.modpack_id),
            window.appAPI.getRemoteModpackJson(props.modpack_id)
        ]);


        localModpackVersion.version = localJson.version.version;
        localModpackVersion.string = localJson.version.string;

        remoteModpackVersion.version = remoteJson.version;
        remoteModpackVersion.string = remoteJson.versions[remoteJson.version].string;
        remoteModpackVersion.description = remoteJson.versions[remoteJson.version].description;

        // Comparar versiones
        if (localModpackVersion.version < remoteModpackVersion.version) {
            modpackStatus.value = 'outdated';
        } else {
            modpackStatus.value = 'updated';
        }

        loading.value = false;
        finishProcessing();

    } catch (err) {
        console.error('Error checking modpack status:', err);
        error.value = 'Ha ocurrido un error comprobando la versión del modpack. Comprueba tu conexión a internet y vuelve a intentarlo más tarde';
        loading.value = false;
        finishProcessing();
    }
}

// Instalar modpack
async function handleInstall() {
    try {
        isInstalling.value = true;
        startProcessing()
        error.value = null;
        currentStage.value = 0;

        await window.appAPI.installOrUpdateModpack(props.modpack_id);

        // Actualizar estado después de la instalación
        await checkModpackStatus();
        isInstalling.value = false;
        finishProcessing();

    } catch (err) {
        console.error('Error installing modpack:', err);
        error.value = 'Ha ocurrido un error inesperado durante la instalación';
        isInstalling.value = false;
        finishProcessing();
    }
}

// Actualizar modpack
async function handleUpdate() {
    try {

        const confirmed = await globalDialog.showConfirmable('info',
            'Actualización '+remoteModpackVersion.string,
            '¿Quieres continuar con la actualización del modpack?',
            false,
            'Actualizar',
            'Cancelar'
        );

        if (!confirmed) {
            return;
        }

        isInstalling.value = true;
        startProcessing()
        error.value = null;
        currentStage.value = 0;

        await window.appAPI.installOrUpdateModpack(props.modpack_id);

        // Actualizar estado después de la actualización
        await checkModpackStatus();
        isInstalling.value = false;
        finishProcessing();

    } catch (err) {
        console.error('Error updating modpack:', err);
        error.value = 'Ha ocurrido un error inesperado durante la instalación';
        isInstalling.value = false;
        finishProcessing();
    }
}

// Abrir launcher de Minecraft
async function handleLaunch() {
    if(!selectedLauncher.value){
        globalDialog.showError('Ningún launcher encontrado', 'No se ha podido encontrar ningún launcher compatible instalado. Por favor, instala un launcher compatible para poder abrirlo.');
        return;
    }
    await window.appAPI.openMinecraftLauncher(selectedLauncher.value);
}

// Verificar integridad
async function verifyIntegrity() {
    try {
        loading.value = true;
        startProcessing()
        const result = await window.appAPI.verifyModpackIntegrity(props.modpack_id);
        
        if (!result.valid) {
            let message = result.error
            if(result.missing>0 || result.corrupted>0) message+="\n\nArchivos faltantes: "+result.missing+"\nArchivos corruptos: "+result.corrupted
            const confirmed = await globalDialog.showConfirmable('warning',
            'Es necesario reparar archivos',
            message+'\n\n¿Deseas reparar el modpack?',
            false,
            'Reparar',
            'Cancelar'
            );
            if (confirmed) {
                await handleUpdate();
            }
        }
        loading.value = false;
        finishProcessing();
    } catch (err) {
        console.error('Error verificando la integridad de los archivos:', err);
        //error.value = 'Ha ocurrido un error verificando la integridad de los archivos instalados del modpack';
        window.appAPI.showToast('error', 'Error verificando la integridad de los archivos', 'Ha ocurrido un error verificando la integridad de los archivos instalados del modpack');
        loading.value = false;
        finishProcessing();
    }
}

onBeforeMount(async () => {
    // Registrar listener de progreso
    window.appAPI.onInstallationProgress(handleProgress);
    
    // Verificar estado inicial
    await checkModpackStatus();

    // Obtener launchers
    installedLaunchers.value = await window.appAPI.getMinecraftLaunchers(); 
    if(installedLaunchers.value.includes('classic')) selectedLauncher.value = 'classic'
    else if(installedLaunchers.value.includes('uwp')) selectedLauncher.value = 'uwp'
})

onUnmounted(() => {
    // Limpiar listener
    window.appAPI.removeInstallationProgressListener();
})
</script>