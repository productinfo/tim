const gulp = require('gulp');
const stylus = require('gulp-stylus');
const concat = require('gulp-concat');
const runElectron = require('gulp-run-electron');
const notify = require('gulp-notify');
const plumber = require('gulp-plumber');
const sourcemaps = require('gulp-sourcemaps');
// const debug = require('gulp-debug');
// const minifyCSS = require('gulp-csso');


gulp.task('js', () => gulp
	.src('src/**/*.js')
	.pipe(plumber({errorHandler: notify.onError('JS: <%= error.message %>')}))
	.pipe(gulp.dest('app/'))
);


gulp.task('css', () => gulp
	.src('src/**/*.styl')
	.pipe(sourcemaps.init())
	.pipe(plumber({errorHandler: notify.onError('Stylus: <%= error.message %>')}))
	.pipe(stylus({ include: __dirname + '/src'}))
	.pipe(concat('app.css'))
	.pipe(sourcemaps.write())
	.pipe(gulp.dest('app/'))
);

gulp.task('webview-css', () => gulp
	.src('src/**/webview.css')
	.pipe(gulp.dest('app/'))
);

gulp.task('preview-html', () => gulp
	.src('src/preview/index.html')
	.pipe(gulp.dest('app/preview/'))
);


gulp.task('electron', ['build'], () => gulp
	.src('./')
	.pipe(runElectron())
);

gulp.task('build', ['js', 'css', 'webview-css', 'preview-html']);


gulp.task('w', ['build'], () => {
	gulp.watch('src/**/webview.css', ['webview-css']);
	gulp.watch('src/**/*.styl', ['css']);
	gulp.watch('src/**/*.js', ['js']);
});

gulp.task('a', ['electron'], () => {
	gulp.watch('src/**/webview.css', ['webview-css']);
	gulp.watch('src/**/*.styl', ['css']);
	gulp.watch('src/**/*.js', ['js']);
});


gulp.task('default', ['build']);

