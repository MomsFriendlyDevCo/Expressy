import _ from 'lodash';
import chokidar from 'chokidar';
import Debug from 'debug';
import Express from 'express';

const debug = Debug('expressy');

export default class Expressy {

	/**
	* Eventual Express instance we are proxying
	* This is setup during `boot()`
	* @type {Express}
	*/
	express;


	/**
	* Inner route we actually mutate
	* This reference can be rebuilt on the fly by `build()`
	* @type {Express.Router}
	*/
	expressRouter;


	/**
	* HTTP server instance when express has triggered
	* @type {HttpServer}
	*/
	server = null;


	/**
	* Instanciated Chokidar watcher
	* @type {Chokidar}
	*/
	watcher = null;


	/**
	* Worker function which actually handles imports
	* By default this calls any exported functions with the context of `importContext` and args from `importArgs` but can be customized by subclassing
	* @type {Function<Promise>} Function called as `(path)` to import / inject discovered routes
	*/
	importHandler(path) {
		return import(path)
			.then(module => Promise.all(
				Object.entries(module)
					.filter(([, func]) => typeof func == 'function')
					.map(([name, func]) => {
						debug(`Import ${path} #${name}()`)
						return func.apply(this.importContext, this.importArgs);
					})
			))
	}


	/**
	* The context passed to anything imported via `add(path)` / `importHandler(path)`
	* @type {*} The context to call the imported functions
	*/
	importContext = [this];


	/**
	* The parameters passed to anything imported via `add(path)` / `importHandler(path)`
	* @type {Array<*>} Arguments passed, in order, to each imported functon
	*/
	importArgs = [this];


	/**
	* Queued routes
	* @type {Array<Object>} Collection of routes to use
	* @property {String} method The method to trap
	* @property {String|RegExp|Array<String>|Array<RegExp>} path The express compatible path
	* @property {Array<Function>} handlers The express handlers for the route
	*/
	routes = [];


	/**
	* Trappable router methods
	* @type {Array<String>}
	*/
	methods = ['use', 'delete', 'get', 'head', 'options', 'patch', 'post', 'set', 'use'];


	/**
	* Worker to actually queue up a route
	* @param {String} method The method to trap
	* @param {String|RegExp|Array<String>|Array<RegExp>} path The express compatible path
	* @param {Array<Function>} handlers The express handlers for the route
	* @returns {Expressy} This chainable instance
	*/
	addRoute(method, path, ...handlers) {
		this.routes.push({
			method,
			path,
			handlers,
		});

		return this;
	}


	/**
	* Build all routes and return an Express server
	* @returns {Promise<Expressy>} This chainable eventual instance when building has completed
	*/
	build() {
		debug('Build routes');

		this.expressRouter = Express.Router();

		_(this.routes)
			.sortBy(route => {
				var sortPath = // Decide primary path element to sort by
					_.isString(route.path) ? route.path // Strings: Use simple string if there is only one route
					: _.isArray(route.path) ? _.first(route.path) // Arrays: Use first element if its an array
					: _.isRegExp(route.path) ? route.path.toString().replace(/\/\//g, '/') // RegExp: try to tidy up path components at least
					: null; // Use null - should sort to high priority

				return _.isString(sortPath) // Translate "/" + ":" into low ranking sort characters
					? sortPath
						.replace(/\//g, String.fromCharCode(824))
						.replace(/:/g, String.fromCharCode(818))
						.replace(/\?/g, String.fromCharCode(825))
					: '';
			})
			.forEach(route => {
				if (debug.enabled) debug(
					'ROUTE',
					route.method.toUpperCase(),
					...(typeof route.path == 'string' ? [route.path] : [])
				);

				this.expressRouter[route.method](
					route.path,
					...route.handlers,
				);
			});

		// FIXME: Assumes all routes are sync
		return Promise.resolve(this);
	}


	/**
	* Boot the server for the first time
	* @param {Object} options Options to mutate behaviour
	* @param {String} [options.host='localhost'] Host to listen on
	* @param {Number} [options.port=8080] The port to listen on
	* @returns {Expressy} This eventual instance when the server is now setup
	*/
	boot(options) {
		let settings = {
			host: 'localhost',
			port: 8080,
			...options,
		};

		debug('Boot');
		return Promise.resolve()
			.then(()=> this.express = Express())
			.then(()=> this.express.use((req, res, next) =>
				this.expressRouter(req, res, next) // Defer all routing to the custom router
			))
			.then(()=> this.build())
			.then(()=> new Promise(resolve =>
				this.server = this.express.listen(settings.port, settings.host, resolve)
			))
			.then(()=> this)
	}


	/**
	* Close the server and clean up
	* @returns {Promise} A promise which resolves when the operation has completed
	*/
	close() {
		return Promise.all([
			// Close express + expressRouter + server {{{
			new Promise(resolve => {
				this.express = null;
				this.expressRouter = null;

				if (this.server) {
					debug('Closing server');
					this.server.close(()=> resolve());
				} else {
					resolve();
				}
			})
				.then(()=> this.server = null),
			// }}}
			// Close Chokidar watcher {{{
			this.watcher && this.watcher.close(),
			// }}}
		]);
	}


	/**
	* Dynamically rebuild all endpoints related to one file
	* @param {String} path The path to the file with th endpoints to rebuild
	* @returns {Promise} A promise which resolves when the operation has completed
	*/
	hotswap(path) {
		debug('Hotswap', path);
		return this.build();
	}


	/**
	* @param {Object|String} options Options to mutate behaviour, if a string is given its assumed to popupate `paths`
	* @param {String|Array<String>} paths Paths to watch
	* @returns {Promise<Expressy>} This chainable instance when the intiial file discovery loop completes
	*/
	watch(options) {
		let settings = {
			paths: null,
			hotswap: true,
			...(typeof options == 'string' ? {paths: options} : options),
		};
		if (!settings.paths) throw new Error('Must specify at least one `paths` path/glob entry to watch');
		debug('Watch', settings.paths);

		return new Promise(resolve => {
			let booting = true;
			let importPromises = []; // Array of promises we are waiting to conclude during initial boot import

			this.watcher = chokidar.watch(settings.paths, {
				awaitWriteFinish: true,
				ignoreInitial: false, // Trigger the initial `add(path)` calls for all matching files
			})
				.on('add', path => booting // Discover new file while booting?
					? importPromises.push(this.add(path)) // Add to router stack + wait for import to conclude
					: this.build() // Rebuild everything
				)
				.on('unlink', this.build) // Discover deleted file? Rebuild router
				.on('ready', ()=> { // Finished initial scan?
					booting = false;
					debug('Watch complete');
					resolve(importPromises);
				})

			if (settings.hotswap)
				this.watcher.on('change', path => {
					console.warn('HOTSWAP CHANGE', path);
					this.hotswap(path);
				})
		})
			.then(importPromises => Promise.all(importPromises))
			.then(()=> debug('Watch inclusion of', settings.paths, 'complete'))
	}


	/**
	* Add a single path into the router list
	* This does NOT cause a build event, just an import
	* This function is really just a wrapper around `importHandler()` which does the actual work
	* @param {String} path The path to import
	* @returns {Promise} A promise which resolves when the operation has completed
	*/
	add(path) {
		debug('Add', path);
		return this.importHandler(path);
	}


	constructor() {
		// Set up all methods as functions (e.g. `expressy.get()` -> `addMethod('get', ...)`)
		this.methods.forEach(method =>
			this[method] = (path, ...handlers) => this.addRoute(method, path, ...handlers)
		);
	}
}
