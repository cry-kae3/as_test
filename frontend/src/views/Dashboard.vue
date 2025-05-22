<template>
  <div class="dashboard">
    <h1 class="text-3xl font-bold">ダッシュボード</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <!-- シフト情報カード -->
      <Card>
        <template #title>
          <div class="flex align-items-center">
            <i class="pi pi-calendar mr-2"></i>
            <span>シフト情報</span>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="text-center">
            <ProgressSpinner style="width: 50px; height: 50px;" />
            <p>データを読み込み中...</p>
          </div>
          <template v-else>
            <div class="text-center mb-4">
              <p class="text-xl mb-2">現在のシフトは{{ currentShifts.length > 0 ? 'あります' : 'ありません' }}</p>
            </div>
            <div class="text-center">
              <Button 
                label="シフト作成" 
                icon="pi pi-plus" 
                @click="navigateToCreateShift" 
              />
            </div>
          </template>
        </template>
      </Card>
      
      <!-- スタッフ情報カード -->
      <Card>
        <template #title>
          <div class="flex align-items-center">
            <i class="pi pi-users mr-2"></i>
            <span>スタッフ情報</span>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="text-center">
            <ProgressSpinner style="width: 50px; height: 50px;" />
            <p>データを読み込み中...</p>
          </div>
          <template v-else>
            <div class="text-center mb-4">
              <p class="text-xl mb-2">スタッフ数: {{ staffCount }}名</p>
            </div>
            <div class="text-center">
              <Button 
                label="スタッフ管理へ" 
                icon="pi pi-arrow-right" 
                @click="navigateToStaffManagement" 
              />
            </div>
          </template>
        </template>
      </Card>
      
      <!-- 休み希望カード -->
      <Card>
        <template #title>
          <div class="flex align-items-center">
            <i class="pi pi-calendar-times mr-2"></i>
            <span>休み希望</span>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="text-center">
            <ProgressSpinner style="width: 50px; height: 50px;" />
            <p>データを読み込み中...</p>
          </div>
          <template v-else>
            <div class="text-center">
              <template v-if="pendingDayOffRequests.length > 0">
                <p class="text-xl mb-2">未処理の休み希望は {{ pendingDayOffRequests.length }}件あります</p>
                <Button 
                  label="確認する" 
                  icon="pi pi-eye" 
                  @click="navigateToDayOffRequests" 
                  class="mt-2"
                />
              </template>
              <p v-else class="text-xl mb-2">未処理の休み希望はありません</p>
            </div>
          </template>
        </template>
      </Card>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';

export default {
  name: 'Dashboard',
  components: {
    Card,
    Button,
    ProgressSpinner
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    const loading = ref(true);
    const loadingError = ref(false);
    
    // データロード処理
    const loadData = async () => {
      loading.value = true;
      loadingError.value = false;
      
      try {
        // ユーザーが認証済みであることを確認
        if (!store.getters['auth/isAuthenticated']) {
          router.push('/login');
          return;
        }
        
        // ユーザーの店舗IDを取得（店舗IDがない場合は何もしない）
        const storeId = store.state.auth.currentUser?.storeId;
        if (!storeId) {
          loading.value = false;
          return;
        }
        
        // 並列でデータを取得（エラーは個別にキャッチ）
        const promises = [
          store.dispatch('shift/fetchCurrentShifts').catch(error => {
            console.error('シフト取得エラー:', error);
            return [];
          }),
          store.dispatch('staff/fetchStaff').catch(error => {
            console.error('スタッフ取得エラー:', error);
            return [];
          }),
          store.dispatch('staff/fetchDayOffRequests').catch(error => {
            console.error('休み希望取得エラー:', error);
            return [];
          })
        ];
        
        await Promise.all(promises);
      } catch (error) {
        console.error('データ読み込みエラー:', error);
        loadingError.value = true;
      } finally {
        loading.value = false;
      }
    };
    
    // マウント時にデータをロード
    onMounted(async () => {
      await loadData();
    });
    
    // ナビゲーション関数
    const navigateToCreateShift = () => {
      router.push('/shifts/create');
    };
    
    const navigateToStaffManagement = () => {
      router.push('/staff');
    };
    
    const navigateToDayOffRequests = () => {
      router.push('/staff/day-off-requests');
    };
    
    return {
      // 状態
      loading,
      loadingError,
      
      // ゲッター
      currentShifts: computed(() => store.getters['shift/currentShifts'] || []),
      staffCount: computed(() => store.getters['staff/staffCount'] || 0),
      pendingDayOffRequests: computed(() => store.getters['staff/pendingDayOffRequests'] || []),
      
      // メソッド
      loadData,
      navigateToCreateShift,
      navigateToStaffManagement,
      navigateToDayOffRequests
    };
  }
};
</script>