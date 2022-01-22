import Log from "./log";

type toType<T> = [null, T] | [Error, null];
export default async function to<R>(promise: Promise<R>): Promise<toType<R>> {
  if (!promise || !Promise.prototype.isPrototypeOf(promise)) {
    try {
      return new Promise<toType<R>>((resolve, reject) => {
        reject(new Error("requires promises as the param"));
      });
    } catch (err) {
      return [err, null];
    }
  }
  try {
    const ret = await promise;   
    return [null, ret];
  } catch (err_1) {
    return [err_1, null];
  }
};

/**
 * 快速检查、记录报错
 * @param promise 
 * @param e 错误提示
 * @param eFn 错误回调
 * @returns 
 */
export const toRet = async <R>(promise: Promise<R>, e?: Error | string, eFn?: () => {}): Promise<R> => {
  const [err, ret]: toType<R> = await to(promise);
  if (err) {
    Log.error(e, err)
    eFn && eFn();
  }
  return ret;
}