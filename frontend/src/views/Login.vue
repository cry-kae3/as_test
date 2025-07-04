<template>
  <div class="login-container">
    <Card class="login-card">
      <template #title>
        <div class="text-center">
          <h1 class="text-3xl">AIShift</h1>
          <p class="mt-2 text-lg text-gray-600">ログイン</p>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="login" class="p-fluid">
          <div class="field mb-4">
            <label for="username" class="font-bold">ユーザー名</label>
            <InputText
              id="username"
              v-model="username"
              :class="{ 'p-invalid': submitted && !username }"
              placeholder="ユーザー名を入力"
              autocomplete="username"
              required
            />
            <small v-if="submitted && !username" class="p-error"
              >ユーザー名は必須です</small
            >
          </div>

          <div class="field mb-4">
            <label for="password" class="font-bold">パスワード</label>
            <Password
              id="password"
              v-model="password"
              :class="{ 'p-invalid': submitted && !password }"
              placeholder="パスワードを入力"
              :feedback="false"
              :toggleMask="true"
              autocomplete="current-password"
              required
            />
            <small v-if="submitted && !password" class="p-error"
              >パスワードは必須です</small
            >
          </div>

          <div v-if="error" class="field mb-4">
            <Message severity="error" :closable="false">{{ error }}</Message>
          </div>

          <div class="field">
            <Button
              type="submit"
              label="ログイン"
              icon="pi pi-lock-open"
              class="w-full"
              :loading="loading"
            />
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>
  
  <script>
import { ref, computed } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import Password from "primevue/password";

export default {
  name: "Login",
  components: {
    Password,
  },
  setup() {
    const store = useStore();
    const router = useRouter();

    // 状態
    const username = ref("");
    const password = ref("");
    const submitted = ref(false);

    // ストアからの情報取得
    const loading = computed(() => store.getters["auth/loading"]);
    const error = computed(() => store.getters["auth/error"]);

    // ログイン処理
    const login = async () => {
      submitted.value = true;

      if (!username.value || !password.value) {
        return;
      }

      try {
        await store.dispatch("auth/login", {
          username: username.value,
          password: password.value,
        });

        router.push("/");
      } catch (error) {
        console.error("ログインエラー:", error);
      }
    };

    return {
      username,
      password,
      submitted,
      loading,
      error,
      login,
    };
  },
};
</script>
  
  <style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: var(--surface-ground);
}

.login-card {
  width: 100%;
  max-width: 450px;
  margin: 2rem;
}

.login-card :deep(.p-card-title) {
  display: block;
  padding-bottom: 0;
}
</style>