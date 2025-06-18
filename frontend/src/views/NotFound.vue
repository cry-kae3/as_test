<template>
  <div class="not-found">
    <div class="not-found-content">
      <i class="pi pi-exclamation-circle" style="font-size: 5rem; color: var(--primary-color);"></i>
      <h1>404</h1>
      <h2>ページが見つかりません</h2>
      <p>お探しのページは存在しないか、移動した可能性があります。</p>
      <Button label="ホームに戻る" icon="pi pi-home" @click="goHome" />
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router';

export default {
  name: 'NotFound',
  setup() {
    const router = useRouter();
    
    // ホームページに戻る
    const goHome = () => {
      router.push('/');
    };
    
    return {
      goHome
    };
  }
};
</script>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.not-found-content {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 4rem;
  margin: 1rem 0;
  color: var(--primary-color);
}

h2 {
  margin-bottom: 1rem;
}

p {
  margin-bottom: 2rem;
  color: var(--text-color-secondary);
}
</style>