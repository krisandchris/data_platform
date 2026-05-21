<template>
  <main class="login-page">
    <section class="login-visual" aria-label="平台运行状态">
      <div class="visual-brand">
        <Database :size="30" />
        <span>城市治理数据平台</span>
      </div>

      <div class="signal-board" aria-hidden="true">
        <div class="signal-board__header">
          <span>访问网关</span>
          <i></i>
        </div>
        <div class="signal-grid">
          <span v-for="item in signalCells" :key="item" :class="`cell cell--${item}`"></span>
        </div>
        <div class="status-stack">
          <div>
            <Activity :size="15" />
            <span>批次任务通道</span>
            <strong>在线</strong>
          </div>
          <div>
            <ShieldCheck :size="15" />
            <span>审阅权限校验</span>
            <strong>已锁定</strong>
          </div>
          <div>
            <LockKeyhole :size="15" />
            <span>内部账号访问</span>
            <strong>需认证</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="login-card" aria-labelledby="login-title">
      <header class="login-heading">
        <span class="login-kicker">内部访问</span>
        <h1 id="login-title">登录平台</h1>
        <p>请输入账号密码进入数据集、质检队列和审计工作台。</p>
      </header>

      <form class="login-form" @submit.prevent="submitLogin">
        <label>
          <span>账号</span>
          <div class="input-shell">
            <UserRound :size="17" />
            <input
              v-model.trim="username"
              autocomplete="username"
              inputmode="text"
              placeholder="请输入账号"
              :disabled="pending"
            />
          </div>
        </label>

        <label>
          <span>密码</span>
          <div class="input-shell">
            <LockKeyhole :size="17" />
            <input
              v-model="password"
              autocomplete="current-password"
              placeholder="请输入密码"
              type="password"
              :disabled="pending"
            />
          </div>
        </label>

        <p v-if="message" class="form-message" role="alert">{{ message }}</p>

        <button class="login-submit" type="submit" :disabled="pending">
          <LoaderCircle v-if="pending" class="spin" :size="17" />
          <LogIn v-else :size="17" />
          {{ pending ? '登录中' : '登录' }}
        </button>
      </form>

      <section v-if="isDevAuthSwitchEnabled" class="dev-users" aria-label="开发用户切换">
        <div>
          <span>开发模式</span>
          <strong>快速切换用户</strong>
        </div>
        <button
          v-for="user in users"
          :key="user.userId"
          type="button"
          :disabled="pending"
          @click="switchUser(user.userId)"
        >
          {{ user.displayName || user.username || user.userId }}
        </button>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Activity,
  Database,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRound,
} from 'lucide-vue-next';
import { isDevAuthSwitchEnabled, useAuthState } from './authState';

const route = useRoute();
const router = useRouter();
const { users, loadCurrentUser, loadUsers, login, switchDevUser } = useAuthState();
const username = ref('');
const password = ref('');
const pending = ref(false);
const message = ref('');
const signalCells = ['hot', 'idle', 'ok', 'ok', 'idle', 'hot', 'ok', 'idle', 'ok', 'hot', 'idle', 'ok'];

onMounted(async () => {
  const existingUser = await loadCurrentUser();
  if (existingUser) {
    await router.replace(loginTarget());
    return;
  }
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
    await router.push(loginTarget());
  } catch (error) {
    message.value = error instanceof Error ? error.message : '登录失败，请检查账号或服务连接';
  } finally {
    pending.value = false;
  }
}

async function switchUser(userId: string) {
  pending.value = true;
  message.value = '';
  try {
    await switchDevUser(userId);
    await router.push(loginTarget());
  } catch (error) {
    message.value = error instanceof Error ? error.message : '开发用户切换失败';
  } finally {
    pending.value = false;
  }
}

function loginTarget() {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect ? redirect : '/datasets';
}
</script>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(320px, 1.1fr) minmax(360px, 0.9fr);
  background:
    linear-gradient(rgba(24, 34, 48, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(24, 34, 48, 0.06) 1px, transparent 1px),
    #0e151d;
  background-size: 28px 28px;
  color: #e8eef5;
}

.login-visual {
  display: grid;
  min-height: 100vh;
  align-content: space-between;
  padding: 46px;
  border-right: 1px solid rgba(148, 163, 184, 0.16);
}

.visual-brand {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 12px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 850;
}

.visual-brand svg {
  color: #38d4c7;
}

.signal-board {
  display: grid;
  gap: 18px;
  width: min(620px, 100%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(10, 18, 28, 0.72);
  padding: 20px;
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.28);
}

.signal-board__header,
.status-stack div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.signal-board__header {
  color: #9eb2c7;
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.08em;
}

.signal-board__header i {
  width: 54px;
  height: 2px;
  background: #38d4c7;
}

.signal-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(30px, 1fr));
  gap: 8px;
}

.cell {
  min-height: 58px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 6px;
  background: rgba(30, 41, 59, 0.62);
}

.cell--hot {
  background: rgba(56, 212, 199, 0.2);
}

.cell--ok {
  background: rgba(52, 211, 153, 0.16);
}

.status-stack {
  display: grid;
  gap: 9px;
}

.status-stack div {
  min-height: 36px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.58);
  padding: 0 11px;
  color: #b9c6d4;
  font-size: 12px;
}

.status-stack div span {
  margin-right: auto;
}

.status-stack svg {
  color: #38d4c7;
}

.status-stack strong {
  color: #8ee8b6;
  font-size: 11px;
  text-transform: uppercase;
}

.login-card {
  display: grid;
  align-self: center;
  justify-self: center;
  gap: 24px;
  width: min(430px, calc(100% - 48px));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: #f8fafc;
  color: #101828;
  padding: 30px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.24);
}

.login-heading {
  display: grid;
  gap: 6px;
}

.login-kicker,
.login-form label span,
.dev-users span {
  color: #526274;
  font-size: 12px;
  font-weight: 850;
}

.login-kicker {
  color: #0f766e;
}

.login-heading h1 {
  margin: 0;
  color: #111827;
  font-size: 28px;
  line-height: 1.16;
}

.login-heading p {
  margin: 0;
  color: #617085;
  font-size: 14px;
  line-height: 1.65;
}

.login-form,
.login-form label {
  display: grid;
  gap: 10px;
}

.login-form {
  gap: 16px;
}

.input-shell {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 10px;
  border: 1px solid #cdd8e5;
  border-radius: 7px;
  background: #fff;
  padding: 0 12px;
}

.input-shell:focus-within {
  border-color: #0f766e;
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.input-shell svg {
  flex: 0 0 auto;
  color: #607083;
}

.input-shell input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #101828;
}

.input-shell input::placeholder {
  color: #8c98a7;
}

.form-message {
  margin: 0;
  border: 1px solid rgba(229, 72, 77, 0.28);
  border-radius: 7px;
  background: #fff0f0;
  color: #b42318;
  padding: 9px 11px;
  font-size: 13px;
}

.login-submit {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #0f766e;
  border-radius: 7px;
  background: #0f766e;
  color: #ffffff;
  font-weight: 850;
}

.login-submit:hover:not(:disabled) {
  background: #115e59;
}

.spin {
  animation: login-spin 0.8s linear infinite;
}

.dev-users {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid #d9e2ec;
  padding-top: 18px;
}

.dev-users div {
  display: grid;
  flex-basis: 100%;
  gap: 3px;
}

.dev-users strong {
  color: #223044;
  font-size: 13px;
}

.dev-users button {
  min-height: 32px;
  border: 1px solid #cdd8e5;
  border-radius: 7px;
  background: #ffffff;
  color: #1f2a3a;
  padding: 4px 10px;
  font-weight: 780;
}

.dev-users button:hover:not(:disabled) {
  border-color: #0f766e;
  color: #0f766e;
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 780px) {
  .login-page {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .login-visual {
    min-height: auto;
    padding: 0;
    border-right: 0;
  }

  .signal-board {
    display: none;
  }

  .login-card {
    width: 100%;
    margin-top: 22px;
    padding: 22px;
  }
}
</style>
