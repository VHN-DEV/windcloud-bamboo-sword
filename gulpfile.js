const gulp = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const fs = require('fs');
const path = require('path');

function collectRelativeFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const results = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }

      results.push(path.relative(rootDir, fullPath));
    });
  }

  return results;
}

function removeEmptyDirs(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  entries.forEach((entry) => {
    if (!entry.isDirectory()) {
      return;
    }

    const fullPath = path.join(rootDir, entry.name);
    removeEmptyDirs(fullPath);

    if (fs.readdirSync(fullPath).length === 0) {
      fs.rmdirSync(fullPath);
    }
  });
}

// 0. Dọn các file thừa trong public/assets trước mỗi lần build
gulp.task('prune-stale-assets', function (done) {
  const srcRoot = path.join(__dirname, 'src/assets');
  const publicRoot = path.join(__dirname, 'public/assets');

  const managedTargets = [
    {
      srcDir: path.join(srcRoot, 'images'),
      destDir: path.join(publicRoot, 'images'),
      ignoreSrc: () => false
    },
    {
      srcDir: path.join(srcRoot, 'fonts'),
      destDir: path.join(publicRoot, 'fonts'),
      ignoreSrc: (relativePath) => path.basename(relativePath).startsWith('._')
    }
  ];

  managedTargets.forEach(({ srcDir, destDir, ignoreSrc }) => {
    if (!fs.existsSync(destDir)) {
      return;
    }

    const expected = new Set(
      collectRelativeFiles(srcDir).filter((relativePath) => !ignoreSrc(relativePath))
    );
    const current = collectRelativeFiles(destDir);

    current.forEach((relativePath) => {
      if (expected.has(relativePath)) {
        return;
      }

      fs.rmSync(path.join(destDir, relativePath), { force: true });
    });

    removeEmptyDirs(destDir);
  });

  // JS/CSS build output chỉ giữ lại file đích chính
  const managedSingleFiles = [
    {
      dir: path.join(publicRoot, 'css'),
      keep: new Set(['styles.min.css'])
    },
    {
      dir: path.join(publicRoot, 'js'),
      keep: new Set(['scripts.min.js'])
    },
    {
      dir: path.join(publicRoot, 'images/icons'),
      keep: new Set(['icons-manifest.json', 'icons-manifest.js'])
    }
  ];

  managedSingleFiles.forEach(({ dir, keep }) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach((entry) => {
      if (entry.isDirectory() || keep.has(entry.name)) {
        return;
      }

      fs.rmSync(path.join(dir, entry.name), { force: true });
    });
  });

  done();
});

// 1. Biên dịch styles.scss (Đã sửa tên cho khớp với ảnh của bạn)
gulp.task('build-css', function () {
  return gulp.src('src/assets/css/styles.scss') // Bỏ chữ 's' ở styles
    .pipe(sass().on('error', sass.logError))
    .pipe(cleanCSS())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('public/assets/css'));
});

// 2. Gộp các file JS thành scripts.min.js
gulp.task('build-js', function () {
  return gulp.src([
    'src/assets/js/config/app-config.js',
    'src/assets/js/state/game-context.js',
    'src/assets/js/core/shared-constants.js',
    'src/assets/js/core/shared-utils.js',
    'src/assets/js/core/runtime-globals.js',
    'src/assets/js/core/gameplay-definitions.js',
    'src/assets/js/core/player-defaults.js',
    'src/assets/js/entities/enemy.js',
    'src/assets/js/entities/sword.js',
    'src/assets/js/entities/starField.js',
    'src/assets/js/entities/pill.js',
    'src/assets/js/entities/camera.js',
    'src/assets/js/features/ui/ui-core.js',
    'src/assets/js/features/ui/insect-ui-shared.js',
    'src/assets/js/features/ui/item-ui-shared.js',
    'src/assets/js/features/ui/resource-ui-shared.js',
    'src/assets/js/features/ui/shop-ui.js',
    'src/assets/js/features/ui/inventory-ui.js',
    'src/assets/js/features/ui/alchemy-ui.js',
    'src/assets/js/features/ui/beast-bag-ui.js',
    'src/assets/js/features/ui/map-ui.js',
    'src/assets/js/features/ui/settings-ui.js',
    'src/assets/js/features/ui/cultivation-panels-ui.js',
    'src/assets/js/features/progression/game-progress.js',
    'src/assets/js/features/input/input-state.js',
    'src/assets/js/features/input/input-player-combat-methods.js',
    'src/assets/js/features/input/input-progression-insect-methods.js',
    'src/assets/js/features/input/input-item-artifact-methods.js',
    'src/assets/js/features/input/input-controller.js',
    'src/assets/js/core/engine/input-and-sword-overrides.js',
    'src/assets/js/core/engine/game-loop.js',
    'src/assets/js/features/systems/thunder-bamboo-system.js',
    'src/assets/js/vendors/three/three.min.js',
    'src/assets/js/vendors/three/OrbitControls.js',
    'src/assets/js/vendors/seedrandom/seedrandom.min.js',
    'src/assets/js/app/main.js',
  ])
    .pipe(concat('scripts.js'))
    .pipe(terser())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('public/assets/js'));
});


// 3. Tạo manifest động cho icon SVG
gulp.task('build-icons-manifest', function (done) {
  const iconDir = path.join(__dirname, 'public/assets/images/icons');
  const outputDir = path.join(__dirname, 'public/assets/images/icons');
  const outputJsonFile = path.join(outputDir, 'icons-manifest.json');
  const outputJsFile = path.join(outputDir, 'icons-manifest.js');

  const files = fs.readdirSync(iconDir)
    .filter((file) => file.toLowerCase().endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputJsonFile, JSON.stringify(files, null, 2), 'utf8');
  fs.writeFileSync(outputJsFile, `window.__ICON_MANIFEST__ = ${JSON.stringify(files, null, 2)};
`, 'utf8');
  done();
});

// 3. Copy hình ảnh sang public
gulp.task('copy-images', function () {
  return gulp.src('src/assets/images/**/*', { encoding: false })
    .pipe(gulp.dest('public/assets/images'));
});

// 4. Copy font sang public
gulp.task('copy-fonts', function () {
  return gulp.src([
    'src/assets/fonts/**/*.{otf,ttf,woff,woff2}',
    '!src/assets/fonts/._*'
  ], { encoding: false })
    .pipe(gulp.dest('public/assets/fonts'));
});

// Task chạy mặc định
gulp.task('default', gulp.series(
  'prune-stale-assets',
  gulp.parallel('build-css', 'build-js', 'copy-fonts', gulp.series('copy-images', 'build-icons-manifest'))
));

// Task theo dõi thay đổi
gulp.task('watch', function () {
  gulp.watch('src/assets/css/**/*.scss', gulp.series('build-css'));
  gulp.watch('src/assets/js/**/*.js', gulp.series('build-js'));
  gulp.watch('src/assets/images/**/*', gulp.series('copy-images', 'build-icons-manifest'));
  gulp.watch('src/assets/fonts/**/*.{otf,ttf,woff,woff2}', gulp.series('copy-fonts'));
});
