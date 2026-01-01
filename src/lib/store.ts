// 简单的本地存储封装
export const store = {
  get: (key: string, def: any = null) => {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : def;
  },
  set: (key: string, val: any) => {
    localStorage.setItem(key, JSON.stringify(val));
  }
};
