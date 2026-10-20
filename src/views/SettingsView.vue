<script setup>
import { reactive, onMounted } from 'vue';
import { settingsApi } from '../api/modules/settings';
import { useToast } from '../composables/useToast';
import '../assets/styles/pages/settings.css';

const { show } = useToast();

const form = reactive({
  siteName: '',
  siteUrl: '',
  adminEmail: '',
  pageSize: 10,
  enableRegister: false,
  enableNotice: false,
  remark: '',
});

async function load() {
  Object.assign(form, await settingsApi.get());
}

async function save() {
  await settingsApi.save({ ...form, pageSize: Number(form.pageSize) });
  show('设置已保存');
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-header">
      <h2>系统设置</h2>
      <p>站点基础配置</p>
    </div>

    <div class="card settings-form">
      <div class="card-title">基础信息</div>
      <div class="form-item">
        <label>站点名称</label>
        <input v-model="form.siteName" />
      </div>
      <div class="form-item">
        <label>站点地址</label>
        <input v-model="form.siteUrl" />
      </div>
      <div class="form-item">
        <label>管理员邮箱</label>
        <input v-model="form.adminEmail" />
      </div>
      <div class="form-item">
        <label>每页条数</label>
        <select v-model.number="form.pageSize">
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
        </select>
      </div>

      <div class="card-title" style="margin-top: 20px">功能开关</div>
      <label class="switch-row">
        <input v-model="form.enableRegister" type="checkbox" /> 允许用户自助注册
      </label>
      <label class="switch-row">
        <input v-model="form.enableNotice" type="checkbox" /> 开启站内通知
      </label>

      <div class="form-item">
        <label>备注</label>
        <textarea v-model="form.remark" rows="3"></textarea>
      </div>

      <div class="settings-actions">
        <button class="btn btn-primary" @click="save">保存设置</button>
        <button class="btn btn-plain" @click="load">重新加载</button>
      </div>
    </div>
  </div>
</template>
