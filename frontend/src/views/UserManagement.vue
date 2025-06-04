<template>
  <div class="user-management">
    <h1 class="page-title">ユーザー管理</h1>

    <div class="toolbar">
      <Button
        label="新規ユーザー"
        icon="pi pi-plus"
        class="p-button-primary"
        @click="openNew"
      />
    </div>

    <DataTable
      :value="users"
      :paginator="true"
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      dataKey="id"
      :loading="loading"
      class="p-datatable-sm"
    >
      <Column field="id" header="ID" sortable style="width: 5rem"></Column>
      <Column field="username" header="ユーザー名" sortable></Column>
      <Column field="email" header="メールアドレス" sortable></Column>
      <Column field="company_name" header="法人名・屋号" sortable>
        <template #body="{ data }">
          {{ data.company_name || "未設定" }}
        </template>
      </Column>
      <Column field="role" header="役割" sortable>
        <template #body="{ data }">
          <Tag
            :severity="data.role === 'admin' ? 'danger' : 'info'"
            :value="getRoleLabel(data.role)"
          />
        </template>
      </Column>
      <Column field="is_active" header="状態" sortable>
        <template #body="{ data }">
          <Tag
            :severity="data.is_active ? 'success' : 'danger'"
            :value="data.is_active ? '有効' : '停止'"
          />
        </template>
      </Column>
      <Column field="parent_user" header="親ユーザー" sortable>
        <template #body="{ data }">
          {{ data.parent_user_name || "なし" }}
        </template>
      </Column>
      <Column field="created_at" header="作成日" sortable>
        <template #body="{ data }">
          {{ formatDate(data.created_at) }}
        </template>
      </Column>
      <Column header="操作" style="width: 12rem">
        <template #body="{ data }">
          <Button
            icon="pi pi-pencil"
            class="p-button-rounded p-button-text p-button-plain"
            @click="editUser(data)"
            title="編集"
          />
          <Button
            v-if="data.is_active"
            icon="pi pi-ban"
            class="p-button-rounded p-button-text p-button-warning"
            @click="confirmStopUser(data)"
            title="停止"
          />
          <Button
            v-else
            icon="pi pi-check"
            class="p-button-rounded p-button-text p-button-success"
            @click="confirmActivateUser(data)"
            title="有効化"
          />
          <Button
            icon="pi pi-trash"
            class="p-button-rounded p-button-text p-button-danger"
            @click="confirmDeleteUser(data)"
            title="削除"
          />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="userDialog.visible"
      :header="userDialog.isNew ? '新規ユーザー' : 'ユーザー編集'"
      :modal="true"
      class="p-fluid"
      :style="{ width: '550px' }"
    >
      <div class="field">
        <label for="username"
          >ユーザー名 <span class="required-mark">*</span></label
        >
        <InputText
          id="username"
          v-model="userDialog.user.username"
          :class="{ 'p-invalid': submitted && !userDialog.user.username }"
          required
          autofocus
        />
        <small v-if="submitted && !userDialog.user.username" class="p-error"
          >ユーザー名は必須です</small
        >
      </div>

      <div class="field">
        <label for="email"
          >メールアドレス <span class="required-mark">*</span></label
        >
        <InputText
          id="email"
          v-model="userDialog.user.email"
          :class="{ 'p-invalid': submitted && !userDialog.user.email }"
          required
        />
        <small v-if="submitted && !userDialog.user.email" class="p-error"
          >メールアドレスは必須です</small
        >
      </div>

      <div class="field">
        <label for="company_name">法人名・屋号</label>
        <InputText
          id="company_name"
          v-model="userDialog.user.company_name"
          placeholder="法人名または屋号を入力"
        />
      </div>

      <div class="field">
        <label for="password"
          >パスワード
          <span v-if="userDialog.isNew" class="required-mark">*</span></label
        >
        <Password
          id="password"
          v-model="userDialog.user.password"
          :class="{
            'p-invalid':
              submitted && userDialog.isNew && !userDialog.user.password,
          }"
          :feedback="false"
          :toggleMask="true"
        />
        <small
          v-if="submitted && userDialog.isNew && !userDialog.user.password"
          class="p-error"
          >パスワードは必須です</small
        >
        <small v-if="!userDialog.isNew" class="form-text text-muted"
          >空白のままにすると変更されません</small
        >
      </div>

      <div class="field">
        <label for="role">役割 <span class="required-mark">*</span></label>
        <Dropdown
          id="role"
          v-model="userDialog.user.role"
          :options="roleOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="役割を選択"
          :class="{ 'p-invalid': submitted && !userDialog.user.role }"
          @change="onRoleChange"
        />
        <small v-if="submitted && !userDialog.user.role" class="p-error"
          >役割は必須です</small
        >
      </div>

      <div class="field" v-if="!userDialog.isNew">
        <label for="is_active">アカウント状態</label>
        <div class="field-checkbox">
          <Checkbox
            id="is_active"
            v-model="userDialog.user.is_active"
            :binary="true"
          />
          <label for="is_active">アカウントを有効にする</label>
        </div>
        <small class="form-text text-muted">
          無効にするとユーザーは即座にログアウトされ、ログインできなくなります
        </small>
      </div>

      <div v-if="userDialog.user.role === 'staff'" class="field">
        <label for="parent_user_id">
          親ユーザー（オーナー） <span class="required-mark">*</span>
        </label>
        <Dropdown
          id="parent_user_id"
          v-model="userDialog.user.parent_user_id"
          :options="ownerUsers"
          optionLabel="username"
          optionValue="id"
          placeholder="オーナーユーザーを選択"
          :class="{
            'p-invalid':
              submitted &&
              userDialog.user.role === 'staff' &&
              !userDialog.user.parent_user_id,
          }"
        />
        <small
          v-if="
            submitted &&
            userDialog.user.role === 'staff' &&
            !userDialog.user.parent_user_id
          "
          class="p-error"
          >スタッフの場合、親ユーザー（オーナー）の指定は必須です</small
        >
      </div>

      <template #footer>
        <Button
          label="キャンセル"
          icon="pi pi-times"
          class="p-button-text"
          @click="hideDialog"
        />
        <Button
          label="保存"
          icon="pi pi-check"
          class="p-button-primary"
          @click="saveUser"
          :loading="saving"
        />
      </template>
    </Dialog>

    <ConfirmDialog></ConfirmDialog>
    <Toast />
  </div>
</template>
  
<script>
import { ref, reactive, onMounted } from "vue";
import { useStore } from "vuex";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import Password from "primevue/password";
import Checkbox from "primevue/checkbox";

export default {
  name: "UserManagement",
  components: {
    Password,
    Checkbox,
  },
  setup() {
    const store = useStore();
    const toast = useToast();
    const confirm = useConfirm();

    const loading = ref(false);
    const saving = ref(false);
    const submitted = ref(false);
    const users = ref([]);
    const ownerUsers = ref([]);

    const userDialog = reactive({
      visible: false,
      isNew: false,
      user: {
        id: null,
        username: "",
        email: "",
        company_name: "",
        password: "",
        role: "",
        parent_user_id: null,
        is_active: true,
      },
    });

    const roleOptions = [
      { label: "管理者", value: "admin" },
      { label: "オーナー", value: "owner" },
      { label: "スタッフ", value: "staff" },
    ];

    const fetchUsers = async () => {
      loading.value = true;

      try {
        const response = await store.dispatch("auth/fetchUsers");
        users.value = response;

        ownerUsers.value = response.filter(
          (user) => user.role === "owner" && user.is_active
        );
      } catch (error) {
        console.error("ユーザー一覧取得エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "ユーザー一覧の取得に失敗しました",
          life: 3000,
        });
      } finally {
        loading.value = false;
      }
    };

    const openNew = () => {
      userDialog.user = {
        username: "",
        email: "",
        company_name: "",
        password: "",
        role: "owner",
        parent_user_id: null,
        is_active: true,
      };
      userDialog.isNew = true;
      userDialog.visible = true;
      submitted.value = false;
    };

    const editUser = (user) => {
      if (user.role === "manager" || user.role === "customer") {
        user.role = "owner";
      }

      userDialog.user = {
        ...user,
        password: "",
        company_name: user.company_name || "",
        parent_user_id: user.parent_user_id || null,
        is_active: user.is_active !== undefined ? user.is_active : true,
      };
      userDialog.isNew = false;
      userDialog.visible = true;
      submitted.value = false;
    };

    const hideDialog = () => {
      userDialog.visible = false;
      submitted.value = false;
    };

    const onRoleChange = () => {
      if (userDialog.user.role !== "staff") {
        userDialog.user.parent_user_id = null;
      }
    };

    const validateUserData = () => {
      const errors = [];

      if (!userDialog.user.username) {
        errors.push("ユーザー名は必須です");
      } else if (userDialog.user.username.length < 3) {
        errors.push("ユーザー名は3文字以上必要です");
      }

      if (!userDialog.user.email) {
        errors.push("メールアドレスは必須です");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userDialog.user.email)) {
        errors.push("有効なメールアドレスを入力してください");
      }

      if (userDialog.isNew && !userDialog.user.password) {
        errors.push("パスワードは必須です");
      } else if (
        userDialog.user.password &&
        userDialog.user.password.length < 6
      ) {
        errors.push("パスワードは6文字以上必要です");
      }

      if (!userDialog.user.role) {
        errors.push("役割は必須です");
      }

      if (userDialog.user.role === "staff" && !userDialog.user.parent_user_id) {
        errors.push("スタッフの場合、親ユーザー（オーナー）の指定は必須です");
      }

      return errors;
    };

    const saveUser = async () => {
      submitted.value = true;

      const errors = validateUserData();
      if (errors.length > 0) {
        errors.forEach((error) => {
          toast.add({
            severity: "error",
            summary: "バリデーションエラー",
            detail: error,
            life: 3000,
          });
        });
        return;
      }

      saving.value = true;

      try {
        if (userDialog.isNew) {
          await store.dispatch("auth/register", userDialog.user);

          toast.add({
            severity: "success",
            summary: "作成完了",
            detail: "ユーザーを作成しました",
            life: 3000,
          });
        } else {
          await store.dispatch("auth/updateUser", userDialog.user);

          toast.add({
            severity: "success",
            summary: "更新完了",
            detail: "ユーザー情報を更新しました",
            life: 3000,
          });
        }

        hideDialog();
        await fetchUsers();
      } catch (error) {
        let errorMessage = "ユーザーの保存に失敗しました";

        if (
          error.response &&
          error.response.data &&
          error.response.data.message
        ) {
          errorMessage = error.response.data.message;
        }

        console.error("ユーザー保存エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: errorMessage,
          life: 3000,
        });
      } finally {
        saving.value = false;
      }
    };

    const confirmActivateUser = (user) => {
      confirm.require({
        message: `${user.username} を有効化してもよろしいですか？`,
        header: "ユーザー有効化の確認",
        icon: "pi pi-question-circle",
        acceptClass: "p-button-success",
        accept: async () => {
          await activateUser(user);
        },
        reject: () => {},
      });
    };

    const activateUser = async (user) => {
      try {
        await store.dispatch("auth/updateUser", {
          ...user,
          is_active: true,
        });

        await fetchUsers();

        toast.add({
          severity: "success",
          summary: "有効化完了",
          detail: `${user.username} を有効化しました`,
          life: 3000,
        });
      } catch (error) {
        console.error("ユーザー有効化エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "ユーザーの有効化に失敗しました",
          life: 3000,
        });
      }
    };

    const confirmStopUser = (user) => {
      confirm.require({
        message: `${user.username} を停止してもよろしいですか？停止されたユーザーは即座にログアウトされ、ログインできなくなります。`,
        header: "ユーザー停止の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-warning",
        accept: async () => {
          await stopUser(user);
        },
        reject: () => {},
      });
    };

    const stopUser = async (user) => {
      try {
        await store.dispatch("auth/updateUser", {
          ...user,
          is_active: false,
        });

        await fetchUsers();

        toast.add({
          severity: "success",
          summary: "停止完了",
          detail: `${user.username} を停止しました`,
          life: 3000,
        });
      } catch (error) {
        console.error("ユーザー停止エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "ユーザーの停止に失敗しました",
          life: 3000,
        });
      }
    };

    const confirmDeleteUser = (user) => {
      confirm.require({
        message: `${user.username} を完全に削除してもよろしいですか？この操作は取り消せません。`,
        header: "ユーザー削除の確認",
        icon: "pi pi-exclamation-triangle",
        acceptClass: "p-button-danger",
        accept: async () => {
          await deleteUser(user);
        },
        reject: () => {},
      });
    };

    const deleteUser = async (user) => {
      try {
        await store.dispatch("auth/deleteUser", user.id);

        await fetchUsers();

        toast.add({
          severity: "success",
          summary: "削除完了",
          detail: `${user.username} を削除しました`,
          life: 3000,
        });
      } catch (error) {
        console.error("ユーザー削除エラー:", error);
        toast.add({
          severity: "error",
          summary: "エラー",
          detail: "ユーザーの削除に失敗しました",
          life: 3000,
        });
      }
    };

    const getRoleLabel = (role) => {
      if (role === "admin") {
        return "管理者";
      } else if (
        role === "owner" ||
        role === "customer" ||
        role === "manager"
      ) {
        return "オーナー";
      } else if (role === "staff") {
        return "スタッフ";
      } else {
        return role;
      }
    };

    const formatDate = (dateString) => {
      if (!dateString) return "";

      const date = new Date(dateString);
      return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    };

    onMounted(() => {
      fetchUsers();
    });

    return {
      loading,
      saving,
      submitted,
      users,
      ownerUsers,
      userDialog,
      roleOptions,
      openNew,
      editUser,
      hideDialog,
      onRoleChange,
      saveUser,
      confirmStopUser,
      confirmActivateUser,
      confirmDeleteUser,
      getRoleLabel,
      formatDate,
    };
  },
};
</script>
  
<style scoped>
.user-management {
  padding: 1rem;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.required-mark {
  color: var(--red-500);
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-text {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  margin-top: 0.25rem;
}
</style>