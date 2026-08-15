// stable admin 模板交付质量守卫：三端类型配置、后端安全默认值与测试退出策略。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAFFOLD = path.join(ROOT, 'templates', 'admin', 'scaffold');
const BACKEND_JAVA = path.join(SCAFFOLD, 'backend', 'src', 'main', 'java', 'com', '{{projectPkg}}');
const read = (...parts) => readFile(path.join(...parts), 'utf8');

test('h5-mobile：TypeScript 与 Vite 同时声明 @ui 别名', async () => {
  const tsconfig = JSON.parse(await read(SCAFFOLD, 'h5-mobile', 'tsconfig.json'));
  assert.deepEqual(tsconfig.compilerOptions.paths['@ui'], ['vendor/vima-ui-h5/dist/index.ts']);
  assert.deepEqual(tsconfig.compilerOptions.paths['@ui/*'], ['vendor/vima-ui-h5/dist/*']);
});

test('发布前与 CI 共用 stable 模板真实构建闸门', async () => {
  const pkg = JSON.parse(await read(ROOT, 'package.json'));
  const ci = await read(ROOT, '.github', 'workflows', 'ci.yml');
  assert.match(pkg.scripts['test:scaffold'], /check-stable-scaffold\.mjs/);
  assert.match(pkg.scripts.prepublishOnly, /test:scaffold/);
  assert.match(ci, /npm run test:scaffold/);
});

test('mp-native：默认安装可 typecheck，且不默认安装存在已知漏洞的 automator 工具链', async () => {
  const pkg = JSON.parse(await read(SCAFFOLD, 'mp-native', 'package.json'));
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit');
  assert.equal(pkg.devDependencies['miniprogram-automator'], undefined);
  assert.match(pkg.devDependencies['miniprogram-api-typings'], /^\^5\./);
  const app = await read(SCAFFOLD, 'mp-native', 'src', 'app.ts');
  const request = await read(SCAFFOLD, 'mp-native', 'src', 'utils', 'request.ts');
  assert.match(app, /OnUnhandledRejectionListenerResult/);
  assert.doesNotMatch(request, /'PATCH'|\bpatch:/);
});

test('backend：上传只能经鉴权下载，且文件名/扩展名经过校验', async () => {
  const service = await read(BACKEND_JAVA, 'service', 'FileService.java');
  const security = await read(BACKEND_JAVA, 'config', 'SecurityConfig.java');
  const web = await read(BACKEND_JAVA, 'config', 'WebConfig.java');
  assert.match(service, /ALLOWED_EXTENSIONS/);
  assert.match(service, /文件名不能为空/);
  assert.match(service, /不支持的文件类型/);
  assert.match(service, /\/api\/system\/file\/.*\/download/);
  assert.doesNotMatch(security, /requestMatchers\("\/uploads\/\*\*"\)/);
  assert.match(security, /\.cors\(Customizer\.withDefaults\(\)\)/);
  assert.doesNotMatch(web, /addResourceHandlers|\/uploads\/\*\*/);
});

test('backend：生产错误不回显异常详情，CORS 不允许任意凭据源', async () => {
  const errors = await read(BACKEND_JAVA, 'config', 'GlobalExceptionHandler.java');
  const web = await read(BACKEND_JAVA, 'config', 'WebConfig.java');
  assert.match(errors, /log\.error\(/);
  assert.match(errors, /服务器内部错误/);
  assert.doesNotMatch(web, /allowedOriginPatterns\("\*"\)/);
  await assert.rejects(access(path.join(BACKEND_JAVA, 'config', 'CorsConfig.java')));
  for (const controller of ['AuthController.java', 'ConfigController.java', 'DictController.java', 'JobController.java', 'OnlineUserController.java', 'RoleController.java', 'UserController.java']) {
    assert.doesNotMatch(await read(BACKEND_JAVA, 'controller', controller), /catch \(Exception e\)/);
  }
});

test('backend：无固定业务密码，登录限速启用，测试环境关闭调度器退出等待', async () => {
  const initializer = await read(BACKEND_JAVA, 'config', 'DataInitializer.java');
  const users = await read(BACKEND_JAVA, 'service', 'UserService.java');
  const auth = await read(BACKEND_JAVA, 'service', 'AuthService.java');
  const database = await read(SCAFFOLD, 'backend', 'src', 'main', 'resources', 'application-database.yml');
  const uiBundle = await read(SCAFFOLD, 'frontend', 'vendor', 'vima-ui-admin', 'dist', 'index.js');
  const testProps = await read(SCAFFOLD, 'backend', 'src', 'test', 'resources', 'application.properties');
  for (const source of [initializer, users, database]) {
    assert.doesNotMatch(source, /admin123|test123|encode\("123456"\)/);
  }
  assert.doesNotMatch(database, /password:\s*123456/);
  assert.doesNotMatch(uiBundle, /console\.log\('提交数据:'/);
  assert.match(auth, /LoginAttemptService/);
  assert.match(auth, /用户名或密码错误/);
  assert.match(testProps, /scheduler\.shutdown\.wait=false/);
});
