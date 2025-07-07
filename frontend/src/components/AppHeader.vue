<template>
  <div class="app-header">
    <div class="header-content">
      <div class="logo">
        <h1>AIS</h1>
      </div>
      
      <div class="navigation">
        <router-link to="/" class="nav-link">ダッシュボード</router-link>
        <router-link to="/shift-management" class="nav-link">シフト管理</router-link>
        <router-link to="/staff-management" class="nav-link">スタッフ管理</router-link>
        <router-link v-if="hasAdminAccess" to="/store-management" class="nav-link">店舗管理</router-link>
        <router-link v-if="hasAdminAccess" to="/change-logs" class="nav-link">変更ログ</router-link>
      </div>
      
      <div class="user-controls">
        <!-- アカウント切り替え用ドロップダウン -->
        <div v-if="isAdmin" class="account-switcher">
          <span class="p-input-icon-left">
            <i class="pi pi-search" />
            <InputText v-model="userSearchQuery" placeholder="アカウント検索..." class="user-search" />
          </span>
          
          <Dropdown 
            v-model="selectedUser" 
            :options="filteredUserList" 
            optionLabel="username" 
            placeholder="ユーザーを選択" 
            @change="handleUserChange"
            class="user-dropdown"
          />
        </div>
        
        <!-- 管理者モードに戻るボタン -->
        <Button 
          v-if="isImpersonating" 
          icon="pi pi-sign-out" 
          class="p-button-sm p-button-secondary" 
          @click="stopImpersonation" 
          label="管理者モードに戻る"
        />
        
        <Button 
          icon="pi pi-user" 
          class="p-button-sm" 
          @click="toggleUserMenu"
        />
        <Menu ref="userMenu" :model="userMenuItems" :popup="true" />
      </div>
    </div>
    
    <div v-if="isImpersonating" class="impersonation-bar">
      <div class="p-d-flex p-ai-center p-jc-between">
        <span>
          <i class="pi pi-eye"></i>
          <strong>{{ impersonatedUser.username }}</strong> として閲覧中
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { mapGetters, mapActions } from 'vuex';

export default {
  data() {
    return {
      selectedUser: null,
      userList: [],
      userSearchQuery: '',
      userMenuItems: [
        {
          label: 'プロフィール',
          icon: 'pi pi-user-edit',
          command: () => {
            this.$router.push('/profile');
          }
        },
        {
          label: 'ログアウト',
          icon: 'pi pi-sign-out',
          command: () => {
            this.logout();
          }
        }
      ]
    };
  },
  
  computed: {
    ...mapGetters({
      currentUser: 'auth/currentUser',
      isAdmin: 'auth/isAdmin',
      isImpersonating: 'auth/isImpersonating',
      impersonatedUser: 'auth/impersonatedUser',
      originalUser: 'auth/originalUser'
    }),
    
    // アクセス権限の確認（管理者または管理者がなりすましモードではない場合）
    hasAdminAccess() {
      return this.isAdmin && !this.isImpersonating;
    },
    
    // 検索フィルター付きのユーザーリスト
    filteredUserList() {
      if (!this.userSearchQuery) {
        return this.userList;
      }
      
      const query = this.userSearchQuery.toLowerCase();
      return this.userList.filter(user => 
        user.username.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query)
      );
    }
  },
  
  methods: {
    ...mapActions({
      startImpersonating: 'auth/startImpersonating',
      stopImpersonating: 'auth/stopImpersonating',
      logout: 'auth/logout'
    }),
    
    toggleUserMenu(event) {
      this.$refs.userMenu.toggle(event);
    },
    
    async fetchUsers() {
      if (!this.isAdmin) return;
      
      try {
        const response = await this.$axios.get('/api/auth/users');
        // 自分自身と管理者権限を持つユーザーは除外
        this.userList = response.data.filter(user => 
          user.id !== this.currentUser.id && user.role !== 'admin'
        );
      } catch (error) {
        console.error('ユーザー一覧取得エラー:', error);
        this.$toast.add({
          severity: 'error',
          summary: 'エラー',
          detail: 'ユーザー一覧の取得に失敗しました',
          life: 3000
        });
      }
    },
    
    handleUserChange() {
      if (!this.selectedUser) return;
      
      this.startImpersonating(this.selectedUser);
      this.$router.push('/');
      
      this.$toast.add({
        severity: 'info',
        summary: '閲覧モード開始',
        detail: `${this.selectedUser.username} として閲覧モードを開始しました`,
        life: 3000
      });
    },
    
    stopImpersonation() {
      this.stopImpersonating();
      this.selectedUser = null;
      this.userSearchQuery = '';
      
      this.$toast.add({
        severity: 'info',
        summary: '閲覧モード終了',
        detail: '管理者モードに戻りました',
        life: 3000
      });
    }
  },
  
  mounted() {
    this.fetchUsers();
  }
};
</script>

<style scoped>
.app-header {
  background-color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
}

.navigation {
  display: flex;
  gap: 1rem;
}

.nav-link {
  color: #333;
  text-decoration: none;
  padding: 0.5rem;
}

.nav-link.router-link-active {
  font-weight: bold;
  color: var(--primary-color);
}

.user-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.account-switcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-search {
  width: 180px;
}

.user-dropdown {
  min-width: 150px;
}

.impersonation-bar {
  background-color: #fff8e1;
  color: #f57c00;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

@media (max-width: 992px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .navigation {
    margin: 0.5rem 0;
    width: 100%;
    overflow-x: auto;
  }
  
  .user-controls {
    width: 100%;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
  
  .account-switcher {
    flex-direction: column;
    align-items: flex-end;
  }
}

@media (max-width: 576px) {
  .account-switcher {
    width: 100%;
  }
  
  .user-search,
  .user-dropdown {
    width: 100%;
  }
}
</style>