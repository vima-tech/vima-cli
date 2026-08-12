/** 不会进入 JavaScript 原型链的点分隔数据路径。 */
export declare function isSafeDataPath(path: string): boolean;
/** 只沿对象自身属性读取，不继承访问器或原型成员。 */
export declare function readSafeDataPath(context: unknown, path: string): unknown;
export declare function isSafeDataKey(key: string): boolean;
export declare function isSafeDataIdentifier(key: string): boolean;
export declare function assignSafeRecord(target: Record<string, unknown>, source: Record<string, unknown>): void;
//# sourceMappingURL=safe-path.d.ts.map