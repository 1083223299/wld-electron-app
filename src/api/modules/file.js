import { request } from '../request';

export const fileApi = {
  /**
   * 上传文件 POST /api/admin/files/upload
   * multipart 字段名 file。返回 { url, fileName, ossId }
   * 兼容别名 POST /api/admin/common/file/upload
   * @param {File} file
   * @returns {Promise<{ url: string, fileName: string, ossId: string }>}
   */
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.upload('/api/admin/files/upload', formData);
  },
};
