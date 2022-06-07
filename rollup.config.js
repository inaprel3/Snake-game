import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import ghPages from 'gh-pages';

const production = !process.env.ROLLUP_WATCH;

export default {
  input: 'src/main.js',
  output: {
    sourcemap: true,
    format: 'iife',
    name: 'app',
    file: 'public/build/bundle.js',
  },
  plugins: [
    svelte({
      // увімкнути перевірку під час виконання, коли вона не працює
      dev: !production,
      // ми витягнемо будь-який компонент CSS
      // окремий файл - краще для продуктивності
      css: (css) => {
        css.write('public/build/bundle.css');
      },
    }),

    // Якщо у вас встановлені зовнішні залежності з
    // npm, вам, швидше за все, знадобляться ці плагіни.
    // у деяких випадках вам знадобиться додаткова конфігурація -
    // зверніться до документації для деталей:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ['svelte'],
    }),
    commonjs(),

    // У режимі розробника один раз викликати `npm run start`
    // пакет було згенеровано
    !production && serve(),

    // Перегляньте каталог `public` та оновіть
    // браузер змінює, коли він не працює
    !production && livereload('public'),

    // Якщо ми збираємось для виробництва (npm run build
    // замість of npm run dev), мінімізувати
    production && terser() && ghPages.publish('public'),
  ],
  watch: {
    clearScreen: false,
  },
};

function serve() {
  let started = false;

  return {
    writeBundle() {
      if (!started) {
        started = true;

        require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        });
      }
    },
  };
}