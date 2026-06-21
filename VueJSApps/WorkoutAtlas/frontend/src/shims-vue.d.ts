// shims-vue.d.ts
// Allows TypeScript to understand .vue files

declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
