import { reactive } from 'vue';

export const confirmState = reactive({
  visible: false,
  title: '提示',
  message: '',
  okText: '确定',
  _resolve: null,
});

export function useConfirm() {
  function confirm({ title = '提示', message = '', okText = '确定' } = {}) {
    return new Promise((resolve) => {
      confirmState.title = title;
      confirmState.message = message;
      confirmState.okText = okText;
      confirmState.visible = true;
      confirmState._resolve = resolve;
    });
  }
  return { confirm };
}
