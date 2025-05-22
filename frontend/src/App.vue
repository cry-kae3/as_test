<template>
  <div class="app-container">
    <Toast />
    <ConfirmDialog />

    <div v-if="isAuthenticated" class="layout-wrapper">
      <!-- サイドバーメニュー -->
      <div class="layout-sidebar" :class="{ active: menuActive }">
        <div class="sidebar-header">
          <router-link to="/" class="app-logo">
            <h1>AIS</h1>
          </router-link>
        </div>

        <div class="sidebar-menu">
          <ul class="menu-list">
            <li
              v-for="item in filteredMenuItems"
              :key="item.label"
              v-show="item.visible === undefined || item.visible"
            >
              <router-link :to="item.to" class="menu-item">
                <i :class="item.icon"></i>
                <span>{{ item.label }}</span>
              </router-link>
            </li>
          </ul>
        </div>
      </div>

      <!-- メインコンテンツ -->
      <div class="layout-main">
        <!-- ヘッダー -->
        <div class="layout-topbar">
          <!-- モバイル向けメニューボタン -->
          <Button
            icon="pi pi-bars"
            @click="toggleMenu"
            class="p-button-rounded p-button-text menu-toggle"
          />

          <div class="user-menu">
            <!-- 管理者用ユーザー切替ドロップダウン -->
            <Dropdown
              v-if="isAdmin && !isImpersonating"
              v-model="selectedUser"
              :options="userList"
              optionLabel="username"
              placeholder="ユーザー切替"
              @change="switchUser"
              class="mr-2"
            />

            <!-- 現在のユーザー名：閲覧モード中は閲覧対象のユーザー名を表示 -->
            <span v-if="currentUser" class="username mr-2">
              {{
                isImpersonating && impersonatedUser
                  ? impersonatedUser.username
                  : currentUser.username
              }}
            </span>

            <!-- 閲覧モード中は元に戻るボタンを表示 -->
            <Button
              v-if="isImpersonating"
              icon="pi pi-user"
              @click="stopImpersonating"
              title="自分のアカウントに戻る"
              class="p-button-rounded p-button-text p-button-info mr-2"
            />

            <!-- ログアウトボタン -->
            <Button
              icon="pi pi-power-off"
              @click="logout"
              title="ログアウト"
              class="p-button-rounded p-button-text"
            />
          </div>
        </div>

        <!-- 閲覧モード表示バー -->
        <div v-if="isImpersonating" class="impersonation-bar">
          <i class="pi pi-eye"></i>
          <span>{{ impersonatedUser.username }} として閲覧中</span>
        </div>

        <!-- コンテンツエリア -->
        <div class="layout-content">
          <router-view />
        </div>

        <!-- フッター -->
        <div class="layout-footer">
          <div class="footer-content">
            <span>&copy; {{ new Date().getFullYear() }} AIS</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 未認証時はログイン画面のみ表示 -->
    <div v-else>
      <router-view />
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import axios from 'axios';

export default {
  name: "App",
  setup() {
    const store = useStore();
    const router = useRouter();
    const userList = ref([]);
    const selectedUser = ref(null);
    const menuActive = ref(false);

    const isAuthenticated = computed(
      () => store.getters["auth/isAuthenticated"]
    );
    const currentUser = computed(() => store.getters["auth/currentUser"]);
    const isAdmin = computed(
      () => currentUser.value && currentUser.value.role === 'admin'
    );
    const isImpersonating = computed(
      () => store.getters["auth/isImpersonating"]
    );
    const impersonatedUser = computed(
      () => store.getters["auth/impersonatedUser"]
    );

    const actualCurrentUser = computed(() => {
      if (isImpersonating.value) {
        return impersonatedUser.value;
      }
      return currentUser.value;
    });

    const menuItems = ref([
      {
        label: "ダッシュボード",
        icon: "pi pi-fw pi-home",
        to: "/",
        roles: ["admin", "owner", "staff"]
      },
      {
        label: "店舗管理",
        icon: "pi pi-fw pi-building",
        to: "/stores",
        roles: ["admin", "owner"]
      },
      {
        label: "スタッフ管理",
        icon: "pi pi-fw pi-users",
        to: "/staff",
        roles: ["admin", "owner"]
      },
      {
        label: "シフト管理",
        icon: "pi pi-fw pi-calendar",
        to: "/shifts",
        roles: ["admin", "owner", "staff"]
      },
      {
        label: "ユーザー管理",
        icon: "pi pi-fw pi-user-plus",
        to: "/users",
        roles: ["admin"]
      },
      {
        label: "変更ログ",
        icon: "pi pi-fw pi-history",
        to: "/change-logs",
        roles: ["admin", "owner"]
      },
    ]);

    const filteredMenuItems = computed(() => {
      if (!actualCurrentUser.value) return [];
      
      const userRole = actualCurrentUser.value.role;
      return menuItems.value.filter(item => 
        item.roles.includes(userRole)
      );
    });

    const toggleMenu = () => {
      menuActive.value = !menuActive.value;
    };

    const fetchUsers = async () => {
      if (!isAdmin.value || isImpersonating.value) return [];

      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/auth/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response && response.data && Array.isArray(response.data)) {
          userList.value = response.data.filter(
            (u) => u.id !== currentUser.value?.id
          );
          return response.data;
        } else {
          console.error("不正なレスポンス形式:", response);
          userList.value = [];
          return [];
        }
      } catch (error) {
        console.error("ユーザー一覧取得エラー:", error);
        userList.value = [];
        return [];
      }
    };

    const switchUser = () => {
      if (!selectedUser.value || !currentUser.value) return;

      store.dispatch("auth/startImpersonating", selectedUser.value);
      router.push("/");
    };

    const stopImpersonating = () => {
      store.dispatch("auth/stopImpersonating");
      selectedUser.value = null;
    };

    const logout = () => {
      store.dispatch("auth/logout");
      router.push("/login");
    };

    watch(
      () => router.currentRoute.value.path,
      () => {
        if (menuActive.value) {
          menuActive.value = false;
        }
      }
    );
    
    onMounted(async () => {
      try {
        if (isAuthenticated.value) {
          await store.dispatch("auth/getCurrentUser");
          
          if (isAdmin.value && !isImpersonating.value) {
            await fetchUsers();
          }
        }

        window.addEventListener("resize", () => {
          if (window.innerWidth > 768 && menuActive.value) {
            menuActive.value = false;
          }
        });
      } catch (error) {
        console.error("App初期化エラー:", error);
      }
    });
    
    return {
      isAuthenticated,
      currentUser,
      isAdmin,
      filteredMenuItems,
      userList,
      selectedUser,
      isImpersonating,
      impersonatedUser,
      menuActive,
      toggleMenu,
      fetchUsers,
      switchUser,
      stopImpersonating,
      logout,
    };
  },
};
</script>

<style>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-wrapper {
  display: flex;
  flex: 1;
  min-height: 100vh;
}

.layout-sidebar {
  width: 250px;
  background-color: #1e293b;
  color: white;
  position: fixed;
  height: 100vh;
  left: 0;
  top: 0;
  z-index: 999;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-logo {
  text-decoration: none;
  color: white;
}

.app-logo h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.sidebar-menu {
  padding: 1rem 0;
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: background-color 0.3s, color 0.3s;
}

.menu-item:hover,
.router-link-active {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
}

.menu-item i {
  margin-right: 0.75rem;
  font-size: 1.1rem;
}

.layout-main {
  flex: 1;
  margin-left: 250px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.layout-topbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 1.5rem;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.menu-toggle {
  display: none;
  margin-right: auto;
}

.user-menu {
  display: flex;
  align-items: center;
}

.username {
  font-weight: 500;
}

.impersonation-bar {
  background-color: #fff8e1;
  color: #f57c00;
  padding: 0.5rem 1rem;
  text-align: center;
  border-bottom: 1px solid #ffe0b2;
}

.impersonation-bar i {
  margin-right: 0.5rem;
}

.layout-content {
  flex: 1;
  padding: 1.5rem;
  background-color: #f8f9fa;
}

.layout-footer {
  padding: 1rem;
  background-color: white;
  border-top: 1px solid #e9ecef;
  text-align: center;
  color: #6c757d;
}

.dashboard-card {
  height: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  transition: box-shadow 0.3s, transform 0.3s;
}

.dashboard-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.p-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}

.p-button {
  transition: all 0.2s;
}

.p-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.p-datatable .p-datatable-header {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-width: 1px 1px 0 1px;
}

.p-datatable .p-datatable-footer {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-width: 0 1px 1px 1px;
}

.p-dialog .p-dialog-header {
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
}

.p-dialog .p-dialog-content {
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-3 {
  margin-top: 1rem;
}

.mb-3 {
  margin-bottom: 1rem;
}

.text-center {
  text-align: center;
}

.text-lg {
  font-size: 1.125rem;
}

.text-xl {
  font-size: 1.25rem;
}

.flex {
  display: flex;
}

.align-items-center {
  align-items: center;
}

.justify-content-between {
  justify-content: space-between;
}

.gap-2 {
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .layout-sidebar {
    transform: translateX(-250px);
  }

  .layout-sidebar.active {
    transform: translateX(0);
  }

  .layout-main {
    margin-left: 0;
  }

  .layout-topbar {
    padding: 0 1rem;
  }

  .menu-toggle {
    display: block;
  }

  .layout-content {
    padding: 1rem;
  }

  .p-dialog {
    width: 90% !important;
  }

  .col-12.md\:col-6 {
    flex: 0 0 100%;
  }
}

@media (min-width: 769px) and (max-width: 992px) {
  .col-12.md\:col-6 {
    flex: 0 0 50%;
  }

  .col-12.md\:col-6.lg\:col-4 {
    flex: 0 0 50%;
  }
}

@media (min-width: 993px) {
  .col-12.md\:col-6.lg\:col-4 {
    flex: 0 0 33.33333%;
  }
}

:root {
  --primary-color: #3b82f6;
  --primary-light-color: #bfdbfe;
  --primary-dark-color: #1d4ed8;

  --surface-ground: #f8f9fa;
  --surface-card: #ffffff;
  --surface-border: #dee2e6;
  --surface-hover: #f1f5f9;

  --text-color: #1e293b;
  --text-color-secondary: #64748b;

  --green-50: #f0fdf4;
  --green-100: #dcfce7;
  --green-700: #15803d;

  --yellow-50: #fefce8;
  --yellow-100: #fef9c3;
  --yellow-700: #a16207;

  --blue-50: #eff6ff;
  --blue-100: #dbeafe;
  --blue-700: #1d4ed8;

  --cyan-100: #cffafe;
  --cyan-700: #0e7490;

  --teal-100: #ccfbf1;
  --teal-700: #0f766e;

  --orange-100: #ffedd5;
  --orange-700: #c2410c;

  --red-100: #fee2e2;
  --red-500: #ef4444;
  --red-600: #dc2626;
  --red-700: #b91c1c;
}
</style>