<template>
    <div class="flex align-middle justify-center w-full mt-4">
        <div class="flex flex-col w-full mx-48 space-y-4">
            
            <!-- Progress steps -->
            <div v-if="isProcessing" class="w-full flex justify-center align-middle">
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
            <div v-if="isProcessing" class="w-full my-4 py-2">
                <div class="text-sm my-1 w-full flex justify-between items-baseline">
                    <div>
                        <div>{{ progressCancelled ? 'Cancelando...' : progressMessage }}</div>
                        <span v-if="progressData.lastDownloadedFile && progressData.stage=='downloading'" class="text-xs opacity-50 -mt-1 overflow-clip">
                            {{ progressData.lastDownloadedFile  }}
                        </span>
                    </div>
                    <span>{{ formatBytes(progressLastSize) }} / {{ formatBytes(progressTotalSize) }}</span>
                </div>
                <progress v-if="currentStage==1" class="progress progress-info w-full" style="height: 0.8rem;"></progress>
                <progress v-else class="progress progress-info w-full" :value="progressPercent" max="100" style="height: 0.8rem;"></progress>
                <div class="w-full flex justify-between items-center mt-1 text-xs">
                    <div v-if="progressTotalSize>0">
                        <span>
                            {{ progressSpeed.toFixed(2) }}MB/s - Tiempo restante: {{ formatEta(progressEta) }}
                        </span>
                    </div>
                    <span>{{ progressPercent }}%</span>
                    <span v-if="progressData.currentFile">
                    Archivo {{ progressData.currentFile }} de {{ progressData.totalFiles }}
                    </span>
                </div>
            </div>


            <div v-if="isProcessing" class="relative flex">
                <!-- Botón instalando -->
                <button class="btn btn-block btn-circle btn-primary cursor-wait shadow-md hover:shadow-lg flex-1"
                :class="{ 'invisible': hoveredCancel && hoverCancel }">
                    <div class="radial-progress font-light text-sm" :aria-valuenow="progressPercent" role="progressbar" 
                    :style="{ '--value': progressPercent, '--size': '2.7rem', '--thickness': '7%'}">{{progressPercent}}%</div>
                    {{ progressCancelled ? 'Cancelando...' : currentStageStr }}
                </button>

                <!-- Botón cancelar -->
                <button
                    class="btn btn-error shadow-md hover:shadow-lg rounded-r-full rounded-l-none
                        transition-all duration-400 ease-out
                        absolute right-0 top-0 h-full
                        w-[55px] hover:w-full hover:btn-circle z-20 flex items-center gap-2"
                    @mouseenter="hoverCancel=true"
                    @mouseleave="hoverCancel=false"
                    @transitionend="onCancelAnimationEnd"
                    @click="handleCancel"
                    >
                    <svg class="w-[24px] h-[24px]" fill="currentColor" viewBox="0 0 24 24">
                        <path fill-rule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm7.707-3.707a1 1 0 0 0-1.414 1.414L10.586 12l-2.293 2.293a1 1 0 1 0 1.414 1.414L12 13.414l2.293 2.293a1 1 0 0 0 1.414-1.414L13.414 12l2.293-2.293a1 1 0 0 0-1.414-1.414L12 10.586 9.707 8.293Z"/>
                    </svg>

                    <span v-if="hoveredCancel && hoverCancel" class="whitespace-nowrap">Cancelar</span>
                </button>

            </div>

            <!-- Botón cargando inicial -->
            <button class="btn btn-block btn-circle btn-primary no-animation cursor-wait" v-else-if="loading">
                <span class="loading loading-dots"></span>
                Verificando...
            </button>

            <!-- Botón actualizar (desactualizado) 
            <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg flex-1 rounded-r-none" 
                v-else-if="modpackStatus=='outdated'"
                @click="handleUpdate">
                <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"/>
                </svg>
                Instalar actualización ({{ remoteModpackVersion.string }})
            </button>
            -->

            <div v-else class="relative flex">
                <!-- Botón descargar e instalar (no instalado) -->
                <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg flex-1 rounded-r-none" 
                        v-if="modpackStatus=='uninstalled'"
                        @click="handleInstall">
                    <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2m-8 1V4m0 12-4-4m4 4 4-4"/>
                    </svg>
                    Descargar e instalar
                </button>
                <!-- Botón actualizar (desactualizado) -->
                <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg flex-1 rounded-r-none" 
                    v-else-if="modpackStatus=='outdated'"
                    @click="handleUpdate">
                    <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4"/>
                    </svg>
                    Instalar actualización ({{ remoteModpackVersion.string }})
                </button> 
                <!-- Botón jugar (actualizado) -->
                <button class="btn btn-block btn-circle btn-primary shadow-md hover:shadow-lg flex-1 rounded-r-none" 
                    v-else-if="modpackStatus=='updated'"
                    @click="handleLaunch">
                    <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                        <path fill-rule="evenodd" d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z" clip-rule="evenodd"/>
                    </svg>
                    <span v-if="launchersNamesMap[config.userPreferences.preferedLauncher]">Abrir lanzador de Minecraft ({{ launchersNamesMap[config.userPreferences.preferedLauncher] }})</span>
                    <span v-else>Abrir lanzador de Minecraft</span>
                </button>

                <!-- Botón de opciones -->
                <button class="btn btn-primary shadow-md hover:shadow-lg rounded-r-full rounded-l-none border-l border-primary-content/20 tooltip tooltip-top 
                    " :data-tip="showOptions ? 'Ocultar opciones' : 'Desplegar opciones'"
                    @click="showOptions = !showOptions" @mouseenter="hoverOptions = true" @mouseleave="hoverOptions = false">
                    <svg class="w-5 h-5 transition-transform duration-300" :class="{ 'rotate-90': showOptions }"aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                        <path fill-rule="evenodd" d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm11-4.243a1 1 0 1 0-2 0V11H7.757a1 1 0 1 0 0 2H11v3.243a1 1 0 1 0 2 0V13h3.243a1 1 0 1 0 0-2H13V7.757Z" clip-rule="evenodd"/>
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
            
                <transition
                    enter-active-class="transition-all duration-250 ease-in origin-top"
                    enter-from-class="scale-y-0"
                    enter-to-class="scale-y-100"
                    leave-active-class="transition-all duration-200 ease-in origin-top"
                    leave-from-class="scale-y-100"
                    leave-to-class="scale-y-0">
                    <div v-if="showOptions" class="absolute top-full left-0 right-0 mt-2 z-30">
                        <!-- Opciones (instalado) -->
                        <div class="bg-base-200 rounded-box shadow-xl p-4" v-if="modpackStatus=='updated'">
                            <div class="space-y-2">
                                <div class="flex flex-col px-4 space-y-2">
                                    <span class="flex gap-3 place-items-center text-base font-semibold">
                                        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                            <path fill-rule="evenodd" d="M20.337 3.664c.213.212.354.486.404.782.294 1.711.657 5.195-.906 6.76-1.77 1.768-8.485 5.517-10.611 6.683a.987.987 0 0 1-1.176-.173l-.882-.88-.877-.884a.988.988 0 0 1-.173-1.177c1.165-2.126 4.913-8.841 6.682-10.611 1.562-1.563 5.046-1.198 6.757-.904.296.05.57.191.782.404ZM5.407 7.576l4-.341-2.69 4.48-2.857-.334a.996.996 0 0 1-.565-1.694l2.112-2.111Zm11.357 7.02-.34 4-2.111 2.113a.996.996 0 0 1-1.69-.565l-.422-2.807 4.563-2.74Zm.84-6.21a1.99 1.99 0 1 1-3.98 0 1.99 1.99 0 0 1 3.98 0Z" clip-rule="evenodd"/>
                                        </svg>
                                        Selecciona el launcher deseado:
                                    </span>
                                    <div class="grid grid-cols-2 gap-3">
                                        <label class="flex items-center  justify-center gap-2  cursor-pointer hover:bg-base-300 p-2 rounded-lg" data-tip="¡No tienes instalado este launcher!"
                                            :class="{ 'tooltip tooltip-bottom': !installedLaunchers.includes('classic') }">
                                            <input type="radio" name="radioLauncher" class="radio radio-sm radio-primary" value="classic" 
                                                v-model="config.userPreferences.preferedLauncher"
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
                                                v-model="config.userPreferences.preferedLauncher"
                                                :disabled="!installedLaunchers.includes('uwp')"/>
                                        </label>
                                    </div>
                                </div>
                            </div>
                                    
                            <div class="divider my-1"></div>
                                    
                            <div class="flex flex-row gap-2 justify-around px-2">
                                <div class="w-full">
                                    <button @click="handleUninstall" class="btn btn-ghost btn-block justify-center gap-3 text-base-content hover:text-error hover:bg-error/10 text-base font-semibold">
                                        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                            <path fill-rule="evenodd" d="M8.586 2.586A2 2 0 0 1 10 2h4a2 2 0 0 1 2 2v2h3a1 1 0 1 1 0 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a1 1 0 0 1 0-2h3V4a2 2 0 0 1 .586-1.414ZM10 6h4V4h-4v2Zm1 4a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Zm4 0a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>Desinstalar modpack</span>
                                    </button>
                                </div> 
                                <div class="w-full">
                                    <button @click="handleOpenModpackPath" class="btn btn-ghost btn-block gap-3 text-base-content hover:text-primary hover:bg-primary/10 text-base font-semibold justify-center"> 
                                        <svg class="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                            <path fill-rule="evenodd" d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 .087.586l2.977-7.937A1 1 0 0 1 6 10h12V9a2 2 0 0 0-2-2h-4.532l-1.9-2.28A2 2 0 0 0 8.032 4H4Zm2.693 8H6.5l-3 8H18l3-8H6.693Z" clip-rule="evenodd"/>
                                        </svg>
                                        <span>Abrir carpeta de instalación</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Opciones (instalar / actualizar) -->
                        <div class="bg-base-200 rounded-box shadow-xl p-4" v-if="modpackStatus=='uninstalled' || modpackStatus=='outdated'">
                            <span class="flex gap-3 place-items-center text-base font-semibold tooltip tooltip-bottom w-fit"
                            data-tip="Selecciona la cantidad de memoria RAM máxima que quieres asignarle a Minecraft. Recomiendo como máximo asignarle tres cuartas partes de la RAM total de tu ordenador.">
                                <svg class="w-5 h5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5 13.17a3.001 3.001 0 0 0 0 5.66V20a1 1 0 1 0 2 0v-1.17a3.001 3.001 0 0 0 0-5.66V4a1 1 0 0 0-2 0v9.17ZM11 20v-9.17a3.001 3.001 0 0 1 0-5.66V4a1 1 0 1 1 2 0v1.17a3.001 3.001 0 0 1 0 5.66V20a1 1 0 1 1-2 0Zm6-1.17V20a1 1 0 1 0 2 0v-1.17a3.001 3.001 0 0 0 0-5.66V4a1 1 0 1 0-2 0v9.17a3.001 3.001 0 0 0 0 5.66Z"/>
                                </svg>
                                <span>Memoria RAM máxima: <span class="font-normal">{{ config.userPreferences.maxRamMB }} MB <span class="font-light italic">({{ config.userPreferences.maxRamMB / 1024 }} GB)</span></span></span>        
                            </span>
                            <div class="w-full py-2 px-8">
                                <input class="range range-primary range-xs" type="range" :min=4096 :max=systemMemory.threeQuartersTotalGB*1024 v-model.number="config.userPreferences.maxRamMB" step="1024" />
                                <div class="flex text-sm justify-between">
                                    <span>4 GB</span>
                                    <span>{{ systemMemory.threeQuartersTotalGB }} GB</span>
                                </div>
                            </div>
                            
                            <span class="flex gap-3 place-items-center text-base font-semibold tooltip tooltip-right w-fit">
                                <svg class="w-5 h-5 transition-transform duration-300" :class="{ 'rotate-90': showOptions }" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                    <path fill-rule="evenodd" d="M9.586 2.586A2 2 0 0 1 11 2h2a2 2 0 0 1 2 2v.089l.473.196.063-.063a2.002 2.002 0 0 1 2.828 0l1.414 1.414a2 2 0 0 1 0 2.827l-.063.064.196.473H20a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.089l-.196.473.063.063a2.002 2.002 0 0 1 0 2.828l-1.414 1.414a2 2 0 0 1-2.828 0l-.063-.063-.473.196V20a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.089l-.473-.196-.063.063a2.002 2.002 0 0 1-2.828 0l-1.414-1.414a2 2 0 0 1 0-2.827l.063-.064L4.089 15H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h.09l.195-.473-.063-.063a2 2 0 0 1 0-2.828l1.414-1.414a2 2 0 0 1 2.827 0l.064.063L9 4.089V4a2 2 0 0 1 .586-1.414ZM8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clip-rule="evenodd"/>
                                </svg>
                                <span>Más opciones:</span>
                            </span>
                            <div class="w-full py-1 px-8 flex justify-between">
                                <label class="label gap-1 cursor-pointer">
                                    <input type="checkbox" v-model="config.userPreferences.copyOptions" class="toggle toggle-sm toggle-primary" />
                                    <span class="text-sm tooltip tooltip-right"
                                    data-tip="Copia tus opciones existentes en la .minecraft para usarlas en esta instalación">Copiar opciones</span>
                                </label>
                                <label class="label gap-1 cursor-pointer">
                                    <input type="checkbox" v-model="config.userPreferences.createProfile" class="toggle toggle-sm toggle-primary" />
                                    <span class="text-sm tooltip tooltip-left"
                                    data-tip="Crea un perfil para este modpack en el launcher (recomendado)">Crear perfil</span>
                                </label>
                            </div>
                        </div>

                    </div>
                </transition>
            </div>

            <!-- Información de versión -->
            <div v-if="!loading && !isProcessing && modpackStatus != 'uninstalled'" class="alert relative shadow-md rounded-xl py-2" :class="{
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
                        Estás usando la última versión del modpack
                    </div>
                    <div class="tooltip tooltip-left absolute top-0 right-0 p-0" data-tip="Verificar archivos">
                        <button v-if="modpackStatus == 'updated' && !isProcessing && !loading" class="btn btn-circle btn-ghost"
                        @click="verifyIntegrity">
                            <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
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

import { useConfig } from '../composables/useConfig';

const { config, set } = useConfig();

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
const isProcessing = ref(false)
const error = ref(null)

const installedLaunchers = ref([])
const launchersNamesMap = {
    'classic': 'Oficial Clásico',
    'uwp': 'Oficial Windows App'
}

const progressData = ref({})

const progressPercent = ref(0)
const progressMessage = ref("")
const currentStageStr = ref("")
const currentStage = ref(0)

const progressSpeed = ref(0)
const progressEta = ref(0)
const progressLastSize = ref(0)
const progressTotalSize = ref(0)
const progressCancelled = ref(false)
let latestRawData = {}; // Initialize as empty object for merging
let progressLastUpdate = 0;

function updateUiState() {
    // Si no hay datos, no hacer nada
    if (Object.keys(latestRawData).length === 0) return;
    
    // Copiar datos al estado reactivo (merge)
    Object.assign(progressData.value, latestRawData);
    
    // Actualizar variables dependientes
    // Fix: Monotonic progress check to prevent backward jumps
    const newProgress = latestRawData.progress || 0;
    if (newProgress >= progressPercent.value || latestRawData.stage === 'complete') {
         progressPercent.value = newProgress;
    }

    progressMessage.value = latestRawData.message || progressMessage.value; // Keep old message if missing
    
    progressSpeed.value = latestRawData.speedMBps || 0
    progressEta.value = latestRawData.etaSeconds || 0
    
    if(latestRawData.downloadedSize){
        progressLastSize.value = latestRawData.downloadedSize
        if(!progressTotalSize.value) progressTotalSize.value = latestRawData.totalSize
    }

    // Actualizar stage actual
    switch(latestRawData.stage) {
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
            currentStageStr.value = "Descargando... ("+formatEta(progressEta.value)+" Restantes)";
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

const showOptions = ref(false)
const hoverOptions = ref(false)

const hoverCancel = ref(false)
const hoveredCancel = ref (false)

function onCancelAnimationEnd(e) {
    // Solo actuamos con la transición del ancho del botón
    if (e.propertyName !== 'width') return

    if (hoverCancel.value) {
        // La animación terminó expandiéndose → ocultar botón azul
        hoveredCancel.value = true
    } else {
        // La animación terminó contrayéndose → volver a mostrar botón azul
        hoveredCancel.value = false
    }
}

const systemMemory = ref({})

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

function formatEta(seconds) {
    if (!seconds || seconds <= 0) return "—";

    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);

    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// Actualizar progreso de instalación (Throttled)
const handleProgress = (data) => {
    // Fix: Merge data instead of replacing to preserve transient fields like lastDownloadedFile
    latestRawData = { ...latestRawData, ...data };
    
    const now = performance.now();
    // Actualizar inmediatamente si es evento de completado o ha pasado el tiempo de throttle (50ms = 20fps)
    if (data.stage === 'complete' || data.progress >= 100 || now - progressLastUpdate >= 50) {
        progressLastUpdate = now;
        updateUiState();
         // Optional: clear transient data after update if needed, but merging usually safe here
         // We don't clear latestRawData because we want to stick to the last known state
    }
}

// Verificar estado inicial del modpack
async function checkModpackStatus() {
    try {
        loading.value = true;
        startProcessing();
        error.value = null;

        const isInstalled = await window.modpackAPI.isModpackInstalled(props.modpack_id);
        
        if (!isInstalled) {
            modpackStatus.value = 'uninstalled';
            loading.value = false;
            finishProcessing();
            return;
        }

        // Obtener versiones local y remota
        const [localJson, remoteJson] = await Promise.all([
            window.modpackAPI.getLocalModpackJson(props.modpack_id),
            window.modpackAPI.getRemoteModpackJson(props.modpack_id)
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
        isProcessing.value = true;
        progressCancelled.value = false;
        hoveredCancel.value = false;
        hoverCancel.value = false;
        startProcessing()
        error.value = null;
        currentStage.value = 0;

        await window.modpackAPI.installOrUpdateModpack(props.modpack_id);

        // Actualizar estado después de la instalación
        await checkModpackStatus();
        isProcessing.value = false;
        finishProcessing();

    } catch (err) {
        console.error('Error installing modpack:', err);
        error.value = 'Ha ocurrido un error inesperado durante la instalación';
        isProcessing.value = false;
        finishProcessing();
    }
}

// Actualizar modpack
async function handleUpdate(showConfirm=true) {
    try {

        const confirmed = showConfirm ? await globalDialog.showConfirmable('info',
            'Actualización '+remoteModpackVersion.string,
            '¿Quieres continuar con la actualización del modpack?',
            false,
            'Actualizar',
            'Cancelar'
        ) : true;

        if (!confirmed) {
            return;
        }

        progressCancelled.value = false;
        hoveredCancel.value = false;
        hoverCancel.value = false;
        isProcessing.value = true;
        startProcessing()
        error.value = null;
        currentStage.value = 0;

        await window.modpackAPI.installOrUpdateModpack(props.modpack_id);

        // Actualizar estado después de la actualización
        await checkModpackStatus();
        isProcessing.value = false;
        finishProcessing();

    } catch (err) {
        console.error('Error updating modpack:', err);
        error.value = 'Ha ocurrido un error inesperado durante la instalación';
        isProcessing.value = false;
        finishProcessing();
    }
}

// Cancelar instalación
async function handleCancel() {
    // No esperar - responder inmediatamente a la UI
    progressCancelled.value = true;
    
    // Iniciar cancelación en background (sin await)
    window.modpackAPI.cancelInstallOrUpdate(props.modpack_id)
        .catch(err => {
            console.error('Error cancelling modpack:', err);
        });
}

// Abrir launcher de Minecraft
async function handleLaunch() {
    if(!config.userPreferences.preferedLauncher){
        globalDialog.showError('Ningún launcher encontrado', 'No se ha podido encontrar ningún launcher compatible instalado. Por favor, instala un launcher compatible para poder abrirlo.');
        return;
    }
    await window.appAPI.openMinecraftLauncher(config.userPreferences.preferedLauncher);
}

async function handleUninstall(){
    globalDialog.show({ title:"No implementado", message:"La desinstalación no está implementada aún. Os jodéis y lo borrais a mano :)", type: 'warning' })
}

// Abrir carpeta de instalación
async function handleOpenModpackPath() {
    await window.modpackAPI.openModpackPath(props.modpack_id);
}

// Verificar integridad
async function verifyIntegrity() {
    try {
        loading.value = true;
        startProcessing()
        const result = await window.modpackAPI.verifyModpackIntegrity(props.modpack_id);
        
        if (!result.valid) {
            let message = result.error
            if(result.missing>0 || result.corrupted>0 || result.obsolet>0){
                message+="\n\nArchivos faltantes: "+result.missing+"\nArchivos corruptos: "
                +result.corrupted+"\nArchivos obsoletos: "+result.obsolet;
            }
            const confirmed = await globalDialog.showConfirmable('warning',
            'Es necesario reparar archivos',
            message+'\n\n¿Deseas reparar el modpack?',
            false,
            'Reparar',
            'Cancelar'
            );
            if (confirmed) {
                await handleUpdate(false);
            }
        }
        loading.value = false;
        finishProcessing();
    } catch (err) {
        console.error('Error verificando la integridad de los archivos:', err);
        window.appAPI.showToast('error', 'Error verificando la integridad de los archivos', 'Ha ocurrido un error verificando la integridad de los archivos instalados del modpack');
        loading.value = false;
        finishProcessing();
    }
}

onBeforeMount(async () => {
    // Registrar listener de progreso
    window.appAPI.onProgress(handleProgress);
    
    // Verificar estado inicial
    await checkModpackStatus();

    // Obtener launchers
    installedLaunchers.value = await window.appAPI.getMinecraftLaunchers(); 
    if(!installedLaunchers.value.includes(config.userPreferences.preferedLauncher)){
        if(installedLaunchers.value.includes('classic')) await set('userPreferences.preferedLauncher', 'classic')
        else if(installedLaunchers.value.includes('uwp')) await set('userPreferences.preferedLauncher', 'uwp')
        else await set('userPreferences.preferedLauncher', '')
    }

    // Obtener info del sistema
    systemMemory.value = await window.appAPI.getRamInfo();

})

onUnmounted(() => {
    // Limpiar listener
    window.appAPI.removeProgressListener();
})
</script>