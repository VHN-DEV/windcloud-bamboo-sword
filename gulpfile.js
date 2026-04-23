const gulp = require('gulp');
const concat = require('gulp-concat');
const terser = require('gulp-terser');
const sass = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const fs = require('fs');
const path = require('path');

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
  const iconDir = path.join(__dirname, 'src/assets/images/icons');
  const outputDir = path.join(__dirname, 'public/assets/images/icons');
  const outputFile = path.join(outputDir, 'icons-manifest.json');

  const files = fs.readdirSync(iconDir)
    .filter((file) => file.toLowerCase().endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b));

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(files, null, 2), 'utf8');
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
gulp.task('default', gulp.parallel('build-css', 'build-js', 'copy-images', 'copy-fonts', 'build-icons-manifest'));

// Task theo dõi thay đổi
gulp.task('watch', function () {
  gulp.watch('src/assets/css/**/*.scss', gulp.series('build-css'));
  gulp.watch('src/assets/js/**/*.js', gulp.series('build-js'));
  gulp.watch('src/assets/images/**/*', gulp.series('copy-images', 'build-icons-manifest'));
  gulp.watch('src/assets/fonts/**/*.{otf,ttf,woff,woff2}', gulp.series('copy-fonts'));
});
