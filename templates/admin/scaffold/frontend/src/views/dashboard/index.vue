<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

const stats = ref([
  { title: '用户总数', value: 128, unit: '人', icon: 'users', accent: 'var(--v-accent-blue)' },
  { title: '角色总数', value: 5, unit: '个', icon: 'shield-check', accent: 'var(--v-accent-cyan)' },
  { title: '菜单总数', value: 32, unit: '项', icon: 'menu', accent: 'var(--v-accent-green)' },
  { title: '部门总数', value: 8, unit: '个', icon: 'building', accent: 'var(--v-accent-amber)' },
])

const shortcuts = [
  { title: '用户管理', desc: '账号与授权', icon: 'users', path: '/system/user' },
  { title: '角色管理', desc: '权限集合', icon: 'shield-check', path: '/system/role' },
  { title: '菜单管理', desc: '导航与按钮权限', icon: 'menu', path: '/system/menu' },
  { title: '部门管理', desc: '组织架构', icon: 'building', path: '/system/dept' },
  { title: '消息中心', desc: '站内通知', icon: 'bell', path: '/message' },
  { title: '个人中心', desc: '资料与密码', icon: 'user', path: '/profile' },
]

const recentActivities = [
  { time: '10:30', user: 'admin', action: '登录系统' },
  { time: '10:25', user: '张三', action: '修改了用户信息' },
  { time: '10:20', user: '李四', action: '新增了角色' },
  { time: '10:15', user: '王五', action: '删除了菜单' },
]

const displayName = computed(() => userStore.realName || userStore.username)
const today = computed(() =>
  new Date().toLocaleDateString('zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
)
</script>

<template>
  <!-- 页面根必须是 .vui-page：内边距、高度链、滚动都由它给（框架契约，见 components.css） -->
  <div class="vui-page">
    <!-- 一行式欢迎条：浏览器 chrome 已占去一截屏高，首屏高度优先留给统计与快捷入口 -->
    <section class="dash-welcome">
      <span class="dash-welcome-badge" aria-hidden="true"><VIcon name="app" size="20" /></span>
      <div class="dash-welcome-copy">
        <h1>欢迎回来，{{ displayName }}</h1>
        <p>{{ today }} · 左侧导航按权限下发，仅显示你能访问的功能页</p>
      </div>
      <span class="dash-kicker" aria-hidden="true">WORKSPACE</span>
    </section>

    <div class="dash-stats">
      <article v-for="item in stats" :key="item.title" class="dash-stat" :style="{ '--accent': item.accent }">
        <span class="dash-stat-icon" aria-hidden="true"><VIcon :name="item.icon" size="20" /></span>
        <span class="dash-stat-copy">
          <small>{{ item.title }}</small>
          <strong>{{ item.value }}<em>{{ item.unit }}</em></strong>
        </span>
      </article>
    </div>

    <div class="dash-grid">
      <VCard title="快捷操作">
        <template #extra>共 {{ shortcuts.length }} 项</template>
        <div class="dash-quick-grid">
          <button
            v-for="item in shortcuts"
            :key="item.path"
            type="button"
            class="dash-quick"
            @click="router.push(item.path)"
          >
            <span class="dash-quick-icon" aria-hidden="true"><VIcon :name="item.icon" size="19" /></span>
            <span class="dash-quick-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
            <span class="dash-quick-arrow" aria-hidden="true"><VIcon name="chevron-right" size="12" /></span>
          </button>
        </div>
      </VCard>

      <VCard title="最近活动">
        <ul class="dash-activities">
          <li v-for="(item, index) in recentActivities" :key="index" class="dash-activity">
            <span class="dash-activity-time">{{ item.time }}</span>
            <span class="dash-activity-dot" aria-hidden="true"></span>
            <span class="dash-activity-text"><strong>{{ item.user }}</strong>{{ item.action }}</span>
          </li>
        </ul>
      </VCard>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 欢迎条（一行式）---------- */
.dash-welcome {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 22px 13px 21px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--v-primary) 13%, var(--v-border));
  border-radius: 16px;
  background:
    linear-gradient(105deg, color-mix(in srgb, var(--v-surface) 98%, transparent) 0 58%, transparent 82%),
    radial-gradient(circle at 88% 42%, color-mix(in srgb, var(--v-cyan) 16%, var(--v-surface)), var(--v-surface) 38%);
  box-shadow:
    0 22px 48px -38px color-mix(in srgb, var(--v-primary-strong) 58%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--v-surface) 82%, transparent);
}

/* 左侧品牌色竖条 */
.dash-welcome::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, var(--v-cyan), var(--v-primary));
}

.dash-welcome-badge {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1px solid color-mix(in srgb, var(--v-primary) 16%, var(--v-border));
  border-radius: 13px;
  color: var(--v-primary);
  background: color-mix(in srgb, var(--v-primary) 7%, var(--v-surface));
}

.dash-welcome-copy {
  display: flex;
  align-items: baseline;
  flex: 1;
  gap: 14px;
  min-width: 0;
}

.dash-welcome h1 {
  color: var(--v-text-title);
  font-size: 18px;
  font-weight: var(--v-weight-title);
  letter-spacing: -0.02em;
  line-height: 1.3;
  white-space: nowrap;
}

.dash-welcome-copy p {
  overflow: hidden;
  color: var(--v-text-sub);
  font-size: 13px;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
  color: var(--v-primary);
  font-size: 11px;
  font-weight: var(--v-weight-semibold);
  letter-spacing: 0.08em;
}

.dash-kicker::before {
  content: '';
  width: 18px;
  height: 2px;
  border-radius: var(--v-radius-pill);
  background: var(--v-primary);
}

/* ---------- 指标卡 ---------- */
.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--v-gap-md);
}

.dash-stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius-card);
  background: linear-gradient(
    135deg,
    var(--v-surface),
    color-mix(in srgb, var(--accent) 4%, var(--v-surface))
  );
  box-shadow: var(--v-shadow-card);
}

.dash-stat-icon {
  width: 44px;
  height: 44px;
  display: inline-grid;
  flex: none;
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--v-border));
  border-radius: 13px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--v-surface));
  place-items: center;
}

.dash-stat-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dash-stat-copy small {
  color: var(--v-text-weak);
  font-size: var(--v-font-xs);
  letter-spacing: 0.04em;
}

.dash-stat-copy strong {
  margin-top: 4px;
  color: var(--v-text-title);
  font-size: 24px;
  font-weight: var(--v-weight-title);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.dash-stat-copy em {
  margin-left: 4px;
  color: var(--v-text-weak);
  font-size: var(--v-font-xs);
  font-style: normal;
  font-weight: var(--v-weight-medium);
}

/* ---------- 下半区 ---------- */
/*
 * 框架的 .vui-page > :last-child 会把最后一块拉长去吃掉剩余高度。仪表盘的最后一块是这两张卡，
 * 被拉长后内容仍贴在顶部，等于卡片里多出一片空白。这里显式收回 flex-grow，
 * 空白留在页面底部（那是背景，不显眼），两张卡则用 stretch 对齐到同一底边。
 * 权重：scoped 会带 [data-v-x]，能压过框架那条 .vui-page > :last-child。
 */
.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--v-gap-md);
  flex: 0 0 auto;
  align-items: stretch;
}

.dash-quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--v-gap-md);
}

.dash-quick {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  padding: 14px 15px;
  border: 1px solid var(--v-border);
  border-radius: var(--v-radius-card);
  color: var(--v-text-body);
  background: linear-gradient(
    135deg,
    var(--v-surface),
    color-mix(in srgb, var(--v-primary) 2%, var(--v-surface))
  );
  box-shadow: 0 14px 30px -28px color-mix(in srgb, var(--v-primary-strong) 68%, transparent);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 180ms var(--v-ease),
    background 180ms var(--v-ease),
    box-shadow 180ms var(--v-ease),
    transform 180ms var(--v-ease);
}

.dash-quick:hover {
  border-color: color-mix(in srgb, var(--v-primary) 32%, var(--v-border));
  box-shadow: 0 20px 38px -27px color-mix(in srgb, var(--v-primary-strong) 62%, transparent);
  transform: translateY(-2px);
}

.dash-quick:active {
  transform: translateY(0);
}

.dash-quick-icon {
  width: 40px;
  height: 40px;
  display: inline-grid;
  border: 1px solid color-mix(in srgb, var(--v-primary) 12%, var(--v-border));
  border-radius: 13px;
  color: var(--v-primary-strong);
  background: color-mix(in srgb, var(--v-primary) 8%, var(--v-surface));
  place-items: center;
  transition: color 180ms var(--v-ease), background 180ms var(--v-ease), transform 180ms var(--v-ease);
}

.dash-quick:hover .dash-quick-icon {
  color: var(--v-surface);
  background: var(--v-primary);
  transform: scale(1.04);
}

.dash-quick-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dash-quick-copy strong {
  overflow: hidden;
  color: var(--v-text-title);
  font-size: 14px;
  font-weight: var(--v-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-quick-copy small {
  margin-top: 3px;
  overflow: hidden;
  color: var(--v-text-weak);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-quick-arrow {
  display: inline-flex;
  color: var(--v-text-faint);
  transition: color 180ms var(--v-ease), transform 180ms var(--v-ease);
}

.dash-quick:hover .dash-quick-arrow {
  color: var(--v-primary);
  transform: translateX(2px);
}

/* ---------- 最近活动 ---------- */
.dash-activities {
  display: flex;
  flex-direction: column;
  list-style: none;
}

.dash-activity {
  position: relative;
  display: grid;
  grid-template-columns: 44px 12px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 11px 0;
}

.dash-activity + .dash-activity {
  border-top: 1px solid color-mix(in srgb, var(--v-border) 70%, transparent);
}

.dash-activity-time {
  color: var(--v-text-faint);
  font-size: var(--v-font-xs);
  font-variant-numeric: tabular-nums;
}

.dash-activity-dot {
  width: 7px;
  height: 7px;
  justify-self: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--v-primary) 45%, var(--v-surface));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--v-primary) 10%, transparent);
}

.dash-activity-text {
  overflow: hidden;
  color: var(--v-text-sub);
  font-size: var(--v-font-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-activity-text strong {
  margin-right: 6px;
  color: var(--v-text-title);
  font-weight: var(--v-weight-semibold);
}

/* ---------- 窄屏 ---------- */
@media (max-width: 1320px) {
  .dash-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .dash-welcome-mark {
    display: none;
  }

  .dash-stats,
  .dash-quick-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
