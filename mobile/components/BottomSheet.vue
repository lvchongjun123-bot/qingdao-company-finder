<template>
  <div
    class="bsheet"
    :style="sheetStyle"
    @touchstart.passive="false"
  >
    <!-- 拖拽条 -->
    <div
      class="bs-handle"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <div class="bs-handle-bar"></div>
    </div>

    <!-- 标题栏 -->
    <div class="bs-head" v-if="$slots.header">
      <slot name="header"></slot>
    </div>

    <!-- 主体内容（可滚动） -->
    <div class="bs-body" ref="bodyRef">
      <slot></slot>
    </div>

    <!-- 底部（分页） -->
    <div class="bs-foot" v-if="$slots.footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup>
import { useBottomSheet } from '../composables/useBottomSheet'

const {
  sheetStyle,
  onTouchStart, onTouchMove, onTouchEnd
} = useBottomSheet()
</script>

<style scoped>
.bsheet {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  height: 100vh;
  z-index: 210;
  background: rgba(255,255,255,.94);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,.12);
  display: flex;
  flex-direction: column;
  will-change: transform;
  touch-action: none;
}

/* 拖拽条 */
.bs-handle {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.bs-handle:active { cursor: grabbing; }
.bs-handle-bar {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: #d0d0d0;
}

/* 头部 */
.bs-head {
  flex-shrink: 0;
  padding: 0 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

/* 内容区 */
.bs-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px 12px;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* 底部 */
.bs-foot {
  flex-shrink: 0;
  padding: 8px 12px max(12px, env(safe-area-inset-bottom, 12px));
  border-top: 1px solid #eee;
}
</style>
