export const Diagnostics: any = new Proxy(
  {},
  {
    get() {
      return "";
    }
  }
);
