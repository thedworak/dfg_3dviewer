#!/usr/bin/env node
import { execSync } from 'child_process';

const rawCustom = process.argv[2] || process.env.MODULE_CUSTOM || '';
const customModule = rawCustom ? `/${String(rawCustom).replace(/^\/+|\/+$/g, '')}` : '';

const command = `cross-env BUILD_SOURCE='' IS_PROD=true BUILD=drupal MODULE_CUSTOM='${customModule}' rollup -c`;
console.log(`build-drupal: using MODULE_CUSTOM='${customModule}'`);
console.log(command);

try {
  execSync(command, {stdio: 'inherit'});
} catch (error) {
  process.exit(error.status || 1);
}
