<template>
  <main class="login-page">
    <section class="login-panel">
      <div>
        <p class="eyebrow">城市治理数据平台</p>
        <h1>登录数据协作平台</h1>
        <p class="muted">使用内部账号进入批次分配、样本锁定、提交确认和审计视图。</p>
      </div>

      <form class="login-form" @submit.prevent="submitLogin">
        <label>
          <span>用户名</span>
          <input v-model="username" autocomplete="username" placeholder="平台管理员 / 标注员 / 质检负责人" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="password" autocomplete="current-password" placeholder="dev 模式可留空" type="password" />
        </label>
        <p v-if="message" class="form-message">{{ message }}</p>
        <button type="submit" :disabled="pending">
          <LogIn :size="17" />
          登录
        </button>
      </form>

      <div v-if="isDevAuthSwitchEnabled" class="dev-users">
        <span>开发用户</span>
        <button v-for="user in users" :key="user.userId" type="button" @click="switchUser(user.userId)">
          {{ user.displayName }}
        </button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LogIn } from 'lucide-vue-next';
import { isDevAuthSwitchEnabled, useAuthState } from './authState';

const route = useRoute();
const router = useRouter();
const { users, loadUsers, login, switchDevUser } = useAuthState();
const username = ref('annotator_a');
const password = ref('');
const pending = ref(false);
const message = ref('');

onMounted(() => {
  if (isDevAuthSwitchEnabled) {
    void loadUsers().catch(() => {
      // A stale non-admin dev identity can make the user directory unreadable.
    });
  }
});

async function submitLogin() {
  pending.value = true;
  message.value = '';
  try {
    await login({ username: username.value, password: password.value });
    await router.push(String(route.query.redirect || '/datasets'));
  } catch (error) {
    message.value = error instanceof Error ? error.message : '登录失败';
  } finally {
    pending.value = false;
  }
}

async function switchUser(userId: string) {
  pending.value = true;
  message.value = '';
  try {
    await switchDevUser(userId);
    await router.push(String(route.query.redirect || '/datasets'));
  } finally {
    pending.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #f4f7fb;
  padding: 24px;
}

.login-panel {
  display: grid;
  gap: 22px;
  width: min(460px, 100%);
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 28px;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--blue);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--text);
  font-size: 26px;
}

.muted {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.6;
}

.login-form,
.login-form label {
  display: grid;
  gap: 10px;
}

.login-form label span,
.dev-users span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.login-form input {
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
}

.login-form button,
.dev-users button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--blue);
  color: #fff;
  font-weight: 900;
}

.form-message {
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
}

.dev-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding-top: 16px;
}

.dev-users span {
  flex-basis: 100%;
}

.dev-users button {
  min-height: 32px;
  background: #eef4ff;
  color: var(--blue);
  padding: 4px 10px;
}
</style>
