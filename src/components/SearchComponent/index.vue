<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps({
  // 表单配置项数组 - 兼容 items 和 fields 两种命名
  items: { type: Array, default: () => [] },
  // 为了兼容性，也支持 fields 属性名
  fields: { type: Array, default: () => [] },
  // 栅格间隔
  gutter: { type: Number, default: 20 },
  // 标签宽度
  labelWidth: { type: String, default: '82px' },
  // 是否显示重置按钮
  showReset: { type: Boolean, default: true },
  // 是否在重置前二次确认
  confirmReset: { type: Boolean, default: true },
  // 重置确认文案
  confirmResetMessage: { type: String, default: '确定要重置所有筛选条件吗？' },
  // 重置确认标题
  confirmResetTitle: { type: String, default: '提示' },
  // 初始值
  initialValues: { type: Object, default: () => ({}) },
  // 是否需要即时搜索（输入变化时触发）
  immediateSearch: { type: Boolean, default: false },
  // 每行字段数（默认4，等宽填充整行并自动换行）
  rowColumns: { type: Number, default: 4 },
});

const emit = defineEmits(['search', 'reset']);

// default-time 在 element-plus 2.14+ 要求 Date 对象数组，传字符串数组会导致 dayjs 解析失败、面板显示 NaN
const DEFAULT_TIME = [new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)];

const searchForm = ref();
const formData = ref({});
// 存储默认值用于重置
const defaultFormData = ref({});

// 合并 items 和 fields，优先使用 items
const formItems = computed(() => (props.items.length > 0 ? props.items : props.fields));

// 网格布局：按每行字段数固定列数，列与列严格上下对齐，行铺满整宽
const gridStyle = computed(() => {
  const n = Math.max(1, props.rowColumns || 1);
  return {
    'grid-template-columns': `repeat(${n}, minmax(0, 1fr))`,
  };
});

const cloneFieldValue = (value) => {
  if (Array.isArray(value)) return [...value];
  if (value !== null && typeof value === 'object') return JSON.parse(JSON.stringify(value));
  return value;
};

// 默认值逻辑：daterange 默认空（父组件传最近30天）
const getDefaultValue = (item) => {
  switch (item.type) {
    case 'input':
      return item.defaultValue || '';
    case 'select':
      return item.multiple ? item.defaultValue || [] : item.defaultValue || '';
    case 'radio':
      return item.defaultValue || '';
    case 'date':
      return item.defaultValue || '';
    case 'daterange':
    case 'daterange-no-time':
      return item.defaultValue || [];
    case 'tree-select':
      return item.defaultValue || [];
    default:
      return '';
  }
};

// 初始化表单数据
const initFormData = () => {
  const data = {};
  const defaults = {};

  formItems.value.forEach((item) => {
    const fieldDefault = cloneFieldValue(getDefaultValue(item));
    defaults[item.prop] = fieldDefault;

    if (Object.prototype.hasOwnProperty.call(props.initialValues, item.prop)) {
      data[item.prop] = cloneFieldValue(props.initialValues[item.prop]);
    } else {
      data[item.prop] = cloneFieldValue(fieldDefault);
    }
  });

  formData.value = data;
  defaultFormData.value = defaults;
};

watch(
  () => props.initialValues,
  () => initFormData(),
  { deep: true, immediate: true },
);

// 监听表单变化，如果开启即时搜索则自动触发
watch(
  () => formData.value,
  (newVal) => {
    if (props.immediateSearch) {
      emit('search', cloneFieldValue(newVal));
    }
  },
  { deep: true },
);

// 对输入框进行处理
const handleNumberInput = (value, item) => {
  // 如果 inputType 配置了 number 属性，才进行数字限制
  if (item.inputType === 'number') {
    // 只允许输入数字和小数点
    let newValue = String(value ?? '').replace(/[^\d.]/g, '');
    // 限制只能有一个小数点
    const parts = newValue.split('.');
    if (parts.length > 2) {
      newValue = `${parts[0]}.${parts.slice(1).join('')}`;
    }
    formData.value[item.prop] = newValue;
    return;
  }
  if (item.inputType === 'integer') {
    formData.value[item.prop] = String(value ?? '').replace(/\D/g, '');
  }
};

// 搜索事件
const handleSearch = () => {
  // 触发验证
  searchForm.value?.validate((valid) => {
    if (!valid) {
      return;
    }
    // 深拷贝表单数据，避免引用问题
    emit('search', cloneFieldValue(formData.value));
  });
};

const isRangeType = (item) => item && ['daterange', 'daterange-no-time'].includes(item.type);

// 日期类组件默认禁止选择今天之后的日期，同时保留页面自定义 disabledDate
const getDisabledDate = (item) => {
  const base = item.disabledDate || item.pickerOptions?.disabledDate;
  if (item.allowFutureDate && !base) return undefined;

  return (time) => {
    const now = new Date();
    let isFuture;
    if (isRangeType(item)) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const day = new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
      isFuture = day > today;
    } else {
      isFuture = time.getTime() > now.getTime();
    }
    if (item.allowFutureDate) isFuture = false;

    if (typeof base === 'function') {
      return isFuture || base(time);
    }
    return isFuture;
  };
};

const getInclusiveDayCount = (startValue, endValue) => {
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.floor((endDay.getTime() - startDay.getTime()) / (24 * 3600 * 1000)) + 1;
};

const handleDateChange = (item) => {
  if (!isRangeType(item)) return;

  const value = formData.value[item.prop];
  if (!Array.isArray(value) || value.length !== 2 || !value[0] || !value[1]) {
    return;
  }

  const maxRangeDays = item.maxRangeDays || 31;
  const dayCount = getInclusiveDayCount(value[0], value[1]);
  if (dayCount > maxRangeDays) {
    ElMessage.warning(`日期范围最多支持选择${maxRangeDays}天`);
    formData.value[item.prop] = [];
  }
};

// 执行重置表单
const doReset = () => {
  const resetData = cloneFieldValue(defaultFormData.value);
  Object.keys(resetData).forEach((key) => {
    formData.value[key] = cloneFieldValue(resetData[key]);
  });

  searchForm.value?.clearValidate();
  emit('reset', cloneFieldValue(formData.value));
};

// 重置表单
const handleReset = () => {
  if (!props.confirmReset) {
    doReset();
    return;
  }

  ElMessageBox.confirm(props.confirmResetMessage, props.confirmResetTitle, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      doReset();
    })
    .catch(() => {});
};

// 获取表单数据
const getFormData = () => cloneFieldValue(formData.value);

// 设置表单数据
const setFormData = (data) => {
  Object.keys(data || {}).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(formData.value, key)) {
      formData.value[key] = cloneFieldValue(data[key]);
    }
  });
};

// 清空表单验证
const clearValidate = (fields) => searchForm.value?.clearValidate(fields);

defineExpose({
  getFormData,
  setFormData,
  clearValidate,
});
</script>

<template>
  <div class="search-form-container">
    <el-form
      ref="searchForm"
      class="search-form"
      :model="formData"
      :inline="true"
      :label-width="labelWidth"
      label-position="left"
      @submit.prevent
    >
      <!-- 网格布局：每行字段数由 rowColumns 配置（默认4），列上下对齐、行铺满整宽 -->
      <div class="search-fields" :style="gridStyle">
        <div
          v-for="item in formItems"
          :key="item.prop"
          class="search-field"
        >
          <!-- 文本输入框 -->
          <el-form-item v-if="item.type === 'input'" :label="item.label" :prop="item.prop">
            <el-input
              v-model="formData[item.prop]"
              :placeholder="item.placeholder || `请输入${item.label}`"
              :clearable="item.clearable !== false"
              @input="(val) => handleNumberInput(val, item)"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <!-- 下拉选择器 -->
          <el-form-item v-else-if="item.type === 'select'" :label="item.label" :prop="item.prop">
            <el-select
              v-model="formData[item.prop]"
              :placeholder="item.placeholder || `请选择${item.label}`"
              :clearable="item.clearable !== false"
              style="width: 100%"
              :filterable="item.filterable"
              :multiple="item.multiple"
            >
              <el-option
                v-for="option in item.options"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>

          <!-- 级联选择器（用于树形选择） -->
          <el-form-item v-else-if="item.type === 'tree-select'" :label="item.label" :prop="item.prop">
            <el-cascader
              v-model="formData[item.prop]"
              :options="item.options"
              :placeholder="item.placeholder || `请选择${item.label}`"
              :clearable="item.clearable !== false"
              style="width: 100%"
              :filterable="item.filterable !== false"
              :props="
                item.props || {
                  label: 'label',
                  value: 'id',
                  children: 'children',
                  checkStrictly: true,
                  emitPath: false,
                }
              "
              :show-all-levels="false"
            />
          </el-form-item>

          <!-- 单选框 -->
          <el-form-item v-else-if="item.type === 'radio'" :label="item.label" :prop="item.prop">
            <el-radio-group v-model="formData[item.prop]">
              <el-radio v-for="option in item.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 日期选择器 -->
          <el-form-item v-else-if="item.type === 'date'" :label="item.label" :prop="item.prop">
            <el-date-picker
              v-model="formData[item.prop]"
              :type="item.dateType || 'date'"
              :placeholder="item.placeholder || `请选择${item.label}`"
              :value-format="item.valueFormat || 'YYYY-MM-DD'"
              :format="item.format || item.valueFormat || 'YYYY-MM-DD'"
              :shortcuts="item.shortcuts"
              style="width: 100%"
              :clearable="item.clearable !== false"
              :disabled-date="getDisabledDate(item)"
              @change="handleDateChange(item)"
            />
          </el-form-item>

          <!-- 日期范围选择器（包含时分秒） -->
          <el-form-item v-else-if="item.type === 'daterange'" :label="item.label" :prop="item.prop">
            <el-date-picker
              v-model="formData[item.prop]"
              type="datetimerange"
              :start-placeholder="item.startPlaceholder || '开始日期'"
              :end-placeholder="item.endPlaceholder || '结束日期'"
              :value-format="item.valueFormat || 'YYYY-MM-DD HH:mm:ss'"
              :format="item.format || item.valueFormat || 'YYYY-MM-DD HH:mm:ss'"
              :shortcuts="item.shortcuts"
              style="width: 100%"
              :clearable="item.clearable !== false"
              :disabled-date="getDisabledDate(item)"
              :range-separator="item.rangeSeparator || '—'"
              :default-time="item.defaultTime || DEFAULT_TIME"
              class="hide-time-in-input"
              @change="handleDateChange(item)"
            />
          </el-form-item>

          <!-- 日期范围选择器（不包含时分秒） -->
          <el-form-item v-else-if="item.type === 'daterange-no-time'" :label="item.label" :prop="item.prop">
            <el-date-picker
              v-model="formData[item.prop]"
              type="daterange"
              :start-placeholder="item.startPlaceholder || '开始日期'"
              :end-placeholder="item.endPlaceholder || '结束日期'"
              :value-format="item.valueFormat || 'YYYY-MM-DD'"
              :format="item.format || item.valueFormat || 'YYYY-MM-DD'"
              :shortcuts="item.shortcuts"
              style="width: 100%"
              :clearable="item.clearable !== false"
              :disabled-date="getDisabledDate(item)"
              :range-separator="item.rangeSeparator || '—'"
              @change="handleDateChange(item)"
            />
          </el-form-item>

          <!-- 自定义插槽 -->
          <el-form-item v-else-if="item.type === 'slot'" :label="item.label || ''" :prop="item.prop">
            <slot :name="item.slotName" :form="formData" :item="item" />
          </el-form-item>
        </div>
      </div>

      <!-- 按钮区域 - 单独一行 -->
      <div class="form-actions">
        <el-button
          type="primary"
          class="Search-Button"
          :style="{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }"
          @click="handleSearch"
        >
          搜索
        </el-button>
        <el-button v-if="showReset" class="Reset-Button" @click="handleReset"> 重置 </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
/* 隐藏输入框中的时分秒部分 */
.hide-time-in-input :deep(.el-range-input) {
  width: 74px !important; /* 只显示年月日的宽度 */
  overflow: hidden;
}

.hide-time-in-input :deep(.el-range-separator) {
  color: var(--text-sub);
}

:deep(.el-input__inner) {
  border-radius: 8px !important;
}

.Search-Button {
  width: 93px;
  height: 40px;
  font-size: 14px;
  color: var(--text-invert);
  border-radius: 8px;
  text-align: center;
  line-height: 40px;
  padding: 0;
}

.Reset-Button {
  width: 85px;
  height: 40px;
  font-size: 14px;
  color: var(--text-main);
  border-radius: 8px;
  text-align: center;
  line-height: 40px;
  padding: 0;
}

.search-form-container {
  padding: 24px 24px 8px;
  background: var(--bg-card);
  border-radius: 24px;
  margin-bottom: 20px;
}

.search-form {
  width: 100%;
}

.search-form :deep(.el-form-item) {
  margin-bottom: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.search-form :deep(.el-form-item__label) {
  color: var(--text-main);
  font-weight: normal;
  flex-shrink: 0;
}

.search-form :deep(.el-form-item__content) {
  flex: 1;
  min-width: 0;
}

/* 网格布局：每行字段数由 rowColumns 决定，列与列严格上下对齐 */
.search-fields {
  display: grid;
  gap: 16px 20px;
}

.search-field {
  min-width: 0;
  display: flex;
  align-items: center;
}

.search-field :deep(.el-input),
.search-field :deep(.el-select),
.search-field :deep(.el-date-editor) {
  width: 100%;
}

/* 单选框组样式 */
.search-form :deep(.el-radio-group .el-radio) {
  margin-right: 20px;
  margin-bottom: 5px;
}

.form-actions {
  text-align: right;
	margin-top: 12px;
}

.form-actions :deep(.el-form-item) {
  margin-bottom: 0;
}

/* 自定义搜索按钮样式 */
:deep(.el-button--primary.custom-search-btn) {
  background-color: var(--primary) !important;
  border-color: var(--primary) !important;
}

:deep(.el-button--primary.custom-search-btn:hover),
:deep(.el-button--primary.custom-search-btn:focus) {
  background-color: var(--primary-active) !important;
  border-color: var(--primary-active) !important;
}

:deep(.el-button--primary.custom-search-btn:active) {
  background-color: var(--primary-active) !important;
  border-color: var(--primary-active) !important;
}

/* 隐藏 number 输入框的上下箭头 */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

:deep(input[type='number']) {
  -moz-appearance: textfield;
}

/* 小屏幕适配 */
@media screen and (max-width: 768px) {
  .search-form-container {
    padding: 15px;
  }
}
</style>
